import { getAccessToken, parseServiceAccount, type Env } from '../../../../shared/ai-core'
import { fail, json, verifyIdToken } from '../../_lib/auth'

/**
 * POST /api/admin/students/import
 *
 * 강사가 CSV(학번,이름)를 올리면 계정을 일괄 생성한다.
 *
 * 흐름 (지시서 4.3):
 *  1. 호출자 ID 토큰 검증 + instructors/{uid} 존재 확인
 *  2. 서비스 계정 JWT → OAuth2 토큰 (shared/ai-core.ts 의 코드 재사용)
 *  3. Identity Toolkit REST 로 계정 생성, 초기 비밀번호 = 학번
 *  4. users/{uid} 생성, mustResetPassword: true
 *
 * 학번 2024123456 → 2024123456@students.slstudio.local
 * 존재하지 않는 도메인을 쓴다. 메일 발송 기능은 사용하지 않는다.
 */

const IDENTITY_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit'
const CLOUD_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

interface Row {
  studentId: string
  name: string
}

export const onRequestPost: PagesFunction<Env & { STUDENT_EMAIL_DOMAIN?: string }> = async (ctx) => {
  const authHeader = ctx.request.headers.get('authorization')
  const caller = await verifyIdToken(authHeader, ctx.env.FIREBASE_PROJECT_ID)
  if (!caller) return fail('로그인이 필요합니다.')

  const project = ctx.env.FIREBASE_PROJECT_ID
  if (!project) return fail('FIREBASE_PROJECT_ID 가 설정되지 않았습니다.')

  const instructorOk = await docExists(project, `instructors/${caller.uid}`, authHeader)
  if (!instructorOk) return fail('강사만 계정을 만들 수 있습니다.')

  const sa = parseServiceAccount(ctx.env.GCP_SERVICE_ACCOUNT)
  if (!sa) return fail('서비스 계정이 설정되지 않았습니다.')

  let body: { students?: Row[] }
  try {
    body = (await ctx.request.json()) as typeof body
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }

  const rows = (body.students ?? []).filter((r) => /^\d{4,}$/.test(String(r.studentId ?? '')))
  if (rows.length === 0) return fail('학번 형식이 맞는 줄이 없습니다.')
  if (rows.length > 300) return fail('한 번에 300명까지 만들 수 있습니다.')

  const domain = ctx.env.STUDENT_EMAIL_DOMAIN || 'students.slstudio.local'

  let token: string
  try {
    token = await getAccessToken(sa, `${IDENTITY_SCOPE} ${CLOUD_SCOPE}`)
  } catch (err) {
    return fail(`토큰을 받지 못했습니다: ${(err as Error).message}`)
  }

  let created = 0
  /** 이미 계정이 있어서 명단 문서만 맞춘 수 */
  let linked = 0
  const failures: string[] = []

  for (const row of rows) {
    const studentId = String(row.studentId).trim()
    const email = `${studentId}@${domain}`
    const name = String(row.name ?? '').trim()
    try {
      // Identity Toolkit — 초기 비밀번호는 학번
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ email, password: studentId, emailVerified: false }),
        },
      )
      const data = (await res.json()) as { localId?: string; error?: { message?: string } }

      let uid = data.localId ?? null
      let isNew = uid !== null

      /*
       * 이미 있는 계정은 실패가 아니다.
       *
       * 학기 중에 늦게 등록한 학생을 넣으려면 강사는 명단 전체를 다시 붙여넣는다.
       * 그때마다 EMAIL_EXISTS 로 전부 막히면 이 화면은 한 번밖에 못 쓴다.
       * 그래서 이미 있으면 그 계정을 찾아 명단 문서만 맞춘다.
       *
       * 비밀번호는 건드리지 않는다 — 학생이 이미 바꿨을 수 있다.
       */
      if (!uid && data.error?.message?.startsWith('EMAIL_EXISTS')) {
        uid = await lookupUid(project, token, email)
        isNew = false
        if (!uid) {
          failures.push(`${studentId}: 이미 있는 계정인데 찾지 못했습니다`)
          continue
        }
      }

      if (!uid) {
        failures.push(`${studentId}: ${data.error?.message ?? '생성 실패'}`)
        continue
      }

      const saved = await upsertUserDoc(project, token, uid, studentId, name, isNew)
      if (!saved.ok) {
        failures.push(`${studentId}: 계정은 준비됐으나 명단 문서 저장 실패 — ${saved.detail}`)
        continue
      }
      if (isNew) created++
      else linked++
    } catch (err) {
      failures.push(`${studentId}: ${(err as Error).message}`)
    }
  }

  return json({
    ok: true,
    created,
    linked,
    failed: failures.length,
    failures: failures.slice(0, 20),
    message: `${created}개 계정을 만들었습니다. 초기 비밀번호는 학번입니다.`,
  })
}

/** 이미 있는 계정의 uid 를 이메일로 찾는다. */
async function lookupUid(
  project: string,
  token: string,
  email: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ email: [email] }),
      },
    )
    const data = (await res.json()) as { users?: Array<{ localId?: string }> }
    return data.users?.[0]?.localId ?? null
  } catch {
    return null
  }
}

/**
 * users/{uid} 문서를 맞춘다. 실명은 여기에만 둔다. 화면에는 닉네임만 나간다.
 *
 * 새 계정이면 전부 쓴다.
 * 이미 있던 계정이면 학번·실명·역할만 맞추고 나머지는 그대로 둔다 —
 * 학생이 정한 닉네임과 비밀번호 재설정 여부를 다시 눌렀다고 되돌리면 안 된다.
 */
async function upsertUserDoc(
  project: string,
  token: string,
  uid: string,
  studentId: string,
  name: string,
  isNew: boolean,
): Promise<{ ok: boolean; detail: string }> {
  const base = {
    uid: { stringValue: uid },
    role: { stringValue: 'student' },
    studentId: { stringValue: studentId },
    displayName: { stringValue: name },
  }
  const fields = isNew
    ? {
        ...base,
        nickname: { stringValue: '' },
        mustResetPassword: { booleanValue: true },
        groupId: { nullValue: null },
        createdAt: { integerValue: String(Date.now()) },
        lastLoginAt: { integerValue: '0' },
      }
    : base

  // PATCH + updateMask 는 문서가 없으면 만들고, 있으면 지정한 필드만 고친다.
  const mask = Object.keys(fields)
    .map((f) => `updateMask.fieldPaths=${f}`)
    .join('&')

  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${uid}?${mask}`,
      {
        method: 'PATCH',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ fields }),
      },
    )
    if (res.ok) return { ok: true, detail: '' }
    return { ok: false, detail: await describeError(res) }
  } catch (err) {
    return { ok: false, detail: (err as Error).message }
  }
}

/**
 * 실패 응답을 한 줄로 옮긴다.
 *
 * 원문 JSON 을 그대로 화면에 흘리면 강사는 여섯 줄짜리 중괄호 덩어리를 본다.
 * 무엇을 해야 하는지가 그 안에 묻힌다. 자주 나오는 것은 다음 할 일까지 붙여 준다.
 */
async function describeError(res: Response): Promise<string> {
  const raw = await res.text()
  let message = raw.slice(0, 160)
  let status = ''
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; status?: string } }
    if (parsed.error?.message) message = parsed.error.message
    if (parsed.error?.status) status = parsed.error.status
  } catch {
    /* JSON 이 아니면 원문 앞부분을 쓴다 */
  }

  if (res.status === 403 || status === 'PERMISSION_DENIED') {
    return `${message} — 서비스 계정에 Firestore 쓰기 권한이 없습니다. ` +
      'Google Cloud 콘솔 → IAM 에서 그 서비스 계정에 「Cloud Datastore 사용자」 역할을 더하세요.'
  }
  return status ? `${status}: ${message}` : message
}

async function docExists(
  projectId: string,
  path: string,
  authHeader: string | null,
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`,
      { headers: authHeader ? { authorization: authHeader } : {} },
    )
    return res.ok
  } catch {
    return false
  }
}

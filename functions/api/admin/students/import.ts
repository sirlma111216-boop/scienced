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
  const failures: string[] = []

  for (const row of rows) {
    const studentId = String(row.studentId).trim()
    const email = `${studentId}@${domain}`
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
      if (!data.localId) {
        failures.push(`${studentId}: ${data.error?.message ?? '생성 실패'}`)
        continue
      }

      // users/{uid} 생성. 실명은 여기에만 둔다. 화면에는 닉네임만 나간다.
      //
      // 이 응답을 확인하지 않으면, Auth 계정은 생겼는데 문서가 없어서
      // 명단에 뜨지 않는 상태가 조용히 만들어진다. 강사는 이유를 알 수 없다.
      const docRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users?documentId=${data.localId}`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            fields: {
              uid: { stringValue: data.localId },
              role: { stringValue: 'student' },
              studentId: { stringValue: studentId },
              displayName: { stringValue: String(row.name ?? '').trim() },
              nickname: { stringValue: '' },
              mustResetPassword: { booleanValue: true },
              groupId: { nullValue: null },
              createdAt: { integerValue: String(Date.now()) },
              lastLoginAt: { integerValue: '0' },
            },
          }),
        },
      )
      if (!docRes.ok) {
        const detail = (await docRes.text()).slice(0, 120)
        failures.push(`${studentId}: 계정은 만들었으나 명단 문서 저장 실패 — ${detail}`)
        continue
      }
      created++
    } catch (err) {
      failures.push(`${studentId}: ${(err as Error).message}`)
    }
  }

  return json({
    ok: true,
    created,
    failed: failures.length,
    failures: failures.slice(0, 20),
    message: `${created}개 계정을 만들었습니다. 초기 비밀번호는 학번입니다.`,
  })
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

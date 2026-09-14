import { getAccessToken, parseServiceAccount, type Env } from '../../../../shared/ai-core'
import { fail, json, verifyIdToken } from '../../_lib/auth'

/**
 * POST /api/admin/students/repair
 *
 * 학번 하나를 진단하고, 요청하면 되살린다. 강사만.
 *
 * 한 학생이 「계정은 있다는데 로그인도 등록도 안 되는」 자리에 갇혔다(2026-09-15). 원인이 여러 겹일 수
 * 있다 — Auth 계정만 있고 users 문서가 없거나 반쪽이거나, 비밀번호를 바꿨는데 잊었거나, 내보내진 등록이
 * 남아 있거나. 강사 화면의 명단은 users 문서로 만들어서, 문서가 없으면 그 학생은 명단에도 없다.
 * 그래서 학번만으로 진단한다.
 *
 *   body { studentId, repair?: boolean, enrollClassId?: string }
 *   진단   Auth 계정 · users 문서(필드) · 클래스마다 등록 상태
 *   되살리기 (repair)
 *     · users 문서가 없거나 빠진 필드가 있으면 채운다 (닉네임은 있으면 지킨다)
 *     · 비밀번호를 학번으로 되돌리고 mustResetPassword 를 켠다
 *     · lastClassId 를 비운다 — 다음 로그인에 클래스 선택 화면으로 간다
 *   Auth 계정이 없으면 만들지 않는다 — CSV 가져오기가 할 일이다.
 *
 * 학생의 응답·의견·모둠 기록은 건드리지 않는다.
 */

const IDENTITY_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit'
const CLOUD_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

type Fields = Record<string, { stringValue?: string; booleanValue?: boolean; integerValue?: string; nullValue?: null }>

export const onRequestPost: PagesFunction<Env & { STUDENT_EMAIL_DOMAIN?: string }> = async (ctx) => {
  const authHeader = ctx.request.headers.get('authorization')
  const caller = await verifyIdToken(authHeader, ctx.env.FIREBASE_PROJECT_ID)
  if (!caller) return fail('로그인이 필요합니다.')

  const project = ctx.env.FIREBASE_PROJECT_ID
  if (!project) return fail('FIREBASE_PROJECT_ID 가 설정되지 않았습니다.')

  const isInstructor = await fetch(
    `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/instructors/${caller.uid}`,
    { headers: authHeader ? { authorization: authHeader } : {} },
  )
  if (!isInstructor.ok) return fail('강사만 쓸 수 있습니다.')

  const sa = parseServiceAccount(ctx.env.GCP_SERVICE_ACCOUNT)
  if (!sa) return fail('서비스 계정이 설정되지 않았습니다.')

  let body: { studentId?: string; repair?: boolean; enrollClassId?: string }
  try {
    body = (await ctx.request.json()) as typeof body
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  const studentId = String(body.studentId ?? '').trim()
  if (!/^\d{4,}$/.test(studentId)) return fail('학번 형식이 아닙니다.')
  const repair = Boolean(body.repair)
  const enrollClassId = String(body.enrollClassId ?? '').trim()

  const domain = ctx.env.STUDENT_EMAIL_DOMAIN || 'students.slstudio.local'
  const email = `${studentId}@${domain}`
  const fs = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`
  const lines: string[] = []
  const actions: string[] = []

  try {
    const token = await getAccessToken(sa, `${IDENTITY_SCOPE} ${CLOUD_SCOPE}`)
    const h = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

    /* ① Auth 계정 */
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ email: [email] }),
    })
    const found = (await lookup.json()) as { users?: Array<{ localId: string; lastLoginAt?: string; createdAt?: string; disabled?: boolean }> }
    const acct = found.users?.[0]
    if (!acct) {
      lines.push(`① Auth 계정: 없음 (${email}) — 「계정 만들기」의 CSV 로 만들어야 합니다.`)
      return json({ ok: true, found: false, report: lines.join('\n') })
    }
    const uid = acct.localId
    const lastLogin = acct.lastLoginAt ? new Date(Number(acct.lastLoginAt)).toISOString().slice(0, 16).replace('T', ' ') : '없음'
    lines.push(`① Auth 계정: 있음 · uid ${uid.slice(0, 8)}… · 마지막 로그인 ${lastLogin}${acct.disabled ? ' · 비활성' : ''}`)

    /* ② users 문서 */
    const docRes = await fetch(`${fs}/users/${uid}`, { headers: h })
    const doc = docRes.ok ? ((await docRes.json()) as { fields?: Fields }) : null
    const f = doc?.fields ?? {}
    const str = (k: string) => f[k]?.stringValue
    const bool = (k: string) => f[k]?.booleanValue
    if (!doc) {
      lines.push('② users 문서: 없음 — 강사 명단에 안 보이고, 로그인하면 반쪽 상태가 됩니다.')
    } else {
      const missing = ['uid', 'role', 'studentId', 'nickname', 'mustResetPassword', 'groupId', 'createdAt', 'lastLoginAt'].filter((k) => !(k in f))
      lines.push(
        `② users 문서: 있음 · role ${str('role') ?? '?'} · 학번 ${str('studentId') ?? '?'} · 닉네임 ${str('nickname') ? `「${str('nickname')}」` : '없음'} · 비밀번호 재설정 필요 ${bool('mustResetPassword') === true ? '예' : bool('mustResetPassword') === false ? '아니오' : '?'} · 마지막 클래스 ${str('lastClassId') ?? '없음'}${missing.length ? ` · 빠진 필드 ${missing.join(', ')}` : ''}`,
      )
      if (str('role') && str('role') !== 'student') lines.push(`   ⚠ role 이 ${str('role')} 입니다.`)
      if (str('studentId') && str('studentId') !== studentId) lines.push(`   ⚠ 문서의 학번(${str('studentId')})이 다릅니다.`)
    }

    /* ③ 클래스마다 등록 */
    const classesRes = await fetch(`${fs}/classes?pageSize=50`, { headers: h })
    const classes = classesRes.ok ? (((await classesRes.json()) as { documents?: Array<{ name: string; fields?: Fields }> }).documents ?? []) : []
    for (const c of classes) {
      const cid = c.name.split('/').pop()!
      const cname = c.fields?.displayName?.stringValue ?? cid
      const e = await fetch(`${fs}/classes/${cid}/enrollments/${uid}`, { headers: h })
      if (!e.ok) {
        lines.push(`③ ${cname}: 등록 없음`)
        continue
      }
      const ef = ((await e.json()) as { fields?: Fields }).fields ?? {}
      const status = ef.status?.stringValue ?? '?'
      const extra = ['currentGroupId', 'currentRoundId'].filter((k) => k in ef)
      lines.push(`③ ${cname}: 등록 ${status === 'active' ? '있음(active)' : status === 'ended' ? '내보내짐(ended)' : status}${extra.length ? ` · 모둠 자리 키 남음(${extra.join(', ')})` : ''}`)
    }

    /*
     * ④-0 등록시키기.
     * 규칙상 등록 문서는 학생 본인만, 그것도 「수강 등록 열림」일 때만 만들 수 있어 강사가 학생을 직접
     * 넣을 길이 없었다. 서비스 계정으로 넣는다 — 등록이 닫힌 클래스에 늦게 온 학생, 두 수업을 함께 듣는 학생.
     */
    if (enrollClassId) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(enrollClassId)) return json({ ok: false, message: '클래스 id 형식이 아닙니다.', report: lines.join('\n') })
      const cls = classes.find((c) => c.name.endsWith(`/${enrollClassId}`))
      if (!cls) return json({ ok: false, message: '그 클래스가 없습니다.', report: lines.join('\n') })
      if (cls.fields?.status?.stringValue !== 'active') return json({ ok: false, message: '보관된 클래스에는 넣지 않습니다.', report: lines.join('\n') })
      const now = String(Date.now())
      const ef: Fields = {
        uid: { stringValue: uid },
        studentId: { stringValue: studentId },
        nickname: { stringValue: str('nickname') ?? '' },
        groupId: { nullValue: null },
        joinedAt: { integerValue: now },
        lastSeenAt: { integerValue: now },
        status: { stringValue: 'active' },
      }
      const emask = Object.keys(ef)
        .map((k) => `updateMask.fieldPaths=${k}`)
        .join('&')
      const put = await fetch(`${fs}/classes/${enrollClassId}/enrollments/${uid}?${emask}`, { method: 'PATCH', headers: h, body: JSON.stringify({ fields: ef }) })
      if (!put.ok) return json({ ok: false, message: `등록 문서를 만들지 못했습니다 (${put.status})`, report: lines.join('\n') })
      await fetch(`${fs}/users/${uid}?updateMask.fieldPaths=lastClassId`, { method: 'PATCH', headers: h, body: JSON.stringify({ fields: { lastClassId: { stringValue: enrollClassId } } }) })
      actions.push(`「${cls.fields?.displayName?.stringValue ?? enrollClassId}」에 등록시켰다(active). 학생이 새로고침하면 그 클래스로 들어간다`)
      if (!repair) return json({ ok: true, found: true, report: lines.join('\n'), actions, message: '등록시켰습니다.' })
    }

    if (!repair) return json({ ok: true, found: true, report: lines.join('\n') })

    /* ④ 되살리기 — users 문서 */
    const fields: Fields = {
      uid: { stringValue: uid },
      role: { stringValue: 'student' },
      studentId: { stringValue: studentId },
      mustResetPassword: { booleanValue: true },
      lastClassId: { nullValue: null },
    }
    if (!doc || !('nickname' in f)) fields.nickname = { stringValue: '' }
    if (!doc || !('groupId' in f)) fields.groupId = { nullValue: null }
    if (!doc || !('createdAt' in f)) fields.createdAt = { integerValue: String(Date.now()) }
    if (!doc || !('lastLoginAt' in f)) fields.lastLoginAt = { integerValue: '0' }
    const mask = Object.keys(fields)
      .map((k) => `updateMask.fieldPaths=${k}`)
      .join('&')
    const patch = await fetch(`${fs}/users/${uid}?${mask}`, { method: 'PATCH', headers: h, body: JSON.stringify({ fields }) })
    if (!patch.ok) return json({ ok: false, message: `users 문서를 고치지 못했습니다 (${patch.status})`, report: lines.join('\n') })
    actions.push(doc ? 'users 문서의 빠진 필드를 채우고 마지막 클래스를 비웠다' : 'users 문서를 새로 만들었다')

    /* ⑤ 비밀번호 = 학번 */
    const upd = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:update`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ localId: uid, password: studentId, disableUser: false }),
    })
    if (!upd.ok) {
      const e = (await upd.json()) as { error?: { message?: string } }
      return json({ ok: false, message: `비밀번호를 되돌리지 못했습니다: ${e.error?.message ?? upd.status}`, report: lines.join('\n'), actions })
    }
    actions.push('비밀번호를 학번으로 되돌리고 재설정을 켰다')

    return json({
      ok: true,
      found: true,
      report: lines.join('\n'),
      actions,
      message: '되살렸습니다. 학생은 학번 + 학번으로 로그인해 닉네임·비밀번호를 정한 뒤 수업을 고릅니다.',
    })
  } catch (err) {
    return fail(`진단 중 오류: ${(err as Error).message}`)
  }
}

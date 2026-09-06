import { getAccessToken, parseServiceAccount, type Env } from '../../../../shared/ai-core'
import { fail, json, verifyIdToken } from '../../_lib/auth'

/**
 * POST /api/admin/students/reset-password
 *
 * 강사가 누르면 비밀번호를 학번으로 되돌리고 mustResetPassword 를 다시 켠다.
 * 학생은 학번 + 학번으로 들어와 /reset-password 로 강제 이동한다.
 *
 * 강사 화면에는 "초기 비밀번호는 학번입니다"만 표시한다.
 */

const IDENTITY_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit'
const CLOUD_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

export const onRequestPost: PagesFunction<Env & { STUDENT_EMAIL_DOMAIN?: string }> = async (ctx) => {
  const authHeader = ctx.request.headers.get('authorization')
  const caller = await verifyIdToken(authHeader, ctx.env.FIREBASE_PROJECT_ID)
  if (!caller) return fail('로그인이 필요합니다.')

  const project = ctx.env.FIREBASE_PROJECT_ID
  if (!project) return fail('FIREBASE_PROJECT_ID 가 설정되지 않았습니다.')

  const res0 = await fetch(
    `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/instructors/${caller.uid}`,
    { headers: authHeader ? { authorization: authHeader } : {} },
  )
  if (!res0.ok) return fail('강사만 비밀번호를 초기화할 수 있습니다.')

  const sa = parseServiceAccount(ctx.env.GCP_SERVICE_ACCOUNT)
  if (!sa) return fail('서비스 계정이 설정되지 않았습니다.')

  let body: { studentId?: string }
  try {
    body = (await ctx.request.json()) as typeof body
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  const studentId = String(body.studentId ?? '').trim()
  if (!/^\d{4,}$/.test(studentId)) return fail('학번 형식이 아닙니다.')

  const domain = ctx.env.STUDENT_EMAIL_DOMAIN || 'students.slstudio.local'
  const email = `${studentId}@${domain}`

  try {
    const token = await getAccessToken(sa, `${IDENTITY_SCOPE} ${CLOUD_SCOPE}`)

    // 계정 찾기
    const lookup = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ email: [email] }),
      },
    )
    const found = (await lookup.json()) as { users?: Array<{ localId: string }> }
    const localId = found.users?.[0]?.localId
    if (!localId) return fail('그 학번의 계정을 찾지 못했습니다.')

    // 비밀번호를 학번으로 되돌린다
    const upd = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:update`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ localId, password: studentId }),
      },
    )
    if (!upd.ok) {
      const e = (await upd.json()) as { error?: { message?: string } }
      return fail(`초기화 실패: ${e.error?.message ?? '알 수 없음'}`)
    }

    // 다음 로그인 때 새 비밀번호와 닉네임을 정하게 한다
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${localId}?updateMask.fieldPaths=mustResetPassword`,
      {
        method: 'PATCH',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ fields: { mustResetPassword: { booleanValue: true } } }),
      },
    )

    return json({ ok: true, message: '초기 비밀번호는 학번입니다.' })
  } catch (err) {
    return fail(`초기화 중 오류: ${(err as Error).message}`)
  }
}

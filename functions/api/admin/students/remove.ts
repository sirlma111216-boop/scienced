import { getAccessToken, parseServiceAccount, type Env } from '../../../../shared/ai-core'
import { fail, json, verifyIdToken } from '../../_lib/auth'

/**
 * POST /api/admin/students/remove
 *
 * 수강 종료. 계정을 지우고 users/{uid} 를 삭제한다.
 *
 * 학생이 남긴 응답과 의견은 이 요청으로 지워지지 않는다.
 * 삭제 요청은 별도 절차로 처리하고, 익명 집계는 그대로 둔다.
 * (컨텍스트 19.8 — 학생 응답 원문과 분석용 익명 자료를 분리한다)
 */

const IDENTITY_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit'
const CLOUD_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

export const onRequestPost: PagesFunction<Env & { STUDENT_EMAIL_DOMAIN?: string }> = async (ctx) => {
  const authHeader = ctx.request.headers.get('authorization')
  const caller = await verifyIdToken(authHeader, ctx.env.FIREBASE_PROJECT_ID)
  if (!caller) return fail('로그인이 필요합니다.')

  const project = ctx.env.FIREBASE_PROJECT_ID
  if (!project) return fail('FIREBASE_PROJECT_ID 가 설정되지 않았습니다.')

  const check = await fetch(
    `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/instructors/${caller.uid}`,
    { headers: authHeader ? { authorization: authHeader } : {} },
  )
  if (!check.ok) return fail('강사만 수강을 종료할 수 있습니다.')

  const sa = parseServiceAccount(ctx.env.GCP_SERVICE_ACCOUNT)
  if (!sa) return fail('서비스 계정이 설정되지 않았습니다.')

  let body: { studentId?: string; alsoDeleteResponses?: boolean }
  try {
    body = (await ctx.request.json()) as typeof body
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  const studentId = String(body.studentId ?? '').trim()
  if (!/^\d{4,}$/.test(studentId)) return fail('학번 형식이 아닙니다.')

  const domain = ctx.env.STUDENT_EMAIL_DOMAIN || 'students.slstudio.local'

  try {
    const token = await getAccessToken(sa, `${IDENTITY_SCOPE} ${CLOUD_SCOPE}`)

    const lookup = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ email: [`${studentId}@${domain}`] }),
      },
    )
    const found = (await lookup.json()) as { users?: Array<{ localId: string }> }
    const localId = found.users?.[0]?.localId
    if (!localId) return fail('그 학번의 계정을 찾지 못했습니다.')

    await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:delete`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ localId }),
    })

    await fetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${localId}`,
      { method: 'DELETE', headers: { authorization: `Bearer ${token}` } },
    )

    return json({
      ok: true,
      message:
        '계정을 삭제했습니다. 이미 제출된 응답과 의견은 남아 있습니다. ' +
        '원문 삭제가 필요하면 별도 요청으로 처리합니다.',
    })
  } catch (err) {
    return fail(`삭제 중 오류: ${(err as Error).message}`)
  }
}

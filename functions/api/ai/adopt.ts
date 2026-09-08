import { getAccessToken, markAiAdopted, parseServiceAccount, type Env } from '../../../shared/ai-core'
import { fail, json, verifyIdToken } from '../_lib/auth'

/**
 * POST /api/ai/adopt
 *
 * 학생이 「이 제안을 받아들이기」를 눌렀을 때 그 사실만 남긴다.
 *
 * 화면은 「채택 여부가 함께 기록됩니다」라고 말해 왔는데, 실제로는 아무 데도
 * 기록되지 않고 있었다. 화면이 하는 말과 실제가 달랐다.
 *
 * 남기는 것은 채택 여부뿐이다. 프롬프트도 모델 응답도 저장하지 않는다.
 * aiLogs 는 규칙에서 클라이언트 쓰기를 막아 두었으므로(allow write: if false)
 * 서버가 서비스 계정으로 쓴다 — 학생 브라우저가 기록을 지어내지 못한다.
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const auth = ctx.request.headers.get('authorization')
  const user = await verifyIdToken(auth, ctx.env.FIREBASE_PROJECT_ID)
  if (!user) return fail('로그인이 필요합니다.')

  let body: { logId?: string }
  try {
    body = (await ctx.request.json()) as typeof body
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  if (!body.logId) return fail('logId 가 없습니다.')

  const sa = parseServiceAccount(ctx.env.GCP_SERVICE_ACCOUNT)
  if (!sa) return fail('AI 설정이 없습니다.')

  const token = await getAccessToken(sa, 'https://www.googleapis.com/auth/cloud-platform')
  const ok = await markAiAdopted(sa, token, body.logId)

  // 기록을 못 남겨도 학생의 활동은 막지 않는다. 화면에는 그대로 「채택함」이 뜬다.
  return json({ ok })
}

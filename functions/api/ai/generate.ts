import { generate, type Env } from '../../../shared/ai-core'
import { fail, json, rateLimited, verifyIdToken } from '../_lib/auth'

/**
 * POST /api/ai/generate
 *
 * 껍데기만 담당한다. 실제 판단은 shared/ai-core.ts 에 있다.
 *
 * 요청 본문은 { taskId, inputs } 만 받는다.
 * 클라이언트가 프롬프트 원문을 보내지 못한다. 템플릿은 서버에 taskId 별로 고정되어 있다.
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const auth = ctx.request.headers.get('authorization')
  const user = await verifyIdToken(auth, ctx.env.FIREBASE_PROJECT_ID)

  // 로그인하지 않아도 5xx 를 던지지 않는다. 200 + JSON 으로 돌려준다.
  if (!user) return fail('로그인이 필요합니다.')

  const perMin = Number(ctx.env.AI_RATE_PER_MIN || '6')
  if (rateLimited(user.uid, perMin)) {
    return fail(`분당 ${perMin}회까지 쓸 수 있습니다. 잠시 뒤 다시 눌러 주세요.`)
  }

  let body: { taskId?: string; inputs?: Record<string, string> }
  try {
    body = (await ctx.request.json()) as typeof body
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }

  if (!body.taskId) return fail('taskId 가 없습니다.')

  const result = await generate(ctx.env, body.taskId, body.inputs ?? {})
  return json(result)
}

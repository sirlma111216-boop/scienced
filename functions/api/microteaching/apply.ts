import { fail, json, verifyIdToken } from '../_lib/auth'
import { applyMicroteaching, type MtEnv } from '../_lib/microteaching'

/**
 * POST /api/microteaching/apply — 마이크로티칭 발표 자리 신청 { classId, slotId }
 *
 * 로그인한 본인만 자기 자리를 신청한다. 자격 · 기간 · 자리의 유무는 _lib/microteaching 이 가린다.
 */
export const onRequestPost: PagesFunction<MtEnv> = async (ctx) => {
  const user = await verifyIdToken(ctx.request.headers.get('authorization'), ctx.env.FIREBASE_PROJECT_ID)
  if (!user) return fail('로그인이 필요합니다.')
  let body: { classId?: string; slotId?: string }
  try {
    body = (await ctx.request.json()) as typeof body
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  if (!body.classId || !/^[A-Za-z0-9_-]{1,64}$/.test(body.classId)) return fail('클래스 id 가 없습니다.')
  if (!body.slotId || !/^\d{4}-\d{2}-\d{2}_\d$/.test(body.slotId)) return fail('자리 id 가 없습니다.')
  return json(await applyMicroteaching(ctx.env, { classId: body.classId, uid: user.uid, slotId: body.slotId, now: Date.now() }))
}

import { fail, json, verifyIdToken } from '../_lib/auth'
import { moveMicroteaching, type MtEnv } from '../_lib/microteaching'

/** 강사만 기존 신청을 옮긴다. 날짜가 폐지된 자리도 출발점으로 받을 수 있다. */
export const onRequestPost: PagesFunction<MtEnv> = async (ctx) => {
  const user = await verifyIdToken(ctx.request.headers.get('authorization'), ctx.env.FIREBASE_PROJECT_ID)
  if (!user) return fail('로그인이 필요합니다.')
  let b: { classId?: string; uid?: string; fromSlotId?: string; slotId?: string }
  try {
    b = await ctx.request.json() as typeof b
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  if (typeof b.classId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(b.classId) || typeof b.uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(b.uid)) return fail('클래스와 학생을 확인하세요.')
  if (typeof b.fromSlotId !== 'string' || typeof b.slotId !== 'string' || !/^\d{4}-\d{2}-\d{2}_\d$/.test(b.fromSlotId) || !/^\d{4}-\d{2}-\d{2}_\d$/.test(b.slotId)) return fail('발표 자리를 확인하세요.')
  return json(await moveMicroteaching(ctx.env, { classId: b.classId, uid: b.uid, fromSlotId: b.fromSlotId, slotId: b.slotId, actorUid: user.uid }))
}

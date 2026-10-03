import { fail, isInstructorUid, json, verifyIdToken } from '../_lib/auth'
import { cancelMicroteaching, type MtEnv } from '../_lib/microteaching'

/**
 * POST /api/microteaching/cancel — 신청 취소 { classId, uid? }
 *
 * 본인은 자기 것을 지운다. 강사는 uid 를 적어 남의 것을 지운다 (학생이 와서 부탁할 때).
 */
export const onRequestPost: PagesFunction<MtEnv> = async (ctx) => {
  const auth = ctx.request.headers.get('authorization')
  const user = await verifyIdToken(auth, ctx.env.FIREBASE_PROJECT_ID)
  if (!user) return fail('로그인이 필요합니다.')
  let body: { classId?: string; uid?: string }
  try {
    body = (await ctx.request.json()) as typeof body
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  if (!body.classId || !/^[A-Za-z0-9_-]{1,64}$/.test(body.classId)) return fail('클래스 id 가 없습니다.')
  let target = user.uid
  let byInstructor = false
  if (body.uid && body.uid !== user.uid) {
    if (!(await isInstructorUid(ctx.env.FIREBASE_PROJECT_ID, user.uid, auth))) return fail('남의 신청은 강사만 취소할 수 있습니다.')
    target = body.uid
    byInstructor = true
  }
  return json(await cancelMicroteaching(ctx.env, { classId: body.classId, uid: target, byInstructor }))
}

import type { Env } from '../../../shared/ai-core'
import { assignGroups, type AssignInput } from '../../../shared/groups-core'
import { fail, isInstructorUid, json, verifyIdToken } from '../_lib/auth'

/**
 * POST /api/groups/assign — 모둠 배정 (6차 지시서 N.4)
 *
 * 난수는 서버에서만 만든다. 시드를 만들고, 그 시드로 배정을 계산해 결과와 함께 돌려준다.
 * 강사 화면이 미리보기·수동 조정·확정을 거쳐 저장한다 — 사다리와 같은 방식이다.
 * 계산 코드는 shared/groups-core 하나다. 화면(로컬 모드)과 검사가 같은 코드를 쓴다.
 *
 * 강사만 부를 수 있다. 명단·기록은 강사가 읽은 것을 그대로 보낸다 — 이 함수는 저장하지 않는다.
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const auth = ctx.request.headers.get('authorization')
  const user = await verifyIdToken(auth, ctx.env.FIREBASE_PROJECT_ID)
  if (!user) return fail('로그인이 필요합니다.')
  if (!(await isInstructorUid(ctx.env.FIREBASE_PROJECT_ID, user.uid, auth))) {
    return fail('강사만 모둠을 나눌 수 있습니다.')
  }

  let body: Partial<AssignInput> & { classId?: string; lessonId?: string; gameId?: string | null }
  try {
    body = (await ctx.request.json()) as typeof body
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  if (!Array.isArray(body.uids) || body.uids.length === 0) return fail('참석자 목록이 비어 있습니다.')
  if (!body.groupCount || body.groupCount < 2) return fail('모둠 수는 2 이상이어야 합니다.')
  if (body.uids.length > 200) return fail('참석자가 너무 많습니다.')

  const rand = crypto.getRandomValues(new Uint32Array(2))
  const seed = `${body.classId ?? 'class'}::${body.lessonId ?? 'lesson'}::r${body.round ?? 1}::${Date.now().toString(36)}::${rand[0].toString(36)}${rand[1].toString(36)}`

  const t0 = Date.now()
  const result = assignGroups({
    uids: body.uids,
    groupCount: body.groupCount,
    history: body.history ?? {},
    round: body.round ?? 1,
    roundsAhead: body.roundsAhead ?? 1,
    seed,
    mustTogether: body.mustTogether ?? [],
    mustApart: body.mustApart ?? [],
    categories: body.categories,
    categoryMode: body.categoryMode ?? 'none',
    secondChoice: body.secondChoice,
    plannedRemaining: body.plannedRemaining,
    planStale: body.planStale,
  })

  return json({ ok: true, result, ms: Date.now() - t0, runBy: user.uid })
}

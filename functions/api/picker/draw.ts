import type { Env } from '../../../shared/ai-core'
import { fail, json, verifyIdToken } from '../_lib/auth'

/**
 * POST /api/picker/draw
 *
 * 난수를 클라이언트에서 만들지 않는다. 서버가 씨앗을 만들고 결과와 함께 저장한다.
 * 씨앗 하나로 모든 화면이 같은 사다리를 그린다.
 *
 * 강사만 부를 수 있다. 강사 판정은 instructors/{uid} 문서 존재로 한다.
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await verifyIdToken(
    ctx.request.headers.get('authorization'),
    ctx.env.FIREBASE_PROJECT_ID,
  )
  if (!user) return fail('로그인이 필요합니다.')

  // 강사 확인 — Firestore REST 로 instructors/{uid} 존재 여부만 본다.
  const project = ctx.env.FIREBASE_PROJECT_ID
  if (project) {
    const ok = await isInstructor(project, user.uid, ctx.request.headers.get('authorization'))
    if (!ok) return fail('강사만 추첨을 실행할 수 있습니다.')
  }

  let body: { gameId?: string; round?: number }
  try {
    body = (await ctx.request.json()) as typeof body
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  if (!body.gameId) return fail('gameId 가 없습니다.')

  // 씨앗은 서버 난수 + 시각 + 게임 id + 라운드로 만든다.
  // 화면에 그대로 표시되므로 나중에 같은 결과를 재현할 수 있다.
  const rand = crypto.getRandomValues(new Uint32Array(2))
  const seed = `${body.gameId}::r${body.round ?? 1}::${Date.now().toString(36)}::${rand[0].toString(36)}${rand[1].toString(36)}`

  return json({ ok: true, seed, runBy: user.uid, at: Date.now() })
}

async function isInstructor(
  projectId: string,
  uid: string,
  authHeader: string | null,
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/instructors/${uid}`,
      { headers: authHeader ? { authorization: authHeader } : {} },
    )
    return res.ok
  } catch {
    return false
  }
}

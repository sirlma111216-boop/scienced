import type { Env } from '../../../shared/ai-core'
import { fail, json, verifyIdToken } from '../_lib/auth'

/**
 * POST /api/game/time — 서버 시각 (8차 6.4).
 *
 * 반응 시각을 쓰는 게임(늦게 눌러라 · 동시에 눌러라 · 순간 포착)은 클라이언트 시각을 믿지 않는다.
 * 참가할 때 이것을 불러 오프셋(서버 − 내 시계)을 재고, 누른 시각을 서버 시각으로 적는다.
 * 왕복 시간의 절반을 더해 보정한다 — 화면 쪽(src/lib/server-time.ts).
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await verifyIdToken(ctx.request.headers.get('authorization'), ctx.env.FIREBASE_PROJECT_ID)
  if (!user) return fail('로그인이 필요합니다.')
  return json({ ok: true, now: Date.now() })
}

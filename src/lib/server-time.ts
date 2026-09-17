import { apiPost } from './api'

/**
 * 서버 시각 (8차 6.4). 반응 시각 게임은 클라이언트 시각을 믿지 않는다.
 * 참가 때 한 번 재고, 그 오프셋으로 누른 시각을 서버 시각으로 바꾼다.
 * 로컬 저장 모드(서버 없음)에서는 오프셋 0 이다 — 한 브라우저 안이라 어차피 같은 시계다.
 */
let offset = 0
let measured = false

export async function syncServerTime(): Promise<number> {
  const t0 = Date.now()
  const data = await apiPost<{ ok: boolean; now?: number }>('/api/game/time', {})
  const t1 = Date.now()
  if (data.ok && typeof data.now === 'number') {
    /* 왕복의 절반을 더한다 — 응답이 도착한 순간의 서버 시각을 추정 */
    offset = data.now + (t1 - t0) / 2 - t1
    measured = true
  }
  return offset
}

export function serverNow(): number {
  return Date.now() + offset
}

export function serverTimeMeasured(): boolean {
  return measured
}

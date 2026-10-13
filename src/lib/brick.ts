/**
 * 벽돌깨기(브릭픽) — 강의자가 따로 만든 게임(저장소 sirlma111216-boop/Alca, Cloudflare Workers)을 iframe 으로 붙인다 (강의자 지시 2026-10-12).
 *
 * 루미 런·구슬 레이스와 다른 점: **학생 기기마다 따로 돈다.** 학생이 자기 화면에서 [벽돌깨기 열기]를 누르면 iframe 이 뜨고,
 * 게임 안의 준비 화면(설명 한 장)에서 [준비됐어요]를 누르면 3초 뒤 바로 시작한다. 설정 칸은 없다 — 난이도·시간·규칙은 여기서 고정해 보낸다.
 *   · 모두 같은 서버 시드로 같은 판을 받는다 (벽돌 배치·아이템이 같다).
 *   · 2분(또는 목숨을 다 잃을 때까지) 뒤 게임이 COMPLETE 로 결과를 보내면 그 사람의 `bricks`(깬 벽돌 수)를 gameInputs 에 적는다.
 *   · 발표자는 game-core 의 `brick` 계산이 정한다 — 첫 시작 뒤 2분 안에 시작하지 않은 사람 먼저, 그다음 **가장 적게 깬 사람** 순으로 둘. 공개는 마지막 사람이 끝낼 때. 서버·티켓·webhook 이 없다 (점수는 학생 기기가 계산한 값이고 성적에 쓰지 않는다).
 *
 * 메시지 프로토콜은 브릭픽 저장소 `src/adapters/iframe/protocol.ts` 그대로 — READY → INIT → INIT_ACK → START → PROGRESS* → COMPLETE → COMPLETE_ACK.
 * 게임 쪽 배포 설정 두 곳(`public/_headers` 의 frame-ancestors · `VITE_BRICKPICK_ALLOWED_PARENT_ORIGINS`)에 수업 앱 주소가 있어야 열린다.
 */

const BRICK_DEFAULT_ORIGIN = 'https://brickpick.sirlma.workers.dev'
export const BRICK_ORIGIN = (String(import.meta.env.VITE_BRICK_ORIGIN ?? '').trim() || BRICK_DEFAULT_ORIGIN).replace(/\/+$/, '')

/** 한 사람이 치는 시간 — 2분 (강의자 지시) */
export const BRICK_PLAY_MS = 120_000
/** 첫 사람이 시작한 뒤 이 안에 시작하지 않으면 발표자가 먼저 된다 — game-core 의 brick 계산과 같은 값 (강의자 지시 2026-10-13) */
export const BRICK_LATE_MS = 120_000
/** 시작한 사람이 이 안에 결과를 내지 않으면 중단으로 본다 */
export const BRICK_SETTLE_MS = 150_000

export const BRICK_CHANNEL = 'brickpick'
export const BRICK_PROTOCOL = '1.0'

export function brickEmbedUrl(): string {
  const url = new URL('/embed/', BRICK_ORIGIN + '/')
  url.searchParams.set('parentOrigin', window.location.origin)
  return url.toString()
}

/** 게임에 보내는 입력 — 한 사람 · 직접 조작 · 2분 · 같은 시드. 선정 규칙은 게임 안 표시용일 뿐 발표자는 우리 계산이 정한다 */
export function brickInput(a: { sessionId: string; uid: string; nickname: string; seed: string }) {
  return {
    schemaVersion: '1.0',
    sessionId: a.sessionId,
    participants: [{ id: a.uid, nickname: a.nickname.slice(0, 12) || '학생' }],
    mode: 'manual',
    difficulty: 'normal',
    roundDurationMs: BRICK_PLAY_MS,
    roundMode: 'fixed',
    selectionRule: { kind: 'bottom', count: 1 },
    excludedParticipantIds: [],
    seed: a.seed.slice(0, 32),
    locale: 'ko',
    soundEnabled: true,
    hideParticipantEditor: true,
  }
}

export interface BrickMessage {
  channel: string
  protocolVersion: string
  type: string
  messageId: string
  sessionId: string | null
  payload: Record<string, unknown>
}

export function isBrickMessage(data: unknown): data is BrickMessage {
  if (typeof data !== 'object' || data === null) return false
  const m = data as Record<string, unknown>
  return m.channel === BRICK_CHANNEL && typeof m.type === 'string' && typeof m.messageId === 'string' && typeof m.payload === 'object' && m.payload !== null
}

let counter = 0
export function brickMessage(type: string, sessionId: string | null, payload: Record<string, unknown>): BrickMessage {
  counter += 1
  return { channel: BRICK_CHANNEL, protocolVersion: BRICK_PROTOCOL, type, messageId: `h${counter.toString(36)}_${Date.now().toString(36)}`, sessionId, payload }
}

/** COMPLETE 의 결과에서 이 사람의 기록을 꺼낸다. 플레이하지 않았으면(건너뜀) null */
export function brickOutcome(result: unknown, uid: string): { bricks: number; score: number; playedMs: number; resultId: string } | null {
  const r = result as { resultId?: unknown; participants?: Array<Record<string, unknown>> } | null
  const p = r?.participants?.find((x) => x.id === uid)
  if (!p || typeof r?.resultId !== 'string') return null
  if (p.playStatus !== 'played' && p.playStatus !== 'aborted') return null
  const bricks = Number(p.bricksDestroyed)
  if (!Number.isFinite(bricks)) return null
  return { bricks, score: Number(p.score ?? 0) || 0, playedMs: Number(p.playedMs ?? 0) || 0, resultId: r.resultId }
}

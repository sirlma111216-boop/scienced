/**
 * 교실 구슬 레이스 — 따로 배포된 활동 앱을 iframe 으로 붙인다 (강의자 지시 2026-09-21).
 *
 * 루미 런과 다른 점: **서버가 없다.** 활동 앱의 `mode: 'local'` 로 강사 화면(프로젝터) 하나에서 돈다.
 *   · 티켓·공유 비밀·webhook 이 없다. 학생 기기는 참가하지 않는다 — 학생 화면은 결과만 본다.
 *   · 명단(우리 학생 uid + 닉네임)을 활동 앱에 넣으면 당첨자의 participantId 가 그 uid 그대로 돌아온다.
 *   · 결과는 강사 브라우저가 계산한 값이고 확인해 줄 서버가 없다(`serverVerified: false`). 결과 화면에 그렇게 적는다.
 *
 * 맵 id 와 규칙 꼴은 **배포된 활동 앱에 있는 것**이다 (2026-09-21 번들 확인). 활동 앱은 고칠 수 없으므로 여기를 맞춘다.
 */

export const MARBLE_ORIGIN = 'https://classroom-marble-race.sirlma.workers.dev'
export const MARBLE_SDK_URL = `${MARBLE_ORIGIN}/sdk/marble-race-sdk.js`
/** 활동 앱이 한 번에 받는 명단 상한 */
export const MARBLE_MAX_PARTICIPANTS = 100
/** 활동 앱의 닉네임 길이 상한 */
export const MARBLE_NAME_MAX = 12
/** 시작을 누르고 구슬이 떨어지기까지 세는 초 */
export const MARBLE_COUNTDOWN = 3

/** 활동 앱이 가진 맵 — 이름은 활동 앱이 화면에 쓰는 그대로다 */
export const MARBLE_MAPS: Record<string, string> = {
  'classic-wheel': '회전 관문',
  'classic-bubble': '버블 계곡',
  'classic-jar': '항아리 탈출',
  'classic-night': '네온 장거리',
  'mix-wind': '바람 협곡',
  'mix-portal': '포털 연구소',
  'mix-magnet': '자석 공장',
  'mix-festival': '종합 운동장',
}

export type MarbleRule = { kind: 'topK'; k: number } | { kind: 'bottomK'; k: number } | { kind: 'first' } | { kind: 'last' }

/**
 * 차시가 고르는 발표자 규칙. 활동 앱의 규칙 꼴로 옮긴다 —
 * 붙이는 안내서의 `firstN` · `lastN` 은 배포된 활동 앱에 없다. topK · bottomK 가 그 자리다.
 */
export const MARBLE_PICKS: Record<string, { label: string; rule: MarbleRule }> = {
  first1: { label: '가장 먼저 도착한 1명', rule: { kind: 'topK', k: 1 } },
  first2: { label: '가장 먼저 도착한 2명', rule: { kind: 'topK', k: 2 } },
  first3: { label: '가장 먼저 도착한 3명', rule: { kind: 'topK', k: 3 } },
  last1: { label: '가장 늦게 도착한 1명', rule: { kind: 'bottomK', k: 1 } },
  last2: { label: '가장 늦게 도착한 2명', rule: { kind: 'bottomK', k: 2 } },
  last3: { label: '가장 늦게 도착한 3명', rule: { kind: 'bottomK', k: 3 } },
}

export const MARBLE_DEFAULT_MAP = 'classic-wheel'
export const MARBLE_DEFAULT_PICK = 'first1'

/** 차시의 gameOptions 를 읽는다. 모르는 값이면 기본값으로 돌리고 무엇이 틀렸는지 함께 준다 */
export function marbleSetup(options?: Record<string, unknown> | null): { mapId: string; mapName: string; pickKey: string; pick: { label: string; rule: MarbleRule }; unknown: string[] } {
  const unknown: string[] = []
  const rawMap = String(options?.map ?? MARBLE_DEFAULT_MAP)
  const rawPick = String(options?.pick ?? MARBLE_DEFAULT_PICK)
  const mapId = MARBLE_MAPS[rawMap] ? rawMap : MARBLE_DEFAULT_MAP
  const pickKey = MARBLE_PICKS[rawPick] ? rawPick : MARBLE_DEFAULT_PICK
  if (mapId !== rawMap) unknown.push(`맵 ${rawMap}`)
  if (pickKey !== rawPick) unknown.push(`발표자 규칙 ${rawPick}`)
  return { mapId, mapName: MARBLE_MAPS[mapId], pickKey, pick: MARBLE_PICKS[pickKey], unknown }
}

/* ─────────────────────────── 활동 앱 SDK ─────────────────────────── */

export interface MarbleParticipant {
  id: string
  nickname: string
}

export interface MarbleWinner {
  participantId: string
  nickname?: string
  selectionReason?: string
}

export interface MarbleResult {
  eventId?: string
  roundId?: string
  mapId?: string
  cancelled?: boolean
  winners?: MarbleWinner[]
  finishOrder?: Array<{ participantId?: string; rank?: number }>
}

export interface MarbleRoundFinished {
  result: MarbleResult
  serverVerified?: boolean
}

export interface MarbleHandle {
  mount(element: HTMLElement): void
  destroy(): void
  setParticipants(participants: MarbleParticipant[]): Promise<void>
  setConfig(config: { mapId: string; rule: MarbleRule }): Promise<void>
  startRound(countdownSec?: number): Promise<unknown>
  resetRound(): Promise<void>
  on(type: 'ready', fn: (p: unknown) => void): () => void
  on(type: 'roundFinished', fn: (p: MarbleRoundFinished) => void): () => void
  on(type: 'error', fn: (p: { code?: string; message?: string }) => void): () => void
}

interface MarbleSdk {
  createMarbleRace(options: { activityOrigin: string; mode: 'local'; participants?: MarbleParticipant[]; title?: string; view?: string; hideJoinUi?: boolean }): MarbleHandle
}

let sdk: Promise<MarbleSdk> | null = null

/** 활동 앱의 SDK 를 한 번만 받아 둔다. 받지 못하면 그대로 던진다 — 화면이 이유를 적는다 */
export function loadMarbleSdk(): Promise<MarbleSdk> {
  if (!sdk) {
    sdk = import(/* @vite-ignore */ MARBLE_SDK_URL).then((m) => {
      const mod = m as Partial<MarbleSdk>
      if (typeof mod.createMarbleRace !== 'function') throw new Error('활동 앱의 SDK 가 예상과 다릅니다 (createMarbleRace 없음).')
      return mod as MarbleSdk
    })
    sdk.catch(() => {
      sdk = null
    })
  }
  return sdk
}

/** 우리 학생 명단을 활동 앱의 명단으로. id 는 uid 그대로 — 당첨자를 학생과 맞추는 열쇠다 */
export function marbleParticipants(uids: string[], nameOf: (uid: string) => string): MarbleParticipant[] {
  return uids.slice(0, MARBLE_MAX_PARTICIPANTS).map((uid) => ({ id: uid, nickname: (nameOf(uid) || '이름 없음').slice(0, MARBLE_NAME_MAX) }))
}

/** 활동 앱이 준 결과에서 우리 학생 uid 만 추린다. 모르는 id 는 버리고 셈에서 뺀다 */
export function marbleWinnerUids(result: MarbleResult | null | undefined, known: string[]): string[] {
  const set = new Set(known)
  const out: string[] = []
  for (const w of result?.winners ?? []) {
    const id = String(w?.participantId ?? '')
    if (set.has(id) && !out.includes(id)) out.push(id)
  }
  return out
}

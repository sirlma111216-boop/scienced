import type { GameKind } from '@/content/types'
import { BINGO_FILLERS, BINGO_LABEL_MAX, RELAY_WORDS } from '@/content/games'
import { fnv1a, mulberry32 } from './ladder'
import type { GameInput, GameState } from './types'

/**
 * 게임 상태 계산 (8차 6.4) — React 도 Firestore 도 Math.random() 도 없다.
 *
 * 게임 상태는 (시드 · 참가 · 입력 · 서버 시각)의 함수다. 강사 화면과 모든 학생 화면이 같은 것을 계산한다.
 * 결과는 강사 화면이 확정해 세션에 적는다(recordPick · 발표 횟수). 그 전까지는 모두가 같은 계산을 본다.
 *
 * 입력은 GameInput.value 에 게임별 모양으로 든다. 이 파일의 파서가 그 모양을 안다.
 */

export interface GroupLike {
  id: string
  name: string
  memberUids: string[]
}

export interface GameContext {
  state: GameState
  inputs: GameInput[]
  /** 서버 시각(ms) */
  now: number
  /** 모둠 게임 — 이 차시의 모둠 */
  groups: GroupLike[]
  /** 추정 게임 — 오늘 모둠 질문의 답 분포 */
  tally?: Array<{ option: string; count: number }>
  /** 빙고 — 판에 쓸 항목 9개 */
  bingoItems?: string[]
  options?: Record<string, unknown>
}

export interface Derived {
  /** 게임이 끝났는가 — 강사 화면이 결과를 확정한다 */
  finished: boolean
  /** 발표자 — 개인 게임은 끝났을 때 정확히 둘(오늘 온 사람이 둘보다 적으면 전원) */
  winnerUids: string[]
  /** 왜 이 사람인가 */
  reason: string
  /** 화면이 그릴 게임별 값 */
  view: Record<string, unknown>
  /** 모둠 게임이면 이긴 모둠 */
  winnerGroupId?: string | null
  /** 모둠 게임 — 발표에 가까운 모둠부터. 발표자 둘은 presentersOf 가 여기서 고른다 */
  groupRanking?: string[]
}

export const rng = (seed: string, salt: string) => mulberry32(fnv1a(`${seed}::${salt}`))
export const pickInt = (seed: string, salt: string, max: number) => Math.floor(rng(seed, salt)() * max)

export function shuffleSeeded<T>(seed: string, salt: string, items: T[]): T[] {
  const r = rng(seed, salt)
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 참가자 — 이 라운드에 참가한 사람, 참가 순 */
/**
 * 이 판의 참가자 — **오늘 온 사람 전부**다 (강의자 지시 2026-09-29).
 *
 * 전에는 학생이 [참가]를 눌러야 참가자가 됐다. 한두 명이 끝까지 누르지 않아 강사가 그것을 말하느라 수업이 멈췄다.
 * 이제 강사가 「게임 시작」을 누를 때 그날 출석 명단을 게임 상태(`state.roster`)에 적고, 모든 화면이 그것을 참가자로 읽는다.
 * 명단에 있고 아직 아무것도 내지 않은 사람은 **빈 입력**으로 들어간다 — 안 누른 사람도 후보이고, 게임마다 그것을 어떻게 다룰지 정한다.
 *
 * roster 가 없는 옛 판(8차 초기)은 예전처럼 입력이 있는 사람만 참가자다.
 */
export function participants(ctx: GameContext): GameInput[] {
  const mine = ctx.inputs.filter((i) => i.round === ctx.state.round)
  const roster = rosterOf(ctx)
  if (!roster) return mine.sort((a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid))
  const byUid = new Map(mine.map((i) => [i.uid, i]))
  return roster.map((uid, i) => byUid.get(uid) ?? { uid, stepId: ctx.state.stepId, round: ctx.state.round, joinedAt: (ctx.state.startedAt ?? 0) + i, value: {}, updatedAt: 0 })
}

/** 게임 상태에 적힌 출석 명단. 옛 판에는 없다 */
function rosterOf(ctx: GameContext): string[] | null {
  const r = (ctx.state.state as { roster?: unknown } | null)?.roster
  return Array.isArray(r) && r.every((x) => typeof x === 'string') && r.length > 0 ? (r as string[]) : null
}

const val = (i: GameInput | undefined): Record<string, unknown> => (i && i.value && typeof i.value === 'object' ? (i.value as Record<string, unknown>) : {})
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function started(ctx: GameContext): number | null {
  return ctx.state.phase === 'lobby' ? null : ctx.state.startedAt
}

/* ─────────────────────────── 발표자 둘 ─────────────────────────── */

/**
 * 한 게임이 내는 발표자 수 (강의자 지시 2026-10-02).
 *
 * 사다리 · 봉투 · 루미 런 · 구슬 레이스는 처음부터 둘을 뽑았는데, 새 게임 열둘은 하나(또는 동점 전원, 또는 아무도)를 냈다.
 * 「안 누른 사람」이 일곱이면 일곱이 다 발표자가 되고, 지뢰를 아무도 안 밟으면 발표자가 없었다.
 * 이제 어느 게임이든 **정확히 둘**이다 (오늘 온 사람이 둘보다 적으면 전원).
 */
export const PRESENTER_COUNT = 2

/** 이 판에 무엇이든 낸 사람인가 */
const played = (p: GameInput) => Object.keys(val(p)).length > 0

/** 점수가 작은 사람부터. 같은 점수는 시드가 정한 순서 — 화면마다 같다 */
function rankBy<T extends { uid: string }>(ctx: GameContext, salt: string, items: T[], score: (x: T) => number): string[] {
  const order = shuffleSeeded(ctx.state.seed, `tie-${salt}`, items.map((x) => x.uid).sort())
  const at = new Map(order.map((u, i) => [u, i]))
  return [...items].sort((a, b) => score(a) - score(b) || at.get(a.uid)! - at.get(b.uid)!).map((x) => x.uid)
}

/**
 * 발표자 둘을 고른다. `ranking` 은 게임이 정한 「발표자에 가까운 순서」다 — 앞에서부터 둘.
 * 게임 결과만으로 둘이 안 되면 ① 아무것도 내지 않은 사람 ② 나머지 순서로 시드 추첨해 채운다.
 * 안 내는 것이 안전하면 게임이 성립하지 않는다 — 모자란 자리는 안 낸 사람이 먼저 채운다.
 */
function pickTwo(ctx: GameContext, ranking: string[]): { winners: string[]; filled: number } {
  const ps = participants(ctx)
  const here = new Set(ps.map((p) => p.uid))
  const want = Math.min(PRESENTER_COUNT, ps.length)
  const out = [...new Set(ranking)].filter((u) => here.has(u)).slice(0, want)
  const fromGame = out.length
  if (out.length < want) {
    const rest = ps.filter((p) => !out.includes(p.uid))
    const idle = shuffleSeeded(ctx.state.seed, 'fill-idle', rest.filter((p) => !played(p)).map((p) => p.uid).sort())
    const others = shuffleSeeded(ctx.state.seed, 'fill-rest', rest.filter(played).map((p) => p.uid).sort())
    for (const u of [...idle, ...others]) {
      if (out.length >= want) break
      out.push(u)
    }
  }
  return { winners: out, filled: out.length - fromGame }
}

const fillNote = (filled: number) => (filled > 0 ? ` · 모자란 ${filled}명은 아무것도 내지 않은 사람부터 추첨` : '')

/* ─────────────────────────── 개인 ─────────────────────────── */

/** 폭탄 돌리기 — 폭탄 둘. 숨긴 시간 15~40초. 폭탄을 든 사람이 넘기면 폭탄이 없는 다른 사람에게 */
function bomb(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const uids = ps.map((p) => p.uid)
  const t0 = started(ctx)
  const seed = ctx.state.seed
  const duration = 15000 + Math.floor(rng(seed, 'bomb-duration')() * 25000)
  if (!t0 || uids.length === 0) return { finished: false, winnerUids: [], reason: '', view: { holders: [], holder: null, passes: 0 } }
  const end = t0 + duration
  /* 넘김 사건 — 누가 언제 눌렀나. 시각순으로 훑되, 그때 폭탄을 든 사람이 누른 것만 인정한다 */
  const events: Array<{ uid: string; t: number }> = []
  for (const p of ps) {
    const arr = val(p).passes
    if (Array.isArray(arr)) for (const t of arr) if (typeof t === 'number') events.push({ uid: p.uid, t })
  }
  events.sort((a, b) => a.t - b.t)
  let holders = shuffleSeeded(seed, 'bomb-start', uids).slice(0, Math.min(PRESENTER_COUNT, uids.length))
  let passes = 0
  for (const e of events) {
    if (e.t > end || e.t > ctx.now) break
    const at = holders.indexOf(e.uid)
    if (at < 0) continue
    /* 폭탄 둘이 한 사람에게 몰리지 않는다 — 폭탄이 없는 사람에게만 간다 */
    const others = uids.filter((u) => !holders.includes(u))
    if (others.length === 0) continue
    const next = others[pickInt(seed, `bomb-pass-${passes}`, others.length)]
    holders = holders.map((h, i) => (i === at ? next : h))
    passes += 1
  }
  const finished = ctx.now >= end
  return {
    finished,
    winnerUids: finished ? holders : [],
    reason: finished ? `시간이 끝났을 때 폭탄을 들고 있던 두 사람 (${passes}번 넘어감)` : '',
    view: { holders, holder: holders[0] ?? null, passes, exploded: finished },
  }
}

/** 숫자 가까이 — 1~100 중 하나. 서버 숫자에 가까운 순서로 둘 */
function closest(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  const target = 1 + pickInt(ctx.state.seed, 'closest', 100)
  const picks = ps.map((p) => ({ uid: p.uid, n: num(val(p).n) })).filter((x): x is { uid: string; n: number } => x.n !== null)
  const allIn = ps.length > 0 && picks.length === ps.length
  const timeUp = Boolean(t0 && ctx.now >= t0 + 30000)
  const finished = Boolean(t0) && (allIn || timeUp)
  const { winners, filled } = finished ? pickTwo(ctx, rankBy(ctx, 'closest', picks, (p) => Math.abs(p.n - target))) : { winners: [], filled: 0 }
  return { finished, winnerUids: winners, reason: finished ? `서버 숫자 ${target} — 가까운 순서로 둘${fillNote(filled)}` : '', view: { target: finished ? target : null, picked: picks.length, total: ps.length } }
}

/**
 * 문 세 개 — 열린 문을 고른 사람은 통과. 마지막까지 남은 두 사람.
 *
 * 한 문에 20초. 그 안에 고르지 않은 사람이 있으면 **거기서 끝난다** — 못 고른 사람이 먼저 발표자가 된다.
 * 전에는 안 고른 사람이 끝까지 남은 채 여덟 번을 다 기다려 160초가 걸렸다 (2026-10-02 전수조사).
 */
function doors(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  const seed = ctx.state.seed
  let alive = ps.map((p) => p.uid)
  const history: Array<{ round: number; opened: number; passed: string[] }> = []
  if (!t0 || alive.length === 0) return { finished: false, winnerUids: [], reason: '', view: { round: 0, alive, history } }
  let round = 0
  let roundStart = t0
  let stalled: string[] | null = null
  while (alive.length > PRESENTER_COUNT && round < 8) {
    const choices = alive.map((u) => {
      const c = val(ps.find((p) => p.uid === u))
      const d = num((c.doors as Record<string, unknown> | undefined)?.[String(round)])
      return { uid: u, door: d }
    })
    const allChose = choices.every((c) => c.door !== null)
    const timeUp = ctx.now >= roundStart + 20000
    if (!allChose && !timeUp) break
    /* 서버가 여는 문 — 남는 사람이 둘보다 적어지는 문은 되도록 열지 않는다 */
    const wouldPass = (d: number) => choices.filter((c) => c.door === d).map((c) => c.uid)
    let opened = 1 + pickInt(seed, `door-${round}`, 3)
    if (alive.length - wouldPass(opened).length < PRESENTER_COUNT) {
      const alt = [1, 2, 3].filter((d) => alive.length - wouldPass(d).length >= PRESENTER_COUNT).sort((a, b) => wouldPass(b).length - wouldPass(a).length)[0]
      if (alt !== undefined) opened = alt
    }
    const passed = wouldPass(opened)
    history.push({ round, opened, passed })
    alive = alive.filter((u) => !passed.includes(u))
    round += 1
    roundStart += 20000
    if (!allChose) {
      stalled = choices.filter((c) => c.door === null).map((c) => c.uid)
      break
    }
  }
  const finished = alive.length <= PRESENTER_COUNT || round >= 8 || stalled !== null
  if (!finished) return { finished, winnerUids: [], reason: '', view: { round, alive, history } }
  /* 발표자에 가까운 순서 — 문을 못 고른 사람 · 남은 사람 · 늦게 통과한 사람 */
  const order = (salt: string, uids: string[]) => shuffleSeeded(seed, `door-${salt}`, [...uids].sort())
  const ranking = [
    ...order('stalled', stalled ?? []),
    ...order('alive', alive),
    ...[...history].reverse().flatMap((h) => order(`out-${h.round}`, h.passed)),
  ]
  const { winners } = pickTwo(ctx, ranking)
  const reason = stalled ? '시간 안에 문을 고르지 않은 사람이 있어 거기서 끝났다 — 못 고른 사람부터 둘' : `${round}번의 문 뒤에 마지막까지 남은 두 사람`
  return { finished, winnerUids: winners, reason, view: { round, alive, history } }
}

/** 지뢰 한 칸 — 5×5 에 지뢰 셋. 밟은 사람 가운데 둘. 모자라면 안 고른 사람, 그다음은 지뢰에 가까운 칸을 고른 사람 */
function mine(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  const mines = shuffleSeeded(ctx.state.seed, 'mines', Array.from({ length: 25 }, (_, i) => i)).slice(0, 3)
  const picks = ps.map((p) => ({ uid: p.uid, cell: num(val(p).cell) })).filter((x): x is { uid: string; cell: number } => x.cell !== null)
  const allIn = ps.length > 0 && picks.length === ps.length
  const timeUp = Boolean(t0 && ctx.now >= t0 + 30000)
  const finished = Boolean(t0) && (allIn || timeUp)
  if (!finished) return { finished, winnerUids: [], reason: '', view: { mines: [], picked: picks.length, total: ps.length, cells: [] } }
  /* 지뢰까지의 거리 — 가로세로 칸 수. 0 이면 밟은 것 */
  const far = (cell: number) => Math.min(...mines.map((m) => Math.abs(Math.floor(m / 5) - Math.floor(cell / 5)) + Math.abs((m % 5) - (cell % 5))))
  const hit = picks.filter((p) => far(p.cell) === 0)
  const idle = shuffleSeeded(ctx.state.seed, 'mine-idle', ps.filter((p) => !played(p)).map((p) => p.uid).sort())
  const near = rankBy(ctx, 'mine-near', picks.filter((p) => far(p.cell) > 0), (p) => far(p.cell))
  const { winners } = pickTwo(ctx, [...rankBy(ctx, 'mine-hit', hit, () => 0), ...idle, ...near])
  const reason = hit.length >= PRESENTER_COUNT ? `지뢰를 밟은 사람 ${hit.length}명${hit.length > PRESENTER_COUNT ? ' 가운데 둘' : ''}` : `지뢰를 밟은 사람 ${hit.length}명 — 모자란 자리는 안 고른 사람, 그다음은 지뢰에 가까운 칸을 고른 사람`
  return { finished, winnerUids: winners, reason, view: { mines, picked: picks.length, total: ps.length, cells: picks } }
}

/**
 * 0 에 가깝게 — 10초 카운트다운 (강의자 지시 2026-09-28).
 *
 * 0 에 가깝게, 넘기지 말고 누르는 게임이다. **못한 두 사람이 발표자다.**
 *   ① 끝까지 누르지 않은 사람 — 가장 나쁘다. 안 누르는 것이 안전하면 아무도 누르지 않는다.
 *   ② 0 을 넘겨 누른 사람 — 늦게 누를수록 나쁘다.
 *   ③ 0 전에 누른 사람 — 0 에서 멀수록(먼저 누를수록) 나쁘다.
 * 같은 값이면 시드가 순서를 정한다 — 안 누른 사람이 일곱이어도 발표자는 둘이다.
 * 끝나는 때는 모두 눌렀으면 0 + 1.5초, 아니면 넘겨 누를 틈을 주고 0 + 5초.
 */
const LATE_OVERTIME_MS = 5000

function late(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  if (!t0) return { finished: false, winnerUids: [], reason: '', view: { deadline: null } }
  const deadline = t0 + 10000
  const presses = ps.map((p) => ({ uid: p.uid, t: num(val(p).t) }))
  const pressed = presses.filter((x): x is { uid: string; t: number } => x.t !== null)
  const over = pressed.filter((p) => p.t > deadline)
  const none = presses.length - pressed.length
  const allPressed = ps.length > 0 && none === 0
  const finished = ctx.now >= deadline + 1500 && (allPressed || ctx.now >= deadline + LATE_OVERTIME_MS)
  /* 클수록 발표자에 가깝다 — 안 누름 > 넘겨 누름(늦을수록) > 0 전(먼저 누를수록) */
  const badness = (t: number | null) => (t === null ? 2_000_000 : t > deadline ? 1_000_000 + (t - deadline) : deadline - t)
  const winners = finished ? pickTwo(ctx, rankBy(ctx, 'late', presses, (p) => -badness(p.t))).winners : []
  return { finished, winnerUids: winners, reason: finished ? (winners.length ? '0 에서 먼 순서로 둘 (안 누름 · 0 넘김 · 0 전) — 반응 속도 게임입니다' : '참가자가 없다 — 재추첨') : '', view: { deadline, pressed: pressed.length, over: over.length, none } }
}

/** 가위바위보 토너먼트 — 결승에 오른 두 사람(또는 가장 먼저 진 두 사람) */
type Hand = 'rock' | 'paper' | 'scissors'
const beats = (a: Hand, b: Hand) => (a === 'rock' && b === 'scissors') || (a === 'scissors' && b === 'paper') || (a === 'paper' && b === 'rock')
/** 비기면 다시 낸다. 이만큼 비기면 시드가 정한다 — 전에는 다섯 번 비기면 그 판이 영영 끝나지 않았다 */
const RPS_MAX_DRAWS = 4

function rps(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  const seed = ctx.state.seed
  const pick = String(ctx.options?.pick ?? 'winner')
  if (!t0 || ps.length === 0) return { finished: false, winnerUids: [], reason: '', view: { round: 0, matches: [], alive: [] } }
  const handOf = (uid: string, key: string): Hand | null => {
    const h = (val(ps.find((p) => p.uid === uid)).hands as Record<string, unknown> | undefined)?.[key]
    return h === 'rock' || h === 'paper' || h === 'scissors' ? h : null
  }
  let alive = shuffleSeeded(seed, 'rps-order', ps.map((p) => p.uid))
  let round = 0
  /** 진 순서 */
  const out: string[] = []
  const matches: Array<{ round: number; a: string; b: string | null; winner: string | null; key: string }> = []
  let roundStart = t0
  let pending = false
  while (alive.length > PRESENTER_COUNT && round < 6) {
    const next: string[] = []
    for (let i = 0; i < alive.length; i += 2) {
      const a = alive[i]
      const b = alive[i + 1] ?? null
      if (!b) {
        matches.push({ round, a, b: null, winner: a, key: `${round}` })
        next.push(a)
        continue
      }
      /* 비기면 다시 — 시도 번호를 올린다 */
      let attempt = 0
      let winner: string | null = null
      let key = `${round}.${attempt}`
      for (;;) {
        key = `${round}.${attempt}`
        const ha = handOf(a, key)
        const hb = handOf(b, key)
        const coin = () => [a, b][pickInt(seed, `rps-${key}`, 2)]
        if (ha && hb) {
          if (ha !== hb) winner = beats(ha, hb) ? a : b
          else if (attempt >= RPS_MAX_DRAWS) winner = coin()
          else {
            attempt += 1
            continue
          }
        } else if (ctx.now >= roundStart + 20000 * (attempt + 1)) {
          /* 시간 안에 안 낸 사람이 진다. 둘 다 안 냈으면 시드 */
          winner = ha && !hb ? a : hb && !ha ? b : coin()
        }
        break
      }
      matches.push({ round, a, b, winner, key })
      if (!winner) pending = true
      else {
        next.push(winner)
        out.push(winner === a ? b : a)
      }
    }
    if (pending) break
    alive = next
    round += 1
    roundStart += 20000 * 2
    if (pick === 'firstOut' && out.length >= PRESENTER_COUNT) break
  }
  const finished = !pending && (alive.length <= PRESENTER_COUNT || (pick === 'firstOut' && out.length >= PRESENTER_COUNT) || round >= 6)
  const winners = finished ? pickTwo(ctx, pick === 'firstOut' ? out : alive).winners : []
  return { finished, winnerUids: winners, reason: finished ? (pick === 'firstOut' ? '가장 먼저 진 두 사람' : `${round}라운드 뒤 결승에 오른 두 사람`) : '', view: { round, matches, alive } }
}

/* ─────────────────────────── 모둠 협동 ─────────────────────────── */

/** 동시에 눌러라 — 누른 시각의 편차가 가장 작은 모둠 */
function sync(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  if (!t0) return { finished: false, winnerUids: [], reason: '', view: { rows: [] } }
  const rows = ctx.groups.map((g) => {
    const ts = ps.filter((p) => g.memberUids.includes(p.uid)).map((p) => num(val(p).t)).filter((t): t is number => t !== null)
    const joined = ps.filter((p) => g.memberUids.includes(p.uid)).length
    const spread = ts.length >= 2 ? Math.max(...ts) - Math.min(...ts) : null
    return { id: g.id, name: g.name, pressed: ts.length, joined, spread }
  })
  const timeUp = ctx.now >= t0 + 30000
  const allPressed = ps.length > 0 && ps.every((p) => num(val(p).t) !== null)
  const finished = allPressed || timeUp
  const ranked = rows.filter((r) => r.spread !== null).sort((a, b) => a.spread! - b.spread!)
  const winnerGroupId = finished && ranked.length ? ranked[0].id : null
  return { finished, winnerUids: [], reason: finished ? (winnerGroupId ? `편차 ${ranked[0].spread}ms 로 가장 작은 모둠 — 반응 속도 게임입니다` : '두 명 이상 누른 모둠이 없다') : '', view: { rows }, winnerGroupId, groupRanking: finished ? ranked.map((r) => r.id) : [] }
}

/** 비밀 합 — 각자 1~5. 합이 목표에 가장 가까운 모둠 */
function sum(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  if (!t0) return { finished: false, winnerUids: [], reason: '', view: { rows: [] } }
  const rows = ctx.groups.map((g) => {
    const members = ps.filter((p) => g.memberUids.includes(p.uid))
    const ns = members.map((p) => num(val(p).n)).filter((n): n is number => n !== null)
    const size = Math.max(1, members.length)
    /* 목표 — 모둠 크기에 맞춰 시드로: size×1 … size×5 사이 */
    const target = size + pickInt(ctx.state.seed, `sum-${g.id}-${size}`, size * 4 + 1)
    const total = ns.reduce((a, b) => a + b, 0)
    return { id: g.id, name: g.name, target, total, picked: ns.length, joined: members.length, diff: ns.length === members.length && members.length > 0 ? Math.abs(total - target) : null }
  })
  const timeUp = ctx.now >= t0 + 30000
  const allIn = ps.length > 0 && ps.every((p) => num(val(p).n) !== null)
  const finished = allIn || timeUp
  const ranked = rows.filter((r) => r.picked > 0).map((r) => ({ ...r, diff: Math.abs(r.total - r.target) })).sort((a, b) => a.diff - b.diff)
  const winnerGroupId = finished && ranked.length ? ranked[0].id : null
  return { finished, winnerUids: [], reason: finished ? (winnerGroupId ? `목표와 차이 ${ranked[0].diff} — 가장 가까운 모둠` : '낸 모둠이 없다') : '', view: { rows: finished ? ranked : rows.map((r) => ({ ...r, target: null })) }, winnerGroupId, groupRanking: finished ? ranked.map((r) => r.id) : [] }
}

/** 릴레이 단어 — 모둠원이 순서대로 한 글자씩. 가장 먼저 완성한 모둠 */
function relay(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  const word = RELAY_WORDS[pickInt(ctx.state.seed, 'relay-word', RELAY_WORDS.length)]
  if (!t0) return { finished: false, winnerUids: [], reason: '', view: { word: null, rows: [] } }
  const rows = ctx.groups.map((g) => {
    const members = ps.filter((p) => g.memberUids.includes(p.uid))
    const order = members.map((m) => m.uid)
    let done = 0
    let doneAt: number | null = null
    for (let pos = 0; pos < word.length; pos++) {
      if (order.length === 0) break
      const who = order[pos % order.length]
      const c = (val(ps.find((p) => p.uid === who)).chars as Record<string, unknown> | undefined)?.[String(pos)]
      const t = num((val(ps.find((p) => p.uid === who)).times as Record<string, unknown> | undefined)?.[String(pos)])
      if (typeof c === 'string' && c === word[pos]) {
        done = pos + 1
        doneAt = t ?? doneAt
      } else break
    }
    return { id: g.id, name: g.name, done, doneAt: done === word.length ? doneAt : null, order, turn: order.length ? order[done % order.length] : null }
  })
  const completed = rows.filter((r) => r.doneAt !== null).sort((a, b) => a.doneAt! - b.doneAt!)
  const timeUp = ctx.now >= t0 + 60000
  const finished = completed.length > 0 || timeUp
  /* 먼저 완성한 모둠부터, 그다음은 많이 채운 모둠 */
  const rest = rows.filter((r) => r.doneAt === null && r.order.length > 0).sort((a, b) => b.done - a.done)
  const groupRanking = finished ? [...completed, ...rest].map((r) => r.id) : []
  const winnerGroupId = finished ? (groupRanking[0] ?? null) : null
  return { finished, winnerUids: [], reason: finished ? (completed.length ? '가장 먼저 낱말을 완성한 모둠' : '시간 안에 완성한 모둠이 없어 가장 많이 채운 모둠') : '', view: { word, rows }, winnerGroupId, groupRanking }
}

/* ─────────────────────────── 개인 (이어서) ─────────────────────────── */

/**
 * 빙고 판에 쓸 항목 아홉 — 활동의 카드·선택지 이름을 먼저 쓰고, 모자라면 채움 낱말로 메운다.
 *
 * 전에는 활동에 항목이 아홉이 안 되면(교수법 14강 · 교육론 4·7강 모두 다섯) 판이 만들어지지 않아
 * **게임이 영영 끝나지 않았다** (2026-10-02 전수조사). 칸에 안 들어가는 긴 문장은 뺀다.
 */
export function bingoItemsOf(activity: { fields: Array<{ items?: Array<{ label: string }>; options?: string[] }> }): string[] {
  const labels = activity.fields.flatMap((f) => [...(f.items?.map((i) => i.label) ?? []), ...(f.options ?? [])]).filter((s) => s.length <= BINGO_LABEL_MAX)
  return [...new Set([...labels, ...BINGO_FILLERS])].slice(0, 9)
}

/** 빙고 — 항목 9개로 3×3. 5초마다 하나씩 뽑힌다. 먼저 빙고를 외친 두 사람 */
function bingo(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  const items = (ctx.bingoItems ?? []).slice(0, 9)
  const draws = shuffleSeeded(ctx.state.seed, 'bingo-draw', items)
  if (!t0 || items.length < 9) return { finished: false, winnerUids: [], reason: '', view: { drawn: [], boards: {}, ready: items.length >= 9 } }
  const drawnCount = Math.min(items.length, Math.floor((ctx.now - t0) / 5000) + 1)
  const drawn = draws.slice(0, drawnCount)
  const boardOf = (uid: string) => shuffleSeeded(ctx.state.seed, `bingo-board-${uid}`, items)
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
  ]
  const hasLine = (board: string[], set: Set<string>) => lines.some((l) => l.every((i) => set.has(board[i])))
  const claims = ps
    .map((p) => ({ uid: p.uid, t: num(val(p).claim) }))
    .filter((c): c is { uid: string; t: number } => c.t !== null && c.t >= t0 && c.t <= ctx.now)
    .filter((c) => hasLine(boardOf(c.uid), new Set(draws.slice(0, Math.min(items.length, Math.floor((c.t - t0) / 5000) + 1)))))
  const want = Math.min(PRESENTER_COUNT, ps.length)
  /* 둘이 외치면 끝난다. 아무도 안 외쳐도 아홉 개가 다 뽑히고 5초 뒤에는 끝난다 */
  const finished = claims.length >= want || ctx.now >= t0 + items.length * 5000
  const boards: Record<string, string[]> = Object.fromEntries(ps.map((p) => [p.uid, boardOf(p.uid)]))
  if (!finished) return { finished, winnerUids: [], reason: '', view: { drawn, boards, ready: true } }
  const { winners, filled } = pickTwo(ctx, rankBy(ctx, 'bingo', claims, (c) => c.t))
  return { finished, winnerUids: winners, reason: `가장 먼저 빙고를 외친 사람${claims.length >= want ? ' 둘' : ` ${claims.length}명`}${fillNote(filled)}`, view: { drawn, boards, ready: true } }
}

/** 추정 — 오늘 모둠 질문의 답 하나를 고른 사람 수를 맞힌다. 가까운 순서로 둘 */
function estimate(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  /* 강사가 시작할 때 세션에 넣은 분포가 먼저다 — 학생은 groupInputs 전체를 읽지 못한다 */
  const tally = ((ctx.state.state as { tally?: Array<{ option: string; count: number }> } | null)?.tally ?? ctx.tally) ?? []
  const target = tally.length ? tally[pickInt(ctx.state.seed, 'estimate', tally.length)] : null
  const picks = ps.map((p) => ({ uid: p.uid, n: num(val(p).n) })).filter((x): x is { uid: string; n: number } => x.n !== null)
  const allIn = ps.length > 0 && picks.length === ps.length
  const timeUp = Boolean(t0 && ctx.now >= t0 + 30000)
  const finished = Boolean(t0) && Boolean(target) && (allIn || timeUp)
  const { winners, filled } = finished && target ? pickTwo(ctx, rankBy(ctx, 'estimate', picks, (p) => Math.abs(p.n - target.count))) : { winners: [], filled: 0 }
  return { finished, winnerUids: winners, reason: finished && target ? `「${target.option}」 ${target.count}명 — 가까운 순서로 둘${fillNote(filled)}` : '', view: { question: target?.option ?? null, answer: finished ? target?.count : null, picked: picks.length, total: ps.length, ready: Boolean(target) } }
}

/** 순간 포착 — 회색이다가 무작위 순간 초록. 가장 빠른(또는 늦은) 두 사람 */
function flash(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  const pick = String(ctx.options?.pick ?? 'fastest')
  if (!t0) return { finished: false, winnerUids: [], reason: '', view: { greenAt: null } }
  const greenAt = t0 + 3000 + Math.floor(rng(ctx.state.seed, 'flash')() * 7000)
  const presses = ps.map((p) => ({ uid: p.uid, t: num(val(p).t) })).filter((x): x is { uid: string; t: number } => x.t !== null)
  const valid = presses.filter((p) => p.t >= greenAt)
  const finished = ctx.now >= greenAt + 5000
  const { winners, filled } = finished ? pickTwo(ctx, rankBy(ctx, 'flash', valid, (p) => (pick === 'slowest' ? -p.t : p.t))) : { winners: [], filled: 0 }
  return { finished, winnerUids: winners, reason: finished ? `${pick === 'slowest' ? '가장 늦게' : '가장 빨리'} 누른 순서로 둘${fillNote(filled)} — 반응 속도 게임입니다` : '', view: { greenAt: ctx.now >= greenAt ? greenAt : null, early: presses.length - valid.length, pressed: presses.length } }
}

const DERIVE: Partial<Record<GameKind, (ctx: GameContext) => Derived>> = { bomb, closest, doors, mine, late, rps, sync, sum, relay, bingo, estimate, flash }

export function derive(ctx: GameContext): Derived {
  const fn = DERIVE[ctx.state.kind]
  if (!fn) return { finished: false, winnerUids: [], reason: '', view: {} }
  return fn(ctx)
}

/**
 * 끝난 게임의 발표자 둘.
 *
 * 개인 게임은 계산이 이미 둘을 냈다. 모둠 게임은 **이긴 모둠에서 발표 횟수가 적은 두 사람**이다
 * (같으면 시드). 그 모둠에 오늘 온 사람이 둘이 안 되면 다음 모둠으로 넘어간다.
 */
export function presentersOf(ctx: GameContext, d: Derived, presentCount: Record<string, number>): string[] {
  if (d.groupRanking === undefined) return d.winnerUids
  const ps = participants(ctx)
  const here = new Set(ps.map((p) => p.uid))
  const want = Math.min(PRESENTER_COUNT, ps.length)
  const out: string[] = []
  for (const gid of d.groupRanking) {
    const g = ctx.groups.find((x) => x.id === gid)
    if (!g) continue
    const members = shuffleSeeded(ctx.state.seed, `rep-${g.id}`, g.memberUids.filter((u) => here.has(u) && !out.includes(u)).sort())
    members.sort((a, b) => (presentCount[a] ?? 0) - (presentCount[b] ?? 0))
    for (const u of members) {
      if (out.length >= want) break
      out.push(u)
    }
    if (out.length >= want) break
  }
  return out.length >= want ? out : pickTwo(ctx, out).winners
}

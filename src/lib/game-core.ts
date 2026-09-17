import type { GameKind } from '@/content/types'
import { RELAY_WORDS } from '@/content/games'
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
  winnerUids: string[]
  /** 왜 이 사람인가 */
  reason: string
  /** 화면이 그릴 게임별 값 */
  view: Record<string, unknown>
  /** 모둠 게임이면 이긴 모둠 */
  winnerGroupId?: string | null
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
export function participants(ctx: GameContext): GameInput[] {
  return ctx.inputs.filter((i) => i.round === ctx.state.round).sort((a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid))
}

const val = (i: GameInput | undefined): Record<string, unknown> => (i && i.value && typeof i.value === 'object' ? (i.value as Record<string, unknown>) : {})
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function started(ctx: GameContext): number | null {
  return ctx.state.phase === 'lobby' ? null : ctx.state.startedAt
}

/* ─────────────────────────── 개인 ─────────────────────────── */

/** 폭탄 돌리기 — 숨긴 시간 15~40초. 폭탄을 든 사람이 넘기면 무작위 다른 사람에게 */
function bomb(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const uids = ps.map((p) => p.uid)
  const t0 = started(ctx)
  const seed = ctx.state.seed
  const duration = 15000 + Math.floor(rng(seed, 'bomb-duration')() * 25000)
  if (!t0 || uids.length === 0) return { finished: false, winnerUids: [], reason: '', view: { holder: null, passes: 0 } }
  const end = t0 + duration
  /* 넘김 사건 — 누가 언제 눌렀나. 시각순으로 훑되, 그때 폭탄을 든 사람이 누른 것만 인정한다 */
  const events: Array<{ uid: string; t: number }> = []
  for (const p of ps) {
    const arr = val(p).passes
    if (Array.isArray(arr)) for (const t of arr) if (typeof t === 'number') events.push({ uid: p.uid, t })
  }
  events.sort((a, b) => a.t - b.t)
  let holder = uids[pickInt(seed, 'bomb-start', uids.length)]
  let passes = 0
  for (const e of events) {
    if (e.t > end || e.t > ctx.now) break
    if (e.uid !== holder || uids.length < 2) continue
    const others = uids.filter((u) => u !== holder)
    holder = others[pickInt(seed, `bomb-pass-${passes}`, others.length)]
    passes += 1
  }
  const finished = ctx.now >= end
  return {
    finished,
    winnerUids: finished ? [holder] : [],
    reason: finished ? `시간이 끝났을 때 폭탄을 들고 있던 사람 (${passes}번 넘어감)` : '',
    view: { holder, passes, exploded: finished },
  }
}

/** 숫자 가까이 — 1~100 중 하나. 서버 숫자에 가장 가까운 사람 (동점 공동) */
function closest(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  const target = 1 + pickInt(ctx.state.seed, 'closest', 100)
  const picks = ps.map((p) => ({ uid: p.uid, n: num(val(p).n) })).filter((x): x is { uid: string; n: number } => x.n !== null)
  const allIn = ps.length > 0 && picks.length === ps.length
  const timeUp = Boolean(t0 && ctx.now >= t0 + 30000)
  const finished = Boolean(t0) && (allIn || timeUp)
  let winners: string[] = []
  let best = Infinity
  if (finished) {
    for (const p of picks) {
      const d = Math.abs(p.n - target)
      if (d < best) {
        best = d
        winners = [p.uid]
      } else if (d === best) winners.push(p.uid)
    }
  }
  return { finished, winnerUids: winners, reason: finished ? `서버 숫자 ${target} — 차이 ${best === Infinity ? '-' : best}` : '', view: { target: finished ? target : null, picked: picks.length, total: ps.length } }
}

/** 문 세 개 — 열린 문을 고른 사람은 통과. 마지막까지 남은 한 사람 */
function doors(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  let alive = ps.map((p) => p.uid)
  const history: Array<{ round: number; opened: number; passed: string[] }> = []
  if (!t0 || alive.length === 0) return { finished: false, winnerUids: [], reason: '', view: { round: 0, alive, history } }
  let round = 0
  let roundStart = t0
  while (alive.length > 1 && round < 8) {
    const choices = alive.map((u) => {
      const c = val(ps.find((p) => p.uid === u))
      const d = num((c.doors as Record<string, unknown> | undefined)?.[String(round)])
      return { uid: u, door: d }
    })
    const allChose = choices.every((c) => c.door !== null)
    const timeUp = ctx.now >= roundStart + 20000
    if (!allChose && !timeUp) break
    /* 서버가 여는 문 — 다 나가 버리는 문은 열지 않는다 */
    let opened = 1 + pickInt(ctx.state.seed, `door-${round}`, 3)
    const wouldPass = (d: number) => choices.filter((c) => c.door === d).map((c) => c.uid)
    if (wouldPass(opened).length === alive.length) {
      const alt = [1, 2, 3].find((d) => wouldPass(d).length < alive.length)
      if (alt !== undefined) opened = alt
    }
    const passed = wouldPass(opened)
    history.push({ round, opened, passed })
    alive = alive.filter((u) => !passed.includes(u))
    round += 1
    roundStart = roundStart + 20000
    if (!allChose && timeUp) continue
  }
  const finished = alive.length <= 1 || round >= 8
  const winner = alive.length === 1 ? alive : alive.length > 1 ? [alive[pickInt(ctx.state.seed, 'door-final', alive.length)]] : history.length ? history[history.length - 1].passed.slice(-1) : []
  return { finished, winnerUids: finished ? winner : [], reason: finished ? `${round}번의 문 뒤에 마지막까지 남은 사람` : '', view: { round, alive, history } }
}

/** 지뢰 한 칸 — 5×5 에 지뢰 셋. 밟은 사람 (없으면 재추첨) */
function mine(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  const mines = shuffleSeeded(ctx.state.seed, 'mines', Array.from({ length: 25 }, (_, i) => i)).slice(0, 3)
  const picks = ps.map((p) => ({ uid: p.uid, cell: num(val(p).cell) })).filter((x): x is { uid: string; cell: number } => x.cell !== null)
  const allIn = ps.length > 0 && picks.length === ps.length
  const timeUp = Boolean(t0 && ctx.now >= t0 + 30000)
  const finished = Boolean(t0) && (allIn || timeUp)
  const winners = finished ? picks.filter((p) => mines.includes(p.cell)).map((p) => p.uid) : []
  return { finished, winnerUids: winners, reason: finished ? (winners.length ? '지뢰를 밟은 사람' : '아무도 지뢰를 밟지 않았다 — 재추첨') : '', view: { mines: finished ? mines : [], picked: picks.length, total: ps.length, cells: finished ? picks : [] } }
}

/** 늦게 눌러라 — 10초. 0 이 지난 뒤 누르면 탈락. 유효한 마지막 사람 */
function late(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  if (!t0) return { finished: false, winnerUids: [], reason: '', view: { deadline: null } }
  const deadline = t0 + 10000
  const presses = ps.map((p) => ({ uid: p.uid, t: num(val(p).t) })).filter((x): x is { uid: string; t: number } => x.t !== null)
  const valid = presses.filter((p) => p.t <= deadline)
  const finished = ctx.now >= deadline + 1500
  let winners: string[] = []
  if (finished && valid.length) {
    const best = Math.max(...valid.map((v) => v.t))
    winners = valid.filter((v) => v.t === best).map((v) => v.uid)
  }
  return { finished, winnerUids: winners, reason: finished ? (winners.length ? '0 이 되기 전에 가장 늦게 누른 사람 — 반응 속도 게임입니다' : '유효하게 누른 사람이 없다 — 재추첨') : '', view: { deadline, pressed: presses.length, out: presses.length - valid.length } }
}

/** 가위바위보 토너먼트 */
type Hand = 'rock' | 'paper' | 'scissors'
const beats = (a: Hand, b: Hand) => (a === 'rock' && b === 'scissors') || (a === 'scissors' && b === 'paper') || (a === 'paper' && b === 'rock')

function rps(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  const pick = String(ctx.options?.pick ?? 'winner')
  if (!t0 || ps.length === 0) return { finished: false, winnerUids: [], reason: '', view: { round: 0, matches: [] } }
  const handOf = (uid: string, key: string): Hand | null => {
    const h = (val(ps.find((p) => p.uid === uid)).hands as Record<string, unknown> | undefined)?.[key]
    return h === 'rock' || h === 'paper' || h === 'scissors' ? h : null
  }
  let alive = shuffleSeeded(ctx.state.seed, 'rps-order', ps.map((p) => p.uid))
  let round = 0
  let firstOut: string | null = null
  const matches: Array<{ round: number; a: string; b: string | null; winner: string | null; key: string }> = []
  let roundStart = t0
  while (alive.length > 1 && round < 6) {
    const next: string[] = []
    let pending = false
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
      while (attempt < 5) {
        key = `${round}.${attempt}`
        const ha = handOf(a, key)
        const hb = handOf(b, key)
        const timeUp = ctx.now >= roundStart + 20000 * (attempt + 1)
        if (ha && hb) {
          if (ha === hb) {
            attempt += 1
            continue
          }
          winner = beats(ha, hb) ? a : b
          break
        }
        if (timeUp) {
          winner = ha && !hb ? a : hb && !ha ? b : [a, b][pickInt(ctx.state.seed, `rps-${key}`, 2)]
          break
        }
        break
      }
      matches.push({ round, a, b, winner, key })
      if (!winner) pending = true
      else {
        next.push(winner)
        if (!firstOut) firstOut = winner === a ? b : a
      }
    }
    if (pending) break
    alive = next
    round += 1
    roundStart += 20000 * 2
  }
  const finished = alive.length === 1 && !matches.some((m) => !m.winner)
  const winners = finished ? (pick === 'firstOut' && firstOut ? [firstOut] : alive) : []
  return { finished, winnerUids: winners, reason: finished ? (pick === 'firstOut' ? '첫 번째로 탈락한 사람' : `${round}라운드 토너먼트 우승`) : '', view: { round, matches, alive } }
}

/* ─────────────────────────── 모둠 협동 ─────────────────────────── */

function groupOfUid(groups: GroupLike[], uid: string): GroupLike | undefined {
  return groups.find((g) => g.memberUids.includes(uid))
}

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
  return { finished, winnerUids: [], reason: finished ? (winnerGroupId ? `편차 ${ranked[0].spread}ms 로 가장 작은 모둠 — 반응 속도 게임입니다` : '두 명 이상 누른 모둠이 없다 — 재추첨') : '', view: { rows }, winnerGroupId }
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
  return { finished, winnerUids: [], reason: finished ? (winnerGroupId ? `목표와 차이 ${ranked[0].diff} — 가장 가까운 모둠` : '낸 모둠이 없다 — 재추첨') : '', view: { rows: finished ? ranked : rows.map((r) => ({ ...r, target: null })) }, winnerGroupId }
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
  const winnerGroupId = finished ? (completed[0]?.id ?? [...rows].sort((a, b) => b.done - a.done)[0]?.id ?? null) : null
  return { finished, winnerUids: [], reason: finished ? (completed.length ? '가장 먼저 낱말을 완성한 모둠' : '시간 안에 완성한 모둠이 없어 가장 많이 채운 모둠') : '', view: { word, rows }, winnerGroupId }
}

/* ─────────────────────────── 개인 (이어서) ─────────────────────────── */

/** 빙고 — 항목 9개로 3×3. 5초마다 하나씩 뽑힌다. 첫 빙고 */
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
    .filter((c): c is { uid: string; t: number } => c.t !== null && c.t >= t0)
    .map((c) => {
      const n = Math.min(items.length, Math.floor((c.t - t0) / 5000) + 1)
      const valid = hasLine(boardOf(c.uid), new Set(draws.slice(0, n)))
      return { ...c, valid }
    })
    .filter((c) => c.valid)
    .sort((a, b) => a.t - b.t)
  const finished = claims.length > 0 || drawnCount >= items.length
  const winners = claims.length ? claims.filter((c) => c.t === claims[0].t).map((c) => c.uid) : []
  const boards: Record<string, string[]> = Object.fromEntries(ps.map((p) => [p.uid, boardOf(p.uid)]))
  return { finished, winnerUids: winners, reason: finished ? (winners.length ? '가장 먼저 빙고를 외친 사람' : '빙고가 없다 — 재추첨') : '', view: { drawn, boards, ready: true } }
}

/** 추정 — 오늘 모둠 질문의 답 하나를 고른 사람 수를 맞힌다 */
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
  let winners: string[] = []
  let best = Infinity
  if (finished && target) {
    for (const p of picks) {
      const d = Math.abs(p.n - target.count)
      if (d < best) {
        best = d
        winners = [p.uid]
      } else if (d === best) winners.push(p.uid)
    }
  }
  return { finished, winnerUids: winners, reason: finished && target ? `「${target.option}」 ${target.count}명 — 차이 ${best === Infinity ? '-' : best}` : '', view: { question: target?.option ?? null, answer: finished ? target?.count : null, picked: picks.length, total: ps.length, ready: Boolean(target) } }
}

/** 순간 포착 — 회색이다가 무작위 순간 초록. 가장 빠른(또는 늦은) 사람 */
function flash(ctx: GameContext): Derived {
  const ps = participants(ctx)
  const t0 = started(ctx)
  const pick = String(ctx.options?.pick ?? 'fastest')
  if (!t0) return { finished: false, winnerUids: [], reason: '', view: { greenAt: null } }
  const greenAt = t0 + 3000 + Math.floor(rng(ctx.state.seed, 'flash')() * 7000)
  const presses = ps.map((p) => ({ uid: p.uid, t: num(val(p).t) })).filter((x): x is { uid: string; t: number } => x.t !== null)
  const valid = presses.filter((p) => p.t >= greenAt)
  const finished = ctx.now >= greenAt + 5000
  let winners: string[] = []
  if (finished && valid.length) {
    const best = pick === 'slowest' ? Math.max(...valid.map((v) => v.t)) : Math.min(...valid.map((v) => v.t))
    winners = valid.filter((v) => v.t === best).map((v) => v.uid)
  }
  return { finished, winnerUids: winners, reason: finished ? (winners.length ? `${pick === 'slowest' ? '가장 늦게' : '가장 빨리'} 누른 사람 — 반응 속도 게임입니다` : '초록이 된 뒤 누른 사람이 없다 — 재추첨') : '', view: { greenAt: ctx.now >= greenAt ? greenAt : null, early: presses.length - valid.length, pressed: presses.length } }
}

const DERIVE: Partial<Record<GameKind, (ctx: GameContext) => Derived>> = { bomb, closest, doors, mine, late, rps, sync, sum, relay, bingo, estimate, flash }

export function derive(ctx: GameContext): Derived {
  const fn = DERIVE[ctx.state.kind]
  if (!fn) return { finished: false, winnerUids: [], reason: '', view: {} }
  return fn(ctx)
}

/** 모둠 게임 — 이긴 모둠의 대표: 발표 횟수가 가장 적은 사람 (같으면 시드) */
export function representativeOf(group: GroupLike, presentCount: Record<string, number>, seed: string): string | null {
  if (group.memberUids.length === 0) return null
  const sorted = [...group.memberUids].sort((a, b) => (presentCount[a] ?? 0) - (presentCount[b] ?? 0))
  const least = (presentCount[sorted[0]] ?? 0)
  const pool = sorted.filter((u) => (presentCount[u] ?? 0) === least)
  return pool[pickInt(seed, `rep-${group.id}`, pool.length)]
}

export function groupOf(groups: GroupLike[], uid: string): GroupLike | undefined {
  return groupOfUid(groups, uid)
}

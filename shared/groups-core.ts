/**
 * 모둠 배정 — 비용 함수와 개선 절차 (6차 지시서 작업 N).
 *
 * 서버 함수(/api/groups/assign)·강사 화면(로컬 모드)·모의 실행 검사(verify:groups)가
 * 전부 이 파일 하나를 쓴다. 세 곳이 다른 코드를 쓰면 검사가 아무것도 보장하지 않는다.
 * 그래서 여기에는 import 가 없다 — Workers·Node·브라우저 어디서든 그대로 돈다.
 *
 * ── 규칙은 하나다 (N.2) ──
 * 같은 모둠에 들어가는 모든 짝의 과거 동석 횟수 합을 가장 작게 만든다.
 *   · 아직 아무도 안 만났으면 전부 0 → 처음 만나는 사람끼리 묶인다
 *   · 모두와 한 번씩 만나고 나면 최소가 1 → 적게 만난 사람을 고른다
 *   · 횟수가 같으면 더 오래전에 만난 쪽 → lastRound 가 작은 짝을 고른다
 *   · 그래도 같으면 시드로 무작위
 *
 * ── ★ 이번 회차만 보면 안 된다 ──
 * 회차마다 따로 최적화하면 1~3회차는 쉽게 0이 되지만, 그 무작위 선택이
 * 5~6회차에서 만날 수 있는 사람을 다 써 버린다. 30명×6모둠에서 그렇게 돌리면
 * 6회 동안 평균 14~16회 중복이 났다 — 계산상 0이 가능한데도.
 * 그래서 남은 회차 전체를 한꺼번에 짜고(planSchedule), 이번 회차는 그 계획의 첫 장을 쓴다.
 * 강사가 회차마다 실행하는 것은 그대로다. 실행할 때마다 지금 명단·지금 기록으로 다시 짠다.
 *
 * ── 난수 ──
 * 시드 문자열에서 결정적으로 만든다. 같은 시드면 같은 결과다.
 * 시드는 서버가 만들고 결과와 함께 저장한다 — 사다리와 같다.
 */

export type PairKey = string

export interface PairRecord {
  count: number
  lastRound: number
}

/** 두 uid 를 정렬해 "|" 로 잇는다. 순서가 달라도 같은 짝이다. */
export function pairKey(a: string, b: string): PairKey {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export interface AssignInput {
  /** 참석자. 결석자는 이미 빠져 있다. */
  uids: string[]
  groupCount: number
  /** 지금까지의 동석 기록 */
  history: Record<PairKey, PairRecord>
  /** 이번 회차 번호 (1부터). 최근성 판정에 쓴다. */
  round: number
  /** 이번 회차를 포함해 앞으로 남은 회차 수. 계획은 이만큼 앞을 본다. 기본 1. */
  roundsAhead?: number
  seed: string
  /** 강사가 「반드시 같이」로 묶은 짝 */
  mustTogether?: Array<[string, string]>
  /** 강사가 「반드시 따로」로 가른 짝 */
  mustApart?: Array<[string, string]>
  /**
   * 게임이 만든 분류 (N.6). uid → 분류값.
   *   spread — 같은 분류는 되도록 다른 모둠으로 (이질 모둠 · 갈래마다 한 명씩)
   *   gather — 같은 분류끼리 되도록 한 모둠으로 (동질 모둠 · 1지망 존중)
   */
  categories?: Record<string, string>
  categoryMode?: 'spread' | 'gather' | 'none'
  /** gather 일 때 2지망. 1지망이 몰리면 이쪽으로 넘어간다. */
  secondChoice?: Record<string, string>
  /**
   * 지난 회차를 확정할 때 저장해 둔 남은 계획 (이번 회차부터). 명단이 그대로면 그 첫 장에서 출발한다.
   * 회차마다 새로 계획하면 매번 다른 계획의 첫 장을 쓰게 되어 회차들이 서로 맞물리지 않는다 —
   * 계획은 9회 중복인데 순차 실행은 13회가 났다. 그래서 계획을 이어 쓴다.
   */
  plannedRemaining?: string[][][]
  /** 지난 회차가 계획에서 벗어났으면 true — 남은 계획을 그대로 쓰지 않고 거기서 출발해 고친다 */
  planStale?: boolean
  /** 탐색 크기. 검사에서 줄여 돌린다. */
  restarts?: number
  steps?: number
}

export interface AssignResult {
  /** 모둠별 uid 목록. 앞쪽 r 개 모둠이 한 명 더 크다. */
  groups: string[][]
  /** 과거 동석 횟수의 합 — 이번 회차의 중복 횟수. 페널티는 빼고 센다. */
  repeats: number
  /** 개선 절차가 본 전체 비용 (제약 페널티 포함) */
  cost: number
  seed: string
  /** 계획이 본 앞으로의 회차 수와, 그 계획 전체에서 예상되는 중복 (이어 쓴 계획이면 null) */
  plannedRounds: number
  plannedRepeats: number | null
  /** 이번 회차 다음의 남은 계획. 확정할 때 저장해 다음 회차에 plannedRemaining 으로 넘긴다. */
  plannedNext: string[][][]
  /** 이번 결과가 계획의 그 장과 같은가. 다르면 다음 회차는 planStale 로 부른다. */
  followedPlan: boolean
}

/* ── 난수: 문자열 → 32비트 시드 → mulberry32 ── */

function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function makeRng(seed: string): () => number {
  let a = hash32(seed) || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(list: T[], rng: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 모둠 크기. n ÷ g → 기본 ⌊n/g⌋, 나머지 r 개 모둠은 한 명 더 (N.4 ②). */
export function groupSizes(n: number, g: number): number[] {
  const count = Math.max(1, Math.min(g, n))
  const base = Math.floor(n / count)
  const r = n % count
  return Array.from({ length: count }, (_, i) => base + (i < r ? 1 : 0))
}

function cut(order: string[], sizes: number[]): string[][] {
  const groups: string[][] = []
  let at = 0
  for (const s of sizes) {
    groups.push(order.slice(at, at + s))
    at += s
  }
  return groups
}

/* ═══════════════════════════════════════════════════════════
 * 1. 계획 — 남은 회차 전체를 한꺼번에 짠다
 *
 * 비용 = 모든 짝에 대해 max(0, 만난 횟수 − 1) 의 합. 기록에 있는 횟수도 센다.
 * 0 이면 남은 회차 동안 아무도 다시 만나지 않는다는 뜻이다.
 * 이동 = 한 회차 안에서 두 사람을 맞바꾸기. 지금 다시 만나고 있는 사람을 골라
 * 그 회차의 다른 모둠 사람 전부와 바꿔 보고 가장 많이 줄어드는 것을 채택한다.
 * 같은 비용이면 가끔 옮겨 평지를 빠져나오고, 방금 바꾼 짝은 잠시 다시 바꾸지 않는다.
 * ═══════════════════════════════════════════════════════════ */

export interface PlanInput {
  uids: string[]
  groupCount: number
  history: Record<PairKey, PairRecord>
  rounds: number
  seed: string
  /** 있으면 여기서 출발해 고친다 — 지난 계획이 조금 어긋났을 때 처음부터 다시 짜지 않는다 */
  start?: string[][][]
  restarts?: number
  steps?: number
}

export interface Plan {
  rounds: string[][][]
  /** 계획 전체의 중복 — 회차마다 「그때까지의 동석 횟수 합」을 더한 것 (N.2 의 자) */
  repeats: number
}

/*
 * 한 회차를 정확히 짠다 — 「아직 안 만난 사람」 그래프를 모둠 크기의 묶음으로 가르는 되추적.
 *
 * 맞바꾸기 탐색은 30명×6모둠에서 11회 중복 언저리에 갇혔다(더 돌려도 그대로).
 * 답이 없는 것이 아니라 못 찾는 것이었다. 되추적은 사람이 30명이면 한 회차가 몇 밀리초다.
 *
 * 가장 제약이 센 사람(안 만난 사람이 가장 적은 사람)부터 자리를 정한다.
 * 후보 순서는 시드 난수로 섞어, 같은 문제를 다른 순서로 여러 번 풀 수 있게 한다.
 * nodeLimit 을 넘으면 포기한다 — 없는 답을 영원히 찾지 않는다.
 */
function buildRoundExact(
  n: number,
  cnt: Int32Array,
  sizes: number[],
  rng: () => number,
  nodeLimit: number,
): number[][] | null {
  const unassigned = new Uint8Array(n).fill(1)
  const groups: number[][] = []
  let nodes = 0
  /* 큰 모둠부터 채운다 — 큰 묶음이 더 찾기 어렵다 */
  const order = [...sizes].sort((a, b) => b - a)

  const unmet = (a: number, b: number) => cnt[a * n + b] === 0
  const freeDegree = (v: number): number => {
    let d = 0
    for (let u = 0; u < n; u++) if (u !== v && unassigned[u] && unmet(v, u)) d++
    return d
  }

  function extend(group: number[], need: number, candidates: number[]): boolean {
    if (++nodes > nodeLimit) return false
    if (need === 0) return placeNext()
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]
      /* c 이후의 후보 중 c 와도 안 만난 사람만 다음 후보로 */
      const rest = candidates.slice(i + 1).filter((u) => unmet(c, u))
      if (rest.length < need - 1) continue
      group.push(c)
      unassigned[c] = 0
      if (extend(group, need - 1, rest)) return true
      unassigned[c] = 1
      group.pop()
      if (nodes > nodeLimit) return false
    }
    return false
  }

  function placeNext(): boolean {
    const gi = groups.length
    if (gi === order.length) return true
    /* 가장 제약이 센 사람 */
    let seed = -1
    let seedDeg = Infinity
    for (let v = 0; v < n; v++) {
      if (!unassigned[v]) continue
      const d = freeDegree(v)
      if (d < seedDeg || (d === seedDeg && rng() < 0.5)) {
        seedDeg = d
        seed = v
      }
    }
    if (seed < 0) return true
    const need = order[gi] - 1
    if (seedDeg < need) return false
    const cands = shuffle(
      Array.from({ length: n }, (_, u) => u).filter((u) => u !== seed && unassigned[u] && unmet(seed, u)),
      rng,
    )
    const group = [seed]
    unassigned[seed] = 0
    groups.push(group)
    if (extend(group, need, cands)) return true
    groups.pop()
    unassigned[seed] = 1
    return false
  }

  return placeNext() ? groups : null
}

export function planSchedule(input: PlanInput): Plan {
  const uids = [...input.uids]
  const n = uids.length
  const R = Math.max(1, input.rounds)
  const sizes = groupSizes(n, input.groupCount)
  const rng = makeRng(input.seed)
  const restarts = input.restarts ?? 3
  const steps = input.steps ?? 500000
  if (n === 0) return { rounds: Array.from({ length: R }, () => []), repeats: 0 }

  const idx = new Map(uids.map((u, i) => [u, i]))
  /* 짝 카운트 — n×n 배열. 기록의 횟수를 미리 넣는다. */
  const base = new Int32Array(n * n)
  for (const [k, rec] of Object.entries(input.history)) {
    const [a, b] = k.split('|')
    const ia = idx.get(a)
    const ib = idx.get(b)
    if (ia === undefined || ib === undefined) continue
    base[ia * n + ib] += rec.count
    base[ib * n + ia] += rec.count
  }

  /*
   * 1단계 — 되추적으로 회차를 차례로 짠다. 어느 회차에서 막히면 처음부터 다른 순서로 다시.
   * 끝까지 가면 중복 0이다. 그것으로 끝.
   */
  const exactTries = Math.max(restarts, 6)
  let bestExact: number[][][] | null = null
  let bestExactRounds = -1
  /* 출발점이 주어졌으면 그것을 쓴다 — 명단에 맞는 회차만 */
  if (input.start && input.start.length > 0) {
    const fits = (gs: string[][]) => gs.flat().length === n && gs.flat().every((u) => idx.has(u))
    const usable = input.start.filter(fits).slice(0, R).map((gs) => gs.map((m) => m.map((u) => idx.get(u)!)))
    if (usable.length > 0) {
      bestExact = usable
      bestExactRounds = usable.length
    }
  }
  for (let t = 0; t < exactTries && bestExactRounds < 0; t++) {
    const cnt = Int32Array.from(base)
    const rounds: number[][][] = []
    for (let k = 0; k < R; k++) {
      const g = buildRoundExact(n, cnt, sizes, rng, 20000)
      if (!g) break
      rounds.push(g)
      for (const m of g)
        for (let i = 0; i < m.length; i++)
          for (let j = i + 1; j < m.length; j++) {
            cnt[m[i] * n + m[j]]++
            cnt[m[j] * n + m[i]]++
          }
    }
    if (rounds.length > bestExactRounds) {
      bestExactRounds = rounds.length
      bestExact = rounds
    }
    if (rounds.length === R) {
      return { rounds: rounds.map((gs) => gs.map((m) => m.map((p) => uids[p]))), repeats: 0 }
    }
  }

  /*
   * 2단계 — 끝까지 가지 못했다. 앞 회차들을 출발점으로 두고 계획 전체를 담금질한다.
   *
   * 이동은 「한 회차 안에서 두 사람 맞바꾸기」. 비용이 줄면 받고, 늘면 온도에 따라 가끔 받는다.
   * 내리막만 타는 탐색은 30명×6모둠에서 11회 언저리 평지에 갇혔다 — 온도가 그 평지를 넘긴다.
   * 회차 하나·둘을 헐고 되추적으로 다시 짜는 방식도 해 봤는데, 나머지가 너무 빡빡해 실패했다.
   */
  const cntAll = Int32Array.from(base)
  const plan: number[][][] = (bestExact ?? []).map((gs) => gs.map((m) => [...m]))
  const addRound = (g: number[][], sign: number) => {
    for (const m of g)
      for (let i = 0; i < m.length; i++)
        for (let j = i + 1; j < m.length; j++) {
          cntAll[m[i] * n + m[j]] += sign
          cntAll[m[j] * n + m[i]] += sign
        }
  }
  for (const g of plan) addRound(g, +1)
  while (plan.length < R) {
    const g = cut(shuffle(uids.map((_, i) => i), rng) as unknown as string[], sizes) as unknown as number[][]
    plan.push(g)
    addRound(g, +1)
  }
  const where: Int32Array[] = plan.map((groups) => {
    const w = new Int32Array(n)
    groups.forEach((m, gi) => m.forEach((p) => (w[p] = gi)))
    return w
  })
  /*
   * 비용 = 짝마다 C(c,2) 의 합. 회차마다 「그때까지의 동석 횟수 합」을 더한 것과 같다 —
   * 이번 회차를 짜는 자(N.2)와 계획을 짜는 자가 같아야 계획을 따르는 것이 곧 최선이 된다.
   * 세 번 만나는 짝은 0+1+2 = 3 이지 「초과분 2」가 아니다.
   */
  let cost = 0
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const c = cntAll[i * n + j]; cost += (c * (c - 1)) / 2 }

  const delta = (k: number, a: number, b: number): number => {
    const ga = plan[k][where[k][a]]
    const gb = plan[k][where[k][b]]
    let d = 0
    /* a 가 떠나면 c → c−1: −(c−1). b 가 들어오면 c → c+1: +c */
    for (const m of ga) if (m !== a) { d -= cntAll[a * n + m] - 1; d += cntAll[b * n + m] }
    for (const m of gb) if (m !== b) { d -= cntAll[b * n + m] - 1; d += cntAll[a * n + m] }
    return d
  }
  const apply = (k: number, a: number, b: number) => {
    const ga = plan[k][where[k][a]]
    const gb = plan[k][where[k][b]]
    for (const m of ga) if (m !== a) { cntAll[a * n + m]--; cntAll[m * n + a]--; cntAll[b * n + m]++; cntAll[m * n + b]++ }
    for (const m of gb) if (m !== b) { cntAll[b * n + m]--; cntAll[m * n + b]--; cntAll[a * n + m]++; cntAll[m * n + a]++ }
    ga[ga.indexOf(a)] = b
    gb[gb.indexOf(b)] = a
    const wa = where[k][a]
    where[k][a] = where[k][b]
    where[k][b] = wa
  }

  let bestPlan = plan.map((gs) => gs.map((m) => [...m]))
  let bestCost = cost
  const total = Math.max(steps, 20000) * Math.max(1, restarts)
  const T0 = 1.2
  const T1 = 0.08
  for (let s = 0; s < total && bestCost > 0; s++) {
    const T = T0 * Math.pow(T1 / T0, s / total)
    const k = Math.floor(rng() * R)
    /* 충돌 중인 사람을 우선 고른다 — 아무나 고르면 대부분의 이동이 헛돈다 */
    let a = Math.floor(rng() * n)
    if (rng() < 0.8) {
      const start = a
      for (let t = 0; t < n; t++) {
        const p = (start + t) % n
        let hot = false
        for (const m of plan[k][where[k][p]]) if (m !== p && cntAll[p * n + m] > 1) { hot = true; break }
        if (hot) { a = p; break }
      }
    }
    const b = Math.floor(rng() * n)
    if (where[k][b] === where[k][a]) continue
    const d = delta(k, a, b)
    if (d <= 0 || rng() < Math.exp(-d / T)) {
      apply(k, a, b)
      cost += d
      if (cost < bestCost) {
        bestCost = cost
        bestPlan = plan.map((gs) => gs.map((m) => [...m]))
      }
    }
  }

  return { rounds: bestPlan.map((gs) => gs.map((m) => m.map((p) => uids[p]))), repeats: bestCost }
}

/* ═══════════════════════════════════════════════════════════
 * 2. 이번 회차 — 계획의 첫 장에서 출발해 제약과 게임 분류를 맞춘다
 *
 * 짝 하나의 비용
 *   동석 횟수      × 1        — 이것이 규칙이다
 *   최근성         < 0.1      — 횟수가 같을 때만 갈리게 작게 둔다.
 *                              한 번 맞바꾸면 짝이 최대 2×(크기−1) 개 바뀌므로 합이 1을 넘지 않는다
 *   강사 고정 규칙  × 100      — 어기면 어떤 중복보다 비싸다
 *   게임 분류      × 5 / 2    — 중복보다 비싸고 고정 규칙보다 싸다
 * ═══════════════════════════════════════════════════════════ */
const W_FIXED = 100
const W_CATEGORY = 5
const W_SECOND = 2

interface Weights {
  hist: Record<PairKey, PairRecord>
  round: number
  together: Set<PairKey>
  apart: Set<PairKey>
  categories?: Record<string, string>
  mode: 'spread' | 'gather' | 'none'
  second?: Record<string, string>
}

function pairCost(a: string, b: string, w: Weights): number {
  const k = pairKey(a, b)
  const h = w.hist[k]
  let c = 0
  if (h) c += h.count + Math.min(0.09, h.lastRound / (Math.max(1, w.round) * 12))
  if (w.apart.has(k)) c += W_FIXED
  if (w.categories && w.mode !== 'none') {
    const ca = w.categories[a]
    const cb = w.categories[b]
    if (ca !== undefined && cb !== undefined) {
      if (w.mode === 'spread' && ca === cb) c += W_CATEGORY
      if (w.mode === 'gather' && ca !== cb) {
        const s2 = w.second
        const viaSecond = s2 && (s2[a] === cb || s2[b] === ca)
        c += viaSecond ? W_SECOND : W_CATEGORY
      }
    }
  }
  return c
}

/** 「반드시 같이」는 같은 모둠에 있을 때 0, 갈라져 있을 때 페널티 — 모둠 밖 짝을 봐야 하므로 따로 센다. */
function togetherPenalty(assign: Map<string, number>, together: Set<PairKey>): number {
  let p = 0
  for (const k of together) {
    const [a, b] = k.split('|')
    if (assign.has(a) && assign.has(b) && assign.get(a) !== assign.get(b)) p += W_FIXED
  }
  return p
}

function groupCost(members: string[], w: Weights): number {
  let c = 0
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++) c += pairCost(members[i], members[j], w)
  return c
}

/** 한 사람이 어느 모둠에 들어갈 때 늘어나는 비용 */
function joinCost(uid: string, members: string[], w: Weights): number {
  let c = 0
  for (const m of members) if (m !== uid) c += pairCost(uid, m, w)
  return c
}

/** 초기 배치에서 출발해 제약·분류·최근성까지 든 비용을 줄인다. 두 사람 맞바꾸기만 쓴다. */
function refine(
  start: string[][],
  uids: string[],
  w: Weights,
  rng: () => number,
  steps: number,
): { groups: string[][]; cost: number } {
  const groups = start.map((m) => [...m])
  const n = uids.length
  const assign = new Map<string, number>()
  groups.forEach((m, gi) => m.forEach((u) => assign.set(u, gi)))
  let cost = groups.reduce((c, m) => c + groupCost(m, w), 0) + togetherPenalty(assign, w.together)

  const swapDelta = (a: string, b: string): number => {
    const ga = assign.get(a)!
    const gb = assign.get(b)!
    const before = joinCost(a, groups[ga], w) + joinCost(b, groups[gb], w) + togetherPenalty(assign, w.together)
    assign.set(a, gb)
    assign.set(b, ga)
    const after =
      joinCost(a, groups[gb].filter((u) => u !== b), w) +
      joinCost(b, groups[ga].filter((u) => u !== a), w) +
      togetherPenalty(assign, w.together)
    assign.set(a, ga)
    assign.set(b, gb)
    return after - before
  }
  const tabu = new Map<PairKey, number>()
  for (let s = 0; s < steps && cost > 1e-9; s++) {
    const conflicted = uids.filter((u) => joinCost(u, groups[assign.get(u)!], w) > 1e-9)
    const pool = conflicted.length > 0 ? conflicted : uids
    const a = pool[Math.floor(rng() * pool.length)]
    const ga = assign.get(a)!
    let bestB: string | null = null
    let bestD = Infinity
    for (let i = 0; i < n; i++) {
      const b = uids[i]
      if (assign.get(b) === ga) continue
      if ((tabu.get(pairKey(a, b)) ?? -Infinity) > s - 7) continue
      const d = swapDelta(a, b)
      if (d < bestD - 1e-9 || (Math.abs(d - bestD) < 1e-9 && rng() < 0.5)) { bestD = d; bestB = b }
    }
    if (bestB === null) continue
    if (bestD < -1e-9 || (Math.abs(bestD) < 1e-9 && rng() < 0.2)) {
      const gb = assign.get(bestB)!
      groups[ga][groups[ga].indexOf(a)] = bestB
      groups[gb][groups[gb].indexOf(bestB)] = a
      assign.set(a, gb)
      assign.set(bestB, ga)
      tabu.set(pairKey(a, bestB), s)
      cost += bestD
    }
  }
  return { groups, cost }
}

export function assignGroups(input: AssignInput): AssignResult {
  const uids = [...input.uids]
  const n = uids.length
  const rng = makeRng(input.seed)
  const w: Weights = {
    hist: input.history,
    round: input.round,
    together: new Set((input.mustTogether ?? []).map(([a, b]) => pairKey(a, b))),
    apart: new Set((input.mustApart ?? []).map(([a, b]) => pairKey(a, b))),
    categories: input.categories,
    mode: input.categoryMode ?? 'none',
    second: input.secondChoice,
  }
  const ahead = Math.max(1, input.roundsAhead ?? 1)
  const restarts = 3
  const steps = 1500

  if (n === 0) {
    return { groups: [], repeats: 0, cost: 0, seed: input.seed, plannedRounds: ahead, plannedRepeats: 0, plannedNext: [], followedPlan: true }
  }

  /*
   * 출발점. 저장된 계획이 지금 명단과 모둠 수에 그대로 맞으면 그 첫 장을 쓴다.
   * 아니면(첫 회차·전입·전출·모둠 수 변경) 남은 회차 전체를 새로 계획한다.
   */
  const sizes = groupSizes(n, input.groupCount)
  const stored = input.plannedRemaining
  const storedFits =
    stored && stored.length > 0 && stored[0].length === sizes.length &&
    stored[0].flat().length === n && stored[0].flat().every((u) => uids.includes(u)) &&
    stored[0].every((m, i) => m.length === sizes[i])
  const plan =
    storedFits && !input.planStale
      ? { rounds: stored!, repeats: null as number | null }
      : planSchedule({
          uids,
          groupCount: input.groupCount,
          history: input.history,
          rounds: ahead,
          seed: `${input.seed}::plan`,
          start: storedFits ? stored : undefined,
          restarts: input.restarts,
          steps: input.steps,
        })

  /*
   * 제약도 게임 분류도 없으면 계획의 그 장을 그대로 쓴다.
   * 「이번 회차만 보면 한 번 덜 만날 수 있다」며 벗어나면 뒤 회차들이 전부 어긋난다 —
   * 실제로 그렇게 해서 계획 8회가 실행 17회가 됐다.
   */
  const hasConstraints =
    (input.mustTogether?.length ?? 0) > 0 || (input.mustApart?.length ?? 0) > 0 ||
    (input.categories && (input.categoryMode ?? 'none') !== 'none')
  if (!hasConstraints) {
    const groups = plan.rounds[0].map((m) => [...m])
    let repeats = 0
    for (const m of groups)
      for (let i = 0; i < m.length; i++)
        for (let j = i + 1; j < m.length; j++) repeats += input.history[pairKey(m[i], m[j])]?.count ?? 0
    return {
      groups,
      repeats,
      cost: repeats,
      seed: input.seed,
      plannedRounds: ahead,
      plannedRepeats: plan.repeats,
      plannedNext: plan.rounds.slice(1),
      followedPlan: true,
    }
  }

  let best: { groups: string[][]; cost: number } | null = null
  for (let r = 0; r < restarts; r++) {
    /* 첫 번은 계획 그대로, 그다음은 흔들어 다른 출발점을 본다 */
    const start = r === 0 ? plan.rounds[0] : cut(shuffle(uids, rng), sizes)
    const res = refine(start, uids, w, rng, r === 0 ? steps : Math.floor(steps / 2))
    if (!best || res.cost < best.cost - 1e-9) best = res
    if (best.cost < 1e-9) break
  }

  const groups = best!.groups
  let repeats = 0
  for (const m of groups)
    for (let i = 0; i < m.length; i++)
      for (let j = i + 1; j < m.length; j++) repeats += input.history[pairKey(m[i], m[j])]?.count ?? 0

  return {
    groups,
    repeats,
    cost: Math.round(best!.cost * 1000) / 1000,
    seed: input.seed,
    plannedRounds: ahead,
    plannedRepeats: plan.repeats,
    plannedNext: plan.rounds.slice(1),
    followedPlan: sameGrouping(groups, plan.rounds[0]),
  }
}

/** 저장용 꼴. Firestore 는 배열 속 배열을 담지 못해 회차 → 모둠 → 사람을 map 으로 한 겹 싼다. */
export type StoredPlan = Array<{ groups: Array<{ members: string[] }> }>

export function encodePlan(plan: string[][][]): StoredPlan {
  return plan.map((groups) => ({ groups: groups.map((members) => ({ members })) }))
}

export function decodePlan(stored: StoredPlan | undefined): string[][][] | undefined {
  if (!stored || stored.length === 0) return undefined
  return stored.map((r) => r.groups.map((g) => g.members))
}

/** 두 배치가 같은 모둠 나눔인가 — 모둠 순서·사람 순서는 무시한다 */
export function sameGrouping(a: string[][], b: string[][]): boolean {
  const key = (gs: string[][]) => gs.map((m) => [...m].sort().join(',')).sort().join('|')
  return key(a) === key(b)
}

/**
 * 늦게 온 학생 — 비용이 가장 적게 늘어나는 모둠에 넣는다 (N.7).
 * 같으면 인원이 적은 모둠. 배정을 다시 돌리지 않는다 — 이미 앉은 사람들이 움직이면 안 된다.
 */
export function placeLateJoiner(
  groups: string[][],
  uid: string,
  history: Record<PairKey, PairRecord>,
  round: number,
): number {
  const w: Weights = { hist: history, round, together: new Set(), apart: new Set(), mode: 'none' }
  let bestIdx = 0
  let bestKey = Infinity
  groups.forEach((m, i) => {
    const key = joinCost(uid, m, w) * 1000 + m.length
    if (key < bestKey) {
      bestKey = key
      bestIdx = i
    }
  })
  return bestIdx
}

/**
 * 가능 여부 (N.5).
 *   한 사람이 만나는 총 인원 = 회차 수 × (모둠 크기 − 1)
 *   가능한 상대 수        = 전체 인원 − 1
 * 앞이 뒤보다 크면 중복이 반드시 생긴다. 모둠 크기는 큰 쪽(⌈n/g⌉)으로 잡는다.
 */
export function feasibility(n: number, groupCount: number, rounds: number) {
  const g = Math.max(1, groupCount)
  const size = Math.ceil(n / g)
  const meets = rounds * (size - 1)
  const possible = Math.max(0, n - 1)
  const minRepeats = Math.max(0, meets - possible)
  return { size, meets, possible, minRepeats, ok: minRepeats === 0 }
}

/** 확정된 모둠으로 동석 기록을 갱신한 새 기록을 돌려준다. 원본은 바꾸지 않는다. */
export function applyRound(
  history: Record<PairKey, PairRecord>,
  groups: string[][],
  round: number,
): Record<PairKey, PairRecord> {
  const next: Record<PairKey, PairRecord> = { ...history }
  for (const m of groups)
    for (let i = 0; i < m.length; i++)
      for (let j = i + 1; j < m.length; j++) {
        const k = pairKey(m[i], m[j])
        const prev = next[k]
        next[k] = { count: (prev?.count ?? 0) + 1, lastRound: round }
      }
  return next
}

/** 모둠 목록의 모든 짝 키 */
export function pairKeysOf(groups: string[][]): PairKey[] {
  const out: PairKey[] = []
  for (const m of groups)
    for (let i = 0; i < m.length; i++)
      for (let j = i + 1; j < m.length; j++) out.push(pairKey(m[i], m[j]))
  return out
}

/**
 * 회차를 다시 확정할 때 동석 기록에 더할 값.
 * 같은 회차를 두 번 확정하면 짝이 두 번 세어진다 — 이전 확정의 짝은 −1, 새 확정의 짝은 +1, 양쪽에 다 있는 짝은 0.
 * 처음 확정(이전 없음)이면 전부 +1.
 */
export function pairDeltas(prevGroups: string[][] | null, nextGroups: string[][]): Record<PairKey, number> {
  const d: Record<PairKey, number> = {}
  if (prevGroups) for (const k of pairKeysOf(prevGroups)) d[k] = (d[k] ?? 0) - 1
  for (const k of pairKeysOf(nextGroups)) d[k] = (d[k] ?? 0) + 1
  for (const k of Object.keys(d)) if (d[k] === 0) delete d[k]
  return d
}

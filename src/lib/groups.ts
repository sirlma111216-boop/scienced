import type { LessonId } from '@/content/types'
import {
  DEFAULT_FORMATION_LESSONS,
  DEFAULT_GROUP_COUNT,
  GROUP_GAME_BY_LESSON,
  gameDealsCards,
  type GroupGameDef,
} from '@/content/group-games'
import {
  assignGroups,
  makeRng,
  pairKey,
  type AssignInput,
  type AssignResult,
  type PairRecord,
} from '@shared/groups-core'
import { apiPost } from './api'
import type { ClassDoc, GroupInput, GroupRound, GroupRoundGroup, PairHistoryDoc } from './types'

export {
  applyRound,
  assignGroups,
  decodePlan,
  encodePlan,
  feasibility,
  groupSizes,
  pairKey,
  placeLateJoiner,
  planSchedule,
  sameGrouping,
} from '@shared/groups-core'

/**
 * 모둠 나누기 — 화면이 쓰는 도움 함수 (6차).
 *
 * 배정 계산 자체는 shared/groups-core 에 있다. 여기는 그것을 클래스 설정·게임·기록과 잇는다.
 */

export function formationLessons(cls: ClassDoc | null | undefined): LessonId[] {
  return cls?.groupFormationLessons?.length ? cls.groupFormationLessons : DEFAULT_FORMATION_LESSONS
}

export function groupCountOf(cls: ClassDoc | null | undefined): number {
  return cls?.groupCount && cls.groupCount >= 2 ? cls.groupCount : DEFAULT_GROUP_COUNT
}

/** 이 차시가 몇 번째 회차인가. 나누는 회차가 아니면 null. */
export function roundNumberOf(lessonId: LessonId, lessons: LessonId[]): number | null {
  const i = lessons.indexOf(lessonId)
  return i < 0 ? null : i + 1
}

/**
 * 이 차시에서 쓰는 모둠 — 이 차시 이전(포함)에 확정된 가장 최근 회차.
 * 홀수 차시에 나눈 모둠을 두 차시 동안 쓴다. 13차시 이후는 11차시 모둠을 이어 쓴다.
 */
export function roundForLesson(lessonId: LessonId, rounds: GroupRound[]): GroupRound | null {
  const done = rounds
    .filter((r) => r.lessonId <= lessonId)
    .sort((a, b) => (a.lessonId < b.lessonId ? 1 : -1))
  return done[0] ?? null
}

/** 회차 목록을 동석 기록으로 접는다 — 강사 화면의 격자와 「처음 만나는 분」 배지가 같은 자를 쓴다. */
export function historyFromDocs(docs: PairHistoryDoc[]): Record<string, PairRecord> {
  const out: Record<string, PairRecord> = {}
  for (const d of docs) out[d.pairKey] = { count: d.count, lastRound: d.lastRound }
  return out
}

/** 학생은 pairHistory 를 읽지 못한다. 회차 문서에서 「누구와 만났나」를 직접 센다. */
export function metBefore(uid: string, rounds: GroupRound[], beforeRoundId: string | null): Set<string> {
  const met = new Set<string>()
  for (const r of rounds) {
    if (r.id === beforeRoundId) continue
    for (const g of r.groups) {
      if (!g.memberUids.includes(uid)) continue
      for (const m of g.memberUids) if (m !== uid) met.add(m)
    }
  }
  return met
}

/** 지난 회차의 내 모둠과 견주어 몇 명이 바뀌었나 */
export function changedSinceLast(uid: string, current: GroupRound, rounds: GroupRound[]): number | null {
  const prev = rounds
    .filter((r) => r.round < current.round)
    .sort((a, b) => b.round - a.round)[0]
  if (!prev) return null
  const now = current.groups.find((g) => g.memberUids.includes(uid))
  const before = prev.groups.find((g) => g.memberUids.includes(uid))
  if (!now || !before) return null
  const stayed = now.memberUids.filter((m) => m !== uid && before.memberUids.includes(m)).length
  return now.memberUids.length - 1 - stayed
}

/* ── 게임 → 배정 입력 ── */

/** 입력형 게임의 분류. 낱말·발화·예상을 uid → 선택지 id 로. */
export function categoriesFrom(game: GroupGameDef, inputs: GroupInput[]) {
  const categories: Record<string, string> = {}
  const second: Record<string, string> = {}
  for (const i of inputs) {
    if (!i.choice) continue
    categories[i.uid] = i.choice
    if (i.second) second[i.uid] = i.second
  }
  const mode: AssignInput['categoryMode'] =
    game.mode === 'homogeneous' ? 'gather' : game.mode === 'heterogeneous' || game.mode === 'oneFromEachFork' ? 'spread' : 'none'
  return { categories, second, mode }
}

/**
 * 배분형 게임 — 모둠에 카드 묶음을 나눠 준다. 묶음 순서는 시드로 섞는다.
 * 모둠이 묶음보다 많으면 앞에서부터 다시 돈다 (이름에 ② 를 붙인다).
 */
export function dealSets(game: GroupGameDef, groupCount: number, seed: string): Array<{ setId: string; name: string }> {
  const sets = game.cardSets ?? []
  if (sets.length === 0) return []
  const rng = makeRng(`${seed}::deal`)
  const order = [...sets]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return Array.from({ length: groupCount }, (_, gi) => {
    const s = order[gi % order.length]
    const lap = Math.floor(gi / order.length)
    return { setId: s.id, name: lap === 0 ? s.name : `${s.name} ${['②', '③', '④'][lap - 1] ?? lap + 1}` }
  })
}

/** 한 사람이 받은 카드. 모둠 안 순서대로 한 장씩, 모자라면 앞에서부터 다시. */
export function cardFor(game: GroupGameDef, group: GroupRoundGroup, uid: string) {
  const set = game.cardSets?.find((s) => s.id === group.cardSetId)
  if (!set) return null
  const i = group.memberUids.indexOf(uid)
  if (i < 0) return null
  return { set, card: set.cards[i % set.cards.length], index: i }
}

/**
 * 모둠 이름.
 *   fromCards · 입력형 — 그 모둠에 모인 선택지 중 가장 적게 나온 것 (1차시), 가장 많이 나온 것 (3차시)
 *   fromCards · 배분형 — 받은 카드 묶음의 이름
 *   numbered — ①모둠 ②모둠 … (5차시: 예상을 이름으로 쓰면 정답을 암시한다)
 */
export function nameGroups(
  game: GroupGameDef,
  groups: string[][],
  inputs: GroupInput[],
  dealt: Array<{ setId: string; name: string }>,
): GroupRoundGroup[] {
  const label = (id: string) => game.options?.find((o) => o.id === id)?.label ?? id
  const choiceOf = Object.fromEntries(inputs.map((i) => [i.uid, i.choice]))
  const circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫']
  const used = new Map<string, number>()
  const unique = (name: string) => {
    const n = (used.get(name) ?? 0) + 1
    used.set(name, n)
    return n === 1 ? name : `${name} ${circled[n - 1] ?? n}`
  }
  return groups.map((memberUids, gi) => {
    const id = String(gi + 1)
    if (game.groupNaming === 'numbered') return { id, name: `${circled[gi] ?? gi + 1}모둠`, memberUids }
    if (gameDealsCards(game)) {
      const d = dealt[gi]
      return { id, name: d?.name ?? `${circled[gi] ?? gi + 1}모둠`, memberUids, cardSetId: d?.setId }
    }
    /* 입력형 — 모둠 안의 선택 분포 */
    const tally = new Map<string, number>()
    for (const u of memberUids) {
      const c = choiceOf[u]
      if (c) tally.set(c, (tally.get(c) ?? 0) + 1)
    }
    if (tally.size === 0) return { id, name: `${circled[gi] ?? gi + 1}모둠`, memberUids }
    const sorted = [...tally.entries()].sort((a, b) => a[1] - b[1])
    /* 이질 모둠은 가장 적게 나온 낱말, 동질 모둠은 가장 많이 나온 발화 */
    const pick = game.mode === 'homogeneous' ? sorted[sorted.length - 1][0] : sorted[0][0]
    const short = label(pick).replace(/^“|”$/g, '')
    return { id, name: unique(short.length > 14 ? `${short.slice(0, 13)}…` : short), memberUids }
  })
}

/* ── 실행 ── */

export interface RunAssignmentParams {
  classId: string
  lessonId: LessonId
  game: GroupGameDef | null
  uids: string[]
  groupCount: number
  history: Record<string, PairRecord>
  round: number
  roundsAhead: number
  inputs: GroupInput[]
  mustTogether: Array<[string, string]>
  mustApart: Array<[string, string]>
  plannedRemaining?: string[][][]
  planStale?: boolean
}

/**
 * 배정 한 번. 난수는 서버가 만든다 — 서버가 시드를 만들고 같은 코드로 계산해 돌려준다.
 * 서버에 닿지 않는 로컬 저장 모드에서는 강사 화면에서 시각 기반 시드로 같은 코드를 돌린다.
 * 어느 쪽이든 시드가 결과와 함께 저장되므로 재현할 수 있다.
 */
export async function runAssignment(p: RunAssignmentParams): Promise<AssignResult & { fromServer: boolean }> {
  const cat = p.game ? categoriesFrom(p.game, p.inputs) : { categories: {}, second: {}, mode: 'none' as const }
  const body: Omit<AssignInput, 'seed'> & { classId: string; lessonId: LessonId; gameId: string | null } = {
    classId: p.classId,
    lessonId: p.lessonId,
    gameId: p.game?.id ?? null,
    uids: p.uids,
    groupCount: p.groupCount,
    history: p.history,
    round: p.round,
    roundsAhead: p.roundsAhead,
    mustTogether: p.mustTogether,
    mustApart: p.mustApart,
    categories: cat.categories,
    categoryMode: cat.mode,
    secondChoice: cat.second,
    plannedRemaining: p.plannedRemaining,
    planStale: p.planStale,
  }
  const data = await apiPost<{ ok: boolean; result?: AssignResult; message?: string }>('/api/groups/assign', body)
  if (data.ok && data.result) return { ...data.result, fromServer: true }
  if (data.message && !/서버에 닿지 못했습니다/.test(data.message)) {
    /* 서버가 거절한 것이다 — 조용히 로컬로 넘어가지 않는다 */
    throw new Error(data.message)
  }
  const seed = `${p.classId}::${p.lessonId}::r${p.round}::local::${Date.now().toString(36)}`
  return { ...assignGroups({ ...body, seed }), fromServer: false }
}

/** 강사 화면 — 이 차시의 게임. 나누는 회차인데 게임이 없으면(13차시 이후 등) null. */
export function gameForLesson(lessonId: LessonId): GroupGameDef | null {
  return GROUP_GAME_BY_LESSON[lessonId] ?? null
}

/** 동석 격자에 쓰는 짝 조회 */
export function pairCount(history: Record<string, PairRecord>, a: string, b: string): number {
  return history[pairKey(a, b)]?.count ?? 0
}

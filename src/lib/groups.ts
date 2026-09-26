import type { LessonId } from '@/content/types'
import { courseIdFromTitle } from '@/content/courses'
import { FORMATION_QUESTION_BY_ID, questionForLessonNumber, type FormationQuestion } from '@/content/formation-questions'
import { assignGroups, pairKey, pairKeysOf, type AssignInput, type AssignResult, type PairRecord } from '@shared/groups-core'
import { apiPost } from './api'
import type { ClassDoc, GroupInput, GroupRound, GroupRoundGroup, PairHistoryDoc } from './types'

export { applyRound, assignGroups, decodePlan, encodePlan, feasibility, groupSizes, pairKey, placeLateJoiner, planSchedule, sameGrouping } from '@shared/groups-core'
export { attendanceLessonOf, defaultFormationLessons, followedLesson, formationLessons, roundForLesson } from './group-round'

/**
 * 모둠 나누기 — 화면이 쓰는 도움 함수 (6차 · 8차 5절).
 *
 * 배정 계산 자체는 shared/groups-core 에 있다. 여기는 그것을 클래스 설정·질문·기록과 잇는다.
 * 8차: 과학 소재 게임 6종 대신 기호를 묻는 질문 하나로 나눈다. 같은 답끼리 모으되 동석 최소화는 그대로.
 */

export const DEFAULT_GROUP_COUNT = 4
export const DEFAULT_CLASS_SIZE = 20

export function groupCountOf(cls: ClassDoc | null | undefined): number {
  return cls?.groupCount && cls.groupCount >= 2 ? cls.groupCount : DEFAULT_GROUP_COUNT
}

/** 이 차시가 몇 번째 회차인가. 나누는 회차가 아니면 null. */
export function roundNumberOf(lessonId: LessonId, lessons: LessonId[]): number | null {
  const i = lessons.indexOf(lessonId)
  return i < 0 ? null : i + 1
}

/**
 * 이 차시의 질문. 강사가 정해 둔 것(클래스 문서)이 있으면 그것, 없으면 차시 번호 자리의 질문.
 *
 * 질문은 모둠을 나누는 차시만이 아니라 **매 차시** 뜬다 — 답하면 그날 출석이다 (강의자 지시 2026-09-22).
 * 그래서 「아직 안 쓴 첫 질문」으로 고르면 아직 안 나눈 차시들이 모두 같은 질문을 보인다.
 * 차시 번호로 자리를 정하고 이미 쓴 질문만 건너뛴다 — 열여덟 차시가 서로 다른 질문을 받는다.
 * 확정할 때 클래스 문서에 기록해 학기 안에 되풀이하지 않는다.
 */
export function questionForLesson(cls: ClassDoc | null | undefined, lessonId: LessonId): FormationQuestion {
  const chosen = cls?.formationQuestions?.[lessonId]
  if (chosen && FORMATION_QUESTION_BY_ID[chosen]) return FORMATION_QUESTION_BY_ID[chosen]
  const used = new Set(
    Object.entries(cls?.formationQuestions ?? {})
      .filter(([lid]) => lid !== lessonId)
      .map(([, qid]) => qid),
  )
  const courseId = cls?.courseId ?? courseIdFromTitle(cls?.courseTitle)
  return questionForLessonNumber(Number(lessonId), courseId, used)
}

export function historyFromDocs(docs: PairHistoryDoc[]): Record<string, PairRecord> {
  const out: Record<string, PairRecord> = {}
  for (const d of docs) out[d.pairKey] = { count: d.count, lastRound: d.lastRound }
  return out
}

/** 이미 확정된 회차를 다시 나눌 때 — 그 회차가 올린 짝을 뺀 기록 */
export function historyWithoutRound(history: Record<string, PairRecord>, groups: string[][]): Record<string, PairRecord> {
  const next: Record<string, PairRecord> = { ...history }
  for (const k of pairKeysOf(groups)) {
    const prev = next[k]
    if (!prev) continue
    if (prev.count <= 1) delete next[k]
    else next[k] = { ...prev, count: prev.count - 1 }
  }
  return next
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
  const prev = rounds.filter((r) => r.round < current.round).sort((a, b) => b.round - a.round)[0]
  if (!prev) return null
  const now = current.groups.find((g) => g.memberUids.includes(uid))
  const before = prev.groups.find((g) => g.memberUids.includes(uid))
  if (!now || !before) return null
  const stayed = now.memberUids.filter((m) => m !== uid && before.memberUids.includes(m)).length
  return now.memberUids.length - 1 - stayed
}

/* ── 질문 → 배정 입력 ── */

/** 같은 답끼리 모은다 (gather). 우선순위이지 보장이 아니다 — 몰리면 일부가 다른 모둠으로 간다 */
export function categoriesFrom(inputs: GroupInput[]) {
  const categories: Record<string, string> = {}
  for (const i of inputs) if (i.choice) categories[i.uid] = i.choice
  const mode: AssignInput['categoryMode'] = 'gather'
  return { categories, mode }
}

/**
 * 모둠 이름 = 답 (8차 5.2). 섞인 모둠은 다수 답의 이름. 같은 이름이 둘이면 ② ③ 을 붙인다.
 */
export function nameGroups(question: FormationQuestion, groups: string[][], inputs: GroupInput[]): GroupRoundGroup[] {
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
    const tally = new Map<string, number>()
    for (const u of memberUids) {
      const c = choiceOf[u]
      if (c) tally.set(c, (tally.get(c) ?? 0) + 1)
    }
    if (tally.size === 0) return { id, name: unique(`${question.options[gi % question.options.length]} 모둠`), memberUids }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]
    return { id, name: unique(`${top} 모둠`), memberUids }
  })
}

/* ── 실행 ── */

export interface RunAssignmentParams {
  classId: string
  lessonId: LessonId
  uids: string[]
  groupCount: number
  history: Record<string, PairRecord>
  round: number
  roundsAhead: number
  inputs: GroupInput[]
  plannedRemaining?: string[][][]
  planStale?: boolean
}

/**
 * 배정 한 번. 난수는 서버가 만든다. 서버에 닿지 않는 로컬 저장 모드에서는 강사 화면에서 시각 기반 시드로 같은 코드를 돌린다.
 */
export async function runAssignment(p: RunAssignmentParams): Promise<AssignResult & { fromServer: boolean }> {
  const cat = categoriesFrom(p.inputs)
  const body: Omit<AssignInput, 'seed'> & { classId: string; lessonId: LessonId } = {
    classId: p.classId,
    lessonId: p.lessonId,
    uids: p.uids,
    groupCount: p.groupCount,
    history: p.history,
    round: p.round,
    roundsAhead: p.roundsAhead,
    categories: cat.categories,
    categoryMode: Object.keys(cat.categories).length > 0 ? cat.mode : 'none',
    plannedRemaining: p.plannedRemaining,
    planStale: p.planStale,
  }
  const data = await apiPost<{ ok: boolean; result?: AssignResult; message?: string }>('/api/groups/assign', body)
  if (data.ok && data.result) return { ...data.result, fromServer: true }
  if (data.message && !/서버에 닿지 못했습니다/.test(data.message)) throw new Error(data.message)
  const seed = `${p.classId}::${p.lessonId}::r${p.round}::local::${Date.now().toString(36)}`
  return { ...assignGroups({ ...body, seed }), fromServer: false }
}

/** 동석 격자에 쓰는 짝 조회 */
export function pairCount(history: Record<string, PairRecord>, a: string, b: string): number {
  return history[pairKey(a, b)]?.count ?? 0
}

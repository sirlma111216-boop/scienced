import type { LessonId } from '@/content/types'
import type { Repo } from '@/lib/repo'
import type { ResponseDoc } from '@/lib/types'

/**
 * 잠깐 확인 — 개념 카드 아래 4지선다 (강의자 지시 2026-09-18).
 *
 * 개념 단계의 응답 문서 하나에 카드마다 고른 자리를 모은다: payload = { [카드 id]: 0~3 }.
 * 이유 칸은 없다. 한 번 고르면 바꾸지 않는다 — 분포가 첫 판단을 보여야 한다.
 * 쓰는 칸(원칙 1)으로 세지 않는다 — writingSlots 는 fields 만 센다.
 */

export type Choice = 0 | 1 | 2 | 3

const isChoice = (x: unknown): x is Choice => x === 0 || x === 1 || x === 2 || x === 3

/** 응답 문서의 마지막 판에서 카드별로 고른 자리. 옛 꼴({choice, reason})은 뜻이 달라 읽지 않는다 */
export function checkChoices(doc: ResponseDoc | null | undefined): Record<string, Choice> {
  const v = doc?.versions?.[doc.versions.length - 1]
  const p = (v?.payload ?? {}) as Record<string, unknown>
  const out: Record<string, Choice> = {}
  for (const [k, x] of Object.entries(p)) if (isChoice(x)) out[k] = x
  return out
}

/**
 * 카드 하나의 답을 더해 새 판으로 낸다. 새 판은 앞 판을 대신하므로 prev 에 지금까지 고른 것이 전부 있어야 한다.
 * 한 화면에서 연달아 누르면 앞 저장이 끝나기 전에 뒤 저장이 시작될 수 있다 — 부르는 쪽이 줄을 세운다(StudentConceptCards).
 */
export async function saveConceptCheck(
  repo: Repo,
  a: { classId: string; lessonId: LessonId; stepId: string; uid: string; prev: Record<string, Choice>; conceptId: string; choice: Choice },
): Promise<Record<string, Choice>> {
  const next = { ...a.prev, [a.conceptId]: a.choice }
  await repo.submitResponse(a.classId, a.lessonId, a.stepId, a.uid, next, { confidence: null, changedReason: null })
  return next
}

/** 강사 — 카드 하나의 분포. byOption[i] 는 i 번 보기를 고른 사람의 uid */
export function checkTally(docs: ResponseDoc[], conceptId: string): { counts: [number, number, number, number]; byOption: [string[], string[], string[], string[]]; answered: number } {
  const counts: [number, number, number, number] = [0, 0, 0, 0]
  const byOption: [string[], string[], string[], string[]] = [[], [], [], []]
  for (const d of docs) {
    const c = checkChoices(d)[conceptId]
    if (c === undefined) continue
    counts[c] += 1
    byOption[c].push(d.uid)
  }
  return { counts, byOption, answered: counts[0] + counts[1] + counts[2] + counts[3] }
}

/** 보기 자리 표시 */
export const OPTION_MARK = ['①', '②', '③', '④'] as const

import type { CourseId, LessonId } from '@/content/types'
import { lessonIndex } from '@/content/courses'
import type { ClassDoc, GroupRound } from './types'

/**
 * 어느 차시가 모둠을 나누고, 어느 차시가 어느 회차를 쓰는가.
 * 화면·저장 계층을 부르지 않는 순수 함수만 둔다 — verify:groups 가 그대로 불러 검사한다.
 */

/**
 * 모둠을 새로 나누는 차시 (강의자가 확정 2026-09-22).
 *
 *   과학교육론    매 차시 앞에서 나눈다.
 *   과학교과교수법 12강까지는 홀수 차시(1·3·5·7·9·11)에 나누고 그다음 짝수 차시는 앞 차시의 모둠을 따른다.
 *                 **13강부터는 매 차시 앞에서 나눈다** (13·14·15·16·17·18).
 *
 * 이 함수 하나가 규칙이다 — 화면·강사 화면·검사기가 전부 여기를 부른다. 다른 곳에 홀짝 계산을 두지 않는다.
 */
export const METHOD_PAIRED_UNTIL = 12

export function defaultFormationLessons(courseId: CourseId): LessonId[] {
  const ids = lessonIndex(courseId).map((l) => l.id)
  if (courseId === 'edu') return ids
  return ids.filter((id) => {
    const n = Number(id)
    return n > METHOD_PAIRED_UNTIL || n % 2 === 1
  })
}

export function formationLessons(cls: ClassDoc | null | undefined, courseId: CourseId): LessonId[] {
  return cls?.groupFormationLessons?.length ? cls.groupFormationLessons : defaultFormationLessons(courseId)
}

/**
 * 이 차시에서 쓰는 모둠.
 *   · 모둠을 새로 나누는 차시(defaultFormationLessons)는 **이 차시에서 확정한 회차만** — 나누기 전에는 없다.
 *     지난 회차를 보이면 「같은 답끼리 모인다」는 질문 아래에 지난주 모둠이 떠 있어 헷갈린다 (강의자 지적 2026-09-22).
 *   · 나누지 않는 차시(교수법 2~12강의 짝수 차시)는 **바로 앞 나누는 차시**의 회차만 이어 쓴다. 그것이 없으면 없다.
 *     더 옛 회차를 끌어오지 않는다 — 5강에서 아직 안 나눴는데 6강에 3강 모둠이 떠 있었다 (강의자 지적 2026-09-22).
 *     이 차시에서 직접 나눈 회차가 있으면(강사가 짝수 차시에 나눈 경우) 그것이 먼저다.
 */
export function roundForLesson(lessonId: LessonId, rounds: GroupRound[], formation: LessonId[]): GroupRound | null {
  const here = rounds.find((r) => r.lessonId === lessonId) ?? null
  if (formation.includes(lessonId) || here) return here
  const prev = [...formation].filter((l) => l < lessonId).sort().pop()
  return prev ? (rounds.find((r) => r.lessonId === prev) ?? null) : null
}

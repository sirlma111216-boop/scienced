import type { CourseId, LessonId } from '@/content/types'
import { lessonIndex } from '@/content/courses'
import type { ClassDoc, GroupRound } from './types'

/**
 * 어느 차시가 모둠을 나누고, 어느 차시가 어느 회차를 쓰는가.
 * 화면·저장 계층을 부르지 않는 순수 함수만 둔다 — verify:groups 가 그대로 불러 검사한다.
 */

/** 모둠을 새로 나누는 차시 — 교수법은 홀수 차시, 교육론은 매 차시 (강의자 답 8) */
export function defaultFormationLessons(courseId: CourseId): LessonId[] {
  const ids = lessonIndex(courseId).map((l) => l.id)
  return courseId === 'edu' ? ids : ids.filter((_, i) => i % 2 === 0)
}

export function formationLessons(cls: ClassDoc | null | undefined, courseId: CourseId): LessonId[] {
  return cls?.groupFormationLessons?.length ? cls.groupFormationLessons : defaultFormationLessons(courseId)
}

/**
 * 이 차시에서 쓰는 모둠.
 *   · 모둠을 새로 나누는 차시(교육론 매 차시 · 교수법 홀수 차시)는 **이 차시에서 확정한 회차만** — 나누기 전에는 없다.
 *     지난 회차를 보이면 「같은 답끼리 모인다」는 질문 아래에 지난주 모둠이 떠 있어 헷갈린다 (강의자 지적 2026-09-22).
 *   · 나누지 않는 차시(교수법 짝수 차시)는 그 이전에 확정된 가장 최근 회차를 이어 쓴다.
 */
export function roundForLesson(lessonId: LessonId, rounds: GroupRound[], formation: LessonId[]): GroupRound | null {
  if (formation.includes(lessonId)) return rounds.find((r) => r.lessonId === lessonId) ?? null
  const done = rounds.filter((r) => r.lessonId <= lessonId).sort((a, b) => (a.lessonId < b.lessonId ? 1 : -1))
  return done[0] ?? null
}

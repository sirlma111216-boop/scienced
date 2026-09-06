import type { Lesson, LessonId } from '../types'
import { lesson01 } from './lesson01'
import { lesson02, lesson03, lesson04, lesson05, lesson06, lesson07 } from './lessons02to07'
import { lesson08, lesson09, lesson10, lesson11, lesson12, lesson13 } from './lessons08to13'
import { lesson14, lesson15, lesson16, lesson17, lesson18 } from './lessons14to18'

/**
 * 18차시 시드 데이터.
 *
 * 시드 상태에서 1강만 published: true 다 (지시서 13절).
 * 나머지는 강사가 /instructor/lessons 에서 행마다 켠다.
 * 학생 홈에는 공개된 차시만 보이고, 미공개 차시는 개수도 제목도 나가지 않는다.
 */
export const LESSONS: Lesson[] = [
  lesson01,
  lesson02,
  lesson03,
  lesson04,
  lesson05,
  lesson06,
  lesson07,
  lesson08,
  lesson09,
  lesson10,
  lesson11,
  lesson12,
  lesson13,
  lesson14,
  lesson15,
  lesson16,
  lesson17,
  lesson18,
]

export const LESSON_MAP: Record<LessonId, Lesson> = Object.fromEntries(
  LESSONS.map((l) => [l.id, l]),
) as Record<LessonId, Lesson>

export function getLesson(id: string): Lesson | undefined {
  return LESSON_MAP[id as LessonId]
}

/** 개념 카드를 id 로 찾는다. 차시를 넘나드는 개념 지도에서 쓴다. */
export function findConcept(lessonId: string, conceptId: string) {
  return getLesson(lessonId)?.keyConcepts.find((c) => c.id === conceptId)
}

export { lesson01 }

import type { LessonId } from '@/content/types'

/**
 * 마지막으로 연 차시 — 강사 홈의 「이어서 할 차시」에 쓴다 (강의자 지시 2026-09-21).
 *
 * 이 브라우저에만 남는 편의 값이다. 다른 기기·다른 사람과 나누지 않고, 없으면 홈이 공개된 차시로 대신한다.
 * 그래서 읽기·쓰기 모두 실패해도 화면은 그대로 돈다 (사생활 보호 모드에서 localStorage 가 던질 수 있다).
 */
const KEY = (classId: string) => `sls.v1.lastTaught.${classId}`

export function lastTaught(classId: string): LessonId | null {
  try {
    return localStorage.getItem(KEY(classId))
  } catch {
    return null
  }
}

export function rememberTaught(classId: string, lessonId: LessonId): void {
  try {
    localStorage.setItem(KEY(classId), lessonId)
  } catch {
    /* 저장하지 못해도 수업은 그대로 진행된다 — 홈이 공개 차시로 대신한다 */
  }
}

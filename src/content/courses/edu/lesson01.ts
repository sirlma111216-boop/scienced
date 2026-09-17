import type { Lesson } from '../../types'
import { lesson as method01 } from '../method/lesson01'

/**
 * 과학교육론 1강 — 교과교수법 1강과 같은 내용이다 (강의자 답 4, 2026-09-17).
 * 두 과목을 같이 듣는 학생은 첫 주에 같은 수업을 두 번 듣게 된다. 강의자가 그렇게 두기로 했다.
 * verify:course 는 1강을 중복 검사의 예외로 둔다.
 */
export const lesson: Lesson = { ...method01, courseId: 'edu' }

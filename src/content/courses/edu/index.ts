import type { Lesson, LessonId, LessonIndexEntry } from '../../types'

/**
 * 과학교육론 12차시 — 색인과 내용 불러오기 (8차 8.2).
 *
 * 1강은 교과교수법 1강과 같다 (강의자 답 4). 2~5강은 80분, 6~12강은 40분.
 */
const idx = (id: LessonId, order: number, layout: 'method' | 'edu80' | 'edu40', title: string, centralQuestion: string, published: boolean, legacyStepIds?: string[]): LessonIndexEntry => ({
  id,
  courseId: 'edu',
  order,
  title,
  centralQuestion,
  layout,
  published,
  ...(legacyStepIds ? { legacyStepIds } : {}),
})

/** 옛 골격(8차 이전)의 단계 id — 교육론 클래스도 옛 18차시 내용을 썼으므로 그 응답을 포트폴리오에서 계속 보인다 */
export const EDU_LEGACY_STEP_IDS = ['step-open', 'step-concepts', 'step-module', 'step-formative', 'step-wrapup']

export const EDU_INDEX: LessonIndexEntry[] = [
  idx('01', 1, 'method', '좋은 과학 수업은 무엇을 남기는가', '과학 수업이 끝났을 때 학생에게 무엇이 남아야 하는가?', true, ['step-recall', 'step-concepts', 'step-compare', 'step-auction', 'step-wrapup']),
]

const loaders: Record<string, () => Promise<{ lesson: Lesson }>> = {
  '01': () => import('./lesson01'),
}

export async function loadEduLesson(id: LessonId): Promise<Lesson | undefined> {
  const load = loaders[id]
  if (!load) return undefined
  return (await load()).lesson
}

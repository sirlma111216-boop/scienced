import type { Lesson, LessonId, LessonIndexEntry } from '../../types'

/**
 * 교과교수법 18차시 — 색인과 내용 불러오기.
 *
 * 색인은 번들 앞에 있고 내용 파일은 import() 로 따로 내려온다.
 * 새 차시를 만들면 색인 한 줄과 아래 loaders 한 줄을 더한다 (verify:course 가 둘을 대조한다).
 */
const idx = (id: LessonId, order: number, title: string, centralQuestion: string, published: boolean, legacyStepIds?: string[]): LessonIndexEntry => ({
  id,
  courseId: 'method',
  order,
  title,
  centralQuestion,
  layout: 'method',
  published,
  ...(legacyStepIds ? { legacyStepIds } : {}),
})

export const METHOD_INDEX: LessonIndexEntry[] = [
  idx('01', 1, '좋은 과학 수업은 무엇을 남기는가', '과학 수업이 끝났을 때 학생에게 무엇이 남아야 하는가?', true, ['step-recall', 'step-concepts', 'step-compare', 'step-auction', 'step-wrapup']),
]

const loaders: Record<string, () => Promise<{ lesson: Lesson }>> = {
  '01': () => import('./lesson01'),
}

export async function loadMethodLesson(id: LessonId): Promise<Lesson | undefined> {
  const load = loaders[id]
  if (!load) return undefined
  return (await load()).lesson
}

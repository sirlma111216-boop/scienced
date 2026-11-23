import type { Lesson, LessonId, LessonIndexEntry } from '../../types'

/**
 * 과학교육론 11차시 — 색인과 내용 불러오기 (8차 8.2).
 *
 * 1강은 교과교수법 1강과 같다 (강의자 답 4). 2~5강은 80분, 6~11강은 40분.
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
  idx('02', 2, 'edu80', '과학지식은 왜 고쳐지고도 믿을 만한가', '과학지식이 바뀔 수 있다면 교사는 무엇을 근거로 그것을 가르쳐야 하는가?', true, EDU_LEGACY_STEP_IDS),
  idx('03', 3, 'edu80', '학생이 이미 가진 생각 위에서 가르치기', '학생이 이미 가진 생각과 혼자서는 못 하는 일을 알면 교사의 처방은 어떻게 달라지는가?', false, EDU_LEGACY_STEP_IDS),
  idx('04', 4, 'edu80', '학생의 생각은 왜 실험 하나로 바뀌지 않는가', '예상이 빗나간 것을 본 학생의 생각을 실제로 바꾸는 것은 무엇인가?', false, EDU_LEGACY_STEP_IDS),
  idx('05', 5, 'edu80', '교육과정 문서는 교사에게 무엇을 맡기는가', '성취기준이 도달점을 정해 놓았을 때 교사가 스스로 정해야 하는 것은 무엇인가?', false, EDU_LEGACY_STEP_IDS),
  idx('06', 6, 'edu40', '과학의 방법은 하나가 아니다', '교과서 실험을 순서대로 따라 한 학생은 탐구를 한 것인가?', false, EDU_LEGACY_STEP_IDS),
  idx('07', 7, 'edu40', '수업 모형의 순서에는 이유가 있다', '수업 시간이 줄어들 때 학생의 탐색·설명·적용을 어떻게 지킬 것인가?', false, EDU_LEGACY_STEP_IDS),
  idx('08', 8, 'edu40', '좋은 비유에는 한계선이 있다', '비유와 모형 때문에 생긴 오해를 학생이 스스로 고치도록 어떻게 도울 것인가?', false, EDU_LEGACY_STEP_IDS),
  idx('09', 9, 'edu40', '모두가 근거를 말하는 모둠 토론', '모둠 토론에서 모든 학생이 자료를 근거로 설명하게 하려면 무엇이 필요한가?', false, EDU_LEGACY_STEP_IDS),
  idx('10', 10, 'edu40', '과학만으로 답이 정해지지 않을 때', '과학 자료와 서로 다른 가치를 함께 고려하는 쟁점 수업을 어떻게 운영할 것인가?', false, EDU_LEGACY_STEP_IDS),
  idx('11', 11, 'edu40', '평가로 확인하고 다음 배움을 돕기', '학생의 탐구를 무엇으로 평가하고, 그 결과를 다음 학습에 어떻게 활용할 것인가?', false, EDU_LEGACY_STEP_IDS),
]

const loaders: Record<string, () => Promise<{ lesson: Lesson }>> = {
  '01': () => import('./lesson01'),
  '02': () => import('./lesson02'),
  '03': () => import('./lesson03'),
  '04': () => import('./lesson04'),
  '05': () => import('./lesson05'),
  '06': () => import('./lesson06'),
  '07': () => import('./lesson07'),
  '08': () => import('./lesson08'),
  '09': () => import('./lesson09'),
  '10': () => import('./lesson10'),
  '11': () => import('./lesson11'),
  // 12강은 차시도 파일도 없다 (강의자 지시 2026-11-23). 옛 12강 응답이 있다면 내용 없이 응답만 남는다.
}

export async function loadEduLesson(id: LessonId): Promise<Lesson | undefined> {
  const load = loaders[id]
  if (!load) return undefined
  return (await load()).lesson
}

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
  idx('02', 2, 'edu80', '과학지식은 왜 고쳐지고도 믿을 만한가', '과학지식이 바뀔 수 있다면 교사는 무엇을 근거로 그것을 가르쳐야 하는가?', true, EDU_LEGACY_STEP_IDS),
  idx('03', 3, 'edu80', '학생이 이미 가진 생각 위에서 가르치기', '학생이 이미 가진 생각과 혼자서는 못 하는 일을 알면 교사의 처방은 어떻게 달라지는가?', false, EDU_LEGACY_STEP_IDS),
  idx('04', 4, 'edu80', '학생의 생각은 왜 실험 하나로 바뀌지 않는가', '예상이 빗나간 것을 본 학생의 생각을 실제로 바꾸는 것은 무엇인가?', false, EDU_LEGACY_STEP_IDS),
  idx('05', 5, 'edu80', '교육과정 문서는 교사에게 무엇을 맡기는가', '성취기준이 도달점을 정해 놓았을 때 교사가 스스로 정해야 하는 것은 무엇인가?', false, EDU_LEGACY_STEP_IDS),
  idx('06', 6, 'edu40', '과학의 방법은 하나가 아니다', '교과서 실험을 순서대로 따라 한 학생은 탐구를 한 것인가?', false, EDU_LEGACY_STEP_IDS),
  idx('07', 7, 'edu40', '수업 모형의 순서에는 이유가 있다', '수업 모형의 한 단계를 빼야 할 때 무엇을 남겨야 하는가?', false, EDU_LEGACY_STEP_IDS),
  idx('08', 8, 'edu40', '좋은 비유에는 한계선이 있다', '학생이 비유를 개념 그 자체로 믿을 때 교사는 무엇을 해야 하는가?', false, EDU_LEGACY_STEP_IDS),
  idx('09', 9, 'edu40', '의견이 논증이 되는 조건', '학생들의 토론이 말싸움으로 끝났을 때 교사는 무엇부터 고쳐야 하는가?', false, EDU_LEGACY_STEP_IDS),
  idx('10', 10, 'edu40', '과학만으로 답이 정해지지 않을 때', '과학으로 답이 정해지지 않는 쟁점에서 과학 교사는 어디까지 가르쳐야 하는가?', false, EDU_LEGACY_STEP_IDS),
  idx('11', 11, 'edu40', '모둠을 만들었다고 협동이 되지는 않는다', '모둠 실험에서 한 명이 다 하고 한 명은 기다릴 때 교사는 무엇을 바꿔야 하는가?', false, EDU_LEGACY_STEP_IDS),
  idx('12', 12, 'edu40', '평가는 점수를 남기는 일이 아니다', '탐구 보고서의 100점을 어디에 두어야 평가가 학생의 배움을 바꾸는가?', false, EDU_LEGACY_STEP_IDS),
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
  '12': () => import('./lesson12'),
}

export async function loadEduLesson(id: LessonId): Promise<Lesson | undefined> {
  const load = loaders[id]
  if (!load) return undefined
  return (await load()).lesson
}

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
  idx('02', 2, '과학지식은 어떻게 만들어지고 믿을 만해지는가', '바뀔 수 있는 과학지식을 왜 지금 믿을 만하다고 할 수 있는가?', true, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('03', 3, '학생은 수업 전에 이미 자기 설명을 가지고 있다', '학생의 틀린 답 뒤에 있는 설명을 교사는 무엇으로 알아내는가?', true, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('04', 4, '학습이론을 수업 언어로 바꾸기', '학생에게 준 도움을 교사는 무엇을 보고 남기거나 거두는가?', true, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('05', 5, '개념변화는 어떻게 일어나는가', '실험 결과가 예상과 달랐는데도 생각을 바꾸지 않는 학생에게 교사는 무엇을 먼저 해야 하는가?', true, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('06', 6, '2022 개정 과학과 교육과정 읽기', '성취기준 한 문장은 수업에서 무엇을 지키고 무엇을 빼라고 말하는가?', true, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('07', 7, '성취기준을 한 차시 수업으로 바꾸기', '성취기준 한 문장을 수업으로 옮길 때 활동보다 먼저 정해야 하는 것은 무엇인가?', true, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('08', 8, '탐구는 실험 순서를 따라 하는 것인가', '무엇이 있어야 한 활동을 탐구라고 부를 수 있는가?', false, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('09', 9, '과학·공학 실행과 모형 기반 탐구', '학생의 모형이 새 자료와 어긋날 때 교사는 무엇을 먼저 하는가?', false, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('10', 10, '교수·학습 모형을 선택하고 변형하기', '수업 조건이 바뀌었을 때 교수·학습 모형에서 무엇을 남기고 무엇을 빼는가?', false, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('11', 11, '설명·비유·모형·표상으로 이해시키기', '비유는 어디까지 쓰고 어디서 멈춰야 하는가?', false, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('12', 12, '질문·토론·과학적 논증', '학생들이 결론만 주고받을 때 교사는 다음 한마디로 무엇을 요구해야 하는가?', false, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('13', 13, 'SSI·기후위기·의사결정', '학생이 「선생님은 어느 쪽이에요」라고 물을 때 교사는 무엇을 먼저 해야 하는가?', false, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('14', 14, '협동적이고 포용적인 과학 교실', '한 학생이 다 하고도 결과가 좋은 모둠에 교사는 무엇을 먼저 넣어야 하는가?', false, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('15', 15, '학습을 움직이는 형성평가', '학생 답의 분포를 본 뒤 교사는 다음 시간을 어디에 얼마나 써야 하는가?', false, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('16', 16, '같은 보고서에 다른 점수가 나올 때', '같은 학생 보고서에 교사마다 다른 점수를 줄 때 무엇을 고쳐야 하는가?', false, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('17', 17, 'AI 가 쓴 답을 학생이 그대로 냈을 때', 'AI 가 만든 설명을 학생이 자기 답으로 냈을 때 교사는 무엇부터 시켜야 하는가?', false, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
  idx('18', 18, '같은 수업을 다시 할 때 무엇부터 고치는가', '학생의 반응을 보고 같은 수업을 다시 할 때 무엇부터 고쳐야 하는가?', false, ['step-open', 'step-concepts', 'step-module', 'step-wrapup']),
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
  '13': () => import('./lesson13'),
  '14': () => import('./lesson14'),
  '15': () => import('./lesson15'),
  '16': () => import('./lesson16'),
  '17': () => import('./lesson17'),
  '18': () => import('./lesson18'),
}

export async function loadMethodLesson(id: LessonId): Promise<Lesson | undefined> {
  const load = loaders[id]
  if (!load) return undefined
  return (await load()).lesson
}

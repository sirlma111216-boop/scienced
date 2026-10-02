import type { CourseId, LessonId, LessonTheory } from '../types'

/**
 * 이론 배경 (5차 작업 M · 8차에서는 정리 단계 끝 「더 읽기」).
 *
 * 과목마다 따로 등록한다 (8.1). 교육론 1강은 교수법 1강과 같으므로 같은 항목을 쓴다.
 * ★ 전부 초안이다. 인명·연도·원어를 원문과 대조한 항목만 verified:true 로 켠다.
 * ★ 교재 심화 읽기에서 복사하지 않는다 — OCR 로 이름이 깨져 있다. 임용 기출은 넣지 않는다.
 *
 * 항목의 linkedConceptId 는 그 차시 개념 카드의 id 와 같아야 한다 (verify:theory).
 *
 * ★ 차시 내용과 마찬가지로 `import()` 로 따로 내려온다 (2026-10-02). 여덟 파일을 정적으로 묶으면
 *   로그인 화면을 여는 학생도 이론 배경 전부(약 190 KB)를 먼저 받는다. 차시를 열 때 그 차시 것만 받는다.
 */
const t01 = () => import('./t01').then((m) => m.t01)

const LOADERS: Record<CourseId, Partial<Record<LessonId, () => Promise<LessonTheory>>>> = {
  method: {
    '01': t01,
    '02': () => import('./t02').then((m) => m.t02),
    '03': () => import('./t03').then((m) => m.t03),
    '04': () => import('./t04').then((m) => m.t04),
    '05': () => import('./t05').then((m) => m.t05),
    '06': () => import('./t06').then((m) => m.t06),
    '07': () => import('./t07').then((m) => m.t07),
  },
  edu: { '01': t01, '02': () => import('./te02').then((m) => m.te02) },
}

/** 이 차시의 이론 배경. 없는 차시는 undefined */
export async function loadTheory(courseId: CourseId, lessonId: LessonId): Promise<LessonTheory | undefined> {
  return LOADERS[courseId]?.[lessonId]?.()
}

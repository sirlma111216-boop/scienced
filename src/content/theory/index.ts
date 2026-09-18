import type { CourseId, LessonId, LessonTheory } from '../types'
import { t01 } from './t01'
import { t02 } from './t02'
import { t03 } from './t03'
import { t04 } from './t04'
import { t05 } from './t05'
import { t06 } from './t06'
import { t07 } from './t07'
import { te02 } from './te02'

/**
 * 이론 배경 (5차 작업 M · 8차에서는 정리 단계 끝 「더 읽기」).
 *
 * 과목마다 따로 등록한다 (8.1). 교육론 1강은 교수법 1강과 같으므로 같은 항목을 쓴다.
 * ★ 전부 초안이다. 인명·연도·원어를 원문과 대조한 항목만 verified:true 로 켠다.
 * ★ 교재 심화 읽기에서 복사하지 않는다 — OCR 로 이름이 깨져 있다. 임용 기출은 넣지 않는다.
 *
 * 항목의 linkedConceptId 는 그 차시 개념 카드의 id 와 같아야 한다 (verify:theory).
 */
export const THEORY: Record<CourseId, Partial<Record<LessonId, LessonTheory>>> = {
  method: { '01': t01, '02': t02, '03': t03, '04': t04, '05': t05, '06': t06, '07': t07 },
  edu: { '01': t01, '02': te02 },
}

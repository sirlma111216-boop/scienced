import type { LessonId, LessonTheory } from '../types'
import { t01 } from './t01'
import { t02 } from './t02'
import { t03 } from './t03'
import { t04 } from './t04'
import { t05 } from './t05'
import { t06 } from './t06'

/**
 * 이론 배경 (5차 지시서 작업 M).
 *
 * 차시마다 「이 차시가 누구의 무슨 이론 위에 서 있는가」를 적는다.
 * 본문은 쉬운 말 그대로 두고, 학술 용어는 여기에만 둔다.
 *
 * ★ 전부 초안이다. 인명·연도·원어를 원문과 대조한 항목만 verified:true 로 켠다.
 *   켜기 전에는 화면에 「확인 중」 배지가 붙는다.
 * ★ 교재 심화 읽기에서 복사하지 않는다 — OCR 로 이름이 깨져 있다 (L.2).
 * ★ 임용 기출·출제 경향은 넣지 않는다 (L.3).
 *
 * 아직 안 쓴 차시는 여기 없다. 화면은 「정리 중」이라고 알린다.
 */
export const THEORY: Partial<Record<LessonId, LessonTheory>> = {
  '01': t01,
  '02': t02,
  '03': t03,
  '04': t04,
  '05': t05,
  '06': t06,
}

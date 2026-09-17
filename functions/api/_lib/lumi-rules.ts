/**
 * 루미 런 — 발표할 등수 (8차 부록 ②).
 *
 * 등수는 번들에 두지 않는다. 학생이 미리 알면 일부러 늦게 들어온다.
 * 강사가 방을 만들 때 티켓과 함께 받고, 게임 서버에 넘긴다. 학생 화면·스냅숏에는 결과 전까지 없다.
 *
 * 열쇠는 `${courseId}:${lessonId}`. 없는 차시는 기본값(1등 하나)이다.
 * 강의자가 정한 것(2026-09-15): 교수법 3강 공중정원 6·9등, 4강 수정동굴 1·3등. 제한 시간 60초, 30초 코스.
 */
export interface LumiRules {
  map: 1 | 2 | 3 | 4 | 5
  ranks: number[]
  timeLimit: number
  course: 30 | 45 | 60 | 90
}

const RULES: Record<string, LumiRules> = {
  'method:03': { map: 2, ranks: [6, 9], timeLimit: 60, course: 30 },
  'method:04': { map: 4, ranks: [1, 3], timeLimit: 60, course: 30 },
}

export const LUMI_DEFAULT_RULES: LumiRules = { map: 1, ranks: [1], timeLimit: 60, course: 30 }

export function lumiRulesFor(courseId: string, lessonId: string): LumiRules {
  return RULES[`${courseId}:${lessonId}`] ?? LUMI_DEFAULT_RULES
}

/** 게임 서버가 받는 규칙 꼴 (gamerun validateRules) */
export function teacherGameRules(r: LumiRules) {
  return { mode: 'ranks' as const, ranks: r.ranks, timeLimit: r.timeLimit, duration: r.course, lives: 0, count: r.ranks.length, text: '이번 발표자' }
}

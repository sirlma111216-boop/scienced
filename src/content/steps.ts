import type { Activity, FieldDef, KeyConcept, Layout, Lesson, LightActivity, Step } from './types'

/**
 * 골격 하나로 세 layout 을 그린다 (8차 4.1 · 4.2 · B-2).
 *
 *   method  도입 · 개념 · 활동 1 · 활동 2 · 정리   (강의자 지시 2026-09-22 — 3시간에 두 차시라 가운데 활동을 더했다)
 *   edu80   도입 · 개념 · 활동 · 개념 2부 · 활동 2 · 정리
 *   edu40   도입 · 개념 · 활동 · 정리
 *
 * 단계마다 시간을 정해 두지 않는다 — 진행 속도는 강의자가 그 자리에서 정한다 (강의자 지시 2026-09-18 · 3차 D).
 *
 * 단계 id 는 고정이다: intro · concepts · activity-1 · activity · concepts-2 · activity-2 · wrapup.
 * 응답은 이 id 아래에 저장된다. 옛 골격(step-open …)과 겹치지 않는다.
 *
 * ★ 교수법의 새 활동 1 은 id 가 `activity-1` 이고, 원래 있던 활동은 id `activity` 그대로 「활동 2」로 불린다.
 *   이미 가르친 차시(1~4강)의 응답이 `activity` 아래에 있으므로 id 를 옮기지 않았다. 이름과 id 가 어긋나 보여도 그대로 둔다.
 */

export const STEP_IDS: Record<Layout, string[]> = {
  method: ['intro', 'concepts', 'activity-1', 'activity', 'wrapup'],
  edu80: ['intro', 'concepts', 'activity', 'concepts-2', 'activity-2', 'wrapup'],
  edu40: ['intro', 'concepts', 'activity', 'wrapup'],
}

/** 정리 칸의 key. 포트폴리오·검사가 같은 이름을 쓴다 */
export const WRAPUP_KEY = 'reflection'
/** 도입 칸의 key */
export const INTRO_KEY = 'choice'

/** 화면에 보이는 단계 이름 — 골격마다 다르다 (교수법의 `activity` 는 「활동 2」) */
export function stepLabel(layout: Layout, stepId: string): string {
  if (stepId === 'activity-1') return '활동 1'
  if (stepId === 'activity') return layout === 'method' ? '활동 2' : layout === 'edu80' ? '활동 1' : '활동'
  const fixed: Record<string, string> = { intro: '도입', concepts: '개념', 'concepts-2': '개념 2부', 'activity-2': '활동 2', wrapup: '정리' }
  return fixed[stepId] ?? stepId
}

export function introFields(lesson: Lesson): FieldDef[] {
  const i = lesson.intro
  if (i.kind === 'line') {
    return [{ key: INTRO_KEY, kind: 'text', label: '내 한 줄', help: i.prompt, required: true, requiresStimulus: [i.stimulus.id] }]
  }
  return [{ key: INTRO_KEY, kind: 'choice', label: '내 선택', help: i.prompt, required: true, options: i.options ?? [], requiresStimulus: [i.stimulus.id] }]
}

function activityStep(id: string, order: number, a: Activity | LightActivity, title: string): Step {
  return {
    id,
    kind: 'activity',
    order,
    title,
    shortTitle: title,
    material: [a.situation],
    fields: a.fields,
    concepts: [],
    activity: a,
  }
}

function conceptStep(id: string, order: number, cs: KeyConcept[], n: 1 | 2): Step {
  return {
    id,
    kind: 'concepts',
    order,
    title: n === 1 ? '개념' : '개념 2부',
    shortTitle: n === 1 ? '개념' : '개념 2부',
    material: [],
    fields: [],
    concepts: cs,
  }
}

export function buildSteps(lesson: Lesson): Step[] {
  const L = lesson.layout
  const steps: Step[] = [
    {
      id: 'intro',
      kind: 'intro',
      order: 1,
      title: '도입',
      shortTitle: '도입',
      material: [lesson.intro.stimulus],
      fields: introFields(lesson),
      concepts: [],
      prompt: lesson.intro.prompt,
    },
    conceptStep('concepts', 2, lesson.concepts, 1),
  ]
  if (L === 'method' && lesson.activity1) steps.push(activityStep('activity-1', steps.length + 1, lesson.activity1, stepLabel(L, 'activity-1')))
  steps.push(activityStep('activity', steps.length + 1, lesson.activity, stepLabel(L, 'activity')))
  if (L === 'edu80') {
    steps.push(conceptStep('concepts-2', steps.length + 1, lesson.concepts2 ?? [], 2))
    if (lesson.activity2) steps.push(activityStep('activity-2', steps.length + 1, lesson.activity2, stepLabel(L, 'activity-2')))
  }
  steps.push({
    id: 'wrapup',
    kind: 'wrapup',
    order: steps.length + 1,
    title: '정리',
    shortTitle: '정리',
    material: [],
    fields: [{ key: WRAPUP_KEY, kind: 'longtext', label: '오늘의 정리', help: lesson.wrapup.prompt, required: true }],
    concepts: [],
    prompt: lesson.wrapup.prompt,
    recap: [...lesson.concepts, ...(lesson.concepts2 ?? [])],
  })
  return steps
}

/** 이 차시의 활동 단계들 (교수법 · edu80 은 둘) */
export function activitySteps(lesson: Lesson): Step[] {
  return buildSteps(lesson).filter((s) => s.kind === 'activity')
}

/** 학생이 쓰는 칸 수 — 3 또는 4 (원칙 1). verify:flow 가 본다 */
export function writingSlots(lesson: Lesson): number {
  return buildSteps(lesson).filter((s) => s.fields.length > 0).length
}

/** 저장 경로를 만들 때 쓴다 — 내용을 불러오지 않고도 단계 id 를 안다 */
export function stepIdsOf(layout: Layout): string[] {
  return STEP_IDS[layout]
}

/** 개념 단계 — 응답 문서에는 잠깐 확인의 답만 있다. 쓰는 칸이 아니므로 제출 현황·포트폴리오가 뺀다 */
export function isConceptStepId(stepId: string): boolean {
  return stepId === 'concepts' || stepId === 'concepts-2'
}

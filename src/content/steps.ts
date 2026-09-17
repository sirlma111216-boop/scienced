import type { Activity, FieldDef, KeyConcept, Layout, Lesson, Step } from './types'

/**
 * 골격 하나로 세 layout 을 그린다 (8차 4.1 · 4.2 · B-2).
 *
 *   method  도입 5 · 개념 15 · 활동 25 · 정리 5                       = 50
 *   edu80   도입 5 · 개념 15 · 활동 20 · 개념 15 · 활동 20 · 정리 5   = 80
 *   edu40   도입 5 · 개념 10 · 활동 20 · 정리 5                       = 40
 *
 * 단계 id 는 고정이다: intro · concepts · activity · concepts-2 · activity-2 · wrapup.
 * 응답은 이 id 아래에 저장된다. 옛 골격(step-open …)과 겹치지 않는다.
 */

export const STEP_IDS: Record<Layout, string[]> = {
  method: ['intro', 'concepts', 'activity', 'wrapup'],
  edu80: ['intro', 'concepts', 'activity', 'concepts-2', 'activity-2', 'wrapup'],
  edu40: ['intro', 'concepts', 'activity', 'wrapup'],
}

export const LAYOUT_MINUTES: Record<Layout, Record<string, number>> = {
  method: { intro: 5, concepts: 15, activity: 25, wrapup: 5 },
  edu80: { intro: 5, concepts: 15, activity: 20, 'concepts-2': 15, 'activity-2': 20, wrapup: 5 },
  edu40: { intro: 5, concepts: 10, activity: 20, wrapup: 5 },
}

/** 정리 칸의 key. 포트폴리오·검사가 같은 이름을 쓴다 */
export const WRAPUP_KEY = 'reflection'
/** 도입 칸의 key */
export const INTRO_KEY = 'choice'

export function introFields(lesson: Lesson): FieldDef[] {
  const i = lesson.intro
  if (i.kind === 'line') {
    return [{ key: INTRO_KEY, kind: 'text', label: i.prompt, required: true, requiresStimulus: [i.stimulus.id] }]
  }
  return [{ key: INTRO_KEY, kind: 'choice', label: i.prompt, required: true, options: i.options ?? [], requiresStimulus: [i.stimulus.id] }]
}

function activityStep(id: string, order: number, minutes: number, a: Activity, n: 1 | 2): Step {
  return {
    id,
    kind: 'activity',
    order,
    title: n === 1 ? '활동' : '활동 2',
    shortTitle: n === 1 ? '활동' : '활동 2',
    minutes,
    material: [a.situation],
    fields: a.fields,
    concepts: [],
    activity: a,
  }
}

function conceptStep(id: string, order: number, minutes: number, cs: KeyConcept[], n: 1 | 2): Step {
  return {
    id,
    kind: 'concepts',
    order,
    title: n === 1 ? '개념' : '개념 2부',
    shortTitle: n === 1 ? '개념' : '개념 2부',
    minutes,
    material: [],
    fields: [],
    concepts: cs,
  }
}

export function buildSteps(lesson: Lesson): Step[] {
  const m = LAYOUT_MINUTES[lesson.layout]
  const steps: Step[] = [
    {
      id: 'intro',
      kind: 'intro',
      order: 1,
      title: '도입',
      shortTitle: '도입',
      minutes: m.intro,
      material: [lesson.intro.stimulus],
      fields: introFields(lesson),
      concepts: [],
    },
    conceptStep('concepts', 2, m.concepts, lesson.concepts, 1),
    activityStep('activity', 3, m.activity, lesson.activity, 1),
  ]
  if (lesson.layout === 'edu80') {
    steps.push(conceptStep('concepts-2', 4, m['concepts-2'], lesson.concepts2 ?? [], 2))
    if (lesson.activity2) steps.push(activityStep('activity-2', 5, m['activity-2'], lesson.activity2, 2))
  }
  steps.push({
    id: 'wrapup',
    kind: 'wrapup',
    order: steps.length + 1,
    title: '정리',
    shortTitle: '정리',
    minutes: m.wrapup,
    material: [],
    fields: [{ key: WRAPUP_KEY, kind: 'longtext', label: lesson.wrapup.prompt, required: true }],
    concepts: [],
    recap: [...lesson.concepts, ...(lesson.concepts2 ?? [])],
  })
  return steps
}

/** 이 차시의 활동 단계들 (edu80 은 둘) */
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

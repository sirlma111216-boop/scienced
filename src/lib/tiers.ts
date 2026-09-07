/**
 * 1시간 판 / 50분 판 (3차 F).
 *
 * 같은 진도를 50분 두 교시로 나가는 반이 있다. 전환 시간을 빼면 한 차시에
 * 실제로 쓸 수 있는 것은 40분 남짓이다. 그래서 차시마다 열 분어치를 흐름에서 뺀다.
 *
 * ★ 빼는 것은 삭제가 아니라 이동이다.
 *   두 반은 같은 강의다. 흐름에서 뺀 블록은 차시 화면 아래 「수업 후 이어서」에 남는다.
 *   그래야 50분 반 학생도 포트폴리오·개념 지도·정리 기록을 똑같이 남긴다.
 *
 * 이 파일은 계산만 한다. React 도 Firestore 도 모른다.
 */
import type { KeyConcept, Lesson, Step, Tier } from '@/content/types'
import type { ClassDoc, LessonState, SessionLength } from '@/lib/types'

/**
 * 덮어쓰기 열쇠.
 *
 * 강사가 이 클래스에서만 핵심/심화 판단을 바꿀 수 있다 (F.6).
 * 열쇠 모양을 한 곳에서 만들어야 저장한 값과 읽는 값이 어긋나지 않는다.
 */
export const tierKey = {
  step: (stepId: string) => `step:${stepId}`,
  field: (stepId: string, fieldKey: string) => `field:${stepId}:${fieldKey}`,
  concept: (conceptId: string) => `concept:${conceptId}`,
  material: (stepId: string, index: number) => `material:${stepId}:${index}`,
}

export type TierOverrides = Record<string, Tier>

/**
 * 기본값은 core 다 (F.3).
 * 태그를 빠뜨린 블록이 조용히 사라지는 사고를 막는다 —
 * 빠뜨린 쪽이 드러나야지, 학생이 못 본 채 지나가면 안 된다.
 */
export function resolveTier(declared: Tier | undefined, key: string, overrides?: TierOverrides): Tier {
  return overrides?.[key] ?? declared ?? 'core'
}

/** 이 판에서 흐름에 나오는가. 1시간 판은 전부 나온다. */
export function inFlow(tier: Tier, length: SessionLength): boolean {
  return length === 'full' || tier === 'core'
}

/* ─────────────────────── 차시 한 벌을 판에 맞춰 자른다 ─────────────────────── */

export interface StepView {
  step: Step
  tier: Tier
  /** 이 단계에서 흐름에 그릴 것들 */
  fields: Step['fields']
  material: NonNullable<Step['material']>
  concepts: KeyConcept[]
  /** 「수업 후 이어서」로 내려간 것들 */
  deferredFields: Step['fields']
  deferredMaterial: NonNullable<Step['material']>
  deferredConcepts: KeyConcept[]
}

export interface LessonView {
  /** 단계 네비게이션과 본문에 나오는 단계 */
  steps: StepView[]
  /**
   * 단계 전체가 심화라 흐름에서 빠진 것.
   * 네비게이션에도 나오지 않는다 (F.3).
   */
  deferredSteps: StepView[]
  /** 「수업 후 이어서」에 그릴 것이 하나라도 있는가 */
  hasDeferred: boolean
}

/**
 * 차시를 판에 맞춰 자른다.
 *
 * @param length      클래스의 강의 길이
 * @param overrides   그 클래스에서만 바꾼 판단 (없으면 교재의 기본 태그를 쓴다)
 */
export function buildLessonView(
  lesson: Lesson,
  length: SessionLength,
  overrides?: TierOverrides,
): LessonView {
  const conceptById = new Map(lesson.keyConcepts.map((c) => [c.id, c]))
  const steps: StepView[] = []
  const deferredSteps: StepView[] = []

  for (const step of lesson.steps) {
    const stepTier = resolveTier(step.tier, tierKey.step(step.id), overrides)
    /*
     * 이 판에서 단계 자체가 흐름에서 빠지는가.
     * 1시간 판에서는 심화 단계도 흐름에 있으므로 여기는 false 다 —
     * 그 구분 없이 stepTier 만 보면 1시간 판에서도 내용이 통째로 내려가 버린다.
     */
    const stepDeferred = !inFlow(stepTier, length)

    const split = <T>(items: T[], keyOf: (item: T, i: number) => string, tierOf: (item: T) => Tier | undefined) => {
      const keep: T[] = []
      const defer: T[] = []
      items.forEach((item, i) => {
        const t = resolveTier(tierOf(item), keyOf(item, i), overrides)
        // 단계가 내려가면 그 안은 따질 것 없이 함께 내려간다
        ;(stepDeferred || !inFlow(t, length) ? defer : keep).push(item)
      })
      return { keep, defer }
    }

    const f = split(
      step.fields,
      (x) => tierKey.field(step.id, x.key),
      (x) => x.tier,
    )
    const m = split(
      step.material ?? [],
      (_, i) => tierKey.material(step.id, i),
      (x) => x.tier,
    )
    const c = split(
      (step.conceptIds ?? []).map((id) => conceptById.get(id)).filter((x): x is KeyConcept => !!x),
      (x) => tierKey.concept(x.id),
      (x) => x.tier,
    )

    const view: StepView = {
      step,
      tier: stepTier,
      fields: f.keep,
      material: m.keep,
      concepts: c.keep,
      deferredFields: f.defer,
      deferredMaterial: m.defer,
      deferredConcepts: c.defer,
    }

    if (stepDeferred) deferredSteps.push(view)
    else steps.push(view)
  }

  const hasDeferred =
    deferredSteps.length > 0 ||
    steps.some(
      (s) => s.deferredFields.length + s.deferredMaterial.length + s.deferredConcepts.length > 0,
    )

  return { steps, deferredSteps, hasDeferred }
}

/* ─────────────────────── 클래스 설정 읽기 ─────────────────────── */

/** 옛 클래스 문서에는 이 필드가 없다. 없으면 1시간 판으로 본다 — 지금까지의 동작 그대로. */
export function classSessionLength(cls: ClassDoc | null | undefined): SessionLength {
  return cls?.sessionLength === 'short' ? 'short' : 'full'
}

/** 기본은 켬. 끄면 50분 판에서 심화 블록이 아예 보이지 않는다 (F.2 ①). */
export function classShowsDeferred(cls: ClassDoc | null | undefined): boolean {
  return cls?.extendedAsHomework !== false
}

export function stateOverrides(state: LessonState | null | undefined): TierOverrides | undefined {
  return state?.tierOverrides
}

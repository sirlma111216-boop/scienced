import { WRAPUP_LABEL } from '../types'
import type { FieldDef, GameId, GroupBuildConfig, ModuleComponent, Step, Stimulus } from '../types'

/**
 * 2~18강 공통 단계 골격 — 8차 A 단계의 과도기 판.
 *
 * 형성평가 단계(1차 → 서로 의견 → 2차 → 재확인)를 뺐다 (8차 A.1).
 * 남은 것은 넷이다.
 *   ① 오늘의 문 + 시작 현상 + 내 생각 먼저   → step-open
 *   ② 개념 카드                              → step-concepts
 *   ③ 핵심 활동 + 발표자 뽑기                 → step-module
 *   ④ 이번 수업 정리                          → step-wrapup
 *
 * 이 파일은 B 단계에서 새 골격(도입·개념·활동·정리, layout 셋)으로 통째로 바뀐다.
 * 그때까지는 옛 차시 파일이 넘기는 spec 을 그대로 받되, 형성평가·판(tier) 관련 값은 읽지 않는다.
 */

export interface StandardSpec {
  phenomenon?: { title: string; body: string }
  openStimuli?: Stimulus[]
  moduleStimuli?: Stimulus[]
  /** 8차 A 이후 읽지 않는다 — 형성평가 단계가 없다 */
  formativeStimuli?: Stimulus[]
  wrapupStimuli?: Stimulus[]
  doNow?: Partial<Record<'open' | 'concepts' | 'module' | 'formative' | 'wrapup', string>>
  splitObservation?: boolean
  predict: { label: string; options: string[]; help?: string; requiresStimulus?: string[] }
  openLead: string
  conceptIds: string[]
  module: {
    title: string
    shortTitle: string
    lead: string
    fields: FieldDef[]
    gameId: GameId
    wallPrompt: string
    component?: ModuleComponent
  }
  /** 8차 A 이후 읽지 않는다 */
  formative?: {
    question: string
    options: string[]
    requiresStimulus?: string[]
    branches: string[]
  }
  wrapupPrompt: string
  minutes: [number, number, number, number, number]
  /** 8차 A 이후 읽지 않는다 — 판이 없다 */
  tiers?: Partial<Record<'open' | 'concepts' | 'module' | 'formative', 'core' | 'extended'>>
  /** 8차 A 이후 읽지 않는다 — 발표자 뽑기는 언제나 핵심 활동 끝에 있다 */
  pickerAt?: 'formative' | 'module'
  moduleGroupBuild?: GroupBuildConfig
}

export function buildStandardSteps(spec: StandardSpec): Step[] {
  const openFields: FieldDef[] = []

  if (spec.splitObservation !== false) {
    openFields.push(
      {
        key: 'observed',
        kind: 'longtext',
        label: '본 것 (관찰)',
        help: '해석을 섞지 말고, 눈으로 확인할 수 있는 것만 적습니다.',
        required: true,
      },
      {
        key: 'interpreted',
        kind: 'longtext',
        label: '그것이 무엇이라고 생각하는지 (해석)',
        required: true,
      },
    )
  }

  openFields.push(
    {
      key: 'predict',
      kind: 'choice',
      requiresStimulus: spec.predict.requiresStimulus,
      label: spec.predict.label,
      help: spec.predict.help,
      required: true,
      options: spec.predict.options,
    },
    {
      key: 'reason',
      kind: 'longtext',
      label: '그렇게 고른 이유',
      required: true,
      sentenceStarters: [
        '자료 ___에서 ___가 보인다. 이는 ___라는 주장과 관련된다',
        '나는 ___ 경험 때문에 이렇게 본다',
      ],
    },
  )

  /* 형성평가에 있던 시간을 핵심 활동에 더한다 — 합계는 그대로 50 */
  const moduleMinutes = spec.minutes[2] + spec.minutes[3]

  return [
    {
      id: 'step-open',
      order: 1,
      type: 'recall',
      title: '오늘의 문 · 내 생각 먼저',
      shortTitle: '내 생각',
      durationMinutes: spec.minutes[0],
      lead: spec.openLead,
      doNow: spec.doNow?.open,
      material:
        spec.openStimuli ??
        (spec.phenomenon
          ? [
              {
                id: 'phenomenon',
                format: 'note' as const,
                title: spec.phenomenon.title,
                body: spec.phenomenon.body,
              },
            ]
          : []),
      fields: openFields,
      aiTasks: [],
      wall: null,
      picker: null,
    },
    {
      id: 'step-concepts',
      order: 2,
      type: 'concepts',
      title: '오늘의 개념 카드',
      shortTitle: '개념 카드',
      durationMinutes: spec.minutes[1],
      lead: '카드를 한 장씩 읽습니다. 쓰는 칸은 없습니다.',
      doNow: spec.doNow?.concepts,
      conceptIds: spec.conceptIds,
      fields: [],
      aiTasks: [],
      wall: null,
      picker: null,
    },
    {
      id: 'step-module',
      order: 3,
      type: 'module',
      title: spec.module.title,
      shortTitle: spec.module.shortTitle,
      durationMinutes: moduleMinutes,
      lead: spec.module.lead,
      doNow: spec.doNow?.module,
      material: spec.moduleStimuli,
      fields: spec.module.fields,
      moduleComponent: spec.module.component,
      groupBuild: spec.moduleGroupBuild,
      aiTasks: [],
      wall: {
        enabled: true,
        prompt: spec.module.wallPrompt,
        anonymous: false,
        opensAfterSubmit: true,
      },
      picker: { enabled: true, gameId: spec.module.gameId, candidateRule: 'all' },
    },
    {
      id: 'step-wrapup',
      order: 4,
      type: 'wrapup',
      title: WRAPUP_LABEL,
      shortTitle: '수업 정리',
      durationMinutes: spec.minutes[4],
      lead: '한 칸만 채우고 마칩니다.',
      doNow: spec.doNow?.wrapup,
      material: spec.wrapupStimuli,
      fields: [{ key: 'artifact', kind: 'longtext', label: spec.wrapupPrompt, required: true }],
      aiTasks: [],
      wall: null,
      picker: null,
    },
  ]
}

/**
 * 강사 대본은 8차에서 어디에도 그리지 않는다. 옛 차시 파일이 아직 이 함수를 부르므로
 * 빈 목록을 돌려준다. 필드와 함께 B 단계에서 지운다.
 */
export function commonScriptLines(): Array<{
  stepId: string
  cue: string
  sayThis: string
  whyNotSkip: string
  watchFor: string
}> {
  return []
}

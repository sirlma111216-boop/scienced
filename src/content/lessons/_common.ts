import type { FieldDef, GameId, ModuleComponent, Step } from '../types'

/**
 * 2~18강 공통 단계 골격.
 *
 * 지시서 8절의 흐름을 다섯 단계로 접었다.
 *   ① 오늘의 문 + ② 시작 현상 + ③ 내 생각 먼저   → step-open   (의견 광장 1)
 *   ⑤ 개념 카드                                  → step-concepts
 *   ⑥ 핵심 활동 + ⑦ 발표자 뽑기                   → step-module (의견 광장 2, 게임)
 *   ⑧ 형성평가                                   → step-formative
 *   ⑨ 퇴실표 + ⑩ 포트폴리오                       → step-exit
 *
 * 의견 광장은 차시마다 최소 두 단계(step-open, step-module)에 붙는다.
 * 게임은 차시마다 하나(step-module)에 붙는다. verify:wall / verify:games 가 확인한다.
 */

export interface StandardSpec {
  /** 시작 현상 · 학생 발화 등 읽을거리 */
  phenomenon: { title: string; body: string }
  /** 관찰/해석 분리 입력을 쓸 것인가 (현상이 관찰 가능한 장면일 때) */
  splitObservation?: boolean
  /** 개인 예측 문항 */
  predict: { label: string; options: string[]; help?: string }
  /** step-open 안내 */
  openLead: string
  /** 개념 카드 id 4개 */
  conceptIds: string[]
  /** 핵심 모듈 */
  module: {
    title: string
    lead: string
    fields: FieldDef[]
    gameId: GameId
    wallPrompt: string
    printable: string
    /** 전용 화면. 없으면 입력 칸만 그린다. */
    component?: ModuleComponent
  }
  /** 형성평가 — 수집 → 해석 → 교사 분기 → 학생 수정 → 재확인 */
  formative: {
    question: string
    options: string[]
    /** 응답 유형별로 교사가 고를 수 있는 다음 행동 */
    branches: string[]
  }
  /** 퇴실표 첫 문항 */
  exitPrompt: string
  /** 시간 배분 (합계 50) */
  minutes: [number, number, number, number, number]
}

const CONFIDENCE: FieldDef = { key: 'confidence', kind: 'confidence', label: '확신도' }

const CHANGE_STARTERS = [
  '나는 처음에 ___라고 생각했으나 ___ 때문에 ___로 수정했다',
  '오늘도 ___는 그대로였다. 왜냐하면 ___이기 때문이다',
]

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
    CONFIDENCE,
  )

  return [
    {
      id: 'step-open',
      order: 1,
      type: 'recall',
      title: '오늘의 문 · 내 생각 먼저',
      durationMinutes: spec.minutes[0],
      lead: spec.openLead,
      material: [{ kind: 'note', title: spec.phenomenon.title, body: spec.phenomenon.body }],
      fields: openFields,
      aiTasks: [],
      wall: {
        enabled: true,
        prompt: '내가 고른 답과 그 이유',
        anonymous: false,
        opensAfterSubmit: true,
      },
      picker: null,
      printableAlternative:
        '활동지 1면: 시작 현상 글 + 관찰/해석 두 칸 + 선택형 + 이유 칸 + 확신도 눈금. ' +
        '분포는 종이를 걷어 칠판에 집계한다.',
    },
    {
      id: 'step-concepts',
      order: 2,
      type: 'concepts',
      title: '오늘의 개념 카드',
      durationMinutes: spec.minutes[1],
      lead:
        '카드 네 장을 한 장씩 엽니다. 쉬운 한 문장에서 시작해 정확한 정의까지 내려갑니다.\n' +
        '카드마다 ‘잠깐 확인’이 있고, 이유를 적어야 제출됩니다.',
      conceptIds: spec.conceptIds,
      fields: [],
      aiTasks: [],
      wall: null,
      picker: null,
      printableAlternative:
        '활동지 2면: 개념 카드 4장의 쉬운 한 문장 · 헷갈리지 말자 · 적용 질문을 인쇄. ' +
        '정확한 정의는 뒷면에 두어 학생이 먼저 자기 말로 써 보게 한다.',
    },
    {
      id: 'step-module',
      order: 3,
      type: 'module',
      title: spec.module.title,
      durationMinutes: spec.minutes[2],
      lead: spec.module.lead,
      fields: spec.module.fields,
      moduleComponent: spec.module.component,
      aiTasks: [],
      wall: {
        enabled: true,
        prompt: spec.module.wallPrompt,
        anonymous: false,
        opensAfterSubmit: true,
      },
      picker: { enabled: true, gameId: spec.module.gameId, candidateRule: 'all' },
      printableAlternative: spec.module.printable,
    },
    {
      id: 'step-formative',
      order: 4,
      type: 'formative',
      title: '형성평가 · 다음 수를 두어라',
      durationMinutes: spec.minutes[3],
      lead:
        '한 문항에 답하고 이유를 적습니다. 분포가 열리면 강사가 다음 행동을 고릅니다.\n' +
        '그 뒤 답을 고쳐도 되고 유지해도 됩니다. 처음 답은 지워지지 않습니다.',
      fields: [
        {
          key: 'answer',
          kind: 'choice',
          label: spec.formative.question,
          required: true,
          options: spec.formative.options,
        },
        {
          key: 'reason',
          kind: 'longtext',
          label: '이유',
          required: true,
          help: '같은 답이라도 이유가 다르면 다음 수업이 달라집니다.',
        },
        CONFIDENCE,
        {
          key: 'revisedAnswer',
          kind: 'choice',
          label: '토론 뒤 다시 고른 답',
          options: spec.formative.options,
        },
        {
          key: 'revisedReason',
          kind: 'longtext',
          label: '무엇을 왜 바꿨는가 / 왜 유지했는가',
          sentenceStarters: CHANGE_STARTERS,
        },
      ],
      aiTasks: ['cluster-responses'],
      wall: null,
      picker: null,
      printableAlternative:
        '활동지 3면: 진단 문항 + 이유 칸 + 확신도, 그 아래 “토론 뒤” 칸을 따로 둔다. ' +
        '첫 답을 지우지 못하도록 칸을 위아래로 분리해 인쇄한다.',
    },
    {
      id: 'step-exit',
      order: 5,
      type: 'exit',
      title: '퇴실표',
      durationMinutes: spec.minutes[4],
      lead: '세 칸만 채우고 마칩니다. 바뀐 생각이 없어도 괜찮습니다.',
      fields: [
        { key: 'artifact', kind: 'longtext', label: spec.exitPrompt, required: true },
        {
          key: 'changed',
          kind: 'longtext',
          label: '오늘 바뀐 생각 한 줄',
          required: true,
          sentenceStarters: CHANGE_STARTERS,
        },
        CONFIDENCE,
      ],
      aiTasks: ['exit-self-check'],
      wall: null,
      picker: null,
      printableAlternative: '활동지 4면(A5 반쪽): 세 칸 퇴실표. 걷어서 다음 차시 도입 익명 인용으로 쓴다.',
    },
  ]
}

/** 강사 대본에서 매번 되풀이되는 두 줄. 단계 id 만 갈아 끼운다. */
export function commonScriptLines(): Array<{
  stepId: string
  cue: string
  sayThis: string
  whyNotSkip: string
  watchFor: string
}> {
  return [
    {
      stepId: 'step-open',
      cue: '분포를 열기 직전에',
      sayThis: '아직 제출하지 않은 분은 지금 제출하세요. 남의 답을 본 뒤에 쓴 답은 여러분 답이 아닙니다.',
      whyNotSkip:
        '제출 전에 분포를 보면 다수 응답에 자기 답을 맞춘다. 컨텍스트 15.2가 금지하는 상황이다.',
      watchFor: '미제출 명단. 제출률이 80% 아래면 분포를 열지 않는다.',
    },
    {
      stepId: 'step-formative',
      cue: '재응답을 열면서',
      sayThis: '바꿔도 되고 그대로 둬도 됩니다. 다만 왜 그렇게 했는지는 반드시 적습니다.',
      whyNotSkip: '바꾸는 것에만 점수를 주면 학생이 이유 없이 바꾼다. 유지도 근거가 있으면 좋은 판단이다.',
      watchFor: '확신도가 높은데 이유가 빈약한 응답. 컨텍스트 19.9의 “높은 확신의 오개념”이다.',
    },
  ]
}

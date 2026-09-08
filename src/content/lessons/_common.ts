import { WRAPUP_LABEL } from '../types'
import type { FieldDef, GameId, ModuleComponent, Step, Stimulus } from '../types'

/**
 * 2~18강 공통 단계 골격.
 *
 * 지시서 8절의 흐름을 다섯 단계로 접었다.
 *   ① 오늘의 문 + ② 시작 현상 + ③ 내 생각 먼저   → step-open   (의견 광장 1)
 *   ⑤ 개념 카드                                  → step-concepts
 *   ⑥ 핵심 활동 + ⑦ 발표자 뽑기                   → step-module (의견 광장 2, 게임)
 *   ⑧ 형성평가                                   → step-formative
 *   ⑨ 이번 수업 정리 + ⑩ 포트폴리오                → step-wrapup
 *
 * 의견 광장은 차시마다 최소 두 단계(step-open, step-module)에 붙는다.
 * 게임은 차시마다 하나(step-module)에 붙는다. verify:wall / verify:games 가 확인한다.
 */

export interface StandardSpec {
  /**
   * 시작 현상 · 학생 발화 등 읽을거리 (4차 이전 형식).
   * openStimuli 를 주면 쓰이지 않는다.
   */
  phenomenon?: { title: string; body: string }
  /**
   * 4차 지시서로 고친 차시가 쓰는 자료 블록 (H.3).
   * 주면 phenomenon 대신 이것이 그려진다. 아직 안 고친 차시는 phenomenon 그대로 간다.
   */
  openStimuli?: Stimulus[]
  moduleStimuli?: Stimulus[]
  formativeStimuli?: Stimulus[]
  wrapupStimuli?: Stimulus[]
  /** 단계별 「지금 할 일」 (H.1 ①). 명령형 한 문장. */
  doNow?: Partial<Record<'open' | 'concepts' | 'module' | 'formative' | 'wrapup', string>>
  /** 관찰/해석 분리 입력을 쓸 것인가 (현상이 관찰 가능한 장면일 때) */
  splitObservation?: boolean
  /** 개인 예측 문항 */
  predict: { label: string; options: string[]; help?: string; requiresStimulus?: string[] }
  /** step-open 안내 */
  openLead: string
  /** 개념 카드 id 4개 */
  conceptIds: string[]
  /** 핵심 모듈 */
  module: {
    title: string
    /** 단계 알약용 짧은 이름. SHORT_TITLE_MAX 자 이하 (verify:lessons 가 본다). */
    shortTitle: string
    lead: string
    fields: FieldDef[]
    gameId: GameId
    wallPrompt: string
    /** 전용 화면. 없으면 입력 칸만 그린다. */
    component?: ModuleComponent
  }
  /** 형성평가 — 수집 → 해석 → 교사 분기 → 학생 수정 → 재확인 */
  formative: {
    question: string
    options: string[]
    /** 이 문항이 가리키는 자료 블록 id */
    requiresStimulus?: string[]
    /** 응답 유형별로 교사가 고를 수 있는 다음 행동 */
    branches: string[]
  }
  /** 「이번 수업 정리」 첫 문항 */
  wrapupPrompt: string
  /** 시간 배분 (합계 50) */
  minutes: [number, number, number, number, number]
}

const CHANGE_STARTERS = [
  '나는 처음에 ___라고 생각했으나 ___ 때문에 ___로 수정했다',
  '이번에도 ___는 그대로였다. 왜냐하면 ___이기 때문이다',
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
      wall: {
        enabled: true,
        prompt: '내가 고른 답과 그 이유',
        anonymous: false,
        opensAfterSubmit: true,
      },
      picker: null,
    },
    {
      id: 'step-concepts',
      order: 2,
      type: 'concepts',
      title: '오늘의 개념 카드',
      shortTitle: '개념 카드',
      durationMinutes: spec.minutes[1],
      lead:
        '카드 네 장을 한 장씩 엽니다. 쉬운 한 문장에서 시작해 정확한 정의까지 내려갑니다.\n' +
        '카드마다 ‘잠깐 확인’이 있고, 이유를 적어야 제출됩니다.',
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
      durationMinutes: spec.minutes[2],
      lead: spec.module.lead,
      doNow: spec.doNow?.module,
      material: spec.moduleStimuli,
      fields: spec.module.fields,
      moduleComponent: spec.module.component,
      aiTasks: [],
      wall: {
        enabled: true,
        prompt: spec.module.wallPrompt,
        anonymous: false,
        opensAfterSubmit: true,
      },
      /*
       * 발표자 뽑기는 형성평가로 내려갔다.
       * 발표는 「1차 답 → 서로 의견 → 2차 답」을 다 거친 뒤에 듣는 것이 맞다.
       * 핵심 모듈에서 뽑으면 아직 생각이 갈리기 전에 발표를 시키게 된다.
       */
      picker: null,
    },
    {
      id: 'step-formative',
      order: 4,
      type: 'formative',
      /*
       * 「다음 수를 두어라」는 강사가 다음 행동을 고르는 단추에서 온 이름이었다.
       * 그 단추가 아무 일도 하지 않아 없앴으므로, 이름도 학생이 하는 일로 되돌린다.
       */
      title: '형성평가 · 다시 고르기',
      shortTitle: '형성평가',
      durationMinutes: spec.minutes[3],
      /* 강사가 할 일은 학생 안내에 넣지 않는다 (4차 H.2). */
      lead:
        '제출하면 공유가 열립니다. 다른 사람 답에 의견을 달고, 남의 의견도 읽습니다.' +
        ' 그다음 다시 고르면 내 글 아래에 이어 붙습니다.',
      doNow: spec.doNow?.formative,
      material: spec.formativeStimuli,
      fields: [
        {
          key: 'answer',
          kind: 'choice',
          requiresStimulus: spec.formative.requiresStimulus,
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
            /*
         * ★ 여는 조건 (4차 H.4).
         *   이 두 칸은 짝 토론이 끝난 뒤에 쓰는 것이다. 조건 없이 열어 두었더니
         *   학생 화면에 같은 질문이 두 번 있는 것으로 보였다. 18차시가 모두 그랬다.
         *   강사가 「짝 토론 시작」을 눌러야 열린다. 그전에는 입력 요소를 그리지 않는다.
         */
        {
          key: 'revisedAnswer',
          kind: 'choice',
          label: '의견을 읽고 다시 고른 답',
          options: spec.formative.options,
          gate: {
            type: 'afterInstructorOpen',
            of: 'secondRound',
            lockedMessage: '공유된 의견을 읽고 나면 열립니다.',
          },
        },
        {
          key: 'revisedReason',
          kind: 'longtext',
          label: '무엇을 왜 바꿨는가 / 왜 유지했는가',
          sentenceStarters: CHANGE_STARTERS,
          gate: {
            type: 'afterInstructorOpen',
            of: 'secondRound',
            lockedMessage: '공유된 의견을 읽고 나면 열립니다.',
          },
        },
      ],
      teacherNextMoves: spec.formative.branches,
      aiTasks: ['cluster-responses'],
      /*
       * 형성평가의 흐름은 넷이다.
       *   ① 고르고 이유를 적어 제출하고 공유한다
       *   ② 공유된 글에 의견을 달고 남의 의견을 읽는다 — 이것이 상호 토론이다
       *   ③ 다시 고르고 이유를 적어 제출하면, 내 글 아래에 이어 붙는다
       *   ④ 발표자 봉투로 두 사람을 뽑아 듣는다
       * 별도의 토론 시간을 두지 않는다. 읽고 다는 것이 토론이다.
       */
      wall: {
        enabled: true,
        prompt: '내가 고른 답과 그 이유, 그리고 다른 사람 답에 대한 의견',
        anonymous: false,
        opensAfterSubmit: true,
      },
      picker: { enabled: true, gameId: spec.module.gameId, candidateRule: 'all' },
    },
    {
      id: 'step-wrapup',
      order: 5,
      type: 'wrapup',
      title: WRAPUP_LABEL,
      /*
       * 50분 판에서는 흐름에서 빠지고 「수업 후 이어서」로 내려간다 (3차 F.5).
       * 이것이 가장 큰 절감이고, 학생이 혼자서도 가장 잘할 수 있는 부분이다.
       * 사라지는 것이 아니다 — 여기서 낸 답도 포트폴리오에 똑같이 쌓인다.
       */
      tier: 'extended',
      shortTitle: '수업 정리',
      durationMinutes: spec.minutes[4],
      lead: '세 칸만 채우고 마칩니다. 바뀐 생각이 없어도 괜찮습니다.',
      doNow: spec.doNow?.wrapup,
      material: spec.wrapupStimuli,
      fields: [
        { key: 'artifact', kind: 'longtext', label: spec.wrapupPrompt, required: true },
        {
          key: 'changed',
          kind: 'longtext',
          label: '이번 수업에서 바뀐 생각 한 줄',
          required: true,
          sentenceStarters: CHANGE_STARTERS,
        },
        /*
         * 확신도를 여기서 뺐다.
         *
         * 확신도가 일하는 자리는 둘뿐이다 —
         *   step-open      예상할 때. 「틀린 답을 5/5로 고른 무리」가 분포에 드러난다.
         *   step-formative 재응답할 때. 「확신은 올랐는데 이유는 그대로」를 잡는다.
         * 정리 단계에서는 비교할 앞이 없어 숫자가 그냥 남기만 한다.
         */
      ],
      aiTasks: ['wrapup-self-check'],
      wall: null,
      picker: null,
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

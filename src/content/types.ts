/**
 * 차시 콘텐츠 타입.
 *
 * 개념 설명은 컨텍스트 문서 1절의 여섯 층 순서를 타입으로 강제한다.
 *   쉬운 한 문장 → 왜 필요한가 → 교실 장면 → 정확한 정의 → 헷갈리기 쉬운 것 → 직접 써 보기
 * 한 층이라도 비면 npm run verify:lessons 가 막는다.
 */

export type LessonId =
  | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09'
  | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18'

export const LESSON_IDS: LessonId[] = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09',
  '10', '11', '12', '13', '14', '15', '16', '17', '18',
]

/**
 * 새 클래스를 만들 때 처음부터 열어 두는 차시.
 *
 * 나머지는 강사가 진도에 맞춰 「차시」 화면에서 연다.
 * 공개 여부는 클래스마다 따로라, 여기를 바꿔도 이미 만든 클래스는 그대로다.
 *
 * 이 목록을 늘리면 그 차시의 개념 카드가 「꼭 알아야 할 것」과 「더 읽기」를
 * 갖추고 있어야 한다 — verify:lessons 가 공개된 차시에만 그것을 요구한다.
 */
export const INITIALLY_OPEN: LessonId[] = ['01', '02']

/** 서버 화이트리스트에 있는 AI 작업만 호출할 수 있다 (지시서 14절). */
export type AiTaskId =
  | 'recall-probe'
  | 'cluster-responses'
  | 'wrapup-self-check'
  | 'ai-audit-source'
  | 'rubric-language-check'

/** 발표자 뽑기 게임 id. 차시별로 하나씩. */
export type GameId = `${LessonId}-${string}`

/** 18종이 서로 달라야 한다 (verify:games). */
export type PickerMode =
  | 'ladder'          // 1강 · 사다리타기 (기존 구현 그대로)
  | 'sealed-envelope' // 2강 · 봉인된 증거 봉투
  | 'card-flip'       // 3강 · 학생 발화 카드 뒤집기
  | 'scaffold-stairs' // 4강 · 비계 계단
  | 'survival'        // 5강 · 설명 생존
  | 'map-pin'         // 6강 · 교육과정 지도 핀
  | 'triple-spinner'  // 7강 · 목표·증거·활동 스피너
  | 'variable-dice'   // 8강 · 변인 주사위
  | 'bracket'         // 9강 · 모형 대진 추첨
  | 'draft-order'     // 10강 · 드래프트 순번
  | 'representation-roulette' // 11강 · 표상 룰렛
  | 'jury-roles'      // 12강 · 배심원 역할 추첨
  | 'stakeholder-lots' // 13강 · 이해당사자 제비
  | 'silent-data'     // 14강 · 침묵 데이터 (가중치 공개)
  | 'by-response-type' // 15강 · 응답 유형별 한 명
  | 'boundary-pair'   // 16강 · 경계 사례 짝
  | 'sentence-audit'  // 17강 · 문장 감사 배정
  | 'reteach-order'   // 18강 · 재수업 순번

/** 후보를 어떻게 고를 것인가. 정답·오답을 기준으로 뽑는 규칙은 없다. */
export type CandidateRule =
  | 'all'             // 응답을 제출한 전원
  | 'byResponseType'  // 응답 유형 묶음마다
  | 'splitOpinion'    // 반응이 갈린 글의 작성자

export interface GameDef {
  id: GameId
  lessonId: LessonId
  mode: PickerMode
  /** 강사 화면 탭 이름 */
  tab: string
  /** 학생 화면 안내 2줄 */
  lead: string
  hint: string
  /** 결과 카드에 다시 보여 줄 응답 필드 */
  choiceField: string
  reasonField: string
  /** 발표자에게 무엇을 말하라고 할 것인가 */
  askLine: string
  /** 강사 화면 결과 아래 문구 */
  presenterAsk: string
  candidateRule: CandidateRule
  /** 발표 횟수가 적은 사람의 확률을 높인다 */
  weightByFewPresentations: boolean
  /** 가중치를 학생 화면에 공개한다 (14강은 그것이 그날의 학습 내용이다) */
  revealWeights: boolean
  winnerCount: number
}

/** 개념 카드 한 장 — 여섯 층을 모두 통과한다. */
export interface KeyConcept {
  id: string
  term: string
  /** ① 쉬운 한 문장 — 전문 용어 없이 */
  plainOneLiner: string
  /** ② 왜 필요한가 — 이 개념이 없으면 교사가 어떤 판단을 놓치는가 */
  whyItMatters: string
  /** ③ 교실 장면 — 중·고등학생의 말과 행동 속에서 */
  classroomScene: string
  /** ④ 정확한 정의 */
  formalDefinition: string
  /** ⑤ 헷갈리지 말자 — 비슷한 개념, 비사례 */
  notToConfuseWith: string[]
  /** ⑥ 직접 써 보기 */
  applyQuestion: string
  /**
   * ★ 꼭 알아야 할 것.
   *
   * 강사가 강조하는 대목이자 학생이 시험 공부에 쓸 알맹이다.
   * 카드의 어느 층을 보고 있든 늘 보인다 — 층을 넘겨야 나오면 아무도 못 본다.
   * 한 줄에 한 가지. 외울 문장이 아니라 판단에 쓰는 기준으로 쓴다.
   */
  mustKnow?: string[]

  /**
   * 더 읽기.
   *
   * 강의에서 말로 하는 것을 글로 남긴다. 학생이 수업 뒤 혼자 읽어도 이어지도록.
   * 여섯 층은 강의 중에 넘기는 화면이고, 이것은 그 뒤에 읽는 본문이다.
   */
  deepDive?: { title: string; body: string }[]

  /** 잠깐 확인 1문항. 선택 + 이유 한 줄. 이유 없이는 제출되지 않는다. */
  check: { prompt: string; options: string[] }
  /**
   * 50분 판에서 이 카드를 흐름에서 빼는가 (3차 F.3).
   * 그 차시의 판단에 꼭 필요한 카드는 빼지 않는다 — verify:tiers 가 최소 2장을 지킨다.
   */
  tier?: Tier
}

/** 강사 대본 한 줄. 발표 모드에서만 보인다. */
export interface ScriptLine {
  stepId: string
  /** 언제 말하는가 */
  cue: string
  /** 이 말은 빼지 않는다 */
  sayThis: string
  /** 왜 빼면 안 되는가 */
  whyNotSkip: string
  /** 학생에게서 무엇을 볼 것인가 */
  watchFor: string
}

export interface TimelineItem {
  minutes: number
  label: string
  stepId: string
}

/** 단계 화면의 종류. 각각 다른 컴포넌트가 그린다. */
export type StepType =
  | 'recall'      // 회상·개인 응답
  | 'concepts'    // 개념 카드 묶음
  | 'compare'     // 4칸 비교
  | 'auction'     // 배분·협상·사다리
  | 'module'      // 차시별 핵심 모듈
  | 'formative'   // 형성평가 (수집→해석→분기→수정→재확인)
  | 'wrapup'      // 이번 수업 정리

/**
 * 마지막 단계의 이름. 화면 문구는 여기 한 곳에서만 정한다.
 *
 * 「퇴실표」였다. 그것은 하루짜리 연수에서 나가는 사람을 붙잡아 한 장 받는 말이다.
 * 같은 학생이 18주를 함께 가는 강의에서 매주 퇴실할 일은 없다.
 */
export const WRAPUP_LABEL = '이번 수업 정리'

/**
 * 블록이 어느 판에 나오는가 (3차 F.3).
 *   core     — 두 판 모두 강의 흐름에 나온다
 *   extended — 1시간 판에서만 흐름에 나온다. 50분 판에서는 「수업 후 이어서」로 내려간다
 *
 * 기본값은 core 다. 태그를 빠뜨린 블록이 조용히 사라지는 사고를 막는다 —
 * 빠뜨린 쪽이 벌을 받아야지, 학생이 못 본 채로 지나가면 안 된다.
 */
export type Tier = 'core' | 'extended'

/** 「수업 후 이어서」 영역의 이름. 화면 문구는 여기 한 곳에서만 정한다. */
export const AFTER_CLASS_LABEL = '수업 후 이어서'

/**
 * 자료 블록의 형식 (4차 H.3).
 *
 * 활동에는 학생이 붙들고 판단할 실물이 있어야 한다.
 * 「받습니다」라고 적어 놓고 받을 것이 없으면 그것은 활동이 아니다.
 *
 * 「note」는 4차 지시서 이전의 상황 소개 글이다. 아직 고치지 않은 차시가 쓰고 있고,
 * verify:stimulus 가 공개된 차시에 몇 개 남았는지 센다.
 */
export type StimulusFormat =
  | 'article'     // 기사
  | 'dialogue'    // 교사·학생 발화가 섞인 대본
  | 'studentWork' // 학생 답안·보고서·산출물
  | 'image'       // 그림 — imageSpec 없이 저장할 수 없다 (J.1)
  | 'dataTable'   // 측정값 표
  | 'card'        // 증거 카드·상황 카드
  | 'video'
  | 'standard'    // 성취기준
  | 'note'

/**
 * 그림 제작 명세 (4차 J.1).
 *
 * 그림이 있어야 성립하는 활동인데 「그림을 보자」라고만 적으면 만들 수 없고,
 * 만들어도 무엇을 그려야 맞는지 알 수 없다. 그래서 그림마다 이것을 붙인다.
 *
 * ★ 그림 안에 한국어 글자를 넣지 않는다 (J.2). 라벨은 앱이 겹쳐 그린다 —
 *   확대·화면 낭독·번역이 함께 풀린다.
 */
export interface ImageSpec {
  /** 이 그림이 없으면 학생이 무엇을 못 하는가 — 한 문장 */
  purpose: string
  mustShow: string[]
  /** 보이면 안 되는 것. 주로 정답 노출 */
  mustNotShow: string[]
  /**
   * 앱이 그림 위에 겹쳐 그리는 한국어 라벨 (J.2 ①).
   *
   * 그림 안에 글자를 넣지 않는다 — 생성 도구가 한국어를 못 쓰고,
   * 박힌 글자는 확대·낭독·번역에서 빠진다. 그래서 앱이 얹는다.
   *
   * x·y 는 그림 왼쪽 위를 0,0 으로 한 백분율이다. 주면 그 자리에 얹고,
   * 없으면 그림 아래에 늘어놓는다 — 아래에만 두면 어느 줄이 A인지 알 수 없다.
   */
  labels: Array<{ text: string; position: string; x?: number; y?: number }>
  legend?: string
  /** 이미지 생성 도구에 그대로 넣을 영문 문장 */
  genPrompt: string
  /** 그림을 보지 않고도 같은 판단을 할 수 있을 만큼의 설명 */
  altText: string
  /** 모형 그림일 때 — 실제와 다른 점 */
  differsFromReality?: string
  /** 그림 없이 진행하는 대안 */
  fallback: string
  license: '직접 제작' | '공개 라이선스' | '촬영 필요'
  /**
   * 그림 파일 경로 (public/ 아래).
   *
   * ★ 앱이 그림을 그리지 않는다. genPrompt 로 강의자가 만든 파일을 여기에 둔다.
   *   도형으로 흉내 낸 그림은 생성 도구의 결과보다 못하다.
   * 아직 파일이 없으면 비워 둔다 — 화면은 fallback 과 altText 를 대신 그린다.
   */
  src?: string
}

/**
 * 블록을 여는 조건 (4차 H.4).
 *
 * 「토론 뒤」 「새 증거 뒤」로 시작하는 칸이 그 일이 일어나기 전부터 열려 있으면
 * 학생에게는 같은 질문이 두 번 있는 것으로 보인다.
 *
 * 잠긴 블록은 입력 요소를 화면에 아예 그리지 않는다. 회색 카드와 여는 조건만 남는다.
 */
export interface Gate {
  type: 'afterSubmit' | 'afterReveal' | 'afterInstructorOpen'
  /** afterReveal 이면 공개할 자료 블록 id */
  of: string
  /** 잠긴 카드에 적는 여는 조건 */
  lockedMessage: string
}

/** 읽을 것·볼 것의 실물. 없으면 활동을 만들지 않는다 (4차 H.1 ②). */
export interface Stimulus {
  id: string
  format: StimulusFormat
  title: string
  /** 「수업용으로 만든 가상 자료」 같은 꼬리표 (H.5) */
  label?: string
  source?: string
  body: string
  /** dataTable 전용 */
  table?: { head: string[]; rows: string[][] }
  /** image 전용. format 이 image 면 반드시 있어야 한다 (verify:figures) */
  imageSpec?: ImageSpec
  /** 강사가 공개해야 열리는 자료 */
  gate?: Gate
  /** 자료는 언제나 core 다 (H.3). 50분 판에서도 빠지지 않는다. */
  tier?: Tier
}

export interface WallConfig {
  enabled: boolean
  prompt: string
  anonymous: boolean
  /** 본인이 이 단계 응답을 제출한 뒤에만 열린다 (컨텍스트 15.2) */
  opensAfterSubmit: boolean
}

export interface PickerConfig {
  enabled: boolean
  gameId: GameId
  candidateRule: CandidateRule
}

/** 입력 한 칸의 정의. ResponseCollector 가 이걸 보고 화면을 만든다. */
/*
 * 확신도를 뺐다.
 *
 * 「지금 얼마나 확신하는가」를 1~5로 받아 두었다. 처음에는 「틀린 답을 5로 고른 무리」가
 * 분포에 드러날 것이라고 봤지만, 실제로는 한 자리에서 몇 분 사이에 눈금만 움직이는 칸이었다.
 * 판단이 바뀐 이유는 이유 칸이 이미 받고 있다. 숫자는 그 위에 아무것도 얹지 못했다.
 */
export type FieldKind = 'text' | 'longtext' | 'choice' | 'multi' | 'allocation' | 'quadrant' | 'rank'

export interface FieldDef {
  key: string
  kind: FieldKind
  label: string
  help?: string
  placeholder?: string
  required?: boolean
  options?: string[]
  /** allocation 전용: 총합을 강제한다 */
  total?: number
  /**
   * 이 입력이 가리키는 자료 블록 id (4차 H.3).
   * 여기 적힌 자료가 같은 단계에 없으면 학생 화면에 그리지 않고 강사에게만 경고한다.
   */
  requiresStimulus?: string[]
  /** 이 칸을 여는 조건. 잠겨 있으면 입력 요소를 그리지 않는다. */
  gate?: Gate
  /** allocation / rank 전용: 카드 목록 */
  items?: Array<{ id: string; label: string; note?: string }>
  /** quadrant 전용 */
  quadrants?: Array<{ id: string; label: string }>
  /** 문장 틀 버튼 (컨텍스트 17.3). 강제하지 않는다. */
  sentenceStarters?: string[]
  /** 50분 판에서 흐름을 빼고 「수업 후 이어서」로 내릴 칸. 없으면 core (3차 F.3). */
  tier?: Tier
}

/**
 * 차시별 핵심 모듈의 전용 화면.
 *
 * 일반 입력 칸(fields)만으로는 안 되는 활동에 붙인다.
 * 붙이면 fields 위에 전용 화면이 먼저 그려지고, 결과는 같은 응답 버전에 함께 저장된다.
 */
export type ModuleComponent =
  | 'nodeCanvas'      // 모형 캔버스 · 논증 지도 (9·12강)
  | 'dataStudio'      // 실험 설계 샌드박스 · 표－그래프－주장 (8강)
  | 'cardSorter'      // 정렬·순위·배분 (11·13강)
  | 'rubricStudio'    // 루브릭 스튜디오 (16강)
  | 'aiAuditBoard'    // AI 응답 검증 보드 (17강)
  | 'videoAnnotator'  // 마이크로티칭 주석 (18강)
  | 'curriculumMap'   // 교육과정 맵 (6강)

/**
 * 단계 알약에 들어갈 짧은 이름의 최대 길이.
 *
 * 폭 375px 화면에서 단계 여섯 개가 가로 스크롤 없이 들어가야 한다.
 * 한 알약에 쓸 수 있는 글자 폭이 두 줄 합쳐 여덟 자 남짓이다.
 * 이보다 길면 넘치는 것이 아니라 말줄임으로 잘려 무슨 단계인지 알 수 없게 된다.
 * verify:lessons 가 열여덟 차시의 모든 단계에서 이 길이를 확인한다.
 */
export const SHORT_TITLE_MAX = 8

/**
 * 즉석 모둠 만들기.
 *
 * 강사가 명단을 짜지 않는다. 옆에 앉은 사람끼리 "우리가 몇 모둠" 하고 정해
 * 같은 번호를 고르면 그것이 모둠이다. 고르는 순간 같은 번호를 고른 사람들의
 * 평균 배분과 각자가 쓴 문장이 한자리에 모인다.
 *
 * 붙이면 본인이 제출을 마친 뒤에만 열린다. 남의 배분을 먼저 보고 자기 것을 정하면
 * 갈림이 사라지고, 갈림을 보는 것이 이런 활동의 목적이다.
 */
export interface GroupBuildConfig {
  /** 평균을 낼 배분 칸의 key. 그 칸의 items 가 요소 목록이 된다. */
  allocationKey: string
  /** 모둠원에게 모아 보여 줄 개인 의견 칸의 key */
  opinionKey: string
  /** 고를 수 있는 모둠 번호 개수 */
  groupCount: number
  /** 모둠 대표가 올리는 한 문장 */
  agreedLabel: string
  agreedHelp: string
  agreedStarters: string[]
}

export interface Step {
  id: string
  order: number
  type: StepType
  title: string
  /** 단계 알약에 쓰는 짧은 이름. SHORT_TITLE_MAX 자 이하. */
  shortTitle: string
  durationMinutes: number
  /** 학생 화면 안내 */
  lead: string
  fields: FieldDef[]
  /** 전용 모듈 화면. 없으면 fields 만 그린다. */
  moduleComponent?: ModuleComponent
  /** 즉석 모둠 만들기. 제출 뒤 의견 광장 앞에 그려진다. */
  groupBuild?: GroupBuildConfig
  /** 이 단계에서 쓰는 개념 카드 id (type === 'concepts') */
  conceptIds?: string[]
  /**
   * 지금 할 일 — 명령형 한 문장 (4차 H.1 ①).
   * 학생이 지금 손으로 할 행동만 적는다. 미래형·수동형을 쓰지 않는다.
   */
  doNow?: string
  /** 이 단계에서 쓰는 자료. 읽을 것·볼 것의 실물이다. */
  material?: Stimulus[]
  aiTasks: AiTaskId[]
  wall: WallConfig | null
  picker: PickerConfig | null
  /*
   * 인쇄 활동지를 뺐다.
   *
   * 기기 없이 같은 활동을 하는 법을 단계마다 적어 두었는데, 실제 수업에서
   * 아무도 펴 보지 않았다. 학생은 각자 기기로 들어오고, 종이가 필요한 날은
   * 활동 자체를 다르게 짠다. 화면에서 자리만 먹던 자리다.
   */
  /**
   * 단계 전체를 50분 판에서 빼는가 (3차 F.3).
   * extended 이면 50분 판의 단계 네비게이션에도 나오지 않고 「수업 후 이어서」로 내려간다.
   * 없으면 core.
   */
  tier?: Tier
}

export interface Lesson {
  id: LessonId
  order: number
  title: string
  centralQuestion: string
  studentVoice: string
  firstSentence: string
  guide: string
  objectives: string[]
  keyConcepts: KeyConcept[]
  fieldCase: string
  flowSummary: string
  /** 2022 개정 교육과정 연결. 원문 대조 전에는 대표 예시 라벨을 붙인다. */
  curriculumLink: { label: string; text: string; verified: boolean }
  /** 차시별 핵심 모듈 이름 (지시서 12절) */
  moduleName: string
  instructorScript: ScriptLine[]
  timeline: TimelineItem[]
  steps: Step[]
  /** 시드 상태에서 1강만 true (지시서 13절) */
  published: boolean
}

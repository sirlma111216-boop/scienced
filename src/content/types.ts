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
  /** 잠깐 확인 1문항. 선택 + 이유 한 줄. 이유 없이는 제출되지 않는다. */
  check: { prompt: string; options: string[] }
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
export type FieldKind = 'text' | 'longtext' | 'choice' | 'multi' | 'confidence' | 'allocation' | 'quadrant' | 'rank'

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
  /** allocation / rank 전용: 카드 목록 */
  items?: Array<{ id: string; label: string; note?: string }>
  /** quadrant 전용 */
  quadrants?: Array<{ id: string; label: string }>
  /** 문장 틀 버튼 (컨텍스트 17.3). 강제하지 않는다. */
  sentenceStarters?: string[]
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
  /** 이 단계에서 쓰는 개념 카드 id (type === 'concepts') */
  conceptIds?: string[]
  /** 이 단계에서 쓰는 읽기 자료 */
  material?: { kind: 'transcript' | 'note'; title: string; body: string }[]
  aiTasks: AiTaskId[]
  wall: WallConfig | null
  picker: PickerConfig | null
  /** 인쇄 활동지에 실을 같은 목표의 오프라인 대안 (지시서 15절) */
  printableAlternative: string
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

/**
 * 차시 콘텐츠 타입 — 8차 골격 (지시서 4절).
 *
 * 한 차시는 도입 → 개념 → 활동 → 정리 넷이다. 80분 차시(교육론 2~5강)는 개념·활동이 두 벌이다.
 * 차시 파일은 단계 배열을 직접 쓰지 않는다 — `buildSteps(lesson)` 가 layout 에서 만든다.
 * 학생이 쓰는 칸은 도입 하나, 활동 하나(80분은 둘), 정리 하나뿐이다 (원칙 1).
 */

export type CourseId = 'method' | 'edu'

/** 두 자리 차시 번호. 과목마다 따로 센다 — 클래스가 과목을 알기 때문에 겹치지 않는다. */
export type LessonId = string

/** 차시 골격. 4.1 · 4.2 */
export type Layout = 'method' | 'edu80' | 'edu40'

/** 발표자 선정 게임 종류 (6절). 라이브러리는 games.ts 에 있다. */
export type GameKind =
  | 'bomb' // 폭탄 돌리기
  | 'closest' // 숫자 가까이
  | 'doors' // 문 세 개
  | 'mine' // 지뢰 한 칸
  | 'late' // 늦게 눌러라
  | 'rps' // 가위바위보 토너먼트
  | 'sync' // 동시에 눌러라 (모둠)
  | 'sum' // 비밀 합 (모둠)
  | 'relay' // 릴레이 단어 (모둠)
  | 'bingo' // 빙고
  | 'estimate' // 추정
  | 'flash' // 순간 포착
  | 'lumi' // 루미 런 (별도 게임, iframe)
  | 'marble' // 교실 구슬 레이스 (별도 게임, iframe · 서버 없이 강사 화면에서)
  | 'ladder' // 1강 사다리 — 유지
  | 'envelope' // 2강 발표자 선정 봉투 — 유지

/** 서버 화이트리스트에 있는 AI 작업만 호출할 수 있다. */
export type AiTaskId =
  | 'recall-probe'
  | 'cluster-responses'
  | 'wrapup-self-check'
  | 'ai-audit-source'
  | 'rubric-language-check'

/* ─────────────────────────── 자료 ─────────────────────────── */

export type StimulusFormat =
  | 'article' // 기사
  | 'dialogue' // 교사·학생 발화가 섞인 대본
  | 'studentWork' // 학생 답안·보고서·산출물
  | 'image' // 그림 — imageSpec 없이 저장할 수 없다
  | 'dataTable' // 측정값 표
  | 'card' // 상황 카드
  | 'video'
  | 'standard' // 성취기준
  | 'note'

/**
 * 그림 제작 명세 (4차 J.1). 그림은 앱이 그리지 않는다 — genPrompt 로 강의자가 만든다.
 * 그림 안에 한국어 글자를 넣지 않는다. 라벨은 앱이 겹쳐 그린다.
 */
export interface ImageSpec {
  purpose: string
  mustShow: string[]
  mustNotShow: string[]
  labels: Array<{ text: string; position: string; x?: number; y?: number }>
  legend?: string
  genPrompt: string
  altText: string
  differsFromReality?: string
  fallback: string
  license: '직접 제작' | '공개 라이선스' | '촬영 필요'
  src?: string
}

/** 블록을 여는 조건. 잠긴 블록은 입력 요소를 아예 그리지 않는다. */
export interface Gate {
  type: 'afterSubmit' | 'afterReveal'
  /** afterReveal 이면 공개할 자료 블록 id */
  of: string
  lockedMessage: string
}

/** 읽을 것·볼 것의 실물. 200~400자. 없으면 활동을 만들지 않는다. */
export interface Stimulus {
  id: string
  format: StimulusFormat
  title: string
  /** 「수업용으로 만든 가상 자료」 같은 꼬리표 */
  label?: string
  source?: string
  body: string
  table?: { head: string[]; rows: string[][] }
  imageSpec?: ImageSpec
  /** 강사가 공개해야 열리는 자료 */
  gate?: Gate
}

/* ─────────────────────────── 입력 칸 ─────────────────────────── */

export type FieldKind = 'text' | 'longtext' | 'choice' | 'multi' | 'allocation' | 'quadrant' | 'rank' | 'sort'

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
  requiresStimulus?: string[]
  gate?: Gate
  /** allocation / rank / sort 전용: 카드 목록 */
  items?: Array<{ id: string; label: string; note?: string }>
  /** sort 전용: 두 통 */
  bins?: Array<{ id: string; label: string }>
  quadrants?: Array<{ id: string; label: string; hint?: string }>
  sentenceStarters?: string[]
}

/* ─────────────────────────── 개념 카드 (4.4) ─────────────────────────── */

/**
 * 잠깐 확인 — 카드 아래 4지선다 하나 (강의자 지시 2026-09-18). 이유 칸은 없다.
 *
 * 카드의 기준을 장면에 써야 풀리는 물음이다. 정의를 되묻지 않는다.
 * 보기 넷은 길이가 비슷해야 한다 — 긴 보기가 답이 되는 버릇을 만들지 않는다. verify:concepts 가 센다.
 */
export interface ConceptCheck {
  /** 물음. 장면이나 진술을 주고 판단을 묻는다. 물음표로 끝난다 */
  prompt: string
  /** 보기 넷 */
  options: [string, string, string, string]
  /** 정답 보기의 자리 0~3 */
  answer: 0 | 1 | 2 | 3
}

/** 카드 하나는 화면 한 장이다. 넘길 층이 없다. */
export interface KeyConcept {
  id: string
  /** 개념 이름. 학술 용어여도 된다 */
  name: string
  /** 문단 1 — 이것이 무엇인가. 3~4문장. 정의를 문장으로 풀어 쓴다 */
  what: string
  /** 문단 2 — 이것이 없으면 교실에서 무엇이 잘못되는가. 2~3문장 */
  why: string
  /** 문단 3 — 구체적 장면 하나. 학생 발화나 교사 행동 그대로. 3~4문장 */
  inClass: string
  /**
   * 판단 기준 3줄. 한 줄은 완전한 문장이고 판단에 쓰는 기준이다.
   * 「~이 아니라 ~다」 「~이면 ~다」 「~를 보면 ~를 알 수 있다」 꼴. 명사 나열 금지. verify:concepts 가 본다.
   */
  keyPoints: [string, string, string]
  /** 흔히 섞어 쓰는 것과의 차이. 한두 문장. 필요할 때만 */
  confusedWith?: string
  /** 잠깐 확인 — 카드마다 하나. 검토 문서의 「확인」 블록에서 sync:checks 가 옮긴다 */
  check: ConceptCheck
  /** 수업 뒤에 읽는 글 한 편. 접혀 있다 */
  more?: { title: string; body: string }
}

/* ─────────────────────────── 활동 — 다섯 단 (4.5) ─────────────────────────── */

/**
 * 모둠 데이터 (4.6). 모둠원이 활동 칸(fieldKey)에 낸 것이 모둠 하나의 값으로 모인다.
 *   allocation  요소에 100점 → 모둠 평균 → 막대
 *   rank        순위 → 순위 합산 → 순위표
 *   vote        선택 하나 + 이유 → 모둠 분포 + 대표가 고른 이유 하나
 *   sentence    각자 쓴 것을 모둠에서 읽고 대표가 한 문장
 *   sort        카드를 두 통에 → 통마다 카드 수 → 갈린 카드
 */
export type GroupFormat = 'allocation' | 'rank' | 'vote' | 'sentence' | 'sort'

export interface GroupData {
  format: GroupFormat
  /** 활동 칸 중 모둠 값으로 모을 칸. 형식과 칸 종류가 맞아야 한다 (verify:flow) */
  fieldKey: string
  /** vote 전용 — 대표가 고를 이유 칸 */
  reasonKey?: string
  /** 모둠 화면 안내 한 줄 */
  prompt: string
  /** sentence · vote 전용 — 대표에게 하는 말 */
  repPrompt?: string
}

/** 활동을 시드에 넣기 전에 통과해야 하는 네 검사. 검토 문서와 같은 문장이어야 한다 (audit:draft) */
export interface ActivityChecks {
  /** 정답 검사 — 강의자가 이 활동의 정답을 한 문장으로 말할 수 있는가. 없어야 한다 */
  answer: string
  /** 갈림 검사 — 선택지마다 그것을 고를 만한 이유 */
  split: string
  /** 이해 검사 — 30초 안에 무엇을 써야 하는지 아는가 */
  understand: string
  /** 상황 검사 — 과학교사가 실제로 맞닥뜨리는 장면인가 */
  situation: string
}

export interface Activity {
  /** 교실 장면. 200~400자 */
  situation: Stimulus
  /** 과제문. 명령형 한 문장 */
  task: string
  /** 1~2개. 선택+이유 또는 서술 하나 */
  fields: FieldDef[]
  /** 광장 안내 한 줄 */
  share: { prompt: string }
  group: GroupData
  game: GameKind
  /** 게임별 옵션 — 승자 규칙 등. 라이브러리가 정한 것만 */
  gameOptions?: Record<string, unknown>
  checks: ActivityChecks
}

/* ─────────────────────────── 도입 · 정리 ─────────────────────────── */

export interface Intro {
  stimulus: Stimulus
  prompt: string
  /** 선택 하나 또는 한 줄 */
  kind: 'choice' | 'line'
  options?: string[]
}

/** 칸 하나. 꼴은 정해져 있다 — 근거가 된 개념과, 그 개념이 없었다면 달리 했을 것 */
export interface Wrapup {
  prompt: string
}

/* ─────────────────────────── 이론 배경 (5차) — 정리 끝 「더 읽기」 ─────────────────────────── */

export interface TheoryScholar {
  nameKo: string
  nameEn: string
  year?: string
}

export interface TheoryQuote {
  original: string
  ko: string
  source: string
}

export interface TheoryEntry {
  id: string
  termKo: string
  termEn: string
  scholars: TheoryScholar[]
  claim: string
  bridgeToPlain: string
  limits: string
  textbookRef: string
  readings: Array<{ title: string; url?: string }>
  quotes?: TheoryQuote[]
  figure?: ImageSpec
  linkedConceptId?: string
  plainTerms?: string[]
  oneLine: string
  verified: boolean
}

export interface LessonTheory {
  summary: string
  entries: TheoryEntry[]
}

/* ─────────────────────────── 차시 (4.3) ─────────────────────────── */

export interface Lesson {
  id: LessonId
  courseId: CourseId
  order: number
  title: string
  /** 물음표로 끝나는 한 문장. 활동에서 실제로 이 질문에 답하게 된다 */
  centralQuestion: string
  /** 「~를 구분한다」 「~를 고른다」 꼴. 「이해한다」 「안다」 금지 */
  objectives: [string, string, string]
  layout: Layout
  intro: Intro
  /** 교수법 3~4장 · 교육론 80분 각 부 3~4장 · 40분 2~3장 */
  concepts: KeyConcept[]
  /** edu80 전용 — 개념 2부 */
  concepts2?: KeyConcept[]
  activity: Activity
  /** edu80 전용 — 활동 2 */
  activity2?: Activity
  wrapup: Wrapup
  /** 정리 단계 끝 「더 읽기」에서만 그린다 */
  theory?: LessonTheory
  published: boolean
  /** 옛 골격의 단계 id — 이미 낸 응답을 포트폴리오에서 계속 보이려고 (1·2강) */
  legacyStepIds?: string[]
}

/** 차시 색인 — 내용 없이 목록을 그리는 데 쓴다. 미공개 차시의 내용은 번들에서 따로 내려온다 */
export interface LessonIndexEntry {
  id: LessonId
  courseId: CourseId
  order: number
  title: string
  centralQuestion: string
  layout: Layout
  published: boolean
  /** 옛 골격의 단계 id — 포트폴리오·제출 현황이 내용을 불러오지 않고도 옛 응답 경로를 안다 */
  legacyStepIds?: string[]
}

/* ─────────────────────────── 단계 (buildSteps 가 만든다) ─────────────────────────── */

export type StepKind = 'intro' | 'concepts' | 'activity' | 'wrapup'

export interface Step {
  id: string
  kind: StepKind
  order: number
  title: string
  /** 단계 알약에 쓰는 짧은 이름 */
  shortTitle: string
  material: Stimulus[]
  fields: FieldDef[]
  concepts: KeyConcept[]
  /** 활동 단계면 그 활동 */
  activity?: Activity
  /** 정리 단계면 다시 보일 기준들 */
  recap?: KeyConcept[]
}

/** 새 클래스를 만들 때 처음부터 열어 두는 차시 — 과목마다 */
export const INITIALLY_OPEN: Record<CourseId, LessonId[]> = {
  method: ['01', '02', '03', '04', '05', '06', '07'],
  edu: ['01', '02'],
}

/** 단계 알약 짧은 이름의 최대 길이 (375px 에서 넷이 한 줄) */
export const SHORT_TITLE_MAX = 8

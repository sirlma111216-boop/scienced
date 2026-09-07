import type { Affiliation } from '@/content/classes'
import type { GameId, LessonId, Tier } from '@/content/types'

/** 저장 계층이 주고받는 타입. Firestore 구현과 로컬 구현이 이 모양을 공유한다. */

export type Role = 'instructor' | 'student'

/* ─────────────────────────── 수강 클래스 ─────────────────────────── */

export type ClassStatus = 'active' | 'archived'

/**
 * 학기별 수강 클래스.
 *
 * 모든 학생 자료는 이 문서의 하위 컬렉션 안에서만 움직인다.
 * 다른 클래스의 자료는 어떤 경로로도 읽히지 않아야 한다 (firestore.rules 참고).
 */
/**
 * 한 차시를 얼마나 길게 도는가.
 *   full  — 1시간 강의. 모든 블록을 수업 안에서 한다.
 *   short — 50분 강의. 전환 시간을 빼면 실제로 쓸 수 있는 것은 40분 남짓이라
 *           심화 블록을 흐름에서 빼고 「수업 후 이어서」로 내린다.
 *
 * 두 반은 같은 강의다. 빼는 것은 삭제가 아니라 이동이다 (3차 F.2 ①).
 */
export type SessionLength = 'full' | 'short'

export interface ClassDoc {
  id: string
  ownerUid: string
  /**
   * 강의 제목. 같은 학기에 「과학교육론」과 「과학교과교수법」을 함께 열 수 있어
   * 클래스를 구분하는 핵심 값이다.
   */
  courseTitle: string
  affiliation: Affiliation
  year: number
  term: string
  days: string[]
  startTime: string
  endTime: string
  credits: number
  /** 만든 뒤에도 바꿀 수 있다. 바꾸면 흐름이 즉시 달라지고, 이미 낸 응답은 그대로 남는다. */
  sessionLength: SessionLength
  /**
   * 50분 판에서 흐름을 빠진 블록을 「수업 후 이어서」로 보여 줄 것인가.
   * 끄면 그 블록이 아예 보이지 않는다. 기본은 켬 — 두 반의 산출물을 같게 두기 위해서다.
   */
  extendedAsHomework: boolean
  displayName: string
  /** 칠판에 적어 주는 6자리 코드 */
  joinCode: string
  requireJoinCode: boolean
  enrollmentOpen: boolean
  /** archived 이면 읽기 전용. 학생도 강사도 새 글을 쓸 수 없다. */
  status: ClassStatus
  createdAt: number
}

/** 차시 공개 여부는 클래스마다 따로다. 새 클래스는 01만 열려 있다. */
export interface LessonState {
  lessonId: LessonId
  published: boolean
  publishedAt: number | null
  /**
   * 강사가 이 클래스에서만 바꾼 핵심/심화 판단 (3차 F.6).
   *
   * 차시별 판단의 최종 결정권은 강의자에게 있다. 교재의 기본 태그를 고치는 것이 아니라
   * 이 클래스에만 덮어쓴다 — 다른 학기·다른 반이 따라 바뀌면 안 된다.
   *
   * 열쇠 모양은 tierKey() 가 만든다: step:… · field:… · concept:… · material:…
   */
  tierOverrides?: Record<string, Tier>
}

export type { Tier } from '@/content/types'

/** 학생도 자기 것을 읽는다. 실명은 여기 없다. */
export interface Enrollment {
  uid: string
  studentId: string | null
  nickname: string
  groupId: string | null
  joinedAt: number
  lastSeenAt: number
  status: 'active' | 'ended'
}

/**
 * ★ 강사만 읽고 쓴다. 학생은 자기 것도 읽지 못한다.
 *
 * Firestore 보안 규칙은 필드 단위 읽기 제어를 하지 못한다.
 * 한 문서에 실명을 넣고 화면에서만 가리면 학생 브라우저로 문서 전체가 내려간다.
 * 그래서 별도 하위 컬렉션으로 분리했다. 이 구조를 enrollments 와 합치지 마라.
 */
export interface RosterEntry {
  uid: string
  /** 강사가 손으로 적는 실명 */
  rosterName: string
  /** 자리·특이사항 등 수업 중 메모 */
  memo: string
}

export interface AppUser {
  uid: string
  role: Role
  studentId: string | null
  /**
   * 실명.
   *
   * 학생 실명은 여기 두지 않는다 — `classes/{cid}/roster/{uid}` 에 둔다.
   * 이 문서는 본인이 읽을 수 있으므로, 실명을 여기 두면 학생 브라우저로 내려간다.
   * 강사 계정의 표시명 정도로만 쓴다.
   */
  displayName: string | null
  /** 화면에 보이는 이름은 언제나 이쪽이다. */
  nickname: string
  mustResetPassword: boolean
  groupId: string | null
  /** 마지막으로 본 클래스. 여러 학기를 수강하면 클래스가 쌓인다. */
  lastClassId: string | null
  createdAt: number
  lastLoginAt: number
}

/** 응답 한 버전. 이전 버전은 절대 덮어쓰지 않는다. */
export interface ResponseVersion {
  v: number
  payload: Record<string, unknown>
  confidence: number | null
  createdAt: number
  /** 무엇을 왜 바꿨는가 */
  changedReason: string | null
}

export interface ResponseDoc {
  uid: string
  versions: ResponseVersion[]
  /** 입력 중 자동 저장. 제출 전 임시 보관이라 버전으로 세지 않는다. */
  draft: { payload: Record<string, unknown>; savedAt: number } | null
  latestV: number
  submittedAt: number | null
}

export interface PostVersion {
  v: number
  content: string
  changedReason: string | null
  createdAt: number
}

export interface PostComment {
  id: string
  uid: string
  nickname: string
  text: string
  createdAt: number
}

/** 반응은 uid 배열로 담는다. 한 사람이 한 글에 하나만. */
export type Reactions = Record<string, string[]>

export interface Post {
  id: string
  uid: string
  nickname: string
  groupId: string | null
  versions: PostVersion[]
  latestV: number
  reactions: Reactions
  comments: PostComment[]
  isPinned: boolean
  /** 강사의 숨김. 삭제가 아니라 숨김이며 작성자에게 사유가 보인다. */
  isHidden: boolean
  hiddenReason: string | null
  createdAt: number
}

export type LadderPhase = 'seating' | 'locked' | 'running' | 'done'

export interface LadderState {
  gameId: GameId
  phase: LadderPhase
  /** 라운드를 올리면 초기화된다. */
  round: number
  /** 서버가 만든 씨앗. 이 문자열 하나로 모든 화면이 같은 사다리를 그린다. */
  seed: string
  columns: number
  /** 자리 번호 → uid. 먼저 잡은 사람이 갖는다. */
  seats: Record<string, string>
  presentSlots: number[]
  winnerUids: string[]
  excludedUids: string[]
  /** 사다리가 깨졌을 때 쓴 비상 추첨 결과 */
  emergency: boolean
  runAt: number | null
}

export interface SessionState {
  lessonId: LessonId
  currentStepId: string | null
  stepOpen: boolean
  timerEndsAt: number | null
  /**
   * 선택형 집계 + 사다리 자리 잠금을 한 map 에 모은다.
   * 키를 `${pollId}_${option}` 으로 만들면 새 활동을 추가해도 보안 규칙을 손대지 않아도 된다.
   */
  pollResults: Record<string, number>
  ladders: Partial<Record<GameId, LadderState>>
  pinnedPostRef: { stepId: string; postId: string } | null
  /** 강사가 어느 단계로 옮겼는지. 학생 화면을 강제로 옮기지 않고 안내만 띄운다. */
  instructorAt: string | null
  updatedAt: number
}

/**
 * 모둠 만들기 — 그 자리에서 즉석으로.
 *
 * 옆에 앉은 사람끼리 "우리가 1모둠"이라 정하고 같은 번호를 고르면 그것이 모둠이다.
 * 강사가 명단을 짜지 않는다. 그래서 모둠은 이 단계 안에서만 살고, 다음 주에 남지 않는다.
 *
 * ★ 이 문서는 같은 클래스의 다른 학생도 읽는다.
 *   그래서 담는 것은 본인이 어차피 모둠에서 소리 내어 말할 것 — 배분과 한 문장뿐이다.
 *   실명은 들어가지 않는다. 읽기는 본인이 제출을 마친 뒤에만 열린다(규칙에서 막는다).
 */
export interface GroupShare {
  uid: string
  nickname: string
  /** '1' ~ '8'. 화면에서 고른 모둠 번호 그대로. */
  groupId: string
  /** 요소 id → 점수 */
  allocation: Record<string, number>
  /** 개인 의견 한 줄 */
  opinion: string
  updatedAt: number
}

export interface Group {
  id: string
  name: string
  memberUids: string[]
}

export interface Participation {
  uid: string
  presentCount: number
  lastPresentedLessonId: LessonId | null
  postCount: number
  commentCount: number
  /** 기여 유형별 횟수. 발언 횟수가 아니라 유형을 센다 (14강). */
  contributionTypes: Record<string, number>
}

export interface PickRecord {
  id: string
  lessonId: LessonId
  stepId: string
  gameId: GameId
  candidateUids: string[]
  excludedUids: string[]
  weights: Record<string, number>
  winnerUids: string[]
  seed: string
  runBy: string
  runAt: number
  redrawOf: string | null
}

export interface AiLog {
  id: string
  taskId: string
  lessonId: LessonId | null
  stepId: string | null
  /** 요청한 사람. 프롬프트에는 넣지 않는다. */
  uid: string
  model: string
  createdAt: number
  ok: boolean
  message: string
  /** 학생이 채택했는가. 채택했을 때만 응답을 저장한다. */
  adopted: boolean
}

/**
 * AI 제안.
 *
 * 지시서 17절 4단계: "교사의 검토·수정·거부 기능이 먼저 완성된 뒤에만 착수한다."
 * 그래서 AI 가 만든 것은 언제나 `pending` 상태의 제안으로만 들어온다.
 * 교사가 읽고, 고치고, 채택하기 전에는 학생 화면에 아무것도 나가지 않는다.
 * 거부한 제안도 지우지 않고 남긴다 — 무엇을 왜 거부했는지가 자료다.
 */
export type AiProposalStatus = 'pending' | 'accepted' | 'rejected'

export interface AiProposal {
  id: string
  taskId: string
  lessonId: LessonId
  stepId: string
  /** AI 가 만든 원문. 절대 덮어쓰지 않는다. */
  original: string
  /** 교사가 고친 것. 채택하면 이쪽이 학생에게 간다. */
  edited: string
  status: AiProposalStatus
  /** 거부했다면 왜 */
  rejectedReason: string | null
  model: string
  createdAt: number
  reviewedAt: number | null
  reviewedBy: string | null
}

export type StorageMode = 'realtime' | 'local'

/** 응답·의견을 한 화면에 모을 때 쓰는 좌표 */
export interface StepRef {
  lessonId: LessonId
  stepId: string
}

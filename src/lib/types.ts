import type { Affiliation } from '@/content/classes'
import type { CourseId, GameKind, GroupFormat, LessonId } from '@/content/types'

/** 저장 계층이 주고받는 타입. Firestore 구현과 로컬 구현이 이 모양을 공유한다. */

export type Role = 'instructor' | 'student'

/* ─────────────────────────── 수강 클래스 ─────────────────────────── */

export type ClassStatus = 'active' | 'archived'

/** 8차: 판을 없앴다. 옛 클래스 문서에 남아 있을 뿐 아무것도 읽지 않는다. */
export type SessionLength = 'full' | 'short'

/**
 * 학기별 수강 클래스. 모든 학생 자료는 이 문서의 하위 컬렉션 안에서만 움직인다.
 * 클래스는 과목 하나에 속한다 (8차 8.1). 옛 문서에 courseId 가 없으면 강의 제목에서 알아낸다.
 */
export interface ClassDoc {
  id: string
  ownerUid: string
  courseTitle: string
  /** 'method' 교과교수법 · 'edu' 과학교육론. 옛 문서에는 없다 — courseOf() 로 읽는다 */
  courseId?: CourseId
  affiliation: Affiliation
  year: number
  term: string
  days: string[]
  startTime: string
  endTime: string
  credits: number
  sessionLength?: SessionLength
  extendedAsHomework?: boolean
  displayName: string
  joinCode: string
  requireJoinCode: boolean
  enrollmentOpen: boolean
  status: ClassStatus
  createdAt: number
  /** 모둠 수. 강사가 정한다. 없으면 기본값 */
  groupCount?: number
  /** 모둠을 새로 나누는 차시. 없으면 과목 기본 (교수법 홀수 차시 · 교육론 매 차시) */
  groupFormationLessons?: LessonId[]
  /** 차시마다 쓴 아이스브레이킹 질문 id — 학기 안에 되풀이하지 않는다 (8차 5.2) */
  formationQuestions?: Record<string, string>
}

export interface LessonState {
  lessonId: LessonId
  published: boolean
  publishedAt: number | null
}

/** 학생도 자기 것을 읽는다. 실명은 여기 없다. */
export interface Enrollment {
  uid: string
  studentId: string | null
  nickname: string
  groupId: string | null
  joinedAt: number
  lastSeenAt: number
  status: 'active' | 'ended'
  currentGroupId?: string | null
  currentRoundId?: string | null
}

/* ── 모둠 나누기 (6차 · 8차 5절) ── */
export interface PairHistoryDoc {
  pairKey: string
  count: number
  lastRound: number
}

export interface GroupRoundGroup {
  id: string
  /** 8차: 다수 답의 이름 — 「일본 모둠」 */
  name: string
  memberUids: string[]
}

export interface GroupRound {
  id: string
  round: number
  lessonId: LessonId
  /** 8차: 아이스브레이킹 질문 id */
  questionId: string
  groups: GroupRoundGroup[]
  absentUids: string[]
  seed: string
  cost: number
  createdBy: string
  createdAt: number
  manualEdits: Array<{ uid: string; fromGroup: string; toGroup: string; at: number }>
  plannedNext: Array<{ groups: Array<{ members: string[] }> }>
  followedPlan: boolean
  lateJoins: Array<{ uid: string; groupId: string; at: number }>
}

/** 학생이 질문에 고른 답. 본인이 쓰고, 강사가 읽는다. */
export interface GroupInput {
  uid: string
  lessonId: LessonId
  questionId: string
  /** 고른 선택지 (답 그대로) */
  choice: string
  updatedAt: number
}

/** ★ 강사만 읽고 쓴다. 학생은 자기 것도 읽지 못한다. */
export interface RosterEntry {
  uid: string
  rosterName: string
  memo: string
}

export interface AppUser {
  uid: string
  role: Role
  studentId: string | null
  /** 강사 계정의 표시 이름. ★ 학생 실명은 여기 두지 않는다 — 실명은 classes/{cid}/roster 에만 있다 */
  displayName: string | null
  nickname: string
  mustResetPassword: boolean
  groupId: string | null
  lastClassId: string | null
  createdAt: number
  lastLoginAt: number
}

/** 응답 한 버전. 8차부터 버전은 하나뿐이다 — 다시 쓰지 않는다. 옛 문서의 여러 버전은 그대로 둔다. */
export interface ResponseVersion {
  v: number
  payload: Record<string, unknown>
  confidence: number | null
  createdAt: number
  changedReason: string | null
}

export interface ResponseDoc {
  uid: string
  versions: ResponseVersion[]
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

/** 의견 광장 글. 반응·댓글·고정·숨김 필드는 옛 문서에 남아 있을 뿐 그리지 않는다. */
export interface Post {
  id: string
  uid: string
  nickname: string
  groupId: string | null
  versions: PostVersion[]
  latestV: number
  createdAt: number
}

/* ─────────────────────────── 모둠 데이터 (8차 4.6) ─────────────────────────── */

/**
 * 모둠원이 활동 칸에 낸 값. 제출하면 자동으로 여기에 적힌다 — 같은 모둠 사람만 읽을 이유가 있지만
 * 규칙은 「제출한 사람」에게 연다 (응답 문서는 남이 못 읽으므로 이 문서가 필요하다).
 */
export interface GroupShare {
  uid: string
  nickname: string
  groupId: string
  /** 활동 칸(GroupData.fieldKey)의 값 */
  value: unknown
  /** vote 형식 — 이유 칸 */
  reason?: string
  updatedAt: number
}

/** 모둠 하나의 값 — 대표가 확정한다. 다른 모둠과 나란히 보인다. */
export interface GroupValue {
  groupId: string
  format: GroupFormat
  /** sentence: 문장 · vote: 대표가 고른 이유의 uid · allocation/rank/sort: 계산값 스냅숏 */
  value: unknown
  byUid: string
  updatedAt: number
}

/* ─────────────────────────── 발표자 뽑기 ─────────────────────────── */

export type LadderPhase = 'seating' | 'locked' | 'running' | 'done'

/** 1강 사다리 · 2강 봉투 · 루미 런 결과가 쓰는 옛 구조. 그대로 둔다 */
export interface LadderState {
  gameId: string
  phase: LadderPhase
  round: number
  seed: string
  columns: number
  seats: Record<string, string>
  presentSlots: number[]
  winnerUids: string[]
  excludedUids: string[]
  emergency: boolean
  runAt: number | null
}

export type GamePhase = 'lobby' | 'running' | 'done'

/**
 * 게임 상태 (8차 6.4). 게임마다 state 의 모양이 다르므로 unknown 에 게임별 파서.
 * 학생은 joined·inputs 의 자기 열쇠만 쓴다 (규칙). 나머지는 강사가 쓴다.
 * 반응 시각은 서버 시각(참가 때 받은 오프셋)이다.
 */
export interface GameState {
  kind: GameKind
  stepId: string
  phase: GamePhase
  round: number
  /** 서버 시드 */
  seed: string
  /** 서버 시각(ms) — 시작 시각 */
  startedAt: number | null
  /** 강사가 쓰는 게임별 진행 상태 (문 열기 순서 등). 대부분의 게임은 seed·참가·입력만으로 상태가 정해진다 */
  state: unknown
  result: GameResult | null
  updatedAt: number
}

/**
 * 학생이 게임에 낸 것 — sessions/{lid}/gameInputs/{stepId}__{uid}.
 * 참가·입력은 이 문서 하나에 모인다. 본인만 쓰고, 같은 클래스 사람과 강사가 읽는다.
 * 게임 상태는 (seed · 참가 · 입력 · 서버 시각)의 함수라 모든 화면이 같은 것을 계산한다.
 */
export interface GameInput {
  uid: string
  stepId: string
  round: number
  /** 서버 시각(ms) — 참가한 때 */
  joinedAt: number
  /** 게임별 입력 — 숫자 · 칸 · 누른 시각 · 손 · 글자 … */
  value: unknown
  updatedAt: number
}

export interface GameResult {
  winnerUids: string[]
  /** 왜 이 사람인가 — 결과 화면에 그대로 */
  reason: string
  /** 후보 (참가자) */
  candidateUids: string[]
  seed: string
  /** 반응 속도 게임이면 「반응 속도 게임입니다」 */
  fairness?: string
  /** 수동 지정 · 재추첨 표시 */
  manual?: boolean
  at: number
}

export interface SessionState {
  lessonId: LessonId
  /** 강사가 학생에게 연 단계 id (8차 7.1 「단계 열기」) */
  openSteps?: string[]
  currentStepId: string | null
  stepOpen: boolean
  timerEndsAt: number | null
  pollResults: Record<string, number>
  ladders: Partial<Record<string, LadderState>>
  /** 강사가 공개한 자료 블록 id */
  revealed?: string[]
  pinnedPostRef: { stepId: string; postId: string } | null
  instructorAt: string | null
  /** 8차 게임 (단계별로 하나) */
  games?: Partial<Record<string, GameState>>
  lumi?: LumiActivity | null
  updatedAt: number
}

export interface LumiActivity {
  activityInstanceId: string
  gameId: string
  stepId: string
  roomCode: string | null
  status: 'open' | 'ended' | 'lost'
  requestedCount: number
  round: number
  createdBy: string
  createdAt: number
  lastMatchId?: string | null
  resultAt?: number | null
  result?: LumiResultSummary | null
}

export interface LumiResultSummary {
  matchId: string
  selectedIds: string[]
  selectedNames: Record<string, string>
  requestedCount: number
  selectedCount: number
  mode: string
  selectionReason: string
  tieHandling: string
  endReason: 'normal' | 'timeout' | 'teacher'
  endedAt: string
  playerCount: number
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
  contributionTypes: Record<string, number>
}

export interface PickRecord {
  id: string
  lessonId: LessonId
  stepId: string
  gameId: string
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
  uid: string
  model: string
  createdAt: number
  ok: boolean
  message: string
  adopted: boolean
}

export type AiProposalStatus = 'pending' | 'accepted' | 'rejected'

export interface AiProposal {
  id: string
  taskId: string
  lessonId: LessonId
  stepId: string
  original: string
  edited: string
  status: AiProposalStatus
  rejectedReason: string | null
  model: string
  createdAt: number
  reviewedAt: number | null
  reviewedBy: string | null
}

export type StorageMode = 'realtime' | 'local'

export interface StepRef {
  lessonId: LessonId
  stepId: string
}

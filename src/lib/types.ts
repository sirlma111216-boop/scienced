import type { GameId, LessonId } from '@/content/types'

/** 저장 계층이 주고받는 타입. Firestore 구현과 로컬 구현이 이 모양을 공유한다. */

export type Role = 'instructor' | 'student'

export interface AppUser {
  uid: string
  role: Role
  studentId: string | null
  /** 실명. 강사만 볼 수 있다. */
  displayName: string | null
  /** 화면에 보이는 이름은 언제나 이쪽이다. */
  nickname: string
  mustResetPassword: boolean
  groupId: string | null
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

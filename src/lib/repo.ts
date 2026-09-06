import type { GameId, LessonId } from '@/content/types'
import type {
  AppUser,
  Group,
  LadderState,
  Participation,
  PickRecord,
  Post,
  ResponseDoc,
  SessionState,
  StorageMode,
} from './types'

/**
 * 저장 계층.
 *
 * Firestore 구현과 로컬 구현을 같은 인터페이스로 감싼다.
 * Firebase 설정이 없으면 로컬 저장 모드로 떨어지고, 개인 작성·자동 저장·인쇄는 그대로 동작한다.
 * 실시간 공유만 "내 것"만 보인다. 상단바가 어느 모드인지 표시한다.
 *
 * 이름은 기존 앱(`2022co`)의 repo 를 그대로 따른다. 한 곳만 다르다:
 * `toggleLike` → `toggleReaction`. 좋아요 하나가 아니라 반응 4종이 되었기 때문에
 * 이름을 그대로 두면 하는 일과 이름이 어긋난다.
 */
export interface Repo {
  readonly mode: StorageMode

  /* ── 사용자 ── */
  getUser(uid: string): Promise<AppUser | null>
  upsertUser(user: AppUser): Promise<void>
  watchUsers(cb: (users: AppUser[]) => void): () => void

  /* ── 응답 ── */
  /** 입력 중 자동 저장. 버전으로 세지 않는다. */
  saveDraft(
    lessonId: LessonId,
    stepId: string,
    uid: string,
    payload: Record<string, unknown>,
  ): Promise<void>
  /**
   * 제출. 새 버전을 뒤에 쌓는다. 기존 요소는 수정·삭제하지 않는다.
   * 최초 답을 지우지 않는 것이 이 앱의 첫 번째 원칙이다.
   */
  submitResponse(
    lessonId: LessonId,
    stepId: string,
    uid: string,
    payload: Record<string, unknown>,
    opts: { confidence: number | null; changedReason: string | null },
  ): Promise<void>
  getResponse(lessonId: LessonId, stepId: string, uid: string): Promise<ResponseDoc | null>
  watchResponse(
    lessonId: LessonId,
    stepId: string,
    uid: string,
    cb: (doc: ResponseDoc | null) => void,
  ): () => void
  /** 강사만. 익명 분포와 제출/미제출 명단에 쓴다. */
  watchAllResponses(
    lessonId: LessonId,
    stepId: string,
    cb: (docs: ResponseDoc[]) => void,
  ): () => void

  /* ── 의견 광장 ── */
  watchPosts(lessonId: LessonId, stepId: string, cb: (posts: Post[]) => void): () => void
  addPost(
    lessonId: LessonId,
    stepId: string,
    post: { uid: string; nickname: string; groupId: string | null; content: string },
  ): Promise<void>
  /** 수정은 덮어쓰기가 아니라 새 버전 쌓기다. */
  revisePost(
    lessonId: LessonId,
    stepId: string,
    postId: string,
    content: string,
    changedReason: string,
  ): Promise<void>
  /** 한 사람이 한 글에 하나만. 같은 걸 다시 누르면 취소된다. */
  toggleReaction(
    lessonId: LessonId,
    stepId: string,
    postId: string,
    uid: string,
    reaction: string,
  ): Promise<void>
  addComment(
    lessonId: LessonId,
    stepId: string,
    postId: string,
    comment: { uid: string; nickname: string; text: string },
  ): Promise<void>
  /** 강사만. 발표 모드 대형 화면에 띄운다. */
  pinPost(lessonId: LessonId, stepId: string, postId: string, pinned: boolean): Promise<void>
  /** 강사는 숨김만. 삭제는 작성자만. 기록을 보존한다. */
  hidePost(
    lessonId: LessonId,
    stepId: string,
    postId: string,
    hidden: boolean,
    reason: string,
  ): Promise<void>
  deletePost(lessonId: LessonId, stepId: string, postId: string, uid: string): Promise<void>

  /* ── 진행 세션 ── */
  watchSession(lessonId: LessonId, cb: (s: SessionState | null) => void): () => void
  setSession(lessonId: LessonId, patch: Partial<SessionState>): Promise<void>

  /* ── 사다리·추첨 ── */
  /** 학생이 판에 들어온다. */
  joinLadder(lessonId: LessonId, gameId: GameId, uid: string): Promise<void>
  /**
   * 자리 선점. 이미 다른 사람이 가져갔으면 false 를 돌려준다.
   * 화면은 "방금 다른 분이 그 자리를 가져갔습니다"를 띄운다.
   */
  claimLadderSeat(
    lessonId: LessonId,
    gameId: GameId,
    seat: number,
    uid: string,
  ): Promise<boolean>
  setLadder(lessonId: LessonId, gameId: GameId, state: LadderState): Promise<void>
  recordPick(pick: PickRecord): Promise<void>
  watchPicks(cb: (picks: PickRecord[]) => void): () => void

  /* ── 모둠·참여 ── */
  watchGroups(cb: (groups: Group[]) => void): () => void
  setGroups(groups: Group[]): Promise<void>
  watchParticipation(cb: (p: Participation[]) => void): () => void
  bumpParticipation(uid: string, patch: Partial<Participation>): Promise<void>

  /* ── 공개 제어 ── */
  watchPublished(cb: (ids: LessonId[]) => void): () => void
  setPublished(lessonId: LessonId, published: boolean): Promise<void>
}

let current: Repo | null = null

/** 앱 전체가 이 한 곳으로 저장소를 얻는다. */
export function getRepo(): Repo {
  if (!current) throw new Error('저장소가 아직 준비되지 않았습니다.')
  return current
}

export function setRepo(repo: Repo) {
  current = repo
}

export function hasRepo(): boolean {
  return current !== null
}

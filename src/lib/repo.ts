import type { GameId, LessonId, Tier } from '@/content/types'
import type { TierOverrides } from './tiers'
import type {
  AiProposal,
  AppUser,
  ClassDoc,
  Enrollment,
  Group,
  LadderState,
  LessonState,
  Participation,
  PickRecord,
  Post,
  ResponseDoc,
  RosterEntry,
  SessionState,
  StorageMode,
} from './types'

/**
 * 저장 계층.
 *
 * Firestore 구현과 로컬 구현을 같은 인터페이스로 감싼다.
 * Firebase 설정이 없으면 로컬 저장 모드로 떨어지고, 개인 작성·자동 저장·인쇄는 그대로 동작한다.
 * 실시간 공유만 "내 것"만 보인다. 상단바는 로컬 저장으로 떨어졌을 때만 알린다.
 *
 * 이름은 기존 앱(`2022co`)의 repo 를 그대로 따른다. 한 곳만 다르다:
 * `toggleLike` → `toggleReaction`. 좋아요 하나가 아니라 반응 4종이 되었기 때문에
 * 이름을 그대로 두면 하는 일과 이름이 어긋난다.
 *
 * ★ 학생 자료를 다루는 함수는 전부 `classId` 를 첫 인자로 받는다.
 *   짧게 줄일 수도 있었지만, 어느 클래스를 건드리는지 호출부에서 눈에 보여야
 *   학기 사이에 자료가 새는 실수를 잡을 수 있다. 그것이 이 구조의 목적이다.
 */
export interface Repo {
  readonly mode: StorageMode

  /* ── 사용자 (클래스와 무관) ── */
  getUser(uid: string): Promise<AppUser | null>
  upsertUser(user: AppUser): Promise<void>
  watchUsers(cb: (users: AppUser[]) => void): () => void

  /* ── 수강 클래스 ── */
  watchClasses(cb: (list: ClassDoc[]) => void): () => void
  createClass(c: ClassDoc): Promise<void>
  updateClass(classId: string, patch: Partial<ClassDoc>): Promise<void>
  /**
   * 클래스를 지운다. 등록 인원이 있어도 지운다.
   *
   * ★ 하위 컬렉션을 전부 치운 뒤에 클래스 문서를 지운다.
   *   Firestore 는 문서를 지워도 하위 컬렉션이 남는다. 그대로 두면 화면에서는 사라졌는데
   *   학생 응답·의견·실명이 데이터베이스에 그대로 남는다. 지웠다고 말할 수 없는 상태다.
   *
   * 되돌릴 수 없다. 학기를 마친 클래스는 「보관」이 맞다 — 기록은 남기고 쓰기만 막는다.
   */
  deleteClass(classId: string): Promise<void>

  /* ── 차시 공개 (클래스마다 따로) ── */
  watchLessonState(classId: string, cb: (published: LessonId[]) => void): () => void
  setLessonPublished(classId: string, lessonId: LessonId, published: boolean): Promise<void>

  /*
   * 핵심/심화 판단을 이 클래스에서만 바꾼다 (3차 F.6).
   * 교재의 기본 태그를 고치는 것이 아니다 — 다른 학기가 따라 바뀌면 안 된다.
   * 열쇠는 tierKey() 가 만든다. tier 를 null 로 주면 덮어쓰기를 지우고 기본값으로 돌아간다.
   */
  watchLessonTiers(
    classId: string,
    lessonId: LessonId,
    cb: (overrides: TierOverrides) => void,
  ): () => void
  setLessonTier(
    classId: string,
    lessonId: LessonId,
    key: string,
    tier: Tier | null,
  ): Promise<void>

  /* ── 수강 등록 ── */
  watchEnrollments(classId: string, cb: (list: Enrollment[]) => void): () => void
  getEnrollment(classId: string, uid: string): Promise<Enrollment | null>
  enroll(classId: string, e: Enrollment): Promise<void>
  updateEnrollment(classId: string, uid: string, patch: Partial<Enrollment>): Promise<void>

  /**
   * 명단 실명 — 강사만.
   * 학생은 자기 것도 읽지 못한다. 규칙에서 막혀 있다.
   */
  watchRoster(classId: string, cb: (list: RosterEntry[]) => void): () => void
  setRosterEntry(classId: string, uid: string, patch: Partial<RosterEntry>): Promise<void>

  /* ── 응답 ── */
  /** 입력 중 자동 저장. 버전으로 세지 않는다. */
  saveDraft(
    classId: string,
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
    classId: string,
    lessonId: LessonId,
    stepId: string,
    uid: string,
    payload: Record<string, unknown>,
    opts: { confidence: number | null; changedReason: string | null },
  ): Promise<void>
  getResponse(
    classId: string,
    lessonId: LessonId,
    stepId: string,
    uid: string,
  ): Promise<ResponseDoc | null>
  watchResponse(
    classId: string,
    lessonId: LessonId,
    stepId: string,
    uid: string,
    cb: (doc: ResponseDoc | null) => void,
  ): () => void
  /** 강사만. 익명 분포와 제출/미제출 명단에 쓴다. */
  watchAllResponses(
    classId: string,
    lessonId: LessonId,
    stepId: string,
    cb: (docs: ResponseDoc[]) => void,
  ): () => void

  /* ── 의견 광장 ── */
  watchPosts(
    classId: string,
    lessonId: LessonId,
    stepId: string,
    cb: (posts: Post[]) => void,
  ): () => void
  addPost(
    classId: string,
    lessonId: LessonId,
    stepId: string,
    post: { uid: string; nickname: string; groupId: string | null; content: string },
  ): Promise<void>
  /** 수정은 덮어쓰기가 아니라 새 버전 쌓기다. */
  revisePost(
    classId: string,
    lessonId: LessonId,
    stepId: string,
    postId: string,
    content: string,
    changedReason: string,
  ): Promise<void>
  /** 한 사람이 한 글에 하나만. 같은 걸 다시 누르면 취소된다. */
  toggleReaction(
    classId: string,
    lessonId: LessonId,
    stepId: string,
    postId: string,
    uid: string,
    reaction: string,
  ): Promise<void>
  addComment(
    classId: string,
    lessonId: LessonId,
    stepId: string,
    postId: string,
    comment: { uid: string; nickname: string; text: string },
  ): Promise<void>
  /** 강사만. 발표 모드 대형 화면에 띄운다. */
  pinPost(
    classId: string,
    lessonId: LessonId,
    stepId: string,
    postId: string,
    pinned: boolean,
  ): Promise<void>
  /** 강사는 숨김만. 삭제는 작성자만. 기록을 보존한다. */
  hidePost(
    classId: string,
    lessonId: LessonId,
    stepId: string,
    postId: string,
    hidden: boolean,
    reason: string,
  ): Promise<void>
  deletePost(
    classId: string,
    lessonId: LessonId,
    stepId: string,
    postId: string,
    uid: string,
  ): Promise<void>

  /* ── 차시 진행 상태 (지금 어느 단계인지·투표가 열렸는지) ── */
  watchSession(classId: string, lessonId: LessonId, cb: (s: SessionState | null) => void): () => void
  setSession(classId: string, lessonId: LessonId, patch: Partial<SessionState>): Promise<void>

  /* ── 사다리·추첨 ── */
  joinLadder(classId: string, lessonId: LessonId, gameId: GameId, uid: string): Promise<void>
  /**
   * 자리 선점. 이미 다른 사람이 가져갔으면 false 를 돌려준다.
   * 화면은 "방금 다른 분이 그 자리를 가져갔습니다"를 띄운다.
   */
  claimLadderSeat(
    classId: string,
    lessonId: LessonId,
    gameId: GameId,
    seat: number,
    uid: string,
  ): Promise<boolean>
  setLadder(
    classId: string,
    lessonId: LessonId,
    gameId: GameId,
    state: LadderState,
  ): Promise<void>
  recordPick(classId: string, pick: PickRecord): Promise<void>
  watchPicks(classId: string, cb: (picks: PickRecord[]) => void): () => void

  /* ── 모둠·참여 ── */
  watchGroups(classId: string, cb: (groups: Group[]) => void): () => void
  setGroups(classId: string, groups: Group[]): Promise<void>
  watchParticipation(classId: string, cb: (p: Participation[]) => void): () => void
  bumpParticipation(classId: string, uid: string, patch: Partial<Participation>): Promise<void>

  /* ── AI 제안 (교사 검토 관문) ── */
  /**
   * AI 결과를 제안으로 넣는다. 언제나 pending 으로 들어간다.
   * 이 함수 말고는 AI 결과가 저장되는 경로가 없다.
   */
  addAiProposal(classId: string, p: AiProposal): Promise<void>
  watchAiProposals(classId: string, cb: (list: AiProposal[]) => void): () => void
  /** 교사가 고치거나 채택하거나 거부한다. original 은 바뀌지 않는다. */
  reviewAiProposal(
    classId: string,
    id: string,
    patch: { edited?: string; status?: AiProposal['status']; rejectedReason?: string | null },
    reviewedBy: string,
  ): Promise<void>
}

/** 클래스 문서를 만들 때 필요한 것 중 저장소가 채워 주는 부분 */
export type { LessonState }

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

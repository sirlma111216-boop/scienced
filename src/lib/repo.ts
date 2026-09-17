import type { LessonId } from '@/content/types'
import type {
  AiLog,
  AiProposal,
  AppUser,
  ClassDoc,
  Enrollment,
  GameInput,
  GameState,
  Group,
  GroupInput,
  GroupRound,
  GroupShare,
  GroupValue,
  PairHistoryDoc,
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
 * 저장 계층. Firestore 구현과 로컬 구현을 같은 인터페이스로 감싼다.
 * ★ 학생 자료를 다루는 함수는 전부 `classId` 를 첫 인자로 받는다 (verify:classes).
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
  /** 하위 컬렉션을 전부 치운 뒤 클래스 문서를 지운다. 되돌릴 수 없다. */
  deleteClass(classId: string): Promise<void>

  /* ── 차시 공개 (클래스마다 따로) ── */
  watchLessonState(classId: string, cb: (published: LessonId[]) => void): () => void
  setLessonPublished(classId: string, lessonId: LessonId, published: boolean): Promise<void>

  /* ── 수강 등록 ── */
  watchEnrollments(classId: string, cb: (list: Enrollment[]) => void): () => void
  getEnrollment(classId: string, uid: string): Promise<Enrollment | null>
  enroll(classId: string, e: Enrollment): Promise<void>
  updateEnrollment(classId: string, uid: string, patch: Partial<Enrollment>): Promise<void>
  /** 이 클래스에서 내보낸다. 계정은 지우지 않는다. 남긴 것도 함께 치운다. */
  removeEnrollment(classId: string, uid: string): Promise<void>

  /** 명단 실명 — 강사만 */
  watchRoster(classId: string, cb: (list: RosterEntry[]) => void): () => void
  setRosterEntry(classId: string, uid: string, patch: Partial<RosterEntry>): Promise<void>

  /* ── 응답 ── */
  saveDraft(classId: string, lessonId: LessonId, stepId: string, uid: string, payload: Record<string, unknown>): Promise<void>
  /** 제출. 새 버전을 뒤에 쌓는다. 8차부터 화면은 한 번만 제출한다. */
  submitResponse(
    classId: string,
    lessonId: LessonId,
    stepId: string,
    uid: string,
    payload: Record<string, unknown>,
    opts: { confidence: number | null; changedReason: string | null },
  ): Promise<void>
  getResponse(classId: string, lessonId: LessonId, stepId: string, uid: string): Promise<ResponseDoc | null>
  watchResponse(classId: string, lessonId: LessonId, stepId: string, uid: string, cb: (doc: ResponseDoc | null) => void): () => void
  /** 강사만. */
  watchAllResponses(classId: string, lessonId: LessonId, stepId: string, cb: (docs: ResponseDoc[]) => void): () => void

  /* ── 모둠 데이터 (8차 4.6) ── */
  /** 모둠원이 낸 값. 본인이 제출을 마쳐야 읽고 쓸 수 있다. */
  watchGroupShares(classId: string, lessonId: LessonId, stepId: string, cb: (list: GroupShare[]) => void): () => void
  setGroupShare(classId: string, lessonId: LessonId, stepId: string, share: GroupShare): Promise<void>
  clearGroupShare(classId: string, lessonId: LessonId, stepId: string, uid: string): Promise<void>
  /** 모둠 하나의 값 — 대표가 확정한다 */
  watchGroupValues(classId: string, lessonId: LessonId, stepId: string, cb: (list: GroupValue[]) => void): () => void
  setGroupValue(classId: string, lessonId: LessonId, stepId: string, value: GroupValue): Promise<void>

  /* ── 의견 광장 ── */
  watchPosts(classId: string, lessonId: LessonId, stepId: string, cb: (posts: Post[]) => void): () => void
  /** 한 사람이 한 단계에 하나만. 문서 id 가 uid 다. */
  upsertPost(classId: string, lessonId: LessonId, stepId: string, post: { uid: string; nickname: string; groupId: string | null; content: string }): Promise<void>

  /* ── 차시 진행 상태 ── */
  watchSession(classId: string, lessonId: LessonId, cb: (s: SessionState | null) => void): () => void
  setSession(classId: string, lessonId: LessonId, patch: Partial<SessionState>): Promise<void>

  /* ── 게임 (8차 6절) ── */
  /** 강사 — 게임 상태 통째로 */
  setGame(classId: string, lessonId: LessonId, stepId: string, state: GameState): Promise<void>
  /** 학생 — 참가·입력. 자기 문서만 쓴다 */
  setGameInput(classId: string, lessonId: LessonId, input: GameInput): Promise<void>
  /** 이 단계 게임에 낸 것 전부 — 모든 화면이 같은 상태를 계산한다 */
  watchGameInputs(classId: string, lessonId: LessonId, stepId: string, cb: (list: GameInput[]) => void): () => void

  /* ── 사다리·봉투 (1·2강 유지) ── */
  claimLadderSeat(classId: string, lessonId: LessonId, gameId: string, seat: number, uid: string): Promise<boolean>
  setLadder(classId: string, lessonId: LessonId, gameId: string, state: LadderState): Promise<void>
  recordPick(classId: string, pick: PickRecord): Promise<void>
  watchPicks(classId: string, cb: (picks: PickRecord[]) => void): () => void

  /* ── 모둠·참여 ── */
  watchGroups(classId: string, cb: (groups: Group[]) => void): () => void
  setGroups(classId: string, groups: Group[]): Promise<void>
  watchParticipation(classId: string, cb: (p: Participation[]) => void): () => void
  bumpParticipation(classId: string, uid: string, patch: Partial<Participation>): Promise<void>

  /* ── 모둠 나누기 ── */
  watchPairHistory(classId: string, cb: (docs: PairHistoryDoc[]) => void): () => void
  watchGroupRounds(classId: string, cb: (rounds: GroupRound[]) => void): () => void
  confirmGroupRound(classId: string, round: GroupRound): Promise<void>
  addLateJoiner(classId: string, roundId: string, uid: string, groupId: string): Promise<void>
  watchGroupInputs(classId: string, lessonId: LessonId, cb: (list: GroupInput[]) => void): () => void
  watchMyGroupInput(classId: string, lessonId: LessonId, uid: string, cb: (input: GroupInput | null) => void): () => void
  setGroupInput(classId: string, input: GroupInput): Promise<void>

  /* ── AI 제안 (교사 검토 관문) ── */
  watchAiLogs(cb: (list: AiLog[]) => void): () => void
  addAiProposal(classId: string, p: AiProposal): Promise<void>
  watchAiProposals(classId: string, cb: (list: AiProposal[]) => void): () => void
  reviewAiProposal(
    classId: string,
    id: string,
    patch: { edited?: string; status?: AiProposal['status']; rejectedReason?: string | null },
    reviewedBy: string,
  ): Promise<void>
}

export type { LessonState }

let current: Repo | null = null

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

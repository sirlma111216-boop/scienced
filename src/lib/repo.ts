import type { TextbookDoc } from '@shared/textbook'
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
  MtApplication, MtPeerDoc, MtSlot,
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
  /** 강사 — 학기 전체. 출석부가 차시마다의 출석 손질을 읽는다 */
  watchSessions(classId: string, cb: (list: SessionState[]) => void): () => void
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
  /** 강사 — 학기 전체. 출석부가 차시마다 누가 답했나를 읽는다 */
  watchAllGroupInputs(classId: string, cb: (list: GroupInput[]) => void): () => void
  watchMyGroupInput(classId: string, lessonId: LessonId, uid: string, cb: (input: GroupInput | null) => void): () => void
  setGroupInput(classId: string, input: GroupInput): Promise<void>

  /* ── AI 제안 (교사 검토 관문) ── */
  /* ── 마이크로티칭 신청 (강의자 지시 2026-10-03) — 쓰기는 서버 함수가 한다 ── */
  watchMtSlots(classId: string, cb: (list: MtSlot[]) => void): () => void
  applyMicroteaching(classId: string, slotId: string, uid: string): Promise<{ ok: boolean; message?: string }>
  /** 본인은 자기 것을, 강사는 uid 를 적어 남의 것을 취소한다 */
  cancelMicroteaching(classId: string, uid: string): Promise<{ ok: boolean; message?: string }>
  /** 신청 기록(발표 내용 · 계획안) — uid 를 주면 그 사람 것(학생 본인), null 이면 전부(강사) */
  watchMtApplications(classId: string, uid: string | null, cb: (list: Array<MtApplication & { uid: string }>) => void, onError?: (message: string) => void): () => void
  /** 발표 소재 · 수업 방식 저장 — 신청한 본인. 서버가 자리 문서와 신청 기록에 함께 적는다 */
  saveMtDetail(classId: string, uid: string, d: { grade: number; unitId: string; topic: string; methods: string[]; methodOther: string }): Promise<{ ok: boolean; message?: string }>
  /** 내가 다른 사람 수업에 적은 동료 의견 — 규칙이 authorUid 가 나인 것만 내준다 (2026-10-17). 발표자 쪽 목록은 서버(mtPeerList)가 익명으로 준다 */
  watchMtPeerMine(classId: string, authorUid: string, cb: (list: MtPeerDoc[]) => void, onError?: (message: string) => void): () => void

  /* ── 교과서 보기 (2026-10-14) — 쓰기는 서버 함수(/api/textbook/*)가 한다 ── */
  /** publishedOnly — 학생: 공개된 소단원만. 강사: false 로 전부. 읽지 못하면 onError 로 이유를 준다(빈 목록과 다르다) */
  watchTextbooks(opts: { publishedOnly: boolean }, cb: (list: TextbookDoc[]) => void, onError?: (message: string) => void): () => void

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

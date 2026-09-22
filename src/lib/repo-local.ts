import type { LessonId } from '@/content/types'
import { COURSE_IDS, lessonIndex } from '@/content/courses'
import { stepIdsOf } from '@/content/steps'
import type { Repo } from './repo'
import { pairDeltas, pairKey } from '@shared/groups-core'
import type {
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
  Participation,
  PickRecord,
  Post,
  ResponseDoc,
  ResponseVersion,
  RosterEntry,
  SessionState,
} from './types'

/**
 * 로컬 저장 모드. Firebase 없이도 개인 작성·자동 저장·인쇄가 동작한다.
 * 클래스 분리는 여기서도 지킨다 — 모든 키에 classId 가 들어간다.
 */

const NS = 'sls.v1'

type Listener = () => void
const listeners = new Set<Listener>()

function notify() {
  for (const l of listeners) l()
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${NS}.${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(`${NS}.${key}`)
  } catch {
    /* 저장이 막혀도 화면은 계속 동작한다 */
  }
  notify()
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(`${NS}.${key}`, JSON.stringify(value))
  } catch {
    /* 저장이 막혀도 화면은 계속 동작한다 */
  }
  notify()
}

function subscribe(run: () => void): () => void {
  run()
  listeners.add(run)
  return () => listeners.delete(run)
}

const kResponse = (c: string, l: string, s: string, uid: string) => `c.${c}.res.${l}.${s}.${uid}`
const kPosts = (c: string, l: string, s: string) => `c.${c}.posts.${l}.${s}`
const kShares = (c: string, l: string, s: string) => `c.${c}.shares.${l}.${s}`
const kGroupValues = (c: string, l: string, s: string) => `c.${c}.gvalues.${l}.${s}`
const kSession = (c: string, l: string) => `c.${c}.session.${l}`
const kGameInputs = (c: string, l: string, s: string) => `c.${c}.ginputs.${l}.${s}`
const kPicks = (c: string) => `c.${c}.picks`
const kGroups = (c: string) => `c.${c}.groups`
const kParticipation = (c: string) => `c.${c}.participation`
const kPublished = (c: string) => `c.${c}.published`
const kEnrollments = (c: string) => `c.${c}.enrollments`
const kRoster = (c: string) => `c.${c}.roster`
const kProposals = (c: string) => `c.${c}.aiProposals`
const kPairHistory = (c: string) => `c.${c}.pairHistory`
const kGroupRounds = (c: string) => `c.${c}.groupRounds`
const kGroupInputs = (c: string, l: string) => `c.${c}.groupInputs.${l}`

/** 모든 과목의 차시 id — 학기 전체를 훑을 때 (출석부) */
function allLessonIds(): LessonId[] {
  const out = new Set<LessonId>()
  for (const cid of COURSE_IDS) for (const l of lessonIndex(cid)) out.add(l.id)
  return [...out]
}

/** 모든 과목의 (차시, 단계) — 응답·글·자리를 훑을 때 */
function allStepPaths(): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const cid of COURSE_IDS) for (const l of lessonIndex(cid)) for (const s of stepIdsOf(l.layout)) out.push([l.id, s])
  return out
}

/** 새 클래스는 시드에서 열린 차시만 열려 있다. 과목은 클래스 문서가 안다. */
const seedPublished = (c?: ClassDoc): LessonId[] => {
  const cid = c?.courseId ?? 'method'
  return lessonIndex(cid).filter((l) => l.published).map((l) => l.id)
}

function emptySession(lessonId: LessonId): SessionState {
  return { lessonId, currentStepId: null, stepOpen: false, timerEndsAt: null, pollResults: {}, ladders: {}, pinnedPostRef: null, instructorAt: null, updatedAt: Date.now() }
}

export function createLocalRepo(): Repo {
  return {
    mode: 'local',

    /* ── 사용자 ── */
    async getUser(uid) {
      return read<AppUser | null>(`user.${uid}`, null)
    },
    async upsertUser(user) {
      write(`user.${user.uid}`, user)
      const list = read<string[]>('users', [])
      if (!list.includes(user.uid)) write('users', [...list, user.uid])
    },
    watchUsers(cb) {
      return subscribe(() => {
        const ids = read<string[]>('users', [])
        cb(ids.map((id) => read<AppUser | null>(`user.${id}`, null)).filter(Boolean) as AppUser[])
      })
    },

    /* ── 수강 클래스 ── */
    watchClasses(cb) {
      return subscribe(() => cb(read<ClassDoc[]>('classes', [])))
    },
    async createClass(c) {
      const list = read<ClassDoc[]>('classes', [])
      write('classes', [...list, c])
      write(kPublished(c.id), seedPublished(c))
    },
    async removeEnrollment(classId, uid) {
      write(kEnrollments(classId), read<Enrollment[]>(kEnrollments(classId), []).filter((e) => e.uid !== uid))
      write(kRoster(classId), read<RosterEntry[]>(kRoster(classId), []).filter((r) => r.uid !== uid))
      write(kParticipation(classId), read<Participation[]>(kParticipation(classId), []).filter((p) => p.uid !== uid))
      for (const [lid, sid] of allStepPaths()) {
        remove(kResponse(classId, lid, sid, uid))
        const pk = kPosts(classId, lid, sid)
        write(pk, read<Post[]>(pk, []).filter((p) => p.uid !== uid))
        const sk = kShares(classId, lid, sid)
        write(sk, read<GroupShare[]>(sk, []).filter((s) => s.uid !== uid))
      }
    },

    async deleteClass(classId) {
      const prefix = `${NS}.c.${classId}.`
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith(prefix)) localStorage.removeItem(key)
        }
      } catch {
        /* 저장소가 막혀 있어도 목록에서는 지운다 */
      }
      const list = read<ClassDoc[]>('classes', [])
      write('classes', list.filter((c) => c.id !== classId))
    },
    async updateClass(classId, patch) {
      const list = read<ClassDoc[]>('classes', [])
      write('classes', list.map((c) => (c.id === classId ? { ...c, ...patch } : c)))
    },

    /* ── 차시 공개 ── */
    watchLessonState(classId, cb) {
      return subscribe(() => {
        const cls = read<ClassDoc[]>('classes', []).find((c) => c.id === classId)
        cb(read<LessonId[]>(kPublished(classId), seedPublished(cls)))
      })
    },
    async setLessonPublished(classId, lessonId, published) {
      const cls = read<ClassDoc[]>('classes', []).find((c) => c.id === classId)
      const cur = read<LessonId[]>(kPublished(classId), seedPublished(cls))
      const next = published ? [...new Set([...cur, lessonId])] : cur.filter((x) => x !== lessonId)
      write(kPublished(classId), next.sort())
    },

    /* ── 수강 등록 ── */
    watchEnrollments(classId, cb) {
      return subscribe(() => cb(read<Enrollment[]>(kEnrollments(classId), [])))
    },
    async getEnrollment(classId, uid) {
      return read<Enrollment[]>(kEnrollments(classId), []).find((e) => e.uid === uid) ?? null
    },
    async enroll(classId, e) {
      const list = read<Enrollment[]>(kEnrollments(classId), []).filter((x) => x.uid !== e.uid)
      write(kEnrollments(classId), [...list, e])
    },
    async updateEnrollment(classId, uid, patch) {
      const list = read<Enrollment[]>(kEnrollments(classId), [])
      write(kEnrollments(classId), list.map((e) => (e.uid === uid ? { ...e, ...patch } : e)))
    },

    /* ── 명단 실명 ── */
    watchRoster(classId, cb) {
      return subscribe(() => cb(read<RosterEntry[]>(kRoster(classId), [])))
    },
    async setRosterEntry(classId, uid, patch) {
      const list = read<RosterEntry[]>(kRoster(classId), [])
      const i = list.findIndex((r) => r.uid === uid)
      const base: RosterEntry = list[i] ?? { uid, rosterName: '', memo: '' }
      const next = { ...base, ...patch }
      if (i >= 0) list[i] = next
      else list.push(next)
      write(kRoster(classId), list)
    },

    /* ── 응답 ── */
    async saveDraft(classId, lessonId, stepId, uid, payload) {
      const key = kResponse(classId, lessonId, stepId, uid)
      const doc = read<ResponseDoc | null>(key, null)
      write(key, {
        uid,
        versions: doc?.versions ?? [],
        latestV: doc?.latestV ?? 0,
        submittedAt: doc?.submittedAt ?? null,
        draft: { payload, savedAt: Date.now() },
      } satisfies ResponseDoc)
    },
    async submitResponse(classId, lessonId, stepId, uid, payload, opts) {
      const key = kResponse(classId, lessonId, stepId, uid)
      const doc = read<ResponseDoc | null>(key, null)
      const versions = doc?.versions ?? []
      const next: ResponseVersion = { v: versions.length + 1, payload, confidence: opts.confidence, createdAt: Date.now(), changedReason: opts.changedReason }
      write(key, { uid, versions: [...versions, next], latestV: next.v, submittedAt: Date.now(), draft: null } satisfies ResponseDoc)
    },
    async getResponse(classId, lessonId, stepId, uid) {
      return read<ResponseDoc | null>(kResponse(classId, lessonId, stepId, uid), null)
    },
    watchResponse(classId, lessonId, stepId, uid, cb) {
      return subscribe(() => cb(read<ResponseDoc | null>(kResponse(classId, lessonId, stepId, uid), null)))
    },
    watchAllResponses(classId, lessonId, stepId, cb) {
      return subscribe(() => {
        const ids = read<string[]>('users', [])
        cb(ids.map((uid) => read<ResponseDoc | null>(kResponse(classId, lessonId, stepId, uid), null)).filter(Boolean) as ResponseDoc[])
      })
    },

    /* ── 모둠 데이터 ── */
    watchGroupShares(classId, lessonId, stepId, cb) {
      return subscribe(() => cb(read<GroupShare[]>(kShares(classId, lessonId, stepId), [])))
    },
    async setGroupShare(classId, lessonId, stepId, share) {
      const key = kShares(classId, lessonId, stepId)
      const list = read<GroupShare[]>(key, []).filter((s) => s.uid !== share.uid)
      list.push({ ...share, updatedAt: Date.now() })
      write(key, list)
    },
    async clearGroupShare(classId, lessonId, stepId, uid) {
      const key = kShares(classId, lessonId, stepId)
      write(key, read<GroupShare[]>(key, []).filter((s) => s.uid !== uid))
    },
    watchGroupValues(classId, lessonId, stepId, cb) {
      return subscribe(() => cb(read<GroupValue[]>(kGroupValues(classId, lessonId, stepId), [])))
    },
    async setGroupValue(classId, lessonId, stepId, value) {
      const key = kGroupValues(classId, lessonId, stepId)
      const list = read<GroupValue[]>(key, []).filter((v) => v.groupId !== value.groupId)
      write(key, [...list, { ...value, updatedAt: Date.now() }])
    },

    /* ── 의견 광장 ── */
    watchPosts(classId, lessonId, stepId, cb) {
      return subscribe(() => cb(read<Post[]>(kPosts(classId, lessonId, stepId), [])))
    },
    async upsertPost(classId, lessonId, stepId, post) {
      const key = kPosts(classId, lessonId, stepId)
      const posts = read<Post[]>(key, []).filter((p) => p.uid !== post.uid)
      const now = Date.now()
      posts.push({ id: post.uid, uid: post.uid, nickname: post.nickname, groupId: post.groupId, versions: [{ v: 1, content: post.content, changedReason: null, createdAt: now }], latestV: 1, createdAt: now })
      write(key, posts)
    },

    /* ── 차시 진행 상태 ── */
    watchSession(classId, lessonId, cb) {
      return subscribe(() => cb(read<SessionState | null>(kSession(classId, lessonId), null)))
    },
    watchSessions(classId, cb) {
      return subscribe(() => cb(allLessonIds().flatMap((l) => read<SessionState | null>(kSession(classId, l), null) ?? [])))
    },
    async setSession(classId, lessonId, patch) {
      const key = kSession(classId, lessonId)
      const cur = read<SessionState | null>(key, null)
      write(key, { ...emptySession(lessonId), ...cur, ...patch, updatedAt: Date.now() } satisfies SessionState)
    },

    /* ── 게임 ── */
    async setGame(classId, lessonId, stepId, state: GameState) {
      const key = kSession(classId, lessonId)
      const cur = read<SessionState | null>(key, null)
      write(key, { ...emptySession(lessonId), ...cur, games: { ...(cur?.games ?? {}), [stepId]: state }, updatedAt: Date.now() })
    },
    async setGameInput(classId, lessonId, input: GameInput) {
      const key = kGameInputs(classId, lessonId, input.stepId)
      const list = read<GameInput[]>(key, []).filter((i) => i.uid !== input.uid)
      write(key, [...list, { ...input, updatedAt: Date.now() }])
    },
    watchGameInputs(classId, lessonId, stepId, cb) {
      return subscribe(() => cb(read<GameInput[]>(kGameInputs(classId, lessonId, stepId), [])))
    },

    /* ── 사다리·봉투 ── */
    async claimLadderSeat(classId, lessonId, gameId, seat, uid) {
      const key = kSession(classId, lessonId)
      const s = read<SessionState | null>(key, null)
      const l = s?.ladders?.[gameId]
      if (!s || !l) return false
      const seatKey = String(seat)
      if (l.seats[seatKey] && l.seats[seatKey] !== uid) return false
      const seats = { ...l.seats }
      for (const k of Object.keys(seats)) if (seats[k] === uid) delete seats[k]
      seats[seatKey] = uid
      write(key, { ...s, ladders: { ...s.ladders, [gameId]: { ...l, seats } } })
      return true
    },
    async setLadder(classId, lessonId, gameId, state) {
      const key = kSession(classId, lessonId)
      const s = read<SessionState | null>(key, null)
      write(key, { ...emptySession(lessonId), ...s, ladders: { ...(s?.ladders ?? {}), [gameId]: state }, updatedAt: Date.now() } as SessionState)
    },
    async recordPick(classId, pick) {
      const picks = read<PickRecord[]>(kPicks(classId), [])
      write(kPicks(classId), [...picks, pick])
    },
    watchPicks(classId, cb) {
      return subscribe(() => cb(read<PickRecord[]>(kPicks(classId), [])))
    },

    /* ── 모둠·참여 ── */
    watchGroups(classId, cb) {
      return subscribe(() => cb(read<Group[]>(kGroups(classId), [])))
    },
    async setGroups(classId, groups) {
      write(kGroups(classId), groups)
    },
    watchParticipation(classId, cb) {
      return subscribe(() => cb(read<Participation[]>(kParticipation(classId), [])))
    },
    async bumpParticipation(classId, uid, patch) {
      const list = read<Participation[]>(kParticipation(classId), [])
      const i = list.findIndex((p) => p.uid === uid)
      const base: Participation = list[i] ?? { uid, presentCount: 0, lastPresentedLessonId: null, postCount: 0, commentCount: 0, contributionTypes: {} }
      const next = { ...base, ...patch }
      if (i >= 0) list[i] = next
      else list.push(next)
      write(kParticipation(classId), list)
    },

    /* ── 모둠 나누기 ── */
    watchPairHistory(classId, cb) {
      return subscribe(() => cb(read<PairHistoryDoc[]>(kPairHistory(classId), [])))
    },
    watchGroupRounds(classId, cb) {
      return subscribe(() => cb(read<GroupRound[]>(kGroupRounds(classId), [])))
    },
    async confirmGroupRound(classId, round) {
      const all = read<GroupRound[]>(kGroupRounds(classId), [])
      const prevRound = all.find((r) => r.id === round.id) ?? null
      write(kGroupRounds(classId), [...all.filter((r) => r.id !== round.id), round])
      const hist = read<PairHistoryDoc[]>(kPairHistory(classId), [])
      const byKey = new Map(hist.map((h) => [h.pairKey, h]))
      const deltas = pairDeltas(prevRound ? prevRound.groups.map((g) => g.memberUids) : null, round.groups.map((g) => g.memberUids))
      for (const [key, delta] of Object.entries(deltas)) {
        const prev = byKey.get(key)
        byKey.set(key, { pairKey: key, count: (prev?.count ?? 0) + delta, lastRound: delta > 0 ? round.round : (prev?.lastRound ?? 0) })
      }
      write(kPairHistory(classId), [...byKey.values()])
      const enrollments = read<Enrollment[]>(kEnrollments(classId), [])
      const groupOf = new Map<string, string>()
      for (const g of round.groups) for (const u of g.memberUids) groupOf.set(u, g.id)
      write(
        kEnrollments(classId),
        enrollments.map((e) =>
          groupOf.has(e.uid) ? { ...e, currentGroupId: groupOf.get(e.uid)!, currentRoundId: round.id } : round.absentUids.includes(e.uid) ? { ...e, currentGroupId: null, currentRoundId: round.id } : e,
        ),
      )
      /* 쓴 질문을 클래스 문서에 기록한다 — 학기 안에 되풀이하지 않는다 */
      const classes = read<ClassDoc[]>('classes', [])
      write('classes', classes.map((c) => (c.id === classId ? { ...c, formationQuestions: { ...(c.formationQuestions ?? {}), [round.lessonId]: round.questionId } } : c)))
    },
    async addLateJoiner(classId, roundId, uid, groupId) {
      const rounds = read<GroupRound[]>(kGroupRounds(classId), [])
      const round = rounds.find((r) => r.id === roundId)
      if (!round) throw new Error('회차가 없습니다.')
      const groups = round.groups.map((g) => ({ ...g, memberUids: g.memberUids.filter((u) => u !== uid) }))
      const target = groups.find((g) => g.id === groupId)
      if (!target) throw new Error('그 모둠이 없습니다.')
      target.memberUids = [...target.memberUids, uid]
      const next: GroupRound = { ...round, groups, absentUids: round.absentUids.filter((u) => u !== uid), lateJoins: [...(round.lateJoins ?? []), { uid, groupId, at: Date.now() }] }
      write(kGroupRounds(classId), rounds.map((r) => (r.id === roundId ? next : r)))
      const hist = read<PairHistoryDoc[]>(kPairHistory(classId), [])
      const byKey = new Map(hist.map((h) => [h.pairKey, h]))
      for (const other of target.memberUids) {
        if (other === uid) continue
        const key = pairKey(uid, other)
        const prev = byKey.get(key)
        byKey.set(key, { pairKey: key, count: (prev?.count ?? 0) + 1, lastRound: round.round })
      }
      write(kPairHistory(classId), [...byKey.values()])
      const enrollments = read<Enrollment[]>(kEnrollments(classId), [])
      write(kEnrollments(classId), enrollments.map((e) => (e.uid === uid ? { ...e, currentGroupId: groupId, currentRoundId: roundId } : e)))
    },
    watchGroupInputs(classId, lessonId, cb) {
      return subscribe(() => cb(read<GroupInput[]>(kGroupInputs(classId, lessonId), [])))
    },
    watchAllGroupInputs(classId, cb) {
      return subscribe(() => cb(allLessonIds().flatMap((l) => read<GroupInput[]>(kGroupInputs(classId, l), []))))
    },
    watchMyGroupInput(classId, lessonId, uid, cb) {
      return subscribe(() => cb(read<GroupInput[]>(kGroupInputs(classId, lessonId), []).find((i) => i.uid === uid) ?? null))
    },
    async setGroupInput(classId, input) {
      const list = read<GroupInput[]>(kGroupInputs(classId, input.lessonId), []).filter((i) => i.uid !== input.uid)
      write(kGroupInputs(classId, input.lessonId), [...list, input])
    },

    /* ── AI 제안 ── */
    watchAiLogs(cb) {
      return subscribe(() => cb([]))
    },
    async addAiProposal(classId, p) {
      const list = read<AiProposal[]>(kProposals(classId), [])
      write(kProposals(classId), [...list, { ...p, status: 'pending', reviewedAt: null, reviewedBy: null }])
    },
    watchAiProposals(classId, cb) {
      return subscribe(() => cb(read<AiProposal[]>(kProposals(classId), [])))
    },
    async reviewAiProposal(classId, id, patch, reviewedBy) {
      const list = read<AiProposal[]>(kProposals(classId), [])
      write(
        kProposals(classId),
        list.map((p) =>
          p.id !== id
            ? p
            : {
                ...p,
                edited: patch.edited ?? p.edited,
                status: patch.status ?? p.status,
                rejectedReason: patch.rejectedReason !== undefined ? patch.rejectedReason : p.rejectedReason,
                reviewedAt: patch.status ? Date.now() : p.reviewedAt,
                reviewedBy: patch.status ? reviewedBy : p.reviewedBy,
              },
        ),
      )
    },
  }
}

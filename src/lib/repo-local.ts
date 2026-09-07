import type { LessonId } from '@/content/types'
import type { TierOverrides } from './tiers'
import { LESSONS } from '@/content/lessons'
import type { Repo } from './repo'
import type {
  AiProposal,
  AppUser,
  ClassDoc,
  Enrollment,
  Group,
  GroupShare,
  Participation,
  PickRecord,
  Post,
  ResponseDoc,
  ResponseVersion,
  RosterEntry,
  SessionState,
} from './types'

/**
 * 로컬 저장 모드.
 *
 * Firebase 없이도 개인 작성·자동 저장·인쇄가 동작한다.
 * 실시간 공유만 "내 것"만 보인다.
 *
 * 강의 당일 네트워크나 Firebase 설정이 어긋나도 수업이 멈추지 않게 하려고 둔 폴백이다.
 * 데이터는 이 브라우저에만 남는다. 다른 기기·다른 브라우저에는 가지 않는다.
 *
 * 클래스 분리는 여기서도 지킨다 — 모든 키에 classId 가 들어간다.
 * 그래야 로컬 모드로 리허설할 때도 실제와 같은 경계를 확인할 수 있다.
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
    // 사생활 보호 창, 저장소 차단, 용량 초과 — 어느 쪽이든 기본값으로 계속 간다.
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(`${NS}.${key}`, JSON.stringify(value))
  } catch {
    /* 저장이 막혀도 화면은 계속 동작한다 */
  }
  notify()
}

/** 구독은 한 곳에서만 처리한다. 어떤 키가 바뀌든 구독자를 다시 부른다. */
function subscribe(run: () => void): () => void {
  run()
  listeners.add(run)
  return () => listeners.delete(run)
}

/* 모든 키가 클래스로 시작한다. 클래스가 다르면 키가 겹칠 수 없다. */
const kResponse = (c: string, l: string, s: string, uid: string) => `c.${c}.res.${l}.${s}.${uid}`
const kPosts = (c: string, l: string, s: string) => `c.${c}.posts.${l}.${s}`
const kShares = (c: string, l: string, s: string) => `c.${c}.shares.${l}.${s}`
const kSession = (c: string, l: string) => `c.${c}.session.${l}`
const kPicks = (c: string) => `c.${c}.picks`
const kGroups = (c: string) => `c.${c}.groups`
const kParticipation = (c: string) => `c.${c}.participation`
const kPublished = (c: string) => `c.${c}.published`
const kTiers = (c: string, l: string) => `c.${c}.tiers.${l}`
const kEnrollments = (c: string) => `c.${c}.enrollments`
const kRoster = (c: string) => `c.${c}.roster`
const kProposals = (c: string) => `c.${c}.aiProposals`

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 새 클래스는 01만 열려 있다. */
const seedPublished = (): LessonId[] => LESSONS.filter((l) => l.published).map((l) => l.id)

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
      // 새 클래스는 01강만 공개 상태로 시작한다.
      write(kPublished(c.id), seedPublished())
    },
    async deleteClass(classId) {
      // 로컬 모드에서도 같은 약속을 지킨다 — 이 클래스로 시작하는 키를 전부 지운다.
      const prefix = `${NS}.c.${classId}.`
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith(prefix)) localStorage.removeItem(key)
        }
      } catch {
        /* 저장소가 막혀 있어도 목록에서는 지운다 */
      }
      const list = read<ClassDoc[]>('classes', [])
      write(
        'classes',
        list.filter((c) => c.id !== classId),
      )
    },
    async updateClass(classId, patch) {
      const list = read<ClassDoc[]>('classes', [])
      write(
        'classes',
        list.map((c) => (c.id === classId ? { ...c, ...patch } : c)),
      )
    },

    /* ── 차시 공개 ── */
    watchLessonState(classId, cb) {
      return subscribe(() => cb(read<LessonId[]>(kPublished(classId), seedPublished())))
    },
    watchLessonTiers(classId, lessonId, cb) {
      return subscribe(() => cb(read<TierOverrides>(kTiers(classId, lessonId), {})))
    },
    async setLessonTier(classId, lessonId, key, tier) {
      const cur = read<TierOverrides>(kTiers(classId, lessonId), {})
      const next = { ...cur }
      if (tier === null) delete next[key]
      else next[key] = tier
      write(kTiers(classId, lessonId), next)
    },

    async setLessonPublished(classId, lessonId, published) {
      const cur = read<LessonId[]>(kPublished(classId), seedPublished())
      const next = published
        ? [...new Set([...cur, lessonId])]
        : cur.filter((x) => x !== lessonId)
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
      const list = read<Enrollment[]>(kEnrollments(classId), [])
      if (list.some((x) => x.uid === e.uid)) return
      write(kEnrollments(classId), [...list, e])
    },
    async updateEnrollment(classId, uid, patch) {
      const list = read<Enrollment[]>(kEnrollments(classId), [])
      write(
        kEnrollments(classId),
        list.map((e) => (e.uid === uid ? { ...e, ...patch } : e)),
      )
    },

    /* ── 명단 실명 (강사만) ── */
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
      const next: ResponseVersion = {
        v: versions.length + 1,
        payload,
        confidence: opts.confidence,
        createdAt: Date.now(),
        changedReason: opts.changedReason,
      }
      // 기존 버전은 건드리지 않고 뒤에만 붙인다.
      write(key, {
        uid,
        versions: [...versions, next],
        latestV: next.v,
        submittedAt: Date.now(),
        draft: null,
      } satisfies ResponseDoc)
    },

    async getResponse(classId, lessonId, stepId, uid) {
      return read<ResponseDoc | null>(kResponse(classId, lessonId, stepId, uid), null)
    },

    watchResponse(classId, lessonId, stepId, uid, cb) {
      return subscribe(() =>
        cb(read<ResponseDoc | null>(kResponse(classId, lessonId, stepId, uid), null)),
      )
    },

    watchAllResponses(classId, lessonId, stepId, cb) {
      // 로컬 모드에서는 이 브라우저의 사용자 것만 있다. 그래서 분포도 작다.
      return subscribe(() => {
        const ids = read<string[]>('users', [])
        const docs = ids
          .map((uid) => read<ResponseDoc | null>(kResponse(classId, lessonId, stepId, uid), null))
          .filter(Boolean) as ResponseDoc[]
        cb(docs)
      })
    },

    /* ── 의견 광장 ── */
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

    watchPosts(classId, lessonId, stepId, cb) {
      return subscribe(() => cb(read<Post[]>(kPosts(classId, lessonId, stepId), [])))
    },

    async addPost(classId, lessonId, stepId, post) {
      const key = kPosts(classId, lessonId, stepId)
      const posts = read<Post[]>(key, [])
      const now = Date.now()
      posts.push({
        id: newId(),
        uid: post.uid,
        nickname: post.nickname,
        groupId: post.groupId,
        versions: [{ v: 1, content: post.content, changedReason: null, createdAt: now }],
        latestV: 1,
        reactions: {},
        comments: [],
        isPinned: false,
        isHidden: false,
        hiddenReason: null,
        createdAt: now,
      })
      write(key, posts)
    },

    async revisePost(classId, lessonId, stepId, postId, content, changedReason) {
      const key = kPosts(classId, lessonId, stepId)
      const posts = read<Post[]>(key, [])
      const p = posts.find((x) => x.id === postId)
      if (!p) return
      // 덮어쓰지 않는다. 새 버전으로 쌓는다.
      p.versions.push({ v: p.latestV + 1, content, changedReason, createdAt: Date.now() })
      p.latestV += 1
      write(key, posts)
    },

    async toggleReaction(classId, lessonId, stepId, postId, uid, reaction) {
      const key = kPosts(classId, lessonId, stepId)
      const posts = read<Post[]>(key, [])
      const p = posts.find((x) => x.id === postId)
      if (!p) return
      const had = (p.reactions?.[reaction] ?? []).includes(uid)
      // 한 사람이 한 글에 하나만. 다른 반응을 누르면 옮겨 간다.
      for (const k of Object.keys(p.reactions)) {
        p.reactions[k] = (p.reactions[k] ?? []).filter((u) => u !== uid)
      }
      if (!had) p.reactions[reaction] = [...(p.reactions[reaction] ?? []), uid]
      write(key, posts)
    },

    async addComment(classId, lessonId, stepId, postId, comment) {
      const key = kPosts(classId, lessonId, stepId)
      const posts = read<Post[]>(key, [])
      const p = posts.find((x) => x.id === postId)
      if (!p) return
      p.comments.push({ id: newId(), ...comment, createdAt: Date.now() })
      write(key, posts)
    },

    async pinPost(classId, lessonId, stepId, postId, pinned) {
      const key = kPosts(classId, lessonId, stepId)
      const posts = read<Post[]>(key, [])
      for (const p of posts) if (p.id === postId) p.isPinned = pinned
      write(key, posts)
    },

    async hidePost(classId, lessonId, stepId, postId, hidden, reason) {
      const key = kPosts(classId, lessonId, stepId)
      const posts = read<Post[]>(key, [])
      for (const p of posts) {
        if (p.id !== postId) continue
        p.isHidden = hidden
        p.hiddenReason = hidden ? reason : null
      }
      write(key, posts)
    },

    async deletePost(classId, lessonId, stepId, postId, uid) {
      const key = kPosts(classId, lessonId, stepId)
      const posts = read<Post[]>(key, [])
      // 삭제는 작성자만.
      write(
        key,
        posts.filter((p) => !(p.id === postId && p.uid === uid)),
      )
    },

    /* ── 차시 진행 상태 ── */
    watchSession(classId, lessonId, cb) {
      return subscribe(() => cb(read<SessionState | null>(kSession(classId, lessonId), null)))
    },

    async setSession(classId, lessonId, patch) {
      const key = kSession(classId, lessonId)
      const cur = read<SessionState | null>(key, null)
      write(key, {
        lessonId,
        currentStepId: null,
        stepOpen: false,
        timerEndsAt: null,
        pollResults: {},
        ladders: {},
        pinnedPostRef: null,
        instructorAt: null,
        ...cur,
        ...patch,
        updatedAt: Date.now(),
      } satisfies SessionState)
    },

    /* ── 사다리 ── */
    async joinLadder(classId, lessonId, gameId, uid) {
      const key = kSession(classId, lessonId)
      const s = read<SessionState | null>(key, null)
      if (!s?.ladders?.[gameId]) return
      const l = s.ladders[gameId]!
      if (!Object.values(l.seats).includes(uid)) {
        // 자리는 아직 안 잡는다. 판에 들어오기만 한다.
        write(key, { ...s, ladders: { ...s.ladders, [gameId]: l } })
      }
    },

    async claimLadderSeat(classId, lessonId, gameId, seat, uid) {
      const key = kSession(classId, lessonId)
      const s = read<SessionState | null>(key, null)
      const l = s?.ladders?.[gameId]
      if (!s || !l) return false
      const seatKey = String(seat)
      // 이미 다른 사람이 가져갔으면 실패로 돌려준다.
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
      write(key, {
        lessonId,
        currentStepId: null,
        stepOpen: false,
        timerEndsAt: null,
        pollResults: {},
        pinnedPostRef: null,
        instructorAt: null,
        ...s,
        ladders: { ...(s?.ladders ?? {}), [gameId]: state },
        updatedAt: Date.now(),
      } as SessionState)
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
      const base: Participation = list[i] ?? {
        uid,
        presentCount: 0,
        lastPresentedLessonId: null,
        postCount: 0,
        commentCount: 0,
        contributionTypes: {},
      }
      const next = { ...base, ...patch }
      if (i >= 0) list[i] = next
      else list.push(next)
      write(kParticipation(classId), list)
    },

    /* ── AI 제안 ── */
    async addAiProposal(classId, p) {
      const list = read<AiProposal[]>(kProposals(classId), [])
      // 언제나 pending 으로 들어간다. 호출자가 status 를 바꿔 보내도 무시한다.
      write(kProposals(classId), [
        ...list,
        { ...p, status: 'pending', reviewedAt: null, reviewedBy: null },
      ])
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
                // original 은 건드리지 않는다. 무엇이 원문이었는지가 자료다.
                edited: patch.edited ?? p.edited,
                status: patch.status ?? p.status,
                rejectedReason:
                  patch.rejectedReason !== undefined ? patch.rejectedReason : p.rejectedReason,
                reviewedAt: patch.status ? Date.now() : p.reviewedAt,
                reviewedBy: patch.status ? reviewedBy : p.reviewedBy,
              },
        ),
      )
    },
  }
}

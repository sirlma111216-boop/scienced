import type { LessonId } from '@/content/types'
import { LESSONS } from '@/content/lessons'
import type { Repo } from './repo'
import type {
  AiProposal,
  AppUser,
  Group,
  Participation,
  PickRecord,
  Post,
  ResponseDoc,
  ResponseVersion,
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

const responseKey = (l: string, s: string, uid: string) => `res.${l}.${s}.${uid}`
const postsKey = (l: string, s: string) => `posts.${l}.${s}`
const sessionKey = (l: string) => `session.${l}`

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
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

    /* ── 응답 ── */
    async saveDraft(lessonId, stepId, uid, payload) {
      const key = responseKey(lessonId, stepId, uid)
      const doc = read<ResponseDoc | null>(key, null)
      write(key, {
        uid,
        versions: doc?.versions ?? [],
        latestV: doc?.latestV ?? 0,
        submittedAt: doc?.submittedAt ?? null,
        draft: { payload, savedAt: Date.now() },
      } satisfies ResponseDoc)
    },

    async submitResponse(lessonId, stepId, uid, payload, opts) {
      const key = responseKey(lessonId, stepId, uid)
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

    async getResponse(lessonId, stepId, uid) {
      return read<ResponseDoc | null>(responseKey(lessonId, stepId, uid), null)
    },

    watchResponse(lessonId, stepId, uid, cb) {
      return subscribe(() => cb(read<ResponseDoc | null>(responseKey(lessonId, stepId, uid), null)))
    },

    watchAllResponses(lessonId, stepId, cb) {
      // 로컬 모드에서는 본인 것만 있다. 그래서 분포도 1명짜리다.
      return subscribe(() => {
        const ids = read<string[]>('users', [])
        const docs = ids
          .map((uid) => read<ResponseDoc | null>(responseKey(lessonId, stepId, uid), null))
          .filter(Boolean) as ResponseDoc[]
        cb(docs)
      })
    },

    /* ── 의견 광장 ── */
    watchPosts(lessonId, stepId, cb) {
      return subscribe(() => cb(read<Post[]>(postsKey(lessonId, stepId), [])))
    },

    async addPost(lessonId, stepId, post) {
      const key = postsKey(lessonId, stepId)
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

    async revisePost(lessonId, stepId, postId, content, changedReason) {
      const key = postsKey(lessonId, stepId)
      const posts = read<Post[]>(key, [])
      const p = posts.find((x) => x.id === postId)
      if (!p) return
      // 덮어쓰지 않는다. 새 버전으로 쌓는다.
      p.versions.push({ v: p.latestV + 1, content, changedReason, createdAt: Date.now() })
      p.latestV += 1
      write(key, posts)
    },

    async toggleReaction(lessonId, stepId, postId, uid, reaction) {
      const key = postsKey(lessonId, stepId)
      const posts = read<Post[]>(key, [])
      const p = posts.find((x) => x.id === postId)
      if (!p) return
      // 한 사람이 한 글에 하나만. 다른 반응을 누르면 옮겨 간다.
      for (const k of Object.keys(p.reactions)) {
        p.reactions[k] = (p.reactions[k] ?? []).filter((u) => u !== uid)
      }
      const had = read<Post[]>(key, []).find((x) => x.id === postId)?.reactions[reaction]?.includes(uid)
      if (!had) p.reactions[reaction] = [...(p.reactions[reaction] ?? []), uid]
      write(key, posts)
    },

    async addComment(lessonId, stepId, postId, comment) {
      const key = postsKey(lessonId, stepId)
      const posts = read<Post[]>(key, [])
      const p = posts.find((x) => x.id === postId)
      if (!p) return
      p.comments.push({ id: newId(), ...comment, createdAt: Date.now() })
      write(key, posts)
    },

    async pinPost(lessonId, stepId, postId, pinned) {
      const key = postsKey(lessonId, stepId)
      const posts = read<Post[]>(key, [])
      for (const p of posts) if (p.id === postId) p.isPinned = pinned
      write(key, posts)
    },

    async hidePost(lessonId, stepId, postId, hidden, reason) {
      const key = postsKey(lessonId, stepId)
      const posts = read<Post[]>(key, [])
      for (const p of posts) {
        if (p.id !== postId) continue
        p.isHidden = hidden
        p.hiddenReason = hidden ? reason : null
      }
      write(key, posts)
    },

    async deletePost(lessonId, stepId, postId, uid) {
      const key = postsKey(lessonId, stepId)
      const posts = read<Post[]>(key, [])
      // 삭제는 작성자만.
      write(
        key,
        posts.filter((p) => !(p.id === postId && p.uid === uid)),
      )
    },

    /* ── 진행 세션 ── */
    watchSession(lessonId, cb) {
      return subscribe(() => cb(read<SessionState | null>(sessionKey(lessonId), null)))
    },

    async setSession(lessonId, patch) {
      const key = sessionKey(lessonId)
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
    async joinLadder(lessonId, gameId, uid) {
      const key = sessionKey(lessonId)
      const s = read<SessionState | null>(key, null)
      if (!s?.ladders?.[gameId]) return
      const l = s.ladders[gameId]!
      if (!Object.values(l.seats).includes(uid)) {
        // 자리는 아직 안 잡는다. 판에 들어오기만 한다.
        write(key, { ...s, ladders: { ...s.ladders, [gameId]: l } })
      }
    },

    async claimLadderSeat(lessonId, gameId, seat, uid) {
      const key = sessionKey(lessonId)
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

    async setLadder(lessonId, gameId, state) {
      const key = sessionKey(lessonId)
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

    async recordPick(pick) {
      const picks = read<PickRecord[]>('picks', [])
      write('picks', [...picks, pick])
    },

    watchPicks(cb) {
      return subscribe(() => cb(read<PickRecord[]>('picks', [])))
    },

    /* ── 모둠·참여 ── */
    watchGroups(cb) {
      return subscribe(() => cb(read<Group[]>('groups', [])))
    },
    async setGroups(groups) {
      write('groups', groups)
    },
    watchParticipation(cb) {
      return subscribe(() => cb(read<Participation[]>('participation', [])))
    },
    async bumpParticipation(uid, patch) {
      const list = read<Participation[]>('participation', [])
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
      write('participation', list)
    },

    /* ── 공개 제어 ── */
    watchPublished(cb) {
      return subscribe(() => {
        const seed = LESSONS.filter((l) => l.published).map((l) => l.id)
        cb(read<LessonId[]>('published', seed))
      })
    },
    async setPublished(lessonId, published) {
      const seed = LESSONS.filter((l) => l.published).map((l) => l.id)
      const cur = read<LessonId[]>('published', seed)
      const next = published ? [...new Set([...cur, lessonId])] : cur.filter((x) => x !== lessonId)
      write('published', next.sort())
    },

    /* ── AI 제안 ── */
    async addAiProposal(p) {
      const list = read<AiProposal[]>('aiProposals', [])
      // 언제나 pending 으로 들어간다. 호출자가 status 를 바꿔 보내도 무시한다.
      write('aiProposals', [...list, { ...p, status: 'pending', reviewedAt: null, reviewedBy: null }])
    },

    watchAiProposals(cb) {
      return subscribe(() => cb(read<AiProposal[]>('aiProposals', [])))
    },

    async reviewAiProposal(id, patch, reviewedBy) {
      const list = read<AiProposal[]>('aiProposals', [])
      write(
        'aiProposals',
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

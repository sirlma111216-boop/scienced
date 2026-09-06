import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  type Firestore,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import type { GameId, LessonId } from '@/content/types'
import { COURSE_ID } from './firebase'
import type { Repo } from './repo'
import type {
  AppUser,
  Group,
  LadderState,
  Participation,
  PickRecord,
  Post,
  ResponseDoc,
  SessionState,
} from './types'

/**
 * Firestore 구현.
 *
 * 경로는 지시서 6절의 데이터 모델을 그대로 따른다.
 * 학생 권한 판정은 여기서 하지 않는다. 전부 firestore.rules 가 막는다.
 * 이 파일의 코드는 규칙이 이미 허용한 일만 한다.
 */

const c = (db: Firestore, ...segments: string[]) =>
  collection(db, 'courses', COURSE_ID, ...segments)
const d = (db: Firestore, ...segments: string[]) => doc(db, 'courses', COURSE_ID, ...segments)

function stepPath(lessonId: string, stepId: string) {
  return ['lessons', lessonId, 'steps', stepId]
}

export function createFirestoreRepo(db: Firestore): Repo {
  return {
    mode: 'realtime',

    /* ── 사용자 ── */
    async getUser(uid) {
      const snap = await getDoc(doc(db, 'users', uid))
      return snap.exists() ? (snap.data() as AppUser) : null
    },
    async upsertUser(user) {
      await setDoc(doc(db, 'users', user.uid), user, { merge: true })
    },
    watchUsers(cb) {
      return onSnapshot(collection(db, 'users'), (snap) =>
        cb(snap.docs.map((s) => s.data() as AppUser)),
      )
    },

    /* ── 응답 ── */
    async saveDraft(lessonId, stepId, uid, payload) {
      await setDoc(
        d(db, ...stepPath(lessonId, stepId), 'responses', uid),
        { uid, draft: { payload, savedAt: Date.now() } },
        { merge: true },
      )
    },

    async submitResponse(lessonId, stepId, uid, payload, opts) {
      const ref = d(db, ...stepPath(lessonId, stepId), 'responses', uid)
      // versions 는 추가만 한다. 트랜잭션으로 읽고 뒤에 붙인다.
      // 규칙에서도 기존 요소 수정·삭제를 막지만, 여기서도 덮어쓰지 않는다.
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        const cur = snap.exists() ? (snap.data() as ResponseDoc) : null
        const versions = cur?.versions ?? []
        tx.set(
          ref,
          {
            uid,
            versions: [
              ...versions,
              {
                v: versions.length + 1,
                payload,
                confidence: opts.confidence,
                createdAt: Date.now(),
                changedReason: opts.changedReason,
              },
            ],
            latestV: versions.length + 1,
            submittedAt: Date.now(),
            draft: null,
          },
          { merge: true },
        )
      })
    },

    async getResponse(lessonId, stepId, uid) {
      const snap = await getDoc(d(db, ...stepPath(lessonId, stepId), 'responses', uid))
      return snap.exists() ? (snap.data() as ResponseDoc) : null
    },

    watchResponse(lessonId, stepId, uid, cb) {
      return onSnapshot(d(db, ...stepPath(lessonId, stepId), 'responses', uid), (snap) =>
        cb(snap.exists() ? (snap.data() as ResponseDoc) : null),
      )
    },

    watchAllResponses(lessonId, stepId, cb) {
      // 강사만 읽을 수 있다. 학생이 부르면 규칙에서 막힌다.
      return onSnapshot(
        c(db, ...stepPath(lessonId, stepId), 'responses'),
        (snap) => cb(snap.docs.map((s) => s.data() as ResponseDoc)),
        () => cb([]),
      )
    },

    /* ── 의견 광장 ── */
    watchPosts(lessonId, stepId, cb) {
      return onSnapshot(
        c(db, ...stepPath(lessonId, stepId), 'posts'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as Post), id: s.id }))),
        // 본인이 제출하기 전에는 읽을 수 없다. 규칙에서 막히면 빈 목록으로 둔다.
        () => cb([]),
      )
    },

    async addPost(lessonId, stepId, post) {
      const ref = doc(c(db, ...stepPath(lessonId, stepId), 'posts'))
      const now = Date.now()
      await setDoc(ref, {
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
    },

    async revisePost(lessonId, stepId, postId, content, changedReason) {
      const ref = d(db, ...stepPath(lessonId, stepId), 'posts', postId)
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists()) return
        const p = snap.data() as Post
        tx.update(ref, {
          versions: [
            ...p.versions,
            { v: p.latestV + 1, content, changedReason, createdAt: Date.now() },
          ],
          latestV: p.latestV + 1,
        })
      })
    },

    async toggleReaction(lessonId, stepId, postId, uid, reaction) {
      const ref = d(db, ...stepPath(lessonId, stepId), 'posts', postId)
      const snap = await getDoc(ref)
      if (!snap.exists()) return
      const p = snap.data() as Post
      const already = (p.reactions?.[reaction] ?? []).includes(uid)
      // 다른 사람 글은 reactions 필드만 바꿀 수 있다 (규칙: changedKeys().hasOnly(['reactions'])).
      const next: Record<string, string[]> = {}
      for (const [k, v] of Object.entries(p.reactions ?? {})) {
        next[k] = v.filter((u) => u !== uid)
      }
      if (!already) next[reaction] = [...(next[reaction] ?? []), uid]
      await updateDoc(ref, { reactions: next })
    },

    async addComment(lessonId, stepId, postId, comment) {
      const ref = d(db, ...stepPath(lessonId, stepId), 'posts', postId)
      // comments 필드만 바꾼다.
      await updateDoc(ref, {
        comments: arrayUnion({
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          ...comment,
          createdAt: Date.now(),
        }),
      })
    },

    async pinPost(lessonId, stepId, postId, pinned) {
      await updateDoc(d(db, ...stepPath(lessonId, stepId), 'posts', postId), { isPinned: pinned })
    },

    async hidePost(lessonId, stepId, postId, hidden, reason) {
      await updateDoc(d(db, ...stepPath(lessonId, stepId), 'posts', postId), {
        isHidden: hidden,
        hiddenReason: hidden ? reason : null,
      })
    },

    async deletePost(lessonId, stepId, postId) {
      // 삭제는 작성자와 강사만. 규칙이 판정한다.
      await deleteDoc(d(db, ...stepPath(lessonId, stepId), 'posts', postId))
    },

    /* ── 진행 세션 ── */
    watchSession(lessonId, cb) {
      return onSnapshot(
        d(db, 'sessions', lessonId),
        (snap) => cb(snap.exists() ? (snap.data() as SessionState) : null),
        () => cb(null),
      )
    },

    async setSession(lessonId, patch) {
      await setDoc(
        d(db, 'sessions', lessonId),
        { lessonId, ...patch, updatedAt: Date.now() },
        { merge: true },
      )
    },

    /* ── 사다리 ── */
    async joinLadder(lessonId, gameId, uid) {
      // 판에 들어오는 것만 기록한다. 자리는 아직 안 잡는다.
      await setDoc(
        d(db, 'sessions', lessonId),
        { pollResults: { [`${gameId}_joined_${uid}`]: 1 } },
        { merge: true },
      )
    },

    /**
     * 자리 선점.
     *
     * 두 사람이 같은 자리를 동시에 누르면 한 명만 가져가야 한다.
     * 자리 잠금은 pollResults map 에 `ladderSeat_...` 키로 얹는다.
     * 키를 이 map 하나에 모으면 새 활동을 추가해도 보안 규칙을 손대지 않아도 된다.
     */
    async claimLadderSeat(lessonId, gameId, seat, uid) {
      const ref = d(db, 'sessions', lessonId)
      try {
        return await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref)
          const s = snap.exists() ? (snap.data() as SessionState) : null
          const l = s?.ladders?.[gameId]
          if (!l) return false
          if (l.phase !== 'seating') return false
          const seatKey = String(seat)
          const taken = l.seats?.[seatKey]
          if (taken && taken !== uid) return false
          const seats = { ...(l.seats ?? {}) }
          for (const k of Object.keys(seats)) if (seats[k] === uid) delete seats[k]
          seats[seatKey] = uid
          tx.set(
            ref,
            {
              ladders: { ...(s?.ladders ?? {}), [gameId]: { ...l, seats } },
              pollResults: { ...(s?.pollResults ?? {}), [`ladderSeatKey_${gameId}_${seat}`]: 1 },
              updatedAt: Date.now(),
            },
            { merge: true },
          )
          return true
        })
      } catch {
        return false
      }
    },

    async setLadder(lessonId, gameId, state) {
      await setDoc(
        d(db, 'sessions', lessonId),
        { lessonId, ladders: { [gameId]: state }, updatedAt: Date.now() },
        { merge: true },
      )
    },

    async recordPick(pick) {
      await setDoc(d(db, 'picks', pick.id), { ...pick, serverAt: serverTimestamp() })
    },

    watchPicks(cb) {
      return onSnapshot(
        c(db, 'picks'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as PickRecord), id: s.id }))),
        () => cb([]),
      )
    },

    /* ── 모둠·참여 ── */
    watchGroups(cb) {
      return onSnapshot(
        c(db, 'groups'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as Group), id: s.id }))),
        () => cb([]),
      )
    },
    async setGroups(groups) {
      await Promise.all(groups.map((g) => setDoc(d(db, 'groups', g.id), g)))
    },
    watchParticipation(cb) {
      return onSnapshot(
        c(db, 'participation'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as Participation), uid: s.id }))),
        () => cb([]),
      )
    },
    async bumpParticipation(uid, patch) {
      await setDoc(d(db, 'participation', uid), { uid, ...patch }, { merge: true })
    },

    /* ── 공개 제어 ── */
    watchPublished(cb) {
      return onSnapshot(
        c(db, 'lessons'),
        (snap) => {
          const ids = snap.docs
            .filter((s) => (s.data() as { published?: boolean }).published)
            .map((s) => s.id as LessonId)
          cb(ids.sort())
        },
        () => cb([]),
      )
    },

    async setPublished(lessonId, published) {
      await setDoc(
        d(db, 'lessons', lessonId),
        { published, publishedAt: published ? Date.now() : null },
        { merge: true },
      )
    },
  }
}

/** arrayRemove 는 지금은 안 쓰지만, 규칙 테스트에서 부분 업데이트를 흉내 낼 때 필요하다. */
export { arrayRemove }
export type { GameId, LadderState }

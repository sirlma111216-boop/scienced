import {
  collection,
  query,
  where,
  FieldPath,
  deleteDoc,
  deleteField,
  doc,
  type Firestore,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { LESSONS } from '@/content/lessons'
import type { GameId, LessonId } from '@/content/types'
import type { Repo } from './repo'
import type {
  AiProposal,
  AppUser,
  ClassDoc,
  Enrollment,
  Group,
  GroupShare,
  LadderState,
  LessonState,
  Participation,
  PickRecord,
  Post,
  ResponseDoc,
  RosterEntry,
  SessionState,
} from './types'

/**
 * Firestore 구현.
 *
 * 경로는 2차 지시서 A.2 의 데이터 모델을 그대로 따른다.
 *   lessons/{lessonId}            콘텐츠 마스터 — 학기와 무관, 한 벌만
 *   classes/{classId}/…           학기별 학생 자료 전부
 *
 * 학생 권한 판정은 여기서 하지 않는다. 전부 firestore.rules 가 막는다.
 * 이 파일의 코드는 규칙이 이미 허용한 일만 한다.
 */

/** 클래스 하위 컬렉션 */
const cc = (db: Firestore, classId: string, ...segments: string[]) =>
  collection(db, 'classes', classId, ...segments)
/** 클래스 하위 문서 */
const cd = (db: Firestore, classId: string, ...segments: string[]) =>
  doc(db, 'classes', classId, ...segments)

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
      return onSnapshot(
        collection(db, 'users'),
        (snap) => cb(snap.docs.map((s) => s.data() as AppUser)),
        () => cb([]),
      )
    },

    /* ── 수강 클래스 ── */
    watchClasses(cb) {
      return onSnapshot(
        collection(db, 'classes'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as ClassDoc), id: s.id }))),
        (err) => {
          /*
           * 오류를 빈 목록으로만 바꾸면 「클래스가 없다」와 「읽지 못했다」가 같아 보인다.
           * 화면은 어느 쪽인지 말할 수 없고, 강사는 만든 클래스가 왜 안 보이는지 알 수 없다.
           * 목록은 비우되(그려야 하므로) 이유는 콘솔에 남긴다.
           */
          console.warn('[classes] 목록을 읽지 못했습니다:', err.code, err.message)
          cb([])
        },
      )
    },
    async createClass(c) {
      await setDoc(doc(db, 'classes', c.id), c)
    },
    async updateClass(classId, patch) {
      await setDoc(doc(db, 'classes', classId), patch, { merge: true })
    },
    async removeEnrollment(classId, uid) {
      /*
       * 사람 하나를 이 클래스에서 지운다.
       *
       * 응답·즉석 모둠 자리·의견 글은 모두 문서 id 가 uid 라서 읽지 않고 바로 지운다.
       * 없는 문서를 지우는 것은 배치에서 아무 일도 하지 않으므로 안전하다.
       * 그래서 왕복이 배치 몇 번으로 끝난다 — 클래스 지우기처럼 훑을 필요가 없다.
       */
      const refs = [
        cd(db, classId, 'enrollments', uid),
        cd(db, classId, 'roster', uid),
        cd(db, classId, 'participation', uid),
      ]
      for (const lesson of LESSONS) {
        for (const step of lesson.steps) {
          const base = stepPath(lesson.id, step.id)
          refs.push(cd(db, classId, ...base, 'responses', uid))
          refs.push(cd(db, classId, ...base, 'groupshares', uid))
          refs.push(cd(db, classId, ...base, 'posts', uid))
        }
      }

      const BATCH = 400
      for (let i = 0; i < refs.length; i += BATCH) {
        const batch = writeBatch(db)
        for (const ref of refs.slice(i, i + BATCH)) batch.delete(ref)
        await batch.commit()
      }

      /*
       * 문서 id 가 uid 가 아니던 시절의 옛 글은 위에서 걸리지 않는다.
       * 그런 글이 남아 있는지 한 번 훑어 지운다. 새 클래스에서는 아무것도 안 걸린다.
       */
      const stray: Array<ReturnType<typeof doc>> = []
      const targets = LESSONS.flatMap((lesson) =>
        lesson.steps.map((step) => cc(db, classId, ...stepPath(lesson.id, step.id), 'posts')),
      )
      const CHUNK = 25
      for (let i = 0; i < targets.length; i += CHUNK) {
        const snaps = await Promise.all(targets.slice(i, i + CHUNK).map((t) => getDocs(t)))
        for (const snap of snaps) {
          for (const d of snap.docs) {
            if ((d.data() as { uid?: string }).uid === uid && d.id !== uid) stray.push(d.ref)
          }
        }
      }
      for (let i = 0; i < stray.length; i += BATCH) {
        const batch = writeBatch(db)
        for (const ref of stray.slice(i, i + BATCH)) batch.delete(ref)
        await batch.commit()
      }
    },

    async deleteClass(classId) {
      /*
       * Firestore 는 문서를 지워도 하위 컬렉션이 남는다.
       * 클래스 문서만 지우면 화면에서는 사라지지만 학생 응답·의견·실명은 그대로 남는다.
       * 지웠다고 말할 수 없는 상태다. 그래서 아래를 전부 훑어 치운 뒤에 지운다.
       *
       * ★ 훑을 곳이 190군데쯤 된다 (10 + 18강 × 단계 × 2).
       *   처음에는 하나씩 기다리며 돌았는데, 왕복이 190번이라 몇 분씩 걸렸다.
       *   화면에는 「지우는 중…」만 떠 있고 끝나지 않는 것처럼 보였다.
       *   그래서 읽기는 묶어서 동시에 하고, 지우기는 배치로 모아 보낸다.
       */
      const targets = [
        'lessonState',
        'enrollments',
        'roster',
        'aggregates',
        'sessions',
        'groups',
        'groupWork',
        'picks',
        'participation',
        'aiProposals',
      ].map((name) => cc(db, classId, name))

      for (const lesson of LESSONS) {
        for (const step of lesson.steps) {
          targets.push(cc(db, classId, ...stepPath(lesson.id, step.id), 'responses'))
          targets.push(cc(db, classId, ...stepPath(lesson.id, step.id), 'posts'))
          targets.push(cc(db, classId, ...stepPath(lesson.id, step.id), 'groupshares'))
        }
      }

      /* 한 번에 다 던지면 브라우저 연결 한도에 걸린다. 25개씩 끊어 동시에 읽는다. */
      const refs: Array<ReturnType<typeof doc>> = []
      const CHUNK = 25
      for (let i = 0; i < targets.length; i += CHUNK) {
        const snaps = await Promise.all(targets.slice(i, i + CHUNK).map((t) => getDocs(t)))
        for (const snap of snaps) for (const d of snap.docs) refs.push(d.ref)
      }

      /* 배치 한 번에 500개까지. 문서를 하나씩 지우면 다시 왕복이 늘어난다. */
      const BATCH = 400
      for (let i = 0; i < refs.length; i += BATCH) {
        const batch = writeBatch(db)
        for (const ref of refs.slice(i, i + BATCH)) batch.delete(ref)
        await batch.commit()
      }

      await deleteDoc(doc(db, 'classes', classId))
    },

    /* ── 차시 공개 (클래스마다 따로) ── */
    watchLessonState(classId, cb) {
      return onSnapshot(
        cc(db, classId, 'lessonState'),
        (snap) => {
          const ids = snap.docs
            .filter((s) => (s.data() as { published?: boolean }).published)
            .map((s) => s.id as LessonId)
          cb(ids.sort())
        },
        () => cb([]),
      )
    },
    watchLessonTiers(classId, lessonId, cb) {
      return onSnapshot(
        cd(db, classId, 'lessonState', lessonId),
        (snap) => cb((snap.data() as LessonState | undefined)?.tierOverrides ?? {}),
        () => cb({}),
      )
    },
    async setLessonTier(classId, lessonId, key, tier) {
      // merge 로 그 열쇠 하나만 건드린다. 다른 강사가 같은 순간 다른 블록을 바꿔도 덮이지 않는다.
      await setDoc(
        cd(db, classId, 'lessonState', lessonId),
        { lessonId, tierOverrides: { [key]: tier ?? deleteField() } },
        { merge: true },
      )
    },

    async setLessonPublished(classId, lessonId, published) {
      await setDoc(
        cd(db, classId, 'lessonState', lessonId),
        { lessonId, published, publishedAt: published ? Date.now() : null },
        { merge: true },
      )
    },

    /* ── 수강 등록 ── */
    watchEnrollments(classId, cb) {
      return onSnapshot(
        cc(db, classId, 'enrollments'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as Enrollment), uid: s.id }))),
        () => cb([]),
      )
    },
    async getEnrollment(classId, uid) {
      const snap = await getDoc(cd(db, classId, 'enrollments', uid))
      return snap.exists() ? ({ ...(snap.data() as Enrollment), uid }) : null
    },
    async enroll(classId, e) {
      await setDoc(cd(db, classId, 'enrollments', e.uid), e)
    },
    async updateEnrollment(classId, uid, patch) {
      await setDoc(cd(db, classId, 'enrollments', uid), patch, { merge: true })
    },

    /* ── 명단 실명 — 강사만 ── */
    watchRoster(classId, cb) {
      // 학생이 부르면 규칙에서 막힌다. 그때는 빈 목록으로 둔다.
      return onSnapshot(
        cc(db, classId, 'roster'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as RosterEntry), uid: s.id }))),
        () => cb([]),
      )
    },
    async setRosterEntry(classId, uid, patch) {
      await setDoc(cd(db, classId, 'roster', uid), { uid, ...patch }, { merge: true })
    },

    /* ── 응답 ── */
    async saveDraft(classId, lessonId, stepId, uid, payload) {
      await setDoc(
        cd(db, classId, ...stepPath(lessonId, stepId), 'responses', uid),
        { uid, draft: { payload, savedAt: Date.now() } },
        { merge: true },
      )
    },

    async submitResponse(classId, lessonId, stepId, uid, payload, opts) {
      const ref = cd(db, classId, ...stepPath(lessonId, stepId), 'responses', uid)
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

    async getResponse(classId, lessonId, stepId, uid) {
      const snap = await getDoc(cd(db, classId, ...stepPath(lessonId, stepId), 'responses', uid))
      return snap.exists() ? (snap.data() as ResponseDoc) : null
    },

    watchResponse(classId, lessonId, stepId, uid, cb) {
      return onSnapshot(
        cd(db, classId, ...stepPath(lessonId, stepId), 'responses', uid),
        (snap) => cb(snap.exists() ? (snap.data() as ResponseDoc) : null),
        () => cb(null),
      )
    },

    watchAllResponses(classId, lessonId, stepId, cb) {
      // 강사만 읽을 수 있다. 학생이 부르면 규칙에서 막힌다.
      return onSnapshot(
        cc(db, classId, ...stepPath(lessonId, stepId), 'responses'),
        (snap) => cb(snap.docs.map((s) => s.data() as ResponseDoc)),
        () => cb([]),
      )
    },

    /* ── 의견 광장 ── */
    watchGroupShares(classId, lessonId, stepId, cb) {
      return onSnapshot(
        cc(db, classId, ...stepPath(lessonId, stepId), 'groupshares'),
        (snap) => cb(snap.docs.map((s) => s.data() as GroupShare)),
        (err) => {
          // 본인이 제출하기 전에는 규칙이 막는다. 그때는 빈 목록이 맞다.
          // 그 밖의 이유라면 화면에는 「아직 아무도 없음」으로 보이므로 콘솔에 남긴다.
          console.warn('[groupshares] 읽지 못했다:', err.code, err.message)
          cb([])
        },
      )
    },

    async setGroupShare(classId, lessonId, stepId, share) {
      const ref = cd(db, classId, ...stepPath(lessonId, stepId), 'groupshares', share.uid)
      await setDoc(ref, { ...share, updatedAt: Date.now() })
    },

    async clearGroupShare(classId, lessonId, stepId, uid) {
      await deleteDoc(cd(db, classId, ...stepPath(lessonId, stepId), 'groupshares', uid))
    },

    watchPosts(classId, lessonId, stepId, cb) {
      return onSnapshot(
        cc(db, classId, ...stepPath(lessonId, stepId), 'posts'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as Post), id: s.id }))),
        // 본인이 제출하기 전에는 읽을 수 없다. 규칙에서 막히면 빈 목록으로 둔다.
        () => cb([]),
      )
    },

    async upsertPost(classId, lessonId, stepId, post) {
      /*
       * 문서 id 가 uid 다. 한 사람이 한 단계에 글 하나.
       * 다시 올리면 내용만 바뀐다 — 반응과 댓글은 그대로 둔다.
       */
      const ref = cd(db, classId, ...stepPath(lessonId, stepId), 'posts', post.uid)
      const now = Date.now()
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        const version = { v: 1, content: post.content, changedReason: null, createdAt: now }
        if (!snap.exists()) {
          tx.set(ref, {
            uid: post.uid,
            nickname: post.nickname,
            groupId: post.groupId,
            versions: [version],
            latestV: 1,
            reactions: {},
            comments: [],
            isPinned: false,
            isHidden: false,
            hiddenReason: null,
            createdAt: now,
          })
          return
        }
        /*
         * 규칙이 작성자에게 versions·latestV 만 열어 준다.
         * createdAt 을 다시 쓰면 changedKeys 에 걸려 통째로 막힌다.
         */
        tx.update(ref, { versions: [version], latestV: 1 })
      })

      /*
       * 문서 id 가 uid 가 아니던 시절에 쓴 글이 남아 있을 수 있다.
       * 그때는 누를 때마다 새 글이 생겨, 같은 사람의 글이 여러 장으로 흩어졌다.
       * 다시 올릴 때 그 옛 글들을 거둔다 — 한 사람에 한 글이 이 화면의 규칙이다.
       * 새 클래스에서는 걸리는 것이 없어 왕복 한 번으로 끝난다.
       */
      const col = cc(db, classId, ...stepPath(lessonId, stepId), 'posts')
      const mine = await getDocs(query(col, where('uid', '==', post.uid)))
      const stray = mine.docs.filter((d) => d.id !== post.uid)
      if (stray.length > 0) {
        const batch = writeBatch(db)
        for (const d of stray) batch.delete(d.ref)
        await batch.commit()
      }
    },

    async toggleReaction(classId, lessonId, stepId, postId, uid, reaction) {
      const ref = cd(db, classId, ...stepPath(lessonId, stepId), 'posts', postId)
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

    async addComment(classId, lessonId, stepId, postId, comment) {
      const ref = cd(db, classId, ...stepPath(lessonId, stepId), 'posts', postId)
      const snap = await getDoc(ref)
      if (!snap.exists()) return
      const p = snap.data() as Post
      // comments 필드만 바꾼다.
      await updateDoc(ref, {
        comments: [
          ...(p.comments ?? []),
          {
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            ...comment,
            createdAt: Date.now(),
          },
        ],
      })
    },

    async pinPost(classId, lessonId, stepId, postId, pinned) {
      await updateDoc(cd(db, classId, ...stepPath(lessonId, stepId), 'posts', postId), {
        isPinned: pinned,
      })
    },

    async hidePost(classId, lessonId, stepId, postId, hidden, reason) {
      await updateDoc(cd(db, classId, ...stepPath(lessonId, stepId), 'posts', postId), {
        isHidden: hidden,
        hiddenReason: hidden ? reason : null,
      })
    },

    async deletePost(classId, lessonId, stepId, postId) {
      // 삭제는 작성자와 강사만. 규칙이 판정한다.
      await deleteDoc(cd(db, classId, ...stepPath(lessonId, stepId), 'posts', postId))
    },

    /* ── 차시 진행 상태 ── */
    watchSession(classId, lessonId, cb) {
      return onSnapshot(
        cd(db, classId, 'sessions', lessonId),
        (snap) => cb(snap.exists() ? (snap.data() as SessionState) : null),
        () => cb(null),
      )
    },

    async setSession(classId, lessonId, patch) {
      await setDoc(
        cd(db, classId, 'sessions', lessonId),
        { lessonId, ...patch, updatedAt: Date.now() },
        { merge: true },
      )
    },

    /* ── 사다리 ── */
    async joinLadder(classId, lessonId, gameId, uid) {
      // 판에 들어오는 것만 기록한다. 자리는 아직 안 잡는다.
      await setDoc(
        cd(db, classId, 'sessions', lessonId),
        { pollResults: { [`${gameId}_joined_${uid}`]: 1 } },
        { merge: true },
      )
    },

    /**
     * 자리 선점.
     *
     * 두 사람이 같은 자리를 동시에 누르면 한 명만 가져가야 한다.
     * 자리 잠금은 pollResults map 에 `ladderSeatKey_…` 키로 얹는다.
     * 키를 이 map 하나에 모으면 새 활동을 추가해도 보안 규칙을 손대지 않아도 된다.
     */
    async claimLadderSeat(classId, lessonId, gameId, seat, uid) {
      const ref = cd(db, classId, 'sessions', lessonId)
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
          /*
           * ★ merge:true 로는 자리를 놓을 수 없다.
           *
           * 예전에는 seats 를 통째로 만들어 delete 로 옛 자리를 지운 뒤 merge 로 썼다.
           * merge 는 지도(map)를 합칠 뿐이라 없어진 열쇠를 서버에서 지우지 않는다.
           * 그래서 자리를 옮기면 옛 자리가 그대로 남아 한 사람이 두 자리를 차지했다.
           * 로컬 저장 구현은 문서를 통째로 다시 써서 이 사고가 드러나지 않았다.
           *
           * 열쇠를 콕 집어 고친다. 지울 자리는 deleteField 로 실제로 지운다.
           * 열쇠에 하이픈과 숫자가 들어가므로 점 경로 문자열 대신 FieldPath 를 쓴다 —
           * '02-sealed-envelope' 같은 이름은 점 경로에서 따옴표를 씌워야 한다.
           */
          const updates: unknown[] = [
            new FieldPath('ladders', gameId, 'seats', seatKey),
            uid,
          ]
          for (const k of Object.keys(l.seats ?? {})) {
            if (k !== seatKey && l.seats?.[k] === uid) {
              updates.push(new FieldPath('ladders', gameId, 'seats', k), deleteField())
            }
          }
          updates.push(new FieldPath('pollResults', `ladderSeatKey_${gameId}_${seat}`), 1)
          updates.push(new FieldPath('updatedAt'), Date.now())
          tx.update(ref, updates[0] as FieldPath, updates[1], ...updates.slice(2))
          return true
        })
      } catch {
        return false
      }
    },

    async setLadder(classId, lessonId, gameId, state) {
      await setDoc(
        cd(db, classId, 'sessions', lessonId),
        { lessonId, ladders: { [gameId]: state }, updatedAt: Date.now() },
        { merge: true },
      )
    },

    async recordPick(classId, pick) {
      await setDoc(cd(db, classId, 'picks', pick.id), { ...pick, serverAt: serverTimestamp() })
    },

    watchPicks(classId, cb) {
      return onSnapshot(
        cc(db, classId, 'picks'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as PickRecord), id: s.id }))),
        () => cb([]),
      )
    },

    /* ── 모둠·참여 ── */
    watchGroups(classId, cb) {
      return onSnapshot(
        cc(db, classId, 'groups'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as Group), id: s.id }))),
        () => cb([]),
      )
    },
    async setGroups(classId, groups) {
      await Promise.all(groups.map((g) => setDoc(cd(db, classId, 'groups', g.id), g)))
    },
    watchParticipation(classId, cb) {
      return onSnapshot(
        cc(db, classId, 'participation'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as Participation), uid: s.id }))),
        () => cb([]),
      )
    },
    async bumpParticipation(classId, uid, patch) {
      await setDoc(cd(db, classId, 'participation', uid), { uid, ...patch }, { merge: true })
    },

    /* ── AI 제안 ── */
    async addAiProposal(classId, p) {
      // 언제나 pending 으로 들어간다. 규칙에서도 create 시 status 를 검사한다.
      await setDoc(cd(db, classId, 'aiProposals', p.id), {
        ...p,
        status: 'pending',
        reviewedAt: null,
        reviewedBy: null,
      })
    },

    watchAiProposals(classId, cb) {
      return onSnapshot(
        cc(db, classId, 'aiProposals'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as AiProposal), id: s.id }))),
        () => cb([]),
      )
    },

    async reviewAiProposal(classId, id, patch, reviewedBy) {
      // original 은 보내지 않는다. 규칙에서도 original 변경을 막는다.
      const next: Record<string, unknown> = {}
      if (patch.edited !== undefined) next.edited = patch.edited
      if (patch.rejectedReason !== undefined) next.rejectedReason = patch.rejectedReason
      if (patch.status) {
        next.status = patch.status
        next.reviewedAt = Date.now()
        next.reviewedBy = reviewedBy
      }
      await updateDoc(cd(db, classId, 'aiProposals', id), next)
    },
  }
}

export type { GameId, LadderState }

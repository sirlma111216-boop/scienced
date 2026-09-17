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
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import type { LessonId } from '@/content/types'
import { COURSE_IDS, courseIdFromTitle, lessonIndex } from '@/content/courses'
import { stepIdsOf } from '@/content/steps'
import type { Repo } from './repo'
import { pairDeltas, pairKey } from '@shared/groups-core'
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
  LadderState,
  PairHistoryDoc,
  Participation,
  PickRecord,
  Post,
  ResponseDoc,
  RosterEntry,
  SessionState,
} from './types'

/**
 * Firestore 구현.
 *   classes/{classId}/…           학기별 학생 자료 전부
 *   …/lessons/{lid}/steps/{sid}/  responses · posts · groupshares · groupValues
 *   …/sessions/{lid}              진행 상태 (열린 단계 · 자료 공개 · 게임 · 루미 런)
 *   …/sessions/{lid}/gameInputs/  학생이 게임에 낸 것 — {stepId}__{uid}
 *
 * 학생 권한 판정은 여기서 하지 않는다. 전부 firestore.rules 가 막는다.
 */

const cc = (db: Firestore, classId: string, ...segments: string[]) => collection(db, 'classes', classId, ...segments)
const cd = (db: Firestore, classId: string, ...segments: string[]) => doc(db, 'classes', classId, ...segments)

function stepPath(lessonId: string, stepId: string) {
  return ['lessons', lessonId, 'steps', stepId]
}

/** 옛 골격(8차 이전)의 단계 id — 지울 때 그 아래도 훑는다 */
const LEGACY_STEP_IDS = ['step-open', 'step-concepts', 'step-module', 'step-formative', 'step-wrapup', 'step-recall', 'step-compare', 'step-auction']

/** 이 클래스가 쓰는 (차시, 단계) — 과목을 모르면 두 과목을 다 훑는다 */
async function stepPathsOf(db: Firestore, classId: string): Promise<Array<[string, string]>> {
  let courses = COURSE_IDS
  try {
    const snap = await getDoc(doc(db, 'classes', classId))
    if (snap.exists()) {
      const c = snap.data() as ClassDoc
      courses = [c.courseId ?? courseIdFromTitle(c.courseTitle)]
    }
  } catch {
    /* 못 읽으면 두 과목 다 */
  }
  const out: Array<[string, string]> = []
  const seen = new Set<string>()
  for (const cid of courses) {
    for (const l of lessonIndex(cid)) {
      for (const s of [...stepIdsOf(l.layout), ...LEGACY_STEP_IDS]) {
        const k = `${l.id}/${s}`
        if (seen.has(k)) continue
        seen.add(k)
        out.push([l.id, s])
      }
    }
  }
  return out
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
        (err) => {
          console.warn('[users] 읽지 못했다:', err.code, err.message)
          cb([])
        },
      )
    },

    /* ── 수강 클래스 ── */
    watchClasses(cb) {
      return onSnapshot(
        collection(db, 'classes'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as ClassDoc), id: s.id }))),
        (err) => {
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
      const refs = [cd(db, classId, 'enrollments', uid), cd(db, classId, 'roster', uid), cd(db, classId, 'participation', uid)]
      const paths = await stepPathsOf(db, classId)
      for (const [lid, sid] of paths) {
        const base = stepPath(lid, sid)
        refs.push(cd(db, classId, ...base, 'responses', uid))
        refs.push(cd(db, classId, ...base, 'groupshares', uid))
        refs.push(cd(db, classId, ...base, 'posts', uid))
      }
      const BATCH = 400
      for (let i = 0; i < refs.length; i += BATCH) {
        const batch = writeBatch(db)
        for (const ref of refs.slice(i, i + BATCH)) batch.delete(ref)
        await batch.commit()
      }
      /* 문서 id 가 uid 가 아니던 시절의 옛 글 */
      const stray: Array<ReturnType<typeof doc>> = []
      const targets = paths.map(([lid, sid]) => cc(db, classId, ...stepPath(lid, sid), 'posts'))
      const CHUNK = 25
      for (let i = 0; i < targets.length; i += CHUNK) {
        const snaps = await Promise.all(targets.slice(i, i + CHUNK).map((t) => getDocs(t)))
        for (const snap of snaps) for (const d of snap.docs) if ((d.data() as { uid?: string }).uid === uid && d.id !== uid) stray.push(d.ref)
      }
      for (let i = 0; i < stray.length; i += BATCH) {
        const batch = writeBatch(db)
        for (const ref of stray.slice(i, i + BATCH)) batch.delete(ref)
        await batch.commit()
      }
    },

    async deleteClass(classId) {
      /*
       * Firestore 는 문서를 지워도 하위 컬렉션이 남는다. 전부 훑어 치운 뒤에 지운다.
       * 읽기는 25개씩 동시에, 지우기는 배치로 — 하나씩 기다리면 몇 분씩 걸린다.
       */
      const targets = ['lessonState', 'enrollments', 'roster', 'aggregates', 'sessions', 'groups', 'groupWork', 'picks', 'participation', 'aiProposals', 'pairHistory', 'groupRounds', 'groupInputs', 'lumiResults'].map((name) => cc(db, classId, name))
      const paths = await stepPathsOf(db, classId)
      for (const [lid, sid] of paths) {
        targets.push(cc(db, classId, ...stepPath(lid, sid), 'responses'))
        targets.push(cc(db, classId, ...stepPath(lid, sid), 'posts'))
        targets.push(cc(db, classId, ...stepPath(lid, sid), 'groupshares'))
        targets.push(cc(db, classId, ...stepPath(lid, sid), 'groupValues'))
      }
      /* 게임 입력은 세션 문서 아래 */
      const lessonIds = [...new Set(paths.map(([lid]) => lid))]
      for (const lid of lessonIds) targets.push(cc(db, classId, 'sessions', lid, 'gameInputs'))

      const refs: Array<ReturnType<typeof doc>> = []
      const CHUNK = 25
      for (let i = 0; i < targets.length; i += CHUNK) {
        const snaps = await Promise.all(targets.slice(i, i + CHUNK).map((t) => getDocs(t)))
        for (const snap of snaps) for (const d of snap.docs) refs.push(d.ref)
      }
      const BATCH = 400
      for (let i = 0; i < refs.length; i += BATCH) {
        const batch = writeBatch(db)
        for (const ref of refs.slice(i, i + BATCH)) batch.delete(ref)
        await batch.commit()
      }
      await deleteDoc(doc(db, 'classes', classId))
    },

    /* ── 차시 공개 ── */
    watchLessonState(classId, cb) {
      return onSnapshot(
        cc(db, classId, 'lessonState'),
        (snap) => {
          const ids = snap.docs.filter((s) => (s.data() as { published?: boolean }).published).map((s) => s.id as LessonId)
          cb(ids.sort())
        },
        (err) => {
          console.warn('[lessonState] 읽지 못했다:', err.code, err.message)
          cb([])
        },
      )
    },
    async setLessonPublished(classId, lessonId, published) {
      await setDoc(cd(db, classId, 'lessonState', lessonId), { lessonId, published, publishedAt: published ? Date.now() : null }, { merge: true })
    },

    /* ── 수강 등록 ── */
    watchEnrollments(classId, cb) {
      return onSnapshot(
        cc(db, classId, 'enrollments'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as Enrollment), uid: s.id }))),
        (err) => {
          console.warn('[enrollments] 읽지 못했다:', err.code, err.message)
          cb([])
        },
      )
    },
    async getEnrollment(classId, uid) {
      const snap = await getDoc(cd(db, classId, 'enrollments', uid))
      return snap.exists() ? { ...(snap.data() as Enrollment), uid } : null
    },
    async enroll(classId, e) {
      /* merge — 내보내진 등록에 남은 모둠 자리 키가 「바뀐 키」에 들어가 규칙에 막히지 않게 */
      await setDoc(cd(db, classId, 'enrollments', e.uid), e, { merge: true })
    },
    async updateEnrollment(classId, uid, patch) {
      await setDoc(cd(db, classId, 'enrollments', uid), patch, { merge: true })
    },

    /* ── 명단 실명 — 강사만 ── */
    watchRoster(classId, cb) {
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
      await setDoc(cd(db, classId, ...stepPath(lessonId, stepId), 'responses', uid), { uid, draft: { payload, savedAt: Date.now() } }, { merge: true })
    },
    async submitResponse(classId, lessonId, stepId, uid, payload, opts) {
      const ref = cd(db, classId, ...stepPath(lessonId, stepId), 'responses', uid)
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        const cur = snap.exists() ? (snap.data() as ResponseDoc) : null
        const versions = cur?.versions ?? []
        tx.set(
          ref,
          {
            uid,
            versions: [...versions, { v: versions.length + 1, payload, confidence: opts.confidence, createdAt: Date.now(), changedReason: opts.changedReason }],
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
        (err) => {
          console.warn('[응답] 내 것을 읽지 못했다:', err.code, err.message)
          cb(null)
        },
      )
    },
    watchAllResponses(classId, lessonId, stepId, cb) {
      return onSnapshot(
        cc(db, classId, ...stepPath(lessonId, stepId), 'responses'),
        (snap) => cb(snap.docs.map((s) => s.data() as ResponseDoc)),
        (err) => {
          console.warn('[분포] 응답을 읽지 못했다:', err.code, err.message)
          cb([])
        },
      )
    },

    /* ── 모둠 데이터 ── */
    watchGroupShares(classId, lessonId, stepId, cb) {
      return onSnapshot(
        cc(db, classId, ...stepPath(lessonId, stepId), 'groupshares'),
        (snap) => cb(snap.docs.map((s) => s.data() as GroupShare)),
        (err) => {
          console.warn('[groupshares] 읽지 못했다:', err.code, err.message)
          cb([])
        },
      )
    },
    async setGroupShare(classId, lessonId, stepId, share) {
      await setDoc(cd(db, classId, ...stepPath(lessonId, stepId), 'groupshares', share.uid), { ...share, updatedAt: Date.now() })
    },
    async clearGroupShare(classId, lessonId, stepId, uid) {
      await deleteDoc(cd(db, classId, ...stepPath(lessonId, stepId), 'groupshares', uid))
    },
    watchGroupValues(classId, lessonId, stepId, cb) {
      return onSnapshot(
        cc(db, classId, ...stepPath(lessonId, stepId), 'groupValues'),
        (snap) => cb(snap.docs.map((s) => s.data() as GroupValue)),
        (err) => {
          console.warn('[groupValues] 읽지 못했다:', err.code, err.message)
          cb([])
        },
      )
    },
    async setGroupValue(classId, lessonId, stepId, value) {
      await setDoc(cd(db, classId, ...stepPath(lessonId, stepId), 'groupValues', value.groupId), { ...value, updatedAt: Date.now() })
    },

    /* ── 의견 광장 ── */
    watchPosts(classId, lessonId, stepId, cb) {
      return onSnapshot(
        cc(db, classId, ...stepPath(lessonId, stepId), 'posts'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as Post), id: s.id }))),
        (err) => {
          console.warn('[광장] 읽지 못했다:', err.code, err.message)
          cb([])
        },
      )
    },
    async upsertPost(classId, lessonId, stepId, post) {
      const ref = cd(db, classId, ...stepPath(lessonId, stepId), 'posts', post.uid)
      const now = Date.now()
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        const version = { v: 1, content: post.content, changedReason: null, createdAt: now }
        if (!snap.exists()) {
          tx.set(ref, { uid: post.uid, nickname: post.nickname, groupId: post.groupId, versions: [version], latestV: 1, reactions: {}, comments: [], isPinned: false, isHidden: false, hiddenReason: null, createdAt: now })
          return
        }
        tx.update(ref, { versions: [version], latestV: 1 })
      })
      /* 문서 id 가 uid 가 아니던 시절의 옛 글을 거둔다 */
      const col = cc(db, classId, ...stepPath(lessonId, stepId), 'posts')
      const mine = await getDocs(query(col, where('uid', '==', post.uid)))
      const stray = mine.docs.filter((d) => d.id !== post.uid)
      if (stray.length > 0) {
        const batch = writeBatch(db)
        for (const d of stray) batch.delete(d.ref)
        await batch.commit()
      }
    },

    /* ── 차시 진행 상태 ── */
    watchSession(classId, lessonId, cb) {
      return onSnapshot(
        cd(db, classId, 'sessions', lessonId),
        (snap) => cb(snap.exists() ? (snap.data() as SessionState) : null),
        (err) => {
          console.warn('[session] 읽지 못했다:', err.code, err.message)
          cb(null)
        },
      )
    },
    async setSession(classId, lessonId, patch) {
      await setDoc(cd(db, classId, 'sessions', lessonId), { lessonId, ...patch, updatedAt: Date.now() }, { merge: true })
    },

    /* ── 게임 ── */
    async setGame(classId, lessonId, stepId, state: GameState) {
      await setDoc(cd(db, classId, 'sessions', lessonId), { lessonId, games: { [stepId]: state }, updatedAt: Date.now() }, { merge: true })
    },
    async setGameInput(classId, lessonId, input: GameInput) {
      await setDoc(cd(db, classId, 'sessions', lessonId, 'gameInputs', `${input.stepId}__${input.uid}`), { ...input, updatedAt: Date.now() })
    },
    watchGameInputs(classId, lessonId, stepId, cb) {
      return onSnapshot(
        query(cc(db, classId, 'sessions', lessonId, 'gameInputs'), where('stepId', '==', stepId)),
        (snap) => cb(snap.docs.map((s) => s.data() as GameInput)),
        (err) => {
          console.warn('[game] 참가 목록을 읽지 못했다:', err.code, err.message)
          cb([])
        },
      )
    },

    /* ── 사다리 (1·2강) ── */
    async claimLadderSeat(classId, lessonId, gameId, seat, uid) {
      const ref = cd(db, classId, 'sessions', lessonId)
      try {
        return await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref)
          const s = snap.exists() ? (snap.data() as SessionState) : null
          const l = s?.ladders?.[gameId]
          if (!l || l.phase !== 'seating') return false
          const seatKey = String(seat)
          const taken = l.seats?.[seatKey]
          if (taken && taken !== uid) return false
          /* merge 는 지도의 없어진 열쇠를 지우지 않는다 — 옛 자리는 deleteField 로 실제로 지운다 */
          const updates: unknown[] = [new FieldPath('ladders', gameId, 'seats', seatKey), uid]
          for (const k of Object.keys(l.seats ?? {})) {
            if (k !== seatKey && l.seats?.[k] === uid) updates.push(new FieldPath('ladders', gameId, 'seats', k), deleteField())
          }
          updates.push(new FieldPath('pollResults', `ladderSeatKey_${gameId}_${seat}`), 1)
          updates.push(new FieldPath('updatedAt'), Date.now())
          tx.update(ref, updates[0] as FieldPath, updates[1], ...updates.slice(2))
          return true
        })
      } catch (err) {
        console.warn('[사다리] 자리를 잡지 못했다:', err)
        return false
      }
    },
    async setLadder(classId, lessonId, gameId, state) {
      await setDoc(cd(db, classId, 'sessions', lessonId), { lessonId, ladders: { [gameId]: state }, updatedAt: Date.now() }, { merge: true })
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

    /* ── 모둠 나누기 ── */
    watchPairHistory(classId, cb) {
      return onSnapshot(
        cc(db, classId, 'pairHistory'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as PairHistoryDoc), pairKey: s.id }))),
        (err) => {
          console.warn('[pairHistory] 읽지 못했다:', err.code, err.message)
          cb([])
        },
      )
    },
    watchGroupRounds(classId, cb) {
      return onSnapshot(
        cc(db, classId, 'groupRounds'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as GroupRound), id: s.id }))),
        (err) => {
          console.warn('[groupRounds] 읽지 못했다:', err.code, err.message)
          cb([])
        },
      )
    },
    async confirmGroupRound(classId, round) {
      const ref = cd(db, classId, 'groupRounds', round.id)
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        const prev = snap.exists() ? (snap.data() as GroupRound) : null
        const deltas = pairDeltas(prev ? prev.groups.map((g) => g.memberUids) : null, round.groups.map((g) => g.memberUids))
        tx.set(ref, round)
        for (const [key, delta] of Object.entries(deltas)) {
          tx.set(cd(db, classId, 'pairHistory', key), delta > 0 ? { pairKey: key, count: increment(delta), lastRound: round.round } : { pairKey: key, count: increment(delta) }, { merge: true })
        }
        const placed = new Set<string>()
        for (const g of round.groups) {
          for (const uid of g.memberUids) {
            placed.add(uid)
            tx.set(cd(db, classId, 'enrollments', uid), { currentGroupId: g.id, currentRoundId: round.id }, { merge: true })
          }
        }
        for (const uid of round.absentUids) {
          placed.add(uid)
          tx.set(cd(db, classId, 'enrollments', uid), { currentGroupId: null, currentRoundId: round.id }, { merge: true })
        }
        for (const g of prev?.groups ?? []) {
          for (const uid of g.memberUids) if (!placed.has(uid)) tx.set(cd(db, classId, 'enrollments', uid), { currentGroupId: null, currentRoundId: round.id }, { merge: true })
        }
        /* 쓴 질문을 클래스 문서에 기록한다 — 학기 안에 되풀이하지 않는다 */
        tx.set(doc(db, 'classes', classId), { formationQuestions: { [round.lessonId]: round.questionId } }, { merge: true })
      })
    },
    async addLateJoiner(classId, roundId, uid, groupId) {
      await runTransaction(db, async (tx) => {
        const ref = cd(db, classId, 'groupRounds', roundId)
        const snap = await tx.get(ref)
        if (!snap.exists()) throw new Error('회차가 없습니다.')
        const round = snap.data() as GroupRound
        const groups = round.groups.map((g) => ({ ...g, memberUids: g.memberUids.filter((u) => u !== uid) }))
        const target = groups.find((g) => g.id === groupId)
        if (!target) throw new Error('그 모둠이 없습니다.')
        target.memberUids = [...target.memberUids, uid]
        tx.update(ref, { groups, absentUids: round.absentUids.filter((u) => u !== uid), lateJoins: [...(round.lateJoins ?? []), { uid, groupId, at: Date.now() }] })
        for (const other of target.memberUids) {
          if (other === uid) continue
          const key = pairKey(uid, other)
          tx.set(cd(db, classId, 'pairHistory', key), { pairKey: key, count: increment(1), lastRound: round.round }, { merge: true })
        }
        tx.set(cd(db, classId, 'enrollments', uid), { currentGroupId: groupId, currentRoundId: roundId }, { merge: true })
      })
    },
    watchGroupInputs(classId, lessonId, cb) {
      return onSnapshot(
        query(cc(db, classId, 'groupInputs'), where('lessonId', '==', lessonId)),
        (snap) => cb(snap.docs.map((s) => s.data() as GroupInput)),
        (err) => {
          console.warn('[groupInputs] 읽지 못했다:', err.code, err.message)
          cb([])
        },
      )
    },
    watchMyGroupInput(classId, lessonId, uid, cb) {
      return onSnapshot(
        cd(db, classId, 'groupInputs', `${lessonId}_${uid}`),
        (snap) => cb(snap.exists() ? (snap.data() as GroupInput) : null),
        (err) => {
          console.warn('[groupInputs] 내 것을 읽지 못했다:', err.code, err.message)
          cb(null)
        },
      )
    },
    async setGroupInput(classId, input) {
      await setDoc(cd(db, classId, 'groupInputs', `${input.lessonId}_${input.uid}`), input)
    },

    /* ── AI 제안 ── */
    watchAiLogs(cb) {
      return onSnapshot(
        collection(db, 'aiLogs'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as AiLog), id: s.id }))),
        (err) => {
          console.warn('[aiLogs] 읽지 못했다:', err.code, err.message)
          cb([])
        },
      )
    },
    async addAiProposal(classId, p) {
      await setDoc(cd(db, classId, 'aiProposals', p.id), { ...p, status: 'pending', reviewedAt: null, reviewedBy: null })
    },
    watchAiProposals(classId, cb) {
      return onSnapshot(
        cc(db, classId, 'aiProposals'),
        (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as AiProposal), id: s.id }))),
        () => cb([]),
      )
    },
    async reviewAiProposal(classId, id, patch, reviewedBy) {
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

export type { LadderState }

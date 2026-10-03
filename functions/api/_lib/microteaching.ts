import type { Env } from '../../../shared/ai-core'
import { isMtSlot, type MtCourseId } from '../../../shared/microteaching'
import { firestoreRest } from './lumi'

/**
 * 마이크로티칭 신청 — 서버가 하는 일 (강의자 지시 2026-10-03).
 *
 * 왜 서버인가.
 *   · 실명은 classes/{cid}/roster 에만 있고 학생은 읽지 못한다. 신청 표에 학번과 이름을 적으려면 서버가 옮겨 적어야 한다.
 *   · 한 자리에 두 사람이 같은 순간 누르면 한 사람만 들어가야 한다 — Firestore commit 의 「없을 때만 만든다」 조건으로 막는다.
 *   · 한 사람이 한 자리다 — 새 자리를 만들면서 옛 자리를 같은 commit 에서 지운다.
 *
 * 저장
 *   classes/{cid}/mtSlots/{slotId}        자리 하나 — { slotId, date, order, uid, studentId, name, nickname, at }
 *   classes/{cid}/mtApplications/{uid}    내 자리 가리킴 — { slotId, at }
 */
type Value = { stringValue?: string; integerValue?: string; nullValue?: null; booleanValue?: boolean; mapValue?: { fields?: Record<string, Value> } }
const S = (v: string): Value => ({ stringValue: v })
const I = (v: number): Value => ({ integerValue: String(Math.round(v)) })
const str = (f: Record<string, Value> | undefined, k: string) => f?.[k]?.stringValue
const int = (f: Record<string, Value> | undefined, k: string) => {
  const v = f?.[k]
  if (!v) return null
  if (v.integerValue !== undefined) return Number(v.integerValue)
  const d = (v as { doubleValue?: number }).doubleValue
  return typeof d === 'number' ? d : null
}

export type MtEnv = Env & { GCP_SERVICE_ACCOUNT?: string; FIRESTORE_EMULATOR_HOST?: string }

export interface MtOutcome {
  ok: boolean
  message?: string
  /** 응답에 함께 돌려주는 자리 — 화면은 구독으로 다시 읽는다 */
  slotId?: string | null
}

async function getDoc(url: string, headers: Record<string, string>): Promise<Record<string, Value> | null | 'error'> {
  const res = await fetch(url, { headers })
  if (res.status === 404) return null
  if (!res.ok) return 'error'
  return ((await res.json()) as { fields?: Record<string, Value> }).fields ?? {}
}

/** 클래스 · 등록 · 명단을 읽어 신청할 자격을 가린다 */
async function load(env: MtEnv, classId: string, uid: string) {
  const rest = await firestoreRest(env)
  if ('error' in rest) return { error: rest.error }
  const h = rest.headers
  const fs = rest.docs
  /* commit 의 write.name 은 전체 자원 이름이다 — 주소에서 호스트와 /v1/ 을 뗀 것 */
  const base = fs.replace(/^https?:\/\/[^/]+\/v1\//, '')

  const cls = await getDoc(`${fs}/classes/${classId}`, h)
  if (cls === 'error') return { error: '클래스를 읽지 못했습니다.' }
  if (!cls) return { error: '그 클래스가 없습니다.' }
  if (str(cls, 'status') !== 'active') return { error: '보관된 클래스입니다.' }
  const courseId: MtCourseId = str(cls, 'courseId') === 'edu' || /교육론/.test(str(cls, 'courseTitle') ?? '') ? 'edu' : 'method'
  const openAt = int(cls, 'microteachingOpenAt')

  const enr = await getDoc(`${fs}/classes/${classId}/enrollments/${uid}`, h)
  if (enr === 'error') return { error: '등록을 읽지 못했습니다.' }

  const pointer = await getDoc(`${fs}/classes/${classId}/mtApplications/${uid}`, h)
  if (pointer === 'error') return { error: '신청 기록을 읽지 못했습니다.' }

  return { rest, h, fs, base, courseId, openAt, enrollment: enr, prevSlotId: pointer ? (str(pointer, 'slotId') ?? null) : null }
}

/** 신청 — 자리를 만들고 옛 자리를 지우고 가리킴을 적는다. 전부 한 commit 이다 */
export async function applyMicroteaching(env: MtEnv, a: { classId: string; uid: string; slotId: string; now: number }): Promise<MtOutcome> {
  const L = await load(env, a.classId, a.uid)
  if ('error' in L) return { ok: false, message: L.error }
  if (!L.enrollment || str(L.enrollment, 'status') !== 'active') return { ok: false, message: '이 클래스의 수강생만 신청할 수 있습니다.' }
  if (typeof L.openAt !== 'number' || a.now < L.openAt) return { ok: false, message: '아직 신청 기간이 아닙니다.' }
  if (!isMtSlot(L.courseId, a.slotId)) return { ok: false, message: '없는 자리입니다. 화면을 새로 고치세요.' }
  if (L.prevSlotId === a.slotId) return { ok: true, slotId: a.slotId }

  /* 이름 — 명단의 실명. 없으면 닉네임 */
  const roster = await getDoc(`${L.fs}/classes/${a.classId}/roster/${a.uid}`, L.h)
  const name = (roster && roster !== 'error' ? str(roster, 'rosterName') : '')?.trim() || str(L.enrollment, 'nickname') || ''
  const [date, order] = a.slotId.split('_')

  const slotName = `${L.base}/classes/${a.classId}/mtSlots/${a.slotId}`
  const pointerName = `${L.base}/classes/${a.classId}/mtApplications/${a.uid}`
  const writes: unknown[] = [
    {
      update: {
        name: slotName,
        fields: {
          slotId: S(a.slotId),
          date: S(date),
          order: I(Number(order)),
          uid: S(a.uid),
          studentId: S(str(L.enrollment, 'studentId') ?? ''),
          name: S(name),
          nickname: S(str(L.enrollment, 'nickname') ?? ''),
          at: I(a.now),
        },
      },
      currentDocument: { exists: false },
    },
    { update: { name: pointerName, fields: { slotId: S(a.slotId), at: I(a.now) } } },
  ]
  if (L.prevSlotId) writes.push({ delete: `${L.base}/classes/${a.classId}/mtSlots/${L.prevSlotId}` })

  const res = await fetch(L.rest.commit, { method: 'POST', headers: L.h, body: JSON.stringify({ writes }) })
  if (res.ok) return { ok: true, slotId: a.slotId }
  const text = await res.text()
  /* 「없을 때만」 조건에 걸렸다 — 그 사이 다른 사람이 들어갔다 */
  if (res.status === 409 || res.status === 400 || /ALREADY_EXISTS|FAILED_PRECONDITION/.test(text)) {
    return { ok: false, message: '방금 다른 사람이 그 자리를 신청했습니다. 다른 자리를 고르세요.' }
  }
  return { ok: false, message: `저장하지 못했습니다 (${res.status}). 잠시 뒤 다시 누르세요.` }
}

/** 취소 — 가리킴이 가리키는 자리와 가리킴을 지운다. 본인 또는 강사가 부른다 */
export async function cancelMicroteaching(env: MtEnv, a: { classId: string; uid: string; byInstructor: boolean }): Promise<MtOutcome> {
  const L = await load(env, a.classId, a.uid)
  if ('error' in L) return { ok: false, message: L.error }
  if (!a.byInstructor && (!L.enrollment || str(L.enrollment, 'status') !== 'active')) return { ok: false, message: '이 클래스의 수강생만 취소할 수 있습니다.' }
  if (!L.prevSlotId) return { ok: true, slotId: null }
  const writes = [{ delete: `${L.base}/classes/${a.classId}/mtSlots/${L.prevSlotId}` }, { delete: `${L.base}/classes/${a.classId}/mtApplications/${a.uid}` }]
  const res = await fetch(L.rest.commit, { method: 'POST', headers: L.h, body: JSON.stringify({ writes }) })
  if (!res.ok) return { ok: false, message: `취소하지 못했습니다 (${res.status}). 잠시 뒤 다시 누르세요.` }
  return { ok: true, slotId: null }
}

import type { Env } from '../../../shared/ai-core'
import { MT_CONTENT_TYPE, MT_FILE_MAX_MB, MT_METHODS, MT_METHOD_OTHER_MAX, MT_TOPIC_MAX, isMtSlot, mtFileKind, type MtCourseId } from '../../../shared/microteaching'
import { TEXTBOOK_UNITS } from '../../../shared/textbook'
import { fail, isInstructorUid, json, verifyIdToken } from './auth'
import { firestoreRest } from './lumi'
import { hmac, sameText, type R2BucketLike } from './textbook'

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
 *   classes/{cid}/mtApplications/{uid}    내 자리 가리킴 — { slotId, at, 발표 내용…, plan }  본인과 강사만 읽는다
 *
 * 발표 내용(학년 · 단원 · 주제 · 수업 방식, 2026-10-16)은 자리 문서와 가리킴 둘 다에 적는다.
 *   자리 문서 — 같은 반 모두가 일정표에서 본다. 가리킴 — 자리를 옮기거나 취소했다 다시 신청해도 남는다(새 자리에 옮겨 적는다).
 * 수업계획안 파일은 가리킴에만(plan) — 본인과 강사만. 양식은 클래스 문서(mtTemplate) — 수강생 모두가 내려받는다.
 */
type Value = { stringValue?: string; integerValue?: string; nullValue?: null; booleanValue?: boolean; mapValue?: { fields?: Record<string, Value> }; arrayValue?: { values?: Value[] } }
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

export type MtEnv = Env & { GCP_SERVICE_ACCOUNT?: string; FIRESTORE_EMULATOR_HOST?: string; TEXTBOOK_BUCKET?: R2BucketLike; TEXTBOOK_SECRET?: string }

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

  return { rest, h, fs, base, cls, courseId, openAt, enrollment: enr, pointer, prevSlotId: pointer ? (str(pointer, 'slotId') ?? null) : null }
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
          /* 적어 둔 발표 내용이 있으면 새 자리에 옮겨 적는다 (2026-10-16) */
          ...carriedDetail(L.pointer),
        },
      },
      currentDocument: { exists: false },
    },
    /* 가리킴은 자리만 바꾼다 — 발표 내용 · 계획안은 그대로 둔다 */
    { update: { name: pointerName, fields: { slotId: S(a.slotId), at: I(a.now) } }, updateMask: { fieldPaths: ['slotId', 'at'] } },
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
  /* 자리는 지우고 가리킴에서는 자리만 뺀다 — 발표 내용과 계획안은 다시 신청할 때를 위해 남긴다 (2026-10-16) */
  const writes = [
    { delete: `${L.base}/classes/${a.classId}/mtSlots/${L.prevSlotId}` },
    { update: { name: `${L.base}/classes/${a.classId}/mtApplications/${a.uid}`, fields: { at: I(Date.now()) } }, updateMask: { fieldPaths: ['slotId', 'at'] } },
  ]
  const res = await fetch(L.rest.commit, { method: 'POST', headers: L.h, body: JSON.stringify({ writes }) })
  if (!res.ok) return { ok: false, message: `취소하지 못했습니다 (${res.status}). 잠시 뒤 다시 누르세요.` }
  return { ok: true, slotId: null }
}

/* ─────────────────────── 발표 내용 (2026-10-16) ─────────────────────── */

const DETAIL_PATHS = ['grade', 'unitId', 'unitTitle', 'topic', 'methods', 'methodOther', 'detailAt']

/** 가리킴에 적힌 발표 내용을 새 자리 문서로 옮긴다 */
function carriedDetail(pointer: Record<string, Value> | null | undefined): Record<string, Value> {
  if (!pointer || !pointer.detailAt) return {}
  return Object.fromEntries(DETAIL_PATHS.filter((k) => pointer[k] !== undefined).map((k) => [k, pointer[k]]))
}

/**
 * 발표 내용 저장 — 신청한 본인만. 자리 문서와 가리킴에 같은 것을 적는다.
 * 학년 · 단원은 교과서 목록(shared/textbook)에서 고른 것만 받는다. 주제와 방식이 비면 받지 않는다.
 */
export async function saveMtDetail(
  env: MtEnv,
  a: { classId: string; uid: string; grade: unknown; unitId: unknown; topic: unknown; methods: unknown; methodOther: unknown; now: number },
): Promise<MtOutcome> {
  const L = await load(env, a.classId, a.uid)
  if ('error' in L) return { ok: false, message: L.error }
  if (!L.enrollment || str(L.enrollment, 'status') !== 'active') return { ok: false, message: '이 클래스의 수강생만 적을 수 있습니다.' }
  if (!L.prevSlotId) return { ok: false, message: '먼저 발표 자리를 신청하세요.' }
  const unit = TEXTBOOK_UNITS.find((u) => u.id === a.unitId)
  if (!unit || unit.grade !== a.grade) return { ok: false, message: '학년과 단원을 고르세요.' }
  const topic = String(a.topic ?? '').trim()
  if (!topic) return { ok: false, message: '발표 주제를 적으세요.' }
  if (topic.length > MT_TOPIC_MAX) return { ok: false, message: `주제는 ${MT_TOPIC_MAX}자 이하로 적으세요.` }
  const methods = Array.isArray(a.methods) ? [...new Set(a.methods.filter((m): m is string => typeof m === 'string' && (MT_METHODS as readonly string[]).includes(m)))] : []
  const other = String(a.methodOther ?? '').trim()
  if (other.length > MT_METHOD_OTHER_MAX) return { ok: false, message: `기타 방식은 ${MT_METHOD_OTHER_MAX}자 이하로 적으세요.` }
  if (!methods.length && !other) return { ok: false, message: '수업 방식을 하나 이상 고르세요.' }
  const fields: Record<string, Value> = {
    grade: I(unit.grade),
    unitId: S(unit.id),
    unitTitle: S(unit.title),
    topic: S(topic),
    methods: { arrayValue: { values: methods.map(S) } },
    methodOther: S(other),
    detailAt: I(a.now),
  }
  const writes = [
    { update: { name: `${L.base}/classes/${a.classId}/mtSlots/${L.prevSlotId}`, fields }, updateMask: { fieldPaths: DETAIL_PATHS }, currentDocument: { exists: true } },
    { update: { name: `${L.base}/classes/${a.classId}/mtApplications/${a.uid}`, fields }, updateMask: { fieldPaths: DETAIL_PATHS } },
  ]
  const res = await fetch(L.rest.commit, { method: 'POST', headers: L.h, body: JSON.stringify({ writes }) })
  if (!res.ok) {
    console.error('[마이크로티칭] 발표 내용을 쓰지 못했다:', res.status, (await res.text()).slice(0, 300))
    return { ok: false, message: '저장하지 못했습니다. 자리가 그 사이 바뀌었으면 화면을 새로 고치세요.' }
  }
  return { ok: true, slotId: L.prevSlotId }
}

/* ─────────────────────── 수업계획안 · 양식 파일 (2026-10-16) ─────────────────────── */

type FileMeta = { key: string; name: string; size: number; ext: string; at: number }
const CLASS_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

function fileMetaOf(v: Value | undefined): FileMeta | null {
  const f = v?.mapValue?.fields
  const key = str(f, 'key')
  if (!f || !key) return null
  return { key, name: str(f, 'name') ?? '', size: int(f, 'size') ?? 0, ext: str(f, 'ext') ?? '', at: int(f, 'at') ?? 0 }
}
const fileMetaValue = (m: FileMeta): Value => ({ mapValue: { fields: { key: S(m.key), name: S(m.name), size: I(m.size), ext: S(m.ext), at: I(m.at) } } })

async function whoCalls(env: MtEnv, request: Request): Promise<{ uid: string; instructor: boolean } | Response> {
  const auth = request.headers.get('authorization')
  const user = await verifyIdToken(auth, env.FIREBASE_PROJECT_ID)
  if (!user) return fail('로그인이 필요합니다.')
  if (!env.FIREBASE_PROJECT_ID) return fail('서버 설정(FIREBASE_PROJECT_ID)이 없습니다.')
  return { uid: user.uid, instructor: await isInstructorUid(env.FIREBASE_PROJECT_ID, user.uid, auth) }
}

declare const FixedLengthStream: undefined | (new (length: number) => { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> })

/** 머리 여덟 바이트로 형식을 본다 — 이름과 맞지 않으면 스트림을 끊는다 */
function kindGate(name: string, state: { bad: boolean }): TransformStream<Uint8Array, Uint8Array> {
  let head = new Uint8Array(0)
  let checked = false
  const check = (ctl: TransformStreamDefaultController<Uint8Array>) => {
    checked = true
    if (!mtFileKind(name, head)) {
      state.bad = true
      ctl.error(new Error('BAD_KIND'))
      return false
    }
    ctl.enqueue(head)
    return true
  }
  return new TransformStream({
    transform(chunk, ctl) {
      if (checked) return ctl.enqueue(chunk)
      const merged = new Uint8Array(head.length + chunk.length)
      merged.set(head)
      merged.set(chunk, head.length)
      head = merged
      if (head.length >= 8) check(ctl)
    },
    flush(ctl) {
      if (!checked) check(ctl)
    },
  })
}

/**
 * PUT /api/microteaching/{template|plan}?classId=… — 본문이 파일 그대로. 머리 x-file-name(encodeURIComponent).
 *   template  강사만. 클래스 문서 mtTemplate 에 적는다 — 수강생 모두가 내려받는다.
 *   plan      신청한 본인만, 양식이 올라온 뒤에. 가리킴 plan 에 적는다 — 본인과 강사만 내려받는다.
 * 새 파일을 넣고 크기를 확인해 연결한 뒤에 옛 파일을 지운다. 실패하면 새 파일을 지우고 옛 것은 그대로다.
 */
export async function handleMtUpload(env: MtEnv, request: Request, kind: 'template' | 'plan', now = Date.now()): Promise<Response> {
  const c = await whoCalls(env, request)
  if (c instanceof Response) return c
  const bucket = env.TEXTBOOK_BUCKET
  if (!bucket) return fail('파일 저장소가 아직 연결되지 않았습니다. 사이트 관리자에게 알려 주세요.')
  const classId = new URL(request.url).searchParams.get('classId') ?? ''
  if (!CLASS_ID_RE.test(classId)) return fail('클래스 id 가 없습니다.')
  if (kind === 'template' && !c.instructor) return fail('양식은 강사만 올릴 수 있습니다.')

  const len = Number(request.headers.get('content-length'))
  if (!Number.isFinite(len) || len <= 0) return fail('파일 크기를 알 수 없습니다. 다시 고르세요.')
  if (len > MT_FILE_MAX_MB * 1024 * 1024) return fail(`파일이 너무 큽니다 — ${MT_FILE_MAX_MB} MB 까지 올릴 수 있습니다.`)
  let name = ''
  try {
    name = decodeURIComponent(request.headers.get('x-file-name') ?? '').trim()
  } catch {
    name = ''
  }
  name = name.replace(/[\\/\0]/g, '_').slice(-200)
  const ext = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? '').toLowerCase() as keyof typeof MT_CONTENT_TYPE
  if (!MT_CONTENT_TYPE[ext]) return fail('한글(hwp · hwpx) · 워드(docx · doc) · PDF 파일만 올릴 수 있습니다.')
  if (!request.body) return fail('파일이 비어 있습니다.')

  const L = await load(env, classId, c.uid)
  if ('error' in L) return fail(L.error ?? '클래스를 읽지 못했습니다.')
  if (kind === 'plan') {
    if (!L.enrollment || str(L.enrollment, 'status') !== 'active') return fail('이 클래스의 수강생만 낼 수 있습니다.')
    if (!L.prevSlotId) return fail('먼저 발표 자리를 신청하세요.')
    if (!fileMetaOf(L.cls.mtTemplate)) return fail('강의자가 수업계획안 양식을 올린 뒤에 낼 수 있습니다.')
  }
  const old = kind === 'template' ? fileMetaOf(L.cls.mtTemplate) : fileMetaOf(L.pointer?.plan)
  const key = kind === 'template' ? `microteaching/${classId}/template/${crypto.randomUUID()}.${ext}` : `microteaching/${classId}/plans/${c.uid}/${crypto.randomUUID()}.${ext}`

  const state = { bad: false }
  const gated = request.body.pipeThrough(kindGate(name, state))
  let stream: ReadableStream<Uint8Array> = gated
  if (typeof FixedLengthStream === 'function') {
    const fixed = new FixedLengthStream(len)
    void gated.pipeTo(fixed.writable).catch(() => {})
    stream = fixed.readable
  }
  const notKind = '파일 내용이 이름의 형식(한글 · 워드 · PDF)과 맞지 않습니다. 파일을 다시 확인하세요.'
  try {
    await bucket.put(key, stream, { httpMetadata: { contentType: MT_CONTENT_TYPE[ext] }, customMetadata: { classId, kind, uid: c.uid } })
  } catch (err) {
    await bucket.delete(key).catch(() => {})
    if (state.bad) return fail(notKind)
    console.error('[마이크로티칭] 파일을 저장하지 못했다:', err)
    return fail('파일을 저장하지 못했습니다. 잠시 뒤 다시 올리세요. 전에 올린 파일은 그대로입니다.')
  }
  if (state.bad) {
    await bucket.delete(key).catch(() => {})
    return fail(notKind)
  }
  const head = await bucket.head(key).catch(() => null)
  if (!head || head.size !== len) {
    await bucket.delete(key).catch(() => {})
    return fail('파일이 끝까지 올라가지 않았습니다. 다시 올리세요. 전에 올린 파일은 그대로입니다.')
  }
  const meta: FileMeta = { key, name, size: len, ext, at: now }
  const write =
    kind === 'template'
      ? { update: { name: `${L.base}/classes/${classId}`, fields: { mtTemplate: fileMetaValue(meta) } }, updateMask: { fieldPaths: ['mtTemplate'] }, currentDocument: { exists: true } }
      : { update: { name: `${L.base}/classes/${classId}/mtApplications/${c.uid}`, fields: { plan: fileMetaValue(meta) } }, updateMask: { fieldPaths: ['plan'] } }
  const res = await fetch(L.rest.commit, { method: 'POST', headers: L.h, body: JSON.stringify({ writes: [write] }) })
  if (!res.ok) {
    await bucket.delete(key).catch(() => {})
    console.error('[마이크로티칭] 파일을 연결하지 못했다:', res.status, (await res.text()).slice(0, 300))
    return fail('파일을 연결하지 못했습니다. 전에 올린 파일은 그대로입니다.')
  }
  if (old && old.key !== key) await bucket.delete(old.key).catch((err) => console.error('[마이크로티칭] 옛 파일을 지우지 못했다:', old.key, err))
  return json({ ok: true, file: { name, size: len, ext, at: now } })
}

const signText = (classId: string, kind: string, owner: string, key: string, exp: number) => `mt\n${classId}\n${kind}\n${owner}\n${key}\n${exp}`

/**
 * POST /api/microteaching/file-url — { classId, kind: 'template' | 'plan', uid? } → { ok, url, name }
 *   template  수강생(등록 active)과 강사.   plan  본인(uid 없이) 또는 강사(uid 를 적어).
 * 주소는 10분짜리 서명 주소다. 서명에 파일 키가 들어가 파일을 바꾸면 옛 주소가 죽는다.
 */
export async function handleMtFileUrl(env: MtEnv, request: Request, now = Date.now()): Promise<Response> {
  const c = await whoCalls(env, request)
  if (c instanceof Response) return c
  let b: { classId?: string; kind?: string; uid?: string }
  try {
    b = (await request.json()) as typeof b
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  if (!b.classId || !CLASS_ID_RE.test(b.classId) || (b.kind !== 'template' && b.kind !== 'plan')) return fail('요청 형식이 올바르지 않습니다.')
  if (!env.TEXTBOOK_SECRET) return fail('파일 내려받기 설정이 아직 끝나지 않았습니다. 사이트 관리자에게 알려 주세요.')
  const owner = b.kind === 'plan' ? (b.uid && b.uid !== c.uid ? b.uid : c.uid) : '-'
  if (b.kind === 'plan' && owner !== c.uid && !c.instructor) return fail('다른 사람의 계획안은 강사만 내려받을 수 있습니다.')
  const L = await load(env, b.classId, c.uid)
  if ('error' in L) return fail(L.error ?? '클래스를 읽지 못했습니다.')
  if (!c.instructor && (!L.enrollment || str(L.enrollment, 'status') !== 'active')) return fail('이 클래스의 수강생만 내려받을 수 있습니다.')
  let meta: FileMeta | null = null
  if (b.kind === 'template') meta = fileMetaOf(L.cls.mtTemplate)
  else {
    const p = owner === c.uid ? L.pointer : await getDoc(`${L.fs}/classes/${b.classId}/mtApplications/${owner}`, L.h)
    meta = p && p !== 'error' ? fileMetaOf(p.plan) : null
  }
  if (!meta) return fail(b.kind === 'template' ? '아직 올라온 양식이 없습니다.' : '아직 낸 계획안이 없습니다.')
  const exp = now + 10 * 60 * 1000
  const sig = await hmac(env.TEXTBOOK_SECRET, signText(b.classId, b.kind, owner, meta.key, exp))
  return json({ ok: true, name: meta.name, url: `/api/microteaching/file?c=${encodeURIComponent(b.classId)}&k=${b.kind}&u=${encodeURIComponent(owner)}&exp=${exp}&sig=${sig}` })
}

const plainText = (status: number, text: string) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })

/** GET /api/microteaching/file?c&k&u&exp&sig — 서명된 주소로 파일을 내려보낸다 (통째로 메모리에 올리지 않는다) */
export async function handleMtFile(env: MtEnv, request: Request, now = Date.now()): Promise<Response> {
  const u = new URL(request.url)
  const classId = u.searchParams.get('c') ?? ''
  const kind = u.searchParams.get('k') ?? ''
  const owner = u.searchParams.get('u') ?? ''
  const exp = Number(u.searchParams.get('exp'))
  const sig = u.searchParams.get('sig') ?? ''
  if (!CLASS_ID_RE.test(classId) || (kind !== 'template' && kind !== 'plan') || !owner || !Number.isFinite(exp) || !/^[0-9a-f]{64}$/.test(sig)) return plainText(400, '주소가 올바르지 않습니다.')
  if (now > exp) return plainText(403, '주소의 유효 시간이 지났습니다. 화면에서 다시 누르세요.')
  if (!env.TEXTBOOK_SECRET || !env.TEXTBOOK_BUCKET) return plainText(503, '파일 저장소가 아직 연결되지 않았습니다.')
  const rest = await firestoreRest(env)
  if ('error' in rest) return plainText(503, '서버 설정이 없습니다.')
  const doc = await getDoc(kind === 'template' ? `${rest.docs}/classes/${classId}` : `${rest.docs}/classes/${classId}/mtApplications/${owner}`, rest.headers)
  const meta = doc && doc !== 'error' ? fileMetaOf(kind === 'template' ? doc.mtTemplate : doc.plan) : null
  if (!meta) return plainText(404, '파일이 없습니다.')
  const want = await hmac(env.TEXTBOOK_SECRET, signText(classId, kind, owner, meta.key, exp))
  if (!sameText(want, sig)) return plainText(403, '파일이 바뀌었거나 주소가 맞지 않습니다. 화면에서 다시 누르세요.')
  const obj = await env.TEXTBOOK_BUCKET.get(meta.key)
  if (!obj) return plainText(404, '파일이 없습니다.')
  return new Response(obj.body, {
    status: 200,
    headers: {
      'content-type': MT_CONTENT_TYPE[meta.ext as keyof typeof MT_CONTENT_TYPE] ?? 'application/octet-stream',
      'content-length': String(obj.size),
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(meta.name || 'file')}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}

/** POST /api/microteaching/detail — { classId, grade, unitId, topic, methods, methodOther } 발표 내용 저장 (본인) */
export async function handleMtDetail(env: MtEnv, request: Request, now = Date.now()): Promise<Response> {
  const c = await whoCalls(env, request)
  if (c instanceof Response) return c
  let b: { classId?: string; grade?: unknown; unitId?: unknown; topic?: unknown; methods?: unknown; methodOther?: unknown }
  try {
    b = (await request.json()) as typeof b
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  if (!b.classId || !CLASS_ID_RE.test(b.classId)) return fail('클래스 id 가 없습니다.')
  return json(await saveMtDetail(env, { classId: b.classId, uid: c.uid, grade: b.grade, unitId: b.unitId, topic: b.topic, methods: b.methods, methodOther: b.methodOther, now }))
}

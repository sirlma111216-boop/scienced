import type { Env } from '../../../shared/ai-core'
import { MT_CONTENT_TYPE, MT_FILE_MAX_MB, MT_NOTE_MAX, MT_PEER_MAX, MT_TOPIC_MAX, MT_VIDEO_CONTENT_TYPE, MT_VIDEO_MAX_MB, MT_VIDEO_PART_MB, isMtSlot, mtFileKind, mtVideoKind, type MtCourseId } from '../../../shared/microteaching'
import { fail, isInstructorUid, json, verifyIdToken } from './auth'
import { firestoreRest } from './lumi'
import { hmac, parseRange, sameText, type R2BucketLike, type R2UploadedPartLike } from './textbook'

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
 *
 * 2026-10-17 (강의자 지시 — 마이크로티칭이 임박):
 *   가리킴에 더 적는 것   planFeedback(강사가 지도안에) · video(강사가 올린 수업 영상) · reflection(학생 후기) · videoFeedback(강사가 수업에)
 *   동료 의견            classes/{cid}/mtPeer/{presenterUid}__{authorUid} — 다른 수강생이 수업을 들으며 적는 훌륭한 점 · 개선점.
 *                       강사는 이름과 함께, 발표자는 **익명으로 번호만** 본다(서버가 섞어서 준다). 쓴 사람은 자기 것만 본다.
 *   영상은 조각 올리기(R2 multipart) — 요청 하나가 100 MB 를 넘지 못하므로 48 MB 씩 잘라 올리고 마지막에 합친다.
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
 * 주제만 받는다. 기존 학년 · 단원 · 방식은 저장된 기록에 보존한다.
 */
export async function saveMtDetail(
  env: MtEnv,
  a: { classId: string; uid: string; topic: unknown; now: number },
): Promise<MtOutcome> {
  const L = await load(env, a.classId, a.uid)
  if ('error' in L) return { ok: false, message: L.error }
  if (!L.enrollment || str(L.enrollment, 'status') !== 'active') return { ok: false, message: '이 클래스의 수강생만 적을 수 있습니다.' }
  if (!L.prevSlotId) return { ok: false, message: '먼저 발표 자리를 신청하세요.' }
  const topic = typeof a.topic === 'string' ? a.topic.trim() : ''
  if (!topic) return { ok: false, message: '발표 주제를 적으세요.' }
  if (topic.length > MT_TOPIC_MAX) return { ok: false, message: `주제는 ${MT_TOPIC_MAX}자 이하로 적으세요.` }
  const fields: Record<string, Value> = { topic: S(topic), detailAt: I(a.now) }
  const topicPaths = ['topic', 'detailAt']
  const writes = [
    { update: { name: `${L.base}/classes/${a.classId}/mtSlots/${L.prevSlotId}`, fields }, updateMask: { fieldPaths: topicPaths }, currentDocument: { exists: true } },
    { update: { name: `${L.base}/classes/${a.classId}/mtApplications/${a.uid}`, fields }, updateMask: { fieldPaths: topicPaths } },
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
  let b: { classId?: string; kind?: string; uid?: string; inline?: boolean }
  try {
    b = (await request.json()) as typeof b
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  if (!b.classId || !CLASS_ID_RE.test(b.classId) || (b.kind !== 'template' && b.kind !== 'plan' && b.kind !== 'video')) return fail('요청 형식이 올바르지 않습니다.')
  if (!env.TEXTBOOK_SECRET) return fail('파일 내려받기 설정이 아직 끝나지 않았습니다. 사이트 관리자에게 알려 주세요.')
  const owner = b.kind === 'template' ? '-' : b.uid && b.uid !== c.uid ? b.uid : c.uid
  if (b.kind !== 'template' && owner !== c.uid && !c.instructor) return fail(b.kind === 'video' ? '다른 사람의 수업 영상은 강사만 볼 수 있습니다.' : '다른 사람의 계획안은 강사만 내려받을 수 있습니다.')
  const L = await load(env, b.classId, c.uid)
  if ('error' in L) return fail(L.error ?? '클래스를 읽지 못했습니다.')
  if (!c.instructor && (!L.enrollment || str(L.enrollment, 'status') !== 'active')) return fail('이 클래스의 수강생만 내려받을 수 있습니다.')
  let meta: FileMeta | null = null
  if (b.kind === 'template') meta = fileMetaOf(L.cls.mtTemplate)
  else {
    const p = owner === c.uid ? L.pointer : await getDoc(`${L.fs}/classes/${b.classId}/mtApplications/${owner}`, L.h)
    meta = p && p !== 'error' ? fileMetaOf(b.kind === 'video' ? p.video : p.plan) : null
  }
  if (!meta) return fail(b.kind === 'template' ? '아직 올라온 양식이 없습니다.' : b.kind === 'video' ? '아직 올라온 수업 영상이 없습니다.' : '아직 낸 계획안이 없습니다.')
  /* 영상은 보는 동안 주소가 살아 있어야 한다 — 2시간. 문서는 10분 */
  const exp = now + (b.kind === 'video' ? 2 * 60 * 60 * 1000 : 10 * 60 * 1000)
  const sig = await hmac(env.TEXTBOOK_SECRET, signText(b.classId, b.kind, owner, meta.key, exp))
  /* inline — 화면 안에서 연다(PDF · 영상). 그 밖의 파일은 내려받기 */
  const inline = b.kind === 'video' || (b.inline === true && meta.ext === 'pdf')
  return json({ ok: true, name: meta.name, ext: meta.ext, size: meta.size, inline, url: `/api/microteaching/file?c=${encodeURIComponent(b.classId)}&k=${b.kind}&u=${encodeURIComponent(owner)}&exp=${exp}&sig=${sig}${inline ? '&i=1' : ''}` })
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
  const inline = u.searchParams.get('i') === '1'
  if (!CLASS_ID_RE.test(classId) || (kind !== 'template' && kind !== 'plan' && kind !== 'video') || !owner || !Number.isFinite(exp) || !/^[0-9a-f]{64}$/.test(sig)) return plainText(400, '주소가 올바르지 않습니다.')
  if (now > exp) return plainText(403, '주소의 유효 시간이 지났습니다. 화면에서 다시 누르세요.')
  if (!env.TEXTBOOK_SECRET || !env.TEXTBOOK_BUCKET) return plainText(503, '파일 저장소가 아직 연결되지 않았습니다.')
  const rest = await firestoreRest(env)
  if ('error' in rest) return plainText(503, '서버 설정이 없습니다.')
  const doc = await getDoc(kind === 'template' ? `${rest.docs}/classes/${classId}` : `${rest.docs}/classes/${classId}/mtApplications/${owner}`, rest.headers)
  const meta = doc && doc !== 'error' ? fileMetaOf(kind === 'template' ? doc.mtTemplate : kind === 'video' ? doc.video : doc.plan) : null
  if (!meta) return plainText(404, '파일이 없습니다.')
  const want = await hmac(env.TEXTBOOK_SECRET, signText(classId, kind, owner, meta.key, exp))
  if (!sameText(want, sig)) return plainText(403, '파일이 바뀌었거나 주소가 맞지 않습니다. 화면에서 다시 누르세요.')
  const head = await env.TEXTBOOK_BUCKET.head(meta.key)
  if (!head) return plainText(404, '파일이 없습니다.')
  const type = (kind === 'video' ? MT_VIDEO_CONTENT_TYPE[meta.ext as keyof typeof MT_VIDEO_CONTENT_TYPE] : MT_CONTENT_TYPE[meta.ext as keyof typeof MT_CONTENT_TYPE]) ?? 'application/octet-stream'
  const headers = new Headers({
    'content-type': type,
    'accept-ranges': 'bytes',
    'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(meta.name || 'file')}`,
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
  })
  /* 영상은 Range 로 조금씩 받는다 — 되감기 · 건너뛰기가 이것으로 된다 */
  const range = parseRange(request.headers.get('range'), head.size)
  if (range === 'bad') return new Response(null, { status: 416, headers: { 'content-range': `bytes */${head.size}` } })
  if (request.method === 'HEAD') {
    headers.set('content-length', String(head.size))
    return new Response(null, { status: 200, headers })
  }
  const obj = await env.TEXTBOOK_BUCKET.get(meta.key, range ? { range } : undefined)
  if (!obj) return plainText(404, '파일이 없습니다.')
  if (range) {
    headers.set('content-range', `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`)
    headers.set('content-length', String(range.length))
    return new Response(obj.body, { status: 206, headers })
  }
  headers.set('content-length', String(head.size))
  return new Response(obj.body, { status: 200, headers })
}

/** POST /api/microteaching/detail — { classId, topic } 발표 내용 저장 (본인) */
export async function handleMtDetail(env: MtEnv, request: Request, now = Date.now()): Promise<Response> {
  const c = await whoCalls(env, request)
  if (c instanceof Response) return c
  let b: { classId?: string; topic?: unknown }
  try {
    b = (await request.json()) as typeof b
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  if (!b.classId || !CLASS_ID_RE.test(b.classId)) return fail('클래스 id 가 없습니다.')
  return json(await saveMtDetail(env, { classId: b.classId, uid: c.uid, topic: b.topic, now }))
}

/* ─────────────────────── 글 — 지도안 피드백 · 수업 피드백 · 후기 (2026-10-17) ─────────────────────── */

const noteValue = (text: string, at: number): Value => ({ mapValue: { fields: { text: S(text), at: I(at) } } })

/**
 * POST /api/microteaching/note — { classId, field, text, uid? }
 *   planFeedback · videoFeedback   강사만, uid 로 학생을 가리킨다. 신청한 학생이어야 한다
 *   reflection                     본인만. 자기 수업 영상이 올라온 뒤에 쓴다
 * 빈 글을 보내면 지운다. 글은 신청 기록(가리킴)에만 있어 본인과 강사만 읽는다.
 */
export async function handleMtNote(env: MtEnv, request: Request, now = Date.now()): Promise<Response> {
  const c = await whoCalls(env, request)
  if (c instanceof Response) return c
  let b: { classId?: string; field?: string; text?: unknown; uid?: string }
  try {
    b = (await request.json()) as typeof b
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  if (!b.classId || !CLASS_ID_RE.test(b.classId)) return fail('클래스 id 가 없습니다.')
  const field = b.field
  if (field !== 'planFeedback' && field !== 'videoFeedback' && field !== 'reflection') return fail('요청 형식이 올바르지 않습니다.')
  const text = String(b.text ?? '').trim()
  if (text.length > MT_NOTE_MAX) return fail(`${MT_NOTE_MAX}자 이하로 적으세요.`)
  const byInstructor = field !== 'reflection'
  if (byInstructor && !c.instructor) return fail('피드백은 강사만 쓸 수 있습니다.')
  const owner = byInstructor ? String(b.uid ?? '') : c.uid
  if (!owner) return fail('누구의 기록인지 적으세요.')
  const L = await load(env, b.classId, owner)
  if ('error' in L) return fail(L.error ?? '클래스를 읽지 못했습니다.')
  if (!byInstructor && (!L.enrollment || str(L.enrollment, 'status') !== 'active')) return fail('이 클래스의 수강생만 쓸 수 있습니다.')
  if (!L.pointer || !L.prevSlotId) return fail(byInstructor ? '발표를 신청한 학생이 아닙니다.' : '먼저 발표 자리를 신청하세요.')
  if (field === 'planFeedback' && !fileMetaOf(L.pointer.plan)) return fail('아직 낸 지도안이 없습니다.')
  if (field !== 'planFeedback' && !fileMetaOf(L.pointer.video)) return fail(byInstructor ? '먼저 수업 영상을 올리세요.' : '수업 영상이 올라온 뒤에 후기를 쓸 수 있습니다.')
  const fields: Record<string, Value> = text ? { [field]: noteValue(text, now) } : {}
  const res = await fetch(L.rest.commit, {
    method: 'POST',
    headers: L.h,
    body: JSON.stringify({ writes: [{ update: { name: `${L.base}/classes/${b.classId}/mtApplications/${owner}`, fields }, updateMask: { fieldPaths: [field] }, currentDocument: { exists: true } }] }),
  })
  if (!res.ok) {
    console.error('[마이크로티칭] 글을 쓰지 못했다:', res.status, (await res.text()).slice(0, 300))
    return fail('저장하지 못했습니다. 잠시 뒤 다시 누르세요.')
  }
  return json({ ok: true, text, at: now })
}

/* ─────────────────────── 동료 의견 (2026-10-17) ─────────────────────── */

/** POST /api/microteaching/peer — { classId, presenterUid, good, improve } 수강생이 남의 수업에. 둘 다 비면 지운다 */
export async function handleMtPeer(env: MtEnv, request: Request, now = Date.now()): Promise<Response> {
  const c = await whoCalls(env, request)
  if (c instanceof Response) return c
  let b: { classId?: string; presenterUid?: string; good?: unknown; improve?: unknown }
  try {
    b = (await request.json()) as typeof b
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  if (!b.classId || !CLASS_ID_RE.test(b.classId) || !b.presenterUid) return fail('요청 형식이 올바르지 않습니다.')
  if (b.presenterUid === c.uid) return fail('자기 수업에는 동료 의견 대신 후기를 씁니다.')
  const good = String(b.good ?? '').trim()
  const improve = String(b.improve ?? '').trim()
  if (good.length > MT_PEER_MAX || improve.length > MT_PEER_MAX) return fail(`${MT_PEER_MAX}자 이하로 적으세요.`)
  const L = await load(env, b.classId, c.uid)
  if ('error' in L) return fail(L.error ?? '클래스를 읽지 못했습니다.')
  if (!L.enrollment || str(L.enrollment, 'status') !== 'active') return fail('이 클래스의 수강생만 쓸 수 있습니다.')
  const presenter = await getDoc(`${L.fs}/classes/${b.classId}/mtApplications/${b.presenterUid}`, L.h)
  if (!presenter || presenter === 'error' || !str(presenter, 'slotId')) return fail('그 사람은 발표 자리를 신청하지 않았습니다.')
  const name = `${L.base}/classes/${b.classId}/mtPeer/${b.presenterUid}__${c.uid}`
  const write =
    good || improve
      ? { update: { name, fields: { presenterUid: S(b.presenterUid), authorUid: S(c.uid), good: S(good), improve: S(improve), at: I(now) } } }
      : { delete: name }
  const res = await fetch(L.rest.commit, { method: 'POST', headers: L.h, body: JSON.stringify({ writes: [write] }) })
  if (!res.ok) {
    console.error('[마이크로티칭] 동료 의견을 쓰지 못했다:', res.status, (await res.text()).slice(0, 300))
    return fail('저장하지 못했습니다. 잠시 뒤 다시 누르세요.')
  }
  return json({ ok: true, at: now, deleted: !(good || improve) })
}

/** 시드로 섞는다 — 발표자가 볼 번호가 쓴 순서나 이름과 이어지지 않게 */
async function shuffledBy(seed: string, items: string[]): Promise<string[]> {
  const scored = await Promise.all(items.map(async (x) => [await hmac(seed, x), x] as const))
  return scored.sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((x) => x[1])
}

/**
 * POST /api/microteaching/peer-list — { classId, presenterUid? } → { ok, comments: [{ n, good, improve, at }] }
 * 발표자 본인(presenterUid 없음)은 **익명 번호**로만 받는다 — 쓴 사람의 uid · 이름이 없다. 강사는 uid 를 적어 누구 것이든 이름(authorUid)과 함께 받는다.
 * 다른 수강생은 남의 수업 의견 목록을 받지 못한다(자기 것은 규칙으로 직접 읽는다).
 */
export async function handleMtPeerList(env: MtEnv, request: Request): Promise<Response> {
  const c = await whoCalls(env, request)
  if (c instanceof Response) return c
  let b: { classId?: string; presenterUid?: string }
  try {
    b = (await request.json()) as typeof b
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  if (!b.classId || !CLASS_ID_RE.test(b.classId)) return fail('클래스 id 가 없습니다.')
  const presenter = b.presenterUid && b.presenterUid !== c.uid ? b.presenterUid : c.uid
  if (presenter !== c.uid && !c.instructor) return fail('다른 사람 수업의 의견은 강사만 볼 수 있습니다.')
  const L = await load(env, b.classId, c.uid)
  if ('error' in L) return fail(L.error ?? '클래스를 읽지 못했습니다.')
  if (!c.instructor && (!L.enrollment || str(L.enrollment, 'status') !== 'active')) return fail('이 클래스의 수강생만 볼 수 있습니다.')
  const res = await fetch(`${L.fs}:runQuery`, {
    method: 'POST',
    headers: L.h,
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'mtPeer' }], where: { fieldFilter: { field: { fieldPath: 'presenterUid' }, op: 'EQUAL', value: S(presenter) } } }, parent: `${L.base}/classes/${b.classId}` }),
  })
  if (!res.ok) return fail(`의견을 읽지 못했습니다 (${res.status}).`)
  const rows = ((await res.json()) as Array<{ document?: { fields?: Record<string, Value> } }>).flatMap((r) => (r.document?.fields ? [r.document.fields] : []))
  const byAuthor = new Map(rows.map((f) => [str(f, 'authorUid') ?? '', f]))
  const order = await shuffledBy(`${b.classId}/${presenter}/${env.TEXTBOOK_SECRET ?? ''}`, [...byAuthor.keys()].filter(Boolean).sort())
  const comments = order.map((author, i) => {
    const f = byAuthor.get(author)!
    const base = { n: i + 1, good: str(f, 'good') ?? '', improve: str(f, 'improve') ?? '', at: int(f, 'at') ?? 0 }
    return c.instructor ? { ...base, authorUid: author } : base
  })
  return json({ ok: true, comments })
}

/* ─────────────────────── 수업 영상 — 조각 올리기 (2026-10-17) ─────────────────────── */

const VIDEO_KEY_RE = /^microteaching\/[A-Za-z0-9_-]{1,64}\/videos\/[^/]{1,128}\/[0-9a-f-]{36}\.(mp4|m4v|mov|webm)$/

async function instructorAndStudent(env: MtEnv, request: Request, classId: string, uid: string) {
  const c = await whoCalls(env, request)
  if (c instanceof Response) return c
  if (!c.instructor) return fail('수업 영상은 강사만 올릴 수 있습니다.')
  if (!CLASS_ID_RE.test(classId) || !uid) return fail('요청 형식이 올바르지 않습니다.')
  if (!env.TEXTBOOK_BUCKET) return fail('파일 저장소가 아직 연결되지 않았습니다. 사이트 관리자에게 알려 주세요.')
  const L = await load(env, classId, uid)
  if ('error' in L) return fail(L.error ?? '클래스를 읽지 못했습니다.')
  if (!L.pointer || !L.prevSlotId) return fail('발표를 신청한 학생이 아닙니다.')
  return { c, L, bucket: env.TEXTBOOK_BUCKET }
}

/** POST /api/microteaching/video-start — { classId, uid, name, size } → { ok, key, uploadId, partSize } */
export async function handleMtVideoStart(env: MtEnv, request: Request): Promise<Response> {
  let b: { classId?: string; uid?: string; name?: string; size?: number }
  try {
    b = (await request.clone().json()) as typeof b
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  const A = await instructorAndStudent(env, request, String(b.classId ?? ''), String(b.uid ?? ''))
  if (A instanceof Response) return A
  const name = String(b.name ?? '').replace(/[\\/\0]/g, '_').slice(-200)
  const ext = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? '').toLowerCase() as keyof typeof MT_VIDEO_CONTENT_TYPE
  if (!MT_VIDEO_CONTENT_TYPE[ext]) return fail('mp4 · m4v · mov · webm 영상만 올릴 수 있습니다.')
  const size = Number(b.size)
  if (!Number.isFinite(size) || size <= 0) return fail('파일 크기를 알 수 없습니다.')
  if (size > MT_VIDEO_MAX_MB * 1024 * 1024) return fail(`영상이 너무 큽니다 — ${MT_VIDEO_MAX_MB / 1024} GB 까지 올릴 수 있습니다.`)
  const key = `microteaching/${b.classId}/videos/${b.uid}/${crypto.randomUUID()}.${ext}`
  try {
    const mp = await A.bucket.createMultipartUpload(key, { httpMetadata: { contentType: MT_VIDEO_CONTENT_TYPE[ext] }, customMetadata: { classId: String(b.classId), uid: String(b.uid), originalName: encodeURIComponent(name) } })
    return json({ ok: true, key, uploadId: mp.uploadId, partSize: MT_VIDEO_PART_MB * 1024 * 1024 })
  } catch (err) {
    console.error('[마이크로티칭] 영상 올리기를 시작하지 못했다:', err)
    return fail('저장소가 올리기를 시작하지 못했습니다. 잠시 뒤 다시 누르세요.')
  }
}

/** PUT /api/microteaching/video-part?classId&uid&key&uploadId&part=N — 조각 하나. 첫 조각은 영상 머리를 본다 */
export async function handleMtVideoPart(env: MtEnv, request: Request): Promise<Response> {
  const u = new URL(request.url)
  const classId = u.searchParams.get('classId') ?? ''
  const uid = u.searchParams.get('uid') ?? ''
  const key = u.searchParams.get('key') ?? ''
  const uploadId = u.searchParams.get('uploadId') ?? ''
  const part = Number(u.searchParams.get('part'))
  const A = await instructorAndStudent(env, request, classId, uid)
  if (A instanceof Response) return A
  if (!VIDEO_KEY_RE.test(key) || !key.includes(`/${classId}/videos/${uid}/`) || !uploadId || !Number.isInteger(part) || part < 1 || part > 10000) return fail('조각 주소가 올바르지 않습니다.')
  const len = Number(request.headers.get('content-length'))
  if (!Number.isFinite(len) || len <= 0 || len > MT_VIDEO_PART_MB * 1024 * 1024 + 1024) return fail('조각 크기가 맞지 않습니다.')
  if (!request.body) return fail('조각이 비어 있습니다.')
  let stream: ReadableStream<Uint8Array> = request.body
  const state = { bad: false }
  if (part === 1) {
    const name = key.slice(key.lastIndexOf('/') + 1)
    const gate = new TransformStream<Uint8Array, Uint8Array>({
      transform: (() => {
        let head = new Uint8Array(0)
        let checked = false
        return (chunk: Uint8Array, ctl: TransformStreamDefaultController<Uint8Array>) => {
          if (checked) return ctl.enqueue(chunk)
          const merged = new Uint8Array(head.length + chunk.length)
          merged.set(head)
          merged.set(chunk, head.length)
          head = merged
          if (head.length < 12) return
          checked = true
          if (!mtVideoKind(name, head)) {
            state.bad = true
            ctl.error(new Error('BAD_VIDEO'))
            return
          }
          ctl.enqueue(head)
        }
      })(),
    })
    stream = request.body.pipeThrough(gate)
  }
  if (typeof FixedLengthStream === 'function') {
    const fixed = new FixedLengthStream(len)
    void stream.pipeTo(fixed.writable).catch(() => {})
    stream = fixed.readable
  }
  try {
    const mp = A.bucket.resumeMultipartUpload(key, uploadId)
    const done = await mp.uploadPart(part, stream)
    return json({ ok: true, partNumber: done.partNumber, etag: done.etag })
  } catch (err) {
    if (state.bad) return fail('영상 파일이 아닙니다. mp4 · mov · webm 파일인지 확인하세요.')
    console.error('[마이크로티칭] 조각을 올리지 못했다:', part, err)
    return fail(`${part}번째 조각을 올리지 못했습니다. 다시 누르면 처음부터 올립니다.`)
  }
}

/** POST /api/microteaching/video-finish — { classId, uid, key, uploadId, parts, name, size } 합치고 크기를 확인해 연결한 뒤 옛 영상을 지운다 */
export async function handleMtVideoFinish(env: MtEnv, request: Request, now = Date.now()): Promise<Response> {
  let b: { classId?: string; uid?: string; key?: string; uploadId?: string; parts?: unknown; name?: string; size?: number }
  try {
    b = (await request.clone().json()) as typeof b
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  const A = await instructorAndStudent(env, request, String(b.classId ?? ''), String(b.uid ?? ''))
  if (A instanceof Response) return A
  const key = String(b.key ?? '')
  if (!VIDEO_KEY_RE.test(key) || !key.includes(`/${b.classId}/videos/${b.uid}/`) || !b.uploadId) return fail('조각 주소가 올바르지 않습니다.')
  const parts = Array.isArray(b.parts) ? (b.parts as R2UploadedPartLike[]).filter((p) => Number.isInteger(p?.partNumber) && typeof p?.etag === 'string') : []
  if (!parts.length) return fail('올린 조각이 없습니다.')
  const size = Number(b.size)
  const name = String(b.name ?? '').replace(/[\\/\0]/g, '_').slice(-200)
  const ext = key.slice(key.lastIndexOf('.') + 1)
  const mp = A.bucket.resumeMultipartUpload(key, String(b.uploadId))
  try {
    await mp.complete([...parts].sort((x, y) => x.partNumber - y.partNumber))
  } catch (err) {
    await mp.abort().catch(() => {})
    console.error('[마이크로티칭] 영상을 합치지 못했다:', err)
    return fail('영상을 합치지 못했습니다. 다시 올리세요. 전에 올린 영상은 그대로입니다.')
  }
  const head = await A.bucket.head(key).catch(() => null)
  if (!head || (Number.isFinite(size) && size > 0 && head.size !== size)) {
    await A.bucket.delete(key).catch(() => {})
    return fail('영상이 끝까지 올라가지 않았습니다. 다시 올리세요. 전에 올린 영상은 그대로입니다.')
  }
  const meta: FileMeta = { key, name, size: head.size, ext, at: now }
  const old = fileMetaOf(A.L.pointer?.video)
  const res = await fetch(A.L.rest.commit, {
    method: 'POST',
    headers: A.L.h,
    body: JSON.stringify({ writes: [{ update: { name: `${A.L.base}/classes/${b.classId}/mtApplications/${b.uid}`, fields: { video: fileMetaValue(meta) } }, updateMask: { fieldPaths: ['video'] }, currentDocument: { exists: true } }] }),
  })
  if (!res.ok) {
    await A.bucket.delete(key).catch(() => {})
    console.error('[마이크로티칭] 영상을 연결하지 못했다:', res.status, (await res.text()).slice(0, 300))
    return fail('영상을 연결하지 못했습니다. 전에 올린 영상은 그대로입니다.')
  }
  if (old && old.key !== key) await A.bucket.delete(old.key).catch((err) => console.error('[마이크로티칭] 옛 영상을 지우지 못했다:', old.key, err))
  return json({ ok: true, file: { name, size: head.size, ext, at: now } })
}

/** POST /api/microteaching/video-abort — { classId, uid, key, uploadId } 중간에 그만둔 조각을 치운다 */
export async function handleMtVideoAbort(env: MtEnv, request: Request): Promise<Response> {
  let b: { classId?: string; uid?: string; key?: string; uploadId?: string }
  try {
    b = (await request.clone().json()) as typeof b
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  const A = await instructorAndStudent(env, request, String(b.classId ?? ''), String(b.uid ?? ''))
  if (A instanceof Response) return A
  const key = String(b.key ?? '')
  if (!VIDEO_KEY_RE.test(key) || !b.uploadId) return fail('조각 주소가 올바르지 않습니다.')
  await A.bucket.resumeMultipartUpload(key, String(b.uploadId)).abort().catch(() => {})
  return json({ ok: true })
}

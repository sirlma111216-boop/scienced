import type { Env } from '../../../shared/ai-core'
import {
  TEXTBOOK_DESCRIPTION_MAX,
  TEXTBOOK_ID_RE,
  TEXTBOOK_MAX_MB_DEFAULT,
  TEXTBOOK_READ_TTL_MS,
  TEXTBOOK_TITLE_MAX,
  isTextbookUnit,
  looksLikePdf,
  unitOf,
  type TextbookDoc,
} from '../../../shared/textbook'
import { fail, isInstructorUid, json, verifyIdToken } from './auth'
import { firestoreRest } from './lumi'

/**
 * 교과서 보기 — 서버가 하는 일 전부 (강의자 지시 2026-10-14).
 *
 * 저장
 *   Firestore `textbook/{id}`                목차 하나 (TextbookDoc). 쓰기는 이 파일만 한다 — 규칙이 클라이언트 쓰기를 막는다.
 *   R2 `TEXTBOOK_BUCKET` 의 `textbook/{unitId}/{id}/{uuid}.pdf`   PDF. 올릴 때마다 새 키라 이름이 부딪히지 않는다.
 *
 * 왜 이렇게
 *   · 강사 판정은 `instructors/{uid}` 문서 — 다른 서버 함수와 같다. 화면에서 메뉴를 숨기는 것으로 끝내지 않는다.
 *   · PDF 는 이 함수를 통해 R2 로 흘려보낸다(스트림 — 메모리에 통째로 올리지 않는다). Pages Functions 의 요청 상한(100 MB) 아래로 상한을 둔다.
 *     R2 에 직접 올리는 서명 주소(S3 호환 API)는 R2 API 토큰을 대시보드에서 따로 만들어야 하고, 그 비밀이 하나 더 생긴다.
 *     교재 PDF 는 상한 안에 들어오므로 비밀 없이 바인딩만 쓰는 쪽을 골랐다 (docs/검토/8차-결정.md 2026-10-14).
 *   · 새 PDF 를 올려 크기까지 확인하고 목차에 연결한 **다음에** 옛 파일을 지운다. 중간에 실패하면 새 파일을 지우고 옛 연결은 그대로 둔다.
 *   · PDF 를 읽는 주소는 서명된 짧은 주소다(30분). PDF 보기 화면은 요청에 토큰 헤더를 붙일 수 없어서다.
 *     서명에 목차 id · 만료 · 파일 키가 들어가 파일을 바꾸면 옛 주소가 죽는다. 학생용 주소는 열 때마다 공개 여부를 다시 본다.
 */

/* ─────────────── R2 — 이 파일이 쓰는 모양만 (env.d.ts 와 같은 이유로 workers-types 를 넣지 않는다) ─────────────── */

export interface R2ObjectLike {
  key: string
  size: number
  httpEtag?: string
  uploaded?: Date
}
export interface R2ObjectBodyLike extends R2ObjectLike {
  body: ReadableStream<Uint8Array>
}
export interface R2BucketLike {
  put(key: string, value: ReadableStream<Uint8Array>, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<R2ObjectLike | null>
  head(key: string): Promise<R2ObjectLike | null>
  get(key: string, options?: { range?: { offset: number; length: number } }): Promise<R2ObjectBodyLike | null>
  delete(key: string): Promise<void>
}

export type TbEnv = Env & {
  GCP_SERVICE_ACCOUNT?: string
  FIRESTORE_EMULATOR_HOST?: string
  TEXTBOOK_BUCKET?: R2BucketLike
  TEXTBOOK_SECRET?: string
  /** 올릴 수 있는 PDF 크기 상한(MB). 없으면 TEXTBOOK_MAX_MB_DEFAULT */
  TEXTBOOK_MAX_MB?: string
}

export function maxBytes(env: TbEnv): number {
  const mb = Number(env.TEXTBOOK_MAX_MB)
  return Math.round((Number.isFinite(mb) && mb > 0 && mb <= 99 ? mb : TEXTBOOK_MAX_MB_DEFAULT) * 1024 * 1024)
}

/* ─────────────────────────── Firestore REST ─────────────────────────── */

type Value = { stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean; nullValue?: null }
type Fields = Record<string, Value>
const S = (v: string): Value => ({ stringValue: v })
const I = (v: number): Value => ({ integerValue: String(Math.round(v)) })
const B = (v: boolean): Value => ({ booleanValue: v })
const N: Value = { nullValue: null }
const SN = (v: string | null): Value => (v === null ? N : S(v))
const IN = (v: number | null): Value => (v === null ? N : I(v))

const s = (f: Fields, k: string) => f[k]?.stringValue ?? null
const n = (f: Fields, k: string) => {
  const v = f[k]
  if (!v) return null
  if (v.integerValue !== undefined) return Number(v.integerValue)
  return typeof v.doubleValue === 'number' ? v.doubleValue : null
}

export function toFields(d: TextbookDoc): Fields {
  return {
    id: S(d.id),
    grade: I(d.grade),
    unitId: S(d.unitId),
    title: S(d.title),
    description: S(d.description),
    sortOrder: I(d.sortOrder),
    published: B(d.published),
    objectKey: SN(d.objectKey),
    originalFileName: SN(d.originalFileName),
    fileSize: IN(d.fileSize),
    contentType: SN(d.contentType),
    createdAt: I(d.createdAt),
    updatedAt: I(d.updatedAt),
  }
}

export function fromFields(f: Fields): TextbookDoc | null {
  const id = s(f, 'id')
  const unit = unitOf(s(f, 'unitId'))
  if (!id || !unit) return null
  return {
    id,
    grade: unit.grade,
    unitId: unit.id,
    title: s(f, 'title') ?? '',
    description: s(f, 'description') ?? '',
    sortOrder: n(f, 'sortOrder') ?? 0,
    published: f.published?.booleanValue === true,
    objectKey: s(f, 'objectKey'),
    originalFileName: s(f, 'originalFileName'),
    fileSize: n(f, 'fileSize'),
    contentType: s(f, 'contentType'),
    createdAt: n(f, 'createdAt') ?? 0,
    updatedAt: n(f, 'updatedAt') ?? 0,
  }
}

type Rest = { docs: string; commit: string; base: string; headers: Record<string, string> }

async function rest(env: TbEnv): Promise<Rest | { error: string }> {
  const r = await firestoreRest(env)
  if ('error' in r) return r
  /* commit 의 write.name 은 전체 자원 이름이다 — 주소에서 호스트와 /v1/ 을 뗀 것 */
  return { ...r, base: r.docs.replace(/^https?:\/\/[^/]+\/v1\//, '') }
}

export async function readTextbook(env: TbEnv, id: string): Promise<TextbookDoc | null | { error: string }> {
  const R = await rest(env)
  if ('error' in R) return R
  const res = await fetch(`${R.docs}/textbook/${id}`, { headers: R.headers })
  if (res.status === 404) return null
  if (!res.ok) return { error: `목차를 읽지 못했습니다 (${res.status}).` }
  return fromFields(((await res.json()) as { fields?: Fields }).fields ?? {})
}

/** 한 단원의 소단원 전부 · 한 파일을 쓰는 목차 — 순서 계산 · 정렬 검사 · 파일 키 공유 검사에 쓴다 */
export async function listTextbooks(env: TbEnv, where?: { field: 'unitId' | 'objectKey'; value: string }): Promise<TextbookDoc[] | { error: string }> {
  const R = await rest(env)
  if ('error' in R) return R
  const structuredQuery: Record<string, unknown> = { from: [{ collectionId: 'textbook' }] }
  if (where) structuredQuery.where = { fieldFilter: { field: { fieldPath: where.field }, op: 'EQUAL', value: S(where.value) } }
  const res = await fetch(`${R.docs}:runQuery`, { method: 'POST', headers: R.headers, body: JSON.stringify({ structuredQuery }) })
  if (!res.ok) return { error: `목차 목록을 읽지 못했습니다 (${res.status}).` }
  const rows = (await res.json()) as Array<{ document?: { fields?: Fields } }>
  return rows.flatMap((r) => (r.document?.fields ? [fromFields(r.document.fields)] : [])).filter((d): d is TextbookDoc => d !== null)
}

async function commit(env: TbEnv, writes: unknown[]): Promise<{ ok: true } | { ok: false; status: number; text: string }> {
  const R = await rest(env)
  if ('error' in R) return { ok: false, status: 0, text: R.error }
  const res = await fetch(R.commit, { method: 'POST', headers: R.headers, body: JSON.stringify({ writes }) })
  if (res.ok) return { ok: true }
  return { ok: false, status: res.status, text: await res.text() }
}

async function docName(env: TbEnv, id: string): Promise<string | null> {
  const R = await rest(env)
  return 'error' in R ? null : `${R.base}/textbook/${id}`
}

/** 목차 문서를 통째로 쓴다. mustExist — 그 사이 지워졌으면 실패한다 · mustNotExist — 새로 만들 때 */
async function putDoc(env: TbEnv, d: TextbookDoc, cond: 'mustExist' | 'mustNotExist'): Promise<boolean> {
  const name = await docName(env, d.id)
  if (!name) return false
  const r = await commit(env, [{ update: { name, fields: toFields(d) }, currentDocument: { exists: cond === 'mustExist' } }])
  if (!r.ok) console.error('[교과서] 목차를 쓰지 못했다:', r.status, r.text.slice(0, 300))
  return r.ok
}

/* ─────────────────────────── 호출자 ─────────────────────────── */

type Caller = { uid: string; instructor: boolean }

async function caller(env: TbEnv, request: Request): Promise<Caller | Response> {
  const auth = request.headers.get('authorization')
  const user = await verifyIdToken(auth, env.FIREBASE_PROJECT_ID)
  if (!user) return fail('로그인이 필요합니다.')
  /* isInstructorUid 는 프로젝트 id 가 없으면(로컬) 참을 돌려준다 — 여기서는 그 길을 막는다 */
  if (!env.FIREBASE_PROJECT_ID) return fail('서버 설정(FIREBASE_PROJECT_ID)이 없습니다.')
  return { uid: user.uid, instructor: await isInstructorUid(env.FIREBASE_PROJECT_ID, user.uid, auth) }
}

async function instructorOnly(env: TbEnv, request: Request): Promise<Caller | Response> {
  const c = await caller(env, request)
  if (c instanceof Response) return c
  if (!c.instructor) return fail('강사만 교과서를 관리할 수 있습니다.')
  return c
}

async function body<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

const newId = () => `tb_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`

/** 이 파일 키를 다른 목차가 쓰지 않으면 R2 에서 지운다. 실패해도 목차는 이미 맞다 — 경고만 남긴다 */
async function dropObjectIfUnused(env: TbEnv, key: string | null, exceptId: string): Promise<string | null> {
  if (!key || !env.TEXTBOOK_BUCKET) return null
  const users = await listTextbooks(env, { field: 'objectKey', value: key })
  if ('error' in users) return `옛 파일을 정리하지 못했습니다 — ${users.error}`
  if (users.some((d) => d.id !== exceptId)) return null
  try {
    await env.TEXTBOOK_BUCKET.delete(key)
    return null
  } catch (err) {
    console.error('[교과서] 옛 파일을 지우지 못했다:', key, err)
    return '옛 파일을 정리하지 못했습니다. 교재는 새 파일로 바뀌었습니다.'
  }
}

/* ─────────────────────────── 강사 — 설정 · 목차 · 순서 · 공개 · 삭제 ─────────────────────────── */

/** POST /api/textbook/config — 화면이 업로드 전에 상한과 준비 상태를 알린다 */
export async function handleConfig(env: TbEnv, request: Request): Promise<Response> {
  const c = await instructorOnly(env, request)
  if (c instanceof Response) return c
  return json({ ok: true, maxBytes: maxBytes(env), storageReady: Boolean(env.TEXTBOOK_BUCKET), readReady: Boolean(env.TEXTBOOK_SECRET) })
}

/** POST /api/textbook/save — { id?, unitId, title, description } 새 소단원(비공개 · 파일 없음) 또는 제목·설명 고치기. 단원은 만들 때 정하고 바꾸지 않는다 */
export async function handleSave(env: TbEnv, request: Request, now = Date.now()): Promise<Response> {
  const c = await instructorOnly(env, request)
  if (c instanceof Response) return c
  const b = await body<{ id?: string; unitId?: string; title?: string; description?: string }>(request)
  if (!b) return fail('요청 형식이 올바르지 않습니다.')
  const title = String(b.title ?? '').trim()
  const description = String(b.description ?? '').trim()
  if (!title) return fail('소단원 제목을 적으세요.')
  if (title.length > TEXTBOOK_TITLE_MAX) return fail(`소단원 제목은 ${TEXTBOOK_TITLE_MAX}자 이하로 적으세요.`)
  if (description.length > TEXTBOOK_DESCRIPTION_MAX) return fail(`설명은 ${TEXTBOOK_DESCRIPTION_MAX}자 이하로 적으세요.`)

  if (b.id) {
    if (!TEXTBOOK_ID_RE.test(b.id)) return fail('목차 id 가 올바르지 않습니다.')
    const d = await readTextbook(env, b.id)
    if (d && 'error' in d) return fail(d.error)
    if (!d) return fail('그 목차가 없습니다. 화면을 새로 고치세요.')
    const next: TextbookDoc = { ...d, title, description, updatedAt: now }
    return (await putDoc(env, next, 'mustExist')) ? json({ ok: true, textbook: next }) : fail('저장하지 못했습니다. 잠시 뒤 다시 누르세요.')
  }

  const unit = isTextbookUnit(b.unitId) ? unitOf(b.unitId) : null
  if (!unit) return fail('학년과 단원을 고르세요.')
  const same = await listTextbooks(env, { field: 'unitId', value: unit.id })
  if ('error' in same) return fail(same.error)
  const d: TextbookDoc = {
    id: newId(),
    grade: unit.grade,
    unitId: unit.id,
    title,
    description,
    sortOrder: same.reduce((m, x) => Math.max(m, x.sortOrder), 0) + 1,
    published: false,
    objectKey: null,
    originalFileName: null,
    fileSize: null,
    contentType: null,
    createdAt: now,
    updatedAt: now,
  }
  return (await putDoc(env, d, 'mustNotExist')) ? json({ ok: true, textbook: d }) : fail('목차를 만들지 못했습니다. 잠시 뒤 다시 누르세요.')
}

/** POST /api/textbook/publish — { id, published } 파일이 없는 목차는 공개하지 않는다 */
export async function handlePublish(env: TbEnv, request: Request, now = Date.now()): Promise<Response> {
  const c = await instructorOnly(env, request)
  if (c instanceof Response) return c
  const b = await body<{ id?: string; published?: boolean }>(request)
  if (!b?.id || !TEXTBOOK_ID_RE.test(b.id) || typeof b.published !== 'boolean') return fail('요청 형식이 올바르지 않습니다.')
  const d = await readTextbook(env, b.id)
  if (d && 'error' in d) return fail(d.error)
  if (!d) return fail('그 목차가 없습니다. 화면을 새로 고치세요.')
  if (b.published && !d.objectKey) return fail('PDF 를 올린 뒤에 공개할 수 있습니다.')
  const next: TextbookDoc = { ...d, published: b.published, updatedAt: now }
  return (await putDoc(env, next, 'mustExist')) ? json({ ok: true, textbook: next }) : fail('바꾸지 못했습니다. 잠시 뒤 다시 누르세요.')
}

/** POST /api/textbook/reorder — { unitId, ids } 그 단원의 소단원 전부를 이 순서로. 수정일은 바꾸지 않는다 */
export async function handleReorder(env: TbEnv, request: Request): Promise<Response> {
  const c = await instructorOnly(env, request)
  if (c instanceof Response) return c
  const b = await body<{ unitId?: string; ids?: unknown }>(request)
  if (!b || !isTextbookUnit(b.unitId) || !Array.isArray(b.ids) || !b.ids.every((x) => typeof x === 'string' && TEXTBOOK_ID_RE.test(x))) return fail('요청 형식이 올바르지 않습니다.')
  const ids = b.ids as string[]
  const all = await listTextbooks(env, { field: 'unitId', value: b.unitId })
  if ('error' in all) return fail(all.error)
  const have = new Set(all.map((d) => d.id))
  if (ids.length !== have.size || new Set(ids).size !== ids.length || ids.some((x) => !have.has(x))) return fail('목차가 그 사이 바뀌었습니다. 화면을 새로 고친 뒤 다시 옮기세요.')
  const R = await rest(env)
  if ('error' in R) return fail(R.error)
  const writes = ids.map((id, i) => ({
    update: { name: `${R.base}/textbook/${id}`, fields: { sortOrder: I(i + 1) } },
    updateMask: { fieldPaths: ['sortOrder'] },
    currentDocument: { exists: true },
  }))
  const r = await commit(env, writes)
  if (!r.ok) {
    console.error('[교과서] 순서를 쓰지 못했다:', r.status, r.text.slice(0, 300))
    return fail('순서를 저장하지 못했습니다. 잠시 뒤 다시 옮기세요.')
  }
  return json({ ok: true, ids })
}

/** POST /api/textbook/delete — { id } 목차를 지우고, 그 파일을 다른 목차가 쓰지 않으면 파일도 지운다 */
export async function handleDelete(env: TbEnv, request: Request): Promise<Response> {
  const c = await instructorOnly(env, request)
  if (c instanceof Response) return c
  const b = await body<{ id?: string }>(request)
  if (!b?.id || !TEXTBOOK_ID_RE.test(b.id)) return fail('요청 형식이 올바르지 않습니다.')
  const d = await readTextbook(env, b.id)
  if (d && 'error' in d) return fail(d.error)
  if (!d) return json({ ok: true, deleted: false })
  const name = await docName(env, d.id)
  if (!name) return fail('서버 설정이 없습니다.')
  const r = await commit(env, [{ delete: name }])
  if (!r.ok) return fail('지우지 못했습니다. 잠시 뒤 다시 누르세요.')
  const warning = await dropObjectIfUnused(env, d.objectKey, d.id)
  return json({ ok: true, deleted: true, ...(warning ? { warnings: [warning] } : null) })
}

/* ─────────────────────────── 강사 — PDF 올리기 · 바꾸기 ─────────────────────────── */

/** 머리 다섯 바이트가 %PDF- 가 아니면 스트림을 멈춘다 — 확장자·MIME 만 믿지 않는다 */
function pdfGate(state: { notPdf: boolean }): TransformStream<Uint8Array, Uint8Array> {
  let head = new Uint8Array(0)
  let checked = false
  return new TransformStream({
    transform(chunk, ctl) {
      if (!checked) {
        const merged = new Uint8Array(head.length + chunk.length)
        merged.set(head)
        merged.set(chunk, head.length)
        head = merged
        if (head.length < 5) return
        checked = true
        if (!looksLikePdf(head)) {
          state.notPdf = true
          ctl.error(new Error('NOT_PDF'))
          return
        }
        ctl.enqueue(head)
        return
      }
      ctl.enqueue(chunk)
    },
    flush(ctl) {
      if (!checked) {
        state.notPdf = true
        ctl.error(new Error('NOT_PDF'))
      }
    },
  })
}

declare const FixedLengthStream: undefined | (new (length: number) => { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> })

/**
 * PUT /api/textbook/upload?id=… — 본문이 PDF 그대로. 머리: content-type application/pdf · x-file-name(encodeURIComponent).
 *
 *   ① 강사 · 목차가 있는가 · 크기 상한 · 확장자 · MIME
 *   ② 새 키에 스트림으로 넣으며 머리 %PDF- 를 본다
 *   ③ R2 에 있는가 · 크기가 같은가
 *   ④ 목차에 연결(「있을 때만」) — 실패하면 새 파일을 지우고 옛 연결은 그대로
 *   ⑤ 옛 파일 정리 (다른 목차가 쓰지 않을 때만)
 */
export async function handleUpload(env: TbEnv, request: Request, now = Date.now()): Promise<Response> {
  const c = await instructorOnly(env, request)
  if (c instanceof Response) return c
  const bucket = env.TEXTBOOK_BUCKET
  if (!bucket) return fail('교재 저장소가 아직 연결되지 않았습니다. 사이트 관리자에게 저장소 연결을 요청하세요.')
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!TEXTBOOK_ID_RE.test(id)) return fail('목차 id 가 올바르지 않습니다.')

  const len = Number(request.headers.get('content-length'))
  const limit = maxBytes(env)
  if (!Number.isFinite(len) || len <= 0) return fail('파일 크기를 알 수 없습니다. 다시 고르세요.')
  if (len > limit) return fail(`파일이 너무 큽니다 — ${Math.round(limit / 1024 / 1024)} MB 까지 올릴 수 있습니다.`)
  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (type !== 'application/pdf') return fail('PDF 파일만 올릴 수 있습니다.')
  let name = ''
  try {
    name = decodeURIComponent(request.headers.get('x-file-name') ?? '').trim()
  } catch {
    name = ''
  }
  if (!/\.pdf$/i.test(name)) return fail('파일 이름이 .pdf 로 끝나야 합니다.')
  name = name.replace(/[\\/\0]/g, '_').slice(-200)
  if (!request.body) return fail('파일이 비어 있습니다.')

  const doc = await readTextbook(env, id)
  if (doc && 'error' in doc) return fail(doc.error)
  if (!doc) return fail('그 목차가 없습니다. 화면을 새로 고치세요.')

  const key = `textbook/${doc.unitId}/${id}/${crypto.randomUUID()}.pdf`
  const state = { notPdf: false }
  const gated = request.body.pipeThrough(pdfGate(state))
  let stream: ReadableStream<Uint8Array> = gated
  if (typeof FixedLengthStream === 'function') {
    /* R2 는 길이를 아는 스트림만 받는다 — 길이를 붙인 스트림으로 흘린다 */
    const fixed = new FixedLengthStream(len)
    void gated.pipeTo(fixed.writable).catch(() => {})
    stream = fixed.readable
  }
  try {
    await bucket.put(key, stream, { httpMetadata: { contentType: 'application/pdf' }, customMetadata: { textbookId: id, originalName: encodeURIComponent(name) } })
  } catch (err) {
    await bucket.delete(key).catch(() => {})
    if (state.notPdf) return fail('PDF 파일이 아닙니다. 파일의 내용이 PDF 형식인지 확인하세요.')
    console.error('[교과서] 저장소에 넣지 못했다:', err)
    return fail('파일을 저장하지 못했습니다. 잠시 뒤 다시 올리세요. 기존 교재는 그대로입니다.')
  }
  if (state.notPdf) {
    await bucket.delete(key).catch(() => {})
    return fail('PDF 파일이 아닙니다. 파일의 내용이 PDF 형식인지 확인하세요.')
  }

  const head = await bucket.head(key).catch(() => null)
  if (!head || head.size !== len) {
    await bucket.delete(key).catch(() => {})
    return fail('파일이 끝까지 올라가지 않았습니다. 다시 올리세요. 기존 교재는 그대로입니다.')
  }

  /* 그 사이 목차가 바뀌었을 수 있다 — 다시 읽고 연결한다 */
  const latest = await readTextbook(env, id)
  if (!latest || 'error' in latest) {
    await bucket.delete(key).catch(() => {})
    return fail('목차를 다시 읽지 못했습니다. 기존 교재는 그대로입니다.')
  }
  const next: TextbookDoc = { ...latest, objectKey: key, originalFileName: name, fileSize: len, contentType: 'application/pdf', updatedAt: now }
  if (!(await putDoc(env, next, 'mustExist'))) {
    await bucket.delete(key).catch(() => {})
    return fail('PDF 를 목차에 연결하지 못했습니다. 기존 교재는 그대로입니다.')
  }
  const warning = latest.objectKey && latest.objectKey !== key ? await dropObjectIfUnused(env, latest.objectKey, id) : null
  return json({ ok: true, textbook: next, ...(warning ? { warnings: [warning] } : null) })
}

/* ─────────────────────────── 읽기 — 서명된 짧은 주소 ─────────────────────────── */

async function hmac(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)))
  return [...sig].map((x) => x.toString(16).padStart(2, '0')).join('')
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

/** 서명할 글 — 파일 키가 들어가 PDF 를 바꾸면 옛 주소가 죽는다 */
const signText = (id: string, objectKey: string, exp: number, mode: 's' | 'a') => `${id}\n${objectKey}\n${exp}\n${mode}`

/** 학생에게 보내도 되는 필드만 */
export function publicView(d: TextbookDoc) {
  return { id: d.id, grade: d.grade, unitId: d.unitId, unitTitle: unitOf(d.unitId)?.title ?? '', title: d.title, description: d.description, sortOrder: d.sortOrder, published: d.published, originalFileName: d.originalFileName, fileSize: d.fileSize, contentType: d.contentType, createdAt: d.createdAt, updatedAt: d.updatedAt }
}

/**
 * POST /api/textbook/read-url — { id } → { ok, url, expiresAt, textbook }
 * 로그인한 사람 누구나 공개 목차의 주소를 받는다. 비공개 목차는 강사만 받는다(미리보기) — 학생에게는 「없음」과 같은 말을 돌려준다.
 */
export async function handleReadUrl(env: TbEnv, request: Request, now = Date.now()): Promise<Response> {
  const c = await caller(env, request)
  if (c instanceof Response) return c
  const b = await body<{ id?: string }>(request)
  if (!b?.id || !TEXTBOOK_ID_RE.test(b.id)) return fail('요청 형식이 올바르지 않습니다.')
  if (!env.TEXTBOOK_SECRET) return fail('교재 읽기 설정이 아직 끝나지 않았습니다. 사이트 관리자에게 알려 주세요.')
  const d = await readTextbook(env, b.id)
  if (d && 'error' in d) return fail(d.error)
  if (!d || (!d.published && !c.instructor)) return fail('이 교재를 열 수 없습니다. 목록을 새로 고치세요.')
  if (!d.objectKey) return fail('아직 PDF 가 올라오지 않은 목차입니다.')
  const mode: 's' | 'a' = d.published ? 's' : 'a'
  const exp = now + TEXTBOOK_READ_TTL_MS
  const sig = await hmac(env.TEXTBOOK_SECRET, signText(d.id, d.objectKey, exp, mode))
  const url = `/api/textbook/file?id=${encodeURIComponent(d.id)}&exp=${exp}&m=${mode}&sig=${sig}`
  return json({ ok: true, url, expiresAt: exp, textbook: publicView(d) })
}

/** Range: bytes=a-b · a- · -n  →  {offset,length}. 맞지 않으면 'bad', 없으면 null */
export function parseRange(header: string | null, size: number): { offset: number; length: number } | null | 'bad' {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (m[1] === '' && m[2] === '')) return 'bad'
  if (m[1] === '') {
    const suffix = Math.min(Number(m[2]), size)
    if (suffix <= 0) return 'bad'
    return { offset: size - suffix, length: suffix }
  }
  const start = Number(m[1])
  const end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  if (start >= size || end < start) return 'bad'
  return { offset: start, length: end - start + 1 }
}

const plain = (status: number, text: string) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })

/**
 * GET · HEAD /api/textbook/file?id&exp&m&sig — PDF 를 흘려보낸다 (Range 를 받는다 · 통째로 메모리에 올리지 않는다).
 * 주소의 서명 · 만료를 보고, 목차를 다시 읽어 지금의 파일 키로 서명을 맞춘다. 학생용(m=s)은 지금도 공개인지 본다.
 */
export async function handleFile(env: TbEnv, request: Request, now = Date.now()): Promise<Response> {
  const u = new URL(request.url)
  const id = u.searchParams.get('id') ?? ''
  const exp = Number(u.searchParams.get('exp'))
  const mode = u.searchParams.get('m')
  const sig = u.searchParams.get('sig') ?? ''
  if (!TEXTBOOK_ID_RE.test(id) || !Number.isFinite(exp) || (mode !== 's' && mode !== 'a') || !/^[0-9a-f]{64}$/.test(sig)) return plain(400, '주소가 올바르지 않습니다.')
  if (now > exp) return plain(403, '주소의 유효 시간이 지났습니다. 교재를 다시 여세요.')
  if (!env.TEXTBOOK_SECRET || !env.TEXTBOOK_BUCKET) return plain(503, '교재 저장소가 아직 연결되지 않았습니다.')
  const d = await readTextbook(env, id)
  if (!d || 'error' in d || !d.objectKey) return plain(404, '교재가 없습니다.')
  const want = await hmac(env.TEXTBOOK_SECRET, signText(d.id, d.objectKey, exp, mode))
  if (!sameText(want, sig)) return plain(403, '교재가 바뀌었거나 주소가 맞지 않습니다. 교재를 다시 여세요.')
  if (mode === 's' && !d.published) return plain(404, '교재가 없습니다.')

  const head = await env.TEXTBOOK_BUCKET.head(d.objectKey)
  if (!head) return plain(404, '교재 파일이 없습니다.')
  const range = parseRange(request.headers.get('range'), head.size)
  if (range === 'bad') return new Response(null, { status: 416, headers: { 'content-range': `bytes */${head.size}` } })
  const headers = new Headers({
    'content-type': 'application/pdf',
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=300',
    'x-content-type-options': 'nosniff',
    'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(d.originalFileName ?? 'textbook.pdf')}`,
  })
  if (head.httpEtag) headers.set('etag', head.httpEtag)
  if (request.method === 'HEAD') {
    headers.set('content-length', String(head.size))
    return new Response(null, { status: 200, headers })
  }
  const obj = await env.TEXTBOOK_BUCKET.get(d.objectKey, range ? { range } : undefined)
  if (!obj) return plain(404, '교재 파일이 없습니다.')
  if (range) {
    headers.set('content-range', `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`)
    headers.set('content-length', String(range.length))
    return new Response(obj.body, { status: 206, headers })
  }
  headers.set('content-length', String(head.size))
  return new Response(obj.body, { status: 200, headers })
}


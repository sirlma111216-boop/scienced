/**
 * npm run test:textbook — 교과서 보기 서버 함수를 **그 함수 그대로** 불러 본다 (2026-10-14).
 *
 * functions/api/_lib/textbook.ts 의 처리기(handleSave · handleUpload · …)를 직접 부른다. 바깥만 흉내 낸다:
 *   · Firestore — REST 를 받아 주는 메모리 저장소(fetch 를 가로챈다). 함수는 FIRESTORE_EMULATOR_HOST 길로 그곳에 쓴다.
 *   · R2 — 메모리 버킷. put 은 스트림을 끝까지 읽는다. 실패를 일부러 넣을 수 있다.
 *   · 로그인 — 시험용 RSA 키로 서명한 진짜 모양의 ID 토큰. verifyIdToken 이 JWKS 를 받으러 가면 그 공개키를 준다.
 *   · 강사 판정 — instructors/{uid} 를 읽으면 강사에게만 200 을 준다(규칙이 본인 문서만 읽게 하는 것과 같은 모양).
 * 에뮬레이터(Java)가 없어도 돈다. 실제 R2 · Firestore 와의 이음매는 배포 뒤 탐침으로 따로 본다.
 */
const lib = await import('../functions/api/_lib/textbook.ts')
const { TEXTBOOK_UNITS } = await import('../shared/textbook.ts')

const PROJECT = 'tb-test'
const EMU = 'emu.local:8080'
let failures = 0
const ok = (cond, label) => {
  if (cond) console.log(`  ✓ ${label}`)
  else {
    failures++
    console.error(`  ✗ ${label}`)
  }
}

/* ── 로그인: 시험용 키 · JWKS ── */
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'test-kid', alg: 'RS256' }
const b64u = (buf) => Buffer.from(buf).toString('base64url')
async function token(uid) {
  const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'test-kid', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const p = b64u(JSON.stringify({ sub: uid, aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, exp: now + 3600, iat: now }))
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(`${h}.${p}`))
  return `${h}.${p}.${b64u(sig)}`
}
const INSTRUCTOR = 'teacher-1'
const STUDENT = 'student-1'

/* ── Firestore REST 흉내 ── */
const store = new Map() // 'textbook/{id}' → fields
let failNextCommit = false
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url
  const method = (init.method ?? 'GET').toUpperCase()
  const res = (status, body) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  if (url.includes('securetoken@system.gserviceaccount.com')) return res(200, { keys: [jwk] })
  const inst = /\/documents\/instructors\/([^/?]+)$/.exec(url)
  if (inst) {
    const auth = init.headers?.authorization ?? ''
    const caller = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64url').toString()).sub : null
    return caller === INSTRUCTOR && inst[1] === INSTRUCTOR ? res(200, { name: url, fields: {} }) : res(403, { error: 'PERMISSION_DENIED' })
  }
  if (!url.startsWith(`http://${EMU}/`)) return realFetch(input, init)
  const path = url.split('/documents')[1] ?? ''
  if (path === ':commit') {
    if (failNextCommit) {
      failNextCommit = false
      return res(503, { error: 'UNAVAILABLE' })
    }
    const { writes } = JSON.parse(init.body)
    const staged = new Map(store)
    for (const w of writes) {
      const name = (w.update?.name ?? w.delete).split('/documents/')[1]
      const exists = staged.has(name)
      if (w.currentDocument?.exists === true && !exists) return res(400, { error: 'FAILED_PRECONDITION' })
      if (w.currentDocument?.exists === false && exists) return res(409, { error: 'ALREADY_EXISTS' })
      if (w.delete) staged.delete(name)
      else if (w.updateMask) staged.set(name, { ...(staged.get(name) ?? {}), ...Object.fromEntries(w.updateMask.fieldPaths.map((f) => [f, w.update.fields[f]])) })
      else staged.set(name, w.update.fields)
    }
    store.clear()
    for (const [k, v] of staged) store.set(k, v)
    return res(200, { writeResults: [] })
  }
  if (path === ':runQuery') {
    const q = JSON.parse(init.body).structuredQuery
    const ff = q.where?.fieldFilter
    const rows = [...store.entries()].filter(([k]) => k.startsWith('textbook/')).filter(([, f]) => !ff || f[ff.field.fieldPath]?.stringValue === ff.value.stringValue)
    return res(200, rows.map(([k, f]) => ({ document: { name: k, fields: f } })))
  }
  if (method === 'GET') {
    const key = path.replace(/^\//, '')
    return store.has(key) ? res(200, { name: key, fields: store.get(key) }) : res(404, { error: 'NOT_FOUND' })
  }
  return res(400, { error: 'unknown' })
}

/* ── R2 흉내 ── */
const objects = new Map()
let failNextPut = false
const bucket = {
  async put(key, stream) {
    const chunks = []
    const reader = stream.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    if (failNextPut) {
      failNextPut = false
      throw new Error('R2 down')
    }
    const buf = Buffer.concat(chunks)
    objects.set(key, buf)
    return { key, size: buf.length }
  },
  async head(key) {
    const b = objects.get(key)
    return b ? { key, size: b.length, httpEtag: '"e"' } : null
  },
  async get(key, opts) {
    const b = objects.get(key)
    if (!b) return null
    const part = opts?.range ? b.subarray(opts.range.offset, opts.range.offset + opts.range.length) : b
    return { key, size: b.length, body: new Response(part).body }
  },
  async delete(key) {
    objects.delete(key)
  },
}

const env = { FIREBASE_PROJECT_ID: PROJECT, FIRESTORE_EMULATOR_HOST: EMU, TEXTBOOK_BUCKET: bucket, TEXTBOOK_SECRET: 'test-secret', TEXTBOOK_MAX_MB: '2' }
const tokT = await token(INSTRUCTOR)
const tokS = await token(STUDENT)
const post = async (fn, tok, body) => (await fn(env, new Request('https://x/api', { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify(body) }))).json()
const pdf = (n, fill = 0x41) => {
  const b = Buffer.alloc(n, fill)
  b.write('%PDF-1.7\n', 0, 'latin1')
  return b
}
const upload = async (tok, id, bytes, name = 'chapter.pdf', type = 'application/pdf') =>
  (await lib.handleUpload(env, new Request(`https://x/api/textbook/upload?id=${id}`, { method: 'PUT', headers: { authorization: `Bearer ${tok}`, 'content-type': type, 'content-length': String(bytes.length), 'x-file-name': encodeURIComponent(name) }, body: bytes, duplex: 'half' }))).json()
const docOf = (id) => lib.fromFields(store.get(`textbook/${id}`) ?? {})
// 저장된 교과서 연결은 표시 순서가 바뀌어도 같은 단원을 가리켜야 한다.
const unit = 'g1u1'
ok(TEXTBOOK_UNITS.find((u) => u.id === unit)?.title === '생물의 구성과 다양성', '첫 단원 추가 뒤에도 기존 생물 교과서의 id 가 유지된다')
ok(TEXTBOOK_UNITS.find((u) => u.id === 'g2u8')?.title === '수권과 해수의 순환', '중2 기존 단원 id 가 유지된다')

console.log('권한')
ok((await post(lib.handleSave, null, { unitId: unit, title: 'x' })).ok === false, '토큰 없이 목차를 만들 수 없다')
ok((await post(lib.handleSave, tokS, { unitId: unit, title: 'x' })).ok === false, '학생은 목차를 만들 수 없다')
ok((await post(lib.handleConfig, tokS, {})).ok === false, '학생은 설정을 읽을 수 없다')
ok(store.size === 0, '거절된 요청은 아무것도 쓰지 않았다')

console.log('추가 단원 저장')
for (const [unitId, grade] of [['g1u7', 1], ['g2u9', 2]]) {
  const saved = await post(lib.handleSave, tokT, { unitId, title: '새 단원의 소단원' })
  ok(saved.ok && saved.textbook.grade === grade && saved.textbook.unitId === unitId, `${unitId} 소단원을 올바른 학년으로 저장한다`)
}

console.log('만들기 · 순서')
const a = await post(lib.handleSave, tokT, { unitId: unit, title: '1. 생물을 이루는 세포', description: '세포의 구조' })
const b = await post(lib.handleSave, tokT, { unitId: unit, title: '2. 생물의 다양성' })
ok(a.ok && b.ok, '강사는 소단원을 만든다')
ok(a.textbook.published === false && a.textbook.objectKey === null, '새 소단원은 PDF 가 없어 학생에게 안 보인다')
ok(a.textbook.sortOrder === 1 && b.textbook.sortOrder === 2, '표시 순서가 1, 2 로 붙는다')
ok((await post(lib.handleSave, tokT, { unitId: 'g9u9', title: 'x' })).ok === false, '없는 단원에는 만들 수 없다')
const A = a.textbook.id
const Bid = b.textbook.id

console.log('PDF 검사')
const notPdf = Buffer.from('<html>not a pdf</html>')
const r1 = await upload(tokT, A, notPdf, 'fake.pdf')
ok(r1.ok === false && /PDF 파일이 아닙니다/.test(r1.message), `머리가 %PDF- 가 아니면 거절 — ${r1.message}`)
ok(objects.size === 0, '거절된 파일은 저장소에 남지 않는다')
ok((await upload(tokT, A, pdf(100), 'chapter.txt')).ok === false, '.pdf 가 아닌 이름은 거절')
ok((await upload(tokT, A, pdf(100), 'chapter.pdf', 'text/plain')).ok === false, 'application/pdf 가 아닌 형식은 거절')
const big = await upload(tokT, A, pdf(3 * 1024 * 1024))
ok(big.ok === false && /2 MB/.test(big.message), `상한(2 MB)을 넘으면 거절 — ${big.message}`)
ok((await upload(tokS, A, pdf(100))).ok === false, '학생은 PDF 를 올릴 수 없다')

console.log('올리기')
const t0 = Date.now()
const first = await upload(tokT, A, pdf(1024 * 1024), '1장 세포.pdf')
const ms = Date.now() - t0
ok(first.ok, `1 MB PDF 를 올려 연결했다 (${ms} ms)`)
const key1 = docOf(A).objectKey
ok(key1 && objects.has(key1) && objects.get(key1).length === 1024 * 1024, 'R2 에 같은 크기로 들어갔다')
ok(docOf(A).originalFileName === '1장 세포.pdf' && docOf(A).fileSize === 1024 * 1024, '원본 파일명과 크기가 목차에 적혔다')
ok(docOf(A).published === true, 'PDF 가 붙으면 바로 공개된다 (따로 누를 것이 없다)')
ok(key1.startsWith(`textbook/${unit}/${A}/`) && !key1.includes('세포'), '저장 키는 고유하고 원본 이름을 쓰지 않는다')

console.log('바꾸기 실패 — 기존 교재 유지')
failNextPut = true
const f1 = await upload(tokT, A, pdf(2000))
ok(f1.ok === false && docOf(A).objectKey === key1 && objects.has(key1), `저장소가 실패하면 옛 파일·연결이 그대로 — ${f1.message}`)
ok(objects.size === 1, '실패한 새 파일은 남지 않는다')
failNextCommit = true
const f2 = await upload(tokT, A, pdf(3000))
ok(f2.ok === false && docOf(A).objectKey === key1 && objects.has(key1), `목차 연결이 실패하면 옛 파일·연결이 그대로 — ${f2.message}`)
ok(objects.size === 1, '연결에 실패한 새 파일은 지웠다')

console.log('바꾸기 성공')
const urlBefore = (await post(lib.handleReadUrl, tokT, { id: A })).url
const rep = await upload(tokT, A, pdf(4000), '1장 세포 고침.pdf')
const key2 = docOf(A).objectKey
ok(rep.ok && key2 !== key1 && objects.has(key2) && !objects.has(key1), '새 파일이 연결된 뒤 옛 파일을 지웠다')
ok(docOf(A).id === A, '목차 id 는 그대로다')

console.log('순서 · 옛 비공개 맞추기')
store.set(`textbook/${A}`, { ...store.get(`textbook/${A}`), published: { booleanValue: false } })
ok((await post(lib.handleSave, tokT, { id: A, title: docOf(A).title, description: '' })).ok && docOf(A).published === true, '공개 단추 때 비공개로 남은 PDF 소단원은 제목 저장으로 공개가 된다')
ok((await post(lib.handleReorder, tokT, { unitId: unit, ids: [Bid, A] })).ok, '순서를 바꿨다')
ok(docOf(Bid).sortOrder === 1 && docOf(A).sortOrder === 2, '바꾼 순서를 다시 읽어도 같다')
ok((await post(lib.handleReorder, tokT, { unitId: unit, ids: [A] })).ok === false, '목차 하나가 빠진 순서는 거절')
ok((await post(lib.handleReorder, tokS, { unitId: unit, ids: [A, Bid] })).ok === false, '학생은 순서를 바꿀 수 없다')

console.log('읽기 — 주소 · Range · 비공개')
const get = (url, headers = {}) => lib.handleFile(env, new Request(`https://x${url}`, { headers }))
const sUrl = (await post(lib.handleReadUrl, tokS, { id: A })).url
ok(Boolean(sUrl) && !sUrl.includes('textbook/g'), '학생이 공개 교재 주소를 받는다 (저장 키가 주소에 없다)')
const full = await get(sUrl)
ok(full.status === 200 && Number(full.headers.get('content-length')) === 4000 && full.headers.get('accept-ranges') === 'bytes', '전체를 받는다')
const part = await get(sUrl, { range: 'bytes=0-4' })
ok(part.status === 206 && (await part.text()) === '%PDF-' && part.headers.get('content-range') === 'bytes 0-4/4000', 'Range 로 앞 다섯 바이트만 받는다')
ok((await get(sUrl, { range: 'bytes=9999-' })).status === 416, '범위 밖 Range 는 416')
ok((await get(sUrl.replace(/sig=[0-9a-f]{4}/, 'sig=0000'))).status === 403, '서명을 고치면 403')
ok((await lib.handleFile(env, new Request(`https://x${sUrl}`), Date.now() + 31 * 60 * 1000)).status === 403, '30분이 지나면 403')
ok((await get(urlBefore)).status === 403, 'PDF 를 바꾸기 전의 주소는 죽었다')
ok((await post(lib.handleReadUrl, tokS, { id: Bid })).ok === false, '학생은 비공개(파일 없음) 소단원 주소를 받지 못한다')
store.set(`textbook/${A}`, { ...store.get(`textbook/${A}`), published: { booleanValue: false } })
ok((await post(lib.handleReadUrl, tokS, { id: A })).ok === false, '공개가 아닌 소단원은 학생이 주소를 받지 못한다')
ok((await get(sUrl)).status === 404, '공개가 아니게 되면 이미 받은 학생 주소도 열리지 않는다')
const aUrl = await post(lib.handleReadUrl, tokT, { id: A })
ok(aUrl.ok && (await get(aUrl.url)).status === 200, '강사는 공개가 아닌 교재도 미리 본다')

console.log('지우기')
const del = await post(lib.handleDelete, tokS, { id: A })
ok(del.ok === false && store.has(`textbook/${A}`), '학생은 지울 수 없다')
ok((await post(lib.handleDelete, tokT, { id: A })).ok && !store.has(`textbook/${A}`) && !objects.has(key2), '목차와 파일을 함께 지웠다')

console.log('')
if (failures) {
  console.error(`test:textbook: 실패 ${failures}건`)
  process.exit(1)
}
console.log('test:textbook: 통과')

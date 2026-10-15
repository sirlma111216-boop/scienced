/**
 * npm run test:mt-files — 마이크로티칭 발표 내용 · 수업계획안 서버 처리기를 **그 함수 그대로** 불러 본다 (2026-10-16).
 *
 * functions/api/_lib/microteaching.ts 의 applyMicroteaching · cancelMicroteaching · handleMtDetail · handleMtUpload ·
 * handleMtFileUrl · handleMtFile 을 직접 부른다. 바깥(Firestore REST · R2 · Google 공개키 · instructors 문서)만 흉내 낸다 —
 * test-textbook 과 같은 방식이다. 에뮬레이터(Java)가 없어도 돈다.
 */
const lib = await import('../functions/api/_lib/microteaching.ts')
const { TEXTBOOK_UNITS } = await import('../shared/textbook.ts')

const PROJECT = 'mt-test'
const EMU = 'emu.local:8080'
const CID = 'c1'
let failures = 0
const ok = (cond, label) => {
  if (cond) console.log(`  ✓ ${label}`)
  else {
    failures++
    console.error(`  ✗ ${label}`)
  }
}

/* ── 로그인 ── */
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k', alg: 'RS256' }
const b64u = (buf) => Buffer.from(buf).toString('base64url')
async function token(uid) {
  const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const p = b64u(JSON.stringify({ sub: uid, aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, exp: now + 3600, iat: now }))
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(`${h}.${p}`))
  return `${h}.${p}.${b64u(sig)}`
}
const T = 'teacher', S1 = 's1', S2 = 's2', OUT = 'outsider'

/* ── Firestore REST 흉내 ── */
const store = new Map()
const S = (v) => ({ stringValue: v })
const I = (v) => ({ integerValue: String(v) })
store.set(`classes/${CID}`, { status: S('active'), courseId: S('edu'), courseTitle: S('과학교육론'), microteachingOpenAt: I(1) })
for (const [u, sid] of [[S1, '2026001'], [S2, '2026002']]) {
  store.set(`classes/${CID}/enrollments/${u}`, { status: S('active'), studentId: S(sid), nickname: S(`닉${u}`) })
  store.set(`classes/${CID}/roster/${u}`, { rosterName: S(`이름${u}`) })
}
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url
  const method = (init.method ?? 'GET').toUpperCase()
  const res = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  if (url.includes('securetoken@system.gserviceaccount.com')) return res(200, { keys: [jwk] })
  const inst = /\/documents\/instructors\/([^/?]+)$/.exec(url)
  if (inst) {
    const auth = init.headers?.authorization ?? ''
    const caller = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64url').toString()).sub : null
    return caller === T && inst[1] === T ? res(200, { fields: {} }) : res(403, {})
  }
  if (!url.startsWith(`http://${EMU}/`)) return realFetch(input, init)
  const path = url.split('/documents')[1] ?? ''
  if (path === ':commit') {
    const { writes } = JSON.parse(init.body)
    const staged = new Map(store)
    for (const w of writes) {
      const name = (w.update?.name ?? w.delete).split('/documents/')[1]
      const exists = staged.has(name)
      if (w.currentDocument?.exists === true && !exists) return res(400, { error: 'FAILED_PRECONDITION' })
      if (w.currentDocument?.exists === false && exists) return res(409, { error: 'ALREADY_EXISTS' })
      if (w.delete) staged.delete(name)
      else if (w.updateMask) {
        const next = { ...(staged.get(name) ?? {}) }
        for (const f of w.updateMask.fieldPaths) {
          if (w.update.fields[f] === undefined) delete next[f]
          else next[f] = w.update.fields[f]
        }
        staged.set(name, next)
      } else staged.set(name, w.update.fields)
    }
    store.clear()
    for (const [k, v] of staged) store.set(k, v)
    return res(200, {})
  }
  if (method === 'GET') {
    const key = path.replace(/^\//, '')
    return store.has(key) ? res(200, { fields: store.get(key) }) : res(404, {})
  }
  return res(400, {})
}

/* ── R2 흉내 ── */
const objects = new Map()
const bucket = {
  async put(key, stream) {
    const chunks = []
    const r = stream.getReader()
    for (;;) {
      const { done, value } = await r.read()
      if (done) break
      chunks.push(value)
    }
    objects.set(key, Buffer.concat(chunks))
    return { key, size: objects.get(key).length }
  },
  async head(key) {
    return objects.has(key) ? { key, size: objects.get(key).length } : null
  },
  async get(key) {
    const b = objects.get(key)
    return b ? { key, size: b.length, body: new Response(b).body } : null
  },
  async delete(key) {
    objects.delete(key)
  },
}

const env = { FIREBASE_PROJECT_ID: PROJECT, FIRESTORE_EMULATOR_HOST: EMU, TEXTBOOK_BUCKET: bucket, TEXTBOOK_SECRET: 'sec' }
const tok = Object.fromEntries(await Promise.all([T, S1, S2, OUT].map(async (u) => [u, await token(u)])))
const post = async (fn, who, body) => (await fn(env, new Request('https://x/api', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok[who]}` }, body: JSON.stringify(body) }))).json()
const put = async (kind, who, bytes, name) =>
  (await lib.handleMtUpload(env, new Request(`https://x/api/microteaching/${kind}?classId=${CID}`, { method: 'PUT', headers: { authorization: `Bearer ${tok[who]}`, 'content-type': 'application/octet-stream', 'content-length': String(bytes.length), 'x-file-name': encodeURIComponent(name) }, body: bytes, duplex: 'half' }), kind)).json()
const doc = (p) => store.get(p) ?? null
const slotOf = (u) => [...store.entries()].find(([k, f]) => k.startsWith(`classes/${CID}/mtSlots/`) && f.uid?.stringValue === u)?.[1] ?? null
const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(500, 0x41)])
const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(800, 0x42)])
const hwp = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(300, 0x43)])
const unit = TEXTBOOK_UNITS.find((u) => u.grade === 2)
const detail = { classId: CID, grade: 2, unitId: unit.id, topic: '밀도로 물질 구별하기', methods: ['시범실험', '모둠활동'], methodOther: '' }

console.log('발표 내용')
ok((await post(lib.handleMtDetail, S1, detail)).ok === false, '자리를 신청하기 전에는 발표 내용을 적을 수 없다')
ok((await lib.applyMicroteaching(env, { classId: CID, uid: S1, slotId: '2026-11-02_1', now: 10 })).ok, 's1 이 11월 2일 첫 번째 자리를 신청했다')
ok((await post(lib.handleMtDetail, S1, { ...detail, unitId: TEXTBOOK_UNITS.find((u) => u.grade === 1).id })).ok === false, '학년과 맞지 않는 단원은 받지 않는다')
ok((await post(lib.handleMtDetail, S1, { ...detail, topic: ' ' })).ok === false, '주제가 비면 받지 않는다')
ok((await post(lib.handleMtDetail, S1, { ...detail, methods: [], methodOther: '' })).ok === false, '수업 방식이 없으면 받지 않는다')
ok((await post(lib.handleMtDetail, S1, detail)).ok, '발표 내용을 저장했다')
ok(slotOf(S1)?.topic?.stringValue === detail.topic && slotOf(S1)?.unitTitle?.stringValue === unit.title, '자리 문서(같은 반 모두가 봄)에 주제 · 단원이 적혔다')
ok(slotOf(S1)?.methods?.arrayValue?.values?.map((v) => v.stringValue).join() === '시범실험,모둠활동', '수업 방식이 적혔다')
ok(doc(`classes/${CID}/mtApplications/${S1}`)?.topic?.stringValue === detail.topic, '신청 기록에도 같이 적혔다')

console.log('자리 옮기기 · 취소 · 다시 신청')
ok((await lib.applyMicroteaching(env, { classId: CID, uid: S1, slotId: '2026-11-16_2', now: 20 })).ok, '11월 16일 두 번째로 옮겼다')
ok(!doc(`classes/${CID}/mtSlots/2026-11-02_1`) && slotOf(S1)?.topic?.stringValue === detail.topic, '옮긴 자리에 발표 내용이 따라갔다')
ok((await lib.cancelMicroteaching(env, { classId: CID, uid: S1, byInstructor: false })).ok && !slotOf(S1), '취소하면 자리가 비었다')
ok(doc(`classes/${CID}/mtApplications/${S1}`)?.topic?.stringValue === detail.topic && !doc(`classes/${CID}/mtApplications/${S1}`)?.slotId, '취소해도 적어 둔 발표 내용은 신청 기록에 남는다')
ok((await post(lib.handleMtDetail, S1, detail)).ok === false, '자리가 없으면 발표 내용을 고칠 수 없다')
ok((await lib.applyMicroteaching(env, { classId: CID, uid: S1, slotId: '2026-11-23_1', now: 30 })).ok && slotOf(S1)?.topic?.stringValue === detail.topic, '다시 신청하면 발표 내용이 새 자리에 다시 적힌다')

console.log('양식')
ok((await put('plan', S1, pdf, '계획안.pdf')).ok === false, '양식이 올라오기 전에는 계획안을 낼 수 없다')
ok((await put('template', S1, pdf, '양식.pdf')).ok === false, '학생은 양식을 올릴 수 없다')
const badTpl = await put('template', T, pdf, '양식.hwp')
ok(badTpl.ok === false && objects.size === 0, `이름(hwp)과 내용(PDF)이 다르면 받지 않고 남기지 않는다 — ${badTpl.message}`)
ok((await put('template', T, hwp, '수업계획안 양식.hwp')).ok, '강사가 한글 양식을 올렸다')
const tpl1 = doc(`classes/${CID}`)?.mtTemplate?.mapValue?.fields?.key?.stringValue
ok(Boolean(tpl1) && objects.has(tpl1), '클래스 문서와 저장소에 양식이 있다')

console.log('계획안')
ok((await put('plan', S2, docx, '계획안.docx')).ok === false, '자리를 신청하지 않은 학생은 계획안을 낼 수 없다')
ok((await put('plan', S1, docx, '김계획 계획안.docx')).ok, 's1 이 워드 계획안을 냈다')
const plan1 = doc(`classes/${CID}/mtApplications/${S1}`)?.plan?.mapValue?.fields?.key?.stringValue
ok(Boolean(plan1) && objects.has(plan1) && !slotOf(S1)?.plan, '계획안은 신청 기록에만 있다(일정표 자리 문서에는 없다)')
ok((await put('plan', S1, pdf, '김계획 계획안 고침.pdf')).ok, '다시 올렸다')
const plan2 = doc(`classes/${CID}/mtApplications/${S1}`)?.plan?.mapValue?.fields?.key?.stringValue
ok(plan2 !== plan1 && objects.has(plan2) && !objects.has(plan1), '새 파일이 연결된 뒤 옛 파일을 지웠다')

console.log('내려받기 권한')
const get = (url, now) => lib.handleMtFile(env, new Request(`https://x${url}`), now)
const tUrl = await post(lib.handleMtFileUrl, S2, { classId: CID, kind: 'template' })
ok(tUrl.ok, '자리를 신청하지 않은 수강생도 양식은 받는다')
const tRes = await get(tUrl.url)
ok(tRes.status === 200 && /attachment/.test(tRes.headers.get('content-disposition')) && Buffer.from(await tRes.arrayBuffer()).equals(hwp), '양식 파일이 그대로 내려온다')
ok((await post(lib.handleMtFileUrl, OUT, { classId: CID, kind: 'template' })).ok === false, '수강생이 아니면 양식도 받지 못한다')
ok((await post(lib.handleMtFileUrl, S2, { classId: CID, kind: 'plan', uid: S1 })).ok === false, '다른 학생의 계획안은 받지 못한다')
const mine = await post(lib.handleMtFileUrl, S1, { classId: CID, kind: 'plan' })
ok(mine.ok && (await get(mine.url)).status === 200, '자기 계획안은 받는다')
const tch = await post(lib.handleMtFileUrl, T, { classId: CID, kind: 'plan', uid: S1 })
ok(tch.ok && (await get(tch.url)).status === 200, '강사는 학생의 계획안을 받는다')
ok((await get(mine.url.replace(/sig=[0-9a-f]{4}/, 'sig=0000'))).status === 403, '서명을 고치면 403')
ok((await get(mine.url, Date.now() + 11 * 60 * 1000)).status === 403, '10분이 지나면 403')
await put('plan', S1, docx, '세 번째.docx')
ok((await get(mine.url)).status === 403, '계획안을 바꾸면 전에 받은 주소는 죽는다')

console.log('')
if (failures) {
  console.error(`test:mt-files: 실패 ${failures}건`)
  process.exit(1)
}
console.log('test:mt-files: 통과')

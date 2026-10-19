/**
 * npm run test:mt-files — 마이크로티칭 발표 내용 · 수업계획안 서버 처리기를 **그 함수 그대로** 불러 본다 (2026-10-16).
 *
 * functions/api/_lib/microteaching.ts 의 applyMicroteaching · cancelMicroteaching · handleMtDetail · handleMtUpload ·
 * handleMtFileUrl · handleMtFile · handleMtNote · handleMtPeer · handleMtPeerList · handleMtVideoStart/Part/Finish/Abort 를 직접 부른다. 바깥(Firestore REST · R2 · Google 공개키 · instructors 문서)만 흉내 낸다 —
 * test-textbook 과 같은 방식이다. 에뮬레이터(Java)가 없어도 돈다.
 */
const lib = await import('../functions/api/_lib/microteaching.ts')

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
  if (path.endsWith(':runQuery')) {
    const q = JSON.parse(init.body)
    const col = q.structuredQuery.from[0].collectionId
    const parent = (q.parent ?? '').split('/documents/')[1] ?? ''
    const f = q.structuredQuery.where?.fieldFilter
    const rows = [...store.entries()]
      .filter(([k]) => k.startsWith(`${parent}/${col}/`) && k.split('/').length === parent.split('/').length + 2)
      .filter(([, v]) => !f || v[f.field.fieldPath]?.stringValue === f.value.stringValue)
      .map(([k, v]) => ({ document: { name: `projects/x/databases/(default)/documents/${k}`, fields: v } }))
    return res(200, rows.length ? rows : [{}])
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
  async get(key, opts) {
    const b = objects.get(key)
    if (!b) return null
    const part = opts?.range ? b.subarray(opts.range.offset, opts.range.offset + opts.range.length) : b
    return { key, size: b.length, body: new Response(part).body }
  },
  async delete(key) {
    objects.delete(key)
  },
  /* 조각 올리기 — 실제 R2 와 같이 complete 전에는 객체가 없다 */
  async createMultipartUpload(key) {
    const uploadId = 'up-' + Math.random().toString(36).slice(2)
    uploads.set(uploadId, { key, parts: new Map() })
    return this.resumeMultipartUpload(key, uploadId)
  },
  resumeMultipartUpload(key, uploadId) {
    const read = async (stream) => {
      const chunks = []
      const r = stream.getReader()
      for (;;) {
        const { done, value } = await r.read()
        if (done) break
        chunks.push(value)
      }
      return Buffer.concat(chunks)
    }
    return {
      key,
      uploadId,
      async uploadPart(n, stream) {
        const u = uploads.get(uploadId)
        if (!u) throw new Error('no such upload')
        const buf = await read(stream)
        u.parts.set(n, buf)
        return { partNumber: n, etag: 'e' + n + '-' + buf.length }
      },
      async complete(parts) {
        const u = uploads.get(uploadId)
        if (!u) throw new Error('no such upload')
        for (const p of parts) if (!u.parts.has(p.partNumber) || u.parts.get(p.partNumber).length + '' !== p.etag.split('-')[1]) throw new Error('bad part')
        objects.set(key, Buffer.concat(parts.map((p) => u.parts.get(p.partNumber))))
        uploads.delete(uploadId)
        return { key, size: objects.get(key).length }
      },
      async abort() {
        uploads.delete(uploadId)
      },
    }
  },
}
const uploads = new Map()

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
const detail = { classId: CID, topic: '밀도로 물질 구별하기' }

console.log('발표 내용')
ok((await post(lib.handleMtDetail, S1, detail)).ok === false, '자리를 신청하기 전에는 발표 내용을 적을 수 없다')
ok((await lib.applyMicroteaching(env, { classId: CID, uid: S1, slotId: '2026-11-02_1', now: 10 })).ok, 's1 이 11월 2일 첫 번째 자리를 신청했다')
ok((await post(lib.handleMtDetail, S1, { ...detail, topic: ' ' })).ok === false, '주제가 비면 받지 않는다')
ok((await post(lib.handleMtDetail, S1, { ...detail, topic: { text: '주제' } })).ok === false, '문자열이 아닌 주제는 받지 않는다')
ok((await post(lib.handleMtDetail, S1, { ...detail, topic: '가'.repeat(1000) })).ok === false, '너무 긴 주제는 받지 않는다')
ok((await post(lib.handleMtDetail, S1, detail)).ok, '주제 하나만 보내도 저장한다')
ok(slotOf(S1)?.topic?.stringValue === detail.topic, '자리 문서(같은 반 모두가 봄)에 주제가 적혔다')
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

console.log('지도안 피드백')
const note = (who, body) => post(lib.handleMtNote, who, { classId: CID, ...body })
ok((await note(S1, { field: 'planFeedback', text: '좋아요', uid: S1 })).ok === false, '학생은 지도안 피드백을 쓸 수 없다')
ok((await note(T, { field: 'planFeedback', text: '도입이 길다', uid: S2 })).ok === false, '신청하지 않은 학생에게는 쓸 수 없다')
ok((await note(T, { field: 'planFeedback', text: '도입 질문을 하나로 줄이세요.', uid: S1 })).ok, '강사가 s1 의 지도안에 피드백을 적었다')
ok(doc(`classes/${CID}/mtApplications/${S1}`)?.planFeedback?.mapValue?.fields?.text?.stringValue === '도입 질문을 하나로 줄이세요.', '신청 기록에 적혔다 — 본인과 강사만 읽는 자리')
ok((await note(T, { field: 'planFeedback', text: 'x'.repeat(3001), uid: S1 })).ok === false, '3000자를 넘으면 받지 않는다')
ok((await note(S1, { field: 'reflection', text: '잘했다' })).ok === false, '영상이 없으면 후기를 쓸 수 없다')
ok((await note(T, { field: 'videoFeedback', text: '말이 빠르다', uid: S1 })).ok === false, '영상이 없으면 수업 피드백도 쓸 수 없다')

console.log('수업 영상 — 조각 올리기')
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from('ftypisom'), Buffer.alloc(3000, 0x56)])
const vstart = (who, body) => post(lib.handleMtVideoStart, who, { classId: CID, uid: S1, name: '수업.mp4', size: mp4.length, ...body })
ok((await vstart(S1)).ok === false, '학생은 영상을 올릴 수 없다')
ok((await vstart(T, { uid: S2 })).ok === false, '신청하지 않은 학생에게는 올릴 수 없다')
ok((await vstart(T, { name: '수업.avi' })).ok === false, 'avi 는 받지 않는다')
const st = await vstart(T)
ok(st.ok && /\.mp4$/.test(st.key) && st.uploadId && st.partSize === 48 * 1024 * 1024, `시작하면 키 · uploadId · 조각 크기를 준다 (${st.partSize / 1024 / 1024} MB)`)
const part = async (who, n, bytes, key = st.key, uploadId = st.uploadId) =>
  (await lib.handleMtVideoPart(env, new Request(`https://x/api/microteaching/video-part?classId=${CID}&uid=${S1}&key=${encodeURIComponent(key)}&uploadId=${uploadId}&part=${n}`, { method: 'PUT', headers: { authorization: `Bearer ${tok[who]}`, 'content-type': 'application/octet-stream', 'content-length': String(bytes.length) }, body: bytes, duplex: 'half' }))).json()
ok((await part(S1, 1, mp4.subarray(0, 1000))).ok === false, '학생은 조각도 올릴 수 없다')
const badHead = await part(T, 1, Buffer.alloc(1000, 0x41))
ok(badHead.ok === false && /영상 파일이 아닙니다/.test(badHead.message), `첫 조각이 영상 머리가 아니면 거절한다 — ${badHead.message}`)
const p1 = await part(T, 1, mp4.subarray(0, 1000))
const p2 = await part(T, 2, mp4.subarray(1000, 2000))
const p3 = await part(T, 3, mp4.subarray(2000))
ok(p1.ok && p2.ok && p3.ok && p1.etag && p3.partNumber === 3, '조각 셋을 올렸다')
ok(!objects.has(st.key), '합치기 전에는 저장소에 영상이 없다')
const vfin = (who, body) => post(lib.handleMtVideoFinish, who, { classId: CID, uid: S1, key: st.key, uploadId: st.uploadId, parts: [p1, p2, p3].map((p) => ({ partNumber: p.partNumber, etag: p.etag })), name: '수업.mp4', size: mp4.length, ...body })
ok((await vfin(S1)).ok === false, '학생은 합칠 수 없다')
const badSize = await vfin(T, { size: mp4.length + 5 })
ok(badSize.ok === false && !objects.has(st.key), '크기가 다르면 연결하지 않고 치운다')
const st2 = await vstart(T)
const q1 = await part(T, 1, mp4.subarray(0, 1500), st2.key, st2.uploadId)
const q2 = await part(T, 2, mp4.subarray(1500), st2.key, st2.uploadId)
const fin = await post(lib.handleMtVideoFinish, T, { classId: CID, uid: S1, key: st2.key, uploadId: st2.uploadId, parts: [q2, q1].map((p) => ({ partNumber: p.partNumber, etag: p.etag })), name: '수업.mp4', size: mp4.length })
ok(fin.ok && objects.get(st2.key)?.equals(mp4), '순서가 섞여 와도 합친 영상이 원본과 같다')
const vid1 = doc(`classes/${CID}/mtApplications/${S1}`)?.video?.mapValue?.fields
ok(vid1?.key?.stringValue === st2.key && vid1?.name?.stringValue === '수업.mp4' && Number(vid1?.size?.integerValue) === mp4.length, '신청 기록 video 에 연결됐다 — 자리 문서에는 없다')
ok(!slotOf(S1)?.video, '일정표 자리 문서에는 영상이 없다(같은 반이 읽는 문서)')
const st3 = await vstart(T)
const r1 = await part(T, 1, mp4, st3.key, st3.uploadId)
ok((await post(lib.handleMtVideoFinish, T, { classId: CID, uid: S1, key: st3.key, uploadId: st3.uploadId, parts: [r1], name: '수업2.mp4', size: mp4.length })).ok && !objects.has(st2.key) && objects.has(st3.key), '다시 올리면 새 영상을 연결한 뒤 옛 영상을 지운다')
const st4 = await vstart(T)
await part(T, 1, mp4.subarray(0, 1000), st4.key, st4.uploadId)
ok((await post(lib.handleMtVideoAbort, T, { classId: CID, uid: S1, key: st4.key, uploadId: st4.uploadId })).ok && !uploads.has(st4.uploadId) && objects.has(st3.key), '중단하면 조각을 치우고 연결된 영상은 그대로다')

console.log('영상 보기 권한 · Range')
ok((await post(lib.handleMtFileUrl, S2, { classId: CID, kind: 'video', uid: S1 })).ok === false, '다른 학생은 영상 주소를 받지 못한다')
ok((await post(lib.handleMtFileUrl, OUT, { classId: CID, kind: 'video', uid: S1 })).ok === false, '수강생이 아니면 못 받는다')
const vMine = await post(lib.handleMtFileUrl, S1, { classId: CID, kind: 'video' })
ok(vMine.ok && vMine.inline && /&i=1$/.test(vMine.url), '본인은 화면에서 재생하는 주소를 받는다')
const vT = await post(lib.handleMtFileUrl, T, { classId: CID, kind: 'video', uid: S1 })
ok(vT.ok, '강사도 받는다')
const getR = (url, headers, now) => lib.handleMtFile(env, new Request(`https://x${url}`, { headers }), now)
const full = await getR(vMine.url)
ok(full.status === 200 && full.headers.get('content-type') === 'video/mp4' && /^inline/.test(full.headers.get('content-disposition')) && full.headers.get('accept-ranges') === 'bytes' && Buffer.from(await full.arrayBuffer()).equals(mp4), '전체를 inline 으로 받는다')
const rng = await getR(vMine.url, { range: 'bytes=4-11' })
ok(rng.status === 206 && (await rng.text()) === 'ftypisom' && rng.headers.get('content-range') === `bytes 4-11/${mp4.length}`, 'Range 로 일부만 받는다(되감기 · 건너뛰기)')
ok((await getR(vMine.url, { range: 'bytes=999999-' })).status === 416, '범위 밖 Range 는 416')
ok((await getR(vMine.url, {}, Date.now() + 121 * 60 * 1000)).status === 403, '두 시간이 지나면 403')
ok((await getR(vMine.url, {}, Date.now() + 100 * 60 * 1000)).status === 200, '두 시간 안에는 살아 있다')
const pdfInline = await post(lib.handleMtFileUrl, T, { classId: CID, kind: 'plan', uid: S1, inline: true })
ok(pdfInline.ok && pdfInline.inline === false, 'PDF 가 아닌 지도안(docx)은 inline 을 청해도 내려받기다')

console.log('후기 · 수업 피드백')
ok((await note(S1, { field: 'reflection', text: '도입에서 학생 답을 기다리지 못했다.' })).ok, '영상이 올라온 뒤 학생이 후기를 썼다')
ok((await note(S2, { field: 'reflection', text: '남의 것' })).ok === false, '자리가 없는 학생은 후기를 쓸 수 없다')
ok((await note(T, { field: 'videoFeedback', text: '질문 뒤에 셋을 세고 기다리세요.', uid: S1 })).ok, '강사가 수업 피드백을 적었다')
ok((await note(T, { field: 'videoFeedback', text: '', uid: S1 })).ok && !doc(`classes/${CID}/mtApplications/${S1}`)?.videoFeedback, '빈 글을 보내면 지운다')

console.log('동료 의견 — 익명')
const peer = (who, body) => post(lib.handleMtPeer, who, { classId: CID, presenterUid: S1, ...body })
ok((await peer(S1, { good: '내가 나에게' })).ok === false, '자기 수업에는 동료 의견을 쓸 수 없다')
ok((await peer(OUT, { good: '남' })).ok === false, '수강생이 아니면 쓸 수 없다')
ok((await peer(S2, { good: '학생 이름을 불러 가며 물었다.', improve: '판서가 작았다.' })).ok, 's2 가 s1 의 수업에 의견을 적었다')
ok((await post(lib.handleMtPeer, S2, { classId: CID, presenterUid: 'nobody', good: 'x' })).ok === false, '신청하지 않은 사람의 수업에는 쓸 수 없다')
const peerDoc = doc(`classes/${CID}/mtPeer/${S1}__${S2}`)
ok(peerDoc?.authorUid?.stringValue === S2 && peerDoc?.presenterUid?.stringValue === S1, '문서 id 는 발표자__쓴이 — 한 사람이 한 발표자에 하나')
store.set(`classes/${CID}/enrollments/s3`, { status: S('active'), studentId: S('2026003'), nickname: S('닉s3') })
tok.s3 = await token('s3')
ok((await post(lib.handleMtPeer, 's3', { classId: CID, presenterUid: S1, good: '', improve: '실험 안내가 길었다.' })).ok, 's3 도 적었다')
const asPresenter = await post(lib.handleMtPeerList, S1, { classId: CID })
ok(asPresenter.ok && asPresenter.comments.length === 2 && asPresenter.comments.every((c) => !('authorUid' in c) && typeof c.n === 'number'), '발표자는 번호만 받는다 — 쓴 사람 uid 가 없다')
ok(JSON.stringify(asPresenter.comments).includes('판서가 작았다') && !JSON.stringify(asPresenter).includes('s2') && !JSON.stringify(asPresenter).includes('s3'), '발표자 응답 어디에도 쓴 사람이 없다')
const asTeacher = await post(lib.handleMtPeerList, T, { classId: CID, presenterUid: S1 })
ok(asTeacher.ok && asTeacher.comments.length === 2 && new Set(asTeacher.comments.map((c) => c.authorUid)).size === 2 && asTeacher.comments.every((c) => c.authorUid === S2 || c.authorUid === 's3'), '강사는 쓴 사람과 함께 받는다')
ok((await post(lib.handleMtPeerList, S2, { classId: CID, presenterUid: S1 })).ok === false, '다른 학생은 남의 수업 의견 목록을 받지 못한다')
ok((await post(lib.handleMtPeerList, OUT, { classId: CID })).ok === false, '수강생이 아니면 목록도 없다')
ok((await peer(S2, { good: '', improve: '' })).ok && !doc(`classes/${CID}/mtPeer/${S1}__${S2}`), '둘 다 비우면 지운다')
ok((await peer(S2, { good: 'x'.repeat(801) })).ok === false, '800자를 넘으면 받지 않는다')

console.log('')
if (failures) {
  console.error(`test:mt-files: 실패 ${failures}건`)
  process.exit(1)
}
console.log('test:mt-files: 통과')

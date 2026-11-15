/** 실제 브라우저 전송 함수 → 실제 서버 처리기. 외부 Firebase/R2/XHR만 흉내 낸다. */
import { registerHooks } from 'node:module'
import { createHash } from 'node:crypto'
import fs from 'node:fs'

export async function testVideoUpload({ lib, env, tok, teacher, student, classId, ok }) {
  const source = process.env.MT_VIDEO_SOURCE
  const sourceStat = source ? fs.statSync(source) : null
  const sourceFd = source ? fs.openSync(source, 'r') : null
  const size = sourceStat?.size ?? 600 * 1024 ** 2
  const sourceBytes = (start, length) => {
    const b = Buffer.alloc(length)
    if (sourceFd !== null) {
      let count = 0
      while (count < length) {
        const read = fs.readSync(sourceFd, b, count, length - count, start + count)
        if (!read) throw new Error('Unexpected end of source video')
        count += read
      }
    }
    return b
  }
  console.log(`${(size / 1024 ** 2).toFixed(1)} MiB ${source ? '촬영 원본' : '시험 영상'} — 실제 클라이언트와 서버 처리기 연결`)
  const started = performance.now()
  const token = tok[teacher]
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === './firebase' && context.parentURL?.endsWith('/src/lib/api.ts')) {
        return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`export const getFirebaseAuth = () => ({currentUser:{getIdToken:async()=>${JSON.stringify(token)}}})`) }
      }
      return next(specifier, context)
    },
  })
  const savedFetch = globalThis.fetch
  const savedBucket = env.TEXTBOOK_BUCKET
  const savedXHR = globalThis.XMLHttpRequest
  const savedStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const storage = new Map()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k),
  } })
  const pending = new Map(), completed = new Map()
  let nextId = 0, startCount = 0, finishCount = 0, maxRequest = 0
  const sent = []
  let transientPart = 3, pausePart = 6, controller = new AbortController()
  let loseFinishReply = true
  let failureMode = null
  const header = source ? sourceBytes(0, 12) : Buffer.from([0, 0, 0, 28, ...Buffer.from('ftypisom')])

  // 모든 바이트를 흘려보내며 크기와 해시를 확인한다. 600MiB를 메모리에 보관하지 않는다.
  env.TEXTBOOK_BUCKET = {
    async createMultipartUpload(key) {
      const uploadId = `large-${++nextId}`
      pending.set(uploadId, { key, parts: new Map() })
      return this.resumeMultipartUpload(key, uploadId)
    },
    resumeMultipartUpload(key, uploadId) {
      return {
        key, uploadId,
        async uploadPart(partNumber, stream) {
          const item = pending.get(uploadId)
          if (!item || item.key !== key) throw new Error('no such upload')
          const hash = createHash('sha256')
          let size = 0
          for await (const chunk of stream) { size += chunk.length; hash.update(chunk) }
          const etag = hash.digest('hex')
          if (source) {
            const expected = createHash('sha256').update(sourceBytes((partNumber - 1) * 48 * 1024 ** 2, size)).digest('hex')
            if (etag !== expected) throw new Error('Uploaded part differs from source bytes')
          }
          item.parts.set(partNumber, { partNumber, size, etag })
          return { partNumber, etag }
        },
        async complete(parts) {
          const item = pending.get(uploadId)
          if (!item) throw new Error('no such upload')
          let size = 0
          for (let i = 0; i < parts.length; i++) {
            const p = item.parts.get(parts[i].partNumber)
            if (!p || p.etag !== parts[i].etag) throw new Error('bad ETag')
            if (i < parts.length - 1 && (p.size < 5 * 1024 ** 2 || p.size !== item.parts.get(1).size)) throw new Error('R2 part sizes differ')
            size += p.size
          }
          completed.set(key, { key, size })
          pending.delete(uploadId)
          return { key, size }
        },
        async abort() { pending.delete(uploadId) },
      }
    },
    async head(key) { return completed.get(key) ?? null },
    async delete(key) { completed.delete(key) },
    async get(key, options) {
      const obj = completed.get(key)
      if (!obj) return null
      let offset = options?.range?.offset ?? 0
      let remaining = options?.range?.length ?? obj.size
      return { ...obj, body: new ReadableStream({ pull(ctl) {
        if (!remaining) return ctl.close()
        const bytes = source ? sourceBytes(offset, Math.min(remaining, 65536)) : new Uint8Array(Math.min(remaining, 65536))
        if (offset < header.length) bytes.set(header.subarray(offset, Math.min(header.length, offset + bytes.length)))
        remaining -= bytes.length; offset += bytes.length; ctl.enqueue(bytes)
      } }) }
    },
  }
  const routes = {
    'video-start': lib.handleMtVideoStart, 'video-part': lib.handleMtVideoPart,
    'video-finish': lib.handleMtVideoFinish, 'video-abort': lib.handleMtVideoAbort,
  }
  globalThis.fetch = async (url, init) => {
    if (typeof url === 'string' && url.startsWith('/api/microteaching/')) {
      const name = url.split('/').pop()
      if (name === 'video-start') startCount++
      if (name === 'video-finish') finishCount++
      const response = await routes[name](env, new Request(`https://x${url}`, init))
      if (name === 'video-finish' && loseFinishReply) { loseFinishReply = false; throw new Error('simulated lost HTTP reply') }
      return response
    }
    return savedFetch(url, init)
  }
  globalThis.XMLHttpRequest = class {
    upload = {}
    headers = {}
    open(method, path) { this.path = path; this.method = method }
    setRequestHeader(k, v) { this.headers[k] = v }
    abort() { this.aborted = true; this.onabort?.() }
    send(blob) {
      void (async () => {
        const n = Number(new URL(this.path, 'https://x').searchParams.get('part'))
        maxRequest = Math.max(maxRequest, blob.size)
        sent.push(n)
        if (failureMode === 'timeout') { this.ontimeout(); return }
        if (failureMode === 'http') { this.status = 503; this.responseText = JSON.stringify({ ok: true }); this.onload(); return }
        if (n === transientPart) { transientPart = -1; this.onerror(); return }
        if (n === pausePart) { pausePart = -1; controller.abort(); return }
        const response = await lib.handleMtVideoPart(env, new Request(`https://x${this.path}`, {
          method: 'PUT', headers: { ...this.headers, 'content-length': String(blob.size) }, body: blob.stream(), duplex: 'half',
        }))
        if (this.aborted) return
        this.upload.onprogress?.({ lengthComputable: true, loaded: blob.size, total: blob.size })
        this.status = response.status; this.responseText = await response.text(); this.onload()
      })().catch((err) => { console.error(err); this.onerror() })
    }
  }
  try {
    const { uploadMtVideo } = await import('../src/lib/microteaching-video-upload.ts')
    const file = {
      name: 'upload-test.mp4', size, lastModified: sourceStat?.mtimeMs ?? 123,
      slice(start = 0, end = size) {
        const bytes = source ? sourceBytes(start, end - start) : new Uint8Array(end - start)
        if (start < header.length) bytes.set(header.subarray(start, Math.min(header.length, end)))
        return new Blob([bytes])
      },
    }
    let progress = 0
    const paused = await uploadMtVideo(classId, student, file, (n) => { progress = n }, controller.signal)
    ok(!paused.ok && storage.size === 1 && startCount === 1 && sent.filter((n) => n === 3).length === 2, '3번째 조각 네트워크 장애는 자동 재시도하고 6번째에서 즉시 멈춰 기록을 남긴다')
    const firstSentCount = sent.length
    controller = new AbortController()
    // 모듈까지 새로 불러와 메모리 상태 없이 localStorage 기록만으로 이어 올린다.
    const reloaded = await import('../src/lib/microteaching-video-upload.ts?reload=1')
    const resumed = await reloaded.uploadMtVideo(classId, student, file, (n) => { progress = n }, controller.signal)
    ok(resumed.ok && startCount === 1 && sent[firstSentCount] === 6, '새로고침 후 같은 파일은 6번째 조각부터 이어 올린다')
    const expectedParts = Math.ceil(size / (48 * 1024 ** 2))
    ok(resumed.file?.size === size && progress === size && maxRequest === 48 * 1024 ** 2 && sent.at(-1) === expectedParts, `${size}바이트를 48MiB 이하의 ${expectedParts}개 조각으로 보내고 정확한 크기를 연결한다${source ? ' — 모든 조각의 SHA-256이 원본과 일치' : ''}`)
    ok(finishCount === 2 && storage.size === 0, '완료 HTTP 응답 유실은 안전하게 재확인하고 성공한 기록을 지운다')
    const response = await lib.handleMtFileUrl(env, new Request('https://x/api', { method: 'POST', headers: { authorization: `Bearer ${tok[student]}` }, body: JSON.stringify({ classId, kind: 'video' }) }))
    const { url } = await response.json()
    const range = await lib.handleMtFile(env, new Request(`https://x${url}`, { headers: { cookie: response.headers.get('set-cookie').split(';')[0], range: `bytes=${size - 1024}-${size - 1}` } }))
    const lastBytes = Buffer.from(await range.arrayBuffer())
    ok(range.status === 206 && lastBytes.byteLength === 1024 && range.headers.get('content-range') === `bytes ${size - 1024}-${size - 1}/${size}` && (!source || lastBytes.equals(sourceBytes(size - 1024, 1024))), '영상 마지막 구간도 전체 다운로드 없이 Range로 읽으며 원본과 일치한다')

    const { apiUpload } = await import('../src/lib/api.ts')
    failureMode = 'timeout'
    ok((await apiUpload('/api/microteaching/video-part?part=1', new Blob(['test']), {})).retryable, 'XHR 시간 초과를 재시도 가능한 오류로 돌려준다')
    failureMode = 'http'
    const http = await apiUpload('/api/microteaching/video-part?part=1', new Blob(['test']), {})
    ok(!http.ok && http.retryable && http.status === 503, 'HTTP 오류를 JSON ok:true만 보고 성공으로 오인하지 않는다')
    const beforeCancelled = sent.length
    const cancelled = new AbortController(); cancelled.abort()
    ok(!(await apiUpload('/api/microteaching/video-part?part=1', new Blob(['test']), {}, undefined, { signal: cancelled.signal })).ok && beforeCancelled === sent.length, '이미 중단한 요청은 전송하지 않는다')
    const seconds = (performance.now() - started) / 1000
    ok(seconds < 45, `재시도 대기 포함 로컬 처리 ${seconds.toFixed(1)}초 — 45초 이내`)
  } finally {
    globalThis.fetch = savedFetch
    env.TEXTBOOK_BUCKET = savedBucket
    globalThis.XMLHttpRequest = savedXHR
    if (savedStorage) Object.defineProperty(globalThis, 'localStorage', savedStorage)
    else delete globalThis.localStorage
    hook.deregister()
    if (sourceFd !== null) fs.closeSync(sourceFd)
  }
}

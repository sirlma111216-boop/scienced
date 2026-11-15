import { apiPost, apiUpload, type ApiResult } from './api'
import { MT_VIDEO_MAX_MB, MT_VIDEO_PART_MB } from '@shared/microteaching'

interface UploadState {
  fingerprint: string
  key: string
  uploadId: string
  partSize: number
  parts: Array<{ partNumber: number; etag: string }>
  at: number
}
type VideoResult = ApiResult & { file?: { name: string; size: number; ext: string; at: number } }
const memory = new Map<string, UploadState>()
const MAX_AGE = 6 * 24 * 60 * 60_000

function remember(key: string, state: UploadState | null) {
  if (state) memory.set(key, state)
  else memory.delete(key)
  try {
    if (state) localStorage.setItem(key, JSON.stringify(state))
    else localStorage.removeItem(key)
  } catch (err) {
    console.warn('[영상] 이어 올리기 기록은 이 화면에만 보관합니다:', err)
  }
}

function recall(key: string): UploadState | null {
  try {
    const text = localStorage.getItem(key)
    if (!text) return memory.get(key) ?? null
    const s = JSON.parse(text) as UploadState
    if (typeof s.fingerprint !== 'string' || typeof s.key !== 'string' || typeof s.uploadId !== 'string' ||
      !Number.isInteger(s.partSize) || s.partSize < 5 * 1024 * 1024 || s.partSize > MT_VIDEO_PART_MB * 1024 * 1024 ||
      !Number.isFinite(s.at) || !Array.isArray(s.parts) || s.parts.length > 10000 ||
      s.parts.some((p, i) => p.partNumber !== i + 1 || typeof p.etag !== 'string')) return null
    return s
  } catch (err) {
    console.warn('[영상] 이어 올리기 기록을 읽지 못했습니다:', err)
    return memory.get(key) ?? null
  }
}

/** 앞뒤 1 MiB의 해시와 파일 정보를 확인한다. 600 MB 전체를 메모리에 올리지 않는다. */
async function fingerprint(file: File) {
  const edge = 1024 * 1024
  const sample = await new Blob([file.slice(0, edge), file.slice(Math.max(0, file.size - edge))]).arrayBuffer()
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', sample))].map((x) => x.toString(16).padStart(2, '0')).join('')
  return JSON.stringify([file.name, file.size, file.lastModified, hash])
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve() }
    const timer = setTimeout(done, ms)
    signal?.addEventListener('abort', done, { once: true })
    if (signal?.aborted) done()
  })
}

/** 같은 조각 번호로 다시 보내면 R2가 그 조각을 교체한다. 응답 유실도 안전하게 재시도한다. */
async function retry<T extends ApiResult>(work: () => Promise<T>, signal?: AbortSignal, status?: (message: string) => void): Promise<T> {
  let result: T
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) return { ok: false, message: '올리기를 잠시 멈췄습니다.' } as T
    result = await work()
    if (result.ok || !result.retryable || attempt === 3 || signal?.aborted) return result
    status?.(`연결을 다시 확인하고 있습니다. 자동 재시도 ${attempt + 1}/3`)
    await delay(1000 * 2 ** attempt, signal)
  }
}

/** 성공한 조각만 보관한다. 중단·새로고침 후 같은 파일을 선택하면 다음 조각부터 올린다. */
export async function uploadMtVideo(
  classId: string,
  uid: string,
  file: File,
  onProgress?: (sent: number, total: number) => void,
  signal?: AbortSignal,
  onStatus?: (message: string) => void,
  startOver = false,
): Promise<VideoResult> {
  if (file.size <= 0 || file.size > MT_VIDEO_MAX_MB * 1024 * 1024) return { ok: false, message: '영상은 0 바이트보다 크고 4 GB 이하여야 합니다.' }
  const cacheKey = `slstudio:mt-video:v1:${classId}:${uid}`
  try {
    const id = await fingerprint(file)
    if (signal?.aborted) return { ok: false, message: '올리기를 잠시 멈췄습니다.' }
    let state = recall(cacheKey)
    if (state && (startOver || state.fingerprint !== id || Date.now() - state.at > MAX_AGE)) {
      const aborted = await apiPost('/api/microteaching/video-abort', { classId, uid, key: state.key, uploadId: state.uploadId })
      if (!aborted.ok) console.warn('[영상] 이전 조각 정리를 확인하지 못했습니다:', aborted.message)
      remember(cacheKey, null)
      state = null
    }
    if (!state) {
      onStatus?.('영상 올리기를 준비하고 있습니다.')
      const start = await apiPost<ApiResult & { key?: string; uploadId?: string; partSize?: number }>(
        '/api/microteaching/video-start', { classId, uid, name: file.name, size: file.size }, { signal },
      )
      if (!start.ok || !start.key || !start.uploadId || !start.partSize) return { ok: false, message: start.message ?? '올리기를 시작하지 못했습니다.' }
      state = { fingerprint: id, key: start.key, uploadId: start.uploadId, partSize: start.partSize, parts: [], at: Date.now() }
      remember(cacheKey, state)
    }
    const { key, uploadId, partSize } = state
    const totalParts = Math.ceil(file.size / partSize)
    if (state.parts.length > totalParts) return { ok: false, message: '이어 올리기 기록이 맞지 않습니다. 처음부터 올리기를 선택하세요.' }
    onProgress?.(Math.min(state.parts.length * partSize, file.size), file.size)
    const paused = () => ({ ok: false, message: '올리기를 잠시 멈췄습니다. 같은 파일을 선택하면 이어 올립니다.' })
    const q = new URLSearchParams({ classId, uid, key, uploadId })
    for (let n = state.parts.length + 1; n <= totalParts; n++) {
      if (signal?.aborted) return paused()
      const offset = (n - 1) * partSize
      const chunk = file.slice(offset, Math.min(offset + partSize, file.size))
      onStatus?.(`${n}/${totalParts}번째 조각을 올리고 있습니다.`)
      const r = await retry(() => apiUpload<ApiResult & { partNumber?: number; etag?: string }>(
        `/api/microteaching/video-part?${q}&part=${n}`, chunk, { 'content-type': 'application/octet-stream' },
        (sent) => onProgress?.(offset + sent, file.size), { signal },
      ), signal, onStatus)
      if (signal?.aborted) return paused()
      if (!r.ok || !r.etag || r.partNumber !== n) return { ok: false, message: `${r.message ?? '조각을 올리지 못했습니다.'} 같은 파일을 선택하면 이어 올립니다. 계속 실패하면 처음부터 올리기를 선택하세요.` }
      state.parts.push({ partNumber: n, etag: r.etag })
      remember(cacheKey, state)
    }
    if (signal?.aborted) return paused()
    onStatus?.('전송이 끝났습니다. 영상 저장을 확인하고 있습니다.')
    // 완료 요청은 응답만 유실될 수 있다. 서버의 멱등 처리를 이용해 재확인한다.
    const fin = await retry(() => apiPost<VideoResult>('/api/microteaching/video-finish', {
      classId, uid, key, uploadId, parts: state.parts, name: file.name, size: file.size,
    }, { timeoutMs: 120_000 }), undefined, onStatus)
    if (fin.ok) remember(cacheKey, null)
    else return { ...fin, message: `${fin.message ?? '저장을 확인하지 못했습니다.'} 같은 파일을 선택하면 저장을 다시 확인합니다.` }
    return fin
  } catch (err) {
    console.error('[영상] 올리기를 마치지 못했습니다:', err)
    return { ok: false, message: '파일을 읽거나 전송하지 못했습니다. 연결을 확인하고 같은 파일을 선택해 이어 올리세요.' }
  }
}

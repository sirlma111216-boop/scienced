import { MT_FILE_MAX_MB, MT_VIDEO_MAX_MB, mtFileKind, mtVideoKind } from '@shared/microteaching'
import type { MtPeerView } from './types'
import { apiPost, apiUpload } from './api'

/**
 * 마이크로티칭 — 수업계획안 양식(강사) · 내 계획안(학생) 파일 (강의자 지시 2026-10-16).
 *
 *   양식 올리기    uploadMtFile(classId, 'template', file)   강사만. 클래스마다 하나 — 다시 올리면 바뀐다
 *   계획안 올리기  uploadMtFile(classId, 'plan', file)       신청한 본인, 양식이 올라온 뒤에. 다시 올리면 바뀐다
 *   내려받기      openMtFile(classId, kind, uid?)            10분짜리 서명 주소를 받아 바로 내려받는다
 *   화면에서 보기  mtFileUrl(classId, kind, uid?, inline)      PDF 지도안 · 수업 영상은 서명 주소를 받아 <iframe> · <video> 에 건다 (2026-10-17)
 *   영상 올리기    uploadMtVideo(classId, uid, file)          강사만. 48 MB 조각으로 잘라 올리고 서버가 합친다 (요청 하나 100 MB 상한)
 *   글             saveMtNote · saveMtPeer · mtPeerList       지도안 피드백 · 수업 피드백 · 후기 · 동료 의견
 *
 * 쓰기 · 권한은 서버(functions/api/_lib/microteaching.ts)가 본다. 여기 검사는 기다리지 않게 미리 알려 주려는 것이다.
 */

/** 이름 · 크기 · 파일 머리로 한글 · 워드 · PDF 인지 본다. 문제가 없으면 null */
export async function checkMtFile(file: File): Promise<string | null> {
  if (file.size <= 0) return '빈 파일입니다.'
  if (file.size > MT_FILE_MAX_MB * 1024 * 1024) return `파일이 너무 큽니다 — ${MT_FILE_MAX_MB} MB 까지 올릴 수 있습니다.`
  let head = new Uint8Array(0)
  try {
    head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  } catch (err) {
    console.warn('[마이크로티칭] 파일 머리를 읽지 못했다 — 서버가 다시 본다:', err)
    return null
  }
  if (!mtFileKind(file.name, head)) return '한글(hwp · hwpx) · 워드(docx · doc) · PDF 파일만 올릴 수 있습니다. 파일 이름과 내용이 맞는지 확인하세요.'
  return null
}

export const uploadMtFile = (classId: string, kind: 'template' | 'plan', file: File, onProgress?: (sent: number, total: number) => void) =>
  apiUpload<{ ok: boolean; message?: string; file?: { name: string; size: number; ext: string; at: number } }>(
    `/api/microteaching/${kind}?classId=${encodeURIComponent(classId)}`,
    file,
    { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name) },
    onProgress,
  )

export type MtFileKind = 'template' | 'plan' | 'video'
export interface MtSignedFile {
  url: string
  name: string
  ext: string
  size: number
  inline: boolean
}

/** 서명 주소 — inline 이면 PDF · 영상을 화면 안에서 연다. 실패하면 이유 문자열 */
export async function mtFileUrl(classId: string, kind: MtFileKind, uid?: string, inline = false): Promise<MtSignedFile | string> {
  const r = await apiPost<{ ok: boolean; message?: string; url?: string; name?: string; ext?: string; size?: number; inline?: boolean }>('/api/microteaching/file-url', { classId, kind, inline, ...(uid ? { uid } : null) })
  if (!r.ok || !r.url) return r.message ?? '주소를 받지 못했습니다.'
  return { url: r.url, name: r.name ?? '', ext: r.ext ?? '', size: r.size ?? 0, inline: Boolean(r.inline) }
}

/** 내려받기 — 주소를 받아 그 자리에서 연다(파일은 내려받기로 온다). 실패하면 이유를 돌려준다 */
export async function openMtFile(classId: string, kind: 'template' | 'plan', uid?: string): Promise<string | null> {
  const r = await mtFileUrl(classId, kind, uid)
  if (typeof r === 'string') return r
  window.location.href = r.url
  return null
}

/* ─────────────── 수업 영상 (2026-10-17) ─────────────── */

export async function checkMtVideo(file: File): Promise<string | null> {
  if (file.size <= 0) return '빈 파일입니다.'
  if (file.size > MT_VIDEO_MAX_MB * 1024 * 1024) return `영상이 너무 큽니다 — ${MT_VIDEO_MAX_MB / 1024} GB 까지 올릴 수 있습니다.`
  let head = new Uint8Array(0)
  try {
    head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  } catch (err) {
    console.warn('[마이크로티칭] 영상 머리를 읽지 못했다 — 서버가 다시 본다:', err)
    return null
  }
  if (!mtVideoKind(file.name, head)) return 'mp4 · m4v · mov · webm 영상만 올릴 수 있습니다. 파일 이름과 내용이 맞는지 확인하세요.'
  return null
}

/**
 * 영상을 조각으로 올린다. 진행률은 전체 바이트 기준. 조각 하나가 실패하면 서버의 조각을 치우고 이유를 돌려준다.
 * 끝나면 서버가 합쳐 신청 기록 video 에 연결하고 옛 영상을 지운다 — 올리는 도중에는 옛 영상이 그대로 보인다.
 */
export async function uploadMtVideo(
  classId: string,
  uid: string,
  file: File,
  onProgress?: (sent: number, total: number) => void,
  signal?: { cancelled: boolean },
): Promise<{ ok: boolean; message?: string; file?: { name: string; size: number; ext: string; at: number } }> {
  const start = await apiPost<{ ok: boolean; message?: string; key?: string; uploadId?: string; partSize?: number }>('/api/microteaching/video-start', { classId, uid, name: file.name, size: file.size })
  if (!start.ok || !start.key || !start.uploadId || !start.partSize) return { ok: false, message: start.message ?? '올리기를 시작하지 못했습니다.' }
  const { key, uploadId, partSize } = start
  const parts: Array<{ partNumber: number; etag: string }> = []
  const abort = () => apiPost('/api/microteaching/video-abort', { classId, uid, key, uploadId })
  const q = `classId=${encodeURIComponent(classId)}&uid=${encodeURIComponent(uid)}&key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}`
  for (let n = 1, offset = 0; offset < file.size; n++, offset += partSize) {
    if (signal?.cancelled) {
      await abort()
      return { ok: false, message: '올리기를 멈췄습니다.' }
    }
    const chunk = file.slice(offset, Math.min(offset + partSize, file.size))
    const r = await apiUpload<{ ok: boolean; message?: string; partNumber?: number; etag?: string }>(`/api/microteaching/video-part?${q}&part=${n}`, chunk, { 'content-type': 'application/octet-stream' }, (sent) => onProgress?.(offset + sent, file.size))
    if (!r.ok || !r.etag) {
      console.warn('[마이크로티칭] 영상 조각 실패:', n, r.message)
      await abort()
      return { ok: false, message: r.message ?? `${n}번째 조각을 올리지 못했습니다.` }
    }
    parts.push({ partNumber: r.partNumber ?? n, etag: r.etag })
  }
  const fin = await apiPost<{ ok: boolean; message?: string; file?: { name: string; size: number; ext: string; at: number } }>('/api/microteaching/video-finish', { classId, uid, key, uploadId, parts, name: file.name, size: file.size })
  if (!fin.ok) console.warn('[마이크로티칭] 영상을 합치지 못했다:', fin.message)
  return fin
}

/* ─────────────── 글 (2026-10-17) ─────────────── */

export type MtNoteField = 'planFeedback' | 'videoFeedback' | 'reflection'

/** 강사(planFeedback · videoFeedback, uid 필요) · 학생(reflection). 빈 글이면 지운다 */
export const saveMtNote = (classId: string, field: MtNoteField, text: string, uid?: string) => apiPost<{ ok: boolean; message?: string; at?: number }>('/api/microteaching/note', { classId, field, text, ...(uid ? { uid } : null) })

/** 다른 수강생의 수업에 훌륭한 점 · 개선점. 둘 다 비면 지운다 */
export const saveMtPeer = (classId: string, presenterUid: string, good: string, improve: string) => apiPost<{ ok: boolean; message?: string }>('/api/microteaching/peer', { classId, presenterUid, good, improve })

/** 발표자 본인(presenterUid 없음)은 익명 번호만, 강사는 쓴 사람과 함께 */
export const mtPeerList = (classId: string, presenterUid?: string) => apiPost<{ ok: boolean; message?: string; comments?: MtPeerView[] }>('/api/microteaching/peer-list', { classId, ...(presenterUid ? { presenterUid } : null) })

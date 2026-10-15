import { MT_FILE_MAX_MB, mtFileKind } from '@shared/microteaching'
import { apiPost, apiUpload } from './api'

/**
 * 마이크로티칭 — 수업계획안 양식(강사) · 내 계획안(학생) 파일 (강의자 지시 2026-10-16).
 *
 *   양식 올리기    uploadMtFile(classId, 'template', file)   강사만. 클래스마다 하나 — 다시 올리면 바뀐다
 *   계획안 올리기  uploadMtFile(classId, 'plan', file)       신청한 본인, 양식이 올라온 뒤에. 다시 올리면 바뀐다
 *   내려받기      openMtFile(classId, kind, uid?)            10분짜리 서명 주소를 받아 바로 내려받는다
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

/** 내려받기 — 주소를 받아 그 자리에서 연다(파일은 내려받기로 온다). 실패하면 이유를 돌려준다 */
export async function openMtFile(classId: string, kind: 'template' | 'plan', uid?: string): Promise<string | null> {
  const r = await apiPost<{ ok: boolean; message?: string; url?: string }>('/api/microteaching/file-url', { classId, kind, ...(uid ? { uid } : null) })
  if (!r.ok || !r.url) return r.message ?? '내려받지 못했습니다.'
  window.location.href = r.url
  return null
}

import { looksLikePdf, type TextbookDoc } from '@shared/textbook'
import { apiPost, apiUpload } from './api'

/**
 * 교과서 보기 — 화면이 부르는 것 (강의자 지시 2026-10-14).
 *
 *   목차 읽기   repo.watchTextbooks({ publishedOnly })    Firestore `textbook` 구독 (학생: 공개된 것만)
 *   PDF 읽기    textbookReadUrl(id) → url                 서명된 30분짜리 주소. <iframe src> · 새 창에 그대로 쓴다
 *   관리(강사)  saveTextbook · uploadTextbookPdf · reorderTextbooks · deleteTextbook — PDF 가 붙으면 바로 공개된다(따로 누를 것이 없다)
 *
 * 쓰기는 전부 서버가 강사를 확인한 뒤에 한다. 여기 있는 브라우저 검사(확장자 · 형식 · 크기 · 머리 %PDF-)는
 * 기다리지 않게 미리 알려 주려는 것이고, 서버가 같은 검사를 다시 한다.
 */

export interface TextbookConfig {
  ok: boolean
  message?: string
  maxBytes?: number
  storageReady?: boolean
  readReady?: boolean
}

export const textbookConfig = () => apiPost<TextbookConfig>('/api/textbook/config', {})

export const saveTextbook = (a: { id?: string; unitId?: string; title: string; description: string }) =>
  apiPost<{ ok: boolean; message?: string; textbook?: TextbookDoc }>('/api/textbook/save', a)

export const reorderTextbooks = (unitId: string, ids: string[]) => apiPost<{ ok: boolean; message?: string }>('/api/textbook/reorder', { unitId, ids })

export const deleteTextbook = (id: string) => apiPost<{ ok: boolean; message?: string; warnings?: string[] }>('/api/textbook/delete', { id })

export const textbookReadUrl = (id: string) =>
  apiPost<{ ok: boolean; message?: string; url?: string; expiresAt?: number }>('/api/textbook/read-url', { id })

/** 올리기 전에 브라우저에서 본다 — 확장자 · 형식 · 크기 · 파일 머리. 문제가 없으면 null */
export async function checkPdfFile(file: File, maxBytes: number): Promise<string | null> {
  if (!/\.pdf$/i.test(file.name)) return '파일 이름이 .pdf 로 끝나야 합니다.'
  if (file.type && file.type !== 'application/pdf') return 'PDF 파일만 올릴 수 있습니다.'
  if (file.size <= 0) return '빈 파일입니다.'
  if (file.size > maxBytes) return `파일이 너무 큽니다 — ${Math.round(maxBytes / 1024 / 1024)} MB 까지 올릴 수 있습니다.`
  try {
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    if (!looksLikePdf(head)) return 'PDF 파일이 아닙니다. 파일의 내용이 PDF 형식인지 확인하세요.'
  } catch (err) {
    console.warn('[교과서] 파일 머리를 읽지 못했다 — 서버가 다시 본다:', err)
  }
  return null
}

/** PDF 올리기 · 바꾸기 — 목차 id 는 그대로다. 실패하면 서버가 새 파일을 지우고 기존 교재를 그대로 둔다 */
export const uploadTextbookPdf = (id: string, file: File, onProgress?: (sent: number, total: number) => void) =>
  apiUpload<{ ok: boolean; message?: string; textbook?: TextbookDoc; warnings?: string[] }>(
    `/api/textbook/upload?id=${encodeURIComponent(id)}`,
    file,
    { 'content-type': 'application/pdf', 'x-file-name': encodeURIComponent(file.name) },
    onProgress,
  )

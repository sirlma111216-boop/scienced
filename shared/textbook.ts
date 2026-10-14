/**
 * 교과서 보기 — 화면 · 서버 함수 · 검증기가 같이 읽는 상수와 꼴 (강의자 지시 2026-10-14).
 *
 * 나무 구조: 학년 → 단원 → 소단원 (강의자 지시 2026-10-14 — 「설정할 때도 보는 것도 학년 · 단원 · 소단원으로 들어가서 고르게」).
 *   · 학년 · 단원은 학교에서 지금 쓰는 교과서의 단원이다 (강의자 2026-10-14 — 「1·2학년은 2022 개정, 3학년은 2015 개정」).
 *     1·2학년은 이 저장소가 장면 표기에 쓰는 2022 개정 목록 그대로(CLAUDE.md 「학년 · 단원 표기」), 3학년은 2015 개정 중3 과학의 여덟 단원이다.
 *     새 분류를 만들지 않는다. 단원을 고치려면 이 목록 하나를 고친다 — 3학년이 2022 개정으로 바뀌는 해에 여기만 바꾼다.
 *   · 소단원이 목차 하나다 — 강사가 제목을 적고 PDF 한 개를 붙인다. 소단원 목록은 코드가 아니라 저장소(Firestore)에 있어
 *     추가·수정에 재배포가 필요 없다.
 *
 * 목차(TextbookDoc)는 Firestore `textbook/{id}` 에, PDF 는 Cloudflare R2 버킷에 둔다.
 * 쓰기는 전부 서버 함수(강사 판정 뒤)만 한다. 학생 화면은 공개된 목차를 구독해 읽고, PDF 는 서명된 짧은 주소로 받는다.
 */

export type TextbookGrade = 1 | 2 | 3

export interface TextbookUnit {
  id: string
  grade: TextbookGrade
  title: string
}

const units = (grade: TextbookGrade, titles: string[]): TextbookUnit[] => titles.map((title, i) => ({ id: `g${grade}u${i + 1}`, grade, title }))

/** 학년마다 어느 교육과정의 교과서인가 */
export const TEXTBOOK_CURRICULUM: Record<TextbookGrade, string> = { 1: '2022 개정', 2: '2022 개정', 3: '2015 개정' }

/** 학년마다 단원 — 1·2학년 2022 개정(CLAUDE.md 「학년 · 단원 표기」), 3학년 2015 개정 */
export const TEXTBOOK_UNITS: TextbookUnit[] = [
  ...units(1, ['생물의 구성과 다양성', '열', '물질의 상태 변화', '힘의 작용', '기체의 성질', '태양계']),
  ...units(2, ['물질의 구성', '전기와 자기', '지권의 변화', '빛과 파동', '물질의 특성', '식물과 에너지', '동물과 에너지', '수권과 해수의 순환']),
  ...units(3, ['화학 반응의 규칙과 에너지 변화', '기권과 날씨', '운동과 에너지', '자극과 반응', '생식과 유전', '에너지 전환과 보존', '별과 우주', '과학기술과 인류 문명']),
]
export const TEXTBOOK_GRADES: TextbookGrade[] = [1, 2, 3]
export const gradeLabel = (g: TextbookGrade) => `중학교 ${g}학년`
/** 「중학교 3학년 · 2015 개정」 */
export const gradeLongLabel = (g: TextbookGrade) => `${gradeLabel(g)} · ${TEXTBOOK_CURRICULUM[g]}`
export const unitOf = (id: string | null | undefined) => TEXTBOOK_UNITS.find((u) => u.id === id) ?? null
export const isTextbookUnit = (v: unknown): v is string => typeof v === 'string' && TEXTBOOK_UNITS.some((u) => u.id === v)

/** 목차(소단원) 하나 — Firestore 문서 그대로 */
export interface TextbookDoc {
  id: string
  grade: TextbookGrade
  unitId: string
  /** 소단원 제목 — 강사가 자유롭게 적는다 (예: 「1. 생물을 이루는 세포」) */
  title: string
  description: string
  /** 같은 단원 안의 표시 순서 */
  sortOrder: number
  published: boolean
  /** R2 객체 키. 파일이 아직 없으면 null — 그러면 공개할 수 없다 */
  objectKey: string | null
  originalFileName: string | null
  fileSize: number | null
  contentType: string | null
  createdAt: number
  updatedAt: number
}

/** 올릴 수 있는 PDF 크기 상한(MB). Cloudflare Pages Functions 의 요청 본문 상한이 100 MB 라 그 아래로 둔다 */
export const TEXTBOOK_MAX_MB_DEFAULT = 95
export const TEXTBOOK_TITLE_MAX = 80
export const TEXTBOOK_DESCRIPTION_MAX = 300
/** 읽기 주소의 유효 시간 — 학생이 한 번 열어 읽는 동안이면 된다 */
export const TEXTBOOK_READ_TTL_MS = 30 * 60 * 1000

export const TEXTBOOK_ID_RE = /^tb_[a-z0-9]{6,24}$/

/** 파일 크기를 사람이 읽는 글로 */
export function fileSizeText(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** 목차를 화면 순서로 — 학년 · 단원(목록 순) · 표시 순서 · 만든 때 */
export function sortTextbooks<T extends { unitId: string; sortOrder: number; createdAt: number }>(list: T[]): T[] {
  const rank = (u: string) => {
    const i = TEXTBOOK_UNITS.findIndex((x) => x.id === u)
    return i < 0 ? 999 : i
  }
  return [...list].sort((a, b) => rank(a.unitId) - rank(b.unitId) || a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
}

/** 나무로 묶는다 — 학년마다 단원마다 소단원 목록. 빈 단원도 들어간다(설정 화면이 그 자리에 「추가」를 둔다) */
export function textbookTree<T extends { unitId: string; sortOrder: number; createdAt: number }>(list: T[]): Array<{ grade: TextbookGrade; units: Array<{ unit: TextbookUnit; items: T[] }> }> {
  const sorted = sortTextbooks(list)
  return TEXTBOOK_GRADES.map((grade) => ({
    grade,
    units: TEXTBOOK_UNITS.filter((u) => u.grade === grade).map((unit) => ({ unit, items: sorted.filter((d) => d.unitId === unit.id) })),
  }))
}

/** PDF 파일 머리 — 브라우저 검사와 서버 검사가 같은 것을 본다 */
export const PDF_MAGIC = '%PDF-'
export function looksLikePdf(head: Uint8Array): boolean {
  if (head.length < PDF_MAGIC.length) return false
  for (let i = 0; i < PDF_MAGIC.length; i++) if (head[i] !== PDF_MAGIC.charCodeAt(i)) return false
  return true
}

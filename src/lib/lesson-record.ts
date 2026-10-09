import type { FieldDef } from '@/content/types'
import type { ResponseDoc } from './types'

/**
 * 차시 활동 기록 — 화면을 부르지 않는 순수 함수 (강의자 지시 2026-10-09).
 *
 * 학생이 낸 값을 사람이 읽는 글로 바꾼다. 값을 고치지 않는다 — 읽기만 한다.
 * verify:record 가 칸 종류마다 이 함수를 그대로 불러 본다.
 */

/** 응답 문서의 마지막으로 낸 판. 낸 적이 없으면(임시 저장만) null */
export function lastSubmitted(doc: ResponseDoc | null | undefined): { payload: Record<string, unknown>; at: number } | null {
  const v = doc?.versions?.[doc.versions.length - 1]
  if (!v) return null
  return { payload: (v.payload ?? {}) as Record<string, unknown>, at: v.createdAt }
}

const labelOf = (field: FieldDef, id: string) => field.items?.find((i) => i.id === id)?.label ?? id

/** 칸 하나의 값을 글로. 비어 있으면 '' */
export function answerText(field: FieldDef, value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  switch (field.kind) {
    case 'text':
    case 'longtext':
    case 'choice':
      return String(value)
    case 'multi':
      return Array.isArray(value) ? value.map(String).join(' · ') : String(value)
    case 'allocation': {
      if (typeof value !== 'object') return String(value)
      const v = value as Record<string, unknown>
      return (field.items ?? [])
        .map((it) => ({ label: it.label, n: Number(v[it.id]) || 0 }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n)
        .map((x) => `${x.label} ${x.n}`)
        .join(' · ')
    }
    case 'rank':
      return Array.isArray(value) ? value.map((id, i) => `${i + 1}. ${labelOf(field, String(id))}`).join('  ') : String(value)
    case 'sort': {
      if (typeof value !== 'object') return String(value)
      const v = value as Record<string, unknown>
      return (field.bins ?? [])
        .map((b) => {
          const inBin = (field.items ?? []).filter((it) => v[it.id] === b.id).map((it) => it.label)
          return inBin.length ? `[${b.label}] ${inBin.join(', ')}` : ''
        })
        .filter(Boolean)
        .join('  ')
    }
    case 'quadrant': {
      if (typeof value !== 'object') return String(value)
      const v = value as Record<string, unknown>
      return (field.quadrants ?? [])
        .map((q) => (typeof v[q.id] === 'string' && (v[q.id] as string).trim() ? `${q.label}: ${(v[q.id] as string).trim()}` : ''))
        .filter(Boolean)
        .join('  ')
    }
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }
}

export type NameMode = 'real' | 'nickname' | 'anon'

/** 「학생 1」, 「학생 2」 … — 학번 순으로 번호를 매긴다. 같은 화면 안에서 늘 같은 사람이 같은 번호다 */
export function anonLabels(people: Array<{ uid: string; studentId: string | null }>): Record<string, string> {
  const sorted = [...people].sort((a, b) => (a.studentId ?? '').localeCompare(b.studentId ?? '', 'ko') || a.uid.localeCompare(b.uid))
  return Object.fromEntries(sorted.map((p, i) => [p.uid, `학생 ${i + 1}`]))
}

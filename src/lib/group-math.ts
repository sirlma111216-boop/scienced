import type { FieldDef, GroupFormat } from '@/content/types'

/**
 * 모둠 데이터 계산 (8차 4.6) — React 도 Firestore 도 모른다.
 * 학생 화면(내 모둠)·강사 화면(모둠별 나란히)·검사가 같은 함수를 쓴다.
 */

export interface MemberValue {
  uid: string
  nickname: string
  value: unknown
  reason?: string
}

/** allocation — 요소별 모둠 평균 (정수) */
export function allocationAverage(field: FieldDef, members: MemberValue[]): Array<{ id: string; label: string; avg: number }> {
  const items = field.items ?? []
  return items.map((it) => {
    const xs = members.map((m) => Number((m.value as Record<string, number> | undefined)?.[it.id]) || 0)
    const avg = xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0
    return { id: it.id, label: it.label, avg }
  })
}

/** rank — 순위 합산이 작을수록 앞. value 는 id 순서 배열 */
export function rankSum(field: FieldDef, members: MemberValue[]): Array<{ id: string; label: string; sum: number; place: number }> {
  const items = field.items ?? []
  const rows = items.map((it) => {
    let sum = 0
    for (const m of members) {
      const order = Array.isArray(m.value) ? (m.value as string[]) : items.map((i) => i.id)
      const pos = order.indexOf(it.id)
      sum += pos < 0 ? items.length : pos + 1
    }
    return { id: it.id, label: it.label, sum }
  })
  rows.sort((a, b) => a.sum - b.sum)
  return rows.map((r, i) => ({ ...r, place: i + 1 }))
}

/** vote — 선택지별 인원 */
export function voteCounts(field: FieldDef, members: MemberValue[]): Array<{ option: string; count: number; uids: string[] }> {
  const options = field.options ?? []
  const by = new Map<string, string[]>(options.map((o) => [o, []]))
  for (const m of members) {
    const v = typeof m.value === 'string' ? m.value : ''
    if (!by.has(v)) by.set(v, [])
    if (v) by.get(v)!.push(m.uid)
  }
  return [...by.entries()].map(([option, uids]) => ({ option, count: uids.length, uids }))
}

/** sort — 카드마다 통별 인원. 갈린 카드 = 한 통에 다 들어가지 않은 카드 */
export function sortTally(field: FieldDef, members: MemberValue[]): Array<{ id: string; label: string; counts: Record<string, number>; split: boolean }> {
  const items = field.items ?? []
  const bins = field.bins ?? []
  return items.map((it) => {
    const counts: Record<string, number> = Object.fromEntries(bins.map((b) => [b.id, 0]))
    for (const m of members) {
      const v = (m.value as Record<string, string> | undefined)?.[it.id]
      if (v && v in counts) counts[v] += 1
    }
    const filled = Object.values(counts).filter((n) => n > 0).length
    return { id: it.id, label: it.label, counts, split: filled > 1 }
  })
}

/** 모둠 값의 요약 한 줄 — 발표 모드 큰 화면과 검사에 쓴다 */
export function summarize(format: GroupFormat, field: FieldDef, members: MemberValue[]): string {
  if (members.length === 0) return '아직 낸 사람이 없다'
  switch (format) {
    case 'allocation': {
      const top = [...allocationAverage(field, members)].sort((a, b) => b.avg - a.avg)[0]
      return top ? `${top.label} ${top.avg}점이 가장 높다` : ''
    }
    case 'rank': {
      const first = rankSum(field, members)[0]
      return first ? `1순위 ${first.label}` : ''
    }
    case 'vote': {
      const top = [...voteCounts(field, members)].sort((a, b) => b.count - a.count)[0]
      return top ? `${top.option} ${top.count}명` : ''
    }
    case 'sort': {
      const split = sortTally(field, members).filter((r) => r.split)
      return split.length === 0 ? '갈린 카드가 없다' : `갈린 카드 ${split.length}장`
    }
    case 'sentence':
      return `${members.length}명이 썼다`
  }
}

/** 형식과 칸 종류가 맞는가 (verify:flow) */
export function formatMatchesField(format: GroupFormat, field: FieldDef | undefined): boolean {
  if (!field) return false
  switch (format) {
    case 'allocation':
      return field.kind === 'allocation'
    case 'rank':
      return field.kind === 'rank'
    case 'vote':
      return field.kind === 'choice'
    case 'sentence':
      return field.kind === 'longtext' || field.kind === 'text'
    case 'sort':
      return field.kind === 'sort'
  }
}

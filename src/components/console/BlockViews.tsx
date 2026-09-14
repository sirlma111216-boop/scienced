import { useMemo, useState } from 'react'
import type { LessonId } from '@/content/types'
import type { AiProposal, GroupShare, Post, ResponseDoc } from '@/lib/types'
import type { ConsoleBlock } from '@/lib/console-registry'
import { AiClusterPanel } from '@/components/teach/AiClusterPanel'
import { WallCard } from '@/components/wall/Wall'
import { Badge, Button, Caption, Notice, ScrollX } from '@/components/ui'
import { latestOf, payloadOf, submitted, useNames } from './shared'

/**
 * 응답 화면 — 블록 종류별 보기 (7차 R.2).
 *
 *   choice   막대 분포. 선택지를 누르면 그것을 고른 사람과 각자의 이유가 펼쳐진다
 *   input    응답 카드 목록. 제출순 / 아직 안 본 것 먼저
 *   sorter   개인과 모둠 배분을 나란히. 가장 갈린 항목 강조
 *   canvas   썸네일 격자. 누르면 크게
 *   wall     고정 · 숨김 · 갈린 글 · 유형 묶기
 *
 * 공통: [크게 띄우기] [재응답 요청] [유형 묶기]. CSV 는 이번에 붙이지 않았다(강의자 결정).
 * 이름은 useNames 가 정한다 — 발표 모드면 닉네임만.
 */

export interface ViewProps {
  classId: string
  lessonId: LessonId
  block: ConsoleBlock
  docs: ResponseDoc[]
  /** 이 차시의 수강생 uid (제출 현황의 분모) */
  studentUids: string[]
  onSpotlight: (uid: string, text: string) => void
  onReask: (uids: string[] | 'all') => void
  onOpenStudent: (uid: string) => void
}

/* ── 공통: 제출 현황 한 줄 ── */
export function SubmissionCount({ docs, studentUids }: { docs: ResponseDoc[]; studentUids: string[] }) {
  const done = docs.filter((d) => submitted(d) && studentUids.includes(d.uid)).length
  return (
    <Badge>
      {done} / {studentUids.length}
    </Badge>
  )
}

function ReaskBar({ onReask, selected }: { onReask: ViewProps['onReask']; selected?: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-xs" style={{ marginTop: 12 }}>
      <Button variant="secondary" onClick={() => onReask('all')}>
        재응답 요청 · 전체
      </Button>
      {selected && selected.length > 0 ? (
        <Button variant="secondary" onClick={() => onReask(selected)}>
          재응답 요청 · 고른 {selected.length}명
        </Button>
      ) : null}
      <Caption>누르면 학생 화면에 「다시 답해 주세요」 카드가 뜹니다. 강제로 열지는 않습니다.</Caption>
    </div>
  )
}

/* ── 선택형 ── */
function selectedOptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string' && value) return [value]
  if (value && typeof value === 'object') {
    /* rank: { id: 순위 } 또는 순서 배열 — 1순위만 센다 */
    const entries = Object.entries(value as Record<string, unknown>)
    const top = entries.sort((a, b) => Number(a[1]) - Number(b[1]))[0]
    return top ? [String(top[0])] : []
  }
  return []
}

export function ChoiceView(p: ViewProps) {
  const { nameOf } = useNames()
  const [open, setOpen] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const f = p.block.field!
  const options = f.kind === 'rank' ? (f.items ?? []).map((i) => i.label) : (f.options ?? [])
  const optionId = (label: string) => (f.kind === 'rank' ? (f.items ?? []).find((i) => i.label === label)?.id ?? label : label)

  const rows = useMemo(() => {
    const by = new Map<string, Array<{ uid: string; reason: string; at: number; v: number }>>()
    for (const o of options) by.set(optionId(o), [])
    for (const d of p.docs) {
      if (!submitted(d) || !p.studentUids.includes(d.uid)) continue
      const last = latestOf(d)!
      const pay = last.payload as Record<string, unknown>
      for (const o of selectedOptions(pay[f.key])) {
        if (!by.has(o)) by.set(o, [])
        by.get(o)!.push({ uid: d.uid, reason: p.block.reasonKey ? String(pay[p.block.reasonKey] ?? '') : '', at: last.createdAt, v: last.v })
      }
    }
    return by
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.docs, p.studentUids, f.key, p.block.reasonKey])
  const total = [...rows.values()].reduce((n, l) => n + l.length, 0)
  const max = Math.max(1, ...[...rows.values()].map((l) => l.length))

  return (
    <div>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <SubmissionCount docs={p.docs} studentUids={p.studentUids} />
        <Caption>{f.kind === 'multi' ? '복수 선택 — 고른 만큼 센다' : f.kind === 'rank' ? '1순위만 센다' : '선택지를 누르면 고른 사람과 이유가 펼쳐집니다'}</Caption>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
        {options.map((label) => {
          const id = optionId(label)
          const list = rows.get(id) ?? []
          const isOpen = open === id
          return (
            <li key={id} style={{ marginBottom: 6 }}>
              <button
                type="button"
                className="flex items-center gap-md"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : id)}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, padding: '8px 0', cursor: 'pointer' }}
              >
                <span className="text-body-sm" style={{ flex: '0 0 40%', fontWeight: isOpen ? 600 : 400 }}>
                  {label}
                </span>
                <span aria-hidden style={{ flex: 1, height: 14, background: '#f1f1f1', borderRadius: 999, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(list.length / max) * 100}%`, background: '#111' }} />
                </span>
                <span className="font-mono text-body-sm" style={{ width: 64, textAlign: 'right' }}>
                  {list.length}명{total > 0 ? ` · ${Math.round((list.length / total) * 100)}%` : ''}
                </span>
              </button>
              {isOpen ? (
                <ul style={{ listStyle: 'none', padding: '4px 0 8px 12px', margin: 0, boxShadow: 'inset 2px 0 0 #111' }}>
                  {list.length === 0 ? (
                    <li className="text-body-sm" style={{ opacity: 0.6 }}>
                      아직 아무도 고르지 않았습니다.
                    </li>
                  ) : null}
                  {list.map((r) => (
                    <li key={r.uid} className="flex items-start gap-xs" style={{ padding: '6px 0', boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                      <label className="flex items-center gap-xxs" style={{ minWidth: 140 }}>
                        <input
                          type="checkbox"
                          checked={picked.has(r.uid)}
                          onChange={(e) =>
                            setPicked((prev) => {
                              const n = new Set(prev)
                              if (e.target.checked) n.add(r.uid)
                              else n.delete(r.uid)
                              return n
                            })
                          }
                          aria-label={`${nameOf(r.uid)} 고르기`}
                        />
                        <button type="button" className="text-link" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: 15 }} onClick={() => p.onOpenStudent(r.uid)}>
                          {nameOf(r.uid)}
                        </button>
                        {r.v > 1 ? <Badge>v{r.v}</Badge> : null}
                      </label>
                      <span className="text-body-sm" style={{ flex: 1, whiteSpace: 'pre-line' }}>
                        {r.reason || <span style={{ opacity: 0.5 }}>이유 없음</span>}
                      </span>
                      {r.reason ? (
                        <button type="button" className="btn-tertiary" style={{ minHeight: 28, fontSize: 12 }} onClick={() => p.onSpotlight(r.uid, `${label}\n\n${r.reason}`)}>
                          크게 띄우기
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
      <ReaskBar onReask={p.onReask} selected={[...picked]} />
    </div>
  )
}

/* ── 서술형 · 전용 모듈 ── */
function textOf(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(' · ')
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    if ('nodes' in o && Array.isArray(o.nodes)) return `노드 ${(o.nodes as unknown[]).length}개 · 연결 ${Array.isArray(o.edges) ? (o.edges as unknown[]).length : 0}개`
    return Object.entries(o)
      .map(([k, v]) => `${k}: ${textOf(v)}`)
      .join('\n')
  }
  return ''
}

const SEEN_KEY = 'sls.console.seen'
function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
function writeSeen(s: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-2000)))
  } catch {
    /* 저장이 막혀도 이번 화면은 돈다 */
  }
}

export function ResponseCardsView(p: ViewProps & { proposals: AiProposal[]; stepTitle: string }) {
  const { nameOf } = useNames()
  const [sort, setSort] = useState<'time' | 'unseen'>('time')
  const [cluster, setCluster] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [seen, setSeen] = useState<Set<string>>(() => readSeen())
  const key = p.block.field?.key ?? '__module'

  const cards = useMemo(() => {
    const out = p.docs
      .filter((d) => submitted(d) && p.studentUids.includes(d.uid))
      .map((d) => {
        const last = latestOf(d)!
        return { uid: d.uid, v: last.v, at: last.createdAt, text: textOf((last.payload as Record<string, unknown>)[key]), changed: last.changedReason }
      })
      .filter((c) => c.text.trim())
    const seenKey = (c: { uid: string; v: number }) => `${p.lessonId}:${p.block.stepId}:${key}:${c.uid}:${c.v}`
    out.sort((a, b) => {
      if (sort === 'unseen') {
        const sa = seen.has(seenKey(a)) ? 1 : 0
        const sb = seen.has(seenKey(b)) ? 1 : 0
        if (sa !== sb) return sa - sb
      }
      return b.at - a.at
    })
    return out.map((c) => ({ ...c, seenKey: seenKey(c) }))
  }, [p.docs, p.studentUids, key, sort, seen, p.lessonId, p.block.stepId])

  function markSeen(k: string) {
    setSeen((prev) => {
      if (prev.has(k)) return prev
      const n = new Set(prev)
      n.add(k)
      writeSeen(n)
      return n
    })
  }

  return (
    <div>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <SubmissionCount docs={p.docs} studentUids={p.studentUids} />
        <span className="text-body-sm" style={{ opacity: 0.7 }}>
          정렬
        </span>
        <button type="button" className="tab" data-selected={sort === 'time'} aria-pressed={sort === 'time'} onClick={() => setSort('time')} style={{ minHeight: 32 }}>
          제출순
        </button>
        <button type="button" className="tab" data-selected={sort === 'unseen'} aria-pressed={sort === 'unseen'} onClick={() => setSort('unseen')} style={{ minHeight: 32 }}>
          아직 안 본 것 먼저
        </button>
        {p.block.controls.includes('cluster') ? (
          <Button variant="secondary" onClick={() => setCluster((v) => !v)} aria-pressed={cluster}>
            유형 묶기
          </Button>
        ) : null}
      </div>
      {cluster ? (
        <div style={{ marginTop: 12 }}>
          <AiClusterPanel classId={p.classId} lessonId={p.lessonId} stepId={p.block.stepId} stepTitle={p.stepTitle} docs={p.docs} proposals={p.proposals} />
        </div>
      ) : null}
      {cards.length === 0 ? (
        <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.6 }}>
          아직 제출한 사람이 없습니다.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', columnWidth: 320, columnGap: 12 }}>
          {cards.map((c) => {
            const isSeen = seen.has(c.seenKey)
            return (
              <li key={c.uid} className="rounded-md" style={{ breakInside: 'avoid', padding: '10px 12px', marginBottom: 10, boxShadow: `inset 0 0 0 ${isSeen ? 1 : 2}px ${isSeen ? '#e6e6e6' : '#111'}` }} onMouseEnter={() => markSeen(c.seenKey)} onFocus={() => markSeen(c.seenKey)}>
                <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
                  <input
                    type="checkbox"
                    checked={picked.has(c.uid)}
                    onChange={(e) =>
                      setPicked((prev) => {
                        const n = new Set(prev)
                        if (e.target.checked) n.add(c.uid)
                        else n.delete(c.uid)
                        return n
                      })
                    }
                    aria-label={`${nameOf(c.uid)} 고르기`}
                  />
                  <button type="button" className="text-link" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: 15, fontWeight: 480 }} onClick={() => p.onOpenStudent(c.uid)}>
                    {nameOf(c.uid)}
                  </button>
                  {c.v > 1 ? <Badge solid>v{c.v} 고쳐 씀</Badge> : null}
                  {!isSeen ? <Badge>새 글</Badge> : null}
                  <span style={{ flex: 1 }} />
                  <button type="button" className="btn-tertiary" style={{ minHeight: 28, fontSize: 12 }} onClick={() => p.onSpotlight(c.uid, c.text)}>
                    크게 띄우기
                  </button>
                </div>
                <p className="text-body-sm" style={{ margin: '6px 0 0', whiteSpace: 'pre-line' }}>
                  {c.text}
                </p>
                {c.changed ? (
                  <p className="text-body-sm" style={{ margin: '6px 0 0', opacity: 0.75 }}>
                    <strong>무엇을 왜 바꿨는가</strong> · {c.changed}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {p.block.controls.includes('reask') ? <ReaskBar onReask={p.onReask} selected={[...picked]} /> : null}
    </div>
  )
}

/* ── 배분 · 4칸 — 개인과 모둠을 나란히 ── */
export function SorterView(p: ViewProps & { shares: GroupShare[]; groupNameOf: (groupId: string) => string }) {
  const { nameOf } = useNames()
  const f = p.block.field
  const isQuadrant = f?.kind === 'quadrant'
  const cols = isQuadrant ? (f?.quadrants ?? []).map((q) => ({ id: q.id, label: q.label })) : (f?.items ?? []).map((i) => ({ id: i.id, label: i.label }))
  const rows = useMemo(
    () =>
      p.docs
        .filter((d) => submitted(d) && p.studentUids.includes(d.uid))
        .map((d) => ({ uid: d.uid, value: (payloadOf(d)[f?.key ?? '__module'] ?? {}) as Record<string, unknown> })),
    [p.docs, p.studentUids, f?.key],
  )
  /* 가장 갈린 항목 — 배분이면 분산이 가장 큰 열 */
  const spread = useMemo(() => {
    if (isQuadrant) return null
    let best: { id: string; sd: number } | null = null
    for (const c of cols) {
      const xs = rows.map((r) => Number(r.value[c.id]) || 0)
      if (xs.length < 2) continue
      const m = xs.reduce((a, b) => a + b, 0) / xs.length
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
      if (!best || sd > best.sd) best = { id: c.id, sd }
    }
    return best
  }, [rows, cols, isQuadrant])
  const groups = useMemo(() => {
    const by = new Map<string, GroupShare[]>()
    for (const s of p.shares) {
      if (!by.has(s.groupId)) by.set(s.groupId, [])
      by.get(s.groupId)!.push(s)
    }
    return [...by.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))
  }, [p.shares])

  if (!f) {
    return (
      <p className="text-body-sm" style={{ opacity: 0.7 }}>
        이 블록은 칸이 아니라 전용 모듈입니다. 응답 목록에서 봅니다.
      </p>
    )
  }
  return (
    <div>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <SubmissionCount docs={p.docs} studentUids={p.studentUids} />
        {spread ? <Badge solid>가장 갈린 항목 · {cols.find((c) => c.id === spread.id)?.label}</Badge> : null}
      </div>
      <ScrollX>
        <table style={{ borderCollapse: 'collapse', marginTop: 12, minWidth: 560, fontSize: 14 }}>
          <thead>
            <tr>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '6px 12px 6px 0' }}>
                {isQuadrant ? '학생' : '학생 / 모둠'}
              </th>
              {cols.map((c) => (
                <th key={c.id} scope="col" className="caption" style={{ textAlign: 'left', padding: '6px 12px 6px 0', fontWeight: spread?.id === c.id ? 700 : 400 }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!isQuadrant &&
              groups.map(([gid, list]) => (
                <tr key={`g${gid}`} style={{ background: '#f6f6f6' }}>
                  <th scope="row" style={{ textAlign: 'left', padding: '6px 12px 6px 0', fontWeight: 600 }}>
                    {p.groupNameOf(gid)} 평균 ({list.length}명)
                  </th>
                  {cols.map((c) => (
                    <td key={c.id} className="font-mono" style={{ padding: '6px 12px 6px 0' }}>
                      {Math.round(list.reduce((n, s) => n + (Number(s.allocation?.[c.id]) || 0), 0) / Math.max(1, list.length))}
                    </td>
                  ))}
                </tr>
              ))}
            {rows.map((r) => (
              <tr key={r.uid} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                <th scope="row" style={{ textAlign: 'left', padding: '6px 12px 6px 0', fontWeight: 400, whiteSpace: 'nowrap' }}>
                  <button type="button" className="text-link" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: 14 }} onClick={() => p.onOpenStudent(r.uid)}>
                    {nameOf(r.uid)}
                  </button>
                </th>
                {cols.map((c) => (
                  <td key={c.id} className={isQuadrant ? 'text-body-sm' : 'font-mono'} style={{ padding: '6px 12px 6px 0', verticalAlign: 'top', maxWidth: isQuadrant ? 240 : undefined, whiteSpace: isQuadrant ? 'pre-line' : undefined }}>
                    {isQuadrant ? String(r.value[c.id] ?? '') : (Number(r.value[c.id]) || 0)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length + 1} className="text-body-sm" style={{ padding: '12px 0', opacity: 0.6 }}>
                  아직 제출한 사람이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </ScrollX>
      {p.block.controls.includes('reask') ? <ReaskBar onReask={p.onReask} /> : null}
    </div>
  )
}

/* ── 노드·그림 — 썸네일 격자 ── */
interface CanvasLike {
  nodes?: Array<{ id: string; label?: string; x: number; y: number; kind?: string }>
  edges?: Array<{ from: string; to: string; relation?: string }>
}

export function CanvasThumb({ value, size = 160, big = false }: { value: CanvasLike; size?: number; big?: boolean }) {
  const nodes = value.nodes ?? []
  const edges = value.edges ?? []
  const xs = nodes.map((n) => n.x)
  const ys = nodes.map((n) => n.y)
  const minX = Math.min(0, ...xs)
  const minY = Math.min(0, ...ys)
  const w = Math.max(200, ...xs.map((x) => x - minX + 80))
  const h = Math.max(120, ...ys.map((y) => y - minY + 40))
  const pos = new Map(nodes.map((n) => [n.id, { x: n.x - minX + 40, y: n.y - minY + 20 }]))
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={big ? '100%' : size} height={big ? undefined : (size * h) / w} role="img" aria-label={`노드 ${nodes.length}개, 연결 ${edges.length}개`} style={{ background: '#fafafa', borderRadius: 8 }}>
      {edges.map((e, i) => {
        const a = pos.get(e.from)
        const b = pos.get(e.to)
        if (!a || !b) return null
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#999" strokeWidth={big ? 2 : 4} />
      })}
      {nodes.map((n) => {
        const q = pos.get(n.id)!
        return (
          <g key={n.id}>
            <circle cx={q.x} cy={q.y} r={big ? 18 : 12} fill="#111" />
            {big ? (
              <text x={q.x + 22} y={q.y + 5} fontSize={14} fill="#111">
                {n.label ?? ''}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

export function CanvasGridView(p: ViewProps & { onEnlarge: (uid: string, value: CanvasLike) => void }) {
  const { nameOf } = useNames()
  const cards = p.docs
    .filter((d) => submitted(d) && p.studentUids.includes(d.uid))
    .map((d) => ({ uid: d.uid, value: (payloadOf(d)['__module'] ?? {}) as CanvasLike }))
  return (
    <div>
      <SubmissionCount docs={p.docs} studentUids={p.studentUids} />
      {cards.length === 0 ? (
        <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.6 }}>
          아직 제출한 사람이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-md" style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
          {cards.map((c) => (
            <li key={c.uid}>
              <button type="button" onClick={() => p.onEnlarge(c.uid, c.value)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }} aria-label={`${nameOf(c.uid)} 크게 보기`}>
                <CanvasThumb value={c.value} />
                <span className="text-body-sm" style={{ display: 'block', marginTop: 4 }}>
                  {nameOf(c.uid)} · 노드 {c.value.nodes?.length ?? 0}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {p.block.controls.includes('reask') ? <ReaskBar onReask={p.onReask} /> : null}
    </div>
  )
}

/* ── 의견 광장 ── */
export function WallView(p: { classId: string; lessonId: LessonId; stepId: string; stepTitle: string; posts: Post[]; proposals: AiProposal[] }) {
  const [cluster, setCluster] = useState(false)
  const split = p.posts.filter((post) => {
    const agree = (post.reactions?.agreed ?? []).length
    const disagree = (post.reactions?.disagree ?? []).length
    return agree > 0 && disagree > 0
  })
  /* 유형 묶기는 응답 문서를 받는다 — 글을 같은 모양으로 넘긴다. 누가 썼는지는 담지 않는다. */
  const asDocs: ResponseDoc[] = p.posts.map((post) => {
    const last = post.versions?.[post.versions.length - 1]
    return { uid: post.uid, versions: [{ v: 1, payload: { opinion: last?.content ?? '' }, confidence: null, createdAt: last?.createdAt ?? 0, changedReason: null }], draft: null, latestV: 1, submittedAt: null }
  })
  return (
    <div>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge>{p.posts.length}개</Badge>
        {split.length > 0 ? <Badge solid>반응이 갈린 글 {split.length}개</Badge> : null}
        <Button variant="secondary" onClick={() => setCluster((v) => !v)} aria-pressed={cluster}>
          유형 묶기
        </Button>
        <Caption>고정한 글은 학생 화면 맨 앞에 옵니다. 삭제는 작성자만 — 강사는 숨김만 씁니다.</Caption>
      </div>
      {cluster ? (
        <div style={{ marginTop: 12 }}>
          <AiClusterPanel classId={p.classId} lessonId={p.lessonId} stepId={p.stepId} stepTitle={p.stepTitle} docs={asDocs} proposals={p.proposals} />
        </div>
      ) : null}
      {p.posts.length === 0 ? (
        <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.6 }}>
          아직 올라온 글이 없습니다.
        </p>
      ) : (
        <div style={{ columnWidth: 300, columnGap: 16, marginTop: 12 }}>
          {[...split, ...p.posts.filter((x) => !split.includes(x))].map((post) => (
            <WallCard key={post.id} classId={p.classId} lessonId={p.lessonId} stepId={p.stepId} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── 자료 공개 · 열기 ── */
export function GateView({ label, kind, on, onToggle }: { label: string; kind: 'reveal' | 'open'; on: boolean; onToggle: () => void }) {
  return (
    <div>
      <Notice tone={on ? 'mint' : 'cream'}>
        <p className="text-body-sm" style={{ margin: 0 }}>
          {kind === 'reveal' ? '자료' : '칸'} 「{label}」 — 지금 학생 화면에서 {on ? '열려 있습니다' : '잠겨 있습니다'}.
        </p>
      </Notice>
      <div style={{ marginTop: 12 }}>
        <Button variant={on ? 'secondary' : 'primary'} aria-pressed={on} onClick={onToggle}>
          {on ? '↩ 되돌리기 (다시 잠그기)' : kind === 'reveal' ? '▸ 자료 공개' : '▸ 열기'}
        </Button>
      </div>
    </div>
  )
}

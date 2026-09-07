import { useCallback, useMemo, useRef, useState } from 'react'
import { Badge, Button, Caption, ScrollX, VisuallyHidden } from '@/components/ui'

/**
 * 모형·논증 지도·개념 지도 공용 캔버스.
 *
 * 9강 모형 버전 관리, 12강 논증 지도가 같은 부품을 쓴다.
 *
 * 두 가지를 강제한다.
 *  · 연결선에는 반드시 관계어를 적는다. 단어만 이어 놓으면 학생이 무엇을 인과로 보는지
 *    드러나지 않는다 (컨텍스트 11강·23.4).
 *  · 모형에는 계의 경계와 "설명하지 못하는 것"이 따로 있다. 예쁜 그림을 점수화하지 않기 위해서다.
 *
 * 접근성: 드래그가 없다. 노드 추가는 양식, 이동은 화살표 키 또는 숫자, 연결은 선택 상자다.
 */

export type CanvasMode = 'model' | 'argument'

export interface CanvasNode {
  id: string
  kind: string
  label: string
  x: number
  y: number
}

export interface CanvasEdge {
  id: string
  from: string
  to: string
  /** 관계어 — 비면 저장되지 않는다 */
  relation: string
}

export interface CanvasValue {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  /** 모형 전용: 계의 경계 안에 무엇을 넣었는가 */
  boundary?: string
  /** 모형 전용: 이 모형이 설명하지 못하는 것 */
  limits?: string
}

const KINDS: Record<CanvasMode, Array<{ key: string; label: string; hint: string }>> = {
  model: [
    { key: 'element', label: '요소', hint: '모형 안에 있는 것' },
    { key: 'process', label: '과정', hint: '일어나는 일' },
    { key: 'quantity', label: '양', hint: '보존되거나 변하는 것' },
    { key: 'boundary', label: '경계', hint: '계의 안팎을 가르는 선' },
  ],
  argument: [
    { key: 'claim', label: '주장', hint: '질문에 대한 결론' },
    { key: 'evidence', label: '증거', hint: '고른 자료와 그 이유' },
    { key: 'reasoning', label: '추론', hint: '증거가 주장과 연결되는 까닭' },
    { key: 'rebuttal', label: '반론', hint: '이 주장의 약점' },
    { key: 'alternative', label: '대안 설명', hint: '같은 자료의 다른 해석' },
  ],
}

/** 관계어 보기. 강제하지는 않고 버튼으로만 제공한다. */
const RELATION_HINTS: Record<CanvasMode, string[]> = {
  model: ['이동한다', '변환된다', '보존된다', '늘어나면 줄어든다', '원인이 된다'],
  argument: ['을(를) 지지한다', '에 대한 반론이다', '을(를) 설명한다', '와(과) 충돌한다'],
}

const NODE_W = 132
const NODE_H = 46
const GRID = 20

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function NodeCanvas({
  mode,
  value,
  onChange,
  readOnly,
}: {
  mode: CanvasMode
  value: CanvasValue | null
  onChange: (v: CanvasValue) => void
  readOnly?: boolean
}) {
  // 매 렌더 새 객체가 되면 아래 useCallback 이 의미를 잃는다.
  const v: CanvasValue = useMemo(
    () => value ?? { nodes: [], edges: [], boundary: '', limits: '' },
    [value],
  )
  const kinds = KINDS[mode]

  const [kind, setKind] = useState(kinds[0].key)
  const [label, setLabel] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [relation, setRelation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const width = 720
  const height = Math.max(320, 120 + Math.ceil(v.nodes.length / 4) * 110)

  const patch = useCallback(
    (next: Partial<CanvasValue>) => onChange({ ...v, ...next }),
    [onChange, v],
  )

  function addNode() {
    if (!label.trim()) {
      setError('이름을 적어 주세요.')
      return
    }
    setError(null)
    // 새 노드는 격자에 순서대로 놓는다. 위치를 손으로 잡을 필요가 없다.
    const i = v.nodes.length
    const node: CanvasNode = {
      id: newId(),
      kind,
      label: label.trim(),
      x: 40 + (i % 4) * 168,
      y: 40 + Math.floor(i / 4) * 110,
    }
    patch({ nodes: [...v.nodes, node] })
    setLabel('')
    setSelected(node.id)
  }

  function addEdge() {
    if (!from || !to) {
      setError('두 노드를 모두 고르세요.')
      return
    }
    if (from === to) {
      setError('같은 노드끼리는 이을 수 없습니다.')
      return
    }
    if (!relation.trim()) {
      // 여기서 막는 것이 이 부품의 핵심이다.
      setError('연결선에 관계를 나타내는 말을 적어야 저장됩니다.')
      return
    }
    setError(null)
    patch({ edges: [...v.edges, { id: newId(), from, to, relation: relation.trim() }] })
    setRelation('')
  }

  function move(id: string, dx: number, dy: number) {
    patch({
      nodes: v.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              x: Math.max(0, Math.min(width - NODE_W, n.x + dx)),
              y: Math.max(0, Math.min(height - NODE_H, n.y + dy)),
            }
          : n,
      ),
    })
  }

  function removeNode(id: string) {
    patch({
      nodes: v.nodes.filter((n) => n.id !== id),
      edges: v.edges.filter((e) => e.from !== id && e.to !== id),
    })
    if (selected === id) setSelected(null)
  }

  const nodeById = useMemo(
    () => Object.fromEntries(v.nodes.map((n) => [n.id, n])),
    [v.nodes],
  )

  const kindLabel = (k: string) => kinds.find((x) => x.key === k)?.label ?? k

  /** 그림을 못 보는 사람도 같은 내용을 읽을 수 있어야 한다. */
  const description = useMemo(() => {
    if (v.nodes.length === 0) return '아직 아무것도 없습니다.'
    const parts = v.edges.map(
      (e) =>
        `${nodeById[e.from]?.label ?? '?'} 이(가) ${nodeById[e.to]?.label ?? '?'} 을(를) ${e.relation}`,
    )
    return `노드 ${v.nodes.length}개, 연결 ${v.edges.length}개. ${parts.join('. ')}`
  }, [v.nodes, v.edges, nodeById])

  return (
    <section className="flex flex-col gap-lg">
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge>{mode === 'model' ? '모형 캔버스' : '논증 지도'}</Badge>
        <Badge>노드 {v.nodes.length}</Badge>
        <Badge>연결 {v.edges.length}</Badge>
      </div>

      {/* 그림 */}
      <ScrollX>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={description}
          style={{ background: '#f7f7f5', borderRadius: 8, maxWidth: '100%' }}
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#000" />
            </marker>
          </defs>

          {/* 연결선 — 선마다 관계어가 붙는다 */}
          {v.edges.map((e) => {
            const a = nodeById[e.from]
            const b = nodeById[e.to]
            if (!a || !b) return null
            const x1 = a.x + NODE_W / 2
            const y1 = a.y + NODE_H / 2
            const x2 = b.x + NODE_W / 2
            const y2 = b.y + NODE_H / 2
            const mx = (x1 + x2) / 2
            const my = (y1 + y2) / 2
            return (
              <g key={e.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#000"
                  strokeWidth={1.5}
                  markerEnd="url(#arrow)"
                />
                <rect
                  x={mx - Math.min(70, e.relation.length * 6)}
                  y={my - 10}
                  width={Math.min(140, e.relation.length * 12)}
                  height={20}
                  rx={10}
                  fill="#fff"
                  stroke="#e6e6e6"
                />
                <text x={mx} y={my + 4} textAnchor="middle" fontSize={11} fill="#000">
                  {e.relation.length > 12 ? `${e.relation.slice(0, 12)}…` : e.relation}
                </text>
              </g>
            )
          })}

          {/* 노드 — 종류를 색이 아니라 글자로 구분한다 */}
          {v.nodes.map((n) => (
            <g key={n.id}>
              <rect
                x={n.x}
                y={n.y}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill="#fff"
                stroke="#000"
                strokeWidth={selected === n.id ? 2.5 : 1}
              />
              <text
                x={n.x + 10}
                y={n.y + 17}
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
                fill="#000"
                opacity={0.6}
              >
                {kindLabel(n.kind)}
              </text>
              <text x={n.x + 10} y={n.y + 34} fontSize={13} fill="#000">
                {n.label.length > 13 ? `${n.label.slice(0, 13)}…` : n.label}
              </text>
            </g>
          ))}
        </svg>
      </ScrollX>

      {readOnly ? null : (
        <>
          {/* 노드 추가 */}
          <div className="card">
            <Caption>노드 추가</Caption>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 200px) 1fr auto',
                gap: 12,
                marginTop: 12,
                alignItems: 'end',
              }}
            >
              <div className="flex flex-col gap-xs">
                <label htmlFor="nc-kind" className="text-body-sm" style={{ fontWeight: 480 }}>
                  종류
                </label>
                <select
                  id="nc-kind"
                  className="field"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  {kinds.map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label} — {k.hint}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-xs">
                <label htmlFor="nc-label" className="text-body-sm" style={{ fontWeight: 480 }}>
                  이름
                </label>
                <input
                  id="nc-label"
                  className="field"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addNode()
                  }}
                />
              </div>
              <Button onClick={addNode}>추가</Button>
            </div>
          </div>

          {/* 연결 추가 */}
          <div className="card">
            <Caption>연결 추가 — 관계어가 없으면 저장되지 않습니다</Caption>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginTop: 12,
              }}
            >
              <div className="flex flex-col gap-xs">
                <label htmlFor="nc-from" className="text-body-sm" style={{ fontWeight: 480 }}>
                  from
                </label>
                <select
                  id="nc-from"
                  className="field"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                >
                  <option value="">고르기</option>
                  {v.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {kindLabel(n.kind)} · {n.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-xs">
                <label htmlFor="nc-rel" className="text-body-sm" style={{ fontWeight: 480 }}>
                  관계 <span className="font-mono text-caption">필수</span>
                </label>
                <input
                  id="nc-rel"
                  className="field"
                  value={relation}
                  placeholder={RELATION_HINTS[mode][0]}
                  onChange={(e) => setRelation(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-xs">
                <label htmlFor="nc-to" className="text-body-sm" style={{ fontWeight: 480 }}>
                  to
                </label>
                <select
                  id="nc-to"
                  className="field"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                >
                  <option value="">고르기</option>
                  {v.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {kindLabel(n.kind)} · {n.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-xxs" style={{ marginTop: 12 }}>
              {RELATION_HINTS[mode].map((r) => (
                <button
                  key={r}
                  type="button"
                  className="btn-tertiary"
                  style={{ fontSize: 13, minHeight: 32, padding: '4px 10px', opacity: 0.8 }}
                  onClick={() => setRelation(r)}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-md" style={{ marginTop: 12 }}>
              <Button onClick={addEdge}>연결</Button>
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-body-sm" style={{ fontWeight: 480 }}>
              ⚠ {error}
            </p>
          ) : null}

          {/* 노드 목록 — 이동과 삭제. 드래그가 아니라 버튼이다. */}
          {v.nodes.length > 0 ? (
            <div className="card">
              <Caption>노드 옮기기 — 화살표 버튼 또는 키보드</Caption>
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
                {v.nodes.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center gap-xs"
                    style={{ padding: '8px 0', boxShadow: 'inset 0 -1px 0 #f1f1f1', flexWrap: 'wrap' }}
                  >
                    <span className="font-mono text-caption" style={{ minWidth: 44 }}>
                      {kindLabel(n.kind)}
                    </span>
                    <button
                      type="button"
                      className="tab"
                      data-selected={selected === n.id}
                      aria-pressed={selected === n.id}
                      onClick={() => setSelected(n.id)}
                      onKeyDown={(e) => {
                        // 선택한 노드는 화살표 키로 움직인다
                        const step = e.shiftKey ? GRID * 3 : GRID
                        if (e.key === 'ArrowLeft') { e.preventDefault(); move(n.id, -step, 0) }
                        if (e.key === 'ArrowRight') { e.preventDefault(); move(n.id, step, 0) }
                        if (e.key === 'ArrowUp') { e.preventDefault(); move(n.id, 0, -step) }
                        if (e.key === 'ArrowDown') { e.preventDefault(); move(n.id, 0, step) }
                      }}
                      style={{ minHeight: 40 }}
                    >
                      {n.label}
                    </button>
                    <span className="flex-1" />
                    <button type="button" className="btn-icon" onClick={() => move(n.id, -GRID, 0)}>
                      <span aria-hidden>←</span>
                      <VisuallyHidden>{n.label} 왼쪽으로</VisuallyHidden>
                    </button>
                    <button type="button" className="btn-icon" onClick={() => move(n.id, GRID, 0)}>
                      <span aria-hidden>→</span>
                      <VisuallyHidden>{n.label} 오른쪽으로</VisuallyHidden>
                    </button>
                    <button type="button" className="btn-icon" onClick={() => move(n.id, 0, -GRID)}>
                      <span aria-hidden>↑</span>
                      <VisuallyHidden>{n.label} 위로</VisuallyHidden>
                    </button>
                    <button type="button" className="btn-icon" onClick={() => move(n.id, 0, GRID)}>
                      <span aria-hidden>↓</span>
                      <VisuallyHidden>{n.label} 아래로</VisuallyHidden>
                    </button>
                    <Button variant="tertiary" onClick={() => removeNode(n.id)}>
                      지우기
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* 연결 목록 */}
          {v.edges.length > 0 ? (
            <div className="card">
              <Caption>연결</Caption>
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
                {v.edges.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-xs text-body-sm"
                    style={{ padding: '6px 0' }}
                  >
                    <span>{nodeById[e.from]?.label ?? '?'}</span>
                    <span style={{ opacity: 0.7 }}>—({e.relation})→</span>
                    <span>{nodeById[e.to]?.label ?? '?'}</span>
                    <span className="flex-1" />
                    <Button
                      variant="tertiary"
                      onClick={() => patch({ edges: v.edges.filter((x) => x.id !== e.id) })}
                    >
                      지우기
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* 모형에는 경계와 한계가 따로 있다 */}
          {mode === 'model' ? (
            <div className="card flex flex-col gap-lg">
              <div className="flex flex-col gap-xs">
                <label htmlFor="nc-boundary" className="text-body-sm" style={{ fontWeight: 480 }}>
                  계의 경계 — 무엇을 안에 넣었고 무엇을 뺐는가
                </label>
                <textarea
                  id="nc-boundary"
                  className="field"
                  rows={2}
                  value={v.boundary ?? ''}
                  onChange={(e) => patch({ boundary: e.target.value })}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="flex flex-col gap-xs">
                <label htmlFor="nc-limits" className="text-body-sm" style={{ fontWeight: 480 }}>
                  이 모형이 설명하지 못하는 것
                </label>
                <textarea
                  id="nc-limits"
                  className="field"
                  rows={2}
                  value={v.limits ?? ''}
                  placeholder="우리 모형은 ___을 설명하지만 ___은 설명하지 못한다"
                  onChange={(e) => patch({ limits: e.target.value })}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <p className="text-body-sm" style={{ opacity: 0.72, margin: 0 }}>
                평가하는 것은 그림 솜씨가 아니라 요소 사이의 인과 관계와 증거에 따른 수정입니다.
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { LESSONS } from '@/content/lessons'
import { useAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, ColorBlock, ScrollX } from '@/components/ui'

/**
 * 개념 연결 지도.
 *
 * 한 학기 동안 '학생의 선행개념 – 학습목표 – 교수모형 – 담화 – 평가 – PCK' 를 잇는 지도를
 * 계속 고친다. 강의가 끝날 때 처음 지도와 마지막 지도를 비교한다.
 *
 * 연결선에 관계어를 반드시 적게 한다. 단어만 이어 놓으면 사고 구조가 보이지 않는다(11강).
 */

interface Edge {
  id: string
  from: string
  to: string
  /** 관계어 — 이게 비면 저장되지 않는다 */
  relation: string
}

const STORAGE = 'sls.v1.conceptMap'

export function ConceptMap() {
  const { user } = useAuth()
  const [edges, setEdges] = useState<Edge[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [relation, setRelation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<Array<{ at: number; count: number }>>([])

  const allConcepts = useMemo(
    () =>
      LESSONS.flatMap((l) =>
        l.keyConcepts.map((c) => ({ id: c.id, term: c.term, lesson: l.id })),
      ),
    [],
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE}.${user?.uid ?? 'anon'}`)
      if (raw) {
        const parsed = JSON.parse(raw) as { edges: Edge[]; snapshots: typeof snapshots }
        setEdges(parsed.edges ?? [])
        setSnapshots(parsed.snapshots ?? [])
      }
    } catch {
      /* 저장소가 막혀도 화면은 동작한다 */
    }
  }, [user?.uid])

  function persist(nextEdges: Edge[], nextSnaps = snapshots) {
    setEdges(nextEdges)
    try {
      localStorage.setItem(
        `${STORAGE}.${user?.uid ?? 'anon'}`,
        JSON.stringify({ edges: nextEdges, snapshots: nextSnaps }),
      )
    } catch {
      /* 무시 */
    }
  }

  function add() {
    if (!from || !to) {
      setError('두 개념을 모두 고르세요.')
      return
    }
    if (from === to) {
      setError('같은 개념끼리는 이을 수 없습니다.')
      return
    }
    if (!relation.trim()) {
      // 관계어가 없으면 단어 나열이 된다. 여기서 막는다.
      setError('연결선에 관계를 나타내는 말을 적어야 저장됩니다. 예: “진단의 근거가 된다”')
      return
    }
    setError(null)
    persist([
      ...edges,
      { id: `${Date.now().toString(36)}`, from, to, relation: relation.trim() },
    ])
    setRelation('')
  }

  function snapshot() {
    const next = [...snapshots, { at: Date.now(), count: edges.length }]
    setSnapshots(next)
    persist(edges, next)
  }

  const label = (id: string) => allConcepts.find((c) => c.id === id)?.term ?? id

  return (
    <AppShell title="개념 지도">
      <p className="eyebrow">한 학기</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        개념 연결 지도
      </h1>
      <p className="text-subhead" style={{ marginTop: 16, maxWidth: 760 }}>
        개념을 잇되, 선마다 관계를 나타내는 말을 적습니다. 단어만 이어 놓으면 무엇을 인과로 보고
        있는지 드러나지 않습니다.
      </p>

      <div className="card" style={{ marginTop: 32 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <div className="flex flex-col gap-xs">
            <label htmlFor="cm-from" className="text-body-sm" style={{ fontWeight: 480 }}>
              개념 A
            </label>
            <select
              id="cm-from"
              className="field"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              <option value="">고르기</option>
              {allConcepts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.lesson}강 · {c.term}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor="cm-rel" className="text-body-sm" style={{ fontWeight: 480 }}>
              관계 <span className="font-mono text-caption">필수</span>
            </label>
            <input
              id="cm-rel"
              className="field"
              value={relation}
              placeholder="예: 진단의 근거가 된다"
              onChange={(e) => setRelation(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor="cm-to" className="text-body-sm" style={{ fontWeight: 480 }}>
              개념 B
            </label>
            <select id="cm-to" className="field" value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">고르기</option>
              {allConcepts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.lesson}강 · {c.term}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-body-sm" style={{ fontWeight: 480, marginTop: 12 }}>
            ⚠ {error}
          </p>
        ) : null}

        <div className="flex items-center gap-md" style={{ marginTop: 16 }}>
          <Button onClick={add}>연결 추가</Button>
          <Button variant="secondary" onClick={snapshot}>
            지금 상태 저장
          </Button>
          <Caption>{edges.length}개 연결 · 저장 {snapshots.length}회</Caption>
        </div>
      </div>

      <section style={{ marginTop: 32 }}>
        <h2 className="text-card-title">내 연결</h2>
        {edges.length === 0 ? (
          <p className="text-body-sm" style={{ opacity: 0.6, marginTop: 12 }}>
            아직 연결이 없습니다.
          </p>
        ) : (
          <ScrollX>
            <table style={{ borderCollapse: 'collapse', minWidth: 640, marginTop: 12 }}>
              <tbody>
                {edges.map((e) => (
                  <tr key={e.id} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                    <td className="text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                      {label(e.from)}
                    </td>
                    <td
                      className="text-body-sm"
                      style={{ padding: '10px 12px', opacity: 0.72, whiteSpace: 'nowrap' }}
                    >
                      —({e.relation})→
                    </td>
                    <td className="text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                      {label(e.to)}
                    </td>
                    <td style={{ padding: '10px 0' }}>
                      <Button
                        variant="tertiary"
                        onClick={() => persist(edges.filter((x) => x.id !== e.id))}
                      >
                        지우기
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        )}
      </section>

      {snapshots.length > 1 ? (
        <div style={{ marginTop: 48 }}>
          <ColorBlock tone="mint">
            <p className="eyebrow">처음과 지금</p>
            <p className="text-subhead" style={{ marginTop: 12 }}>
              처음 저장했을 때 연결 {snapshots[0].count}개 → 지금{' '}
              {snapshots[snapshots.length - 1].count}개.
              단편 지식이 수업 의사결정 체계로 바뀌고 있는지, 연결의 개수보다 관계어의 내용을 보세요.
            </p>
          </ColorBlock>
        </div>
      ) : null}

      <div className="flex gap-xs" style={{ marginTop: 32 }}>
        <Badge>18강에서 처음 지도와 비교합니다</Badge>
      </div>
    </AppShell>
  )
}

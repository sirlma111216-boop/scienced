import { useEffect, useMemo, useState } from 'react'
import { lessonIndex, loadLesson } from '@/content/courses'
import type { LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { courseOf } from '@/lib/lesson-data'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, ColorBlock, ScrollX } from '@/components/ui'

/**
 * 개념 연결 지도.
 *
 * 한 학기 동안 개념을 잇는 지도를 계속 고친다. 연결선에 관계어를 반드시 적게 한다 — 단어만 이어 놓으면 사고 구조가 보이지 않는다.
 * 개념 목록은 공개된 차시의 개념 카드에서 온다 (미공개 차시의 내용은 불러오지 않는다).
 */
interface Edge {
  id: string
  from: string
  to: string
  relation: string
}

const STORAGE = 'sls.v1.conceptMap'

export function ConceptMap() {
  const { user, repo, classId, currentClass, isInstructor } = useAuth()
  const courseId = courseOf(currentClass)
  const [published, setPublished] = useState<LessonId[]>([])
  const [concepts, setConcepts] = useState<Array<{ id: string; term: string; lesson: LessonId }>>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [relation, setRelation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<Array<{ at: number; count: number }>>([])

  useEffect(() => {
    if (!repo || !classId) return
    return repo.watchLessonState(classId, setPublished)
  }, [repo, classId])

  const ids = useMemo(() => lessonIndex(courseId).filter((l) => isInstructor || published.includes(l.id)).map((l) => l.id), [courseId, published, isInstructor])
  useEffect(() => {
    let cancelled = false
    Promise.all(ids.map((id) => loadLesson(courseId, id)))
      .then((ls) => {
        if (cancelled) return
        setConcepts(ls.flatMap((l) => (l ? [...l.concepts, ...(l.concepts2 ?? [])].map((c) => ({ id: c.id, term: c.name, lesson: l.id })) : [])))
      })
      .catch((err) => console.error('[개념 지도] 차시를 불러오지 못했다:', err))
    return () => {
      cancelled = true
    }
  }, [courseId, ids])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE}.${user?.uid ?? 'anon'}`)
      if (raw) {
        const parsed = JSON.parse(raw) as { edges: Edge[]; snapshots: typeof snapshots }
        setEdges(parsed.edges ?? [])
        setSnapshots(parsed.snapshots ?? [])
      }
    } catch (err) {
      console.warn('[개념 지도] 저장소를 읽지 못했다:', err)
    }
  }, [user?.uid])

  function persist(nextEdges: Edge[], nextSnaps = snapshots) {
    setEdges(nextEdges)
    try {
      localStorage.setItem(`${STORAGE}.${user?.uid ?? 'anon'}`, JSON.stringify({ edges: nextEdges, snapshots: nextSnaps }))
    } catch (err) {
      console.warn('[개념 지도] 저장하지 못했다:', err)
    }
  }

  function add() {
    if (!from || !to) {
      setError('두 개념을 모두 고르세요.')
      return
    }
    if (from === to) {
      setError('같은 개념끼리는 이을 수 없다.')
      return
    }
    if (!relation.trim()) {
      setError('연결선에 관계를 나타내는 말을 적어야 저장된다. 예: “진단의 근거가 된다”')
      return
    }
    setError(null)
    persist([...edges, { id: `${Date.now().toString(36)}`, from, to, relation: relation.trim() }])
    setRelation('')
  }

  function snapshot() {
    const next = [...snapshots, { at: Date.now(), count: edges.length }]
    setSnapshots(next)
    persist(edges, next)
  }

  const label = (id: string) => concepts.find((c) => c.id === id)?.term ?? id

  return (
    <AppShell title="개념 지도">
      <p className="eyebrow">한 학기</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        개념 연결 지도
      </h1>
      <p className="text-subhead" style={{ marginTop: 16, maxWidth: 760 }}>
        개념을 잇되, 선마다 관계를 나타내는 말을 적는다. 단어만 이어 놓으면 무엇을 인과로 보고 있는지 드러나지 않는다.
      </p>

      <div className="card" style={{ marginTop: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div className="flex flex-col gap-xs">
            <label htmlFor="cm-from" className="text-body-sm" style={{ fontWeight: 480 }}>
              개념 A
            </label>
            <select id="cm-from" className="field" value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">고르기</option>
              {concepts.map((c) => (
                <option key={c.id} value={c.id}>
                  {Number(c.lesson)}강 · {c.term}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor="cm-rel" className="text-body-sm" style={{ fontWeight: 480 }}>
              관계 <span className="font-mono text-caption">필수</span>
            </label>
            <input id="cm-rel" className="field" value={relation} placeholder="예: 진단의 근거가 된다" onChange={(e) => setRelation(e.target.value)} />
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor="cm-to" className="text-body-sm" style={{ fontWeight: 480 }}>
              개념 B
            </label>
            <select id="cm-to" className="field" value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">고르기</option>
              {concepts.map((c) => (
                <option key={c.id} value={c.id}>
                  {Number(c.lesson)}강 · {c.term}
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
          <Caption>
            {edges.length}개 연결 · 저장 {snapshots.length}회
          </Caption>
        </div>
      </div>

      <section style={{ marginTop: 32 }}>
        <h2 className="text-card-title">내 연결</h2>
        {edges.length === 0 ? (
          <p className="text-body-sm" style={{ opacity: 0.6, marginTop: 12 }}>
            아직 연결이 없다.
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
                    <td className="text-body-sm" style={{ padding: '10px 12px', opacity: 0.72, whiteSpace: 'nowrap' }}>
                      —({e.relation})→
                    </td>
                    <td className="text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                      {label(e.to)}
                    </td>
                    <td style={{ padding: '10px 0' }}>
                      <Button variant="tertiary" onClick={() => persist(edges.filter((x) => x.id !== e.id))}>
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
              처음 저장했을 때 연결 {snapshots[0].count}개 → 지금 {snapshots[snapshots.length - 1].count}개. 연결의 개수보다 관계어의 내용을 보세요.
            </p>
          </ColorBlock>
        </div>
      ) : null}

      <div className="flex gap-xs" style={{ marginTop: 32 }}>
        <Badge>마지막 차시에서 처음 지도와 비교한다</Badge>
      </div>
    </AppShell>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { courseTitle, lessonIndex } from '@/content/courses'
import type { CourseId, LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { courseOf } from '@/lib/lesson-data'
import { lastTaught } from '@/lib/last-taught'
import type { Enrollment } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { NewClassForm } from '@/components/instructor/NewClassForm'
import { Badge, Button, Caption, ColorBlock, Notice, ScrollX } from '@/components/ui'

/**
 * 강사 홈 — **차시 목록 하나**다 (강의자 지시 2026-09-21).
 *
 * 예전에는 클래스 카드에 「차시 목록 · 수강생 명단 · 모둠 관리 · 수강 등록 마감 · 지우기 · 보관」이 같은 크기로 놓여 있어
 * 수업을 열려면 두 번을 더 눌러야 했고, 무엇을 먼저 눌러야 하는지가 보이지 않았다.
 *   · 홈에 있는 것은 매주 쓰는 것뿐이다 — 이어서 할 차시 하나 + 차시 목록(공개 토글 · 수업 열기).
 *   · 학기에 한 번 쓰는 것(명단 · 모둠 · 등록 · 보관 · 지우기 · 새 클래스)은 「클래스 관리」 한 곳으로 옮겼다.
 *   · 클래스 전환은 상단바의 클래스 고르개가 이미 한다. 여기서는 지금 클래스의 차시만 보인다.
 */
export function InstructorClasses() {
  const { repo, isInstructor, classes, classId: currentClassId, selectClass } = useAuth()
  const navigate = useNavigate()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [published, setPublished] = useState<Record<string, LessonId[]>>({})
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!repo) return
    const unsubs: Array<() => void> = []
    for (const c of classes) {
      unsubs.push(repo.watchEnrollments(c.id, (list: Enrollment[]) => setCounts((m) => ({ ...m, [c.id]: list.filter((e) => e.status === 'active').length }))))
      unsubs.push(repo.watchLessonState(c.id, (ids) => setPublished((m) => ({ ...m, [c.id]: ids }))))
    }
    return () => unsubs.forEach((u) => u())
  }, [repo, classes])

  const sorted = useMemo(() => [...classes].sort((a, b) => Number(a.status === 'archived') - Number(b.status === 'archived') || b.createdAt - a.createdAt), [classes])
  const current = sorted.find((c) => c.id === currentClassId) ?? sorted[0] ?? null
  const others = sorted.filter((c) => c.id !== current?.id)

  if (!isInstructor) return <Navigate to="/" replace />

  if (!current) {
    return (
      <AppShell title="강사">
        <p className="eyebrow">강사</p>
        <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
          수업
        </h1>
        <div style={{ marginTop: 32 }}>
          <ColorBlock tone="cream">
            <p className="text-subhead" style={{ margin: 0 }}>
              아직 클래스가 없다. 이번 학기 클래스를 하나 만들면 학생이 등록할 수 있다.
            </p>
          </ColorBlock>
        </div>
        <div style={{ marginTop: 24 }}>
          <NewClassForm onCreated={(id) => void selectClass(id)} />
        </div>
      </AppShell>
    )
  }

  const courseId = courseOf(current)
  const index = lessonIndex(courseId)
  /* 옛 18차시 시절에 공개해 둔 id 는 색인에 없다 — 색인에 있는 것만 센다 */
  const pub = (published[current.id] ?? []).filter((id) => index.some((l) => l.id === id))
  const archived = current.status === 'archived'
  const next = nextLesson(current.id, courseId, pub)

  return (
    <AppShell title="강사">
      <p className="eyebrow">강사</p>
      <div className="flex items-center gap-xs" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <h1 className="text-display-lg" style={{ margin: 0 }}>
          수업
        </h1>
        <Badge>{courseTitle(courseId)}</Badge>
        {archived ? <Badge>보관됨 · 읽기 전용</Badge> : null}
      </div>
      <p className="text-body-lg" style={{ marginTop: 12 }}>
        {current.displayName}
      </p>
      <div className="flex items-center gap-xs no-print" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <Caption>
          수강생 {counts[current.id] ?? 0}명 · 공개 {pub.length}/{index.length} · 코드 {current.joinCode}
        </Caption>
        <Link to={`/instructor/class/${current.id}/students`} className="btn-secondary">
          클래스 관리
        </Link>
        <Link to="/instructor/students" className="text-link">
          학생 계정
        </Link>
        <Link to="/instructor/analytics" className="text-link">
          학습 분석
        </Link>
        <Link to="/instructor/ai-review" className="text-link">
          AI 검토
        </Link>
      </div>

      {/* 이어서 할 차시 하나 — 홈에서 가장 큰 것이 수업을 여는 길이다 */}
      {next ? (
        <div style={{ marginTop: 32 }}>
          <ColorBlock tone="lime">
            <div className="flex items-center gap-md" style={{ flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 320px' }}>
                <Caption>{next.reason}</Caption>
                <p className="text-headline" style={{ margin: '6px 0 0' }}>
                  {Number(next.entry.id)}강 {next.entry.title}
                </p>
                <p className="text-body-sm" style={{ margin: '6px 0 0', opacity: 0.8 }}>
                  {next.entry.centralQuestion}
                </p>
              </div>
              <Link to={`/teach/${current.id}/${next.entry.id}`} className="btn-primary" onClick={() => void selectClass(current.id)} style={{ fontSize: 17 }}>
                수업 열기
              </Link>
            </div>
          </ColorBlock>
        </div>
      ) : null}

      <h2 className="text-card-title" style={{ margin: '32px 0 0' }}>
        차시
      </h2>
      <Caption>공개를 켜면 학생 화면에 그 차시가 나타난다. 줄 끝의 「수업 열기」가 수업 화면이다.</Caption>
      <LessonList classId={current.id} courseId={courseId} published={pub} readOnly={archived} onOpen={() => void selectClass(current.id)} />

      {others.length > 0 ? (
        <div style={{ marginTop: 40 }} className="no-print">
          <Caption>다른 클래스</Caption>
          <ul className="flex flex-col gap-xxs" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
            {others.map((c) => (
              <li key={c.id}>
                <Button
                  variant="tertiary"
                  onClick={() => {
                    void selectClass(c.id)
                    navigate('/instructor/classes')
                  }}
                >
                  {c.displayName}
                  {c.status === 'archived' ? ' · 보관됨' : ''}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div style={{ marginTop: 40 }} className="no-print">
        {creating ? (
          <NewClassForm
            onCreated={(id) => {
              setCreating(false)
              void selectClass(id)
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <Button variant="tertiary" onClick={() => setCreating(true)}>
            + 새 클래스 만들기
          </Button>
        )}
      </div>

      <div style={{ marginTop: 32 }}>
        <Notice tone="lilac">
          <p className="text-body-sm" style={{ margin: 0 }}>
            수강생 명단 · 모둠 · 수강 등록 · 보관 · 지우기는 <Link to={`/instructor/class/${current.id}/settings`} className="text-link">클래스 관리</Link> 에 있다. 수업 중에 쓰는 것은 이 화면과 수업 화면뿐이다.
          </p>
        </Notice>
      </div>
    </AppShell>
  )
}

/** 이어서 할 차시 — 마지막으로 연 차시, 없으면 공개된 것 중 뒤쪽, 그것도 없으면 1강 */
function nextLesson(classId: string, courseId: CourseId, published: LessonId[]) {
  const index = lessonIndex(courseId)
  const last = lastTaught(classId)
  const fromLast = last ? index.find((l) => l.id === last) : undefined
  if (fromLast) return { entry: fromLast, reason: '마지막으로 연 차시' }
  const open = index.filter((l) => published.includes(l.id))
  const entry = open[open.length - 1] ?? index[0]
  return entry ? { entry, reason: open.length > 0 ? '공개된 차시 가운데 마지막' : '아직 연 차시가 없다 — 첫 차시' } : null
}

/** 차시 목록 — 공개 토글과 [수업 열기] */
function LessonList({ classId, courseId, published, readOnly, onOpen }: { classId: string; courseId: CourseId; published: LessonId[]; readOnly: boolean; onOpen: () => void }) {
  const { repo } = useAuth()
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  async function toggle(id: LessonId, next: boolean) {
    if (!repo) return
    setBusy(id)
    setNote(null)
    try {
      await repo.setLessonPublished(classId, id, next)
    } catch (err) {
      console.error('[차시 공개] 바꾸지 못했다:', err)
      setNote(`공개를 바꾸지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      {note ? (
        <p role="status" className="text-body-sm" style={{ margin: '8px 0 0', fontWeight: 480 }}>
          ⚠ {note}
        </p>
      ) : null}
      <ScrollX>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640, marginTop: 12 }}>
          <thead>
            <tr>
              {['차시', '제목', '공개', ''].map((h) => (
                <th key={h} scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lessonIndex(courseId).map((l) => {
              const on = published.includes(l.id)
              return (
                <tr key={l.id} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                  <td className="font-mono text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                    {Number(l.id)}
                  </td>
                  <td className="text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                    {l.title}
                    <span style={{ display: 'block', opacity: 0.7 }}>{l.centralQuestion}</span>
                  </td>
                  <td style={{ padding: '10px 12px 10px 0' }}>
                    <label className="text-body-sm flex items-center gap-xxs">
                      <input type="checkbox" checked={on} disabled={readOnly || busy === l.id} onChange={(e) => void toggle(l.id, e.target.checked)} /> {on ? '공개' : '미공개'}
                    </label>
                  </td>
                  <td style={{ padding: '10px 0' }}>
                    <Link to={`/teach/${classId}/${l.id}`} className="btn-primary" onClick={onOpen}>
                      수업 열기
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ScrollX>
    </>
  )
}

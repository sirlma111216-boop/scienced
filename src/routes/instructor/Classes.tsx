import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AFFILIATIONS, DAYS, TERMS, buildDisplayName, emptyClassForm, generateJoinCode, sortDays, validateClassForm, type Affiliation, type ClassFormValues } from '@/content/classes'
import { COURSES, COURSE_IDS, courseTitle, lessonIndex } from '@/content/courses'
import { INITIALLY_OPEN, type CourseId, type LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { courseOf } from '@/lib/lesson-data'
import type { ClassDoc, Enrollment } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, Card, ColorBlock, Notice, ScrollX } from '@/components/ui'

/**
 * 강사 홈 — 수강 클래스 목록 → 차시 목록 → 수업 화면 (8차 7.4).
 *
 * 클래스는 과목 하나(교과교수법 18차시 · 과학교육론 12차시)에 속한다. 차시 내용은 복사하지 않는다 —
 * 클래스가 갖는 것은 공개 여부(lessonState)뿐이다. 차시 줄의 [수업 열기] 가 /teach/:classId/:lessonId 로 간다.
 * 옛 「차시」 화면·대시보드·통계 카드는 없다.
 */
export function InstructorClasses() {
  const { repo, isInstructor, user, classes, selectClass } = useAuth()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<ClassFormValues>(emptyClassForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [nameTouched, setNameTouched] = useState(false)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [published, setPublished] = useState<Record<string, LessonId[]>>({})
  const [openClass, setOpenClass] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!repo) return
    const unsubs: Array<() => void> = []
    for (const c of classes) {
      unsubs.push(repo.watchEnrollments(c.id, (list: Enrollment[]) => setCounts((m) => ({ ...m, [c.id]: list.filter((e) => e.status === 'active').length }))))
      unsubs.push(repo.watchLessonState(c.id, (ids) => setPublished((m) => ({ ...m, [c.id]: ids }))))
    }
    return () => unsubs.forEach((u) => u())
  }, [repo, classes])

  function patch(next: Partial<ClassFormValues>) {
    setForm((f) => {
      const merged = { ...f, ...next }
      if (next.courseId && !f.courseTitle.trim()) merged.courseTitle = courseTitle(next.courseId)
      if (!nameTouched && next.displayName === undefined) merged.displayName = buildDisplayName(merged)
      return merged
    })
    setErrors({})
  }

  async function create() {
    if (!repo || !user) return
    const errs = validateClassForm(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    const id = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const doc: ClassDoc = {
      id,
      ownerUid: user.uid,
      courseTitle: form.courseTitle.trim(),
      courseId: form.courseId,
      affiliation: form.affiliation,
      year: form.year,
      term: form.term,
      days: sortDays(form.days),
      startTime: form.startTime,
      endTime: form.endTime,
      credits: form.credits,
      displayName: form.displayName.trim(),
      joinCode: generateJoinCode(),
      requireJoinCode: false,
      enrollmentOpen: true,
      status: 'active',
      createdAt: Date.now(),
    }
    await repo.createClass(doc)
    for (const l of lessonIndex(form.courseId)) {
      await repo.setLessonPublished(id, l.id, INITIALLY_OPEN[form.courseId].includes(l.id))
    }
    setCreating(false)
    setForm(emptyClassForm())
    setNameTouched(false)
    setOpenClass(id)
  }

  const sorted = useMemo(() => [...classes].sort((a, b) => Number(a.status === 'archived') - Number(b.status === 'archived') || b.createdAt - a.createdAt), [classes])

  if (!isInstructor) return <Navigate to="/" replace />

  return (
    <AppShell title="수강 클래스">
      <p className="eyebrow">강사</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        수강 클래스
      </h1>
      <p className="text-subhead" style={{ marginTop: 16, maxWidth: 760 }}>
        학기마다 독립된 클래스를 만든다. 클래스를 펼치면 차시 목록이 나오고, 차시 줄의 「수업 열기」가 수업 화면이다.
      </p>

      <div className="flex flex-wrap gap-xs no-print" style={{ marginTop: 32 }}>
        <Button onClick={() => setCreating((c) => !c)}>{creating ? '접기' : '새 클래스 만들기'}</Button>
        <Link to="/instructor/students" className="btn-secondary">
          학생 계정
        </Link>
        <Link to="/instructor/analytics" className="btn-secondary">
          학습 분석
        </Link>
        <Link to="/instructor/ai-review" className="btn-secondary">
          AI 검토
        </Link>
      </div>

      {creating ? (
        <div style={{ marginTop: 24 }}>
          <Card>
            <h2 className="text-card-title" style={{ margin: '0 0 16px' }}>
              새 클래스
            </h2>
            <div className="flex flex-col gap-xl">
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="text-body-sm" style={{ fontWeight: 480, paddingBottom: 8 }}>
                  과목
                </legend>
                <div className="flex flex-wrap gap-xs">
                  {COURSE_IDS.map((cid) => (
                    <label key={cid} className="flex items-center gap-xs rounded-pill" style={{ padding: '10px 16px', minHeight: 44, boxShadow: `inset 0 0 0 ${form.courseId === cid ? 2 : 1}px ${form.courseId === cid ? '#000' : '#e6e6e6'}`, cursor: 'pointer' }}>
                      <input type="radio" name="courseId" checked={form.courseId === cid} onChange={() => patch({ courseId: cid })} />
                      <span className="text-body-sm">
                        {COURSES[cid].title} · {COURSES[cid].index.length}차시
                      </span>
                    </label>
                  ))}
                </div>
                {errors.courseId ? (
                  <p role="alert" className="text-body-sm" style={{ marginTop: 8 }}>
                    ⚠ {errors.courseId}
                  </p>
                ) : null}
              </fieldset>

              <div className="flex flex-col gap-xs">
                <label htmlFor="cl-course" className="text-body-sm" style={{ fontWeight: 480 }}>
                  강의 제목
                </label>
                <input id="cl-course" className="field" value={form.courseTitle} onChange={(e) => patch({ courseTitle: e.target.value })} placeholder={courseTitle(form.courseId)} />
                {errors.courseTitle ? (
                  <p role="alert" className="text-body-sm">
                    ⚠ {errors.courseTitle}
                  </p>
                ) : null}
              </div>

              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="text-body-sm" style={{ fontWeight: 480, paddingBottom: 8 }}>
                  소속
                </legend>
                <div className="flex flex-wrap gap-xs">
                  {AFFILIATIONS.map((a) => (
                    <label key={a.key} className="flex items-center gap-xs rounded-pill" style={{ padding: '10px 16px', minHeight: 44, boxShadow: `inset 0 0 0 ${form.affiliation === a.key ? 2 : 1}px ${form.affiliation === a.key ? '#000' : '#e6e6e6'}`, cursor: 'pointer' }}>
                      <input type="radio" name="affiliation" checked={form.affiliation === a.key} onChange={() => patch({ affiliation: a.key as Affiliation })} />
                      <span className="text-body-sm">{a.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
                <div className="flex flex-col gap-xs">
                  <label htmlFor="cl-year" className="text-body-sm" style={{ fontWeight: 480 }}>
                    학년도
                  </label>
                  <input id="cl-year" className="field" type="number" inputMode="numeric" value={form.year} onChange={(e) => patch({ year: Number(e.target.value) })} />
                  {errors.year ? (
                    <p role="alert" className="text-body-sm">
                      ⚠ {errors.year}
                    </p>
                  ) : null}
                </div>
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="text-body-sm" style={{ fontWeight: 480, paddingBottom: 8 }}>
                    학기
                  </legend>
                  <div className="flex gap-xs">
                    {TERMS.map((t) => (
                      <label key={t.key} className="flex items-center gap-xs rounded-pill" style={{ padding: '10px 16px', minHeight: 44, boxShadow: `inset 0 0 0 ${form.term === t.key ? 2 : 1}px ${form.term === t.key ? '#000' : '#e6e6e6'}`, cursor: 'pointer' }}>
                        <input type="radio" name="term" checked={form.term === t.key} onChange={() => patch({ term: t.key })} />
                        <span className="text-body-sm">{t.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="flex flex-col gap-xs">
                  <label htmlFor="cl-credits" className="text-body-sm" style={{ fontWeight: 480 }}>
                    학점
                  </label>
                  <input id="cl-credits" className="field" type="number" inputMode="numeric" min={1} value={form.credits} onChange={(e) => patch({ credits: Number(e.target.value) })} />
                </div>
              </div>

              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="text-body-sm" style={{ fontWeight: 480, paddingBottom: 8 }}>
                  요일 <span className="font-mono text-caption">복수 선택</span>
                </legend>
                <div className="flex flex-wrap gap-xs">
                  {DAYS.map((d) => {
                    const on = form.days.includes(d.key)
                    return (
                      <label key={d.key} className="flex items-center gap-xxs rounded-pill" style={{ padding: '10px 18px', minHeight: 44, boxShadow: `inset 0 0 0 ${on ? 2 : 1}px ${on ? '#000' : '#e6e6e6'}`, cursor: 'pointer' }}>
                        <input type="checkbox" checked={on} onChange={() => patch({ days: on ? form.days.filter((x) => x !== d.key) : [...form.days, d.key] })} />
                        <span className="text-body-sm">{d.label}</span>
                      </label>
                    )
                  })}
                </div>
                {errors.days ? (
                  <p role="alert" className="text-body-sm" style={{ marginTop: 8 }}>
                    ⚠ {errors.days}
                  </p>
                ) : null}
              </fieldset>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
                <div className="flex flex-col gap-xs">
                  <label htmlFor="cl-start" className="text-body-sm" style={{ fontWeight: 480 }}>
                    시작
                  </label>
                  <input id="cl-start" className="field" type="time" value={form.startTime} onChange={(e) => patch({ startTime: e.target.value })} />
                </div>
                <div className="flex flex-col gap-xs">
                  <label htmlFor="cl-end" className="text-body-sm" style={{ fontWeight: 480 }}>
                    종료
                  </label>
                  <input id="cl-end" className="field" type="time" value={form.endTime} onChange={(e) => patch({ endTime: e.target.value })} />
                  {errors.endTime ? (
                    <p role="alert" className="text-body-sm">
                      ⚠ {errors.endTime}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-xs">
                <label htmlFor="cl-name" className="text-body-sm" style={{ fontWeight: 480 }}>
                  표시 이름
                </label>
                <input
                  id="cl-name"
                  className="field"
                  value={form.displayName}
                  onChange={(e) => {
                    setNameTouched(true)
                    setForm((f) => ({ ...f, displayName: e.target.value }))
                  }}
                />
                <Caption>위 입력에 따라 자동으로 채워진다. 직접 고치면 그때부터 따라가지 않는다.</Caption>
              </div>
            </div>

            <div className="flex gap-xs" style={{ marginTop: 24 }}>
              <Button onClick={() => void create()}>만들기</Button>
              <Button variant="tertiary" onClick={() => setCreating(false)}>
                취소
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <div style={{ marginTop: 48 }}>
          <ColorBlock tone="cream">
            <p className="text-subhead" style={{ margin: 0 }}>
              아직 클래스가 없다. 이번 학기 클래스를 하나 만들면 학생이 등록할 수 있다.
            </p>
          </ColorBlock>
        </div>
      ) : (
        <div className="flex flex-col gap-lg" style={{ marginTop: 32 }}>
          {sorted.map((c) => {
            const courseId = courseOf(c)
            const index = lessonIndex(courseId)
            /* 옛 18차시 시절에 공개해 둔 id 는 색인에 없다 — 색인에 있는 것만 센다 */
            const pub = (published[c.id] ?? []).filter((id) => index.some((l) => l.id === id))
            const open = openClass === c.id
            return (
              <Card key={c.id}>
                <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
                  <Badge>{courseTitle(courseId)}</Badge>
                  <h2 className="text-card-title" style={{ margin: 0 }}>
                    {c.displayName}
                  </h2>
                  {c.status === 'archived' ? <Badge>보관됨 · 읽기 전용</Badge> : c.enrollmentOpen ? <Badge solid>등록 열림</Badge> : <Badge>등록 마감</Badge>}
                  <Caption>
                    수강생 {counts[c.id] ?? 0}명 · 공개 {pub.length}/{index.length} · 코드 {c.joinCode}
                    {c.requireJoinCode ? '(필요)' : ''}
                  </Caption>
                </div>

                <div className="flex flex-wrap gap-xxs no-print" style={{ marginTop: 12 }}>
                  <Button variant={open ? 'primary' : 'secondary'} onClick={() => setOpenClass(open ? null : c.id)}>
                    {open ? '차시 접기' : '차시 목록'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void selectClass(c.id)
                      navigate(`/instructor/class/${c.id}/students`)
                    }}
                  >
                    수강생 명단
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void selectClass(c.id)
                      navigate(`/instructor/class/${c.id}/groups`)
                    }}
                  >
                    모둠 관리
                  </Button>
                  {c.status === 'active' ? (
                    <>
                      <Button variant="tertiary" onClick={() => void repo?.updateClass(c.id, { enrollmentOpen: !c.enrollmentOpen })}>
                        {c.enrollmentOpen ? '수강 등록 마감' : '등록 다시 열기'}
                      </Button>
                      <Button
                        variant="tertiary"
                        disabled={deleting === c.id}
                        onClick={() => {
                          const n = counts[c.id] ?? 0
                          const ok = confirm(`이 클래스를 지웁니다.\n\n${c.displayName}\n\n` + (n > 0 ? `수강생 ${n}명의 응답·의견·실명 명단이 함께 지워집니다.\n` : '') + '되돌릴 수 없습니다.\n\n기록을 남기려면 「보관」을 쓰세요.')
                          if (!ok) return
                          setDeleting(c.id)
                          void repo?.deleteClass(c.id).finally(() => setDeleting(null))
                        }}
                      >
                        {deleting === c.id ? '지우는 중…' : '지우기'}
                      </Button>
                      <Button
                        variant="tertiary"
                        onClick={() => {
                          const ok = confirm('이 클래스를 보관합니다.\n\n보관하면 읽기 전용이 됩니다. 학생도 강사도 새 글을 쓸 수 없고,\n지난 기록은 그대로 볼 수 있습니다.\n\n계속할까요?')
                          if (ok) void repo?.updateClass(c.id, { status: 'archived' })
                        }}
                      >
                        보관
                      </Button>
                    </>
                  ) : (
                    <Button variant="tertiary" onClick={() => void repo?.updateClass(c.id, { status: 'active' })}>
                      보관 해제
                    </Button>
                  )}
                </div>

                {open ? <LessonList classId={c.id} courseId={courseId} published={pub} readOnly={c.status === 'archived'} onOpen={() => void selectClass(c.id)} /> : null}
              </Card>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 48 }}>
        <Notice tone="lilac">
          <p className="text-body-sm" style={{ margin: 0 }}>
            <strong>새 클래스는 교수법 {INITIALLY_OPEN.method.map(Number).join('·')}강, 교육론 {INITIALLY_OPEN.edu.map(Number).join('·')}강이 열려 있다.</strong> 나머지는 진도에 맞춰 차시 목록에서 연다. 공개 여부는 클래스마다 따로다.
          </p>
        </Notice>
      </div>
    </AppShell>
  )
}

/** 차시 목록 — 공개 토글과 [수업 열기] */
function LessonList({ classId, courseId, published, readOnly, onOpen }: { classId: string; courseId: CourseId; published: LessonId[]; readOnly: boolean; onOpen: () => void }) {
  const { repo } = useAuth()
  const [busy, setBusy] = useState<string | null>(null)
  async function toggle(id: LessonId, next: boolean) {
    if (!repo) return
    setBusy(id)
    try {
      await repo.setLessonPublished(classId, id, next)
    } catch (err) {
      console.error('[차시 공개] 바꾸지 못했다:', err)
    } finally {
      setBusy(null)
    }
  }
  return (
    <ScrollX>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640, marginTop: 16 }}>
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
  )
}

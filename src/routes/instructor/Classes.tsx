import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  AFFILIATIONS,
  DAYS,
  TERMS,
  buildDisplayName,
  emptyClassForm,
  generateJoinCode,
  sortDays,
  validateClassForm,
  type Affiliation,
  type ClassFormValues,
} from '@/content/classes'
import { LESSONS } from '@/content/lessons'
import { useAuth } from '@/lib/auth'
import type { ClassDoc, Enrollment } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, Card, ColorBlock, Notice, ScrollX } from '@/components/ui'

/**
 * 수강 클래스 목록과 만들기.
 *
 * 이 강의는 여러 학기 동안 반복된다. 학기마다 독립된 클래스를 만들고
 * 모든 학생 자료가 그 안에서만 움직이게 한다.
 *
 * 18강 교재 내용은 복사하지 않는다. 클래스가 갖는 것은 공개 여부(lessonState)뿐이다.
 */
export function InstructorClasses() {
  const { repo, isInstructor, user, classes, selectClass } = useAuth()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<ClassFormValues>(emptyClassForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [nameTouched, setNameTouched] = useState(false)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [publishedCounts, setPublishedCounts] = useState<Record<string, number>>({})

  // 각 클래스의 등록 인원과 공개 차시 수
  useEffect(() => {
    if (!repo) return
    const unsubs: Array<() => void> = []
    for (const c of classes) {
      unsubs.push(
        repo.watchEnrollments(c.id, (list: Enrollment[]) =>
          setCounts((m) => ({ ...m, [c.id]: list.filter((e) => e.status === 'active').length })),
        ),
      )
      unsubs.push(
        repo.watchLessonState(c.id, (ids) =>
          setPublishedCounts((m) => ({ ...m, [c.id]: ids.length })),
        ),
      )
    }
    return () => unsubs.forEach((u) => u())
  }, [repo, classes])

  /** 표시 이름은 손대기 전까지 입력값을 따라간다. */
  function patch(next: Partial<ClassFormValues>) {
    setForm((f) => {
      const merged = { ...f, ...next }
      if (!nameTouched && next.displayName === undefined) {
        merged.displayName = buildDisplayName(merged)
      }
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
    // 새 클래스는 01강만 열어 둔다. 나머지는 강사가 진도에 맞춰 연다.
    for (const l of LESSONS) {
      await repo.setLessonPublished(id, l.id, l.id === '01')
    }
    setCreating(false)
    setForm(emptyClassForm())
    setNameTouched(false)
  }

  const sorted = useMemo(
    () =>
      [...classes].sort(
        (a, b) =>
          Number(a.status === 'archived') - Number(b.status === 'archived') ||
          b.createdAt - a.createdAt,
      ),
    [classes],
  )

  if (!isInstructor) return <Navigate to="/" replace />

  return (
    <AppShell title="수강 클래스">
      <p className="eyebrow">강사</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        수강 클래스
      </h1>
      <p className="text-subhead" style={{ marginTop: 16, maxWidth: 760 }}>
        학기마다 독립된 클래스를 만듭니다. 응답·의견·모둠은 클래스 안에서만 움직이고,
        18강 교재 내용은 한 벌만 두어 학기가 바뀌어도 복사하지 않습니다.
      </p>

      <div className="flex flex-wrap gap-xs no-print" style={{ marginTop: 32 }}>
        <Button onClick={() => setCreating((c) => !c)}>
          {creating ? '접기' : '새 클래스 만들기'}
        </Button>
      </div>

      {creating ? (
        <div style={{ marginTop: 24 }}>
          <Card>
            <h2 className="text-card-title" style={{ margin: '0 0 16px' }}>
              새 클래스
            </h2>

            <div className="flex flex-col gap-xl">
              {/* 소속 */}
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="text-body-sm" style={{ fontWeight: 480, paddingBottom: 8 }}>
                  소속
                </legend>
                <div className="flex flex-wrap gap-xs">
                  {AFFILIATIONS.map((a) => (
                    <label
                      key={a.key}
                      className="flex items-center gap-xs rounded-pill"
                      style={{
                        padding: '10px 16px',
                        minHeight: 44,
                        boxShadow: `inset 0 0 0 ${form.affiliation === a.key ? 2 : 1}px ${form.affiliation === a.key ? '#000' : '#e6e6e6'}`,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="affiliation"
                        checked={form.affiliation === a.key}
                        onChange={() => patch({ affiliation: a.key as Affiliation })}
                      />
                      <span className="text-body-sm">{a.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* 학년도 · 학기 · 학점 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 16,
                }}
              >
                <div className="flex flex-col gap-xs">
                  <label htmlFor="cl-year" className="text-body-sm" style={{ fontWeight: 480 }}>
                    학년도
                  </label>
                  <input
                    id="cl-year"
                    className="field"
                    type="number"
                    inputMode="numeric"
                    value={form.year}
                    onChange={(e) => patch({ year: Number(e.target.value) })}
                  />
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
                      <label
                        key={t.key}
                        className="flex items-center gap-xs rounded-pill"
                        style={{
                          padding: '10px 16px',
                          minHeight: 44,
                          boxShadow: `inset 0 0 0 ${form.term === t.key ? 2 : 1}px ${form.term === t.key ? '#000' : '#e6e6e6'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="radio"
                          name="term"
                          checked={form.term === t.key}
                          onChange={() => patch({ term: t.key })}
                        />
                        <span className="text-body-sm">{t.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="flex flex-col gap-xs">
                  <label htmlFor="cl-credits" className="text-body-sm" style={{ fontWeight: 480 }}>
                    학점
                  </label>
                  <input
                    id="cl-credits"
                    className="field"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={form.credits}
                    onChange={(e) => patch({ credits: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* 요일 — 주 2회 수업이 있으므로 복수 선택 */}
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="text-body-sm" style={{ fontWeight: 480, paddingBottom: 8 }}>
                  요일 <span className="font-mono text-caption">복수 선택</span>
                </legend>
                <div className="flex flex-wrap gap-xs">
                  {DAYS.map((d) => {
                    const on = form.days.includes(d.key)
                    return (
                      <label
                        key={d.key}
                        className="flex items-center gap-xxs rounded-pill"
                        style={{
                          padding: '10px 18px',
                          minHeight: 44,
                          boxShadow: `inset 0 0 0 ${on ? 2 : 1}px ${on ? '#000' : '#e6e6e6'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            patch({
                              days: on
                                ? form.days.filter((x) => x !== d.key)
                                : [...form.days, d.key],
                            })
                          }
                        />
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

              {/* 시간 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 16,
                }}
              >
                <div className="flex flex-col gap-xs">
                  <label htmlFor="cl-start" className="text-body-sm" style={{ fontWeight: 480 }}>
                    시작
                  </label>
                  <input
                    id="cl-start"
                    className="field"
                    type="time"
                    value={form.startTime}
                    onChange={(e) => patch({ startTime: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-xs">
                  <label htmlFor="cl-end" className="text-body-sm" style={{ fontWeight: 480 }}>
                    종료
                  </label>
                  <input
                    id="cl-end"
                    className="field"
                    type="time"
                    value={form.endTime}
                    onChange={(e) => patch({ endTime: e.target.value })}
                  />
                  {errors.endTime ? (
                    <p role="alert" className="text-body-sm">
                      ⚠ {errors.endTime}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* 표시 이름 */}
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
                <Caption>
                  위 입력에 따라 자동으로 채워집니다. 직접 고치면 그때부터 따라가지 않습니다.
                </Caption>
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
              아직 클래스가 없습니다. 이번 학기 클래스를 하나 만들면 학생이 등록할 수 있습니다.
            </p>
          </ColorBlock>
        </div>
      ) : (
        <ScrollX>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 860, marginTop: 32 }}>
            <thead>
              <tr>
                {['클래스', '등록 인원', '공개 차시', '참여 코드', '상태', ''].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="caption"
                    style={{ textAlign: 'left', padding: '8px 16px 8px 0' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                  <td className="text-body-sm" style={{ padding: '14px 16px 14px 0', maxWidth: 320 }}>
                    {c.displayName}
                  </td>
                  <td className="font-mono text-body-sm" style={{ padding: '14px 16px 14px 0' }}>
                    {counts[c.id] ?? 0}
                  </td>
                  <td className="font-mono text-body-sm" style={{ padding: '14px 16px 14px 0' }}>
                    {publishedCounts[c.id] ?? 0} / 18
                  </td>
                  <td className="font-mono text-body-sm" style={{ padding: '14px 16px 14px 0' }}>
                    {c.joinCode}
                    <span style={{ display: 'block' }}>
                      <Caption>{c.requireJoinCode ? '코드 필요' : '코드 없이 등록'}</Caption>
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px 14px 0' }}>
                    {/* 색만으로 구분하지 않는다 */}
                    {c.status === 'archived' ? (
                      <Badge>보관됨 · 읽기 전용</Badge>
                    ) : c.enrollmentOpen ? (
                      <Badge solid>등록 열림</Badge>
                    ) : (
                      <Badge>등록 마감</Badge>
                    )}
                  </td>
                  <td style={{ padding: '14px 0' }}>
                    <div className="flex flex-wrap gap-xxs">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          void selectClass(c.id)
                          navigate(`/instructor/class/${c.id}/students`)
                        }}
                      >
                        열기
                      </Button>
                      {c.status === 'active' ? (
                        <>
                          <Button
                            variant="tertiary"
                            onClick={() =>
                              void repo?.updateClass(c.id, { enrollmentOpen: !c.enrollmentOpen })
                            }
                          >
                            {c.enrollmentOpen ? '수강 등록 마감' : '등록 다시 열기'}
                          </Button>
                          <Button
                            variant="tertiary"
                            onClick={() => {
                              const ok = confirm(
                                '이 클래스를 보관합니다.\n\n' +
                                  '보관하면 읽기 전용이 됩니다. 학생도 강사도 새 글을 쓸 수 없고,\n' +
                                  '지난 기록은 그대로 볼 수 있습니다.\n\n계속할까요?',
                              )
                              if (ok) void repo?.updateClass(c.id, { status: 'archived' })
                            }}
                          >
                            보관
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="tertiary"
                          onClick={() => void repo?.updateClass(c.id, { status: 'active' })}
                        >
                          보관 해제
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      )}

      <div style={{ marginTop: 48 }}>
        <Notice tone="lilac">
          <p className="text-body-sm" style={{ margin: 0 }}>
            <strong>새 클래스는 1강만 열려 있습니다.</strong> 2~18강은 진도에 맞춰 「차시」 화면에서
            엽니다. 공개 여부는 클래스마다 따로라, 지난 학기 설정이 새 학기에 딸려 오지 않습니다.
          </p>
        </Notice>
      </div>
    </AppShell>
  )
}

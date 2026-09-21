import { useState } from 'react'
import { AFFILIATIONS, DAYS, TERMS, buildDisplayName, emptyClassForm, generateJoinCode, sortDays, validateClassForm, type Affiliation, type ClassFormValues } from '@/content/classes'
import { COURSES, COURSE_IDS, courseTitle, lessonIndex } from '@/content/courses'
import { INITIALLY_OPEN } from '@/content/types'
import { useAuth } from '@/lib/auth'
import type { ClassDoc } from '@/lib/types'
import { Button, Caption, Card } from '@/components/ui'

/**
 * 새 클래스 만들기 — 학기에 한 번 쓰는 일이라 강사 홈이 아니라 클래스 설정에 둔다 (강의자 지시 2026-09-21).
 * 클래스가 하나도 없을 때만 홈에서도 보인다.
 */
export function NewClassForm({ onCreated, onCancel }: { onCreated?: (classId: string) => void; onCancel?: () => void }) {
  const { repo, user } = useAuth()
  const [form, setForm] = useState<ClassFormValues>(emptyClassForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [nameTouched, setNameTouched] = useState(false)
  const [busy, setBusy] = useState(false)

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
    setBusy(true)
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
    try {
      await repo.createClass(doc)
      for (const l of lessonIndex(form.courseId)) {
        await repo.setLessonPublished(id, l.id, INITIALLY_OPEN[form.courseId].includes(l.id))
      }
      setForm(emptyClassForm())
      setNameTouched(false)
      onCreated?.(id)
    } catch (err) {
      console.error('[클래스] 만들지 못했다:', err)
      setErrors({ displayName: `만들지 못했습니다 — ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setBusy(false)
    }
  }

  return (
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
          {errors.displayName ? (
            <p role="alert" className="text-body-sm">
              ⚠ {errors.displayName}
            </p>
          ) : null}
          <Caption>위 입력에 따라 자동으로 채워진다. 직접 고치면 그때부터 따라가지 않는다.</Caption>
        </div>
      </div>

      <div className="flex gap-xs" style={{ marginTop: 24 }}>
        <Button onClick={() => void create()} disabled={busy}>
          {busy ? '만드는 중…' : '만들기'}
        </Button>
        {onCancel ? (
          <Button variant="tertiary" onClick={onCancel}>
            취소
          </Button>
        ) : null}
      </div>
    </Card>
  )
}

import type { Lesson } from '@/content/types'
import type { ResponseDoc } from '@/lib/types'
import { Badge, Caption } from '@/components/ui'
import { latestOf, submitted, useNames } from './shared'

/**
 * 명단 열과 개인 화면 (7차 R.4 · R.2, 8차 A 에서 알림·「수업 후 이어서」를 뺐다).
 *
 *   명단   참석·제출 현황. 미제출자를 위에 모은다. 한 사람을 누르면 개인 화면.
 *   개인   그 학생의 이 차시 응답을 한 화면에. 마지막 버전만 보인다 — 다시 쓰는 칸이 없다.
 *
 * 발표 모드에서는 미제출자를 이름 대신 숫자로만 (작업 S).
 */

export function RosterColumn({
  studentUids,
  docs,
  onOpenStudent,
}: {
  studentUids: string[]
  /** 지금 단계의 응답 */
  docs: ResponseDoc[]
  onOpenStudent: (uid: string) => void
}) {
  const { nameOf, masked } = useNames()
  const done = new Set(docs.filter((d) => submitted(d)).map((d) => d.uid))
  const missing = studentUids.filter((u) => !done.has(u))
  const submittedList = studentUids.filter((u) => done.has(u))
  const rate = studentUids.length === 0 ? 0 : Math.round((submittedList.length / studentUids.length) * 100)

  return (
    <aside aria-label="명단" style={{ position: 'sticky', top: 132, alignSelf: 'start' }}>
      <div className="card" style={{ padding: 16 }}>
        <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
          <h2 className="text-card-title" style={{ margin: 0, fontSize: 18 }}>
            명단
          </h2>
          <Badge solid>
            {submittedList.length} / {studentUids.length}
          </Badge>
          <Caption>{rate}%</Caption>
        </div>

        <div style={{ marginTop: 12 }}>
          <Caption>미제출 {missing.length}명</Caption>
          {masked ? (
            <p className="text-body-sm" style={{ margin: '6px 0 0' }} role="status">
              {missing.length === 0 ? '모두 제출했습니다.' : `아직 ${missing.length}명이 제출하지 않았습니다.`}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
              {missing.map((u) => (
                <li key={u} className="flex items-center gap-xs" style={{ padding: '4px 0' }}>
                  <button type="button" className="text-link" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: 14, flex: 1, textAlign: 'left' }} onClick={() => onOpenStudent(u)}>
                    {nameOf(u)}
                  </button>
                </li>
              ))}
              {missing.length === 0 ? (
                <li className="text-body-sm" style={{ opacity: 0.6 }}>
                  모두 제출했습니다.
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <Caption>제출 {submittedList.length}명</Caption>
          {masked ? null : (
            <ul className="flex flex-wrap gap-xxs" style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
              {submittedList.map((u) => (
                <li key={u}>
                  <button type="button" className="badge" style={{ cursor: 'pointer', background: '#000', color: '#fff', boxShadow: 'none' }} onClick={() => onOpenStudent(u)}>
                    {nameOf(u)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  )
}

/* ── 개인 화면 ── */
export function StudentDetail({
  uid,
  lesson,
  docsByStep,
}: {
  uid: string
  lesson: Lesson
  docsByStep: Record<string, ResponseDoc[]>
}) {
  const { nameOf } = useNames()
  const steps = [...lesson.steps].sort((a, b) => a.order - b.order)
  return (
    <div>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        <Badge solid>{nameOf(uid)}</Badge>
        <Caption>{lesson.id}강 응답</Caption>
      </div>
      {steps.map((s) => {
        const doc = (docsByStep[s.id] ?? []).find((d) => d.uid === uid)
        const last = latestOf(doc)
        return (
          <section key={s.id} style={{ marginBottom: 20 }}>
            <h3 className="text-body" style={{ margin: 0, fontWeight: 600 }}>
              {s.order}. {s.title} {last ? null : <Badge>미제출</Badge>}
            </h3>
            {last ? (
              <div className="rounded-md" style={{ marginTop: 8, padding: 12, boxShadow: 'inset 0 0 0 1px #e6e6e6' }}>
                <FieldsText fields={s.fields} payload={last.payload as Record<string, unknown>} />
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}

export function FieldsText({ fields, payload }: { fields: Lesson['steps'][number]['fields']; payload: Record<string, unknown> }) {
  const entries = fields.length > 0 ? fields.map((f) => [f.label, payload[f.key]] as const) : Object.entries(payload)
  return (
    <dl style={{ margin: 0 }}>
      {entries.map(([label, value]) => (
        <div key={String(label)} style={{ marginBottom: 6 }}>
          <dt className="caption">{String(label)}</dt>
          <dd className="text-body-sm" style={{ margin: '2px 0 0', whiteSpace: 'pre-line' }}>
            {formatValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function formatValue(v: unknown): string {
  if (v == null || v === '') return '—'
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(formatValue).join(' · ')
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.nodes)) return `노드 ${(o.nodes as unknown[]).length}개`
    return Object.entries(o)
      .map(([k, x]) => `${k} ${formatValue(x)}`)
      .join(' · ')
  }
  return String(v)
}

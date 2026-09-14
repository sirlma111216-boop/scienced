import { useMemo } from 'react'
import type { Lesson } from '@/content/types'
import type { LessonView } from '@/lib/tiers'
import type { ResponseDoc } from '@/lib/types'
import { Badge, Button, Caption } from '@/components/ui'
import { latestOf, submitted, useNames } from './shared'

/**
 * 오른쪽 명단 열 (7차 R.4) 과 개인 화면 (R.2).
 *
 *   명단   참석·제출 현황. 미제출자를 위에 모은다. [알림 보내기] 로 그 학생 화면에 카드를 띄운다.
 *          「수업 후 이어서」 제출 여부를 함께 적는다. 한 사람을 누르면 개인 화면.
 *   개인   그 학생의 이 차시 응답을 한 화면에. 고친 응답은 v1 과 v2 를 나란히, 「무엇을 왜 바꿨는가」와 함께.
 *
 * 발표 모드에서는 미제출자를 이름 대신 숫자로만 (작업 S).
 */

export function RosterColumn({
  studentUids,
  docs,
  deferredDocs,
  hasDeferred,
  nudgedAt,
  onNudge,
  onNudgeAll,
  onOpenStudent,
}: {
  studentUids: string[]
  /** 지금 단계의 응답 */
  docs: ResponseDoc[]
  /** 「수업 후 이어서」에 속한 단계들의 응답 (uid → 제출한 단계 수 / 전체) */
  deferredDocs: { total: number; byUid: Record<string, number> }
  hasDeferred: boolean
  nudgedAt: Record<string, number>
  onNudge: (uid: string) => void
  onNudgeAll: (uids: string[]) => void
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
        {rate < 80 ? <Caption>제출률이 80% 아래면 분포를 열지 않는 편이 낫습니다.</Caption> : null}

        {/* 미제출자 — 위에 */}
        <div style={{ marginTop: 12 }}>
          <div className="flex items-center gap-xs">
            <Caption>미제출 {missing.length}명</Caption>
            {missing.length > 0 && !masked ? (
              <button type="button" className="btn-tertiary" style={{ minHeight: 26, fontSize: 12 }} onClick={() => onNudgeAll(missing)}>
                모두 알림
              </button>
            ) : null}
          </div>
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
                  <button type="button" className="btn-tertiary" style={{ minHeight: 26, fontSize: 12 }} onClick={() => onNudge(u)} aria-label={`${nameOf(u)} 에게 알림 보내기`}>
                    {nudgedAt[u] ? '다시 알림' : '알림'}
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

        {/* 제출한 사람 */}
        <div style={{ marginTop: 12 }}>
          <Caption>제출 {submittedList.length}명</Caption>
          {masked ? null : (
            <ul className="flex flex-wrap gap-xxs" style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
              {submittedList.map((u) => {
                const v = latestOf(docs.find((d) => d.uid === u))?.v ?? 1
                return (
                  <li key={u}>
                    <button type="button" className="badge" style={{ cursor: 'pointer', background: '#000', color: '#fff', boxShadow: 'none' }} onClick={() => onOpenStudent(u)}>
                      {nameOf(u)}
                      {v > 1 ? ` v${v}` : ''}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* 수업 후 이어서 */}
        {hasDeferred ? (
          <div style={{ marginTop: 12 }}>
            <Caption>수업 후 이어서 — {deferredDocs.total}곳</Caption>
            {masked ? (
              <p className="text-body-sm" style={{ margin: '6px 0 0' }}>
                다 낸 사람 {studentUids.filter((u) => (deferredDocs.byUid[u] ?? 0) >= deferredDocs.total).length}명
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
                {studentUids.map((u) => {
                  const n = deferredDocs.byUid[u] ?? 0
                  return (
                    <li key={u} className="text-body-sm flex items-center gap-xs" style={{ padding: '2px 0' }}>
                      <span style={{ flex: 1 }}>{nameOf(u)}</span>
                      <span className="font-mono text-caption">
                        {n} / {deferredDocs.total}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  )
}

/* ── 개인 화면 ── */
export function StudentDetail({
  uid,
  lesson,
  view,
  docsByStep,
  onReask,
}: {
  uid: string
  lesson: Lesson
  view: LessonView
  docsByStep: Record<string, ResponseDoc[]>
  onReask: (uids: string[]) => void
}) {
  const { nameOf } = useNames()
  const steps = useMemo(() => [...view.steps, ...view.deferredSteps].map((v) => v.step).sort((a, b) => a.order - b.order), [view])
  return (
    <div>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        <Badge solid>{nameOf(uid)}</Badge>
        <Caption>
          {lesson.id}강 응답 — 고친 답은 v1 과 마지막을 나란히
        </Caption>
        <span style={{ flex: 1 }} />
        <Button variant="secondary" onClick={() => onReask([uid])}>
          이 학생에게 재응답 요청
        </Button>
      </div>
      {steps.map((s) => {
        const doc = (docsByStep[s.id] ?? []).find((d) => d.uid === uid)
        const versions = doc?.versions ?? []
        const first = versions[0]
        const last = versions[versions.length - 1]
        const deferred = view.deferredSteps.some((v) => v.step.id === s.id)
        return (
          <section key={s.id} style={{ marginBottom: 20 }}>
            <h3 className="text-body" style={{ margin: 0, fontWeight: 600 }}>
              {s.order}. {s.title}
              {deferred ? <Badge>수업 후 이어서</Badge> : null}
              {last ? <Badge>{versions.length > 1 ? `v1 → v${last.v}` : 'v1'}</Badge> : <Badge>미제출</Badge>}
            </h3>
            {!last ? null : versions.length > 1 && first ? (
              <div className="flex gap-md" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                <div className="rounded-md" style={{ flex: '1 1 280px', padding: 12, boxShadow: 'inset 0 0 0 1px #e6e6e6' }}>
                  <Caption>v1 · 처음</Caption>
                  <FieldsText fields={s.fields} payload={first.payload as Record<string, unknown>} />
                </div>
                <div className="rounded-md" style={{ flex: '1 1 280px', padding: 12, boxShadow: 'inset 0 0 0 2px #111' }}>
                  <Caption>v{last.v} · 마지막</Caption>
                  <FieldsText fields={s.fields} payload={last.payload as Record<string, unknown>} />
                  {last.changedReason ? (
                    <p className="text-body-sm" style={{ margin: '8px 0 0' }}>
                      <strong>무엇을 왜 바꿨는가</strong> · {last.changedReason}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-md" style={{ marginTop: 8, padding: 12, boxShadow: 'inset 0 0 0 1px #e6e6e6' }}>
                <FieldsText fields={s.fields} payload={last.payload as Record<string, unknown>} />
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function FieldsText({ fields, payload }: { fields: Lesson['steps'][number]['fields']; payload: Record<string, unknown> }) {
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

function formatValue(v: unknown): string {
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

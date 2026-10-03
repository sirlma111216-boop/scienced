import { MT_ORDER_LABEL, MT_SCHEDULE, mtDateLabel, mtOpenState, mtSlotId, type MtCourseId } from '@shared/microteaching'
import type { Enrollment, MtSlot } from '@/lib/types'
import { Badge, Button, Caption, Card, ColorBlock, Notice, ScrollX } from '@/components/ui'

/**
 * 마이크로티칭 발표 신청 판 (강의자 지시 2026-10-03).
 *
 * 학생과 강사가 같은 판을 본다. 날짜마다 상자 하나, 상자 안에 「첫 번째 발표 · 두 번째 발표 · …」 단추.
 * 누르면 그 자리에 학번과 이름이 적히고 아래 표에도 같은 것이 보인다. 자기 자리만 취소할 수 있다.
 * 강사는 공개 시각을 정하고, 누가 아직 신청하지 않았는지 보고, 남의 자리도 뺄 수 있다(학생이 부탁할 때).
 * 안내 글은 존댓말이다 — 「신청은 아직 열리지 않았다」가 반말로 읽혔다 (강의자 지시 2026-10-03).
 */
export function ApplyBoard({
  courseId,
  uid,
  isInstructor,
  openAt,
  now,
  slots,
  enrollments,
  nameOf,
  busy,
  note,
  onApply,
  onCancel,
  onSetOpenAt,
}: {
  courseId: MtCourseId
  uid: string
  isInstructor: boolean
  openAt: number | null | undefined
  now: number
  slots: MtSlot[]
  /** 강사 — 미신청 명단을 세는 데 쓴다 */
  enrollments?: Enrollment[]
  /** 강사 — 명단의 실명 */
  nameOf?: (uid: string) => string
  busy: boolean
  note: string | null
  onApply: (slotId: string) => void
  onCancel: (uid: string) => void
  onSetOpenAt?: (at: number | null) => void
}) {
  const schedule = MT_SCHEDULE[courseId]
  const state = mtOpenState(openAt, now)
  const byId = new Map(slots.map((s) => [s.slotId, s]))
  const mine = slots.find((s) => s.uid === uid) ?? null
  const canApply = !isInstructor && state === 'open' && !busy
  const maxOrder = Math.max(...schedule.days.map((d) => d.count))
  const label = (s: MtSlot) => `${s.studentId || '학번 없음'} ${s.name || s.nickname}`

  if (!isInstructor && state !== 'open') {
    return (
      <ColorBlock tone="cream">
        <p className="eyebrow" style={{ margin: 0 }}>
          마이크로티칭 발표 신청 · {schedule.title}
        </p>
        <p className="text-headline" style={{ margin: '12px 0 0' }}>
          {state === 'scheduled' && typeof openAt === 'number' ? `${fmt(openAt)}에 신청이 열립니다.` : '신청은 아직 열리지 않았습니다.'}
        </p>
        <p className="text-body" style={{ marginTop: 12 }}>
          {state === 'scheduled' ? '그때 이 화면에 날짜와 자리가 뜹니다. 한 사람이 한 자리를 고릅니다.' : '강사가 여는 때를 정하면 이 화면에 그 때가 뜹니다.'}
        </p>
      </ColorBlock>
    )
  }

  return (
    <div>
      <ColorBlock tone="lime">
        <p className="eyebrow" style={{ margin: 0 }}>
          마이크로티칭 발표 신청 · {schedule.title}
        </p>
        <p className="text-headline" style={{ margin: '12px 0 0' }}>
          {mine ? `내 자리 — ${mtDateLabel(mine.date)} ${MT_ORDER_LABEL[mine.order - 1]}` : '날짜 상자에서 발표 순서 하나를 누르세요.'}
        </p>
        <p className="text-body" style={{ marginTop: 12 }}>
          {schedule.minutes}. 한 사람이 한 자리입니다. 내 자리는 취소하고 다른 날짜나 순서로 옮길 수 있습니다.
        </p>
        <Caption>
          신청 {slots.length} / {schedule.total}
        </Caption>
        {isInstructor ? <InstructorPanel openAt={openAt} state={state} now={now} slots={slots} enrollments={enrollments ?? []} nameOf={nameOf ?? (() => '')} busy={busy} onSetOpenAt={onSetOpenAt} /> : null}
        {note ? (
          <p role="alert" className="text-body-sm" style={{ margin: '12px 0 0', fontWeight: 480 }}>
            ⚠ {note}
          </p>
        ) : null}
      </ColorBlock>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginTop: 24 }}>
        {schedule.days.map((d) => (
          <Card key={d.date}>
            <p className="text-card-title" style={{ margin: 0 }}>
              {mtDateLabel(d.date)}
            </p>
            <Caption>{d.count}명</Caption>
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 8 }}>
              {Array.from({ length: d.count }, (_, i) => {
                const id = mtSlotId(d.date, i + 1)
                const taken = byId.get(id)
                const isMine = taken?.uid === uid
                return (
                  <li key={id} className="flex items-center gap-xs" style={{ flexWrap: 'wrap', minHeight: 36 }}>
                    <span className="text-body-sm" style={{ minWidth: 92, opacity: 0.8 }}>
                      {MT_ORDER_LABEL[i]}
                    </span>
                    {taken ? (
                      <>
                        <span className="text-body" style={{ fontWeight: isMine ? 600 : 400 }}>
                          {label(taken)}
                        </span>
                        {isMine ? <Badge solid>내 신청</Badge> : null}
                        {isMine || isInstructor ? (
                          <Button variant="tertiary" disabled={busy} onClick={() => onCancel(taken.uid)}>
                            취소
                          </Button>
                        ) : null}
                      </>
                    ) : canApply ? (
                      <Button variant="secondary" onClick={() => onApply(id)}>
                        {mine ? '여기로 옮기기' : '신청'}
                      </Button>
                    ) : (
                      <span className="text-body-sm" style={{ opacity: 0.6 }}>
                        빈자리
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        ))}
      </div>

      <section style={{ marginTop: 32 }}>
        <p className="eyebrow" style={{ margin: 0 }}>
          전체 일정
        </p>
        <ScrollX>
          <table className="text-body-sm" style={{ marginTop: 12, borderCollapse: 'collapse', minWidth: 480 }}>
            <thead>
              <tr>
                <th style={th}>날짜</th>
                {Array.from({ length: maxOrder }, (_, i) => (
                  <th key={i} style={th}>
                    {MT_ORDER_LABEL[i]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedule.days.map((d) => (
                <tr key={d.date}>
                  <td style={td}>{mtDateLabel(d.date)}</td>
                  {Array.from({ length: maxOrder }, (_, i) => {
                    if (i >= d.count) return <td key={i} style={{ ...td, opacity: 0.3 }} />
                    const taken = byId.get(mtSlotId(d.date, i + 1))
                    return (
                      <td key={i} style={{ ...td, fontWeight: taken?.uid === uid ? 600 : 400 }}>
                        {taken ? label(taken) : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      </section>

      {/* 강의자 지시 2026-10-03 — 신청 화면 맨 아래에 안내 상자 하나 */}
      <div style={{ marginTop: 32 }}>
        <Notice tone="cream">
          <p className="text-body" style={{ margin: 0 }}>
            마이크로티칭 주제와 수행 방법은 강의 시간에 안내해 드립니다.
          </p>
        </Notice>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #000', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #e5e5e5', whiteSpace: 'nowrap' }

function fmt(ms: number): string {
  const d = new Date(ms)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** datetime-local 입력값 ↔ ms (브라우저의 시간대) */
function toLocalInput(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function InstructorPanel({
  openAt,
  state,
  now,
  slots,
  enrollments,
  nameOf,
  busy,
  onSetOpenAt,
}: {
  openAt: number | null | undefined
  state: 'closed' | 'scheduled' | 'open'
  now: number
  slots: MtSlot[]
  enrollments: Enrollment[]
  nameOf: (uid: string) => string
  busy: boolean
  onSetOpenAt?: (at: number | null) => void
}) {
  const active = enrollments.filter((e) => e.status === 'active')
  const applied = new Set(slots.map((s) => s.uid))
  const missing = active.filter((e) => !applied.has(e.uid)).sort((a, b) => (a.studentId ?? '').localeCompare(b.studentId ?? '', 'ko'))
  return (
    <div style={{ marginTop: 16 }}>
      <Notice tone="cream">
        <p className="eyebrow" style={{ margin: 0 }}>
          강사 — 공개와 현황
        </p>
        <div className="flex items-center gap-xs" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <label htmlFor="mt-open-at" className="text-body-sm">
            학생에게 여는 때
          </label>
          <input
            id="mt-open-at"
            className="field"
            type="datetime-local"
            value={typeof openAt === 'number' ? toLocalInput(openAt) : ''}
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value
              onSetOpenAt?.(v ? new Date(v).getTime() : null)
            }}
            style={{ minHeight: 36, padding: '2px 8px' }}
          />
          <Button variant="tertiary" disabled={busy || openAt == null} onClick={() => onSetOpenAt?.(null)}>
            닫기
          </Button>
          <Badge solid={state === 'open'}>{state === 'open' ? '학생에게 열림' : state === 'scheduled' ? `${fmt(openAt as number)}에 열림` : '학생에게 닫힘'}</Badge>
        </div>
        <Caption>때를 비우면 학생 화면에서 이 신청이 사라집니다. 지금은 {fmt(now)}입니다.</Caption>
        <p className="text-body-sm" style={{ margin: '12px 0 0' }}>
          아직 신청하지 않은 사람 {missing.length} / {active.length}
          {missing.length ? ` — ${missing.map((e) => `${e.studentId ?? ''} ${nameOf(e.uid) || e.nickname}`.trim()).join(', ')}` : ''}
        </p>
      </Notice>
    </div>
  )
}

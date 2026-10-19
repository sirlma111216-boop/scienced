import { useRef, useState } from 'react'
import { MT_FILE_ACCEPT, MT_FILE_MAX_MB, MT_ORDER_LABEL, MT_SCHEDULE, MT_TOPIC_MAX, mtDateLabel, mtOpenState, mtSlotId, type MtCourseId } from '@shared/microteaching'
import { fileSizeText } from '@shared/textbook'
import { checkMtFile, openMtFile, uploadMtFile } from '@/lib/microteaching-files'
import type { Enrollment, MtApplication, MtFileMeta, MtSlot } from '@/lib/types'
import { Badge, Button, Caption, Card, ColorBlock, Notice, ScrollX } from '@/components/ui'

/**
 * 마이크로티칭 발표 신청 판 (강의자 지시 2026-10-03).
 *
 * 학생과 강사가 같은 판을 본다. 날짜마다 상자 하나, 상자 안에 「첫 번째 발표 · 두 번째 발표 · …」 단추.
 * 누르면 그 자리에 학번과 이름이 적히고 아래 표에도 같은 것이 보인다. 자기 자리만 취소할 수 있다.
 * 강사는 공개 시각을 정하고, 누가 아직 신청하지 않았는지 보고, 남의 자리도 뺄 수 있다(학생이 부탁할 때).
 * 안내 글은 존댓말이다 — 「신청은 아직 열리지 않았다」가 반말로 읽혔다 (강의자 지시 2026-10-03).
 *
 * 2026-10-16 강의자 지시:
 *   · 일정표는 학생 모두에게 늘 보인다 — 신청 기간 전에도. 신청 단추만 기간에 열린다.
 *   · 자리마다 발표 주제를 신청한 본인이 적고, 같은 반 모두가 본다.
 *   · 맨 아래 「수업계획안」 — 강사가 양식을 올리면 수강생이 내려받고, 신청한 사람은 자기 계획안을 올린다(본인과 강사만 본다).
 */
export function ApplyBoard({
  classId,
  template,
  apps,
  onSaveDetail,
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
  classId: string
  /** 수업계획안 양식 — 클래스 문서 mtTemplate */
  template: MtFileMeta | null | undefined
  /** 신청 기록 — 학생은 자기 것 하나, 강사는 전부 */
  apps: Array<MtApplication & { uid: string }>
  onSaveDetail: (d: { topic: string }) => Promise<{ ok: boolean; message?: string }>
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

  return (
    <div>
      <ColorBlock tone={!isInstructor && state !== 'open' ? 'cream' : 'lime'}>
        <p className="eyebrow" style={{ margin: 0 }}>
          마이크로티칭 발표 신청 · {schedule.title}
        </p>
        <p className="text-headline" style={{ margin: '12px 0 0' }}>
          {mine
            ? `내 자리 — ${mtDateLabel(mine.date)} ${MT_ORDER_LABEL[mine.order - 1]}`
            : !isInstructor && state === 'scheduled' && typeof openAt === 'number'
              ? `${fmt(openAt)}에 신청이 열립니다.`
              : !isInstructor && state !== 'open'
                ? '신청은 아직 열리지 않았습니다. 일정은 미리 볼 수 있습니다.'
                : '날짜 상자에서 발표 순서 하나를 누르세요.'}
        </p>
        <p className="text-body" style={{ marginTop: 12 }}>
          {schedule.minutes}. 한 사람이 한 자리입니다. 내 자리는 취소하고 다른 날짜나 순서로 옮길 수 있습니다. 신청한 뒤에는 내 자리에서 「주제 적기」로 발표 주제만 적습니다. 나머지는 수업계획안에 적어 주세요.
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
                  <li key={id} style={{ minHeight: 36 }}>
                  <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
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
                  </div>
                  {taken ? <SlotDetail slot={taken} editable={isMine && !isInstructor} onSave={onSaveDetail} /> : null}
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
                        {taken?.topic ? (
                          <span className="text-body-sm" style={{ display: 'block', fontWeight: 400, opacity: 0.75, whiteSpace: 'normal', maxWidth: 220 }}>
                            {detailLine(taken)}
                          </span>
                        ) : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      </section>

      <PlanSection classId={classId} isInstructor={isInstructor} template={template ?? null} mine={mine} apps={apps} slots={slots} nameOf={nameOf ?? (() => '')} label={label} />

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

/* ─────────────── 발표 내용 (2026-10-16) ─────────────── */

/** 일정표에는 발표 주제만 표시한다. */
function detailLine(s: MtSlot): string {
  return s.topic ?? ''
}

function SlotDetail({ slot, editable, onSave }: { slot: MtSlot; editable: boolean; onSave: (d: { topic: string }) => Promise<{ ok: boolean; message?: string }> }) {
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState(slot.topic ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const has = Boolean(slot.topic)

  async function save() {
    setBusy(true)
    setError(null)
    const r = await onSave({ topic })
    setBusy(false)
    if (!r.ok) setError(r.message ?? '저장하지 못했습니다.')
    else setOpen(false)
  }

  return (
    <div style={{ margin: '6px 0 4px', paddingLeft: 10, borderLeft: '3px solid #e5e5e5' }}>
      {has ? (
        <p className="text-body-sm" style={{ margin: 0 }}>
          <span style={{ fontWeight: 480 }}>{slot.topic}</span>
        </p>
      ) : editable ? null : (
        <p className="text-body-sm" style={{ margin: 0, opacity: 0.55 }}>
          발표 주제를 아직 적지 않았습니다
        </p>
      )}
      {editable && !open ? (
        <Button variant={has ? 'tertiary' : 'secondary'} onClick={() => setOpen(true)} style={{ whiteSpace: 'nowrap', paddingLeft: has ? 0 : undefined }}>
          {has ? '주제 고치기' : '주제 적기'}
        </Button>
      ) : null}
      {editable && open ? (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: '#faf8f2', display: 'grid', gap: 8 }}>
          <label className="text-body-sm" style={{ fontWeight: 480 }}>
            주제
            <input className="field" value={topic} maxLength={MT_TOPIC_MAX} onChange={(e) => setTopic(e.target.value)} placeholder="예: 세포 관찰로 생물의 공통점 찾기" style={{ display: 'block', marginTop: 4, width: '100%' }} />
          </label>
          <Caption>학년, 단원, 수업 방식 등은 수업계획안에 적어 주세요.</Caption>
          {error ? (
            <p role="alert" className="text-body-sm" style={{ margin: 0, fontWeight: 480 }}>
              ⚠ {error}
            </p>
          ) : null}
          <div className="flex gap-xs">
            <Button disabled={busy || !topic.trim()} onClick={() => void save()}>
              {busy ? '저장하는 중' : '저장'}
            </Button>
            <Button variant="tertiary" onClick={() => setOpen(false)}>
              닫기
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ─────────────── 수업계획안 (2026-10-16) ─────────────── */

function FileUploadRow({ classId, kind, label, onDone }: { classId: string; kind: 'template' | 'plan'; label: string; onDone?: () => void }) {
  const input = useRef<HTMLInputElement | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function pick(file: File | null) {
    if (!file) return
    setMsg(null)
    const problem = await checkMtFile(file)
    if (problem) return setMsg({ ok: false, text: problem })
    setProgress(0)
    const r = await uploadMtFile(classId, kind, file, (s, t) => setProgress(Math.round((s / t) * 100)))
    setProgress(null)
    if (!r.ok) {
      console.warn('[마이크로티칭] 파일을 올리지 못했다:', r.message)
      return setMsg({ ok: false, text: r.message ?? '올리지 못했습니다.' })
    }
    setMsg({ ok: true, text: `「${file.name}」을 올렸습니다.` })
    onDone?.()
  }

  return (
    <div style={{ marginTop: 8 }}>
      <Button variant="secondary" disabled={progress !== null} onClick={() => input.current?.click()}>
        {progress !== null ? `올리는 중 ${progress}%` : label}
      </Button>
      <input
        ref={input}
        type="file"
        accept={MT_FILE_ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => {
          void pick(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <Caption>한글(hwp · hwpx) · 워드(docx · doc) · PDF, {MT_FILE_MAX_MB} MB 까지. 다시 올리면 바뀝니다.</Caption>
      {msg ? (
        <p role={msg.ok ? 'status' : 'alert'} className="text-body-sm" style={{ margin: '6px 0 0', fontWeight: 480 }}>
          {msg.ok ? '✓ ' : '⚠ '}
          {msg.text}
        </p>
      ) : null}
    </div>
  )
}

function PlanSection({
  classId,
  isInstructor,
  template,
  mine,
  apps,
  slots,
  nameOf,
  label,
}: {
  classId: string
  isInstructor: boolean
  template: MtFileMeta | null
  mine: MtSlot | null
  apps: Array<MtApplication & { uid: string }>
  slots: MtSlot[]
  nameOf: (uid: string) => string
  label: (s: MtSlot) => string
}) {
  const [err, setErr] = useState<string | null>(null)
  const myPlan = apps.find((a) => a.plan)?.plan ?? null
  const download = async (kind: 'template' | 'plan', uid?: string) => {
    setErr(null)
    const e = await openMtFile(classId, kind, uid)
    if (e) setErr(e)
  }
  const ordered = [...slots].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
  const planOf = (uid: string) => apps.find((a) => a.uid === uid)?.plan ?? null

  return (
    <section aria-labelledby="mt-plan-title" style={{ marginTop: 32 }}>
      <p className="eyebrow" style={{ margin: 0 }} id="mt-plan-title">
        수업계획안
      </p>
      <Card>
        {template ? (
          <p className="text-body" style={{ margin: 0 }}>
            양식 — {template.name} <span style={{ opacity: 0.6 }}>({fileSizeText(template.size)})</span>{' '}
            <Button variant="tertiary" onClick={() => void download('template')}>
              양식 내려받기
            </Button>
          </p>
        ) : (
          <p className="text-body" style={{ margin: 0, opacity: 0.75 }}>
            수업계획안 양식은 강의자가 올리면 여기에 뜹니다. 그 뒤에 양식을 내려받아 작성하고 이곳에 올립니다.
          </p>
        )}

        {isInstructor ? (
          <>
            <FileUploadRow classId={classId} kind="template" label={template ? '양식 바꾸기' : '양식 올리기'} />
            <p className="text-body-sm" style={{ margin: '16px 0 0', fontWeight: 480 }}>
              낸 계획안 {ordered.filter((s) => planOf(s.uid)).length} / {ordered.length}
            </p>
            {ordered.length ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 6 }}>
                {ordered.map((s) => {
                  const p = planOf(s.uid)
                  return (
                    <li key={s.slotId} className="text-body-sm flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
                      <span style={{ minWidth: 150 }}>
                        {mtDateLabel(s.date)} {MT_ORDER_LABEL[s.order - 1]}
                      </span>
                      <span style={{ minWidth: 160 }}>{nameOf(s.uid) ? `${s.studentId} ${nameOf(s.uid)}` : label(s)}</span>
                      {p ? (
                        <Button variant="tertiary" onClick={() => void download('plan', s.uid)}>
                          {p.name} 내려받기
                        </Button>
                      ) : (
                        <span style={{ opacity: 0.55 }}>아직 안 냄</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </>
        ) : mine ? (
          template ? (
            <div style={{ marginTop: 12 }}>
              {myPlan ? (
                <p className="text-body-sm" style={{ margin: 0 }}>
                  낸 계획안 — {myPlan.name} <span style={{ opacity: 0.6 }}>({fileSizeText(myPlan.size)})</span>{' '}
                  <Button variant="tertiary" onClick={() => void download('plan')}>
                    내려받기
                  </Button>
                </p>
              ) : (
                <p className="text-body-sm" style={{ margin: 0 }}>
                  아직 계획안을 내지 않았습니다.
                </p>
              )}
              <FileUploadRow classId={classId} kind="plan" label={myPlan ? '계획안 다시 올리기' : '내 계획안 올리기'} />
              <Caption>올린 계획안은 나와 강의자만 볼 수 있습니다.</Caption>
            </div>
          ) : null
        ) : template ? (
          <Caption>발표 자리를 신청하면 여기에서 계획안을 올릴 수 있습니다.</Caption>
        ) : null}
        {err ? (
          <p role="alert" className="text-body-sm" style={{ margin: '8px 0 0', fontWeight: 480 }}>
            ⚠ {err}
          </p>
        ) : null}
      </Card>
    </section>
  )
}

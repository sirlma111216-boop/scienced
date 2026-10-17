import { useCallback, useEffect, useRef, useState } from 'react'
import { MT_NOTE_MAX, MT_ORDER_LABEL, MT_PEER_MAX, MT_SCHEDULE, MT_VIDEO_ACCEPT, mtDateLabel, type MtCourseId } from '@shared/microteaching'
import { fileSizeText } from '@shared/textbook'
import { checkMtVideo, mtFileUrl, mtPeerList, openMtFile, saveMtNote, saveMtPeer, uploadMtVideo, type MtNoteField } from '@/lib/microteaching-files'
import type { MtApplication, MtFileMeta, MtNote, MtPeerDoc, MtPeerView, MtSlot } from '@/lib/types'
import { Button, Caption, Card, ColorBlock, Notice } from '@/components/ui'

/**
 * 마이크로티칭 기록 (강의자 지시 2026-10-17 — 발표가 임박).
 *
 *   학생 /microteaching/record                      내 지도안 · 강사의 지도안 피드백 · 내 수업 영상 · 내 후기 · 강사의 수업 피드백 · 동료 의견(익명)
 *                                                   + 다른 사람 수업에 훌륭한 점 · 개선점 적기
 *   강사 /instructor/class/:classId/mtrecord         발표자마다 — 지도안(내려받기 · 화면에서 보기) · 지도안 피드백 · 영상 올리기 · 학생 후기 · 수업 피드백 · 동료 의견(이름과 함께)
 *
 * 누가 무엇을 보는가 (서버 functions/api/_lib/microteaching.ts 와 규칙이 지킨다 — 화면은 그 결과를 그린다):
 *   지도안 · 영상 · 피드백 · 후기   발표한 본인과 강사
 *   동료 의견                       쓴 사람은 자기 것 · 강사는 전부(이름) · 발표자는 익명 번호만
 */

const SAVED = '저장했습니다.'

function when(at: number | undefined) {
  if (!at) return ''
  const d = new Date(at)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="text-body-sm" style={{ margin: '8px 0 0', fontWeight: 480 }}>
      ⚠ {text}
    </p>
  ) : null
}

/* ─────────────── 글 한 칸 — 피드백 · 후기 ─────────────── */

function NoteBox({
  title,
  note,
  editable,
  placeholder,
  emptyText,
  onSave,
}: {
  title: string
  note: MtNote | null | undefined
  editable: boolean
  placeholder?: string
  emptyText: string
  onSave?: (text: string) => Promise<{ ok: boolean; message?: string }>
}) {
  const [text, setText] = useState(note?.text ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  /* 다른 기기에서 고친 글이 오면 따라간다 — 쓰는 중(바뀐 글이 있음)이면 두지 않는다 */
  const lastSaved = useRef(note?.text ?? '')
  useEffect(() => {
    const incoming = note?.text ?? ''
    if (text === lastSaved.current) setText(incoming)
    lastSaved.current = incoming
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.text, note?.at])

  async function save() {
    if (!onSave) return
    setBusy(true)
    setMsg(null)
    const r = await onSave(text)
    setBusy(false)
    if (!r.ok) {
      console.warn('[마이크로티칭] 글을 저장하지 못했다:', r.message)
      return setMsg({ ok: false, text: r.message ?? '저장하지 못했습니다.' })
    }
    lastSaved.current = text.trim()
    setMsg({ ok: true, text: text.trim() ? SAVED : '지웠습니다.' })
  }

  const dirty = text.trim() !== (note?.text ?? '').trim()
  return (
    <div style={{ marginTop: 16 }}>
      <p className="text-body-sm" style={{ margin: 0, fontWeight: 480 }}>
        {title}
        {note?.at ? <span style={{ opacity: 0.55, fontWeight: 400 }}> · {when(note.at)}</span> : null}
      </p>
      {editable ? (
        <>
          <textarea
            className="input"
            aria-label={title}
            value={text}
            maxLength={MT_NOTE_MAX}
            rows={5}
            placeholder={placeholder}
            style={{ width: '100%', marginTop: 6, resize: 'vertical' }}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center gap-xs" style={{ marginTop: 6, flexWrap: 'wrap' }}>
            <Button variant="secondary" disabled={busy || !dirty} onClick={() => void save()}>
              {busy ? '저장하는 중' : note?.text && !text.trim() ? '글 지우기' : '저장'}
            </Button>
            <Caption style={{ margin: 0 }}>
              {text.length} / {MT_NOTE_MAX}자
            </Caption>
          </div>
        </>
      ) : note?.text ? (
        <p className="text-body" style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>
          {note.text}
        </p>
      ) : (
        <p className="text-body-sm" style={{ margin: '6px 0 0', opacity: 0.65 }}>
          {emptyText}
        </p>
      )}
      {msg ? (
        <p role={msg.ok ? 'status' : 'alert'} className="text-body-sm" style={{ margin: '6px 0 0', fontWeight: 480 }}>
          {msg.ok ? '✓ ' : '⚠ '}
          {msg.text}
        </p>
      ) : null}
    </div>
  )
}

/* ─────────────── 지도안 — 내려받기 · 화면에서 보기 ─────────────── */

function PlanLine({ classId, uid, plan, canView }: { classId: string; uid?: string; plan: MtFileMeta | null | undefined; canView: boolean }) {
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => setView(null), [plan?.key])
  if (!plan)
    return (
      <p className="text-body-sm" style={{ margin: 0, opacity: 0.65 }}>
        아직 낸 지도안이 없습니다.
      </p>
    )
  async function open() {
    setBusy(true)
    setErr(null)
    const r = await mtFileUrl(classId, 'plan', uid, true)
    setBusy(false)
    if (typeof r === 'string') return setErr(r)
    setView(r.url)
  }
  return (
    <div>
      <p className="text-body-sm flex items-center gap-xs" style={{ margin: 0, flexWrap: 'wrap' }}>
        <span>
          {plan.name} <span style={{ opacity: 0.6 }}>({fileSizeText(plan.size)} · {when(plan.at)})</span>
        </span>
        <Button
          variant="tertiary"
          onClick={() => {
            setErr(null)
            void openMtFile(classId, 'plan', uid).then((e) => e && setErr(e))
          }}
        >
          내려받기
        </Button>
        {canView && plan.ext === 'pdf' ? (
          <Button variant="tertiary" disabled={busy} onClick={() => (view ? setView(null) : void open())}>
            {view ? '닫기' : busy ? '여는 중' : '화면에서 보기'}
          </Button>
        ) : null}
      </p>
      {canView && plan.ext !== 'pdf' ? <Caption>한글 · 워드 파일은 내려받아 봅니다. 화면에서 바로 보려면 PDF 로 내도록 안내하세요.</Caption> : null}
      {view ? <iframe title={`지도안 — ${plan.name}`} src={`${view}#toolbar=0`} style={{ width: '100%', height: '75vh', border: '1px solid var(--line, #ddd)', borderRadius: 8, marginTop: 8, background: '#fff' }} /> : null}
      <Problem text={err} />
    </div>
  )
}

/* ─────────────── 수업 영상 ─────────────── */

function VideoBox({ classId, uid, video }: { classId: string; uid?: string; video: MtFileMeta | null | undefined }) {
  const [src, setSrc] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(async () => {
    setErr(null)
    const r = await mtFileUrl(classId, 'video', uid, true)
    if (typeof r === 'string') return setErr(r)
    setSrc(r.url)
  }, [classId, uid])
  useEffect(() => {
    setSrc(null)
    if (video?.key) void load()
  }, [video?.key, load])
  if (!video)
    return (
      <p className="text-body-sm" style={{ margin: 0, opacity: 0.65 }}>
        아직 올라온 수업 영상이 없습니다.
      </p>
    )
  return (
    <div>
      <p className="text-body-sm" style={{ margin: 0 }}>
        {video.name} <span style={{ opacity: 0.6 }}>({fileSizeText(video.size)} · {when(video.at)})</span>
      </p>
      {src ? (
        <video
          controls
          preload="metadata"
          playsInline
          src={src}
          aria-label={`수업 영상 — ${video.name}`}
          style={{ width: '100%', maxHeight: '70vh', marginTop: 8, background: '#000', borderRadius: 8 }}
          onError={() => setErr('영상을 재생하지 못했습니다. 주소가 만료됐으면 「다시 불러오기」를 누르세요.')}
        />
      ) : err ? null : (
        <Caption>영상 주소를 받는 중입니다.</Caption>
      )}
      <div className="flex items-center gap-xs" style={{ marginTop: 6, flexWrap: 'wrap' }}>
        <Button variant="tertiary" onClick={() => void load()}>
          다시 불러오기
        </Button>
        <Caption style={{ margin: 0 }}>이 영상은 발표한 본인과 강의자만 볼 수 있습니다. 재생 주소는 두 시간 뒤에 만료됩니다.</Caption>
      </div>
      <Problem text={err} />
    </div>
  )
}

function VideoUploadRow({ classId, uid, hasVideo }: { classId: string; uid: string; hasVideo: boolean }) {
  const input = useRef<HTMLInputElement | null>(null)
  const cancel = useRef<{ cancelled: boolean } | null>(null)
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function pick(file: File | null) {
    if (!file) return
    setMsg(null)
    const problem = await checkMtVideo(file)
    if (problem) return setMsg({ ok: false, text: problem })
    const sig = { cancelled: false }
    cancel.current = sig
    setProgress({ sent: 0, total: file.size })
    const r = await uploadMtVideo(classId, uid, file, (sent, total) => setProgress({ sent, total }), sig)
    setProgress(null)
    cancel.current = null
    if (!r.ok) return setMsg({ ok: false, text: r.message ?? '올리지 못했습니다.' })
    setMsg({ ok: true, text: `「${file.name}」을 올렸습니다. 학생에게 바로 보입니다.` })
  }

  const pct = progress ? Math.round((progress.sent / Math.max(1, progress.total)) * 100) : 0
  return (
    <div style={{ marginTop: 8 }}>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Button variant="secondary" disabled={progress !== null} onClick={() => input.current?.click()}>
          {progress ? `올리는 중 ${pct}% (${fileSizeText(progress.sent)} / ${fileSizeText(progress.total)})` : hasVideo ? '영상 바꾸기' : '수업 영상 올리기'}
        </Button>
        {progress ? (
          <Button
            variant="tertiary"
            onClick={() => {
              if (cancel.current) cancel.current.cancelled = true
            }}
          >
            멈추기
          </Button>
        ) : null}
      </div>
      {progress ? <progress value={progress.sent} max={progress.total} aria-label="영상 올리기 진행" style={{ width: '100%', marginTop: 6 }} /> : null}
      <input
        ref={input}
        type="file"
        accept={MT_VIDEO_ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => {
          void pick(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <Caption>mp4 · mov · webm. 큰 파일은 잘라서 올리므로 시간이 걸립니다 — 끝날 때까지 이 화면을 닫지 마세요. 다시 올리면 바뀝니다.</Caption>
      {msg ? (
        <p role={msg.ok ? 'status' : 'alert'} className="text-body-sm" style={{ margin: '6px 0 0', fontWeight: 480 }}>
          {msg.ok ? '✓ ' : '⚠ '}
          {msg.text}
        </p>
      ) : null}
    </div>
  )
}

/* ─────────────── 동료 의견 ─────────────── */

function PeerList({ classId, presenterUid, nameOf, refreshKey }: { classId: string; presenterUid?: string; nameOf?: (uid: string) => string; refreshKey?: unknown }) {
  const [list, setList] = useState<MtPeerView[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(async () => {
    setErr(null)
    const r = await mtPeerList(classId, presenterUid)
    if (!r.ok) {
      console.warn('[마이크로티칭] 동료 의견을 읽지 못했다:', r.message)
      return setErr(r.message ?? '의견을 읽지 못했습니다.')
    }
    setList(r.comments ?? [])
  }, [classId, presenterUid])
  useEffect(() => {
    void load()
  }, [load, refreshKey])
  return (
    <div style={{ marginTop: 8 }}>
      {list === null && !err ? (
        <Caption>의견을 읽는 중입니다.</Caption>
      ) : list && list.length === 0 ? (
        <p className="text-body-sm" style={{ margin: 0, opacity: 0.65 }}>
          아직 적힌 의견이 없습니다.
        </p>
      ) : list ? (
        <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 10 }}>
          {list.map((c) => (
            <li key={c.n} className="text-body-sm">
              <p style={{ margin: 0, fontWeight: 480 }}>
                {nameOf && c.authorUid ? nameOf(c.authorUid) || c.authorUid : `의견 ${c.n}`}
                <span style={{ opacity: 0.55, fontWeight: 400 }}> · {when(c.at)}</span>
              </p>
              {c.good ? (
                <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                  <span style={{ fontWeight: 480 }}>훌륭한 점</span> {c.good}
                </p>
              ) : null}
              {c.improve ? (
                <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                  <span style={{ fontWeight: 480 }}>개선점</span> {c.improve}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex items-center gap-xs" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <Button variant="tertiary" onClick={() => void load()}>
          새로 읽기
        </Button>
        {!nameOf ? <Caption style={{ margin: 0 }}>누가 적었는지는 보이지 않습니다. 번호는 적은 순서와 무관합니다.</Caption> : null}
      </div>
      <Problem text={err} />
    </div>
  )
}

function PeerForm({ classId, presenterUid, mine }: { classId: string; presenterUid: string; mine: MtPeerDoc | null }) {
  const [good, setGood] = useState(mine?.good ?? '')
  const [improve, setImprove] = useState(mine?.improve ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const seen = useRef(mine?.at ?? 0)
  useEffect(() => {
    if ((mine?.at ?? 0) !== seen.current) {
      seen.current = mine?.at ?? 0
      setGood(mine?.good ?? '')
      setImprove(mine?.improve ?? '')
    }
  }, [mine])
  const dirty = good.trim() !== (mine?.good ?? '') || improve.trim() !== (mine?.improve ?? '')
  async function save() {
    setBusy(true)
    setMsg(null)
    const r = await saveMtPeer(classId, presenterUid, good, improve)
    setBusy(false)
    if (!r.ok) {
      console.warn('[마이크로티칭] 동료 의견을 저장하지 못했다:', r.message)
      return setMsg({ ok: false, text: r.message ?? '저장하지 못했습니다.' })
    }
    setMsg({ ok: true, text: good.trim() || improve.trim() ? SAVED : '지웠습니다.' })
  }
  const area = (label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <label className="text-body-sm" style={{ display: 'block', marginTop: 8 }}>
      <span style={{ fontWeight: 480 }}>{label}</span>
      <textarea className="input" value={value} maxLength={MT_PEER_MAX} rows={3} placeholder={placeholder} style={{ width: '100%', marginTop: 4, resize: 'vertical' }} onChange={(e) => set(e.target.value)} />
    </label>
  )
  return (
    <div>
      {area('훌륭한 점', good, setGood, '수업에서 배울 만했던 것을 구체적으로 적으세요. 예: 학생의 틀린 답을 바로 고치지 않고 이유를 되물었다.')}
      {area('개선점(아쉬운 점)', improve, setImprove, '다음 수업에서 바꾸면 좋을 것을 적으세요. 예: 실험 안내가 길어 학생이 손을 댈 시간이 짧았다.')}
      <div className="flex items-center gap-xs" style={{ marginTop: 6, flexWrap: 'wrap' }}>
        <Button variant="secondary" disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? '저장하는 중' : mine && !good.trim() && !improve.trim() ? '의견 지우기' : mine ? '고쳐 저장' : '의견 남기기'}
        </Button>
        {mine?.at ? <Caption style={{ margin: 0 }}>마지막 저장 {when(mine.at)}</Caption> : null}
      </div>
      {msg ? (
        <p role={msg.ok ? 'status' : 'alert'} className="text-body-sm" style={{ margin: '6px 0 0', fontWeight: 480 }}>
          {msg.ok ? '✓ ' : '⚠ '}
          {msg.text}
        </p>
      ) : null}
    </div>
  )
}

/* ─────────────── 학생 화면 ─────────────── */

const slotLabel = (s: MtSlot) => `${mtDateLabel(s.date)} ${MT_ORDER_LABEL[s.order - 1] ?? `${s.order}번째`}`

export function StudentRecord({
  classId,
  courseId,
  uid,
  slots,
  app,
  myPeer,
  note,
  onGoApply,
}: {
  classId: string
  courseId: MtCourseId
  uid: string
  slots: MtSlot[]
  /** 내 신청 기록 — 지도안 · 피드백 · 영상 · 후기 */
  app: MtApplication | null
  /** 내가 다른 사람 수업에 적은 의견 */
  myPeer: MtPeerDoc[]
  note: string | null
  onGoApply: () => void
}) {
  const schedule = MT_SCHEDULE[courseId]
  const mine = slots.find((s) => s.uid === uid) ?? null
  const others = [...slots].filter((s) => s.uid !== uid).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
  const save = (field: MtNoteField) => (text: string) => saveMtNote(classId, field, text)

  return (
    <div>
      <ColorBlock tone="lime">
        <p className="eyebrow" style={{ margin: 0 }}>
          내 마이크로티칭 · {schedule.title}
        </p>
        {mine ? (
          <p className="text-headline" style={{ margin: '8px 0 0' }}>
            {slotLabel(mine)}
            {mine.topic ? <span style={{ fontWeight: 400 }}> · {mine.topic}</span> : null}
          </p>
        ) : (
          <p className="text-body" style={{ margin: '8px 0 0' }}>
            아직 발표 자리를 신청하지 않았습니다. 자리를 신청하면 지도안 · 영상 · 피드백이 이곳에 모입니다.{' '}
            <Button variant="tertiary" onClick={onGoApply}>
              발표 신청으로 가기
            </Button>
          </p>
        )}
        <Caption style={{ marginTop: 8 }}>지도안 · 수업 영상 · 피드백 · 후기는 나와 강의자만 봅니다. 동료 의견은 누가 적었는지 보이지 않습니다.</Caption>
      </ColorBlock>
      {note ? (
        <div style={{ marginTop: 12 }}>
          <Notice>{note}</Notice>
        </div>
      ) : null}

      {mine ? (
        <>
          <section aria-labelledby="rec-plan" style={{ marginTop: 24 }}>
            <p className="eyebrow" id="rec-plan" style={{ margin: 0 }}>
              교수학습지도안
            </p>
            <Card>
              <PlanLine classId={classId} plan={app?.plan} canView={false} />
              <Caption>지도안을 내거나 바꾸는 곳은 「발표 신청」 화면의 수업계획안 칸입니다.</Caption>
              <NoteBox title="강의자의 지도안 피드백" note={app?.planFeedback} editable={false} emptyText="강의자가 지도안을 읽고 적으면 여기에 뜹니다." />
            </Card>
          </section>

          <section aria-labelledby="rec-video" style={{ marginTop: 24 }}>
            <p className="eyebrow" id="rec-video" style={{ margin: 0 }}>
              수업 영상
            </p>
            <Card>
              <VideoBox classId={classId} video={app?.video} />
              <NoteBox
                title="내 후기"
                note={app?.reflection}
                editable={Boolean(app?.video)}
                placeholder="영상을 다시 보고 적으세요. 계획과 달랐던 장면, 학생의 반응에서 알게 된 것, 다음에 바꿀 것."
                emptyText="수업 영상이 올라온 뒤에 후기를 쓸 수 있습니다."
                onSave={save('reflection')}
              />
              <NoteBox title="강의자의 수업 피드백" note={app?.videoFeedback} editable={false} emptyText="강의자가 수업을 보고 적으면 여기에 뜹니다." />
            </Card>
          </section>

          <section aria-labelledby="rec-peer" style={{ marginTop: 24 }}>
            <p className="eyebrow" id="rec-peer" style={{ margin: 0 }}>
              동료들이 내 수업에 적은 의견
            </p>
            <Card>
              <PeerList classId={classId} />
            </Card>
          </section>
        </>
      ) : null}

      <section aria-labelledby="rec-others" style={{ marginTop: 24 }}>
        <p className="eyebrow" id="rec-others" style={{ margin: 0 }}>
          다른 사람의 수업에 의견 남기기
        </p>
        <Card>
          <p className="text-body-sm" style={{ margin: 0 }}>
            수업을 들으면서 훌륭한 점과 개선점을 적으세요. 발표자에게는 이름 없이 전해지고, 강의자는 누가 적었는지 봅니다. 저장한 뒤에도 고칠 수 있습니다.
          </p>
          {others.length === 0 ? (
            <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.65 }}>
              아직 발표를 신청한 다른 사람이 없습니다.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 6 }}>
              {others.map((s) => {
                const mineOn = myPeer.find((p) => p.presenterUid === s.uid) ?? null
                return (
                  <li key={s.slotId}>
                    <details className="card" style={{ padding: '8px 12px' }}>
                      <summary className="text-body-sm" style={{ cursor: 'pointer' }}>
                        <span style={{ fontWeight: 480 }}>{slotLabel(s)}</span> · {s.name || s.nickname}
                        {s.topic ? <span style={{ opacity: 0.7 }}> · {s.topic}</span> : null}
                        {mineOn ? <span style={{ opacity: 0.6 }}> · 적음</span> : null}
                      </summary>
                      <PeerForm classId={classId} presenterUid={s.uid} mine={mineOn} />
                    </details>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </section>
    </div>
  )
}

/* ─────────────── 강사 화면 ─────────────── */

export function InstructorRecord({
  classId,
  courseId,
  slots,
  apps,
  nameOf,
  note,
}: {
  classId: string
  courseId: MtCourseId
  slots: MtSlot[]
  apps: Array<MtApplication & { uid: string }>
  nameOf: (uid: string) => string
  note: string | null
}) {
  const schedule = MT_SCHEDULE[courseId]
  const ordered = [...slots].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
  const appOf = (uid: string) => apps.find((a) => a.uid === uid) ?? null
  const who = (s: MtSlot) => (nameOf(s.uid) ? `${s.studentId} ${nameOf(s.uid)}` : `${s.studentId} ${s.name || s.nickname}`)
  const counts = {
    plan: ordered.filter((s) => appOf(s.uid)?.plan).length,
    planFb: ordered.filter((s) => appOf(s.uid)?.planFeedback?.text).length,
    video: ordered.filter((s) => appOf(s.uid)?.video).length,
    videoFb: ordered.filter((s) => appOf(s.uid)?.videoFeedback?.text).length,
    reflection: ordered.filter((s) => appOf(s.uid)?.reflection?.text).length,
  }

  return (
    <div>
      <ColorBlock tone="lime">
        <p className="eyebrow" style={{ margin: 0 }}>
          마이크로티칭 기록 · {schedule.title}
        </p>
        <p className="text-body" style={{ margin: '8px 0 0' }}>
          발표자 {ordered.length}명 · 지도안 {counts.plan} · 지도안 피드백 {counts.planFb} · 영상 {counts.video} · 수업 피드백 {counts.videoFb} · 학생 후기 {counts.reflection}
        </p>
        <Caption style={{ marginTop: 8 }}>발표자를 펼치면 지도안을 읽고 피드백을 적고, 수업 영상을 올리고, 동료 의견을 이름과 함께 봅니다. 학생은 자기 것만 보고, 동료 의견은 이름 없이 봅니다.</Caption>
      </ColorBlock>
      {note ? (
        <div style={{ marginTop: 12 }}>
          <Notice>{note}</Notice>
        </div>
      ) : null}
      {ordered.length === 0 ? (
        <p className="text-body" style={{ marginTop: 16, opacity: 0.7 }}>
          아직 발표를 신청한 학생이 없습니다.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'grid', gap: 8 }}>
          {ordered.map((s) => {
            const a = appOf(s.uid)
            const saveFor = (field: MtNoteField) => (text: string) => saveMtNote(classId, field, text, s.uid)
            return (
              <li key={s.slotId}>
                <details className="card" style={{ padding: '10px 14px' }}>
                  <summary className="text-body" style={{ cursor: 'pointer' }}>
                    <span style={{ fontWeight: 480 }}>{slotLabel(s)}</span> · {who(s)}
                    {s.topic ? <span style={{ opacity: 0.7 }}> · {s.topic}</span> : null}
                    <span className="text-body-sm" style={{ opacity: 0.6 }}>
                      {' '}
                      · {a?.plan ? '지도안 ○' : '지도안 ×'} · {a?.video ? '영상 ○' : '영상 ×'}
                    </span>
                  </summary>
                  <InstructorPanel classId={classId} slot={s} app={a} nameOf={nameOf} saveFor={saveFor} />
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function InstructorPanel({
  classId,
  slot,
  app,
  nameOf,
  saveFor,
}: {
  classId: string
  slot: MtSlot
  app: (MtApplication & { uid: string }) | null
  nameOf: (uid: string) => string
  saveFor: (field: MtNoteField) => (text: string) => Promise<{ ok: boolean; message?: string }>
}) {
  const detail = [slot.grade ? `${slot.grade}학년` : '', slot.unitTitle ?? '', (slot.methods ?? []).concat(slot.methodOther ? [slot.methodOther] : []).join(' · ')].filter(Boolean).join(' · ')
  return (
    <div style={{ marginTop: 8 }}>
      {detail ? (
        <p className="text-body-sm" style={{ margin: 0, opacity: 0.8 }}>
          {detail}
        </p>
      ) : null}
      <p className="eyebrow" style={{ margin: '12px 0 4px' }}>
        교수학습지도안
      </p>
      <PlanLine classId={classId} uid={slot.uid} plan={app?.plan} canView />
      <NoteBox
        title="지도안 피드백"
        note={app?.planFeedback}
        editable={Boolean(app?.plan)}
        placeholder="학생이 발표 전에 읽습니다. 고칠 곳과 그 이유, 잘 짠 곳을 적으세요."
        emptyText="학생이 지도안을 내면 피드백을 적을 수 있습니다."
        onSave={saveFor('planFeedback')}
      />
      <p className="eyebrow" style={{ margin: '20px 0 4px' }}>
        수업 영상
      </p>
      <VideoBox classId={classId} uid={slot.uid} video={app?.video} />
      <VideoUploadRow classId={classId} uid={slot.uid} hasVideo={Boolean(app?.video)} />
      <NoteBox title="학생의 후기" note={app?.reflection} editable={false} emptyText="학생이 영상을 보고 후기를 쓰면 여기에 뜹니다." />
      <NoteBox
        title="수업 피드백"
        note={app?.videoFeedback}
        editable={Boolean(app?.video)}
        placeholder="영상을 보고 적습니다. 학생이 자기 후기와 나란히 읽습니다."
        emptyText="영상을 올린 뒤에 수업 피드백을 적을 수 있습니다."
        onSave={saveFor('videoFeedback')}
      />
      <p className="eyebrow" style={{ margin: '20px 0 4px' }}>
        동료 의견
      </p>
      <PeerList classId={classId} presenterUid={slot.uid} nameOf={nameOf} />
    </div>
  )
}

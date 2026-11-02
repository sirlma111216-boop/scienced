import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MT_FEEDBACK_FIELDS,
  MT_NOTE_FIELDS,
  MT_NOTE_MAX,
  MT_ORDER_LABEL,
  MT_PEER_FIELDS,
  MT_PEER_FIELD_KEYS,
  MT_PEER_MAX,
  MT_REFLECTION_FIELDS,
  MT_SCHEDULE,
  MT_VIDEO_ACCEPT,
  mtDateLabel,
  type MtCourseId,
  type MtNoteField,
  type MtPeerField,
} from '@shared/microteaching'
import { fileSizeText } from '@shared/textbook'
import { checkMtVideo, mtFileUrl, mtPeerList, openMtFile, saveMtNote, saveMtPeer, uploadMtVideo } from '@/lib/microteaching-files'
import type { MtApplication, MtFileMeta, MtNote, MtPeerDoc, MtPeerView, MtSlot } from '@/lib/types'
import { Button, Caption, Card, ColorBlock, Notice } from '@/components/ui'

/**
 * 마이크로티칭 — 한 화면 (강의자 지시 2026-11-02).
 *
 *   왼쪽   발표 일정표 — 날짜마다 발표자 이름 단추와 [수업지도안] 단추. 지도안은 같은 반 누구나 내려받는다.
 *   오른쪽 이름을 누른 사람이 누구냐에 따라 셋 중 하나
 *     다른 사람의 이름    그 수업에 동료 의견 세 칸 — 좋았던 점 · 아쉬웠던 점 · 내가 이 수업을 한다면 → [저장]
 *     내 이름            네 묶음 — 내 수업의 모습(강사가 올린 영상) · 내 수업 성찰(잘된 점 · 잘못된 점) · 동료가 본 내 수업(익명) · 교수 피드백
 *     강사(클래스 관리)   수업 영상 저장(올리면 학생 화면에 바로 뜬다) · 피드백(잘된 점 · 개선할 점) — 아래에 학생의 성찰과 동료 의견(이름)을 읽기만
 *
 * 누가 무엇을 보는가 (서버 functions/api/_lib/microteaching.ts 와 규칙이 지킨다 — 화면은 그 결과를 그린다):
 *   지도안              같은 반 수강생 전부와 강사
 *   영상 · 성찰 · 피드백   발표한 본인과 강사
 *   동료 의견            쓴 사람은 자기 것 · 강사는 전부(이름) · 발표자는 익명 번호만
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

function Outcome({ msg }: { msg: { ok: boolean; text: string } | null }) {
  return msg ? (
    <p role={msg.ok ? 'status' : 'alert'} className="text-body-sm" style={{ margin: '6px 0 0', fontWeight: 480 }}>
      {msg.ok ? '✓ ' : '⚠ '}
      {msg.text}
    </p>
  ) : null
}

const slotLabel = (s: MtSlot) => `${mtDateLabel(s.date)} ${MT_ORDER_LABEL[s.order - 1] ?? `${s.order}번째`}`

/* ─────────────── 글 한 칸 — 성찰 · 피드백 ─────────────── */

function NoteBox({
  title,
  hint,
  note,
  editable,
  emptyText,
  onSave,
}: {
  title: string
  hint?: string
  note: MtNote | null | undefined
  editable: boolean
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
            placeholder={hint}
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
      <Outcome msg={msg} />
    </div>
  )
}

/* ─────────────── 수업지도안 — 내려받기 (같은 반 누구나) · 강사는 화면에서 보기 ─────────────── */

function PlanButton({ classId, uid, plan, canView }: { classId: string; uid: string; plan?: MtFileMeta | null; canView?: boolean }) {
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => setView(null), [plan?.key])
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
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Button
          variant="tertiary"
          disabled={busy}
          onClick={() => {
            setErr(null)
            setBusy(true)
            void openMtFile(classId, 'plan', uid).then((e) => {
              setBusy(false)
              if (e) setErr(e)
            })
          }}
        >
          수업지도안
        </Button>
        {plan ? (
          <Caption style={{ margin: 0 }}>
            {plan.name} ({fileSizeText(plan.size)} · {when(plan.at)})
          </Caption>
        ) : null}
        {canView && plan?.ext === 'pdf' ? (
          <Button variant="tertiary" disabled={busy} onClick={() => (view ? setView(null) : void open())}>
            {view ? '닫기' : '화면에서 보기'}
          </Button>
        ) : null}
      </div>
      {view ? <iframe title={`수업지도안 — ${plan?.name ?? ''}`} src={`${view}#toolbar=0`} style={{ width: '100%', height: '75vh', border: '1px solid var(--line, #ddd)', borderRadius: 8, marginTop: 8, background: '#fff' }} /> : null}
      <Problem text={err} />
    </div>
  )
}

/* ─────────────── 수업 영상 ─────────────── */

function VideoBox({ classId, uid, video, mine }: { classId: string; uid?: string; video: MtFileMeta | null | undefined; mine: boolean }) {
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
        {mine ? '강의자가 수업 영상을 올리면 여기에 뜹니다.' : '아직 올린 수업 영상이 없습니다.'}
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
    setMsg({ ok: true, text: `「${file.name}」을 올렸습니다. 학생의 「내 수업의 모습」에 바로 보입니다.` })
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
      <Outcome msg={msg} />
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
              {MT_PEER_FIELD_KEYS.map((k) =>
                c[k] ? (
                  <p key={k} style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                    <span style={{ fontWeight: 480 }}>{MT_PEER_FIELDS[k].label}</span> {c[k]}
                  </p>
                ) : null,
              )}
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

const emptyPeer = (): Record<MtPeerField, string> => ({ good: '', improve: '', ifMine: '' })
const peerTexts = (mine: MtPeerDoc | null): Record<MtPeerField, string> => ({ good: mine?.good ?? '', improve: mine?.improve ?? '', ifMine: mine?.ifMine ?? '' })

function PeerForm({ classId, presenterUid, mine }: { classId: string; presenterUid: string; mine: MtPeerDoc | null }) {
  const [texts, setTexts] = useState<Record<MtPeerField, string>>(() => (mine ? peerTexts(mine) : emptyPeer()))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const seen = useRef(mine?.at ?? 0)
  useEffect(() => {
    if ((mine?.at ?? 0) !== seen.current) {
      seen.current = mine?.at ?? 0
      setTexts(peerTexts(mine))
    }
  }, [mine])
  /* 사람을 바꾸면 칸도 그 사람 것으로 */
  useEffect(() => {
    seen.current = mine?.at ?? 0
    setTexts(mine ? peerTexts(mine) : emptyPeer())
    setMsg(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenterUid])
  const saved = peerTexts(mine)
  const dirty = MT_PEER_FIELD_KEYS.some((k) => texts[k].trim() !== saved[k])
  const anyText = MT_PEER_FIELD_KEYS.some((k) => texts[k].trim())
  async function save() {
    setBusy(true)
    setMsg(null)
    const r = await saveMtPeer(classId, presenterUid, texts)
    setBusy(false)
    if (!r.ok) {
      console.warn('[마이크로티칭] 동료 의견을 저장하지 못했다:', r.message)
      return setMsg({ ok: false, text: r.message ?? '저장하지 못했습니다.' })
    }
    setMsg({ ok: true, text: anyText ? SAVED : '지웠습니다.' })
  }
  return (
    <div>
      {MT_PEER_FIELD_KEYS.map((k) => (
        <label key={k} className="text-body-sm" style={{ display: 'block', marginTop: 12 }}>
          <span className="text-body" style={{ fontWeight: 480 }}>
            {MT_PEER_FIELDS[k].label}
          </span>
          <textarea
            className="input"
            value={texts[k]}
            maxLength={MT_PEER_MAX}
            rows={4}
            placeholder={MT_PEER_FIELDS[k].hint}
            style={{ width: '100%', marginTop: 4, resize: 'vertical' }}
            onChange={(e) => setTexts({ ...texts, [k]: e.target.value })}
          />
        </label>
      ))}
      <div className="flex items-center gap-xs" style={{ marginTop: 10, flexWrap: 'wrap' }}>
        <Button disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? '저장하는 중' : mine && !anyText ? '의견 지우기' : '저장'}
        </Button>
        {mine?.at ? <Caption style={{ margin: 0 }}>마지막 저장 {when(mine.at)}</Caption> : null}
      </div>
      <Outcome msg={msg} />
    </div>
  )
}

/* ─────────────── 오른쪽 — 누구를 눌렀나 ─────────────── */

function PanelHead({ slot, who, children }: { slot: MtSlot; who: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow" style={{ margin: 0 }}>
        {slotLabel(slot)}
      </p>
      <h2 className="text-headline" id="mt-panel-title" tabIndex={-1} style={{ margin: '4px 0 0', outline: 'none' }}>
        {who}
        {slot.topic ? <span style={{ fontWeight: 400 }}> · {slot.topic}</span> : null}
      </h2>
      {children}
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} style={{ marginTop: 20 }}>
      <p className="eyebrow" id={id} style={{ margin: '0 0 4px' }}>
        {title}
      </p>
      <Card>{children}</Card>
    </section>
  )
}

/** 다른 사람의 수업 — 동료 의견 세 칸 */
function PeerPanel({ classId, slot, who, mine }: { classId: string; slot: MtSlot; who: string; mine: MtPeerDoc | null }) {
  return (
    <div>
      <PanelHead slot={slot} who={who}>
        <div style={{ marginTop: 8 }}>
          <PlanButton classId={classId} uid={slot.uid} />
        </div>
      </PanelHead>
      <Section id="mt-peer-form" title="이 수업에 의견 남기기">
        <p className="text-body-sm" style={{ margin: 0 }}>
          발표자에게는 이름 없이 전해지고, 강의자는 누가 적었는지 봅니다. 저장한 뒤에도 고칠 수 있습니다.
        </p>
        <PeerForm classId={classId} presenterUid={slot.uid} mine={mine} />
      </Section>
    </div>
  )
}

/** 내 수업 — 네 묶음 */
function SelfPanel({ classId, slot, app }: { classId: string; slot: MtSlot; app: MtApplication | null }) {
  const save = (field: MtNoteField) => (text: string) => saveMtNote(classId, field, text)
  return (
    <div>
      <PanelHead slot={slot} who="내 수업">
        <div style={{ marginTop: 8 }}>
          <PlanButton classId={classId} uid={slot.uid} plan={app?.plan} />
          <Caption>지도안을 내거나 바꾸는 곳은 「발표 신청」 화면의 수업계획안 칸입니다.</Caption>
        </div>
      </PanelHead>
      <Section id="mt-self-video" title="내 수업의 모습">
        <VideoBox classId={classId} video={app?.video} mine />
      </Section>
      <Section id="mt-self-reflection" title="내 수업 성찰">
        <p className="text-body-sm" style={{ margin: 0 }}>
          수업을 마친 뒤 적고 저장하세요. 강의자가 읽고 피드백을 적습니다.
        </p>
        {MT_REFLECTION_FIELDS.map((f) => (
          <NoteBox key={f} title={MT_NOTE_FIELDS[f].label} hint={MT_NOTE_FIELDS[f].hint} note={app?.[f]} editable emptyText="" onSave={save(f)} />
        ))}
      </Section>
      <Section id="mt-self-peer" title="동료가 본 내 수업">
        <PeerList classId={classId} />
      </Section>
      <Section id="mt-self-feedback" title="교수 피드백">
        {MT_FEEDBACK_FIELDS.map((f) => (
          <NoteBox key={f} title={MT_NOTE_FIELDS[f].label} note={app?.[f]} editable={false} emptyText="강의자가 적으면 여기에 뜹니다." />
        ))}
      </Section>
    </div>
  )
}

/** 강사 — 영상 저장 · 피드백 두 칸, 아래에 학생의 성찰과 동료 의견(이름) */
function InstructorPanel({ classId, slot, who, app, nameOf }: { classId: string; slot: MtSlot; who: string; app: MtApplication | null; nameOf: (uid: string) => string }) {
  const save = (field: MtNoteField) => (text: string) => saveMtNote(classId, field, text, slot.uid)
  return (
    <div>
      <PanelHead slot={slot} who={who}>
        <div style={{ marginTop: 8 }}>
          <PlanButton classId={classId} uid={slot.uid} plan={app?.plan} canView />
          {app?.plan && app.plan.ext !== 'pdf' ? <Caption>한글 · 워드 파일은 내려받아 봅니다. 화면에서 바로 보려면 PDF 로 내도록 안내하세요.</Caption> : null}
        </div>
      </PanelHead>
      <Section id="mt-inst-video" title="수업 영상 저장">
        <VideoBox classId={classId} uid={slot.uid} video={app?.video} mine={false} />
        <VideoUploadRow classId={classId} uid={slot.uid} hasVideo={Boolean(app?.video)} />
      </Section>
      <Section id="mt-inst-feedback" title="피드백">
        {MT_FEEDBACK_FIELDS.map((f) => (
          <NoteBox key={f} title={MT_NOTE_FIELDS[f].label} hint={MT_NOTE_FIELDS[f].hint} note={app?.[f]} editable emptyText="" onSave={save(f)} />
        ))}
      </Section>
      <Section id="mt-inst-reflection" title="학생의 성찰">
        {MT_REFLECTION_FIELDS.map((f) => (
          <NoteBox key={f} title={MT_NOTE_FIELDS[f].label} note={app?.[f]} editable={false} emptyText="학생이 수업 뒤에 적으면 여기에 뜹니다." />
        ))}
      </Section>
      <Section id="mt-inst-peer" title="동료 의견">
        <PeerList classId={classId} presenterUid={slot.uid} nameOf={nameOf} />
      </Section>
    </div>
  )
}

/* ─────────────── 판 전체 ─────────────── */

export function MtBoard({
  classId,
  courseId,
  uid,
  admin,
  slots,
  apps,
  myPeer,
  nameOf,
  note,
  selectedUid,
  onSelect,
  onGoApply,
}: {
  classId: string
  courseId: MtCourseId
  /** 보는 사람 */
  uid: string
  /** 강사의 클래스 관리 탭 */
  admin: boolean
  slots: MtSlot[]
  /** 학생은 내 신청 기록 하나, 강사는 전부 */
  apps: Array<MtApplication & { uid: string }>
  /** 내가 다른 사람 수업에 적은 의견 */
  myPeer: MtPeerDoc[]
  /** 강사만 실명 — 학생은 자리 문서의 이름 */
  nameOf: (uid: string) => string
  note: string | null
  selectedUid: string | null
  onSelect: (uid: string | null) => void
  onGoApply: () => void
}) {
  const schedule = MT_SCHEDULE[courseId]
  const ordered = [...slots].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
  const appOf = (u: string) => apps.find((a) => a.uid === u) ?? null
  const who = (s: MtSlot) => (admin ? `${s.studentId} ${nameOf(s.uid) || s.name || s.nickname}` : s.name || s.nickname)
  const mine = admin ? null : (ordered.find((s) => s.uid === uid) ?? null)
  const selected = selectedUid ? (ordered.find((s) => s.uid === selectedUid) ?? null) : null
  const panel = useRef<HTMLDivElement | null>(null)

  /* 이름을 누르면 오른쪽 판으로 — 좁은 화면에서는 판이 아래에 있어 보이도록 옮긴다 */
  const pick = (u: string) => {
    onSelect(u)
    window.setTimeout(() => {
      const h = panel.current?.querySelector<HTMLElement>('#mt-panel-title')
      if (window.matchMedia('(max-width: 767px)').matches) panel.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      h?.focus({ preventScroll: true })
    }, 0)
  }

  const byDate = schedule.days.map((d) => ({ ...d, rows: Array.from({ length: d.count }, (_, i) => ordered.find((s) => s.date === d.date && s.order === i + 1) ?? null) }))
  const counts = admin
    ? { plan: ordered.filter((s) => appOf(s.uid)?.plan).length, video: ordered.filter((s) => appOf(s.uid)?.video).length, fb: ordered.filter((s) => appOf(s.uid)?.feedbackGood?.text || appOf(s.uid)?.feedbackImprove?.text).length }
    : null

  return (
    <div>
      <ColorBlock tone="lime">
        <p className="eyebrow" style={{ margin: 0 }}>
          마이크로티칭 · {schedule.title}
        </p>
        <p className="text-body" style={{ margin: '8px 0 0' }}>
          {counts ? `발표자 ${ordered.length}명 · 지도안 ${counts.plan} · 영상 ${counts.video} · 피드백 ${counts.fb}` : schedule.minutes}
        </p>
        <Caption style={{ marginTop: 8 }}>
          {admin
            ? '발표자 이름을 누르면 수업 영상을 올리고 피드백을 적습니다. [수업지도안]은 그 사람이 낸 지도안을 내려받습니다.'
            : '발표자 이름을 누르면 그 수업에 의견을 적습니다. 내 이름을 누르면 내 수업 영상 · 성찰 · 동료 의견 · 교수 피드백이 보입니다. [수업지도안]은 누구 것이든 내려받습니다.'}
        </Caption>
      </ColorBlock>
      {note ? (
        <div style={{ marginTop: 12 }}>
          <Notice>{note}</Notice>
        </div>
      ) : null}
      {!admin && !mine ? (
        <div style={{ marginTop: 12 }}>
          <Notice tone="cream">
            <p className="text-body-sm" style={{ margin: 0 }}>
              아직 발표 자리를 신청하지 않았습니다. 자리를 신청하면 이 일정표에 내 이름이 생깁니다.{' '}
              <Button variant="tertiary" onClick={onGoApply}>
                발표 신청으로 가기
              </Button>
            </p>
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-lg md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]" style={{ marginTop: 24, alignItems: 'start' }}>
        <nav aria-label="발표 일정표">
          {byDate.map((d) => (
            <div key={d.date} style={{ marginBottom: 16 }}>
              <p className="text-body-sm" style={{ margin: '0 0 6px', fontWeight: 480 }}>
                {mtDateLabel(d.date)}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                {d.rows.map((s, i) =>
                  s ? (
                    <li key={s.slotId} className="card" style={{ padding: '8px 12px' }}>
                      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="tab"
                          data-selected={s.uid === selectedUid ? 'true' : undefined}
                          aria-pressed={s.uid === selectedUid}
                          onClick={() => pick(s.uid)}
                          style={{ fontSize: 15 }}
                        >
                          {i + 1}. {who(s)}
                          {s.uid === uid ? ' (나)' : ''}
                        </button>
                        <PlanButton classId={classId} uid={s.uid} />
                      </div>
                      <p className="text-body-sm" style={{ margin: '4px 0 0', opacity: 0.75 }}>
                        {s.topic ? s.topic : '주제 미정'}
                        {!admin && myPeer.some((p) => p.presenterUid === s.uid) ? ' · 의견 적음' : ''}
                        {admin && appOf(s.uid)?.video ? ' · 영상 ○' : ''}
                      </p>
                    </li>
                  ) : (
                    <li key={`${d.date}_${i + 1}`} className="text-body-sm" style={{ padding: '4px 12px', opacity: 0.55 }}>
                      {i + 1}. 비어 있음
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </nav>

        <div ref={panel}>
          {!selected ? (
            <Card>
              <p className="text-body" style={{ margin: 0 }}>
                {admin ? '왼쪽 일정표에서 발표자 이름을 누르세요.' : mine ? '왼쪽 일정표에서 이름을 누르세요. 다른 사람은 의견을 적는 칸이, 내 이름은 내 수업 기록이 열립니다.' : '왼쪽 일정표에서 발표자 이름을 누르면 그 수업에 의견을 적는 칸이 열립니다.'}
              </p>
            </Card>
          ) : admin ? (
            <InstructorPanel classId={classId} slot={selected} who={who(selected)} app={appOf(selected.uid)} nameOf={nameOf} />
          ) : selected.uid === uid ? (
            <SelfPanel classId={classId} slot={selected} app={appOf(uid)} />
          ) : (
            <PeerPanel classId={classId} slot={selected} who={who(selected)} mine={myPeer.find((p) => p.presenterUid === selected.uid) ?? null} />
          )}
        </div>
      </div>
    </div>
  )
}

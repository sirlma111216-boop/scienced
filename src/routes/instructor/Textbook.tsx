import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  TEXTBOOK_DESCRIPTION_MAX,
  TEXTBOOK_GRADES,
  TEXTBOOK_MAX_MB_DEFAULT,
  TEXTBOOK_TITLE_MAX,
  TEXTBOOK_UNITS,
  fileSizeText,
  gradeLabel,
  gradeLongLabel,
  sortTextbooks,
  unitOf,
  type TextbookDoc,
  type TextbookGrade,
} from '@shared/textbook'
import { useAuth } from '@/lib/auth'
import {
  checkPdfFile,
  deleteTextbook,
  reorderTextbooks,
  saveTextbook,
  setTextbookPublished,
  textbookConfig,
  textbookReadUrl,
  uploadTextbookPdf,
} from '@/lib/textbook'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, Card, ColorBlock, Notice, ScrollX } from '@/components/ui'

/**
 * 교과서 보기 관리 — 강사만 (강의자 지시 2026-10-14).
 *
 * 학년 → 단원 → 소단원 나무로 들어가 소단원(목차)을 만들고, 소단원마다 PDF 한 개를 붙인다.
 *   · 학년 · 단원은 shared/textbook.ts 의 목록이다(1·2학년 2022 개정, 3학년 2015 개정). 소단원은 강사가 적는다.
 *   · 쓰기는 전부 서버 함수가 강사를 확인한 뒤에 한다 — 이 화면은 요청만 보낸다. 메뉴를 숨기는 것으로 권한을 끝내지 않는다.
 *   · 새 소단원은 비공개로 만들어진다. PDF 가 붙어야 공개할 수 있다 — 올리다 실패한 소단원이 학생에게 보이지 않는다.
 *   · PDF 를 바꿔도 소단원 id 와 학생 화면 주소는 그대로다. 새 파일이 연결된 뒤에 옛 파일을 지운다.
 */
export function InstructorTextbook() {
  const { repo, isInstructor } = useAuth()
  const [list, setList] = useState<TextbookDoc[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [maxBytes, setMaxBytes] = useState(TEXTBOOK_MAX_MB_DEFAULT * 1024 * 1024)
  const [storageNote, setStorageNote] = useState<string | null>(null)
  const [grade, setGrade] = useState<TextbookGrade>(1)
  const [unitId, setUnitId] = useState<string>(TEXTBOOK_UNITS[0].id)
  const [search, setSearch] = useState('')
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  /* 강사가 끌어 옮기는 동안 서버 순서 대신 보일 순서 */
  const [localOrder, setLocalOrder] = useState<string[] | null>(null)

  useEffect(() => {
    if (!repo || !isInstructor) return
    return repo.watchTextbooks(
      { publishedOnly: false },
      (l) => {
        setList(l)
        setLoaded(true)
        setLoadError(null)
      },
      (m) => {
        setLoadError(m)
        setLoaded(true)
      },
    )
  }, [repo, isInstructor])

  useEffect(() => {
    if (!isInstructor || repo?.mode === 'local') return
    void textbookConfig().then((c) => {
      if (!c.ok) {
        setStorageNote(c.message ?? '서버 설정을 읽지 못했습니다.')
        return
      }
      if (c.maxBytes) setMaxBytes(c.maxBytes)
      if (!c.storageReady || !c.readReady) setStorageNote('교재 저장소 연결이 아직 끝나지 않았습니다. 목차는 만들 수 있지만 PDF 는 연결이 끝난 뒤에 올릴 수 있습니다.')
    })
  }, [isInstructor, repo?.mode])

  const units = TEXTBOOK_UNITS.filter((u) => u.grade === grade)
  const unit = unitOf(unitId) ?? units[0]
  const inUnit = useMemo(() => {
    const items = sortTextbooks(list.filter((d) => d.unitId === unit.id))
    if (!localOrder) return items
    const byId = new Map(items.map((d) => [d.id, d]))
    const ordered = localOrder.map((id) => byId.get(id)).filter((d): d is TextbookDoc => Boolean(d))
    return ordered.length === items.length ? ordered : items
  }, [list, unit.id, localOrder])
  const q = search.trim()
  const found = q ? sortTextbooks(list.filter((d) => d.title.includes(q) || d.description.includes(q))) : []

  if (!isInstructor) return <Navigate to="/" replace />

  const say = (tone: 'ok' | 'err', text: string) => setNote({ tone, text })

  function pickGrade(g: TextbookGrade) {
    setGrade(g)
    setUnitId(TEXTBOOK_UNITS.find((u) => u.grade === g)!.id)
    setLocalOrder(null)
  }

  async function move(ids: string[]) {
    setLocalOrder(ids)
    const r = await reorderTextbooks(unit.id, ids)
    if (!r.ok) say('err', r.message ?? '순서를 저장하지 못했습니다.')
    else say('ok', '순서를 저장했습니다.')
    setLocalOrder(null)
  }

  return (
    <AppShell title="교과서 보기 관리">
      <div>
        <p className="eyebrow" style={{ margin: 0 }}>
          강사
        </p>
        <h1 className="text-display-lg" style={{ margin: '8px 0 0' }}>
          교과서 보기 관리
        </h1>
        <p className="text-body" style={{ marginTop: 12, maxWidth: 720 }}>
          학년 → 단원 → 소단원으로 들어가 소단원마다 PDF 한 개를 붙입니다. 새 소단원은 비공개로 만들어지고, PDF 를 올린 뒤에 공개할 수 있습니다. 학생 화면은 「교과서」 메뉴에서 같은 나무로 보입니다.
        </p>

        {repo?.mode === 'local' ? (
          <div style={{ marginTop: 16 }}>
            <Notice tone="cream">
              <p className="text-body-sm" style={{ margin: 0 }}>
                로컬 저장 모드에서는 교과서를 관리할 수 없습니다. PDF 는 서버의 저장소에 들어갑니다 — 배포된 사이트에서 여세요.
              </p>
            </Notice>
          </div>
        ) : null}
        {storageNote ? (
          <div style={{ marginTop: 16 }}>
            <Notice tone="cream">
              <p className="text-body-sm" style={{ margin: 0 }}>
                {storageNote}
              </p>
            </Notice>
          </div>
        ) : null}
        {loadError ? (
          <p role="alert" className="text-body-sm" style={{ marginTop: 16, fontWeight: 480 }}>
            ⚠ {loadError}
          </p>
        ) : null}
        {note ? (
          <p role="status" className="text-body-sm" style={{ marginTop: 16, fontWeight: 480 }}>
            {note.tone === 'err' ? '⚠ ' : '✓ '}
            {note.text}
          </p>
        ) : null}

        {/* 찾기 — 나무 전체에서 소단원 제목 · 설명 */}
        <div className="flex items-center gap-xs" style={{ marginTop: 24, flexWrap: 'wrap' }}>
          <label htmlFor="tb-search" className="text-body-sm" style={{ fontWeight: 480 }}>
            소단원 찾기
          </label>
          <input id="tb-search" className="field" style={{ maxWidth: 320 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="제목으로 찾기" />
          {q ? <Caption>{found.length}개</Caption> : null}
        </div>
        {q ? (
          <div style={{ marginTop: 8 }}>
          <Card>
            {found.length === 0 ? (
              <p className="text-body-sm" style={{ margin: 0 }}>
                「{q}」가 들어간 소단원이 없습니다.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                {found.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        setGrade(d.grade)
                        setUnitId(d.unitId)
                        setSearch('')
                      }}
                    >
                      {gradeLabel(d.grade)} › {unitOf(d.unitId)?.title} › {d.title}
                    </button>{' '}
                    <Badge solid={d.published}>{d.published ? '공개' : '비공개'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          </div>
        ) : null}

        {/* 나무 — 학년 */}
        <div role="tablist" aria-label="학년" className="flex gap-xs" style={{ marginTop: 24, flexWrap: 'wrap' }}>
          {TEXTBOOK_GRADES.map((g) => (
            <button key={g} type="button" role="tab" aria-selected={g === grade} className={g === grade ? 'btn-primary' : 'btn-secondary'} onClick={() => pickGrade(g)}>
              {gradeLongLabel(g)} · {list.filter((d) => d.grade === g).length}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) 1fr', gap: 24, marginTop: 16 }} className="tb-tree">
          {/* 나무 — 단원 */}
          <nav aria-label={`${gradeLabel(grade)} 단원`}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
              {units.map((u, i) => {
                const n = list.filter((d) => d.unitId === u.id)
                const on = u.id === unit.id
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => {
                        setUnitId(u.id)
                        setLocalOrder(null)
                      }}
                      className="text-body-sm"
                      style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 10, border: on ? '2px solid #000' : '1px solid #e5e5e5', background: on ? '#f3f0e6' : '#fff', cursor: 'pointer' }}
                    >
                      {i + 1}. {u.title}
                      <span style={{ float: 'right', opacity: 0.7 }}>
                        {n.filter((d) => d.published).length}/{n.length}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <Caption>숫자는 공개 / 전체 소단원입니다.</Caption>
          </nav>

          {/* 나무 — 소단원 */}
          <section aria-labelledby="tb-unit-title">
            <p className="eyebrow" style={{ margin: 0 }}>
              {gradeLongLabel(grade)}
            </p>
            <h2 id="tb-unit-title" className="text-headline" style={{ margin: '4px 0 0' }}>
              {unit.title}
            </h2>

            {!loaded ? (
              <p className="text-body-sm" style={{ marginTop: 16 }} role="status">
                목차를 불러오는 중입니다.
              </p>
            ) : inUnit.length === 0 ? (
              <div style={{ marginTop: 16 }}>
              <Card>
                <p className="text-body" style={{ margin: 0 }}>
                  이 단원에는 아직 소단원이 없습니다. 아래 「소단원 추가」에서 제목을 적고 PDF 를 올리세요.
                </p>
              </Card>
              </div>
            ) : (
              <UnitTable items={inUnit} maxBytes={maxBytes} onMove={move} say={say} />
            )}

            <AddForm key={unit.id} unitId={unit.id} unitTitle={unit.title} maxBytes={maxBytes} disabled={repo?.mode === 'local'} say={say} />
          </section>
        </div>
      </div>
    </AppShell>
  )
}

const fmtDate = (ms: number) => {
  if (!ms) return '—'
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 비공개도 볼 수 있는 미리보기 — 창을 먼저 열고 주소를 받아 넣는다(팝업 막힘 방지) */
async function preview(id: string, say: (t: 'ok' | 'err', m: string) => void) {
  const w = window.open('', '_blank')
  const r = await textbookReadUrl(id)
  if (!r.ok || !r.url) {
    w?.close()
    say('err', r.message ?? '미리보기를 열지 못했습니다.')
    return
  }
  if (w) w.location.href = r.url
  else window.location.href = r.url
}

function UnitTable({ items, maxBytes, onMove, say }: { items: TextbookDoc[]; maxBytes: number; onMove: (ids: string[]) => void; say: (t: 'ok' | 'err', m: string) => void }) {
  const [dragId, setDragId] = useState<string | null>(null)
  const ids = items.map((d) => d.id)
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= ids.length) return
    const next = [...ids]
    ;[next[i], next[j]] = [next[j], next[i]]
    onMove(next)
  }
  return (
    <ScrollX>
      <table className="text-body-sm" style={{ marginTop: 16, borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
        <thead>
          <tr>
            {['순서', '소단원', 'PDF', '크기', '공개', '수정일', ''].map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((d, i) => (
            <Row
              key={d.id}
              d={d}
              index={i}
              maxBytes={maxBytes}
              dragging={dragId === d.id}
              onDragStart={() => setDragId(d.id)}
              onDragEnd={() => setDragId(null)}
              onDropHere={() => {
                if (!dragId || dragId === d.id) return
                const next = ids.filter((x) => x !== dragId)
                next.splice(next.indexOf(d.id) + (ids.indexOf(dragId) < i ? 1 : 0), 0, dragId)
                setDragId(null)
                onMove(next)
              }}
              onUp={() => swap(i, i - 1)}
              onDown={() => swap(i, i + 1)}
              first={i === 0}
              last={i === items.length - 1}
              say={say}
            />
          ))}
        </tbody>
      </table>
      <Caption>줄을 끌어 놓거나 ↑ ↓ 로 순서를 바꿉니다. 순서는 바로 저장됩니다.</Caption>
    </ScrollX>
  )
}

function Row({
  d,
  index,
  maxBytes,
  dragging,
  onDragStart,
  onDragEnd,
  onDropHere,
  onUp,
  onDown,
  first,
  last,
  say,
}: {
  d: TextbookDoc
  index: number
  maxBytes: number
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDropHere: () => void
  onUp: () => void
  onDown: () => void
  first: boolean
  last: boolean
  say: (t: 'ok' | 'err', m: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [title, setTitle] = useState(d.title)
  const [description, setDescription] = useState(d.description)
  const [busy, setBusy] = useState(false)

  async function saveEdit() {
    setBusy(true)
    const r = await saveTextbook({ id: d.id, title, description })
    setBusy(false)
    if (!r.ok) return say('err', r.message ?? '저장하지 못했습니다.')
    setEditing(false)
    say('ok', `「${title}」을 고쳤습니다.`)
  }
  async function togglePublish() {
    setBusy(true)
    const r = await setTextbookPublished(d.id, !d.published)
    setBusy(false)
    if (!r.ok) return say('err', r.message ?? '바꾸지 못했습니다.')
    say('ok', `「${d.title}」을 ${d.published ? '비공개로' : '공개로'} 바꿨습니다.`)
  }
  async function remove() {
    if (!window.confirm(`소단원 「${d.title}」을 지웁니다.\n붙어 있는 PDF 도 함께 지워지고 되돌릴 수 없습니다. 지울까요?`)) return
    setBusy(true)
    const r = await deleteTextbook(d.id)
    setBusy(false)
    if (!r.ok) return say('err', r.message ?? '지우지 못했습니다.')
    say('ok', `「${d.title}」을 지웠습니다.${r.warnings?.length ? ` ${r.warnings.join(' ')}` : ''}`)
  }

  return (
    <>
      <tr
        draggable={!editing && !replacing}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          onDragStart()
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          onDropHere()
        }}
        style={{ opacity: dragging ? 0.4 : 1 }}
      >
        <td style={td}>
          <span aria-hidden="true" style={{ cursor: 'grab', marginRight: 6 }}>
            ⠿
          </span>
          {index + 1}
          <span className="flex gap-xxs" style={{ display: 'inline-flex', marginLeft: 6 }}>
            <button type="button" className="btn-tertiary" style={mini} disabled={first} onClick={onUp} aria-label={`「${d.title}」 위로`}>
              ↑
            </button>
            <button type="button" className="btn-tertiary" style={mini} disabled={last} onClick={onDown} aria-label={`「${d.title}」 아래로`}>
              ↓
            </button>
          </span>
        </td>
        <td style={{ ...td, whiteSpace: 'normal' }}>
          <span style={{ fontWeight: 480 }}>{d.title}</span>
          {d.description ? (
            <span className="text-body-sm" style={{ display: 'block', opacity: 0.72 }}>
              {d.description}
            </span>
          ) : null}
        </td>
        <td style={{ ...td, whiteSpace: 'normal', maxWidth: 200 }}>{d.originalFileName ?? <span style={{ opacity: 0.6 }}>PDF 없음</span>}</td>
        <td style={td}>{fileSizeText(d.fileSize)}</td>
        <td style={td}>
          <Badge solid={d.published}>{d.published ? '공개' : '비공개'}</Badge>{' '}
          <button type="button" className="btn-tertiary" style={mini} disabled={busy || (!d.published && !d.objectKey)} onClick={() => void togglePublish()} title={!d.objectKey ? 'PDF 를 올린 뒤에 공개할 수 있습니다' : undefined}>
            {d.published ? '비공개로' : '공개'}
          </button>
        </td>
        <td style={td}>{fmtDate(d.updatedAt)}</td>
        <td style={td}>
          <span className="flex gap-xxs" style={{ display: 'inline-flex', flexWrap: 'wrap' }}>
            <button type="button" className="btn-tertiary" style={mini} disabled={!d.objectKey} onClick={() => void preview(d.id, say)}>
              미리보기
            </button>
            <button type="button" className="btn-tertiary" style={mini} onClick={() => setEditing((v) => !v)}>
              수정
            </button>
            <button type="button" className="btn-tertiary" style={mini} onClick={() => setReplacing((v) => !v)}>
              {d.objectKey ? 'PDF 교체' : 'PDF 올리기'}
            </button>
            <button type="button" className="btn-tertiary" style={mini} disabled={busy} onClick={() => void remove()}>
              삭제
            </button>
          </span>
        </td>
      </tr>
      {editing ? (
        <tr>
          <td colSpan={7} style={{ ...td, whiteSpace: 'normal', background: '#faf8f2' }}>
            <TitleFields title={title} description={description} setTitle={setTitle} setDescription={setDescription} idPrefix={`edit-${d.id}`} />
            <div className="flex gap-xs" style={{ marginTop: 8 }}>
              <Button disabled={busy || !title.trim()} onClick={() => void saveEdit()}>
                저장
              </Button>
              <Button
                variant="tertiary"
                onClick={() => {
                  setEditing(false)
                  setTitle(d.title)
                  setDescription(d.description)
                }}
              >
                취소
              </Button>
            </div>
          </td>
        </tr>
      ) : null}
      {replacing ? (
        <tr>
          <td colSpan={7} style={{ ...td, whiteSpace: 'normal', background: '#faf8f2' }}>
            <p className="text-body-sm" style={{ margin: '0 0 8px' }}>
              {d.objectKey ? '새 PDF 가 다 올라가 연결된 뒤에 지금 파일이 지워집니다. 중간에 실패하면 지금 교재가 그대로 남습니다. 소단원 주소는 바뀌지 않습니다.' : '이 소단원에 붙일 PDF 를 고르세요.'}
            </p>
            <PdfUpload
              maxBytes={maxBytes}
              onUpload={async (file, onProgress) => {
                const r = await uploadTextbookPdf(d.id, file, onProgress)
                if (r.ok) {
                  say('ok', `「${d.title}」의 PDF 를 ${d.objectKey ? '바꿨습니다' : '올렸습니다'}.${r.warnings?.length ? ` ${r.warnings.join(' ')}` : ''}`)
                  setReplacing(false)
                }
                return r
              }}
            />
          </td>
        </tr>
      ) : null}
    </>
  )
}

function TitleFields({ title, description, setTitle, setDescription, idPrefix }: { title: string; description: string; setTitle: (v: string) => void; setDescription: (v: string) => void; idPrefix: string }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <label htmlFor={`${idPrefix}-title`} className="text-body-sm" style={{ fontWeight: 480 }}>
        소단원 제목 <span className="font-mono text-caption">필수</span>
      </label>
      <input id={`${idPrefix}-title`} className="field" value={title} maxLength={TEXTBOOK_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="예: 1. 생물을 이루는 세포" />
      <label htmlFor={`${idPrefix}-desc`} className="text-body-sm" style={{ fontWeight: 480 }}>
        간단한 설명 <span className="text-caption">선택</span>
      </label>
      <textarea id={`${idPrefix}-desc`} className="field" rows={2} value={description} maxLength={TEXTBOOK_DESCRIPTION_MAX} onChange={(e) => setDescription(e.target.value)} />
    </div>
  )
}

type UploadResult = { ok: boolean; message?: string }

/** PDF 고르기 — 파일 선택 · 끌어 놓기 · 진행률 · 성공/실패. onUpload 가 서버에 올린다 */
function PdfUpload({ maxBytes, onUpload, file: controlled, onPick }: { maxBytes: number; onUpload?: (file: File, onProgress: (sent: number, total: number) => void) => Promise<UploadResult>; file?: File | null; onPick?: (f: File | null) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement | null>(null)
  const current = controlled !== undefined ? controlled : file

  async function pick(f: File | null) {
    setError(null)
    setDone(false)
    if (!f) {
      setFile(null)
      onPick?.(null)
      return
    }
    const problem = await checkPdfFile(f, maxBytes)
    if (problem) {
      setError(problem)
      setFile(null)
      onPick?.(null)
      return
    }
    setFile(f)
    onPick?.(f)
  }

  async function send() {
    if (!current || !onUpload) return
    setProgress(0)
    setError(null)
    const r = await onUpload(current, (s, t) => setProgress(Math.round((s / t) * 100)))
    setProgress(null)
    if (!r.ok) setError(r.message ?? '올리지 못했습니다.')
    else {
      setDone(true)
      setFile(null)
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void pick(e.dataTransfer.files?.[0] ?? null)
        }}
        style={{ border: `2px dashed ${over ? '#000' : '#bbb'}`, borderRadius: 12, padding: 16, background: over ? '#f3f0e6' : '#fff' }}
      >
        <p className="text-body-sm" style={{ margin: 0 }}>
          PDF 를 여기에 끌어 놓거나{' '}
          <button type="button" className="text-link" onClick={() => input.current?.click()}>
            파일 고르기
          </button>
          . {Math.round(maxBytes / 1024 / 1024)} MB 까지 올릴 수 있습니다.
        </p>
        <input ref={input} type="file" accept="application/pdf,.pdf" style={{ display: 'none' }} onChange={(e) => void pick(e.target.files?.[0] ?? null)} />
        {current ? (
          <p className="text-body-sm" style={{ margin: '8px 0 0', fontWeight: 480 }}>
            {current.name} · {fileSizeText(current.size)}
          </p>
        ) : null}
      </div>
      {progress !== null ? (
        <div style={{ marginTop: 8 }} role="status" aria-live="polite">
          <div style={{ height: 8, borderRadius: 4, background: '#eee', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#000' }} />
          </div>
          <Caption>{progress < 100 ? `올리는 중 ${progress}%` : '서버가 파일을 확인하는 중'}</Caption>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-body-sm" style={{ margin: '8px 0 0', fontWeight: 480 }}>
          ⚠ {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="text-body-sm" style={{ margin: '8px 0 0', fontWeight: 480 }}>
          ✓ 올렸습니다.
        </p>
      ) : null}
      {onUpload ? (
        <div style={{ marginTop: 8 }}>
          <Button disabled={!current || progress !== null} onClick={() => void send()}>
            {progress !== null ? '올리는 중' : '이 PDF 올리기'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/** 소단원 추가 — 제목 · 설명 · PDF. 목차를 먼저 비공개로 만들고 PDF 를 붙인다. PDF 가 실패해도 비공개 목차만 남는다 */
function AddForm({ unitId, unitTitle, maxBytes, disabled, say }: { unitId: string; unitTitle: string; maxBytes: number; disabled: boolean; say: (t: 'ok' | 'err', m: string) => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reset, setReset] = useState(0)

  async function submit() {
    setBusy(true)
    setError(null)
    const made = await saveTextbook({ unitId, title, description })
    if (!made.ok || !made.textbook) {
      setBusy(false)
      setError(made.message ?? '소단원을 만들지 못했습니다.')
      return
    }
    if (file) {
      setProgress(0)
      const up = await uploadTextbookPdf(made.textbook.id, file, (s, t) => setProgress(Math.round((s / t) * 100)))
      setProgress(null)
      if (!up.ok) {
        setBusy(false)
        setError(`소단원은 비공개로 만들었지만 PDF 를 올리지 못했습니다 — ${up.message ?? ''} 목록의 「PDF 올리기」로 다시 올리세요.`)
        setTitle('')
        setDescription('')
        setFile(null)
        setReset((n) => n + 1)
        return
      }
    }
    setBusy(false)
    say('ok', `「${title}」을 비공개로 만들었습니다.${file ? ' 공개를 누르면 학생에게 보입니다.' : ' PDF 를 올린 뒤에 공개할 수 있습니다.'}`)
    setTitle('')
    setDescription('')
    setFile(null)
    setReset((n) => n + 1)
  }

  return (
    <div style={{ marginTop: 32 }}>
    <ColorBlock tone="cream">
      <p className="eyebrow" style={{ margin: 0 }}>
        소단원 추가 · {unitTitle}
      </p>
      <div style={{ marginTop: 12 }}>
        <TitleFields title={title} description={description} setTitle={setTitle} setDescription={setDescription} idPrefix={`add-${unitId}`} />
      </div>
      <p className="text-body-sm" style={{ margin: '12px 0 6px', fontWeight: 480 }}>
        PDF 파일 <span className="text-caption">공개하려면 필요</span>
      </p>
      <PdfUpload key={reset} maxBytes={maxBytes} file={file} onPick={setFile} />
      {progress !== null ? (
        <div style={{ marginTop: 8 }} role="status" aria-live="polite">
          <div style={{ height: 8, borderRadius: 4, background: '#eee', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#000' }} />
          </div>
          <Caption>{progress < 100 ? `올리는 중 ${progress}%` : '서버가 파일을 확인하는 중'}</Caption>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-body-sm" style={{ margin: '8px 0 0', fontWeight: 480 }}>
          ⚠ {error}
        </p>
      ) : null}
      <div style={{ marginTop: 12 }}>
        <Button disabled={disabled || busy || !title.trim()} onClick={() => void submit()}>
          {busy ? (progress !== null ? `올리는 중 ${progress}%` : '만드는 중') : '소단원 추가'}
        </Button>
      </div>
    </ColorBlock>
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #000', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #e5e5e5', whiteSpace: 'nowrap', verticalAlign: 'top' }
const mini: React.CSSProperties = { minHeight: 28, padding: '2px 8px', fontSize: 13 }

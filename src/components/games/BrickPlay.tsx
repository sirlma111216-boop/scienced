import { useEffect, useRef, useState } from 'react'
import { BRICK_ORIGIN, BRICK_PLAY_MS, brickEmbedUrl, brickInput, brickMessage, brickOutcome, isBrickMessage } from '@/lib/brick'
import { Button, Caption } from '@/components/ui'
import { StageZoom } from './StageZoom'

/**
 * 학생 — 벽돌깨기 한 판 (강의자 지시 2026-10-12).
 *
 *   [벽돌깨기 열기] → iframe 의 준비 화면(설명 한 장 · [준비됐어요]) → 3초 뒤 시작 → 2분 → 결과가 오면 깬 벽돌 수를 낸다.
 *   설정 칸은 없다. 메시지 다리는 루미 런과 같은 규칙 — 리스너를 먼저 걸고 src 를 넣는다 · origin 과 source 를 확인한다 · targetOrigin 은 게임 origin.
 *   게임이 준비 화면을 지나 실제로 치기 시작하면(PROGRESS phase=running) `began` 을 한 번 적는다 — 강사 화면이 「치는 중」을 세고, 계산이 기다릴지 정한다.
 */
export function BrickPlay({
  uid,
  nickname,
  seed,
  sessionId,
  value,
  now,
  onPatch,
  view,
  nameOf,
}: {
  uid: string
  nickname: string
  seed: string
  sessionId: string
  value: Record<string, unknown>
  now: number
  onPatch: (patch: Record<string, unknown>) => void
  /** 계산이 낸 명단 — 누가 시작했고 끝냈는지 */
  view?: Record<string, unknown>
  nameOf?: (uid: string) => string
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'playing' | 'done'>('loading')
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const beganRef = useRef(false)
  const patchRef = useRef(onPatch)
  patchRef.current = onPatch
  const nowRef = useRef(now)
  nowRef.current = now
  const statusRef = useRef(status)
  statusRef.current = status
  const done = typeof value.bricks === 'number'

  useEffect(() => {
    if (!open) return
    const frame = frameRef.current
    if (!frame) return
    let gameSession: string | null = null
    const acked = new Set<string>()
    const post = (type: string, payload: Record<string, unknown>) => frame.contentWindow?.postMessage(brickMessage(type, gameSession, payload), BRICK_ORIGIN)
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== BRICK_ORIGIN || e.source !== frame.contentWindow) return
      if (!isBrickMessage(e.data)) return
      const m = e.data
      switch (m.type) {
        case 'READY':
          setStatus('ready')
          gameSession = sessionId
          post('INIT', { input: brickInput({ sessionId, uid, nickname, seed }) })
          return
        case 'INIT_ACK': {
          if (m.payload.accepted) {
            post('START', {})
            return
          }
          const err = m.payload.error as { message?: string } | undefined
          console.error('[벽돌깨기] 게임이 입력을 거절했다:', m.payload)
          setNote(`게임을 시작하지 못했습니다 — ${err?.message ?? '이유 없음'}. 다시 열어 보세요.`)
          setOpen(false)
          return
        }
        case 'PROGRESS':
          if (m.payload.phase === 'running' && !beganRef.current) {
            beganRef.current = true
            setStatus('playing')
            patchRef.current({ began: nowRef.current })
          }
          return
        case 'COMPLETE': {
          const result = m.payload.result
          const r = result as { resultId?: string } | undefined
          if (r?.resultId) post('COMPLETE_ACK', { resultId: r.resultId })
          if (!r?.resultId || acked.has(r.resultId)) return
          acked.add(r.resultId)
          const out = brickOutcome(result, uid)
          if (!out) {
            console.warn('[벽돌깨기] 결과에 내 기록이 없다 (건너뛰기?):', result)
            setNote('이번 판에 친 기록이 없습니다. 다시 열어 치세요.')
            setOpen(false)
            return
          }
          setStatus('done')
          patchRef.current({ bricks: out.bricks, score: out.score, playedMs: out.playedMs, resultId: out.resultId })
          return
        }
        case 'CANCEL':
          console.warn('[벽돌깨기] 취소됨:', m.payload)
          setNote('게임을 그만뒀습니다. 다시 열면 새 판입니다.')
          setOpen(false)
          return
        case 'ERROR':
          console.error('[벽돌깨기] 게임 오류:', m.payload)
          setNote(`게임 오류 — ${String((m.payload as { message?: string }).message ?? '')}`)
          return
        default:
          return
      }
    }
    window.addEventListener('message', onMessage)
    frame.src = brickEmbedUrl()
    const slow = window.setTimeout(() => {
      if (statusRef.current === 'loading') setNote(`게임이 8초 안에 응답하지 않습니다. ${BRICK_ORIGIN} 이 이 주소(${window.location.origin})에서 열리도록 배포돼 있는지 확인하세요.`)
    }, 8000)
    return () => {
      window.clearTimeout(slow)
      window.removeEventListener('message', onMessage)
      try {
        post('CANCEL', { reason: 'host' })
      } catch {
        /* 이미 떠난 창 */
      }
      frame.src = 'about:blank'
    }
  }, [open, sessionId, uid, nickname, seed])

  if (done) {
    return (
      <div>
        <p className="text-body-lg" style={{ margin: 0, fontWeight: 480 }}>
          냈다 — 깬 벽돌 {String(value.bricks)}개
        </p>
        <Caption>마지막 사람이 끝내면 발표자가 뜬다.</Caption>
        {view && nameOf ? <BrickRoster view={view} now={now} nameOf={nameOf} /> : null}
      </div>
    )
  }

  return (
    <div>
      {!open ? (
        <div>
          <p className="text-body" style={{ margin: 0 }}>
            자기 기기에서 {Math.round(BRICK_PLAY_MS / 60000)}분 동안 벽돌깨기를 한다. 열면 설명 한 장이 나오고, [준비됐어요]를 누르면 3초 뒤 시작한다.
          </p>
          <div style={{ marginTop: 10 }}>
            <Button onClick={() => { setNote(null); setStatus('loading'); beganRef.current = false; setOpen(true) }}>벽돌깨기 열기</Button>
          </div>
        </div>
      ) : (
        <div>
          <Caption>{status === 'loading' ? '게임을 불러오는 중' : status === 'ready' ? '준비 화면에서 [준비됐어요]를 누른다' : status === 'playing' ? '치는 중 — 패들은 손가락·마우스·방향키' : '결과를 보내는 중'}</Caption>
          <StageZoom label="벽돌깨기">
            <iframe ref={frameRef} title="벽돌깨기" allow="fullscreen; autoplay" style={{ display: 'block', width: '100%', height: 'min(78vh, 640px)', border: 0, borderRadius: 12, background: '#010120' }} />
          </StageZoom>
        </div>
      )}
      {note ? (
        <p role="status" className="text-body-sm" style={{ margin: '8px 0 0', fontWeight: 480 }}>
          {note}
        </p>
      ) : null}
    </div>
  )
}

/**
 * 참가자마다 했는지 안 했는지 (강의자 지시 2026-10-13 — 참여 못 한 학생이 뽑힌 뒤 「모두 다 하는지 안 하는지 표시」).
 * 강사 화면과 학생 화면이 같은 명단을 본다. 첫 사람이 시작한 뒤 2분이 시작 마감이다.
 */
export function BrickRoster({ view, now, nameOf }: { view: Record<string, unknown>; now: number; nameOf: (uid: string) => string }) {
  const people = (view.people as Array<{ uid: string; status: 'idle' | 'playing' | 'done' | 'aborted'; bricks: number | null }> | undefined) ?? []
  const lateAt = typeof view.lateAt === 'number' ? view.lateAt : null
  const left = lateAt === null ? null : Math.max(0, Math.ceil((lateAt - now) / 1000))
  const label = (p: (typeof people)[number]) => (p.status === 'done' ? `냈다 ${p.bricks}` : p.status === 'playing' ? '치는 중' : p.status === 'aborted' ? '중단' : '아직 안 시작')
  const order = { idle: 0, aborted: 1, playing: 2, done: 3 }
  const sorted = [...people].sort((a, b) => order[a.status] - order[b.status] || (a.bricks ?? 0) - (b.bricks ?? 0))
  return (
    <div style={{ marginTop: 8 }}>
      <Caption>
        {/* wording-ok: 게임의 제한 시간 */}
        냈다 {String(view.done ?? 0)} · 치는 중 {String(view.playing ?? 0)} · 아직 안 시작 {String(view.idle ?? 0)}
        {Number(view.aborted ?? 0) > 0 ? ` · 중단 ${String(view.aborted)}` : ''} / {String(view.total ?? 0)}명
        {/* wording-ok: 게임의 제한 시간 */}
        {lateAt === null ? ' — 첫 사람이 시작하면 2분 시계가 돈다' : left ? ` — 시작 마감까지 ${left}초 (안 시작한 사람이 먼저 발표자)` : ' — 시작 마감이 지났다. 치는 사람이 끝나면 발표자가 뜬다'}
      </Caption>
      {sorted.length ? (
        <ul className="flex flex-wrap gap-xs" style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
          {sorted.map((p) => (
            <li key={p.uid} className="text-body-sm" style={{ padding: '2px 8px', borderRadius: 8, background: p.status === 'idle' || p.status === 'aborted' ? '#ffe9e0' : p.status === 'playing' ? '#fff6cc' : '#e7f3e0' }}>
              {nameOf(p.uid)} · {label(p)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

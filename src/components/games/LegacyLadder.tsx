import { useMemo, useState } from 'react'
import type { GameKind, LessonId } from '@/content/types'
import { apiPost } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { buildLadder, emergencyDraw, pickPresentSlots, weightFromPresentCount, weightedDraw, winnersFromLadder } from '@/lib/ladder'
import type { Enrollment, LadderState, Participation, SessionState } from '@/lib/types'
import { Badge, Button, Caption, Notice, useReducedMotion } from '@/components/ui'
import { LadderBoard } from '@/components/activity/LadderBoard'
import { SeatPicker } from './GameInputs'

/**
 * 1강 사다리 · 2강 봉투 — 옛 게임을 그대로 쓴다 (8차 6.3 「유지」).
 *
 * 엔진은 하나(ladder.ts)다. 봉투는 같은 씨앗에서 같은 대응을 만들되 사다리 대신 봉투 그림으로 보인다.
 * 강사 단추는 「게임 시작」 하나 — 첫 누름이 자리를 열고, 두 번째 누름이 결과를 연다. 끝난 뒤 누르면 새 판.
 * 아무도 자리를 잡지 않았으면 두 번째 누름이 비상 추첨(가중)이다. 수동 지정은 결과 옆의 선택 상자다.
 */
export const WINNER_COUNT: Partial<Record<GameKind, number>> = { ladder: 2, envelope: 2 }

async function requestSeed(gameId: string, round: number): Promise<string> {
  const data = await apiPost<{ ok: boolean; seed?: string }>('/api/picker/draw', { gameId, round })
  if (data.ok && data.seed) return data.seed
  return `${gameId}::r${round}::${Date.now().toString(36)}`
}

export function LegacyLadder({
  classId,
  lessonId,
  stepId,
  kind,
  session,
  nicknames,
  teacher,
}: {
  classId: string
  lessonId: LessonId
  stepId: string
  kind: 'ladder' | 'envelope'
  session: SessionState | null
  nicknames: Record<string, string>
  teacher?: { students: Enrollment[]; participation: Participation[]; nameOf: (uid: string) => string } | null
}) {
  const { user, repo } = useAuth()
  const reduced = useReducedMotion()
  const gameId = `${lessonId}-${stepId}-${kind}`
  const state: LadderState | null = session?.ladders?.[gameId] ?? null
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState<string | null>(null)
  const count = WINNER_COUNT[kind] ?? 2
  const revealed = state?.phase === 'running' || state?.phase === 'done'
  const nameOf = (uid: string) => (teacher ? teacher.nameOf(uid) : (nicknames[uid] ?? '참여자'))

  const candidates = useMemo(() => teacher?.students.map((s) => s.uid) ?? [], [teacher])
  const weights = useMemo(() => {
    const by = Object.fromEntries((teacher?.participation ?? []).map((p) => [p.uid, p.presentCount]))
    return Object.fromEntries(candidates.map((u) => [u, weightFromPresentCount(by[u] ?? 0)]))
  }, [candidates, teacher?.participation])

  const ladder = useMemo(() => (state ? buildLadder(state.seed, state.columns) : null), [state])
  const winnerSeats = state && ladder && revealed && !state.emergency ? winnersFromLadder(ladder, state.presentSlots) : []
  const seatNames: Record<string, string> = Object.fromEntries(Object.entries(state?.seats ?? {}).map(([k, uid]) => [k, nameOf(uid)]))
  const mySeat = user ? Object.entries(state?.seats ?? {}).find(([, uid]) => uid === user.uid)?.[0] : undefined
  const winners = state?.winnerUids ?? []

  async function claim(seat: number) {
    if (!repo || !user) return
    setConflict(null)
    const ok = await repo.claimLadderSeat(classId, lessonId, gameId, seat, user.uid)
    if (!ok) setConflict('방금 다른 사람이 그 자리를 가져갔다. 다른 자리를 고르세요.')
  }

  async function open(round: number) {
    if (!repo) return
    const seed = await requestSeed(gameId, round)
    const columns = Math.max(2, candidates.length)
    await repo.setLadder(classId, lessonId, gameId, { gameId, phase: 'seating', round, seed, columns, seats: {}, presentSlots: pickPresentSlots(seed, columns, count), winnerUids: [], excludedUids: [], emergency: false, runAt: null })
  }

  async function finalize(next: LadderState, reason: string) {
    if (!repo || !user) return
    await repo.setLadder(classId, lessonId, gameId, next)
    await repo.recordPick(classId, { id: `${gameId}-r${next.round}-${Date.now().toString(36)}`, lessonId, stepId, gameId, candidateUids: candidates, excludedUids: [], weights, winnerUids: next.winnerUids, seed: next.seed, runBy: user.uid, runAt: Date.now(), redrawOf: null })
    for (const uid of next.winnerUids) {
      const cur = teacher?.participation.find((p) => p.uid === uid)
      await repo.bumpParticipation(classId, uid, { presentCount: (cur?.presentCount ?? 0) + 1, lastPresentedLessonId: lessonId })
    }
    console.info('[게임]', gameId, reason, next.winnerUids)
  }

  async function start() {
    if (!repo || !user || !teacher) return
    setBusy(true)
    try {
      if (!state || state.phase === 'done' || state.phase === 'running') {
        await open((state?.round ?? 0) + 1)
        return
      }
      const taken = Object.keys(state.seats ?? {}).length
      if (taken === 0) {
        const winnerUids = weightedDraw(state.seed, weights, count)
        await finalize({ ...state, phase: 'done', emergency: true, winnerUids, runAt: Date.now() }, '아무도 자리를 잡지 않아 발표 횟수 가중 추첨')
        return
      }
      const l = buildLadder(state.seed, state.columns)
      const seats = winnersFromLadder(l, state.presentSlots)
      let winnerUids = seats.map((s) => state.seats?.[String(s)]).filter(Boolean) as string[]
      if (winnerUids.length === 0) winnerUids = emergencyDraw(state.seed, Object.values(state.seats ?? {}), count)
      await finalize({ ...state, phase: 'running', winnerUids, runAt: Date.now() }, '결과 공개')
    } catch (err) {
      console.error('[게임] 사다리를 진행하지 못했다:', err)
    } finally {
      setBusy(false)
    }
  }

  async function manual(uid: string) {
    if (!state || !uid) return
    await finalize({ ...state, phase: 'done', winnerUids: [uid], runAt: Date.now() }, '수동 지정')
  }

  const label = kind === 'ladder' ? '사다리타기' : '발표자 선정 봉투'

  return (
    <div>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge>{label}</Badge>
        {state ? <Badge solid>{state.phase === 'seating' ? '자리 고르는 중' : state.phase === 'locked' ? '자리 잠김' : state.phase === 'running' ? '결과 열림' : '끝'}</Badge> : <Badge>아직 안 열림</Badge>}
        {state && state.round > 1 ? <Badge>{state.round}번째 판</Badge> : null}
        {state?.emergency ? <Badge>비상 추첨</Badge> : null}
        {teacher ? <Caption>자리 {Object.keys(state?.seats ?? {}).length} / {state?.columns ?? Math.max(2, candidates.length)}</Caption> : null}
      </div>
      <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.8 }}>
        {kind === 'ladder' ? '자리를 하나 고르세요. 강사가 결과를 열면 사다리를 타고 내려간다.' : '봉투 하나를 고르세요. 열기 전에는 아무도 모른다.'} 답이 맞아서 뽑히는 것이 아니다.
      </p>

      {teacher ? (
        <div className="flex items-center gap-xs" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <Button onClick={() => void start()} disabled={busy}>
            게임 시작
          </Button>
          <Caption>{!state ? '누르면 자리가 열린다' : state.phase === 'seating' ? '다시 누르면 결과가 열린다' : '다시 누르면 새 판'}</Caption>
          {state && revealed ? (
            <label className="text-body-sm flex items-center gap-xxs">
              수동 지정
              <select className="field" style={{ minHeight: 36, padding: '2px 8px' }} value="" onChange={(e) => void manual(e.target.value)} aria-label="발표자 수동 지정">
                <option value="">사람 고르기</option>
                {candidates.map((u) => (
                  <option key={u} value={u}>
                    {nameOf(u)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {conflict ? (
        <div role="alert" style={{ marginTop: 12 }}>
          <Notice tone="coral">
            <p className="text-body-sm" style={{ margin: 0 }}>
              {conflict}
            </p>
          </Notice>
        </div>
      ) : null}

      {!state ? (
        <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.7 }}>
          강사가 열면 여기에 자리가 나타난다.
        </p>
      ) : (
        <>
          {!teacher && state.phase === 'seating' ? <SeatPicker columns={state.columns} seats={state.seats ?? {}} seatNames={seatNames} uid={user?.uid ?? ''} envelope={kind === 'envelope'} onClaim={(i) => void claim(i)} /> : null}

          <div style={{ marginTop: 16, background: '#fff', borderRadius: 24, padding: 16 }}>
            {kind === 'ladder' ? (
              <LadderBoard seed={state.seed} columns={state.columns} seats={seatNames} presentSlots={state.presentSlots} highlightSeat={mySeat != null ? Number(mySeat) : null} revealed={revealed && !state.emergency && !reduced ? true : revealed && !state.emergency} />
            ) : (
              <Envelopes columns={state.columns} seats={seatNames} winnerSeats={winnerSeats} revealed={revealed && !state.emergency} mySeat={mySeat != null ? Number(mySeat) : null} />
            )}
          </div>

          <div role="status" aria-live="polite" style={{ marginTop: 12 }}>
            {revealed ? (
              <p className="text-body-lg" style={{ fontWeight: 480, margin: 0 }}>
                {winners.length === 0 ? '아직 발표자가 정해지지 않았다.' : `발표 · ${winners.map(nameOf).join(', ')}`}
                {user && winners.includes(user.uid) ? ' — 나다' : ''}
              </p>
            ) : null}
            <Caption>씨앗 {state.seed}</Caption>
          </div>
        </>
      )}
    </div>
  )
}

function Envelopes({ columns, seats, winnerSeats, revealed, mySeat }: { columns: number; seats: Record<string, string>; winnerSeats: number[]; revealed: boolean; mySeat: number | null }) {
  return (
    <div className="flex flex-wrap gap-xs" role="list" aria-label="봉투">
      {Array.from({ length: columns }, (_, i) => {
        const win = revealed && winnerSeats.includes(i)
        return (
          <div key={i} role="listitem" className="rounded-md" style={{ width: 96, padding: 10, textAlign: 'center', boxShadow: `inset 0 0 0 ${i === mySeat ? 2 : 1}px ${i === mySeat ? '#000' : '#e6e6e6'}`, background: win ? '#111' : '#fff', color: win ? '#fff' : '#000' }}>
            <div style={{ fontSize: 28 }} aria-hidden>
              {revealed ? (win ? '📣' : '✉') : '✉'}
            </div>
            <div className="font-mono text-caption">{i + 1}</div>
            <div className="text-body-sm" style={{ opacity: seats[String(i)] ? 1 : 0.4 }}>
              {seats[String(i)] ?? '빈 봉투'}
            </div>
            {win ? <div className="text-body-sm" style={{ fontWeight: 600 }}>발표!</div> : null}
          </div>
        )
      })}
    </div>
  )
}

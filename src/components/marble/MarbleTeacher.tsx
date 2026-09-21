import { useEffect, useMemo, useRef, useState } from 'react'
import type { LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { finalizeGame } from '@/lib/game-record'
import { MARBLE_COUNTDOWN, MARBLE_MAX_PARTICIPANTS, marbleParticipants, marbleSetup, marbleWinnerUids, type MarbleHandle, type MarbleResult } from '@/lib/marble'
import type { Enrollment, GameState, Participation, SessionState } from '@/lib/types'
import { Badge, Button, Caption, Notice } from '@/components/ui'
import { GameResultCard } from '@/components/games/GameResultCard'
import { MarbleStage } from './MarbleStage'

/**
 * 강사 — 교실 구슬 레이스로 발표자 선정 (강의자 지시 2026-09-21).
 *
 *   ① 단계를 열면 활동 앱이 붙고 수강생 명단(uid + 닉네임)이 들어간다. 강사가 하는 일은 「게임 시작」 하나다.
 *   ② 구슬이 끝나면 당첨자의 participantId(우리 uid)를 그대로 받아 세션·뽑기 기록·발표 횟수에 적는다 (finalizeGame).
 *   ③ 학생 기기는 참가하지 않는다 — 프로젝터 한 화면에서 돈다. 학생 화면에는 결과만 뜬다.
 *   ④ 서버가 확인해 주지 않는 결과다(`serverVerified: false`). 결과에 「화면에서 계산한 결과」를 적는다.
 *   ⑤ 다시 뽑기도 같은 단추다 — 끝난 판에서 누르면 새 판이 시작된다.
 */
export function MarbleTeacher({
  classId,
  lessonId,
  stepId,
  options,
  session,
  students,
  participation,
  nameOf,
}: {
  classId: string
  lessonId: LessonId
  stepId: string
  options?: Record<string, unknown> | null
  session: SessionState | null
  students: Enrollment[]
  participation: Participation[]
  nameOf: (uid: string) => string
}) {
  const { repo, user } = useAuth()
  const { mapId, mapName, pick, unknown } = useMemo(() => marbleSetup(options), [options])
  const state: GameState | null = session?.games?.[stepId] ?? null
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const raceRef = useRef<MarbleHandle | null>(null)
  const creating = useRef(false)
  const finalizing = useRef<string | null>(null)

  const studentUids = students.map((s) => s.uid)
  const participants = marbleParticipants(studentUids, nameOf)
  const gameId = `${lessonId}-${stepId}-marble`
  const result = state?.result ?? null

  /* 대기실을 한 번 연다 — 학생 화면이 「곧 시작한다」를 본다 */
  useEffect(() => {
    if (!repo || state || creating.current) return
    creating.current = true
    void repo
      .setGame(classId, lessonId, stepId, { kind: 'marble', stepId, phase: 'lobby', round: 1, seed: `marble-${Date.now().toString(36)}`, startedAt: null, state: null, result: null, updatedAt: Date.now() })
      .catch((err) => {
        console.error('[구슬 레이스] 대기실을 열지 못했다:', err)
        setNote('대기실을 열지 못했습니다. 새로고침한 뒤 다시 열어 보세요.')
      })
      .finally(() => {
        creating.current = false
      })
  }, [repo, state, classId, lessonId, stepId])

  async function start() {
    if (!repo || !user || !state) return
    const race = raceRef.current
    if (!race) {
      setAttempt((a) => a + 1)
      setNote('구슬 레이스를 다시 부르는 중입니다. 아래 화면이 뜨면 다시 누르세요.')
      return
    }
    if (studentUids.length === 0) {
      setNote('수강생이 없습니다. 명단을 먼저 만드세요.')
      return
    }
    setBusy(true)
    setNote(null)
    const round = state.phase === 'done' ? state.round + 1 : state.round
    try {
      if (state.phase === 'done') await race.resetRound()
      const base: GameState = { ...state, kind: 'marble', phase: 'running', round, seed: `marble-r${round}-${Date.now().toString(36)}`, startedAt: Date.now(), result: null, updatedAt: Date.now() }
      await repo.setGame(classId, lessonId, stepId, base)
      finalizing.current = null
      await race.setConfig({ mapId, rule: pick.rule })
      await race.setParticipants(participants)
      await race.startRound(MARBLE_COUNTDOWN)
    } catch (err) {
      console.error('[구슬 레이스] 시작하지 못했다:', err)
      setNote(`시작하지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`)
      await repo.setGame(classId, lessonId, stepId, { ...state, phase: 'lobby', updatedAt: Date.now() }).catch((e) => console.error('[구슬 레이스] 대기실로 되돌리지 못했다:', e))
    } finally {
      setBusy(false)
    }
  }

  function finished(raw: MarbleResult, serverVerified: boolean) {
    if (!repo || !user || !state) return
    if (raw.cancelled) {
      setNote('경기가 취소됐습니다. 「게임 시작」을 다시 누르세요.')
      return
    }
    const key = String(raw.eventId ?? raw.roundId ?? '')
    if (key && finalizing.current === key) return
    finalizing.current = key
    const winners = marbleWinnerUids(raw, studentUids)
    const asked = pick.rule.kind === 'topK' || pick.rule.kind === 'bottomK' ? pick.rule.k : 1
    const short = winners.length < asked ? ` · 완주가 모자라 ${winners.length}명만 나왔다` : ''
    const presentCount = Object.fromEntries(participation.map((p) => [p.uid, p.presentCount]))
    const base: GameState = { ...state, seed: String(raw.roundId ?? raw.eventId ?? state.seed) }
    void finalizeGame(repo, {
      classId,
      lessonId,
      stepId,
      gameId,
      base,
      winnerUids: winners,
      reason: `${mapName} · ${pick.label}${short}`,
      candidateUids: studentUids,
      presentCount,
      runBy: user.uid,
      fairness: serverVerified ? undefined : '화면에서 계산한 결과',
    }).catch((err) => {
      console.error('[구슬 레이스] 결과를 적지 못했다:', err)
      finalizing.current = null
      setNote('결과를 저장하지 못했습니다. 「게임 시작」으로 한 판 더 돌리거나 수동으로 정하세요.')
    })
  }

  return (
    <div>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge solid>교실 구슬 레이스</Badge>
        <Badge>{mapName}</Badge>
        <Badge>{pick.label}</Badge>
        {state ? <Badge>{state.phase === 'lobby' ? '준비됨' : state.phase === 'running' ? '진행 중' : '끝'}</Badge> : <Badge>여는 중</Badge>}
        {state && state.round > 1 ? <Badge>{state.round}번째 판</Badge> : null}
        <Caption>대상 {studentUids.length}명</Caption>
      </div>
      <p className="text-body" style={{ margin: '8px 0 0' }}>
        수강생 전원이 구슬로 달립니다. {pick.label}이 이번 발표자입니다. 학생 기기는 쓰지 않습니다 — 이 화면을 함께 봅니다.
      </p>
      {unknown.length > 0 ? <Caption>⚠ 차시에 적힌 {unknown.join(' · ')} 를 몰라 기본값으로 돌렸습니다.</Caption> : null}
      {studentUids.length > MARBLE_MAX_PARTICIPANTS ? <Caption>⚠ 활동 앱은 한 번에 {MARBLE_MAX_PARTICIPANTS}명까지입니다. 앞의 {MARBLE_MAX_PARTICIPANTS}명만 달립니다.</Caption> : null}

      <div className="flex items-center gap-xs" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <Button onClick={() => void start()} disabled={busy || !state || state.phase === 'running'}>
          게임 시작
        </Button>
        <Caption>{!state ? '대기실을 여는 중' : state.phase === 'running' ? '구슬이 굴러가는 중 — 끝나면 저절로 확정된다' : state.phase === 'done' ? '다시 누르면 새 판(재추첨)' : `누르면 ${MARBLE_COUNTDOWN}초 뒤 출발한다`}</Caption>
      </div>
      {note ? (
        <p role="status" className="text-body-sm" style={{ margin: '8px 0 0', fontWeight: 480 }}>
          {note}
        </p>
      ) : null}

      {result ? <GameResultCard result={result} nameOf={nameOf} uid={user?.uid} /> : null}

      <div style={{ marginTop: 12 }}>
        <MarbleStage
          mountKey={`${classId}:${lessonId}:${stepId}:${attempt}`}
          participants={participants}
          mapId={mapId}
          rule={pick.rule}
          height={560}
          onReady={(race) => {
            raceRef.current = race
          }}
          onFinished={finished}
          onError={(m) => {
            console.warn('[구슬 레이스]', m)
            setNote(m)
          }}
        />
        <Caption style={{ marginTop: 6 }}>결과는 이 화면에서 계산한 것입니다 — 성적이나 평가에는 쓰지 않습니다.</Caption>
      </div>

      {studentUids.length === 0 ? (
        <Notice tone="cream">
          <p className="text-body-sm" style={{ margin: 0 }}>
            수강생 명단이 비어 있습니다. 명단을 만든 뒤에 시작하세요.
          </p>
        </Notice>
      ) : null}
    </div>
  )
}

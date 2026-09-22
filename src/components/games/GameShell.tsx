import { useEffect, useMemo, useRef, useState } from 'react'
import type { Activity, CourseId, GameKind, GroupData, LessonId, Step } from '@/content/types'
import { gameSpec } from '@/content/games'
import { apiPost } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { derive, participants, representativeOf, type Derived } from '@/lib/game-core'
import { finalizeGame } from '@/lib/game-record'
import { weightFromPresentCount, weightedDraw } from '@/lib/ladder'
import { serverNow, syncServerTime } from '@/lib/server-time'
import type { Enrollment, GameInput, GameState, GroupRound, Participation, SessionState } from '@/lib/types'
import { Badge, Button, Caption, ColorBlock, Notice } from '@/components/ui'
import { LumiStudent } from '@/components/lumi/LumiStudent'
import { LumiTeacher } from '@/components/lumi/LumiTeacher'
import { MarbleStudent } from '@/components/marble/MarbleStudent'
import { MarbleTeacher } from '@/components/marble/MarbleTeacher'
import { GameResultCard } from './GameResultCard'
import { StudentGameInput, TeacherGameView } from './GameInputs'
import { LegacyLadder } from './LegacyLadder'

/** 모둠·게임이 있는 활동만 여기 온다 — 교수법 활동 1 은 GameShell 을 그리지 않는다 */
type GameActivity = Activity & { game: GameKind; group: GroupData }

/**
 * 발표자 선정 게임의 공통 껍데기 (8차 6.1).
 *
 *   학생  [참가] 하나 → 게임별 입력 → 결과
 *   강사  [게임 시작] 하나 → 진행 상황 → 결과 (자동 확정) · 수동 지정은 선택 상자
 *
 * 게임 상태는 (서버 시드 · 참가 · 입력 · 서버 시각)의 함수라 모든 화면이 같은 것을 계산한다 (game-core).
 * 강사 화면이 끝난 것을 보면 결과를 세션에 적고 발표 횟수를 올린다. 참가자가 없으면 발표 횟수 가중 추첨이다.
 * 반응 속도 게임은 결과에 「반응 속도 게임입니다」를 적는다.
 */
export interface TeacherGameProps {
  students: Enrollment[]
  participation: Participation[]
  nameOf: (uid: string) => string
}

export function GameShell({
  classId,
  lessonId,
  courseId,
  step,
  activity,
  session,
  round,
  nicknames,
  teacher,
  tally,
}: {
  classId: string
  lessonId: LessonId
  courseId: CourseId
  step: Step
  activity: GameActivity
  session: SessionState | null
  round: GroupRound | null
  nicknames: Record<string, string>
  teacher?: TeacherGameProps | null
  /** 추정 게임 — 오늘 모둠 질문의 답 분포 */
  tally?: Array<{ option: string; count: number }>
}) {
  const kind = activity.game
  const spec = gameSpec(kind)
  if (kind === 'lumi') {
    return teacher ? <LumiTeacher classId={classId} lessonId={lessonId} stepId={step.id} courseId={courseId} session={session} students={teacher.students} /> : <LumiStudent classId={classId} lessonId={lessonId} courseId={courseId} session={session} nicknames={nicknames} />
  }
  if (kind === 'marble') {
    return (
      <ColorBlock tone="lime">
        <p className="eyebrow" style={{ margin: '0 0 8px' }}>
          발표자 선정
        </p>
        {teacher ? (
          <MarbleTeacher classId={classId} lessonId={lessonId} stepId={step.id} options={activity.gameOptions} session={session} students={teacher.students} participation={teacher.participation} nameOf={teacher.nameOf} />
        ) : (
          <MarbleStudent lessonId={lessonId} stepId={step.id} options={activity.gameOptions} session={session} nicknames={nicknames} />
        )}
      </ColorBlock>
    )
  }
  if (kind === 'ladder' || kind === 'envelope') {
    return <LegacyLadder classId={classId} lessonId={lessonId} stepId={step.id} kind={kind} session={session} nicknames={nicknames} teacher={teacher} />
  }
  void spec
  return <LibraryGame classId={classId} lessonId={lessonId} step={step} activity={activity} session={session} round={round} nicknames={nicknames} teacher={teacher} tally={tally} />
}

async function requestSeed(gameId: string, round: number): Promise<string> {
  const data = await apiPost<{ ok: boolean; seed?: string }>('/api/picker/draw', { gameId, round })
  if (data.ok && data.seed) return data.seed
  /* 서버가 없는 로컬 저장 모드 — 강사 화면이 한 번 만들고 세션으로 공유한다. 씨앗은 화면에 남는다 */
  return `${gameId}::r${round}::${Date.now().toString(36)}`
}

function LibraryGame({
  classId,
  lessonId,
  step,
  activity,
  session,
  round,
  nicknames,
  teacher,
  tally,
}: {
  classId: string
  lessonId: LessonId
  step: Step
  activity: GameActivity
  session: SessionState | null
  round: GroupRound | null
  nicknames: Record<string, string>
  teacher?: TeacherGameProps | null
  tally?: Array<{ option: string; count: number }>
}) {
  const { repo, user } = useAuth()
  const kind = activity.game
  const spec = gameSpec(kind)
  const state: GameState | null = session?.games?.[step.id] ?? null
  const [inputs, setInputs] = useState<GameInput[]>([])
  const [now, setNow] = useState(() => serverNow())
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const creating = useRef(false)
  const finalizing = useRef<string | null>(null)
  const uid = user?.uid ?? ''
  const nameOf = (u: string) => (teacher ? teacher.nameOf(u) : (nicknames[u] ?? '이름 없음'))

  useEffect(() => {
    syncServerTime().catch((err) => console.warn('[게임] 서버 시각을 재지 못했다:', err))
  }, [])
  useEffect(() => {
    if (!repo) return
    return repo.watchGameInputs(classId, lessonId, step.id, setInputs)
  }, [repo, classId, lessonId, step.id])
  useEffect(() => {
    if (state?.phase !== 'running') return
    const t = window.setInterval(() => setNow(serverNow()), 200)
    return () => window.clearInterval(t)
  }, [state?.phase])

  const groups = useMemo(() => (round?.groups ?? []).map((g) => ({ id: g.id, name: g.name, memberUids: g.memberUids })), [round])
  const bingoItems = useMemo(() => {
    const f = activity.fields.find((x) => x.items?.length) ?? activity.fields.find((x) => x.options?.length)
    const items = f?.items?.map((i) => i.label) ?? f?.options ?? []
    const pool = [...items, ...activity.fields.flatMap((x) => x.options ?? [])]
    return [...new Set(pool)].slice(0, 9)
  }, [activity])
  const derived: Derived | null = useMemo(() => (state ? derive({ state, inputs, now, groups, tally, bingoItems, options: activity.gameOptions }) : null), [state, inputs, now, groups, tally, bingoItems, activity.gameOptions])
  const joined = state ? participants({ state, inputs, now, groups }) : []
  const mine = state ? (inputs.find((i) => i.uid === uid && i.round === state.round) ?? null) : null
  const gameId = `${lessonId}-${step.id}-${kind}`

  /* 강사 — 상태가 없으면 대기실을 연다 (한 번) */
  useEffect(() => {
    if (!teacher || !repo || state || creating.current) return
    creating.current = true
    void lobby(1).finally(() => {
      creating.current = false
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher, repo, state])

  async function lobby(roundNo: number) {
    if (!repo) return
    const seed = await requestSeed(gameId, roundNo)
    await repo.setGame(classId, lessonId, step.id, { kind, stepId: step.id, phase: 'lobby', round: roundNo, seed, startedAt: null, state: null, result: null, updatedAt: Date.now() })
  }

  async function finalize(base: GameState, winnerUids: string[], reason: string, manual = false) {
    if (!repo || !user || !teacher) return
    const presentCount = Object.fromEntries(teacher.participation.map((p) => [p.uid, p.presentCount]))
    await finalizeGame(repo, { classId, lessonId, stepId: step.id, gameId, base, winnerUids, reason, candidateUids: joined.map((p) => p.uid), presentCount, runBy: user.uid, fairness: spec.reaction ? '반응 속도 게임입니다' : undefined, manual })
  }

  /* 강사 — 끝난 게임을 확정한다 (한 판에 한 번) */
  useEffect(() => {
    if (!teacher || !state || !derived || state.phase !== 'running' || !derived.finished) return
    const key = `${state.seed}:${state.round}`
    if (finalizing.current === key) return
    finalizing.current = key
    const presentCount = Object.fromEntries(teacher.participation.map((p) => [p.uid, p.presentCount]))
    let winners = derived.winnerUids
    let reason = derived.reason
    if (spec.scope === 'group') {
      const g = groups.find((x) => x.id === derived.winnerGroupId)
      const rep = g ? representativeOf(g, presentCount, state.seed) : null
      winners = rep ? [rep] : []
      reason = g ? `${g.name} — ${derived.reason} · 대표는 발표 횟수가 가장 적은 사람` : derived.reason
    }
    void finalize(state, winners, reason).catch((err) => {
      console.error('[게임] 결과를 적지 못했다:', err)
      setNote('결과를 저장하지 못했습니다. 게임 시작을 다시 눌러 새 판을 여세요.')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher, state, derived?.finished])

  async function start() {
    if (!repo || !teacher || !state) return
    setBusy(true)
    setNote(null)
    try {
      if (state.phase === 'done') {
        await lobby(state.round + 1)
        return
      }
      if (state.phase !== 'lobby') return
      if (joined.length === 0) {
        const weights = Object.fromEntries(teacher.students.map((s) => [s.uid, weightFromPresentCount(teacher.participation.find((p) => p.uid === s.uid)?.presentCount ?? 0)]))
        const w = weightedDraw(state.seed, weights, 1)
        await finalize(state, w, '참가자가 없어 발표 횟수가 적은 사람 가운데 가중 추첨')
        return
      }
      /* 추정 게임 — 오늘 모둠 질문의 답 분포를 상태에 넣는다. 학생 화면은 이것으로 같은 것을 계산한다 */
      const extra = kind === 'estimate' ? { tally: (tally ?? []).map((t) => ({ option: t.option, count: t.count })) } : null
      await repo.setGame(classId, lessonId, step.id, { ...state, phase: 'running', startedAt: serverNow(), state: extra, updatedAt: Date.now() })
    } catch (err) {
      console.error('[게임] 시작하지 못했다:', err)
      setNote(`시작하지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function manual(u: string) {
    if (!state || !u) return
    await finalize(state, [u], '강사가 지정', true)
  }

  async function join() {
    if (!repo || !user || !state) return
    setBusy(true)
    try {
      await repo.setGameInput(classId, lessonId, { uid: user.uid, stepId: step.id, round: state.round, joinedAt: serverNow(), value: {}, updatedAt: Date.now() })
    } catch (err) {
      console.error('[게임] 참가하지 못했다:', err)
      setNote('참가하지 못했습니다. 잠시 뒤 다시 누르세요.')
    } finally {
      setBusy(false)
    }
  }
  async function patch(p: Record<string, unknown>) {
    if (!repo || !user || !state || !mine) return
    const value = { ...((mine.value as Record<string, unknown> | null) ?? {}), ...p }
    try {
      await repo.setGameInput(classId, lessonId, { ...mine, value, updatedAt: Date.now() })
    } catch (err) {
      console.error('[게임] 입력을 보내지 못했다:', err)
      setNote('보내지 못했습니다. 다시 누르세요.')
    }
  }

  const result = state?.result ?? null
  const total = teacher ? teacher.students.length : null
  const groupGate = spec.scope === 'group' && groups.length === 0
  /* 오늘 온 사람이 없으면 뽑을 후보도 없다 — 빈 결과를 적지 않고 무엇을 해야 하는지 적는다 */
  const emptyGate = Boolean(teacher) && (total ?? 0) === 0

  return (
    <ColorBlock tone="lime">
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <p className="eyebrow" style={{ margin: 0 }}>
          발표자 선정
        </p>
        <Badge solid>{spec.name}</Badge>
        {spec.scope === 'group' ? <Badge>모둠</Badge> : null}
        {state ? <Badge>{state.phase === 'lobby' ? '참가 받는 중' : state.phase === 'running' ? '진행 중' : '끝'}</Badge> : <Badge>준비 중</Badge>}
        {state && state.round > 1 ? <Badge>{state.round}번째 판</Badge> : null}
        <Caption>참가 {joined.length}{total !== null ? ` / ${total}` : ''}</Caption>
      </div>
      <p className="text-body" style={{ margin: '8px 0 0' }}>
        {spec.rule}
      </p>
      {spec.reaction ? <Caption>반응 속도 게임이다 — 기기와 회선에 따라 다를 수 있다.</Caption> : null}

      {groupGate ? (
        <div style={{ marginTop: 12 }}>
          <Notice tone="cream">
            <p className="text-body-sm" style={{ margin: 0 }}>
              모둠 게임은 모둠이 나뉜 뒤에 한다. 도입 단계의 「모둠 나누기」가 먼저다.
            </p>
          </Notice>
        </div>
      ) : null}

      {emptyGate ? (
        <div style={{ marginTop: 12 }}>
          <Notice tone="cream">
            <p className="text-body-sm" style={{ margin: 0 }}>
              오늘 온 사람이 아직 없다. 학생이 첫 화면의 「오늘의 질문」에 답하면 후보가 된다. 답하지 못한 사람은 머리의 「명단」에서 넣는다.
            </p>
          </Notice>
        </div>
      ) : null}

      {teacher ? (
        <div className="flex items-center gap-xs" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <Button onClick={() => void start()} disabled={busy || !state || state.phase === 'running' || groupGate || emptyGate}>
            게임 시작
          </Button>
          <Caption>{!state ? '대기실을 여는 중' : emptyGate ? '오늘 온 사람이 없어 뽑을 후보가 없다' : state.phase === 'lobby' ? (joined.length === 0 ? '참가자가 없으면 출석한 사람 가운데 발표 횟수 가중 추첨' : '누르면 바로 시작한다') : state.phase === 'running' ? '진행 중 — 끝나면 저절로 확정된다' : '다시 누르면 새 판(재추첨)'}</Caption>
          {state && state.phase === 'done' ? (
            <label className="text-body-sm flex items-center gap-xxs">
              수동 지정
              <select className="field" style={{ minHeight: 36, padding: '2px 8px' }} value="" onChange={(e) => void manual(e.target.value)} aria-label="발표자 수동 지정">
                <option value="">사람 고르기</option>
                {teacher.students.map((s) => (
                  <option key={s.uid} value={s.uid}>
                    {teacher.nameOf(s.uid)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      {note ? (
        <p role="status" className="text-body-sm" style={{ margin: '8px 0 0', fontWeight: 480 }}>
          {note}
        </p>
      ) : null}

      {/* 학생 — 참가 · 입력 */}
      {!teacher && state && !result ? (
        <div className="card" style={{ marginTop: 12 }}>
          {state.phase === 'lobby' ? (
            mine ? (
              <p className="text-body" style={{ margin: 0 }} role="status">
                참가했다. 강사가 시작하면 여기서 진행된다.
              </p>
            ) : (
              <div className="flex items-center gap-md" style={{ flexWrap: 'wrap' }}>
                <Button onClick={() => void join()} disabled={busy || groupGate}>
                  참가
                </Button>
                <Caption>한 번만 누른다.</Caption>
              </div>
            )
          ) : state.phase === 'running' ? (
            mine && derived ? (
              <StudentGameInput kind={kind} state={state} mine={mine} derived={derived} now={now} uid={uid} nameOf={nameOf} onPatch={(p) => void patch(p)} />
            ) : (
              <p className="text-body" style={{ margin: 0 }}>
                이번 판에 참가하지 않았다. 결과를 기다린다.
              </p>
            )
          ) : null}
        </div>
      ) : null}
      {!teacher && !state ? (
        <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.7 }}>
          강사가 게임을 열면 여기에 참가 단추가 나타난다.
        </p>
      ) : null}

      {/* 강사 — 진행 상황 */}
      {teacher && state && state.phase === 'running' && derived ? (
        <div className="card" style={{ marginTop: 12 }}>
          <TeacherGameView kind={kind} derived={derived} nameOf={nameOf} />
          {state.phase === 'running' && !derived.finished && joined.length > 0 ? <Caption>참가 · {joined.map((p) => nameOf(p.uid)).join(', ')}</Caption> : null}
        </div>
      ) : null}
      {teacher && state && state.phase === 'lobby' && joined.length > 0 ? <Caption>참가 · {joined.map((p) => nameOf(p.uid)).join(', ')}</Caption> : null}

      {/* 결과 — 모든 화면이 같은 것을 본다 */}
      {result ? <GameResultCard result={result} nameOf={nameOf} uid={uid} /> : null}
    </ColorBlock>
  )
}

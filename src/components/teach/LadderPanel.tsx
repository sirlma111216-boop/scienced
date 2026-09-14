import { useEffect, useMemo, useState } from 'react'
import type { GameDef, LessonId } from '@/content/types'
import { apiPost } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import {
  buildLadder,
  emergencyDraw,
  pickPresentSlots,
  weightFromPresentCount,
  weightedDraw,
  winnersFromLadder,
} from '@/lib/ladder'
import type { AppUser, Enrollment, GroupRound, LadderState, Participation } from '@/lib/types'
import { Badge, Button, Caption, Card, ScrollX } from '@/components/ui'
import { PickerVisual } from '@/components/activity/PickerVisual'

/**
 * 강사용 추첨 패널.
 *
 * 규칙 (지시서 10.1):
 *  - 실행은 강사만. 시드는 서버가 만든다(로컬 모드에서는 시각 기반 씨앗으로 대체).
 *  - 정답·오답을 기준으로 뽑지 않는다.
 *  - 발표 횟수가 적은 사람의 확률을 높인다(기본 켬).
 *  - 추첨 전 제외, 추첨 후 재추첨, 수동 지정, 비상 추첨이 가능하다.
 *  - 씨앗·후보·가중치를 이 화면에서 확인할 수 있어야 한다.
 */

async function requestSeed(gameId: string, round: number): Promise<string> {
  // 난수를 클라이언트에서 만들지 않는다. 서버가 시드를 만든다.
  // 토큰은 apiPost 가 붙인다 — 예전에는 여기서 null 을 넘겨 서버가 늘 거절했다.
  const data = await apiPost<{ ok: boolean; seed?: string }>('/api/picker/draw', {
    gameId,
    round,
  })
  if (data.ok && data.seed) return data.seed
  // 서버에 닿지 않는 로컬 저장 모드에서는 강사 화면에서 한 번만 만들고 그대로 공유한다.
  // 씨앗을 화면에 표시하므로 재현성은 유지된다.
  return `${gameId}::r${round}::${Date.now()}`
}

export function LadderPanel({
  classId,
  lessonId,
  stepId,
  game,
  state,
  users,
  enrollments,
  participation,
  groupRound = null,
}: {
  classId: string
  lessonId: LessonId
  stepId: string
  game: GameDef
  state: LadderState | null
  users: AppUser[]
  /**
   * 이 클래스의 등록(active). 후보와 자리 수는 여기서 나온다.
   * ★ 예전에는 전역 사용자 목록의 학생 계정을 전부 후보로 삼았다 — 수강생이 두 명인 반에 자리가 16개 열렸다.
   *   콘솔 명단과 같은 원칙이다: 이 클래스에 등록한 사람만 센다.
   */
  enrollments: Enrollment[]
  participation: Participation[]
  /** 6차 모둠 나누기의 이 차시 모둠. candidateRule 이 groupRepresentative 면 모둠마다 한 명만 후보다. */
  groupRound?: GroupRound | null
}) {
  const { user, repo } = useAuth()
  const [excluded, setExcluded] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const students = useMemo<AppUser[]>(() => {
    const byUid = new Map(users.map((u) => [u.uid, u]))
    return enrollments
      .filter((e) => e.status === 'active')
      .map((e) => byUid.get(e.uid) ?? ({ uid: e.uid, nickname: e.nickname, role: 'student' } as AppUser))
  }, [users, enrollments])
  const candidates = useMemo(() => {
    const present = students.filter((s) => !excluded.includes(s.uid))
    /*
     * 모둠 대표 (2차 10절 · 6차 N.7). 모둠마다 한 명 — 발표 횟수가 가장 적은 사람이 대표 후보가 된다.
     * 그러면 사다리는 「어느 모둠이 발표하는가」를 뽑는 셈이 된다.
     */
    if (game.candidateRule === 'groupRepresentative' && groupRound) {
      const count = Object.fromEntries(participation.map((p) => [p.uid, p.presentCount]))
      const reps: AppUser[] = []
      for (const g of groupRound.groups) {
        const members = present.filter((s) => g.memberUids.includes(s.uid))
        if (members.length === 0) continue
        members.sort((a, b) => (count[a.uid] ?? 0) - (count[b.uid] ?? 0))
        reps.push(members[0])
      }
      if (reps.length > 0) return reps
    }
    return present
  }, [students, excluded, game.candidateRule, groupRound, participation])

  const nicknames = useMemo(
    () =>
      Object.fromEntries([
        ...users.map((u) => [u.uid, u.nickname || '이름 없음']),
        ...enrollments.filter((e) => e.nickname).map((e) => [e.uid, e.nickname]),
      ]),
    [users, enrollments],
  )

  const weights = useMemo(() => {
    const byUid = Object.fromEntries(participation.map((p) => [p.uid, p]))
    return Object.fromEntries(
      candidates.map((c) => [c.uid, weightFromPresentCount(byUid[c.uid]?.presentCount ?? 0)]),
    )
  }, [candidates, participation])

  const seatNames = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(state?.seats ?? {}).map(([k, uid]) => [k, nicknames[uid] ?? '참여자']),
      ),
    [state?.seats, nicknames],
  )

  /* 자리 수 = 후보 수. 후보가 한 명이어도 사다리는 두 칸이 있어야 그려진다. */
  const expectedColumns = Math.max(2, candidates.length)
  /*
   * ★ 저장된 판의 자리 수가 지금 후보 수와 다르면(예전 코드가 전역 학생 계정 수로 16칸을 열어 둔 것,
   *   또는 열어 둔 뒤 수강생이 바뀐 것) 그 판은 틀린 판이다. 아무도 자리를 잡기 전이면 바로 다시 연다.
   *   누군가 잡았으면 강사가 단추로 다시 연다 — 잡은 자리가 사라지므로 자동으로 하지 않는다.
   */
  const staleSeats = Boolean(state && state.phase === 'seating' && state.columns !== expectedColumns)
  const seatsTaken = Object.keys(state?.seats ?? {}).length
  useEffect(() => {
    if (!staleSeats || seatsTaken > 0 || busy || candidates.length === 0) return
    void open(state!.round)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleSeats, seatsTaken, candidates.length])

  async function open(round = 1) {
    if (!repo) return
    setBusy(true)
    const seed = await requestSeed(game.id, round)
    const columns = expectedColumns
    await repo.setLadder(classId, lessonId, game.id, {
      gameId: game.id,
      phase: 'seating',
      round,
      seed,
      columns,
      seats: {},
      presentSlots: pickPresentSlots(seed, columns, game.winnerCount),
      winnerUids: [],
      excludedUids: excluded,
      emergency: false,
      runAt: null,
    })
    setBusy(false)
  }

  async function lock() {
    if (!repo || !state) return
    await repo.setLadder(classId, lessonId, game.id, { ...state, phase: 'locked' })
  }

  async function reveal() {
    if (!repo || !state || !user) return
    setBusy(true)
    const ladder = buildLadder(state.seed, state.columns)
    const winnerSeats = winnersFromLadder(ladder, state.presentSlots)
    const winnerUids = winnerSeats
      .map((s) => state.seats?.[String(s)])
      .filter(Boolean) as string[]

    await repo.setLadder(classId, lessonId, game.id, {
      ...state,
      phase: 'running',
      winnerUids,
      runAt: Date.now(),
    })
    await repo.recordPick(classId, {
      id: `${game.id}-r${state.round}-${Date.now().toString(36)}`,
      lessonId,
      stepId,
      gameId: game.id,
      candidateUids: candidates.map((c) => c.uid),
      excludedUids: excluded,
      weights,
      winnerUids,
      seed: state.seed,
      runBy: user.uid,
      runAt: Date.now(),
      redrawOf: null,
    })
    // 발표 횟수를 올린다. 다음 추첨에서 이 사람들의 확률이 낮아진다.
    for (const uid of winnerUids) {
      const cur = participation.find((p) => p.uid === uid)
      await repo.bumpParticipation(classId, uid, {
        presentCount: (cur?.presentCount ?? 0) + 1,
        lastPresentedLessonId: lessonId,
      })
    }
    setBusy(false)
  }

  async function redraw() {
    if (!state) return
    await open(state.round + 1)
  }

  /** 사다리가 깨졌을 때. 사다리 없이 씨앗만으로 뽑는다. 결과는 여전히 재현 가능하다. */
  async function emergency() {
    if (!repo || !state || !user) return
    setBusy(true)
    const pool = candidates.map((c) => c.uid)
    const winnerUids = game.weightByFewPresentations
      ? weightedDraw(state.seed, weights, game.winnerCount)
      : emergencyDraw(state.seed, pool, game.winnerCount)
    await repo.setLadder(classId, lessonId, game.id, {
      ...state,
      phase: 'done',
      emergency: true,
      winnerUids,
      runAt: Date.now(),
    })
    await repo.recordPick(classId, {
      id: `${game.id}-emg-${Date.now().toString(36)}`,
      lessonId,
      stepId,
      gameId: game.id,
      candidateUids: pool,
      excludedUids: excluded,
      weights,
      winnerUids,
      seed: state.seed,
      runBy: user.uid,
      runAt: Date.now(),
      redrawOf: null,
    })
    setBusy(false)
  }

  return (
    <Card>
      <div className="flex items-center gap-md" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <h3 className="text-card-title" style={{ margin: 0 }}>
          {game.tab}
        </h3>
        <Badge>{game.mode}</Badge>
        {state ? <Badge>{state.phase}</Badge> : <Badge>준비 전</Badge>}
        {state?.emergency ? <Badge solid>비상 추첨</Badge> : null}
      </div>

      <p className="text-body-sm" style={{ opacity: 0.72 }}>
        {game.presenterAsk}
      </p>
      <p className="text-body-sm" style={{ margin: '8px 0 0' }}>
        자리 {expectedColumns}개 = 후보 {candidates.length}명 (이 클래스의 수강생{excluded.length > 0 ? ` · 제외 ${excluded.length}명` : ''})
      </p>
      {staleSeats && seatsTaken > 0 ? (
        <div role="alert" className="rounded-md bg-cream text-ink" style={{ padding: '10px 12px', marginTop: 8 }}>
          <p className="text-body-sm" style={{ margin: 0 }}>
            열려 있는 판은 자리가 {state!.columns}개인데 후보는 {candidates.length}명입니다. 이미 {seatsTaken}명이 자리를 잡아 자동으로 고치지 않았습니다 —
            아래 「판 다시 열기」를 누르면 자리 {expectedColumns}개로 새로 엽니다.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-xs" style={{ marginTop: 16 }}>
        <Button disabled={busy} onClick={() => void open(1)}>
          {state ? '판 다시 열기' : '판 열기'}
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !state || state.phase !== 'seating'}
          onClick={() => void lock()}
        >
          자리 잠그기
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !state || state.phase === 'seating'}
          onClick={() => void reveal()}
        >
          결과 보기
        </Button>
        <Button variant="secondary" disabled={busy || !state} onClick={() => void redraw()}>
          재추첨
        </Button>
        <Button variant="tertiary" disabled={busy || !state} onClick={() => void emergency()}>
          비상 추첨
        </Button>
      </div>

      {/* 후보·제외·가중치를 강사가 확인할 수 있어야 한다 */}
      <details style={{ marginTop: 24 }}>
        <summary className="caption" style={{ cursor: 'pointer' }}>
          후보 {candidates.length}명 · 제외 {excluded.length}명 · 가중치 확인
        </summary>
        <p className="text-body-sm" style={{ margin: '12px 0', opacity: 0.72 }}>
          발표 횟수가 적은 사람의 확률이 높습니다.
          {game.revealWeights
            ? ' 이 차시는 가중치를 학생 화면에도 그대로 공개합니다.'
            : ' 정답 여부는 추첨에 쓰지 않습니다.'}
        </p>
        <ScrollX>
          <table style={{ borderCollapse: 'collapse', minWidth: 420 }}>
            <thead>
              <tr>
                <th scope="col" className="caption" style={{ textAlign: 'left', padding: '4px 12px 4px 0' }}>
                  닉네임
                </th>
                <th scope="col" className="caption" style={{ textAlign: 'left', padding: '4px 12px 4px 0' }}>
                  발표 횟수
                </th>
                <th scope="col" className="caption" style={{ textAlign: 'left', padding: '4px 12px 4px 0' }}>
                  가중치
                </th>
                <th scope="col" className="caption" style={{ textAlign: 'left', padding: '4px 0' }}>
                  제외
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const p = participation.find((x) => x.uid === s.uid)
                const off = excluded.includes(s.uid)
                return (
                  <tr key={s.uid}>
                    <td className="text-body-sm" style={{ padding: '4px 12px 4px 0' }}>
                      {s.nickname || '이름 없음'}
                    </td>
                    <td className="font-mono text-body-sm" style={{ padding: '4px 12px 4px 0' }}>
                      {p?.presentCount ?? 0}
                    </td>
                    <td className="font-mono text-body-sm" style={{ padding: '4px 12px 4px 0' }}>
                      {off ? '—' : weightFromPresentCount(p?.presentCount ?? 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '4px 0' }}>
                      <label className="text-body-sm flex items-center gap-xxs">
                        <input
                          type="checkbox"
                          checked={off}
                          onChange={() =>
                            setExcluded((e) =>
                              off ? e.filter((u) => u !== s.uid) : [...e, s.uid],
                            )
                          }
                        />
                        제외
                      </label>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollX>
      </details>

      {state ? (
        <div style={{ marginTop: 24 }}>
          <PickerVisual
            mode={game.mode}
            seed={state.seed}
            columns={state.columns}
            seats={seatNames}
            presentSlots={state.presentSlots}
            mySeat={null}
            revealed={state.phase === 'running' || state.phase === 'done'}
            weights={weights}
            nicknames={nicknames}
          />
          {state.winnerUids.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <Caption>발표자</Caption>
              <p className="text-body-lg" style={{ fontWeight: 480, margin: '4px 0 0' }}>
                {state.winnerUids.map((u) => nicknames[u] ?? '참여자').join(', ')}
              </p>
              <p className="text-body-sm" style={{ marginTop: 8, opacity: 0.72 }}>
                {game.askLine}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

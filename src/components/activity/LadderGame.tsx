import { useEffect, useState } from 'react'
import type { GameDef, LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { buildLadder, winnersFromLadder } from '@/lib/ladder'
import type { LadderState } from '@/lib/types'
import { Badge, Button, ColorBlock, Notice, useReducedMotion } from '@/components/ui'
import { PickerVisual } from './PickerVisual'

/**
 * 학생용 발표자 뽑기.
 *
 * 상태 흐름: seating → locked → running → done
 * 자리 선점에 실패하면 "방금 다른 분이 그 자리를 가져갔습니다"를 띄운다.
 *
 * 접근성 (지시서 10.1):
 *  - prefers-reduced-motion 이면 애니메이션을 건너뛰고 결과를 즉시 보인다.
 *  - 결과는 aria-live 로 알린다.
 *  - 마우스 없이 실행·확인이 가능하다. 자리 고르기는 버튼이다.
 */

export function LadderGame({
  classId,
  lessonId,
  game,
  state,
  nicknames,
  weights,
}: {
  classId: string
  lessonId: LessonId
  game: GameDef
  state: LadderState | null
  /** uid → 닉네임 */
  nicknames: Record<string, string>
  /** uid → 가중치. 14·18강은 이것을 학생 화면에 그대로 공개한다. */
  weights?: Record<string, number>
}) {
  const { user, repo } = useAuth()
  const reduced = useReducedMotion()
  const [conflict, setConflict] = useState<string | null>(null)
  const [animating, setAnimating] = useState(false)

  const revealed = state?.phase === 'running' || state?.phase === 'done'

  useEffect(() => {
    if (!revealed) return
    if (reduced) {
      // 애니메이션을 건너뛰고 결과를 바로 보여 준다.
      setAnimating(false)
      return
    }
    setAnimating(true)
    const t = window.setTimeout(() => setAnimating(false), 1200)
    return () => window.clearTimeout(t)
  }, [revealed, reduced])

  if (!state) {
    return (
      <ColorBlock tone="cream">
        <p className="eyebrow">{game.tab}</p>
        <p className="text-body-lg" style={{ marginTop: 12 }}>
          강사가 판을 열면 여기에 자리가 나타납니다.
        </p>
      </ColorBlock>
    )
  }

  const mySeat = Object.entries(state.seats ?? {}).find(([, uid]) => uid === user?.uid)?.[0]
  const ladder = buildLadder(state.seed, state.columns)
  const winners = revealed ? winnersFromLadder(ladder, state.presentSlots) : []
  const iWon = mySeat != null && winners.includes(Number(mySeat))

  async function claim(seat: number) {
    if (!repo || !user) return
    setConflict(null)
    const ok = await repo.claimLadderSeat(classId, lessonId, game.id, seat, user.uid)
    if (!ok) setConflict('방금 다른 분이 그 자리를 가져갔습니다. 다른 자리를 골라 주세요.')
  }

  const seatNames: Record<string, string> = Object.fromEntries(
    Object.entries(state.seats ?? {}).map(([k, uid]) => [k, nicknames[uid] ?? '참여자']),
  )

  return (
    <ColorBlock tone="lime">
      <div className="flex items-center gap-md" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <p className="eyebrow" style={{ margin: 0 }}>
          {game.tab}
        </p>
        <Badge>
          {state.phase === 'seating'
            ? '자리 고르는 중'
            : state.phase === 'locked'
              ? '자리 잠김'
              : state.phase === 'running'
                ? '결과 열림'
                : '끝'}
        </Badge>
        {state.round > 1 ? <Badge>{state.round}번째 판</Badge> : null}
        {state.emergency ? <Badge>비상 추첨</Badge> : null}
      </div>

      <p className="text-subhead" style={{ marginTop: 0, whiteSpace: 'pre-line' }}>
        {game.lead}
      </p>
      <p className="text-body-sm" style={{ opacity: 0.72, marginTop: 8 }}>
        {game.hint}
      </p>

      {conflict ? (
        <div role="alert" style={{ marginTop: 16 }}>
          <Notice tone="coral">
            <p className="text-body-sm">{conflict}</p>
          </Notice>
        </div>
      ) : null}

      {state.phase === 'seating' ? (
        <div style={{ marginTop: 24 }}>
          <p className="caption" style={{ marginBottom: 8 }}>
            자리 고르기 — 한 사람이 한 자리입니다. 마우스 없이 Tab 과 Enter 로도 고를 수 있습니다
          </p>
          <div className="flex flex-wrap gap-xs">
            {Array.from({ length: state.columns }, (_, i) => {
              const taken = state.seats?.[String(i)]
              const isMine = taken === user?.uid
              return (
                <button
                  key={i}
                  type="button"
                  className="tab"
                  disabled={Boolean(taken) && !isMine}
                  aria-pressed={isMine}
                  data-selected={isMine}
                  onClick={() => void claim(i)}
                  style={{ minWidth: 64 }}
                >
                  <span className="font-mono">{i + 1}</span>
                  {taken ? (
                    <span className="text-caption" style={{ marginLeft: 6 }}>
                      {isMine ? '내 자리' : seatNames[String(i)]}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 24, background: '#fff', borderRadius: 24, padding: 16 }}>
        <PickerVisual
          mode={game.mode}
          seed={state.seed}
          columns={state.columns}
          seats={seatNames}
          presentSlots={state.presentSlots}
          mySeat={mySeat != null ? Number(mySeat) : null}
          revealed={revealed && !animating}
          weights={game.revealWeights ? weights : undefined}
          nicknames={nicknames}
        />
      </div>

      {/* 결과는 화면 읽기 프로그램에도 알린다 */}
      <div role="status" aria-live="polite" style={{ marginTop: 16 }}>
        {revealed && !animating ? (
          <p className="text-body-lg" style={{ fontWeight: 480 }}>
            {winners.length === 0
              ? '아직 발표자가 정해지지 않았습니다.'
              : `발표: ${winners.map((w) => seatNames[String(w)] ?? `${w + 1}번 자리`).join(', ')}`}
          </p>
        ) : revealed ? (
          <p className="text-body-sm">사다리를 내려가는 중…</p>
        ) : null}
      </div>

      {revealed && !animating && iWon ? (
        <Notice tone="mint">
          <p className="text-body" style={{ fontWeight: 480 }}>
            {game.askLine}
          </p>
          <p className="text-body-sm" style={{ marginTop: 8 }}>
            답이 맞아서 뽑힌 것이 아닙니다. 이유만 말해 주시면 됩니다.
          </p>
        </Notice>
      ) : null}

      {state.excludedUids?.length ? (
        <p className="caption" style={{ marginTop: 12 }}>
          제외된 사람 {state.excludedUids.length}명
        </p>
      ) : null}
    </ColorBlock>
  )
}

export { Button }

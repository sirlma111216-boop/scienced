import { useEffect, useMemo, useState } from 'react'
import type { LessonId } from '@/content/types'
import { gameDealsCards, gameTakesInput, type GroupGameDef } from '@/content/group-games'
import { useAuth } from '@/lib/auth'
import { cardFor, changedSinceLast, metBefore } from '@/lib/groups'
import { makeRng } from '@shared/groups-core'
import type { GroupInput, GroupRound } from '@/lib/types'
import { Badge, Button, Caption, ColorBlock, Notice, useReducedMotion } from '@/components/ui'

/**
 * 학생 — 모둠 나누기 게임 (6차 지시서 작업 O·P.3).
 *
 *   확정 전   게임 입력 (낱말·발화·예상을 고른다) — 배분형 게임은 「카드가 곧 배달됩니다」
 *   확정 뒤   연출 → 결과 → 내 모둠 카드
 *
 * ★ 게임이 결과를 정하는 척하지 않는다 (N.6). 선택이 배정에 어떻게 반영되는지를 그대로 적는다.
 * ★ 연출은 마우스 없이 진행된다. 결과는 그림과 함께 글 목록으로도 나온다. aria-live 로 알린다.
 * ★ prefers-reduced-motion 이면 연출을 건너뛰고 결과를 바로 보인다.
 */
export function GroupGame({
  classId,
  lessonId,
  game,
  round,
  rounds,
  nicknames,
}: {
  classId: string
  lessonId: LessonId
  game: GroupGameDef
  /** 이 차시의 확정된 회차. 없으면 아직 입력 단계다. */
  round: GroupRound | null
  /** 「처음 만나는 분」 판정에 쓰는 전체 회차 */
  rounds: GroupRound[]
  nicknames: Record<string, string>
}) {
  const { repo, user } = useAuth()
  const [mine, setMine] = useState<GroupInput | null>(null)
  const [choice, setChoice] = useState('')
  const [second, setSecond] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!repo || !user) return
    return repo.watchMyGroupInput(classId, lessonId, user.uid, setMine)
  }, [repo, user, classId, lessonId])

  useEffect(() => {
    if (!mine) return
    setChoice(mine.choice)
    setSecond(mine.second ?? '')
    setSaved(true)
  }, [mine])

  async function submit() {
    if (!repo || !user) return
    if (!choice) {
      setError('하나를 골라 주세요.')
      return
    }
    if (game.secondChoice && second && second === choice) {
      setError('2지망은 1지망과 달라야 합니다.')
      return
    }
    setError(null)
    try {
      await repo.setGroupInput(classId, {
        uid: user.uid,
        lessonId,
        gameId: game.id,
        choice,
        second: game.secondChoice ? second || null : null,
        updatedAt: Date.now(),
      })
      setSaved(true)
    } catch (e) {
      console.error('[모둠 게임] 선택을 저장하지 못했다:', e)
      setError('저장하지 못했습니다. 잠시 뒤 다시 눌러 보세요.')
    }
  }

  if (round) {
    return <GroupResult game={game} round={round} rounds={rounds} nicknames={nicknames} uid={user?.uid ?? ''} />
  }

  return (
    <section aria-labelledby="group-game-title" style={{ marginBottom: 40 }}>
      <ColorBlock tone="pink">
        <p className="eyebrow">모둠 나누기 · {game.title}</p>
        <h2 id="group-game-title" className="text-headline" style={{ margin: '12px 0 0' }}>
          {game.doNow}
        </h2>
        <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.85 }}>
          {game.effectScope}
        </p>

        {gameTakesInput(game) ? (
          <div style={{ marginTop: 20 }}>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="caption">{game.secondChoice ? '1지망' : '하나만'}</legend>
              <div className="flex flex-wrap gap-xs" style={{ marginTop: 8 }}>
                {game.options!.map((o) => (
                  <label
                    key={o.id}
                    className="text-body-sm rounded-md"
                    style={{
                      padding: '10px 14px',
                      background: '#fff',
                      boxShadow: `inset 0 0 0 ${choice === o.id ? 2 : 1}px ${choice === o.id ? '#000' : '#e6e6e6'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name={`group-choice-${game.id}`}
                      value={o.id}
                      checked={choice === o.id}
                      onChange={() => {
                        setChoice(o.id)
                        setSaved(false)
                      }}
                      style={{ marginRight: 6 }}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
            {game.secondChoice ? (
              <div style={{ marginTop: 12 }}>
                <label htmlFor={`second-${game.id}`} className="caption">
                  2지망 — 1지망이 몰리면 이쪽으로
                </label>
                <select
                  id={`second-${game.id}`}
                  className="field"
                  style={{ marginTop: 6, maxWidth: 420 }}
                  value={second}
                  onChange={(e) => {
                    setSecond(e.target.value)
                    setSaved(false)
                  }}
                >
                  <option value="">고르지 않음</option>
                  {game.options!.filter((o) => o.id !== choice).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="text-body-sm" style={{ fontWeight: 480, marginTop: 8 }}>
                ⚠ {error}
              </p>
            ) : null}
            <div className="flex items-center gap-md" style={{ marginTop: 16 }}>
              <Button onClick={() => void submit()}>{saved ? '다시 고르기' : '고르기'}</Button>
              {saved ? (
                <span className="caption" role="status">
                  저장됨 — 강사가 모둠을 나누면 여기에 결과가 뜹니다
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 20 }}>
            <Notice tone="cream">
              <p className="text-body-sm" style={{ margin: 0 }}>
                {gameDealsCards(game) ? '카드가 곧 배달됩니다. 강사가 모둠을 나누면 여러분의 카드가 여기에 보입니다.' : '강사가 모둠을 나누면 여기에 결과가 뜹니다.'}
              </p>
            </Notice>
          </div>
        )}
      </ColorBlock>
    </section>
  )
}

/* ═══════════════════ 결과 ═══════════════════ */

type Phase = 'mine' | 'scatter' | 'byChoice' | 'groups'

function phasesFor(game: GroupGameDef): Phase[] {
  switch (game.mode) {
    case 'heterogeneous':
    case 'oneFromEachFork':
      return ['scatter', 'byChoice', 'groups']
    case 'homogeneous':
      return ['scatter', 'groups']
    default:
      return ['mine', 'groups']
  }
}

function GroupResult({
  game,
  round,
  rounds,
  nicknames,
  uid,
}: {
  game: GroupGameDef
  round: GroupRound
  rounds: GroupRound[]
  nicknames: Record<string, string>
  uid: string
}) {
  const reduced = useReducedMotion()
  const phases = useMemo(() => phasesFor(game), [game])
  const [step, setStep] = useState(reduced ? phases.length - 1 : 0)
  const [playing, setPlaying] = useState(false)
  const final = step >= phases.length - 1
  /* reduced-motion 은 화면이 그려진 뒤에 알 수 있다. 켜지면 결과로 바로 간다. */
  useEffect(() => {
    if (reduced) setStep(phases.length - 1)
  }, [reduced, phases.length])
  const phase = phases[Math.min(step, phases.length - 1)]

  const myGroup = round.groups.find((g) => g.memberUids.includes(uid)) ?? null
  const met = useMemo(() => metBefore(uid, rounds, round.id), [uid, rounds, round.id])
  const changed = changedSinceLast(uid, round, rounds)
  const myCard = myGroup ? cardFor(game, myGroup, uid) : null

  /* 연출 — 단계를 차례로 넘긴다. 누르면 그다음. 자동으로도 넘어간다. */
  useEffect(() => {
    if (!playing || final) return
    const t = setTimeout(() => setStep((s) => s + 1), 1400)
    return () => clearTimeout(t)
  }, [playing, step, final])

  const everyone = round.groups.flatMap((g) => g.memberUids)
  /* 자리 — 단계마다 다르다. 시드로 흩뿌려 같은 회차는 늘 같은 그림이다. */
  const positions = useMemo(() => {
    const rng = makeRng(`${round.seed}::reveal`)
    const scatter = Object.fromEntries(everyone.map((u) => [u, { x: 6 + rng() * 82, y: 8 + rng() * 74 }]))
    const byChoice: Record<string, { x: number; y: number }> = {}
    const cols = game.options?.length ?? 1
    const counters: Record<string, number> = {}
    for (const u of everyone) {
      /* 입력형 게임은 모둠 이름·낱말이 아니라 각자 고른 것으로 줄을 세워야 하지만
         학생 화면은 남의 선택을 읽지 못한다 — 모둠 안 위치로 갈래를 대신 그린다. */
      const gi = round.groups.findIndex((g) => g.memberUids.includes(u))
      const col = cols > 1 ? gi % cols : 0
      const k = (counters[col] = (counters[col] ?? 0) + 1)
      byChoice[u] = { x: 8 + (84 * (col + 0.5)) / cols, y: 10 + (k - 1) * 12 }
    }
    const groups: Record<string, { x: number; y: number }> = {}
    round.groups.forEach((g, gi) => {
      g.memberUids.forEach((u, i) => {
        groups[u] = { x: 6 + (88 * (gi + 0.5)) / round.groups.length, y: 18 + i * 13 }
      })
    })
    return { scatter, byChoice, groups }
  }, [everyone, round, game.options?.length])

  const pos = (u: string) => (phase === 'groups' ? positions.groups : phase === 'byChoice' ? positions.byChoice : positions.scatter)[u]

  return (
    <section aria-labelledby="group-result-title" style={{ marginBottom: 40 }}>
      <ColorBlock tone="pink">
        <p className="eyebrow">모둠 나누기 · {game.title}</p>
        {/*
          결과가 나오면 「내가 몇 모둠인가」가 화면에서 가장 큰 글자다.
          ★ 처음에는 카드 안의 작은 배지뿐이어서 학생이 결과 화면에서 자기 모둠 번호를 찾아야 했다.
        */}
        {final && myGroup ? (
          <>
            <h2 id="group-result-title" className="text-display-lg" style={{ margin: '12px 0 0', fontWeight: 600 }}>
              {myGroup.id}모둠
            </h2>
            <p className="text-subhead" style={{ margin: '4px 0 0' }}>
              {myGroup.name} · 나는 <strong>{myGroup.id}모둠</strong>입니다
            </p>
          </>
        ) : (
          <h2 id="group-result-title" className="text-headline" style={{ margin: '12px 0 0' }}>
            {final ? '모둠이 정해졌습니다' : phase === 'mine' ? '여러분에게 배달된 카드' : '결과를 봅니다'}
          </h2>
        )}
        <p className="text-body-sm" style={{ marginTop: 8, opacity: 0.85 }}>
          {game.effectScope}
        </p>

        {/* 배분형 — 내 카드 */}
        {myCard ? (
          <div className="card" style={{ marginTop: 16, maxWidth: 520 }}>
            <Caption>내 카드 · {myCard.card.label}</Caption>
            <p className="text-body-lg" style={{ margin: '8px 0 0', fontWeight: 480 }}>
              {myCard.card.text}
            </p>
            {myCard.set.tag ? <Badge>{myCard.set.tag}</Badge> : null}
          </div>
        ) : null}

        {/* 연출 — 그림. 아래 글 목록이 같은 내용을 담는다. */}
        {!reduced && phase !== 'mine' ? (
          <div
            aria-hidden="true"
            className="rounded-md"
            style={{ position: 'relative', height: 300, marginTop: 16, background: '#fff', boxShadow: 'inset 0 0 0 1px #e6e6e6', overflow: 'hidden' }}
          >
            {phase === 'groups'
              ? round.groups.map((g, gi) => (
                  <span
                    key={g.id}
                    className="text-body-sm"
                    style={{
                      position: 'absolute',
                      left: `${6 + (88 * (gi + 0.5)) / round.groups.length}%`,
                      top: 8,
                      transform: 'translateX(-50%)',
                      whiteSpace: 'nowrap',
                      fontWeight: g.id === myGroup?.id ? 700 : 400,
                      opacity: g.id === myGroup?.id ? 1 : 0.7,
                    }}
                  >
                    {g.id}모둠 · {g.name}
                  </span>
                ))
              : null}
            {everyone.map((u) => {
              const p = pos(u)
              const isMe = u === uid
              return (
                <span
                  key={u}
                  className="text-body-sm"
                  style={{
                    position: 'absolute',
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    transform: 'translate(-50%, -50%)',
                    transition: 'left 900ms ease, top 900ms ease',
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: isMe ? '#000' : '#fff',
                    color: isMe ? '#fff' : '#000',
                    boxShadow: '0 0 0 1px #000',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {nicknames[u] ?? '이름 없음'}
                </span>
              )
            })}
          </div>
        ) : null}

        {!final ? (
          <div className="flex items-center gap-md" style={{ marginTop: 16 }}>
            <Button
              onClick={() => {
                setPlaying(true)
                setStep((s) => s + 1)
              }}
            >
              {phase === 'mine' ? '맞춰 보기' : playing ? '다음' : '결과 보기'}
            </Button>
            <Button variant="secondary" onClick={() => setStep(phases.length - 1)}>
              바로 결과로
            </Button>
          </div>
        ) : null}
        {!final ? (
          <p className="text-body-sm" style={{ marginTop: 8, opacity: 0.7 }}>
            {game.revealText}
          </p>
        ) : null}

        {/* 내 모둠 카드 — 늘 글로. */}
        {final ? (
          <div aria-live="polite" style={{ marginTop: 20 }}>
            {myGroup ? (
              <div className="card">
                <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
                  <Badge solid>{myGroup.id}모둠</Badge>
                  <h3 className="text-card-title" style={{ margin: 0 }}>
                    {myGroup.name}
                  </h3>
                </div>
                <ul className="flex flex-wrap gap-xs" style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
                  {myGroup.memberUids.map((u) => (
                    <li key={u} className="text-body-sm" style={{ padding: '6px 10px', boxShadow: 'inset 0 0 0 1px #e6e6e6', borderRadius: 999 }}>
                      {nicknames[u] ?? '이름 없음'}
                      {u === uid ? ' (나)' : ''}
                      {u !== uid && !met.has(u) ? (
                        <span className="caption" style={{ marginLeft: 6 }}>
                          처음 만나는 분
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {changed !== null ? (
                  <p className="text-body-sm" style={{ margin: '12px 0 0', opacity: 0.8 }}>
                    지난번과 {changed}분이 바뀌었습니다.
                  </p>
                ) : null}
                {myCard ? (
                  <AssembledSet game={game} group={myGroup} nicknames={nicknames} />
                ) : null}
              </div>
            ) : (
              <Notice tone="cream">
                <p className="text-body-sm" style={{ margin: 0 }}>
                  이번 회차 모둠에 아직 자리가 없습니다. 강사에게 말하면 넣어 줍니다.
                </p>
              </Notice>
            )}
            <details style={{ marginTop: 12 }}>
              <summary className="caption" style={{ cursor: 'pointer' }}>
                모든 모둠 (글로 보기)
              </summary>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                {round.groups.map((g) => (
                  <li key={g.id} className="text-body-sm">
                    <strong>{g.id}. {g.name}</strong> — {g.memberUids.map((u) => nicknames[u] ?? '이름 없음').join(', ')}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ) : null}
      </ColorBlock>
    </section>
  )
}

/** 배분형 게임 — 모둠이 모으면 한 벌이 된다. 문장 · 모형 부품 · 비유 카드. */
function AssembledSet({ game, group, nicknames }: { game: GroupGameDef; group: { memberUids: string[]; cardSetId?: string }; nicknames: Record<string, string> }) {
  const set = game.cardSets?.find((s) => s.id === group.cardSetId)
  if (!set) return null
  const sentence = game.mode === 'assembleSentence'
  return (
    <div style={{ marginTop: 16 }}>
      <Caption>{sentence ? '완성된 문장' : game.mode === 'distributeRoles' ? '모인 부품 — 모형 틀' : '한 벌 — 견주는 대상 · 맞는 곳 · 틀리는 곳'}</Caption>
      {sentence ? (
        <p className="text-body-lg" style={{ margin: '8px 0 0', fontWeight: 480 }}>
          {set.cards.map((c) => c.text).join(' ')}
          {set.tag ? <span className="caption" style={{ marginLeft: 8 }}>{set.tag}</span> : null}
        </p>
      ) : (
        <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          {set.cards.map((c, i) => {
            const holder = group.memberUids[i % Math.max(1, group.memberUids.length)]
            return (
              <li key={c.label} className="text-body-sm" style={{ marginBottom: 4 }}>
                <strong>{c.label}</strong> · {c.text}
                {holder && i < group.memberUids.length ? <span style={{ opacity: 0.6 }}> — {nicknames[holder] ?? ''}</span> : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

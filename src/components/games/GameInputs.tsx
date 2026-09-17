import { useState } from 'react'
import type { GameKind } from '@/content/types'
import type { Derived } from '@/lib/game-core'
import type { GameInput, GameState } from '@/lib/types'
import { Badge, Button, Caption } from '@/components/ui'

/**
 * 게임별 학생 입력 (8차 6.2). 값의 모양은 game-core 의 파서와 같다.
 *
 *   bomb {passes:number[]} · closest/estimate/sum {n} · doors {doors:{round:door}} · mine {cell}
 *   late/sync/flash {t} · rps {hands:{key:hand}} · relay {chars:{pos:char}, times:{pos:t}} · bingo {claim:t}
 *
 * 규칙은 한 줄이고 단추는 게임에 필요한 것뿐이다. 반응 시각은 서버 시각(now)이다.
 */
export function StudentGameInput({
  kind,
  state,
  mine,
  derived,
  now,
  uid,
  nameOf,
  onPatch,
}: {
  kind: GameKind
  state: GameState
  mine: GameInput
  derived: Derived
  now: number
  uid: string
  nameOf: (uid: string) => string
  onPatch: (patch: Record<string, unknown>) => void
}) {
  const v = (mine.value && typeof mine.value === 'object' ? mine.value : {}) as Record<string, unknown>
  const view = derived.view
  switch (kind) {
    case 'bomb': {
      const holder = view.holder as string | null
      const iHold = holder === uid
      return (
        <div>
          <p className="text-body-lg" style={{ margin: 0, fontWeight: 480 }}>
            {iHold ? '폭탄이 내 손에 있다' : `폭탄은 ${holder ? nameOf(holder) : '아직 아무도'} 손에 있다`}
          </p>
          <Caption>언제 터질지는 아무도 모른다. 넘어간 횟수 {String(view.passes ?? 0)}</Caption>
          {iHold ? (
            <div style={{ marginTop: 10 }}>
              <Button onClick={() => onPatch({ passes: [...((v.passes as number[] | undefined) ?? []), now] })}>넘기기</Button>
            </div>
          ) : null}
        </div>
      )
    }
    case 'closest':
    case 'estimate':
      return <NumberPick label={kind === 'closest' ? '1부터 100 사이 숫자 하나' : `「${String(view.question ?? '')}」을 고른 사람은 몇 명일까`} min={kind === 'closest' ? 1 : 0} max={kind === 'closest' ? 100 : 99} value={typeof v.n === 'number' ? v.n : null} onPick={(n) => onPatch({ n })} />
    case 'sum':
      return (
        <div>
          <p className="text-body" style={{ margin: 0 }}>
            말하지 말고 1에서 5 중 하나를 고른다.
          </p>
          <div className="flex flex-wrap gap-xs" style={{ marginTop: 10 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Button key={n} variant={v.n === n ? 'primary' : 'secondary'} disabled={typeof v.n === 'number'} onClick={() => onPatch({ n })}>
                {n}
              </Button>
            ))}
          </div>
          {typeof v.n === 'number' ? <Caption>냈다 — {v.n}</Caption> : null}
        </div>
      )
    case 'doors': {
      const round = Number(view.round ?? 0)
      const alive = (view.alive as string[] | undefined) ?? []
      const chosen = (v.doors as Record<string, number> | undefined)?.[String(round)]
      if (!alive.includes(uid)) return <p className="text-body">이번 판에서 나갔다. 남은 사람 {alive.length}명의 결과를 기다린다.</p>
      return (
        <div>
          <p className="text-body" style={{ margin: 0 }}>
            {round + 1}번째 문. 남은 사람 {alive.length}명. 열린 문을 고르면 통과한다.
          </p>
          <div className="flex flex-wrap gap-xs" style={{ marginTop: 10 }}>
            {[1, 2, 3].map((d) => (
              <Button key={d} variant={chosen === d ? 'primary' : 'secondary'} disabled={typeof chosen === 'number'} onClick={() => onPatch({ doors: { ...((v.doors as Record<string, number> | undefined) ?? {}), [String(round)]: d } })}>
                문 {d}
              </Button>
            ))}
          </div>
          {typeof chosen === 'number' ? <Caption>문 {chosen}을 골랐다. 모두 고르면 문이 열린다.</Caption> : null}
        </div>
      )
    }
    case 'mine': {
      const cell = typeof v.cell === 'number' ? v.cell : null
      return (
        <div>
          <p className="text-body" style={{ margin: 0 }}>
            5×5 에서 한 칸을 고른다. 지뢰는 셋이다.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 44px)', gap: 6, marginTop: 10 }}>
            {Array.from({ length: 25 }, (_, i) => (
              <button
                key={i}
                type="button"
                className="tab"
                aria-pressed={cell === i}
                data-selected={cell === i}
                disabled={cell !== null}
                onClick={() => onPatch({ cell: i })}
                style={{ minHeight: 44, minWidth: 44, padding: 0, justifyContent: 'center' }}
                aria-label={`${Math.floor(i / 5) + 1}행 ${(i % 5) + 1}열`}
              >
                {cell === i ? '●' : ''}
              </button>
            ))}
          </div>
        </div>
      )
    }
    case 'late': {
      const deadline = view.deadline as number | null
      const left = deadline ? Math.max(0, deadline - now) : null
      const pressed = typeof v.t === 'number'
      return (
        <div>
          <p className="text-display-lg font-mono" style={{ margin: 0 }} aria-live="off">
            {left === null ? '—' : (left / 1000).toFixed(1)}
          </p>
          <Caption>0 이 되기 전에 가장 늦게 누른 사람이 발표한다. 0 이 지난 뒤 누르면 탈락이다.</Caption>
          <div style={{ marginTop: 10 }}>
            <Button disabled={pressed} onClick={() => onPatch({ t: now })}>
              {pressed ? '눌렀다' : '누르기'}
            </Button>
          </div>
        </div>
      )
    }
    case 'sync':
      return (
        <div>
          <p className="text-body" style={{ margin: 0 }}>
            모둠원 전원이 「지금」을 동시에 누른다. 편차가 가장 작은 모둠이 발표한다.
          </p>
          <div style={{ marginTop: 10 }}>
            <Button disabled={typeof v.t === 'number'} onClick={() => onPatch({ t: now })}>
              {typeof v.t === 'number' ? '눌렀다' : '지금'}
            </Button>
          </div>
        </div>
      )
    case 'flash': {
      const green = view.greenAt !== null && view.greenAt !== undefined
      const pressed = typeof v.t === 'number'
      return (
        <div>
          <div role="img" aria-label={green ? '초록' : '회색'} style={{ height: 96, borderRadius: 16, background: green ? '#2e8b57' : '#d9d9d9', transition: 'none' }} />
          <Caption>초록으로 바뀌는 순간 누른다. 먼저 누르면 무효다.</Caption>
          <div style={{ marginTop: 10 }}>
            <Button disabled={pressed} onClick={() => onPatch({ t: now })}>
              {pressed ? '눌렀다' : '지금'}
            </Button>
          </div>
        </div>
      )
    }
    case 'rps': {
      const matches = (view.matches as Array<{ round: number; a: string; b: string | null; winner: string | null; key: string }> | undefined) ?? []
      const mineMatch = [...matches].reverse().find((m) => (m.a === uid || m.b === uid) && !m.winner)
      const alive = (view.alive as string[] | undefined) ?? []
      if (!mineMatch) {
        return <p className="text-body">{alive.includes(uid) ? '다음 상대를 기다린다.' : '이번 판에서 나갔다. 결과를 기다린다.'}</p>
      }
      const opp = mineMatch.a === uid ? mineMatch.b : mineMatch.a
      const hands = (v.hands as Record<string, string> | undefined) ?? {}
      const myHand = hands[mineMatch.key]
      return (
        <div>
          <p className="text-body" style={{ margin: 0 }}>
            상대 {opp ? nameOf(opp) : '없음'} · {mineMatch.round + 1}라운드
          </p>
          <div className="flex flex-wrap gap-xs" style={{ marginTop: 10 }}>
            {(['scissors', 'rock', 'paper'] as const).map((h) => (
              <Button key={h} variant={myHand === h ? 'primary' : 'secondary'} disabled={Boolean(myHand)} onClick={() => onPatch({ hands: { ...hands, [mineMatch.key]: h } })}>
                {h === 'scissors' ? '가위' : h === 'rock' ? '바위' : '보'}
              </Button>
            ))}
          </div>
          {myHand ? <Caption>냈다. 상대가 내면 결과가 나온다. 비기면 다시 낸다.</Caption> : null}
        </div>
      )
    }
    case 'relay': {
      const word = String(view.word ?? '')
      const rows = (view.rows as Array<{ id: string; name: string; done: number; order: string[]; turn: string | null }> | undefined) ?? []
      const row = rows.find((r) => r.order.includes(uid))
      if (!row) return <p className="text-body">모둠이 없어 이 게임에 들 수 없다.</p>
      return <RelayInput word={word} row={row} uid={uid} nameOf={nameOf} now={now} value={v} onPatch={onPatch} />
    }
    case 'bingo': {
      const boards = (view.boards as Record<string, string[]> | undefined) ?? {}
      const board = boards[uid] ?? []
      const drawn = new Set((view.drawn as string[] | undefined) ?? [])
      const claimed = typeof v.claim === 'number'
      return (
        <div>
          <p className="text-body" style={{ margin: 0 }}>
            5초마다 하나씩 뽑힌다. 한 줄이 되면 「빙고」를 누른다.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 10, maxWidth: 360 }}>
            {board.map((item) => (
              <div key={item} className="text-body-sm rounded-md" style={{ padding: '10px 8px', textAlign: 'center', background: drawn.has(item) ? '#111' : '#f1f1f1', color: drawn.has(item) ? '#fff' : '#000' }}>
                {item}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <Button disabled={claimed} onClick={() => onPatch({ claim: now })}>
              {claimed ? '빙고를 외쳤다' : '빙고'}
            </Button>
          </div>
        </div>
      )
    }
    default:
      return <Caption>이 게임은 여기서 조작할 것이 없다.</Caption>
  }
  void state
}

function NumberPick({ label, min, max, value, onPick }: { label: string; min: number; max: number; value: number | null; onPick: (n: number) => void }) {
  const [draft, setDraft] = useState('')
  if (value !== null) {
    return (
      <p className="text-body" style={{ margin: 0 }}>
        냈다 — <strong className="font-mono">{value}</strong>. 모두 내면 결과가 나온다.
      </p>
    )
  }
  const n = Number(draft)
  const ok = draft !== '' && Number.isInteger(n) && n >= min && n <= max
  return (
    <div>
      <label htmlFor="game-number" className="text-body" style={{ display: 'block' }}>
        {label}
      </label>
      <div className="flex items-center gap-xs" style={{ marginTop: 8 }}>
        <input id="game-number" className="field" type="number" inputMode="numeric" min={min} max={max} value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: 120 }} />
        <Button disabled={!ok} onClick={() => onPick(n)}>
          내기
        </Button>
      </div>
    </div>
  )
}

function RelayInput({ word, row, uid, nameOf, now, value, onPatch }: { word: string; row: { done: number; order: string[]; turn: string | null; name: string }; uid: string; nameOf: (uid: string) => string; now: number; value: Record<string, unknown>; onPatch: (p: Record<string, unknown>) => void }) {
  const [ch, setCh] = useState('')
  const pos = row.done
  const myTurn = row.turn === uid && pos < word.length
  const chars = (value.chars as Record<string, string> | undefined) ?? {}
  const times = (value.times as Record<string, number> | undefined) ?? {}
  return (
    <div>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge solid>{row.name}</Badge>
        <span className="font-mono text-headline">{word.split('').map((c, i) => (i < row.done ? c : '＿')).join(' ')}</span>
      </div>
      <Caption>글자 수 {word.length}. 순서대로 한 글자씩. 틀리면 그 자리에 다시 넣는다.</Caption>
      {pos >= word.length ? (
        <p className="text-body" style={{ margin: '8px 0 0', fontWeight: 480 }}>
          완성했다.
        </p>
      ) : myTurn ? (
        <div className="flex items-center gap-xs" style={{ marginTop: 10 }}>
          <input className="field" aria-label={`${pos + 1}번째 글자`} maxLength={1} value={ch} onChange={(e) => setCh(e.target.value.slice(-1))} style={{ width: 72, textAlign: 'center' }} />
          <Button
            disabled={!ch}
            onClick={() => {
              onPatch({ chars: { ...chars, [String(pos)]: ch }, times: { ...times, [String(pos)]: now } })
              setCh('')
            }}
          >
            넣기
          </Button>
        </div>
      ) : (
        <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.8 }}>
          지금은 {row.turn ? nameOf(row.turn) : '—'} 차례다.
        </p>
      )}
    </div>
  )
}

/** 1·2강 옛 게임 — 학생이 자리(봉투)를 고른다. 한 사람이 한 자리 */
export function SeatPicker({ columns, seats, seatNames, uid, envelope, onClaim }: { columns: number; seats: Record<string, string>; seatNames: Record<string, string>; uid: string; envelope: boolean; onClaim: (seat: number) => void }) {
  return (
    <div style={{ marginTop: 16 }}>
      <Caption>{envelope ? '봉투 고르기' : '자리 고르기'} — 한 사람이 하나다</Caption>
      <div className="flex flex-wrap gap-xs" style={{ marginTop: 8 }}>
        {Array.from({ length: columns }, (_, i) => {
          const taken = seats[String(i)]
          const isMine = taken === uid
          return (
            <button key={i} type="button" className="tab" disabled={Boolean(taken) && !isMine} aria-pressed={isMine} data-selected={isMine} onClick={() => onClaim(i)} style={{ minWidth: 64 }}>
              <span className="font-mono">
                {envelope ? '✉ ' : ''}
                {i + 1}
              </span>
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
  )
}

/** 강사 화면 — 게임이 진행되는 동안 보이는 것. 결과는 GameShell 이 따로 그린다 */
export function TeacherGameView({ kind, derived, nameOf }: { kind: GameKind; derived: Derived; nameOf: (uid: string) => string }) {
  const view = derived.view
  switch (kind) {
    case 'bomb':
      return <Caption>폭탄 · {view.holder ? nameOf(String(view.holder)) : '—'} · {String(view.passes ?? 0)}번 넘어감</Caption>
    case 'closest':
    case 'estimate':
    case 'mine':
      return <Caption>냈다 {String(view.picked ?? 0)} / {String(view.total ?? 0)}</Caption>
    case 'doors': {
      const alive = (view.alive as string[] | undefined) ?? []
      return <Caption>{Number(view.round ?? 0)}번째 문까지 열림 · 남은 사람 {alive.length}명</Caption>
    }
    case 'late':
      return <Caption>누름 {String(view.pressed ?? 0)} · 탈락 {String(view.out ?? 0)}</Caption>
    case 'flash':
      return <Caption>{view.greenAt ? '초록' : '회색'} · 누름 {String(view.pressed ?? 0)} · 성급 {String(view.early ?? 0)}</Caption>
    case 'rps': {
      const alive = (view.alive as string[] | undefined) ?? []
      return <Caption>{Number(view.round ?? 0)}라운드 · 남은 사람 {alive.map(nameOf).join(', ') || '—'}</Caption>
    }
    case 'sync':
    case 'sum':
    case 'relay': {
      const rows = (view.rows as Array<Record<string, unknown>> | undefined) ?? []
      return (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rows.map((r) => (
            <li key={String(r.id)} className="text-body-sm">
              <strong>{String(r.name)}</strong>
              {kind === 'sync' ? ` · 누름 ${String(r.pressed)}/${String(r.joined)} · 편차 ${r.spread === null ? '—' : `${String(r.spread)}ms`}` : ''}
              {kind === 'sum' ? ` · 냈다 ${String(r.picked)}/${String(r.joined)}${r.target !== null ? ` · 목표 ${String(r.target)} 합 ${String(r.total)}` : ''}` : ''}
              {kind === 'relay' ? ` · ${String(r.done)}글자` : ''}
            </li>
          ))}
        </ul>
      )
    }
    case 'bingo':
      return <Caption>뽑힌 항목 {((view.drawn as string[] | undefined) ?? []).join(' · ') || '—'}</Caption>
    default:
      return null
  }
}

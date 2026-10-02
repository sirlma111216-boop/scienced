/**
 * npm run audit:games  (verify:games 의 「전수조사」도 이 파일을 부른다)
 *
 * 발표자 선정 게임 전수조사 — 30차시에 놓인 게임을 **앱의 계산 코드(game-core)** 로 끝까지 돌려 본다.
 * 차시마다 세 가지 교실을 흉내 낸다: 모두가 낸다 · 절반만 낸다 · 아무도 안 낸다.
 * 보는 것: 끝나는가 · 몇 초에 끝나는가 · 발표자가 몇 명 나오는가.
 */
import { activitiesOf, loadCourses, where } from './_courses.mjs'

import { pathToFileURL } from 'node:url'

const { derive, bingoItemsOf, presentersOf, PRESENTER_COUNT } = await import('../src/lib/game-core.ts')

const N = 14
const T0 = 1_000_000
const roster = Array.from({ length: N }, (_, i) => `s${String(i + 1).padStart(2, '0')}`)
const groups = [0, 1, 2, 3].map((g) => ({ id: `g${g}`, name: `모둠${g + 1}`, memberUids: roster.filter((_, i) => i % 4 === g) }))
const tally = [{ option: '봄', count: 5 }, { option: '여름', count: 3 }, { option: '가을', count: 4 }, { option: '겨울', count: 2 }]

/** 학생 한 명이 지금 화면을 보고 내는 것 — 화면(GameInputs)이 허락하는 입력만 낸다 */
function act(kind, uid, d, value, now, i) {
  const v = { ...value }
  const view = d.view
  switch (kind) {
    case 'bomb':
      if ((view.holders ?? [view.holder]).includes(uid) && now % 3000 < 500) v.passes = [...(v.passes ?? []), now]
      break
    case 'closest':
      if (v.n === undefined) v.n = 1 + ((i * 37) % 100)
      break
    case 'estimate':
      if (v.n === undefined) v.n = i % 7
      break
    case 'sum':
      if (v.n === undefined) v.n = 1 + (i % 5)
      break
    case 'doors': {
      const round = Number(view.round ?? 0)
      if ((view.alive ?? []).includes(uid) && v.doors?.[String(round)] === undefined) v.doors = { ...(v.doors ?? {}), [String(round)]: 1 + ((i + round) % 3) }
      break
    }
    case 'mine':
      if (v.cell === undefined) v.cell = (i * 7) % 25
      break
    case 'late':
      if (v.t === undefined && now >= T0 + 6000 + i * 300) v.t = now
      break
    case 'sync':
      if (v.t === undefined && now >= T0 + 2000 + (i % 4) * 100) v.t = now
      break
    case 'flash':
      if (v.t === undefined && view.greenAt && now >= view.greenAt + 150 + i * 40) v.t = now
      break
    case 'rps': {
      const m = [...(view.matches ?? [])].reverse().find((x) => (x.a === uid || x.b === uid) && !x.winner)
      if (m && !(v.hands ?? {})[m.key]) v.hands = { ...(v.hands ?? {}), [m.key]: ['rock', 'paper', 'scissors'][(i + m.key.length + Number(m.key.split('.')[1] ?? 0) * (i % 2 ? 1 : 2)) % 3] }
      break
    }
    case 'relay': {
      const row = (view.rows ?? []).find((r) => r.order.includes(uid))
      const word = String(view.word ?? '')
      if (row && row.turn === uid && row.done < word.length && now % 1000 < 200) {
        v.chars = { ...(v.chars ?? {}), [String(row.done)]: word[row.done] }
        v.times = { ...(v.times ?? {}), [String(row.done)]: now }
      }
      break
    }
    case 'bingo': {
      const board = (view.boards ?? {})[uid] ?? []
      const drawn = new Set(view.drawn ?? [])
      const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
      if (v.claim === undefined && lines.some((l) => l.every((k) => drawn.has(board[k])))) v.claim = now + i
      break
    }
  }
  return v
}

function run(kind, activity, who, seed) {
  const state = { kind, stepId: 'activity', phase: 'running', round: 1, seed, startedAt: T0, state: { roster, ...(kind === 'estimate' ? { tally } : null) }, result: null, updatedAt: T0 }
  const values = Object.fromEntries(roster.map((u) => [u, null]))
  const ctxOf = (now) => ({
    state,
    now,
    groups,
    tally,
    bingoItems: bingoItemsOf(activity),
    options: activity.gameOptions,
    inputs: roster.filter((u) => values[u]).map((u) => ({ uid: u, stepId: 'activity', round: 1, joinedAt: T0, value: values[u], updatedAt: now })),
  })
  for (let now = T0; now <= T0 + 600_000; now += 200) {
    const d = derive(ctxOf(now))
    if (d.finished) {
      /* 앱(GameShell)이 결과를 확정할 때 부르는 그 함수 */
      return { finished: true, sec: (now - T0) / 1000, winners: presentersOf(ctxOf(now), d, {}), reason: d.reason }
    }
    roster.forEach((u, i) => {
      if (!who(i)) return
      const next = act(kind, u, d, values[u] ?? {}, now, i)
      if (JSON.stringify(next) !== JSON.stringify(values[u] ?? {})) values[u] = next
    })
  }
  return { finished: false, sec: null, winners: [], reason: '' }
}

const SCENES = [
  ['모두 낸다', () => true],
  ['절반만', (i) => i % 2 === 0],
  ['아무도 안 냄', () => false],
]
const EXTERNAL = { lumi: '루미 런 — 서버가 등수 둘을 정한다', marble: '구슬 레이스 — 차시가 정한 두 명', ladder: '사다리 — 발표 칸 둘', envelope: '봉투 — 발표 표시 둘' }

/** 게임 한 판의 상한 — 라이브러리의 「3분 이내」 */
const LIMIT_SEC = 180

/** 30차시의 게임을 세 교실에서 돌린 결과. bad 는 끝나지 않았거나 · 발표자가 둘이 아니거나 · 3분을 넘긴 칸 */
export async function simulateGames() {
  let bad = 0
  let cells = 0
  const rows = []
  const problems = []
  for (const c of await loadCourses()) {
    for (const l of c.lessons) {
      if (c.courseId === 'edu' && l.id === '01') continue
      activitiesOf(l).forEach((a) => {
        if (!a.game) return
        if (EXTERNAL[a.game]) {
          rows.push(`${where(l).padEnd(9)} ${a.game.padEnd(9)} ${EXTERNAL[a.game]}`)
          return
        }
        const out = SCENES.map(([name, who]) => {
          const counts = new Set()
          let worst = 0
          let stuck = false
          for (let s = 0; s < 12; s++) {
            const r = run(a.game, a, who, `seed-${l.courseId}-${l.id}-${s}`)
            if (!r.finished) stuck = true
            else {
              counts.add(new Set(r.winners).size)
              worst = Math.max(worst, r.sec)
            }
          }
          const list = [...counts].sort((x, y) => x - y).join('·')
          const ok = !stuck && list === String(PRESENTER_COUNT) && worst <= LIMIT_SEC
          cells += 1
          if (!ok) {
            bad += 1
            problems.push(`${where(l)} ${a.game} · ${name}: ${stuck ? '끝나지 않는다' : `발표자 ${list}명 · ${Math.round(worst)}초`}`)
          }
          return `${name}: ${stuck ? '끝나지 않음' : `${list}명 · 최대 ${Math.round(worst)}초`}${ok ? '' : ' ✗'}`
        })
        rows.push(`${where(l).padEnd(9)} ${a.game.padEnd(9)} ${out.join('  |  ')}`)
      })
    }
  }
  return { rows, bad, cells, problems }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { rows, bad } = await simulateGames()
  console.log(rows.join('\n'))
  console.log(bad === 0 ? '\n모든 게임이 세 교실에서 끝나고 발표자 둘을 낸다' : `\n✗ ${bad}칸 — 끝나지 않거나 발표자가 둘이 아니다`)
  process.exit(bad === 0 ? 0 : 1)
}

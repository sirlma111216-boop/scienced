/**
 * npm run verify:groups
 *
 * 모둠 나누기 (6차 지시서 P.4).
 *
 *   · 여섯 게임이 등록되어 있고 mode 가 서로 다른가
 *   · 모든 게임에 doNow 와 영향범위(effectScope) 문장이 있는가
 *   · 배분형 게임의 카드 수가 모둠 수 × 모둠 크기와 맞는가 (30명 × 6모둠 = 6묶음 × 5장)
 *   · 모의 실행 — 30명 × 6모둠 × 6회차를 SIM_RUNS 번 (기본 1000) 돌려
 *       중복 횟수의 평균과 최대 · 모둠 크기 차이가 1을 넘지 않는가 · 크기 배분이 맞는가
 *       계산상 0 이 가능하고 실제로 답이 있는 20명 × 5모둠 × 5회에서 실제로 0 이 나오는가
 *   · 드래그 전용 동작이 없는가, aria-live 가 있는가
 *   · 5차시 게임의 모둠 이름에 예상 선택지가 들어가지 않는가 (정답 암시 금지)
 *
 * ★ 앱이 쓰는 그 코드(shared/groups-core.ts)를 그대로 부른다. 검사용으로 다시 쓴 코드는 아무것도 보장하지 않는다.
 *
 * ★ N.5 의 공식은 필요조건이다. 30명×6모둠×6회는 공식상 0 이 가능하지만 이 계획기는 8~11회에서 멈추고,
 *   20명×5모둠×6회는 공식상 0 이 가능해 보여도 수학적으로 6회째에 중복이 반드시 생긴다(5-4-6 배치는 없다).
 *   그래서 「공식상 가능 → 실제 0」을 통과 조건으로 두지 않는다. 답이 있는 것으로 알려진 조합에서 0 을 요구하고,
 *   나머지는 숫자를 그대로 적는다. 강사 화면이 그 숫자를 미리 보여 준다.
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report } from './_report.mjs'

const { GROUP_GAMES, gameDealsCards } = await import('../src/content/group-games.ts')
const { assignGroups, applyRound, feasibility, groupSizes } = await import('../shared/groups-core.ts')

/* ── 게임 정의 ── */
{
  if (GROUP_GAMES.length !== 6) fail('게임 수', `게임이 ${GROUP_GAMES.length}개다 (6개여야 한다)`)
  const modes = new Set(GROUP_GAMES.map((g) => g.mode))
  if (modes.size !== GROUP_GAMES.length) fail('방식 고유성', 'mode 가 겹치는 게임이 있다 — 여섯 방식이 서로 달라야 한다')
  else pass('방식 고유성', `여섯 게임의 방식이 모두 다르다 (${[...modes].join(' · ')})`)

  for (const g of GROUP_GAMES) {
    if (!g.doNow?.trim()) fail('지금 할 일', `${g.id} 에 doNow 가 없다`)
    if (g.doNow?.includes('\n')) fail('지금 할 일', `${g.id} 의 doNow 가 두 줄이다`)
    if (!g.effectScope?.trim()) fail('영향범위', `${g.id} 에 선택이 배정에 어떻게 반영되는지 적은 문장이 없다 (N.6)`)
    if (!g.why?.trim()) fail('왜 이렇게 묶는가', `${g.id} 에 why 가 없다`)
    if (!g.revealText?.trim()) fail('연출 글', `${g.id} 에 연출을 글로 적은 revealText 가 없다 (N.8)`)
    const takesInput = Boolean(g.options?.length)
    const deals = gameDealsCards(g)
    if (!takesInput && !deals) fail('게임 형태', `${g.id} 는 입력도 카드도 없다`)
    if (!takesInput && !/선택은 배정에 영향을 주지 않습니다/.test(g.effectScope)) {
      fail('영향범위', `${g.id} 는 선택이 결과에 영향을 주지 않는 게임인데 그렇다고 적지 않았다 (N.6)`)
    }
    if (deals) {
      /* 30명 × 6모둠 = 6묶음 × 5장 */
      if (g.cardSets.length < 6) fail('카드 수', `${g.id} 의 카드 묶음이 ${g.cardSets.length}개다 — 6모둠이면 6묶음이 필요하다`)
      for (const s of g.cardSets) {
        if (s.cards.length < 5) fail('카드 수', `${g.id} 「${s.name}」 이 ${s.cards.length}장이다 — 모둠 크기 5명이면 5장 이상`)
        if (!s.name?.trim()) fail('모둠 이름', `${g.id} 의 카드 묶음에 이름이 없다`)
      }
    }
  }
  pass('지금 할 일·영향범위', '여섯 게임 모두 doNow · effectScope · why · revealText 가 있다')
  pass('카드 수', '배분형 게임 셋이 6묶음 × 5장 이상이다 (30명 × 6모둠)')

  /* 5차시 — 모둠 이름에 예상 선택지가 들어가면 정답을 암시한다 */
  const forks = GROUP_GAMES.find((g) => g.id === '05-forks')
  if (!forks) fail('5차시', '05-forks 가 없다')
  else if (forks.groupNaming !== 'numbered') fail('정답 암시', '05-forks 의 모둠 이름은 번호여야 한다 — 예상을 이름으로 쓰면 정답을 암시한다')
  else pass('정답 암시', '05-forks 는 모둠 이름을 번호로만 짓는다')
}

/* ── 모의 실행 ── */
function simulate(n, g, rounds, seedBase, fast) {
  const uids = Array.from({ length: n }, (_, i) => `u${String(i).padStart(2, '0')}`)
  let history = {}
  let total = 0
  let planned = null
  let stale = false
  const expected = groupSizes(n, g)
  for (let r = 1; r <= rounds; r++) {
    const res = assignGroups({
      uids,
      groupCount: g,
      history,
      round: r,
      roundsAhead: rounds - r + 1,
      seed: `${seedBase}:${r}`,
      plannedRemaining: planned ?? undefined,
      planStale: stale,
      ...(fast ? { restarts: 1, steps: 60000 } : {}),
    })
    const sizes = res.groups.map((m) => m.length)
    if (Math.max(...sizes) - Math.min(...sizes) > 1) throw new Error(`모둠 크기 차이가 1을 넘었다: ${sizes.join(',')}`)
    if (sizes.join(',') !== expected.join(',')) throw new Error(`크기 배분이 ⌊n/g⌋+r 규칙과 다르다: ${sizes.join(',')}`)
    const all = res.groups.flat()
    if (all.length !== n || new Set(all).size !== n) throw new Error('사람이 빠지거나 겹쳤다')
    total += res.repeats
    history = applyRound(history, res.groups, r)
    planned = res.plannedNext
    stale = !res.followedPlan
  }
  return total
}

{
  const RUNS = Number(process.env.SIM_RUNS ?? 1000)
  const t0 = Date.now()
  let sum = 0
  let max = 0
  let zeros = 0
  try {
    for (let i = 0; i < RUNS; i++) {
      const t = simulate(30, 6, 6, `sim${i}`, true)
      sum += t
      max = Math.max(max, t)
      if (t === 0) zeros += 1
    }
    const f = feasibility(30, 6, 6)
    console.log(
      `  · 모의 30명×6모둠×6회 ${RUNS}번 (검사용 짧은 탐색): 중복 평균 ${(sum / RUNS).toFixed(1)} · 최대 ${max} · 0회 ${zeros}번 · ${((Date.now() - t0) / 1000).toFixed(1)}초 (공식상 하한 ${f.minRepeats})`,
    )
    pass('모둠 크기', `${RUNS}번 × 6회차 모두 모둠 크기 차이가 1 이하이고 ⌊n/g⌋+r 배분이 맞다`)
  } catch (err) {
    fail('모둠 크기', String(err.message))
  }

  /* 기본 탐색 크기로 몇 번 — 실제 수업이 쓰는 값 */
  const t1 = Date.now()
  const full = [0, 1, 2].map((i) => simulate(30, 6, 6, `full${i}`, false))
  console.log(`  · 같은 조합, 기본 탐색 3번: 중복 ${full.join(' · ')} (${((Date.now() - t1) / 3).toFixed(0)}ms/회)`)
  if (Math.max(...full) > 20) fail('중복 최소화', `30명×6모둠×6회 기본 탐색에서 중복이 ${Math.max(...full)}회 — 상한 20 을 넘는다`)
  else pass('중복 최소화', `30명×6모둠×6회 기본 탐색에서 중복 ${Math.min(...full)}~${Math.max(...full)}회 (아무렇게나 나누면 60회 안팎)`)

  /* 답이 있는 것으로 알려진 조합 — 여기서는 0 이어야 한다 */
  const known = [0, 1, 2].map((i) => simulate(20, 5, 5, `known${i}`, false))
  if (known.some((t) => t > 0)) fail('중복 0', `20명×5모둠×5회는 중복 0 배치가 있는데 ${known.join(' · ')}회가 나왔다`)
  else pass('중복 0', '답이 있는 조합(20명×5모둠×5회)에서 실제로 중복 0 이 나온다')

  /* 강의자의 실제 조합 — 숫자를 적어 둔다 */
  const real = simulate(20, 4, 6, 'real', false)
  const realF = feasibility(20, 4, 6)
  console.log(`  · 강의자 조합 20명×4모둠×6회: 중복 ${real}회 (공식상 하한 한 사람 ${realF.minRepeats}회 → 짝 기준 ${(20 * realF.minRepeats) / 2}회)`)
}

/* ── 접근성 · 화면 ── */
{
  const game = await readFile('src/components/groups/GroupGame.tsx', 'utf8')
  const page = await readFile('src/routes/instructor/ClassGroups.tsx', 'utf8')
  if (/draggable|onDrag|onDrop/.test(game + page)) fail('드래그 전용', '모둠 화면에 드래그 동작이 있다 — 키보드로만 조작되어야 한다 (N.8)')
  else pass('드래그 전용', '모둠 화면에 드래그 동작이 없다. 옮기기는 select 로 한다')
  if (!/aria-live/.test(game)) fail('aria-live', '학생 결과 화면에 aria-live 가 없다')
  else pass('aria-live', '학생 결과 화면이 aria-live 로 결과를 알린다')
  if (!/useReducedMotion/.test(game)) fail('reduced-motion', '학생 결과 화면이 prefers-reduced-motion 을 보지 않는다')
  else pass('reduced-motion', 'prefers-reduced-motion 이면 연출을 건너뛴다')
  if (!/effectScope/.test(game)) fail('영향범위 표시', '학생 화면이 effectScope 를 그리지 않는다 (N.6)')
  else pass('영향범위 표시', '학생 화면에 선택이 배정에 어떻게 반영되는지가 적힌다')

  /* 같은 코드 — 서버·화면·검사 */
  const server = await readFile('functions/api/groups/assign.ts', 'utf8')
  const lib = await readFile('src/lib/groups.ts', 'utf8')
  if (!/shared\/groups-core/.test(server) || !/@shared\/groups-core/.test(lib)) {
    fail('같은 코드', '서버 함수와 화면이 shared/groups-core 를 쓰지 않는다')
  } else pass('같은 코드', '서버 함수 · 화면 · 이 검사가 shared/groups-core 하나를 쓴다')
}

report('verify:groups')

/**
 * npm run verify:games (8차 6.4)
 *
 *   · 라이브러리 13종 + 옛 게임 2종이 등록되어 있고 규칙 한 줄 · 발표 규칙 · 시간이 있다
 *   · 새 게임 12종은 game-core 에 계산이 있다 (문자열 목록이 아니라 DERIVE 표를 읽는다)
 *   · 차시의 game 이 라이브러리에 있다 · 옛 게임은 교수법 1·2강에만 · 루미 런은 교수법 3·4강에만
 *   · 반응 속도 게임은 과목마다 2회 이하 · 80분 활동 1 의 게임은 60초 이하 · 3분 이하
 *   · 연속 두 차시에 같은 게임 없음 (두 과목이 같은 주에 같은 게임을 쓰지 않는다)
 *   · 게임 상태는 서버 시각으로 — GameShell 이 serverNow 를 쓰고 /api/game/time 이 있다
 *   · 학생은 참가 단추 없이 참가자 · 강사 [게임 시작] 하나 · 수동 지정은 선택 상자
 *   · **발표자는 어느 게임이든 둘** — 30차시의 게임을 앱의 계산으로 끝까지 돌려 본다 (전수조사 · 2026-10-02)
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fail, pass, report } from './_report.mjs'
import { activitiesOf, activityLabel, isLight, loadCourses, where } from './_courses.mjs'

const { GAME_LIBRARY, LEGACY_KINDS, LIBRARY_KINDS } = await import('../src/content/games.ts')

/* ── 라이브러리 ── */
{
  const kinds = Object.keys(GAME_LIBRARY)
  if (LIBRARY_KINDS.length !== 14) fail('라이브러리', `새 게임이 ${LIBRARY_KINDS.length}종이다 (12 + 루미 런 + 구슬 레이스 = 14)`)
  for (const k of [...LIBRARY_KINDS, ...LEGACY_KINDS]) if (!kinds.includes(k)) fail('라이브러리', `${k} 가 GAME_LIBRARY 에 없다`)
  for (const [k, g] of Object.entries(GAME_LIBRARY)) {
    if (!g.rule?.trim() || g.rule.split(/(?<=[.다])\s+/).length > 3) fail('규칙 한 줄', `${k} 의 규칙이 없거나 세 문장을 넘는다`)
    if (!g.winner?.trim()) fail('발표 규칙', `${k} 에 누가 발표하는지가 없다`)
    if (!(g.seconds > 0) || g.seconds > 180) fail('시간', `${k} 가 ${g.seconds}초다 (3분 이하)`)
    if (!['individual', 'group'].includes(g.scope)) fail('범위', `${k} 의 scope 가 ${g.scope} 다`)
    if (/정답|오답|점수|correct/.test(g.winner + g.rule) && !/정답이 아니/.test(g.rule)) fail('정답 기준 금지', `${k} 가 정답·점수로 발표자를 정한다`)
  }
  pass('라이브러리', `게임 ${kinds.length}종(새 12 + 루미 런 · 구슬 레이스 + 옛 2) 모두 규칙 한 줄 · 발표 규칙 · 3분 이하`)

  /* 계산이 실제로 있는가 — game-core 의 DERIVE 표 */
  const core = (await readFile('src/lib/game-core.ts', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  const table = core.match(/const DERIVE.*?=\s*\{([^}]*)\}/)?.[1] ?? ''
  const implemented = new Set(table.split(',').map((s) => s.trim()).filter(Boolean))
  for (const k of LIBRARY_KINDS) {
    if (k === 'lumi' || k === 'marble') continue /* 밖에서 붙인 게임 — 계산도 입력도 활동 앱 안에 있다 */
    if (!implemented.has(k)) fail('계산', `${k} 의 상태 계산이 game-core DERIVE 표에 없다`)
  }
  for (const k of implemented) if (!LIBRARY_KINDS.includes(k)) fail('계산', `game-core 에 라이브러리에 없는 게임 ${k} 가 있다`)
  if (/Math\.random/.test(core)) fail('서버 시드', 'game-core 가 Math.random 을 쓴다 — 시드로만 정한다')
  pass('계산', `새 게임 12종의 상태 계산이 game-core 에 있고 난수는 시드에서만 나온다`)

  const inputs = await readFile('src/components/games/GameInputs.tsx', 'utf8')
  for (const k of LIBRARY_KINDS) {
    if (k === 'lumi' || k === 'marble') continue /* 밖에서 붙인 게임 — 계산도 입력도 활동 앱 안에 있다 */
    if (!new RegExp(`case '${k}'`).test(inputs)) fail('학생 입력', `${k} 의 학생 입력 화면이 GameInputs 에 없다`)
  }
  pass('학생 입력', '새 게임 12종이 각각 학생 입력 화면을 가진다')
}

/* ── 배치 ── */
{
  const courses = await loadCourses()
  const byWeek = {}
  for (const c of courses) {
    let reaction = 0
    let prev = null
    for (const l of c.lessons) {
      for (const [i, a] of activitiesOf(l).entries()) {
        const at = `${where(l)} ${activityLabel(l, i)}`
        /* 교수법 활동 1 은 게임이 없다 (강의자 지시 2026-09-22) — 배치표 검사는 모둠·게임이 있는 활동만 본다 */
        if (isLight(a)) continue
        const g = GAME_LIBRARY[a.game]
        if (!g) {
          fail('배치', `${at} 의 게임 ${a.game} 이 라이브러리에 없다`)
          continue
        }
        /* 교육론 1강은 교수법 1강과 같다 (강의자 답 4) — 사다리를 함께 쓴다 */
        if (g.legacy && !((c.courseId === 'method' && ['01', '02'].includes(l.id)) || (c.courseId === 'edu' && l.id === '01'))) fail('옛 게임', `${at} 이 옛 게임 ${a.game} 을 쓴다 — 교수법 1·2강에만`)
        if (a.game === 'ladder' && l.id !== '01') fail('옛 게임', `${at} 이 사다리를 쓴다 — 1강에만`)
        if (a.game === 'envelope' && !(c.courseId === 'method' && l.id === '02')) fail('옛 게임', `${at} 이 봉투를 쓴다 — 교수법 2강에만`)
        if (a.game === 'lumi' && !(c.courseId === 'method' && ['03', '04'].includes(l.id))) fail('루미 런', `${at} 이 루미 런을 쓴다 — 교수법 3·4강에만 (강의자 답 2)`)
        if (g.reaction) reaction += 1
        if (l.layout === 'edu80' && i === 0 && g.seconds > 60) fail('80분 활동 1', `${at} 의 게임 ${a.game} 이 ${g.seconds}초다 — 활동 1 은 60초 이하`)
        if (g.scope === 'group' && a.group?.format === undefined) fail('모둠 게임', `${at} 모둠 게임인데 모둠 단계가 없다`)
        /* 밖에서 붙인 게임 둘은 강의자가 자리를 정했다 — 루미 런은 교수법 3·4강(답 2), 구슬 레이스는 교수법 5·6강(지시 2026-09-22). 그것만 연속을 허락한다 */
        if (prev && prev.game === a.game && prev.lessonId !== l.id && !(a.game === 'lumi' || (a.game === 'marble' && c.courseId === 'method'))) fail('연속 배치', `${where(prev.l)} 과 ${at} 이 연속으로 ${a.game} 이다`)
        prev = { game: a.game, lessonId: l.id, l }
        for (const [k, v] of Object.entries(a.gameOptions ?? {})) {
          const opt = g.options?.[k]
          if (!opt) fail('게임 옵션', `${at} 의 옵션 ${k} 는 ${a.game} 에 없다`)
          else if (!opt.values.includes(String(v))) fail('게임 옵션', `${at} 의 옵션 ${k}=${v} 는 ${opt.values.join('/')} 중 하나여야 한다`)
        }
        const week = Number(l.id)
        byWeek[week] = byWeek[week] ?? {}
        byWeek[week][c.courseId] = a.game
      }
    }
    if (reaction > 2) fail('반응 속도 게임', `${c.title} 에서 반응 속도 게임이 ${reaction}회다 (2회 이하)`)
  }
  const clash = Object.entries(byWeek).filter(([, w]) => w.method && w.edu && w.method === w.edu && w.method !== 'ladder').map(([wk, w]) => `${wk}주 ${w.method}`)
  if (clash.length > 0) fail('같은 주 같은 게임', `두 과목이 같은 주에 같은 게임을 쓴다 — ${clash.join(', ')} (8.3)`)
  pass('배치', '옛 게임은 1·2강, 루미 런은 3·4강, 구슬 레이스는 교수법 5·6강·교육론 2강이고 반응 속도 게임은 과목당 2회 이하다')
}

/* ── 구슬 레이스 — 서버 없이 강사 화면 하나에서 (강의자 지시 2026-09-21) ── */
{
  let used = 0
  for (const c of await loadCourses()) {
    for (const l of c.lessons) {
      for (const [i, a] of activitiesOf(l).entries()) {
        if (a.game !== 'marble') continue
        used += 1
        const at = `${where(l)} ${activityLabel(l, i)}`
        for (const k of ['map', 'pick']) if (!a.gameOptions?.[k]) fail('구슬 레이스', `${at} 이 구슬 레이스의 ${k} 를 적지 않았다 — 맵과 발표자 규칙은 차시가 정한다`)
      }
    }
  }
  const lib = await readFile('src/lib/marble.ts', 'utf8')
  const stage = await readFile('src/components/marble/MarbleStage.tsx', 'utf8')
  const teacher = await readFile('src/components/marble/MarbleTeacher.tsx', 'utf8')
  if (!/mode: 'local'/.test(stage)) fail('구슬 레이스', 'MarbleStage 가 local 모드로 열지 않는다 — 이 게임은 서버도 티켓도 쓰지 않는다')
  if (/apiPost|fetch\(|\/api\//.test(lib + stage + teacher)) fail('구슬 레이스', '구슬 레이스가 우리 서버를 부른다 — 서버 없이 도는 게임이다')
  if (!/serverVerified/.test(teacher)) fail('구슬 레이스', '강사 화면이 serverVerified 를 보지 않는다 — 확인해 줄 서버가 없다고 결과에 적어야 한다')
  if (!/finalizeGame/.test(teacher)) fail('구슬 레이스', '결과를 기존 구조(세션·뽑기 기록·발표 횟수)에 적지 않는다')
  if (used > 0) pass('구슬 레이스', `구슬 레이스 ${used}곳이 맵과 발표자 규칙을 차시에 적었고, 결과는 기존 구조에 들어가며 우리 서버를 부르지 않는다`)
}

/* ── 서버 시각 · 단추 ── */
{
  if (!existsSync('functions/api/game/time.ts')) fail('서버 시각', 'functions/api/game/time.ts 가 없다')
  const shell = await readFile('src/components/games/GameShell.tsx', 'utf8')
  if (!/serverNow\(\)/.test(shell) || !/syncServerTime/.test(shell)) fail('서버 시각', 'GameShell 이 서버 시각을 재지 않는다 — 반응 시각을 클라이언트 시계로 적는다')
  else pass('서버 시각', '반응 시각은 참가 때 잰 서버 시각 오프셋으로 적힌다')
  const teacherButtons = [...shell.matchAll(/<Button[^>]*>\s*([^<{]+?)\s*<\/Button>/g)].map((m) => m[1].trim())
  /* 학생의 [참가]는 없앴다 — 오늘 온 사람이 곧 참가자다 (강의자 지시 2026-09-29) */
  const bad = teacherButtons.filter((b) => b !== '게임 시작')
  if (bad.length > 0) fail('단추', `GameShell 에 [게임 시작] 밖의 단추가 있다 — ${bad.join(', ')}`)
  else if (/참가<\/Button>/.test(shell) || /참가<\/Button>/.test(await readFile('src/components/lumi/LumiStudent.tsx', 'utf8'))) fail('단추', '학생 [참가] 단추가 되살아났다 — 출석한 사람이 곧 참가자다')
  else pass('단추', 'GameShell 의 단추는 강사 [게임 시작] 하나다. 학생은 참가 단추 없이 바로 참가자이고, 수동 지정은 선택 상자')
  if (!/fairness/.test(shell) || !/반응 속도 게임/.test(shell + (await readFile('src/content/games.ts', 'utf8')))) fail('반응 속도 표시', '반응 속도 게임의 결과에 「반응 속도 게임입니다」가 적히지 않는다')
  const core = await readFile('src/lib/game-core.ts', 'utf8')
  if (!/export function presentersOf/.test(core)) fail('모둠 대표', '모둠 게임의 발표자(이긴 모둠에서 발표 횟수가 적은 두 사람)를 정하는 함수가 없다')
  if (!/presentersOf\(ctx, derived, presentCount\)/.test(shell)) fail('모둠 대표', 'GameShell 이 결과를 확정할 때 presentersOf 를 부르지 않는다 — 발표자가 둘이 아니게 된다')
}

/*
 * ── 「0 에 가깝게」(late) 의 순서 — 앱이 쓰는 그 계산을 그대로 부른다 (강의자 지시 2026-09-28) ──
 * 못한 두 사람이 발표자다: 안 누름 > 0 넘김(늦을수록) > 0 전(먼저 누를수록). winnerUids 는 발표자에 가까운 순서다.
 */
{
  const { derive } = await import('../src/lib/game-core.ts')
  const T0 = 1_000_000
  const DEADLINE = T0 + 10000
  /** presses: uid → 누른 시각(ms) 또는 null(안 누름) */
  const run = (presses, now = DEADLINE + 6000) =>
    derive({
      state: { kind: 'late', stepId: 'activity-1', phase: 'running', round: 1, seed: 'check::late', startedAt: T0, state: null, result: null, updatedAt: T0 },
      inputs: Object.entries(presses).map(([uid, t], i) => ({ uid, stepId: 'activity-1', round: 1, joinedAt: T0 + i, value: t === null ? {} : { t }, updatedAt: T0 })),
      now,
      groups: [],
    })
  const ids = (d) => d.winnerUids.join(',')
  const sorted = (d) => [...d.winnerUids].sort().join(',')
  const idle = Object.fromEntries(['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'].map((u) => [u, null]))
  const cases = [
    ['0 전만 눌렀으면 먼저 누른 순서로 둘 (3초 · 2초 · 1초 남음 → 3초, 2초)', ids(run({ early: DEADLINE - 3000, mid: DEADLINE - 2000, late1: DEADLINE - 1000 })), 'early,mid'],
    ['0 을 넘긴 사람이 0 전 사람보다 먼저다', ids(run({ early: DEADLINE - 9000, over: DEADLINE + 500, near: DEADLINE - 500 })), 'over,early'],
    ['0 을 넘긴 사람이 여럿이면 늦게 누른 사람부터', ids(run({ over1: DEADLINE + 500, over2: DEADLINE + 2500, near: DEADLINE - 100 })), 'over2,over1'],
    ['끝까지 안 누른 사람이 가장 먼저다', ids(run({ over: DEADLINE + 3000, none: null, near: DEADLINE - 100 })), 'none,over'],
    ['같은 때에 누른 둘은 함께 발표한다', sorted(run({ a: DEADLINE - 4000, b: DEADLINE - 4000, c: DEADLINE - 500 })), 'a,b'],
    ['안 누른 사람이 일곱이어도 발표자는 둘이다', run({ ...idle, a: DEADLINE - 500 }).winnerUids.length, 2],
    ['그 둘은 안 누른 사람 가운데서 나온다', run({ ...idle, a: DEADLINE - 500 }).winnerUids.every((u) => u in idle), true],
    ['모두 눌렀으면 0 + 1.5초에 끝난다', run({ a: DEADLINE - 2000, b: DEADLINE - 1000 }, DEADLINE + 1600).finished, true],
    ['안 누른 사람이 있으면 0 + 1.5초에는 아직 안 끝난다 — 넘겨 누를 틈을 준다', run({ a: DEADLINE - 2000, b: null }, DEADLINE + 1600).finished, false],
    ['그 틈이 지나면 끝난다', run({ a: DEADLINE - 2000, b: null }, DEADLINE + 5000).finished, true],
    ['0 전에는 끝나지 않는다', run({ a: DEADLINE - 2000 }, DEADLINE - 100).finished, false],
  ]
  let bad = 0
  for (const [label, got, want] of cases) {
    if (got !== want) {
      bad += 1
      fail('0 에 가깝게', `${label}: ${JSON.stringify(got)} (기대 ${JSON.stringify(want)})`)
    }
  }
  const view = run({ a: DEADLINE - 2000, b: DEADLINE + 800, c: null }).view
  if (view.pressed !== 2 || view.over !== 1 || view.none !== 1) {
    bad += 1
    fail('0 에 가깝게', `강사 요약이 틀리다 — ${JSON.stringify(view)}`)
  }
  if (bad === 0) pass('0 에 가깝게', '안 누름 > 0 넘김(늦을수록) > 0 전(먼저 누를수록) 순으로 발표자 둘을 정하고, 넘겨 누를 틈을 준 뒤 끝난다')
}

/*
 * ── 참가자 = 오늘 온 사람 (강의자 지시 2026-09-29) ──
 * 강사가 시작할 때 출석 명단을 상태에 적는다. 아무것도 내지 않은 사람도 후보다.
 */
{
  const { derive, participants } = await import('../src/lib/game-core.ts')
  const T0 = 2_000_000
  const ctx = (roster, inputs, now = T0 + 20000) => ({
    state: { kind: 'late', stepId: 'activity', phase: 'running', round: 1, seed: 'check::roster', startedAt: T0, state: roster ? { roster } : null, result: null, updatedAt: T0 },
    inputs,
    now,
    groups: [],
  })
  const input = (uid, t) => ({ uid, stepId: 'activity', round: 1, joinedAt: T0, value: t === null ? {} : { t }, updatedAt: T0 })
  let bad = 0
  const check = (label, got, want) => { if (got !== want) { bad += 1; fail('참가자', `${label}: ${JSON.stringify(got)} (기대 ${JSON.stringify(want)})`) } }

  /* 명단 셋 · 입력은 하나뿐 — 셋 다 참가자이고, 안 낸 둘이 발표자 후보다 */
  const c1 = ctx(['a', 'b', 'c'], [input('a', T0 + 5000)])
  check('명단에 적힌 사람이 모두 참가자다', participants(c1).map((x) => x.uid).join(','), 'a,b,c')
  check('안 누른 사람이 발표자다 — 누른 사람이 아니라', derive(c1).winnerUids.sort().join(','), 'b,c')
  /* 명단 순서가 참가 순서다 — 시드 없이도 화면마다 같다 */
  check('참가 순서는 명단 순서다', participants(ctx(['c', 'a', 'b'], [])).map((x) => x.uid).join(','), 'c,a,b')
  /* 옛 판(roster 없음)은 예전처럼 입력이 있는 사람만 */
  check('roster 가 없는 옛 판은 입력이 있는 사람만 참가자다', participants(ctx(null, [input('a', T0 + 5000)])).map((x) => x.uid).join(','), 'a')
  /* 명단에 없는 사람이 입력을 내도 참가자가 아니다 */
  check('명단 밖의 입력은 참가자가 아니다', participants(ctx(['a'], [input('a', T0 + 1000), input('z', T0 + 2000)])).map((x) => x.uid).join(','), 'a')

  const shell = await readFile('src/components/games/GameShell.tsx', 'utf8')
  if (!/roster: teacher\.students\.map|const roster = teacher\.students\.map/.test(shell)) { bad += 1; fail('참가자', '강사가 시작할 때 출석 명단을 상태에 적지 않는다') }
  if (bad === 0) pass('참가자', '오늘 온 사람이 그대로 참가자다 — 시작할 때 출석 명단을 상태에 적고 모든 화면이 그것을 읽는다')
}

/*
 * ── 전수조사 — 30차시에 놓인 게임을 앱의 계산(derive · presentersOf · bingoItemsOf)으로 끝까지 돌린다 (강의자 지시 2026-10-02) ──
 * 세 교실: 모두 낸다 · 절반만 낸다 · 아무도 안 낸다. 끝나야 하고, 발표자가 정확히 둘이어야 하고, 3분 안이어야 한다.
 * 이 검사가 없을 때 빙고는 세 차시 모두 영영 끝나지 않았고(항목이 아홉이 안 됨), 「0 에 가깝게」는 안 누른 사람 전원이 발표자가 됐다.
 */
{
  const { simulateGames } = await import('./_sim-games.mjs')
  const { bad, cells, problems } = await simulateGames()
  if (bad > 0) for (const p of problems) fail('전수조사', p)
  else pass('전수조사', `차시에 놓인 게임을 세 교실에서 돌린 ${cells}칸이 모두 끝나고 발표자 둘을 낸다 (3분 이내)`)

  const { LIBRARY_KINDS: kinds } = await import('../src/content/games.ts')
  const text = Object.entries(GAME_LIBRARY).filter(([k]) => kinds.includes(k) && k !== 'lumi' && k !== 'marble' && k !== 'rps' && k !== 'flash')
  for (const [k, g] of text) if (!/두 사람/.test(g.rule)) fail('전수조사', `${k} 의 규칙 한 줄이 발표자가 둘임을 말하지 않는다 — 「${g.rule}」`)
}

report('verify:games')

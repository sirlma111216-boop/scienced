/**
 * npm run verify:games (8차 6.4)
 *
 *   · 라이브러리 13종 + 옛 게임 2종이 등록되어 있고 규칙 한 줄 · 발표 규칙 · 시간이 있다
 *   · 새 게임 12종은 game-core 에 계산이 있다 (문자열 목록이 아니라 DERIVE 표를 읽는다)
 *   · 차시의 game 이 라이브러리에 있다 · 옛 게임은 교수법 1·2강에만 · 루미 런은 교수법 3·4강에만
 *   · 반응 속도 게임은 과목마다 2회 이하 · 80분 활동 1 의 게임은 60초 이하 · 3분 이하
 *   · 연속 두 차시에 같은 게임 없음 (두 과목이 같은 주에 같은 게임을 쓰지 않는다)
 *   · 게임 상태는 서버 시각으로 — GameShell 이 serverNow 를 쓰고 /api/game/time 이 있다
 *   · 학생 [참가] 하나 · 강사 [게임 시작] 하나 · 수동 지정은 선택 상자
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fail, pass, report } from './_report.mjs'
import { activitiesOf, loadCourses, where } from './_courses.mjs'

const { GAME_LIBRARY, LEGACY_KINDS, LIBRARY_KINDS } = await import('../src/content/games.ts')

/* ── 라이브러리 ── */
{
  const kinds = Object.keys(GAME_LIBRARY)
  if (LIBRARY_KINDS.length !== 13) fail('라이브러리', `새 게임이 ${LIBRARY_KINDS.length}종이다 (12 + 루미 런 = 13)`)
  for (const k of [...LIBRARY_KINDS, ...LEGACY_KINDS]) if (!kinds.includes(k)) fail('라이브러리', `${k} 가 GAME_LIBRARY 에 없다`)
  for (const [k, g] of Object.entries(GAME_LIBRARY)) {
    if (!g.rule?.trim() || g.rule.split(/(?<=[.다])\s+/).length > 3) fail('규칙 한 줄', `${k} 의 규칙이 없거나 세 문장을 넘는다`)
    if (!g.winner?.trim()) fail('발표 규칙', `${k} 에 누가 발표하는지가 없다`)
    if (!(g.seconds > 0) || g.seconds > 180) fail('시간', `${k} 가 ${g.seconds}초다 (3분 이하)`)
    if (!['individual', 'group'].includes(g.scope)) fail('범위', `${k} 의 scope 가 ${g.scope} 다`)
    if (/정답|오답|점수|correct/.test(g.winner + g.rule) && !/정답이 아니/.test(g.rule)) fail('정답 기준 금지', `${k} 가 정답·점수로 발표자를 정한다`)
  }
  pass('라이브러리', `게임 ${kinds.length}종(새 12 + 루미 런 + 옛 2) 모두 규칙 한 줄 · 발표 규칙 · 3분 이하`)

  /* 계산이 실제로 있는가 — game-core 의 DERIVE 표 */
  const core = (await readFile('src/lib/game-core.ts', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  const table = core.match(/const DERIVE.*?=\s*\{([^}]*)\}/)?.[1] ?? ''
  const implemented = new Set(table.split(',').map((s) => s.trim()).filter(Boolean))
  for (const k of LIBRARY_KINDS) {
    if (k === 'lumi') continue
    if (!implemented.has(k)) fail('계산', `${k} 의 상태 계산이 game-core DERIVE 표에 없다`)
  }
  for (const k of implemented) if (!LIBRARY_KINDS.includes(k)) fail('계산', `game-core 에 라이브러리에 없는 게임 ${k} 가 있다`)
  if (/Math\.random/.test(core)) fail('서버 시드', 'game-core 가 Math.random 을 쓴다 — 시드로만 정한다')
  pass('계산', `새 게임 12종의 상태 계산이 game-core 에 있고 난수는 시드에서만 나온다`)

  const inputs = await readFile('src/components/games/GameInputs.tsx', 'utf8')
  for (const k of LIBRARY_KINDS) {
    if (k === 'lumi') continue
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
        const at = `${where(l)} 활동${i ? ' 2' : ''}`
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
        if (prev && prev.game === a.game && prev.lessonId !== l.id) fail('연속 배치', `${where(prev.l)} 과 ${at} 이 연속으로 ${a.game} 이다`)
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
  pass('배치', '옛 게임은 1·2강, 루미 런은 3·4강에만 있고 반응 속도 게임은 과목당 2회 이하다')
}

/* ── 서버 시각 · 단추 ── */
{
  if (!existsSync('functions/api/game/time.ts')) fail('서버 시각', 'functions/api/game/time.ts 가 없다')
  const shell = await readFile('src/components/games/GameShell.tsx', 'utf8')
  if (!/serverNow\(\)/.test(shell) || !/syncServerTime/.test(shell)) fail('서버 시각', 'GameShell 이 서버 시각을 재지 않는다 — 반응 시각을 클라이언트 시계로 적는다')
  else pass('서버 시각', '반응 시각은 참가 때 잰 서버 시각 오프셋으로 적힌다')
  const teacherButtons = [...shell.matchAll(/<Button[^>]*>\s*([^<{]+?)\s*<\/Button>/g)].map((m) => m[1].trim())
  const bad = teacherButtons.filter((b) => !['게임 시작', '참가'].includes(b))
  if (bad.length > 0) fail('단추', `GameShell 에 게임 시작·참가 밖의 단추가 있다 — ${bad.join(', ')}`)
  else pass('단추', 'GameShell 의 단추는 강사 [게임 시작] · 학생 [참가] 뿐이다. 수동 지정은 선택 상자')
  if (!/fairness/.test(shell) || !/반응 속도 게임/.test(shell + (await readFile('src/content/games.ts', 'utf8')))) fail('반응 속도 표시', '반응 속도 게임의 결과에 「반응 속도 게임입니다」가 적히지 않는다')
  const core = await readFile('src/lib/game-core.ts', 'utf8')
  if (!/representativeOf/.test(core)) fail('모둠 대표', '모둠 게임의 대표(발표 횟수가 가장 적은 사람)를 정하는 함수가 없다')
}

report('verify:games')

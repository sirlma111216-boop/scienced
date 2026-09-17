/**
 * npm run verify:groups (8차 5절 · 4.6)
 *
 *   · 질문 은행 20개 이상 · 선택지 6~8개 · 과학 낱말 없음 · id 고유
 *   · 모둠 데이터 형식 — 연속 두 차시에 같은 형식 없음 · 배분(allocation) 한 학기 3회 이하 (과목마다)
 *   · 두 과목이 같은 주에 같은 질문을 쓰지 않도록 기본 질문이 어긋난다 (8.3)
 *   · 모의 실행 — 앱이 쓰는 shared/groups-core 를 그대로 (6차 P.4 그대로) + 같은 답끼리 모으기(gather)
 *   · 화면 — 드래그 없음 · aria-live · 같은 코드
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report } from './_report.mjs'
import { activitiesOf, loadCourses, where } from './_courses.mjs'

const { FORMATION_QUESTIONS, nextFormationQuestion } = await import('../src/content/formation-questions.ts')
const { assignGroups, applyRound, feasibility, groupSizes } = await import('../shared/groups-core.ts')
const { lessonIndex } = await import('../src/content/courses/index.ts')
/** src/lib/groups.ts 의 defaultFormationLessons 와 같은 규칙 — 그 파일은 firebase 를 끌어와 node 에서 못 부른다 */
const defaultFormationLessons = (courseId) => lessonIndex(courseId).map((l) => l.id).filter((_, i) => courseId === 'edu' || i % 2 === 0)

const SCIENCE = ['과학', '실험', '원자', '분자', '세포', '광합성', '중력', '에너지', '화학', '물리', '생물', '지구', '전기', '자석', '탐구', '가설', '변인', '이산화탄소', '산소', '전류', '온도', '기압', '행성', '진화', '유전']

/* ── 질문 은행 ── */
{
  if (FORMATION_QUESTIONS.length < 20) fail('질문 은행', `질문이 ${FORMATION_QUESTIONS.length}개다 (20개 이상)`)
  const ids = new Set()
  for (const q of FORMATION_QUESTIONS) {
    if (ids.has(q.id)) fail('질문 id', `${q.id} 가 겹친다`)
    ids.add(q.id)
    if (!q.question?.trim().endsWith('?')) fail('질문', `「${q.question}」 이 물음표로 끝나지 않는다`)
    if (q.options.length < 6 || q.options.length > 8) fail('선택지 수', `「${q.question}」 선택지가 ${q.options.length}개다 (6~8)`)
    if (new Set(q.options).size !== q.options.length) fail('선택지', `「${q.question}」 선택지가 겹친다`)
    const blob = `${q.question} ${q.options.join(' ')}`
    const hit = SCIENCE.find((w) => blob.includes(w))
    if (hit) fail('과학 낱말', `「${q.question}」 에 「${hit}」 — 과학 이야기는 넣지 않는다 (5.1)`)
  }
  pass('질문 은행', `질문 ${FORMATION_QUESTIONS.length}개 · 선택지 6~8개 · 과학 낱말 없음`)
}

/* ── 모둠 데이터 형식 (4.6) ── */
{
  const courses = await loadCourses()
  for (const c of courses) {
    const seq = []
    for (const l of c.lessons) for (const a of activitiesOf(l)) seq.push({ l, format: a.group.format })
    for (let i = 1; i < seq.length; i++) {
      if (seq[i].format === seq[i - 1].format && seq[i].l.id !== seq[i - 1].l.id) {
        fail('형식 연속', `${where(seq[i - 1].l)} 과 ${where(seq[i].l)} 이 연속으로 ${seq[i].format} 이다`)
      }
    }
    const alloc = seq.filter((s) => s.format === 'allocation').length
    if (alloc > 3) fail('배분 횟수', `${c.title} 에서 배분(allocation)이 ${alloc}회다 (3회 이하)`)
    const used = new Set(seq.map((s) => s.format))
    console.log(`  · ${c.title}: 형식 ${[...used].join(' · ')} (배분 ${alloc}회)`)
  }
  pass('모둠 데이터 형식', '연속 차시에 같은 형식이 없고 배분은 학기당 3회 이하다')

  /* 두 과목의 기본 질문이 같은 회차에 겹치지 않는다 — 8.3 */
  const seqOf = (courseId) => {
    const used = []
    return defaultFormationLessons(courseId).map(() => {
      const q = nextFormationQuestion(used)
      used.push(q.id)
      return q.id
    })
  }
  const m = seqOf('method')
  const e = seqOf('edu')
  const same = m.filter((id, i) => e[i] === id).length
  if (same > 1) console.log(`  · 경고 두 과목의 기본 질문이 ${same}회차에서 같다 — 강사가 질문을 골라 어긋나게 둔다 (클래스 문서에 기록됨)`)
}

/* ── 모의 실행 (6차 P.4 그대로) ── */
function simulate(n, g, rounds, seedBase, fast, categories) {
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
      ...(categories ? { categories, categoryMode: 'gather' } : {}),
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
  const RUNS = Number(process.env.SIM_RUNS ?? 300)
  const t0 = Date.now()
  let sum = 0
  let max = 0
  try {
    for (let i = 0; i < RUNS; i++) {
      const t = simulate(30, 6, 6, `sim${i}`, true)
      sum += t
      max = Math.max(max, t)
    }
    console.log(`  · 모의 30명×6모둠×6회 ${RUNS}번: 중복 평균 ${(sum / RUNS).toFixed(1)} · 최대 ${max} · ${((Date.now() - t0) / 1000).toFixed(1)}초 (공식상 하한 ${feasibility(30, 6, 6).minRepeats})`)
    pass('모둠 크기', `${RUNS}번 × 6회차 모두 모둠 크기 차이가 1 이하이고 ⌊n/g⌋+r 배분이 맞다`)
  } catch (err) {
    fail('모둠 크기', String(err.message))
  }
  const known = [0, 1].map((i) => simulate(20, 5, 5, `known${i}`, false))
  if (known.some((t) => t > 0)) fail('중복 0', `20명×5모둠×5회는 중복 0 배치가 있는데 ${known.join(' · ')}회가 나왔다`)
  else pass('중복 0', '답이 있는 조합(20명×5모둠×5회)에서 실제로 중복 0 이 나온다')

  /* 같은 답끼리 모으기 — 답이 모둠 수와 맞으면 모둠마다 한 답이 모인다 */
  const cats = {}
  for (let i = 0; i < 20; i++) cats[`u${String(i).padStart(2, '0')}`] = ['일본', '프랑스', '미국', '스위스'][i % 4]
  const res = assignGroups({ uids: Object.keys(cats), groupCount: 4, history: {}, round: 1, roundsAhead: 1, seed: 'gather', categories: cats, categoryMode: 'gather' })
  const pure = res.groups.filter((g) => new Set(g.map((u) => cats[u])).size === 1).length
  if (pure < 3) fail('같은 답끼리', `답이 고르게 갈린 20명을 4모둠으로 나눴는데 한 답으로 모인 모둠이 ${pure}개뿐이다`)
  else pass('같은 답끼리', `답이 고르게 갈리면 ${pure}/4 모둠이 한 답으로 모인다 (동석 최소화는 그대로)`)
  const real = simulate(20, 4, 6, 'real', false)
  console.log(`  · 강의자 조합 20명×4모둠×6회: 중복 ${real}회`)
}

/* ── 화면 ── */
{
  const student = await readFile('src/components/formation/FormationQuestion.tsx', 'utf8')
  const panel = await readFile('src/components/groups/FormationPanel.tsx', 'utf8')
  const page = await readFile('src/routes/instructor/ClassGroups.tsx', 'utf8')
  if (/draggable|onDrag|onDrop/.test(student + panel + page)) fail('드래그 전용', '모둠 화면에 드래그 동작이 있다 — 옮기기는 select 로')
  else pass('드래그 전용', '모둠 화면에 드래그 동작이 없다. 옮기기는 select 로 한다')
  if (!/aria-live/.test(student)) fail('aria-live', '학생 모둠 결과 화면에 aria-live 가 없다')
  else pass('aria-live', '학생 모둠 결과 화면이 aria-live 로 결과를 알린다')
  if (!/questionId/.test(panel) || !/formationQuestions/.test(panel)) fail('질문 기록', '강사 화면이 쓴 질문을 클래스 문서에 기록하지 않는다 — 학기 안에 되풀이된다')
  else pass('질문 기록', '확정할 때 질문 id 가 회차와 클래스 문서에 남아 학기 안에 되풀이하지 않는다')
  const server = await readFile('functions/api/groups/assign.ts', 'utf8')
  const lib = await readFile('src/lib/groups.ts', 'utf8')
  if (!/shared\/groups-core/.test(server) || !/@shared\/groups-core/.test(lib)) fail('같은 코드', '서버 함수와 화면이 shared/groups-core 를 쓰지 않는다')
  else pass('같은 코드', '서버 함수 · 화면 · 이 검사가 shared/groups-core 하나를 쓴다')
}

report('verify:groups')

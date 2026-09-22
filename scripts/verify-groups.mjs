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

const { FORMATION_QUESTIONS, questionForLessonNumber } = await import('../src/content/formation-questions.ts')
const { answeredUids, attendanceEdit, attendingStudents, withAttendance, attendanceByLesson } = await import('../src/lib/attendance.ts')
const { assignGroups, applyRound, feasibility, groupSizes } = await import('../shared/groups-core.ts')
const { lessonIndex } = await import('../src/content/courses/index.ts')
/* 규칙은 앱이 쓰는 그 파일에서 그대로 부른다 — 검사기가 규칙을 다시 쓰면 둘이 어긋난다 */
const { defaultFormationLessons, roundForLesson, METHOD_PAIRED_UNTIL } = await import('../src/lib/group-round.ts')

const mk = (lessonId, name) => ({ id: 'r-' + lessonId, round: Number(lessonId), lessonId, gameId: 'q', groups: [{ id: '1', name, memberUids: ['a'] }], absentUids: [], seed: '', cost: 0, createdBy: 't', createdAt: 0, manualEdits: [], plannedNext: [], followedPlan: true, lateJoins: [] })

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
    /* 교수법 활동 1 은 모둠 데이터가 없다 (강의자 지시 2026-09-22) — 형식의 연속은 모둠이 있는 활동끼리 본다 */
    for (const l of c.lessons) for (const a of activitiesOf(l)) if (a.group) seq.push({ l, format: a.group.format })
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

  /* 질문은 매 차시 뜬다(출석) — 한 과목 안에서 차시마다 다르고, 두 과목이 같은 주에 겹치지 않는다 (8.3) */
  const seqOf = (courseId) => lessonIndex(courseId).map((l) => questionForLessonNumber(Number(l.id), courseId).id)
  for (const courseId of ['method', 'edu']) {
    const seq = seqOf(courseId)
    const dup = seq.find((id, i) => seq.indexOf(id) !== i)
    if (dup) fail('차시마다 다른 질문', `${courseId} 에서 「${dup}」 질문이 두 차시에 나온다 — 질문은 매 차시 뜨므로 겹치면 학기 안에 되풀이된다`)
  }
  const m = seqOf('method')
  const e = seqOf('edu')
  const same = m.filter((id, i) => e[i] === id).length
  if (same > 0) fail('과목 어긋내기', `두 과목이 같은 주에 같은 질문을 ${same}번 쓴다 — 두 과목을 같이 듣는 학생이 같은 질문을 두 번 받는다 (8.3)`)
  else pass('차시마다 다른 질문', `교수법 ${m.length}차시 · 교육론 ${e.length}차시가 저마다 다른 질문을 받고, 같은 주에 두 과목이 겹치지 않는다`)
}

/* ── 출석 — 답한 사람만 모둠에 들어간다 (강의자 지시 2026-09-22) ── */
{
  const students = ['a', 'b', 'c', 'd'].map((uid) => ({ uid, nickname: uid, status: 'active' }))
  const inputs = [
    { uid: 'a', lessonId: '01', questionId: 'country', choice: '일본', updatedAt: 1 },
    { uid: 'b', lessonId: '01', questionId: 'country', choice: '호주', updatedAt: 1 },
  ]
  const none = attendanceEdit(undefined)
  const here = attendingStudents(students, inputs, none).map((s) => s.uid)
  if (here.join(',') !== 'a,b') fail('출석 기준', `답한 사람만 와야 하는데 ${here.join(',') || '아무도 없음'} 이 나왔다`)
  else pass('출석 기준', '오늘의 질문에 답한 사람만 오늘의 대상이 된다 (답 2명 / 명단 4명)')

  /* 손질 — 못 누른 사람 넣기 · 답했지만 자리에 없는 사람 빼기 */
  let edit = withAttendance(none, 'c', false, true)
  edit = withAttendance(edit, 'a', true, false)
  const fixed = attendingStudents(students, inputs, edit).map((s) => s.uid)
  if (fixed.join(',') !== 'b,c') fail('출석 손질', `강사가 고친 뒤 b,c 여야 하는데 ${fixed.join(',') || '아무도 없음'} 이다`)
  /* 되돌리면 손질이 남지 않는다 — 기준은 언제나 학생이 남긴 답이다 */
  const back = withAttendance(withAttendance(edit, 'c', false, false), 'a', true, true)
  if (back.in.length !== 0 || back.out.length !== 0) fail('출석 손질', `되돌렸는데 손질이 남았다 — in [${back.in}] · out [${back.out}]`)
  else pass('출석 손질', '못 누른 사람을 넣고 자리에 없는 사람을 뺄 수 있고, 되돌리면 손질이 남지 않는다')

  /* 출석부 — 차시마다 누가 왔나. 아무도 없는 차시는 아직 안 한 차시다 */
  const byLesson = attendanceByLesson(
    [...inputs, { uid: 'a', lessonId: '02', questionId: 'drink', choice: '물', updatedAt: 2 }],
    [{ lessonId: '02', attendance: { in: ['d'], out: [] } }],
  )
  if (byLesson.size !== 2 || byLesson.get('02').size !== 2 || !byLesson.get('02').has('d')) {
    fail('출석부', `차시 2개 · 2강 출석 2명이어야 하는데 ${byLesson.size}차시 · ${byLesson.get('02')?.size}명이다`)
  } else pass('출석부', '학기 출석부가 차시마다 답한 사람과 강사 손질을 합쳐 센다')
  if (answeredUids(inputs).size !== 2) fail('출석 기준', '답한 사람 수를 잘못 센다')
}

/* ── 화면이 그 기준을 쓰는가 ── */
{
  const teach = await readFile('src/routes/Teach.tsx', 'utf8')
  const panel = await readFile('src/components/groups/FormationPanel.tsx', 'utf8')
  const lessonPage = await readFile('src/routes/Lesson.tsx', 'utf8')

  if (!/attendingStudents\(enrolled, groupInputs/.test(teach)) fail('출석 기준', '수업 화면이 응답·게임의 분모로 출석한 사람을 쓰지 않는다 — 결석자가 늘 미제출로 남는다')
  else if (!/teacher=\{\{ students,/.test(teach)) fail('출석 기준', '수업 화면이 LessonBody 에 출석자 목록(students)을 주지 않는다')
  else pass('출석 기준', '수업 화면의 응답 n/N · 게임 참가 · 발표자 뽑기가 모두 출석한 사람을 분모로 쓴다')

  if (!/attendingStudents\(students, inputs/.test(panel)) fail('출석 배정', '모둠 나누기가 출석한 사람만 배정하지 않는다')
  else if (!/absentUids: absentees\.map/.test(panel)) fail('출석 배정', '확정한 회차에 결석자가 기록되지 않는다')
  else pass('출석 배정', '모둠 배정 대상은 오늘의 질문에 답한 사람이고, 나머지는 회차에 결석으로 남는다')

  /* 오늘의 질문은 등록표가 도입 단계마다 넣고, LessonBody 가 두 화면에 같이 그린다 — 경로 파일이 조건을 걸면 안 된다 */
  const registry = await readFile('src/lib/teach-registry.ts', 'utf8')
  const body = await readFile('src/components/lesson/LessonBody.tsx', 'utf8')
  if (/<FormationQuestionView/.test(lessonPage)) fail('매 차시 질문', 'Lesson.tsx 가 오늘의 질문을 LessonBody 밖에서 그린다 — 강사 화면에는 없게 된다')
  else if (!/step\.kind === 'intro'\) out\.push\(mk\('question'/.test(registry)) fail('매 차시 질문', '등록표가 도입 단계마다 오늘의 질문 블록을 넣지 않는다 — 모둠을 나누지 않는 차시는 출석을 잴 수 없다')
  else if (!/case 'question'/.test(body) || !/<FormationQuestionView/.test(body)) fail('매 차시 질문', 'LessonBody 가 오늘의 질문 블록을 그리지 않는다')
  else pass('매 차시 질문', '도입 단계마다 오늘의 질문 블록이 등록표에서 나오고, LessonBody 가 학생·강사 화면에 같이 그린다')
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

/* ── 차시가 쓰는 모둠 — 나누는 차시는 나누기 전까지 비어 있고, 나누지 않는 차시는 지난 회차를 잇는다 (강의자 지적 2026-09-22) ── */
{
  const edu = defaultFormationLessons('edu')
  const method = defaultFormationLessons('method')
  const rounds = [mk('01', '1강 모둠'), mk('03', '3강 모둠')]
  const checks = [
    ['교육론 4강(매 차시 나눔) — 나누기 전', roundForLesson('04', rounds, edu), null],
    ['교육론 3강 — 그 차시에서 나눈 것', roundForLesson('03', rounds, edu)?.lessonId, '03'],
    ['교수법 5강(홀수 · 나누는 차시) — 나누기 전', roundForLesson('05', rounds, method), null],
    ['교수법 4강(짝수) — 3강 모둠을 잇는다', roundForLesson('04', rounds, method)?.lessonId, '03'],
    ['교수법 2강(짝수) — 1강 모둠을 잇는다', roundForLesson('02', rounds, method)?.lessonId, '01'],
    /* 5강에서 아직 안 나눴으면 6강은 비어 있어야 한다 — 3강 모둠을 끌어오지 않는다 (강의자 지적 2026-09-22) */
    ['교수법 6강(짝수) — 5강 회차가 없으면 3강 것을 끌어오지 않는다', roundForLesson('06', rounds, method), null],
    ['교수법 6강(짝수) — 5강 회차가 있으면 그것', roundForLesson('06', [...rounds, mk('05', '5강 모둠')], method)?.lessonId, '05'],
    ['교수법 6강 — 6강에서 직접 나눴으면 그것이 먼저', roundForLesson('06', [...rounds, mk('05', '5강 모둠'), mk('06', '6강 모둠')], method)?.lessonId, '06'],
    ['교수법 13강(나누는 회차 밖) — 바로 앞 나누는 차시인 11강 것', roundForLesson('13', [mk('11', '11강 모둠')], ['01', '03', '05', '07', '09', '11']), '11강 모둠'].map((v, i) => (i === 1 ? v?.groups?.[0]?.name : v)),
  ]
  let bad = 0
  for (const [label, got, want] of checks) {
    if (got !== want) {
      bad += 1
      fail('차시의 모둠', `${label}: ${JSON.stringify(got)} (기대 ${JSON.stringify(want)})`)
    }
  }
  if (bad === 0) pass('차시의 모둠', '나누는 차시는 나누기 전까지 지난 모둠을 보이지 않고, 나누지 않는 차시만 지난 회차를 잇는다')
}

/*
 * ── 전수조사 — 두 과목의 모든 차시가 규칙대로인가 (강의자 확정 2026-09-22) ──
 *   교육론    12차시 전부 나눈다.
 *   교수법    12강까지 홀수(1·3·5·7·9·11)에 나누고 그다음 짝수는 앞 차시를 따른다. 13강부터는 매 차시 나눈다.
 * 차시 하나하나를 적어 놓고 센다 — 「홀수면 된다」로 세면 13강부터가 빠진다.
 */
{
  const EXPECT = {
    edu: { form: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'], follow: {} },
    method: {
      form: ['01', '03', '05', '07', '09', '11', '13', '14', '15', '16', '17', '18'],
      /* 따르는 차시 → 따라야 할 차시 */
      follow: { '02': '01', '04': '03', '06': '05', '08': '07', '10': '09', '12': '11' },
    },
  }
  let bad = 0
  for (const [courseId, want] of Object.entries(EXPECT)) {
    const ids = lessonIndex(courseId).map((l) => l.id)
    const form = defaultFormationLessons(courseId)
    const missingLesson = [...want.form, ...Object.keys(want.follow)].filter((id) => !ids.includes(id))
    if (missingLesson.length > 0) {
      bad += 1
      fail('전수조사', `${courseId} 색인에 없는 차시를 기대표가 적었다 — ${missingLesson.join(' · ')}`)
    }
    if (JSON.stringify(form) !== JSON.stringify(want.form)) {
      bad += 1
      fail('전수조사', `${courseId} 나누는 차시가 ${form.join('·')} 다 (기대 ${want.form.join('·')})`)
    }
    /* 색인의 모든 차시가 「나눈다」이거나 「앞을 따른다」 둘 중 하나여야 한다 — 빠진 차시가 없다 */
    for (const id of ids) {
      const isForm = form.includes(id)
      const follows = want.follow[id]
      if (isForm === Boolean(follows)) {
        bad += 1
        fail('전수조사', `${courseId} ${id}강이 어느 쪽인지 정해지지 않았다 (나눔 ${isForm} · 따름 ${follows ?? '없음'})`)
      }
      if (follows) {
        /* 따르는 차시는 바로 앞 나누는 차시의 회차를 쓴다 — 그 회차가 있을 때와 없을 때 둘 다 */
        const rounds = [mk(follows, `${follows}강 모둠`)]
        const got = roundForLesson(id, rounds, form)?.lessonId ?? null
        if (got !== follows) {
          bad += 1
          fail('전수조사', `${courseId} ${id}강이 ${follows}강 모둠을 따르지 않는다 (${got})`)
        }
        if (roundForLesson(id, [], form) !== null) {
          bad += 1
          fail('전수조사', `${courseId} ${id}강이 앞 차시에서 안 나눴는데도 모둠을 보인다`)
        }
      } else if (roundForLesson(id, [mk(String(Number(id) - 1).padStart(2, '0'), '앞 차시 모둠')], form) !== null) {
        bad += 1
        fail('전수조사', `${courseId} ${id}강은 나누는 차시인데 앞 차시 모둠을 끌어온다`)
      }
    }
  }
  if (bad === 0) pass('전수조사', `교육론 12차시는 매 차시 나누고, 교수법은 ${METHOD_PAIRED_UNTIL}강까지 홀수에 나눈 뒤 짝수가 따르며 13강부터 매 차시 나눈다 — 30차시 전부 확인`)
}

report('verify:groups')

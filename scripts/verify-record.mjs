/**
 * npm run verify:record — 차시 활동 기록 (강의자 지시 2026-10-09)
 *
 *   · 강사만 연다 (instructorOnly 경로 · 화면 안 isInstructor 확인)
 *   · 읽기만 한다 — 화면 파일이 repo 의 쓰기 메서드를 하나도 부르지 않는다. 학생이 쓴 것을 건드리지 않는다
 *   · 칸 종류 여덟 가지를 사람이 읽는 글로 바꾼다 — 앱의 answerText 를 그대로 부른다
 *   · 익명 번호는 학번 순이고 화면 안에서 같은 사람이 같은 번호다
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report } from './_report.mjs'

const { answerText, anonLabels, lastSubmitted } = await import('../src/lib/lesson-record.ts')

/* ── 읽기만 ── */
{
  const src = await readFile('src/routes/instructor/LessonRecord.tsx', 'utf8')
  const repoSrc = await readFile('src/lib/repo.ts', 'utf8')
  const iface = repoSrc.split('export interface Repo')[1] ?? ''
  const methods = [...iface.matchAll(/^  ([a-zA-Z]+)\(/gm)].map((m) => m[1])
  const writes = methods.filter((m) => !/^(watch|get)/.test(m))
  const used = writes.filter((m) => new RegExp(`repo[!?]?\\.${m}\\(`).test(src))
  if (used.length) fail('읽기만', `차시 활동 기록이 쓰기 메서드를 부른다 — ${used.join(', ')}`)
  else pass('읽기만', `화면이 repo 의 쓰기 메서드 ${writes.length}개 가운데 어느 것도 부르지 않는다 — watch 만 쓴다`)
  if (/apiPost|fetch\(/.test(src)) fail('읽기만', '화면이 서버를 부른다')
  const app = await readFile('src/App.tsx', 'utf8')
  if (!/path="\/instructor\/class\/:classId\/record\/:lessonId\?"[\s\S]{0,120}instructorOnly/.test(app)) fail('강사만', '경로가 instructorOnly 가 아니다')
  else if (!/if \(!isInstructor\) return <Navigate/.test(src)) fail('강사만', '화면 안에서 강사를 다시 확인하지 않는다')
  else pass('강사만', '경로와 화면이 강사만 연다')
  if (!/lazyRoute\('차시 활동 기록'/.test(app)) fail('번들', '첫 번들에 들어갔다 — lazyRoute 로 둔다')
}

/* ── 글로 바꾸기 ── */
{
  let bad = 0
  const check = (label, got, want) => {
    if (got !== want) {
      bad += 1
      fail('글로 바꾸기', `${label}: ${JSON.stringify(got)} (기대 ${JSON.stringify(want)})`)
    }
  }
  const items = [{ id: 'a', label: '가' }, { id: 'b', label: '나' }, { id: 'c', label: '다' }]
  check('text', answerText({ key: 'k', kind: 'text', label: '' }, '한 줄'), '한 줄')
  check('choice', answerText({ key: 'k', kind: 'choice', label: '', options: ['x', 'y'] }, 'y'), 'y')
  check('multi', answerText({ key: 'k', kind: 'multi', label: '' }, ['① 가', '③ 다']), '① 가 · ③ 다')
  check('allocation — 큰 것부터, 0 은 뺀다', answerText({ key: 'k', kind: 'allocation', label: '', items }, { a: 20, b: 0, c: 80 }), '다 80 · 가 20')
  check('rank', answerText({ key: 'k', kind: 'rank', label: '', items }, ['c', 'a', 'b']), '1. 다  2. 가  3. 나')
  check('sort', answerText({ key: 'k', kind: 'sort', label: '', items, bins: [{ id: 'in', label: '넣는다' }, { id: 'out', label: '뺀다' }] }, { a: 'in', b: 'out', c: 'in' }), '[넣는다] 가, 다  [뺀다] 나')
  check('quadrant', answerText({ key: 'k', kind: 'quadrant', label: '', quadrants: [{ id: 'q1', label: '앞' }, { id: 'q2', label: '뒤' }] }, { q1: ' 하나 ', q2: '' }), '앞: 하나')
  check('빈 값', answerText({ key: 'k', kind: 'text', label: '' }, undefined), '')
  check('임시 저장만 있는 문서는 낸 것이 아니다', lastSubmitted({ uid: 'u', versions: [], draft: { payload: { k: 1 }, savedAt: 1 }, latestV: 0, submittedAt: null }), null)
  check('마지막 판', lastSubmitted({ uid: 'u', versions: [{ v: 1, payload: { k: 'a' }, confidence: null, createdAt: 1, changedReason: null }, { v: 2, payload: { k: 'b' }, confidence: null, createdAt: 2, changedReason: null }], draft: null, latestV: 2, submittedAt: 2 })?.payload.k, 'b')
  const anon = anonLabels([{ uid: 'z', studentId: '2026003' }, { uid: 'y', studentId: '2026001' }, { uid: 'x', studentId: '2026002' }])
  check('익명 번호는 학번 순', [anon.y, anon.x, anon.z].join(','), '학생 1,학생 2,학생 3')
  if (bad === 0) pass('글로 바꾸기', '칸 종류 여덟 가지 · 임시 저장 제외 · 마지막 판 · 익명 번호가 맞다')
}

report('verify:record')

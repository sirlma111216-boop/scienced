/**
 * npm run verify:course (8차 8절 신설)
 *
 *   · 두 과목의 색인과 내용 파일이 맞는다 — 색인의 모든 차시가 import() 로 불려오고 id·과목·골격·제목이 같다
 *   · 차시 번호는 01 부터 빠짐없이 · 교수법 18 · 교육론 12 (아직 다 쓰지 않았으면 개수를 알린다)
 *   · 두 과목이 자료·상황·과제·개념 문장을 공유하지 않는다 — 문장 단위 대조. 1강은 예외 (강의자 답 4)
 *   · 클래스 폼에 courseId 가 있고 규칙·저장 계층이 과목을 안다
 *   · 새 클래스가 여는 차시(INITIALLY_OPEN)가 색인의 published 와 같다
 *   · 검증기가 과목 둘 다 돌았는지 — 이 파일 자체가 두 과목을 돌며 개수를 적는다
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report } from './_report.mjs'
import { COURSE_SHORT, activitiesOf, conceptsOf, loadCourses, where } from './_courses.mjs'

const { INITIALLY_OPEN } = await import('../src/content/types.ts')
const { sentences, studentStrings } = await import('./_wording-rules.mjs')

const TOTAL = { method: 18, edu: 12 }
const courses = await loadCourses()

/* ── 색인 ↔ 내용 ── */
for (const c of courses) {
  const ids = c.index.map((e) => e.id)
  ids.forEach((id, i) => {
    if (id !== String(i + 1).padStart(2, '0')) fail('차시 번호', `${c.title} 색인 ${i + 1}번째가 ${id} 다 — 01 부터 빠짐없이`)
  })
  if (c.lessons.length !== c.index.length) fail('색인', `${c.title} 색인은 ${c.index.length}개인데 불러온 차시는 ${c.lessons.length}개다 — loaders 가 빠졌다`)
  for (const e of c.index) {
    const l = c.lessons.find((x) => x.id === e.id)
    if (!l) {
      fail('색인', `${c.title} ${Number(e.id)}강 내용 파일이 없다`)
      continue
    }
    if (l.courseId !== c.courseId) fail('색인', `${where(l)} 파일의 courseId 가 ${l.courseId} 다`)
    if (l.layout !== e.layout) fail('색인', `${where(l)} 골격이 색인(${e.layout})과 파일(${l.layout})에서 다르다`)
    if (l.title !== e.title || l.centralQuestion !== e.centralQuestion) fail('색인', `${where(l)} 제목·중심 질문이 색인과 파일에서 다르다`)
    if (l.published !== e.published) fail('색인', `${where(l)} published 가 색인과 파일에서 다르다`)
    if (l.order !== e.order || l.order !== Number(l.id)) fail('색인', `${where(l)} order 가 ${l.order} 다`)
    if ((e.legacyStepIds ?? []).join() !== (l.legacyStepIds ?? []).join()) fail('색인', `${where(l)} legacyStepIds 가 색인과 파일에서 다르다`)
  }
  const published = c.index.filter((e) => e.published).map((e) => e.id)
  if (published.join(',') !== INITIALLY_OPEN[c.courseId].filter((id) => ids.includes(id)).join(',')) {
    fail('공개 차시', `${c.title} 시드 published [${published}] 와 INITIALLY_OPEN [${INITIALLY_OPEN[c.courseId]}] 이 다르다`)
  }
  console.log(`  · ${c.title}: ${c.lessons.length} / ${TOTAL[c.courseId]}차시 (공개 ${published.length})`)
  if (c.lessons.length < TOTAL[c.courseId]) console.log(`    아직 안 쓴 차시 ${TOTAL[c.courseId] - c.lessons.length}개`)
}
pass('색인', '두 과목의 색인과 내용 파일이 id · 과목 · 골격 · 제목 · 공개 여부에서 같다')

/* ── 문장 중복 — 두 과목 사이 (8.3) ── */
{
  const norm = (s) => s.replace(/[\s「」『』"'“”‘’.,·—-]/g, '')
  const bank = new Map()
  const dupes = []
  for (const c of courses) {
    for (const l of c.lessons) {
      if (l.id === '01') continue
      const texts = []
      for (const a of activitiesOf(l)) texts.push(['상황', a.situation.body], ['과제', a.task])
      texts.push(['도입', l.intro.stimulus.body])
      for (const k of conceptsOf(l)) {
        texts.push(['what', k.what])
        for (const p of k.keyPoints) texts.push(['기준', p])
      }
      for (const [kind, text] of texts) {
        for (const s of sentences(text)) {
          const key = norm(s)
          if (key.length < 12) continue
          const prev = bank.get(key)
          if (prev && prev.courseId !== c.courseId) dupes.push(`${prev.at} ↔ ${where(l)} (${kind}) 「${s.slice(0, 36)}」`)
          if (!prev) bank.set(key, { courseId: c.courseId, at: where(l) })
        }
      }
    }
  }
  for (const d of dupes.slice(0, 40)) fail('과목 간 중복', d)
  if (dupes.length === 0) pass('과목 간 중복', '두 과목의 자료 · 상황 · 과제 · 개념 문장이 겹치지 않는다 (1강 제외)')
}

/* ── 클래스가 과목을 안다 ── */
{
  const form = await readFile('src/content/classes.ts', 'utf8')
  const types = await readFile('src/lib/types.ts', 'utf8')
  const repo = await readFile('src/lib/repo-firestore.ts', 'utf8')
  if (!/courseId: 'method' \| 'edu'/.test(form)) fail('클래스 과목', 'ClassFormValues 에 courseId 가 없다')
  if (!/courseId\?: CourseId/.test(types)) fail('클래스 과목', 'ClassDoc 에 courseId 가 없다')
  if (!/courseIdFromTitle/.test(repo)) fail('클래스 과목', 'Firestore 구현이 옛 클래스(courseId 없음)의 과목을 제목에서 알아내지 않는다')
  pass('클래스 과목', '클래스 문서 · 폼 · 저장 계층이 과목을 안다')
  const method = await readFile('src/content/courses/method/index.ts', 'utf8')
  const edu = await readFile('src/content/courses/edu/index.ts', 'utf8')
  if (!/import\('\.\/lesson/.test(method) || !/import\('\.\/lesson/.test(edu)) fail('지연 불러오기', '차시 내용이 import() 로 나뉘어 있지 않다 — 미공개 차시가 번들에 실린다 (부록 ①)')
  else pass('지연 불러오기', '차시 내용은 과목별 import() 로 따로 내려온다')
}

console.log(`  · 검증한 과목: ${courses.map((c) => COURSE_SHORT[c.courseId]).join(' · ')}`)
report('verify:course')

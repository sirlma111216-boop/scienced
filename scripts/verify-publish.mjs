/**
 * npm run verify:publish
 *
 * 미공개 차시의 내용은 클라이언트로 아예 나가지 않아야 한다.
 *   · 새 클래스가 여는 차시(INITIALLY_OPEN)와 색인의 published 가 같다 (과목마다)
 *   · Firestore 규칙에 published 조건 · 강사 문서 판정 · 마지막 전체 차단이 있다
 *   · 학생 차시 화면은 공개 여부를 본 뒤에만 내용을 불러온다 (부록 ①)
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report } from './_report.mjs'
import { loadCourses } from './_courses.mjs'

const { INITIALLY_OPEN } = await import('../src/content/types.ts')

for (const c of await loadCourses()) {
  const published = c.index.filter((l) => l.published).map((l) => l.id)
  const expected = INITIALLY_OPEN[c.courseId].filter((id) => c.index.some((l) => l.id === id))
  if (published.join(',') !== expected.join(',')) fail('공개 차시', `${c.title} 시드는 [${published}] 인데 INITIALLY_OPEN 은 [${expected}] 이다`)
  else pass('공개 차시', `${c.title} — 시드와 새 클래스가 같은 차시를 연다 (${published.map(Number).join('·')}강)`)
}

const rules = await readFile('firestore.rules', 'utf8')
if (!/published\s*==\s*true/.test(rules)) fail('보안 규칙', 'firestore.rules 에 published == true 조건이 없다')
if (!/match\s*\/\{document=\*\*\}[\s\S]{0,120}allow read, write: if false/.test(rules)) fail('보안 규칙', 'firestore.rules 마지막에 전체 차단 규칙이 없다')
if (!/exists\([\s\S]{0,160}?\/instructors\/\$\(/.test(rules)) fail('보안 규칙', '강사 판정이 instructors/{uid} 문서 존재(exists)로 되어 있지 않다')
if (!/match \/instructors\/\{[^}]+\}[\s\S]{0,200}allow write: if false/.test(rules)) fail('보안 규칙', 'instructors 컬렉션에 클라이언트 쓰기 금지 규칙이 없다')
if (/isInstructor\s*==\s*true|request\.resource\.data\.role\s*==\s*['"]instructor/.test(rules)) fail('보안 규칙', '강사 권한을 클라이언트 boolean 으로 판정하는 곳이 있다')
pass('보안 규칙', 'published 조건 · 강사 문서 판정 · 마지막 전체 차단이 모두 있다')

const lesson = await readFile('src/routes/Lesson.tsx', 'utf8')
if (!/useLesson\(courseId, id \?\? null, open\)/.test(lesson)) fail('내용 전송', '학생 차시 화면이 공개 여부(open)를 보지 않고 내용을 불러온다 — 미공개 차시가 개발자 도구로 읽힌다 (부록 ①)')
else pass('내용 전송', '학생 차시 화면은 공개된 차시일 때만 import() 로 내용을 불러온다')

report('verify:publish')

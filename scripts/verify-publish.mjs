/**
 * npm run verify:publish
 *
 * 시드와 새 클래스가 같은 차시를 여는지 (지시서 13절).
 * 미공개 차시의 내용은 클라이언트로 아예 나가지 않아야 하므로
 * Firestore 규칙에도 같은 조건이 있는지 함께 본다.
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report } from './_report.mjs'

const { LESSONS } = await import('../src/content/lessons/index.ts')

/*
 * 시드의 published 와 INITIALLY_OPEN 이 같아야 한다.
 * 두 곳에 같은 목록이 있으면 반드시 어긋난다 —
 * 한쪽만 늘리면 새 클래스에는 열리는데 시드에는 닫혀 있는 차시가 생긴다.
 */
const { INITIALLY_OPEN } = await import('../src/content/types.ts')
const published = LESSONS.filter((l) => l.published).map((l) => l.id)
if (published.join(',') !== [...INITIALLY_OPEN].join(',')) {
  fail(
    '공개 차시',
    `시드는 [${published}] 인데 INITIALLY_OPEN 은 [${INITIALLY_OPEN}] 이다 — 두 목록이 같아야 한다`,
  )
} else {
  pass('공개 차시', `시드와 새 클래스가 같은 차시를 연다 (${published.join('·')}강)`)
}

// Firestore 규칙에도 published 조건이 있는가 — 프론트 필터링만으로 처리하지 않는다
let rules
try {
  rules = await readFile('firestore.rules', 'utf8')
} catch {
  fail('보안 규칙', 'firestore.rules 파일이 없다')
}

if (rules) {
  if (!/published\s*==\s*true/.test(rules)) {
    fail('보안 규칙', 'firestore.rules 에 published == true 조건이 없다')
  }
  if (!/match\s*\/\{document=\*\*\}[\s\S]{0,120}allow read, write: if false/.test(rules)) {
    fail('보안 규칙', 'firestore.rules 마지막에 전체 차단 규칙이 없다')
  }
  // 강사 판정은 instructors/{uid} 문서가 존재하는지로만 한다.
  // uid() 같은 헬퍼를 거쳐도 되지만, exists() 안에 instructors 경로가 있어야 한다.
  // 경로 안에 $(database) 처럼 괄호가 들어가므로 [^)] 로는 못 잡는다.
  if (!/exists\([\s\S]{0,160}?\/instructors\/\$\(/.test(rules)) {
    fail('보안 규칙', '강사 판정이 instructors/{uid} 문서 존재(exists)로 되어 있지 않다')
  }
  // 그리고 그 컬렉션은 어떤 클라이언트도 쓸 수 없어야 한다.
  if (!/match \/instructors\/\{[^}]+\}[\s\S]{0,200}allow write: if false/.test(rules)) {
    fail('보안 규칙', 'instructors 컬렉션에 클라이언트 쓰기 금지 규칙이 없다')
  }
  if (/isInstructor\s*==\s*true|request\.resource\.data\.role\s*==\s*['"]instructor/.test(rules)) {
    fail('보안 규칙', '강사 권한을 클라이언트 boolean 으로 판정하는 곳이 있다')
  }
  pass('보안 규칙', 'published 조건 · 강사 문서 판정 · 마지막 전체 차단이 모두 있다')
}

report('verify:publish')

/**
 * npm run verify:classes
 *
 * 2차 지시서 A 의 구조가 실제로 지켜지는지 본다.
 *
 *  · 학생 자료를 다루는 저장소 함수가 전부 classId 를 받는가
 *  · 실명(rosterName)이 학생이 읽을 수 있는 경로에 새지 않는가
 *  · 보안 규칙이 클래스 격리·실명 분리·보관 읽기전용을 담고 있는가
 *  · 콘텐츠 마스터에 published 가 남아 있지 않은가
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report, walk } from './_report.mjs'

/* ── 1. 학생 자료 함수는 전부 classId 를 첫 인자로 받는다 ── */
{
  const repo = await readFile('src/lib/repo.ts', 'utf8')

  // 클래스 안에서만 움직여야 하는 것들
  const SCOPED = [
    'saveDraft',
    'submitResponse',
    'getResponse',
    'watchResponse',
    'watchAllResponses',
    'watchPosts',
    'addPost',
    'revisePost',
    'toggleReaction',
    'addComment',
    'pinPost',
    'hidePost',
    'deletePost',
    'watchSession',
    'setSession',
    'joinLadder',
    'claimLadderSeat',
    'setLadder',
    'recordPick',
    'watchPicks',
    'watchGroups',
    'setGroups',
    'watchParticipation',
    'bumpParticipation',
    'watchLessonState',
    'setLessonPublished',
    'watchEnrollments',
    'enroll',
    'watchRoster',
    'setRosterEntry',
    'addAiProposal',
    'watchAiProposals',
    'reviewAiProposal',
  ]

  for (const fn of SCOPED) {
    // `fn(` 다음 첫 인자가 classId 인지 본다 (여러 줄 시그니처 포함)
    const re = new RegExp(`\\b${fn}\\s*\\(\\s*(?:\\n\\s*)?([A-Za-z_][\\w]*)`, '')
    const m = repo.match(re)
    if (!m) {
      fail('클래스 범위', `repo 인터페이스에 ${fn} 이 없다`)
      continue
    }
    if (m[1] !== 'classId') {
      fail('클래스 범위', `${fn} 의 첫 인자가 ${m[1]} 다 — classId 여야 한다`)
    }
  }
  pass('클래스 범위', `학생 자료를 다루는 ${SCOPED.length}개 함수가 모두 classId 를 첫 인자로 받는다`)
}

/* ── 2. 두 구현이 인터페이스를 실제로 채우는가 ── */
{
  const local = await readFile('src/lib/repo-local.ts', 'utf8')
  const fs = await readFile('src/lib/repo-firestore.ts', 'utf8')
  for (const [name, src] of [
    ['로컬', local],
    ['Firestore', fs],
  ]) {
    for (const fn of ['watchClasses', 'createClass', 'updateClass', 'watchRoster', 'setRosterEntry']) {
      if (!src.includes(fn)) fail('구현', `${name} 구현에 ${fn} 이 없다`)
    }
  }
  // 로컬 구현의 키도 클래스로 갈라져 있어야 한다
  if (!/c\.\$\{c\}\./.test(local) && !/`c\.\$\{c\}/.test(local)) {
    fail('클래스 범위', '로컬 구현의 저장 키가 클래스로 갈라져 있지 않다')
  }
  pass('구현', '두 구현 모두 클래스·명단 함수를 채우고, 로컬 키도 클래스로 갈라져 있다')
}

/* ── 3. 실명이 학생 경로로 새지 않는가 ── */
{
  const files = await walk('src', ['.ts', '.tsx'])
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    if (!/rosterName/.test(text)) continue
    // roster 를 다루는 곳과 명단 화면, 타입 정의만 허용한다.
    const allowed =
      /roster/i.test(file) ||
      /ClassStudents/.test(file) ||
      /lib[\\/]types\.ts$/.test(file) ||
      /lib[\\/]repo/.test(file)
    if (!allowed) {
      fail('실명 보호', `${file} 이 rosterName 을 다룬다 — 강사 전용 경로가 아니다`)
    }
  }
  // AppUser.displayName 에 학생 실명을 넣지 않는다는 주석이 있는가
  const types = await readFile('src/lib/types.ts', 'utf8')
  if (!/학생 실명은 여기 두지 않는다/.test(types)) {
    fail('실명 보호', 'AppUser.displayName 에 학생 실명을 두지 않는다는 근거가 없다')
  }
  pass('실명 보호', 'rosterName 은 강사 전용 경로에서만 다뤄진다')
}

/* ── 4. 보안 규칙 ── */
{
  const rules = await readFile('firestore.rules', 'utf8')

  const CHECKS = [
    [/function isEnrolled\(cid\)[\s\S]{0,220}enrollments\/\$\(uid\(\)\)/, '수강생 판정이 enrollments 문서 존재로 되어 있다'],
    [/exists\([\s\S]{0,160}?\/instructors\/\$\(/, '강사 판정이 instructors 문서 존재로 되어 있다'],
    [/match \/roster\/\{userId\}[\s\S]{0,160}allow read, write: if isInstructor\(\)/, 'roster 는 강사만 읽고 쓴다'],
    [/function classActive\(cid\)[\s\S]{0,140}status == 'active'/, '보관 클래스를 판정하는 함수가 있다'],
    [/classActive\(cid\)/, '보관 클래스에서 쓰기를 막는다'],
    [/function lessonOpen\(cid, lid\)/, '차시 공개가 클래스별로 판정된다'],
    [/hasSubmitted\(cid, lid, sid\)/, '제출 전에는 의견을 읽지 못한다'],
    [/match \/\{document=\*\*\}[\s\S]{0,120}allow read, write: if false/, '마지막에 전체 차단이 있다'],
  ]
  for (const [re, label] of CHECKS) {
    if (!re.test(rules)) fail('보안 규칙', `${label} — 찾지 못했다`)
  }

  // roster 가 enrollments 와 합쳐지지 않았는지
  if (/match \/enrollments\/\{[^}]+\}[\s\S]{0,400}rosterName/.test(rules)) {
    fail('보안 규칙', 'enrollments 규칙에 rosterName 이 섞여 있다 — 분리 구조를 합치지 마라')
  }
  pass('보안 규칙', '클래스 격리 · 실명 분리 · 보관 읽기전용 · 전체 차단이 모두 있다')
}

/* ── 5. 규칙 테스트가 요구된 두 항목을 실제로 담고 있는가 ── */
{
  const t = await readFile('scripts/test-rules.mjs', 'utf8')
  if (!/클래스 격리/.test(t)) fail('규칙 테스트', '다른 클래스 읽기 차단 검사가 없다')
  if (!/실명 보호/.test(t)) fail('규칙 테스트', 'roster 읽기 차단 검사가 없다')
  if (!/보관 클래스/.test(t)) fail('규칙 테스트', '보관 클래스 읽기전용 검사가 없다')
  pass('규칙 테스트', 'A.6 이 요구한 검사가 test:rules 에 들어 있다')
}

/* ── 6. 콘텐츠 마스터에는 클래스별 상태가 없어야 한다 ── */
{
  const fsRepo = await readFile('src/lib/repo-firestore.ts', 'utf8')
  if (/doc\(db, 'courses'/.test(fsRepo) || /collection\(db, 'courses'/.test(fsRepo)) {
    fail('경로', 'Firestore 구현이 아직 courses/* 를 쓴다')
  }
  if (!/'classes', classId/.test(fsRepo)) {
    fail('경로', 'Firestore 구현이 classes/{classId} 아래를 쓰지 않는다')
  }
  pass('경로', '학생 자료가 전부 classes/{classId} 아래에 있다')
}

/* ── 7. 클래스 만들기 규칙 ── */
{
  const c = await readFile('src/content/classes.ts', 'utf8')
  if (!/TERMS/.test(c)) fail('클래스 상수', '학기 선택지가 상수로 없다')
  if (!/0\/O\/1\/I\/l|CODE_ALPHABET/.test(c)) fail('참여 코드', '혼동되는 글자를 뺀 근거가 없다')
  for (const ch of ['0', 'O', '1', 'I', 'l']) {
    const m = c.match(/const CODE_ALPHABET = '([^']+)'/)
    if (m && m[1].includes(ch)) fail('참여 코드', `코드 문자표에 헷갈리는 ${ch} 가 있다`)
  }
  if (!/start < end/.test(c)) fail('시간 검사', '종료가 시작보다 빠른 경우를 막지 않는다')
  pass('클래스 만들기', '학기 상수 · 혼동 글자 제외 코드 · 시간 순서 검사가 있다')
}

report('verify:classes')

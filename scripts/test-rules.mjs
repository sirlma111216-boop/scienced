/**
 * npm run test:rules
 *
 * Firestore 보안 규칙을 에뮬레이터에 붙여 실제로 읽고 써 본다.
 * 규칙을 눈으로 읽는 것과 실제로 막히는 것은 다르다.
 *
 * 2차 지시서 A.6 이 반드시 넣으라고 한 두 가지를 먼저 검사한다.
 *   ① 다른 클래스의 자료는 어떤 경로로도 읽히지 않는다.
 *   ② roster(실명)는 학생이 자기 것도 읽지 못한다.
 *
 * 실행:
 *   npm run emulators      (다른 터미널에서 먼저)
 *   npm run test:rules
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report } from './_report.mjs'

const PROJECT_ID = 'sls-rules-test'
const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'

let testing
try {
  testing = await import('@firebase/rules-unit-testing')
} catch {
  console.error(
    '\n@firebase/rules-unit-testing 이 없습니다.\n' +
      '  npm i -D @firebase/rules-unit-testing\n' +
      '설치한 뒤 다시 실행하세요.\n',
  )
  process.exit(1)
}

const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = testing

// 에뮬레이터가 떠 있는지 먼저 본다. 안 떠 있으면 조용히 통과하지 않는다.
try {
  const res = await fetch(`http://${HOST}/`)
  if (!res.ok && res.status !== 200 && res.status !== 404) throw new Error(String(res.status))
} catch {
  // Firestore 에뮬레이터는 Java 로 돌아간다. 이것이 가장 흔한 실패 원인이라 먼저 짚는다.
  const { spawnSync } = await import('node:child_process')
  const hasJava = spawnSync('java', ['-version'], { shell: true }).status === 0

  console.error(`\nFirestore 에뮬레이터(${HOST})에 닿지 못했습니다.\n`)
  if (!hasJava) {
    console.error(
      '  원인: Java 가 없습니다. Firestore 에뮬레이터는 Java 위에서 돕니다.\n' +
        '    1) JDK 21 설치 — https://adoptium.net (Temurin)\n' +
        '    2) 새 터미널을 열고  java -version  으로 확인\n' +
        '    3) npm run emulators\n' +
        '    4) 다른 터미널에서  npm run test:rules\n',
    )
  } else {
    console.error('  다른 터미널에서 먼저:  npm run emulators\n')
  }
  process.exit(1)
}

const env = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { rules: await readFile('firestore.rules', 'utf8'), host: HOST.split(':')[0], port: Number(HOST.split(':')[1]) },
})

const A = 'class-A'
const B = 'class-B'
const TEACHER = 'teacher-1'
const S1 = 'student-1' // A 수강생
const S2 = 'student-2' // B 수강생

/** 규칙을 우회해 사전 자료를 심는다. */
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  await db.doc(`instructors/${TEACHER}`).set({ role: 'instructor' })

  for (const [cid, member] of [
    [A, S1],
    [B, S2],
  ]) {
    await db.doc(`classes/${cid}`).set({
      id: cid,
      ownerUid: TEACHER,
      status: 'active',
      enrollmentOpen: true,
      requireJoinCode: false,
      displayName: cid,
    })
    await db.doc(`classes/${cid}/enrollments/${member}`).set({ uid: member, status: 'active' })
    await db.doc(`classes/${cid}/roster/${member}`).set({ uid: member, rosterName: '홍길동', memo: '' })
    await db.doc(`classes/${cid}/lessonState/01`).set({ lessonId: '01', published: true })
    await db.doc(`classes/${cid}/lessonState/02`).set({ lessonId: '02', published: false })
    await db
      .doc(`classes/${cid}/lessons/01/steps/step-open/responses/${member}`)
      .set({ uid: member, versions: [{ v: 1, payload: {} }], latestV: 1 })
    await db
      .doc(`classes/${cid}/lessons/01/steps/step-open/posts/p1`)
      .set({ uid: member, isPinned: false, isHidden: false, reactions: {}, comments: [], versions: [], latestV: 1 })
  }

  // 보관된 클래스
  await db.doc(`classes/archived-C`).set({
    id: 'archived-C',
    ownerUid: TEACHER,
    status: 'archived',
    enrollmentOpen: false,
    requireJoinCode: false,
    displayName: 'C',
  })
  await db.doc(`classes/archived-C/enrollments/${S1}`).set({ uid: S1, status: 'active' })
  await db.doc(`classes/archived-C/lessonState/01`).set({ lessonId: '01', published: true })
})

const asS1 = env.authenticatedContext(S1).firestore()
const asS2 = env.authenticatedContext(S2).firestore()
const asTeacher = env.authenticatedContext(TEACHER).firestore()
const asAnon = env.unauthenticatedContext().firestore()

/* ── ① 다른 클래스의 자료는 어떤 경로로도 읽히지 않는다 ── */
{
  await assertSucceeds(asS1.doc(`classes/${A}/enrollments/${S1}`).get())
  await assertFails(asS1.doc(`classes/${B}/enrollments/${S2}`).get())
  await assertFails(asS1.doc(`classes/${B}/lessonState/01`).get())
  await assertFails(asS1.doc(`classes/${B}/lessons/01/steps/step-open/responses/${S2}`).get())
  await assertFails(asS1.doc(`classes/${B}/lessons/01/steps/step-open/posts/p1`).get())
  await assertFails(asS1.doc(`classes/${B}/sessions/01`).get())
  await assertFails(asS1.doc(`classes/${B}/picks/x`).get())
  await assertFails(asS1.doc(`classes/${B}/participation/${S2}`).get())
  await assertFails(asS1.collection(`classes/${B}/lessons/01/steps/step-open/posts`).get())
  pass('클래스 격리', 'A 수강생이 B 클래스의 등록·공개·응답·의견·세션·추첨·참여를 전부 읽지 못한다')
}

/* ── ② roster 는 학생이 자기 것도 읽지 못한다 ── */
{
  await assertFails(asS1.doc(`classes/${A}/roster/${S1}`).get())
  await assertFails(asS1.collection(`classes/${A}/roster`).get())
  await assertFails(asS2.doc(`classes/${A}/roster/${S1}`).get())
  await assertSucceeds(asTeacher.doc(`classes/${A}/roster/${S1}`).get())
  await assertFails(asS1.doc(`classes/${A}/roster/${S1}`).set({ rosterName: '내가고침' }))
  pass('실명 보호', '학생은 자기 roster 문서도 읽지 못한다. 강사만 읽고 쓴다')
}

/* ── 미공개 차시 ── */
{
  await assertSucceeds(asS1.doc(`classes/${A}/lessons/01/steps/step-open`).get())
  await assertFails(asS1.doc(`classes/${A}/lessons/02/steps/step-open`).get())
  await assertSucceeds(asTeacher.doc(`classes/${A}/lessons/02/steps/step-open`).get())
  pass('미공개 차시', '학생은 published:false 차시의 단계를 읽지 못한다. 강사는 읽는다')
}

/* ── 응답: 남의 것 못 읽고, 기존 버전 못 지운다 ── */
{
  await assertSucceeds(asS1.doc(`classes/${A}/lessons/01/steps/step-open/responses/${S1}`).get())
  await assertFails(asS2.doc(`classes/${A}/lessons/01/steps/step-open/responses/${S1}`).get())

  // 버전을 줄이는 수정은 막힌다
  await assertFails(
    asS1
      .doc(`classes/${A}/lessons/01/steps/step-open/responses/${S1}`)
      .set({ uid: S1, versions: [], latestV: 0 }),
  )
  // 뒤에 붙이는 것은 된다
  await assertSucceeds(
    asS1.doc(`classes/${A}/lessons/01/steps/step-open/responses/${S1}`).set({
      uid: S1,
      versions: [{ v: 1, payload: {} }, { v: 2, payload: { a: 1 } }],
      latestV: 2,
    }),
  )
  pass('응답 추가 전용', '남의 응답을 못 읽고, 기존 버전을 지우거나 앞을 바꾸지 못한다')
}

/* ── 보관된 클래스는 읽기 전용 ── */
{
  await assertSucceeds(asS1.doc(`classes/archived-C/lessonState/01`).get())
  await assertFails(
    asS1
      .doc(`classes/archived-C/lessons/01/steps/step-open/responses/${S1}`)
      .set({ uid: S1, versions: [{ v: 1, payload: {} }], latestV: 1 }),
  )
  await assertFails(
    asTeacher.doc(`classes/archived-C/lessonState/02`).set({ lessonId: '02', published: true }),
  )
  pass('보관 클래스', '읽기는 되고 학생도 강사도 새로 쓰지 못한다')
}

/* ── 강사 문서는 아무도 못 쓴다 ── */
{
  await assertFails(asTeacher.doc(`instructors/${S1}`).set({ role: 'instructor' }))
  await assertFails(asS1.doc(`instructors/${S1}`).set({ role: 'instructor' }))
  pass('강사 승격 차단', '어떤 클라이언트도 instructors 문서를 만들 수 없다')
}

/* ── 비로그인은 아무것도 못 읽는다 ── */
{
  await assertFails(asAnon.doc(`classes/${A}`).get())
  await assertFails(asAnon.doc(`classes/${A}/lessonState/01`).get())
  pass('비로그인 차단', '로그인하지 않으면 클래스 문서도 읽지 못한다')
}

/* ── AI 제안: pending 으로만 들어오고 원문은 못 바꾼다 ── */
{
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx
      .firestore()
      .doc(`classes/${A}/aiProposals/x`)
      .set({ status: 'pending', original: '원문', edited: '원문', reviewedAt: null })
  })
  // 검토를 건너뛴 생성은 막힌다
  await assertFails(
    asTeacher
      .doc(`classes/${A}/aiProposals/y`)
      .set({ status: 'accepted', original: 'o', edited: 'o', reviewedAt: null }),
  )
  // 원문 변경은 막힌다
  await assertFails(
    asTeacher.doc(`classes/${A}/aiProposals/x`).update({ original: '몰래 바꿈' }),
  )
  // 고쳐서 채택은 된다
  await assertSucceeds(
    asTeacher
      .doc(`classes/${A}/aiProposals/x`)
      .update({ edited: '고침', status: 'accepted', reviewedAt: Date.now(), reviewedBy: TEACHER }),
  )
  // 학생은 채택된 것만 읽는다
  await assertSucceeds(asS1.doc(`classes/${A}/aiProposals/x`).get())
  // 지우지 못한다
  await assertFails(asTeacher.doc(`classes/${A}/aiProposals/x`).delete())
  pass('AI 검토 관문', 'pending 강제 · 원문 잠금 · 삭제 금지가 규칙에서 실제로 막힌다')
}

await env.cleanup()
report('test:rules')

/**
 * npm run test:flow
 *
 * 강사가 클래스를 만들고 → 학생이 그것을 보고 → 등록하고 → 답을 내고 →
 * 강사가 그 답을 읽기까지, 실제 보안 규칙 위에서 한 번에 돌려 본다.
 *
 * 왜 만들었나.
 *   증상이 나올 때마다 하나씩 고쳤다. 「계정 만들기가 안 된다」, 「학생에게 클래스가 안 뜬다」,
 *   「새 클래스 만들기가 안 된다」 — 셋 다 각각 다른 것처럼 보였지만 원인은 겹쳐 있었다.
 *   전 과정을 한 번도 끝까지 돌려 보지 않았기 때문에 그때그때 대응밖에 못 했다.
 *
 *   이 파일은 그 흐름을 통째로 돌린다. 어디서 끊기는지 한 번에 나온다.
 *
 * 다루지 못하는 것: 서비스 계정 IAM 권한(Cloudflare 서버 함수). 그것은 실제 배포에서만 확인된다.
 *
 * 실행:
 *   npm run emulators      (다른 터미널에서 먼저)
 *   npm run test:flow
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report } from './_report.mjs'

const PROJECT_ID = 'sls-flow-test'
const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'

let testing
try {
  testing = await import('@firebase/rules-unit-testing')
} catch {
  console.error('\n@firebase/rules-unit-testing 이 없습니다. npm i -D @firebase/rules-unit-testing\n')
  process.exit(1)
}
const { initializeTestEnvironment, assertFails, assertSucceeds } = testing

try {
  const res = await fetch(`http://${HOST}/`)
  if (!res.ok && res.status !== 200 && res.status !== 404) throw new Error(String(res.status))
} catch {
  const { ensureJavaOnPath } = await import('./_java.mjs')
  const hasJava = ensureJavaOnPath() !== null
  console.error(`\nFirestore 에뮬레이터(${HOST})에 닿지 못했습니다.\n`)
  console.error(hasJava ? '  다른 터미널에서 먼저:  npm run emulators\n' : '  Java 가 없습니다. JDK 21 이상 설치 — https://adoptium.net\n')
  process.exit(1)
}

const env = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    rules: await readFile('firestore.rules', 'utf8'),
    host: HOST.split(':')[0],
    port: Number(HOST.split(':')[1]),
  },
})

const TEACHER = 'teacher-1'
const STUDENT = 'student-1'
const CID = 'c-flow-1'

/* 강사 판정의 유일한 근거. 콘솔에서만 만든다. */
await env.withSecurityRulesDisabled(async (ctx) => {
  await ctx.firestore().doc(`instructors/${TEACHER}`).set({ role: 'instructor' })
})

const asTeacher = env.authenticatedContext(TEACHER).firestore()
const asStudent = env.authenticatedContext(STUDENT).firestore()

/* ── ① 강사가 클래스를 만든다 ── */
{
  await assertSucceeds(
    asTeacher.doc(`classes/${CID}`).set({
      id: CID,
      ownerUid: TEACHER,
      courseTitle: '과학교육론',
      affiliation: 'undergrad',
      year: 2026,
      term: '1',
      days: ['tue'],
      startTime: '13:00',
      endTime: '15:45',
      credits: 3,
      sessionLength: 'full',
      extendedAsHomework: true,
      displayName: '과학교육론 · 2026학년도 1학기',
      joinCode: 'ABCDEF',
      requireJoinCode: false,
      enrollmentOpen: true,
      status: 'active',
      createdAt: Date.now(),
    }),
  )
  await assertSucceeds(
    asTeacher.doc(`classes/${CID}/lessonState/01`).set({
      lessonId: '01',
      published: true,
      publishedAt: Date.now(),
    }),
  )
  pass('① 클래스 만들기', '강사가 클래스와 1강 공개 상태를 쓴다')
}

/* ── ② 강사 화면의 목록이 그것을 읽는다 ── */
{
  const snap = await assertSucceeds(asTeacher.collection('classes').get())
  if (snap.size !== 1) fail('② 강사 목록', `클래스가 ${snap.size}개로 읽힌다 (1개여야 한다)`)
  else pass('② 강사 목록', '만든 클래스가 강사 목록 조회에 잡힌다')
}

/* ── ③ 학생이 등록 전에도 클래스 목록을 본다 ── */
{
  // 등록할 클래스를 고르려면 등록 전에 목록이 보여야 한다.
  const snap = await assertSucceeds(asStudent.collection('classes').get())
  if (snap.size !== 1) {
    fail('③ 학생 목록', `학생에게 클래스가 ${snap.size}개로 읽힌다 — 고를 것이 없으면 등록을 못 한다`)
  } else {
    const c = snap.docs[0].data()
    if (c.status !== 'active' || c.enrollmentOpen !== true) {
      fail('③ 학생 목록', '읽히기는 하는데 모집 조건에 걸려 화면 목록에서 빠진다')
    } else {
      pass('③ 학생 목록', '등록 전 학생도 모집 중인 클래스를 본다')
    }
  }
}

/* ── ④ 학생이 스스로 등록한다 ── */
{
  await assertSucceeds(
    asStudent.doc(`classes/${CID}/enrollments/${STUDENT}`).set({
      uid: STUDENT,
      studentId: '2024123456',
      nickname: '',
      groupId: null,
      joinedAt: Date.now(),
      lastSeenAt: 0,
      status: 'active',
    }),
  )
  pass('④ 수강 등록', '학생이 스스로 등록한다')
}

/* ── ⑤ 등록한 뒤 차시 내용이 열린다 ── */
{
  await assertSucceeds(asStudent.doc(`classes/${CID}/lessonState/01`).get())
  await assertSucceeds(asStudent.doc(`classes/${CID}/lessons/01/steps/step-recall`).get())
  pass('⑤ 차시 열람', '등록한 학생이 공개된 차시를 읽는다')
}

/* ── ⑥ 자동 저장 → 제출 ── */
{
  const ref = asStudent.doc(`classes/${CID}/lessons/01/steps/step-recall/responses/${STUDENT}`)
  await assertSucceeds(ref.set({ uid: STUDENT, draft: { payload: { scene: '초안' }, savedAt: 1 } }))
  await assertSucceeds(
    ref.set({
      uid: STUDENT,
      versions: [{ v: 1, payload: { scene: '제출' }, confidence: 3, createdAt: Date.now(), changedReason: null }],
      latestV: 1,
      submittedAt: Date.now(),
      draft: null,
    }),
  )
  pass('⑥ 초안 → 제출', '입력 중 자동 저장이 되고, 그 문서에 첫 제출이 들어간다')
}

/* ── ⑦ 강사가 제출을 읽는다 (제출 현황·분포) ── */
{
  const snap = await assertSucceeds(
    asTeacher.collection(`classes/${CID}/lessons/01/steps/step-recall/responses`).get(),
  )
  if (snap.size !== 1) fail('⑦ 제출 현황', `강사에게 응답이 ${snap.size}건으로 읽힌다`)
  else pass('⑦ 제출 현황', '강사가 학생 응답을 읽어 제출 현황과 분포를 만든다')
}

/* ── ⑧ 의견 광장 — 제출한 뒤에만 열린다 ── */
{
  await assertSucceeds(asStudent.collection(`classes/${CID}/lessons/01/steps/step-recall/posts`).get())
  await assertSucceeds(
    asStudent.doc(`classes/${CID}/lessons/01/steps/step-recall/posts/p1`).set({
      uid: STUDENT,
      nickname: '학생',
      groupId: null,
      versions: [{ v: 1, content: '내 생각', changedReason: null, createdAt: Date.now() }],
      latestV: 1,
      reactions: {},
      comments: [],
      isPinned: false,
      isHidden: false,
      hiddenReason: null,
      createdAt: Date.now(),
    }),
  )
  pass('⑧ 의견 광장', '제출한 학생이 광장을 읽고 글을 올린다')
}

/* ── ⑨ 강사가 진행 상태와 판을 바꾼다 ── */
{
  await assertSucceeds(
    asTeacher.doc(`classes/${CID}/sessions/01`).set({
      lessonId: '01',
      currentStepId: 'step-recall',
      stepOpen: true,
      timerEndsAt: null,
      pollResults: {},
      ladders: {},
      pinnedPostRef: null,
      instructorAt: 'step-recall',
      updatedAt: Date.now(),
    }),
  )
  await assertSucceeds(asStudent.doc(`classes/${CID}/sessions/01`).get())
  await assertSucceeds(
    asTeacher
      .doc(`classes/${CID}/lessonState/01`)
      .set({ lessonId: '01', tierOverrides: { 'step:step-wrapup': 'core' } }, { merge: true }),
  )
  pass('⑨ 진행 제어', '강사가 진행 상태와 핵심/심화 판단을 쓰고, 학생이 그것을 읽는다')
}

/* ── ⑩ 남의 학기는 여전히 막혀 있다 ── */
{
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc('classes/c-other').set({
      id: 'c-other',
      ownerUid: TEACHER,
      status: 'active',
      enrollmentOpen: true,
      requireJoinCode: false,
      displayName: '다른 학기',
    })
    await ctx.firestore().doc('classes/c-other/lessonState/01').set({ lessonId: '01', published: true })
    await ctx
      .firestore()
      .doc('classes/c-other/lessons/01/steps/step-recall/responses/other')
      .set({ uid: 'other', versions: [], latestV: 0 })
  })
  await assertFails(
    asStudent.doc('classes/c-other/lessons/01/steps/step-recall/responses/other').get(),
  )
  await assertFails(asStudent.doc(`classes/${CID}/roster/${STUDENT}`).get())
  pass('⑩ 경계', '등록하지 않은 학기의 자료와 실명 명단은 여전히 막힌다')
}

await env.cleanup()
report('test:flow')

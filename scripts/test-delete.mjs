/**
 * npm run test:delete
 *
 * 클래스를 지우면 하위 자료까지 정말로 사라지는가.
 *
 * Firestore 는 문서를 지워도 하위 컬렉션이 남는다.
 * 화면에서는 사라졌는데 학생 응답·의견·실명이 데이터베이스에 그대로 있는 상태 —
 * 그것이 가장 위험하다. 지웠다고 믿게 되기 때문이다.
 *
 * 이 검사는 실제 repo 코드(createFirestoreRepo)를 그대로 불러 돌린다.
 * 검사용으로 다시 쓴 코드가 아니라 앱이 쓰는 그 코드여야 의미가 있다.
 *
 * 실행:
 *   npm run emulators      (다른 터미널에서 먼저)
 *   npm run test:delete
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report } from './_report.mjs'

const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'

try {
  const res = await fetch(`http://${HOST}/`)
  if (!res.ok && res.status !== 200 && res.status !== 404) throw new Error(String(res.status))
} catch {
  console.error(`\nFirestore 에뮬레이터(${HOST})에 닿지 못했습니다.\n  다른 터미널에서:  npm run emulators\n`)
  process.exit(1)
}

const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing')
const { createFirestoreRepo } = await import('../src/lib/repo-firestore.ts')

const env = await initializeTestEnvironment({
  projectId: 'sls-delete-test',
  firestore: {
    rules: await readFile('firestore.rules', 'utf8'),
    host: HOST.split(':')[0],
    port: Number(HOST.split(':')[1]),
  },
})

const CID = 'c-doomed'
const TEACHER = 'teacher-1'
const STUDENT = 'student-1'

/* 규칙을 우회해 학생 자료가 들어찬 클래스를 만든다. */
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  await db.doc(`instructors/${TEACHER}`).set({ role: 'instructor' })
  await db.doc(`classes/${CID}`).set({
    id: CID,
    ownerUid: TEACHER,
    status: 'active',
    enrollmentOpen: true,
    requireJoinCode: false,
    displayName: '지울 클래스',
  })
  await db.doc(`classes/${CID}/lessonState/01`).set({ lessonId: '01', published: true })
  await db.doc(`classes/${CID}/enrollments/${STUDENT}`).set({ uid: STUDENT, status: 'active' })
  await db.doc(`classes/${CID}/roster/${STUDENT}`).set({ uid: STUDENT, rosterName: '홍길동' })
  await db.doc(`classes/${CID}/participation/${STUDENT}`).set({ uid: STUDENT, presentCount: 2 })
  await db.doc(`classes/${CID}/sessions/01`).set({ lessonId: '01', stepOpen: true })
  await db
    .doc(`classes/${CID}/lessons/01/steps/step-recall/responses/${STUDENT}`)
    .set({ uid: STUDENT, versions: [{ v: 1, payload: { scene: '내 답' } }], latestV: 1 })
  await db
    .doc(`classes/${CID}/lessons/01/steps/step-recall/posts/p1`)
    .set({ uid: STUDENT, versions: [{ v: 1, content: '내 글' }], latestV: 1 })
})

/* 앱이 쓰는 그 코드로 지운다. */
const repo = createFirestoreRepo(env.authenticatedContext(TEACHER).firestore())

/* 얼마나 걸리는지 잰다. 190군데를 훑으므로 방식에 따라 몇 분이 되기도 한다. */
const t0 = Date.now()
await repo.deleteClass(CID)
const ms = Date.now() - t0
console.log(`  걸린 시간: ${ms}ms (에뮬레이터 기준)`)
if (ms > 20000) fail('지우기 속도', `${ms}ms 걸렸다 — 화면에서 끝나지 않는 것처럼 보인다`)

/* 규칙을 우회해 정말 사라졌는지 본다 — 규칙에 가려 안 보이는 것과 없는 것은 다르다. */
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()

  const gone = async (label, path) => {
    const snap = await db.doc(path).get()
    if (snap.exists) fail('남은 자료', `${label} 이 그대로 남아 있다 — ${path}`)
    return !snap.exists
  }

  const checks = await Promise.all([
    gone('클래스 문서', `classes/${CID}`),
    gone('차시 공개 상태', `classes/${CID}/lessonState/01`),
    gone('수강 등록', `classes/${CID}/enrollments/${STUDENT}`),
    gone('실명 명단', `classes/${CID}/roster/${STUDENT}`),
    gone('참여 기록', `classes/${CID}/participation/${STUDENT}`),
    gone('진행 상태', `classes/${CID}/sessions/01`),
    gone('학생 응답', `classes/${CID}/lessons/01/steps/step-recall/responses/${STUDENT}`),
    gone('의견 광장 글', `classes/${CID}/lessons/01/steps/step-recall/posts/p1`),
  ])

  if (checks.every(Boolean)) {
    pass('클래스 지우기', '클래스 문서와 하위 자료 8종이 전부 사라졌다 — 실명·응답·의견 포함')
  }
})

await env.cleanup()
report('test:delete')

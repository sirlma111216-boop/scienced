/**
 * npm run test:microteaching  (선행: npm run emulators)
 *
 * 마이크로티칭 신청의 서버 쪽 계산(`functions/api/_lib/microteaching.ts`)을 **그 코드 그대로** 에뮬레이터에 대고 부른다.
 * 토큰 확인(verifyIdToken)만 바깥 함수에 있으므로 여기서는 그 안쪽을 부른다 — apply.ts · cancel.ts 는 토큰을 풀어 uid 를 넘길 뿐이다.
 *
 *   · 여는 때 전에는 막힌다 · 수강생이 아니면 막힌다 · 일정에 없는 자리는 막힌다
 *   · 신청하면 mtSlots 에 학번 · 실명(명단) · 닉네임이 적히고 mtApplications 가 가리킨다
 *   · 같은 자리에 두 번째 사람은 막힌다 · 자리를 옮기면 옛 자리가 없어진다 · 취소하면 둘 다 없어진다
 *   · 강사가 남의 것을 취소할 수 있다 · 왕복 시간
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report } from './_report.mjs'

const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
try {
  await fetch(`http://${HOST}/`)
} catch {
  console.error(`\nFirestore 에뮬레이터(${HOST})에 닿지 못했습니다.\n  다른 터미널에서:  npm run emulators\n`)
  process.exit(1)
}

const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing')
const { applyMicroteaching, cancelMicroteaching } = await import('../functions/api/_lib/microteaching.ts')

const projectId = 'sls-mt-' + Date.now()
const env = await initializeTestEnvironment({
  projectId,
  firestore: { rules: await readFile('firestore.rules', 'utf8'), host: HOST.split(':')[0], port: Number(HOST.split(':')[1]) },
})
const fnEnv = { FIREBASE_PROJECT_ID: projectId, FIRESTORE_EMULATOR_HOST: HOST }

const CID = 'c-mt'
const S1 = 'stu-1'
const S2 = 'stu-2'
const OPEN = 1_000_000
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  await db.doc(`instructors/teacher-1`).set({ role: 'instructor' })
  await db.doc(`classes/${CID}`).set({ id: CID, ownerUid: 'teacher-1', status: 'active', courseId: 'edu', courseTitle: '과학교육론', microteachingOpenAt: OPEN })
  await db.doc(`classes/${CID}/enrollments/${S1}`).set({ uid: S1, status: 'active', nickname: '민준', studentId: '2026001' })
  await db.doc(`classes/${CID}/enrollments/${S2}`).set({ uid: S2, status: 'active', nickname: '서연', studentId: '2026002' })
  await db.doc(`classes/${CID}/enrollments/stu-ended`).set({ uid: 'stu-ended', status: 'ended', nickname: '나간사람', studentId: '2026009' })
  await db.doc(`classes/${CID}/roster/${S1}`).set({ uid: S1, rosterName: '김민준', memo: '' })
})

const readAll = async () =>
  env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const slots = (await db.collection(`classes/${CID}/mtSlots`).get()).docs.map((d) => d.data())
    const apps = Object.fromEntries((await db.collection(`classes/${CID}/mtApplications`).get()).docs.map((d) => [d.id, d.data()]))
    return { slots, apps }
  })

const SLOT = '2026-11-02_1'

/* 여는 때 전 */
{
  const r = await applyMicroteaching(fnEnv, { classId: CID, uid: S1, slotId: SLOT, now: OPEN - 1 })
  if (!r.ok && /아직 신청 기간/.test(r.message ?? '')) pass('여는 때', '때가 되기 전에는 막힌다')
  else fail('여는 때', `때 전인데 통과했다 — ${JSON.stringify(r)}`)
}
/* 수강생 아님 · 없는 자리 */
{
  const a = await applyMicroteaching(fnEnv, { classId: CID, uid: 'stu-ended', slotId: SLOT, now: OPEN })
  const b = await applyMicroteaching(fnEnv, { classId: CID, uid: 'nobody', slotId: SLOT, now: OPEN })
  const c = await applyMicroteaching(fnEnv, { classId: CID, uid: S1, slotId: '2026-10-27_1', now: OPEN })
  if (!a.ok && !b.ok && !c.ok && /없는 자리/.test(c.message ?? '')) pass('자격', '수강 종료자 · 미등록자 · 다른 과목의 자리는 막힌다')
  else fail('자격', `${JSON.stringify([a, b, c])}`)
}
/* 신청 — 실명이 옮겨 적힌다 */
{
  const t0 = Date.now()
  const r = await applyMicroteaching(fnEnv, { classId: CID, uid: S1, slotId: SLOT, now: OPEN })
  const took = Date.now() - t0
  const { slots, apps } = await readAll()
  const s = slots.find((x) => x.slotId === SLOT)
  if (r.ok && s && s.uid === S1 && s.name === '김민준' && s.studentId === '2026001' && s.nickname === '민준' && s.date === '2026-11-02' && s.order === 1 && apps[S1]?.slotId === SLOT) pass('신청', `자리에 학번 · 실명 · 닉네임이 적히고 가리킴이 생겼다 · ${took}ms`)
  else fail('신청', `${JSON.stringify({ r, s, app: apps[S1] })}`)
  if (took > 3000) fail('신청 시간', `${took}ms — 3초를 넘는다`)
}
/* 같은 자리에 두 번째 사람 */
{
  const r = await applyMicroteaching(fnEnv, { classId: CID, uid: S2, slotId: SLOT, now: OPEN })
  const { slots } = await readAll()
  if (!r.ok && /다른 사람이 그 자리/.test(r.message ?? '') && slots.filter((x) => x.slotId === SLOT).length === 1 && slots.find((x) => x.slotId === SLOT).uid === S1) pass('자리 다툼', '먼저 든 사람이 남고 둘째는 막힌다')
  else fail('자리 다툼', `${JSON.stringify(r)} · ${slots.length}자리`)
}
/* 옮기기 — 옛 자리가 없어진다 */
{
  const r = await applyMicroteaching(fnEnv, { classId: CID, uid: S1, slotId: '2026-11-09_2', now: OPEN })
  const { slots, apps } = await readAll()
  if (r.ok && slots.length === 1 && slots[0].slotId === '2026-11-09_2' && apps[S1]?.slotId === '2026-11-09_2') pass('옮기기', '새 자리가 생기고 옛 자리는 같은 commit 에서 없어진다 — 한 사람이 한 자리')
  else fail('옮기기', `${JSON.stringify({ r, slots, apps })}`)
}
/* 명단에 실명이 없으면 닉네임 */
{
  const r = await applyMicroteaching(fnEnv, { classId: CID, uid: S2, slotId: SLOT, now: OPEN })
  const { slots } = await readAll()
  const s = slots.find((x) => x.uid === S2)
  if (r.ok && s?.name === '서연') pass('이름', '명단에 실명이 없으면 닉네임이 적힌다')
  else fail('이름', `${JSON.stringify({ r, s })}`)
}
/* 본인 취소 · 강사 취소 */
{
  const a = await cancelMicroteaching(fnEnv, { classId: CID, uid: S2, byInstructor: false })
  const b = await cancelMicroteaching(fnEnv, { classId: CID, uid: S1, byInstructor: true })
  const c = await cancelMicroteaching(fnEnv, { classId: CID, uid: S1, byInstructor: false })
  const { slots, apps } = await readAll()
  if (a.ok && b.ok && c.ok && slots.length === 0 && Object.keys(apps).length === 0) pass('취소', '본인 취소 · 강사 취소 뒤 자리와 가리킴이 모두 없다. 없는 것을 또 취소해도 조용히 ok')
  else fail('취소', `${JSON.stringify({ a, b, c, slots, apps })}`)
}
/* 규칙 — 학생은 자리 문서를 직접 쓰지 못하고, 같은 클래스 사람은 읽는다 */
{
  const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing')
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`classes/${CID}/mtSlots/${SLOT}`).set({ slotId: SLOT, uid: S1, name: '김민준', studentId: '2026001', nickname: '민준', date: '2026-11-02', order: 1, at: 1 })
  })
  const s2 = env.authenticatedContext(S2).firestore()
  let ok = true
  try {
    await assertSucceeds(s2.collection(`classes/${CID}/mtSlots`).get())
    await assertFails(s2.doc(`classes/${CID}/mtSlots/2026-11-02_2`).set({ slotId: '2026-11-02_2', uid: S2 }))
    await assertFails(s2.doc(`classes/${CID}/mtSlots/${SLOT}`).delete())
    await assertFails(s2.doc(`classes/${CID}/mtApplications/${S1}`).get())
    await assertSucceeds(env.authenticatedContext('teacher-1').firestore().doc(`classes/${CID}/mtSlots/${SLOT}`).delete())
  } catch (err) {
    ok = false
    fail('규칙', `${err instanceof Error ? err.message : String(err)}`)
  }
  if (ok) pass('규칙', '학생은 자리 목록을 읽지만 쓰지 못하고 남의 가리킴을 못 읽는다. 강사는 지울 수 있다')
}

await env.cleanup()
report('test:microteaching')

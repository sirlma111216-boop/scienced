/** 실제 서버 이동 함수를 Firestore 에뮬레이터에 연결해 데이터 보존과 권한을 검사한다. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { moveMicroteaching } from '../functions/api/_lib/microteaching.ts'

const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
const projectId = `sls-mt-move-${Date.now()}`
console.log('Firestore 이동 검증: 에뮬레이터 연결')
const test = await initializeTestEnvironment({ projectId, firestore: { host: host.split(':')[0], port: Number(host.split(':')[1]), rules: await readFile('firestore.rules', 'utf8') } })
console.log('Firestore 이동 검증: 테스트 자료 준비')
const env = { FIREBASE_PROJECT_ID: projectId, FIRESTORE_EMULATOR_HOST: host }
const cid = 'method-class'
const originalSlots = [
  { uid: 'student-a', studentId: 'test-a', name: '학생 가', slotId: '2026-10-27_1', date: '2026-10-27', order: 1, topic: '식물의 호흡', at: 10, detailAt: 11 },
  { uid: 'student-b', studentId: 'test-b', name: '학생 나', slotId: '2026-10-27_2', date: '2026-10-27', order: 2, topic: '지권의 변화', at: 12 },
  ...['2026-11-03_1', '2026-11-03_2', '2026-11-10_1', '2026-11-10_2', '2026-11-17_1', '2026-11-17_2', '2026-11-24_1', '2026-11-24_2', '2026-11-24_3', '2026-12-01_1', '2026-12-01_2', '2026-12-01_3'].map((slotId, i) => ({ uid: `other-${i}`, slotId, date: slotId.split('_')[0], order: Number(slotId.split('_')[1]), at: 20 + i })),
]
const extra = { plan: { key: 'preserved-plan', name: '수업계획안.pdf' }, video: { key: 'preserved-video' }, reflection: '성찰', planFeedback: '계획안 피드백', videoFeedback: '영상 피드백', customField: 'future metadata' }
const read = async () => {
  let result
  await test.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const records = async (name) => Object.fromEntries((await db.collection(`classes/${cid}/${name}`).get()).docs.map((d) => [d.id, d.data()]))
    result = { slots: await records('mtSlots'), apps: await records('mtApplications'), peer: await records('mtPeer') }
  })
  return result
}
const move = (uid, fromSlotId, slotId, actorUid = 'teacher') => moveMicroteaching(env, { classId: cid, uid, fromSlotId, slotId, actorUid })
try {
  await test.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await db.doc('instructors/teacher').set({ role: 'instructor' })
    await db.doc(`classes/${cid}`).set({ status: 'active', courseId: 'method', microteachingOpenAt: null })
    for (const s of originalSlots) {
      await db.doc(`classes/${cid}/mtSlots/${s.slotId}`).set(s)
      await db.doc(`classes/${cid}/mtApplications/${s.uid}`).set({ ...s, ...extra })
    }
    await db.doc(`classes/${cid}/mtPeer/student-a__other-1`).set({ presenterUid: 'student-a', good: '의견 보존' })
  })
  const before = await read()
  for (const args of [
    ['student-a', '2026-10-27_1', '2026-11-10_3', 'student-b'],
    ['student-a', '2026-10-27_1', '2026-10-27_2'],
    ['student-a', '2026-10-27_1', '2026-11-17_3'],
    ['student-a', '2026-10-27_1', '2026-11-03_1'],
    ['student-a', '2026-10-27_2', '2026-11-10_3'],
  ]) {
    assert.equal((await move(...args)).ok, false, `이동 차단: ${args}`)
    assert.deepEqual(await read(), before, '실패하면 원래 기록 전체가 보존되어야 한다')
  }
  assert.equal((await move('student-a', '2026-10-27_1', '2026-11-10_3')).ok, true)
  assert.equal((await move('student-b', '2026-10-27_2', '2026-11-03_3')).ok, true)
  const after = await read()
  assert.equal(Object.keys(after.slots).length, 14)
  assert.equal(after.slots['2026-10-27_1'], undefined)
  assert.equal(after.slots['2026-10-27_2'], undefined)
  for (const [i, dest] of [[0, '2026-11-10_3'], [1, '2026-11-03_3']]) {
    const s = originalSlots[i]
    assert.deepEqual(after.slots[dest], { ...s, slotId: dest, date: dest.split('_')[0], order: 3 })
    assert.deepEqual(after.apps[s.uid], { ...before.apps[s.uid], slotId: dest })
  }
  for (const s of originalSlots.slice(2)) {
    assert.deepEqual(after.slots[s.slotId], before.slots[s.slotId])
    assert.deepEqual(after.apps[s.uid], before.apps[s.uid])
  }
  assert.deepEqual(after.peer, before.peer)
  assert.equal((await move('student-a', '2026-10-27_1', '2026-11-10_3')).ok, false)
  assert.deepEqual(await read(), after, '중복 요청은 다시 바꾸지 않는다')
  // 같은 학생을 동시에 다른 빈자리로 옮겨도 원본 버전 검사가 한 번만 허용한다.
  await test.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await db.doc(`classes/${cid}/mtSlots/2026-11-24_3`).delete()
    await db.doc(`classes/${cid}/mtSlots/2026-12-01_3`).delete()
  })
  const race = await Promise.all([
    move('student-a', '2026-11-10_3', '2026-11-24_3'),
    move('student-a', '2026-11-10_3', '2026-12-01_3'),
  ])
  assert.equal(race.filter((r) => r.ok).length, 1)
  assert.equal(Object.values((await read()).slots).filter((s) => s.uid === 'student-a').length, 1)
  console.log('PASS: 강사 권한, 폐지 날짜, 두 학생 이동, 12명 원본 보존, 주제·첨부·피드백·동료 의견 보존, 충돌·중복·동시 요청')
} finally {
  await test.cleanup()
}

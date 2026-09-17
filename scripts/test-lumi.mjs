/**
 * npm run test:lumi
 *
 * 루미 런 결과 webhook(`functions/api/lumi/result.ts`)을 **그 함수 그대로** 에뮬레이터에 대고 부른다.
 *
 * 게임 서버가 보내는 봉투(gamerun/scripts/lesson-check.ts 가 실제 수신을 확인한 그 모양)를 서명해서 넣고,
 *   · 발표자가 세션(lumi.result · ladders[gameId].winnerUids) · lumiResults · picks · participation 에 적히는가
 *   · 같은 경기가 두 번 와도 한 번만 세는가 (발표 횟수가 두 번 오르지 않는가)
 *   · 서명이 틀리거나 지난 활동이면 발표자를 바꾸지 않는가
 * 를 본다. 화면은 세션 구독으로 이 값을 읽는다 — 그 다음은 test:writes 의 영역이다.
 */
import { createHmac } from 'node:crypto'
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
/* 앱이 배포하는 그 함수. 검사용으로 다시 쓴 코드가 아니다. */
const { onRequestPost } = await import('../functions/api/lumi/result.ts')
const { signLumiTicket, verifyLumiSignature } = await import('../functions/api/_lib/lumi.ts')

const projectId = 'sls-lumi-' + Date.now()
const env = await initializeTestEnvironment({
  projectId,
  firestore: { rules: await readFile('firestore.rules', 'utf8'), host: HOST.split(':')[0], port: Number(HOST.split(':')[1]) },
})

const SECRET = 'test-secret'
const CID = 'c-lumi'
const LID = '03'
const ACT = `${CID}:${LID}:run1`
const GAME = '03-activity-lumi'
const S1 = 'stu-1'
const S2 = 'stu-2'
const S3 = 'stu-3'

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  await db.doc(`instructors/teacher-1`).set({ role: 'instructor' })
  await db.doc(`classes/${CID}`).set({ id: CID, ownerUid: 'teacher-1', status: 'active' })
  for (const [uid, nickname] of [[S1, '민준'], [S2, '서연'], [S3, '도윤']]) {
    await db.doc(`classes/${CID}/enrollments/${uid}`).set({ uid, status: 'active', nickname })
  }
  await db.doc(`classes/${CID}/participation/${S1}`).set({ uid: S1, presentCount: 2 })
  /* 강사가 「게임 방 만들기」를 눌렀을 때 화면이 적는 그대로 */
  await db.doc(`classes/${CID}/sessions/${LID}`).set({
    lessonId: LID,
    revealed: {},
    ladders: {},
    lumi: { activityInstanceId: ACT, gameId: GAME, stepId: 'step-formative', roomCode: '714347', status: 'open', requestedCount: 2, round: 1, createdBy: 'teacher-1', createdAt: Date.now() },
    updatedAt: Date.now(),
  })
})

function envelope(matchId, act = ACT, selectedIds = [S1, S2], endReason = 'normal') {
  const players = [
    { id: S1, name: '민준', status: 'finished', rank: 1, finishTime: 12.3, progress: 1, connected: true, bot: false },
    { id: S2, name: '서연', status: 'finished', rank: 2, finishTime: 13.1, progress: 1, connected: true, bot: false },
    { id: S3, name: '도윤', status: 'running', rank: null, finishTime: null, progress: 0.6, connected: true, bot: false },
  ]
  return {
    type: 'lumi.result',
    sentAt: new Date().toISOString(),
    room: { code: '714347', activityId: act, cid: CID, lid: LID },
    result: {
      gameVersion: '2.0.0', moduleVersion: '1.0.0', resultVersion: '1',
      matchId, activityId: act, map: 1,
      rules: { mode: 'ranks', duration: 30, lives: 0, count: 2, text: '이번 발표자', ranks: [6, 9], timeLimit: 60 },
      players, selectedIds, selectionReason: '6등·9등 발표 — 6등 민준 / 9등 완주자 없음 → 미완주자 중 무작위 서연', tieHandling: '같은 도착 틱은 공동 선정 · 그 등수까지 완주가 안 됐으면 접속 중인 미완주자 중 무작위', endReason, endedAt: new Date().toISOString(),
    },
  }
}
const sign = (body, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
async function call(bodyObj, { secret = SECRET, sig } = {}) {
  const body = JSON.stringify(bodyObj)
  const request = new Request('http://local/api/lumi/result', { method: 'POST', headers: { 'content-type': 'application/json', 'x-lumi-signature': sig ?? sign(body, secret) }, body })
  const res = await onRequestPost({ request, env: { LUMI_SHARED_SECRET: SECRET, FIREBASE_PROJECT_ID: projectId, FIRESTORE_EMULATOR_HOST: HOST }, params: {}, data: {}, waitUntil() {}, passThroughOnException() {}, next: async () => new Response(null) })
  return { status: res.status, body: await res.json() }
}
async function read(path) {
  let out = null
  await env.withSecurityRulesDisabled(async (ctx) => {
    const snap = await ctx.firestore().doc(path).get()
    out = snap.exists ? snap.data() : null
  })
  return out
}

/* 0 서명 함수가 게임 서버와 같은 형식인가 (HMAC-SHA256 hex · 티켓 base64url.sig) */
{
  const body = '{"a":1}'
  const okSig = await verifyLumiSignature(body, sign(body), SECRET)
  const badSig = await verifyLumiSignature(body, sign(body, 'other'), SECRET)
  const ticket = await signLumiTicket({ cid: CID, lid: LID, act: ACT, sub: S1, name: '민준', role: 'student', iat: 1, exp: 2 }, SECRET)
  const [payload, sig] = ticket.split('.')
  const expectSig = createHmac('sha256', SECRET).update(payload).digest('base64url')
  if (okSig && !badSig && sig === expectSig && JSON.parse(Buffer.from(payload, 'base64url').toString()).aud === 'lumi-run') pass('서명 형식', 'webhook 서명과 티켓 서명이 게임 서버(node crypto)와 같은 값이다')
  else fail('서명 형식', `webhook ${okSig}/${badSig} · 티켓 ${sig === expectSig}`)
}

/* 1 정상 결과 → 세션·lumiResults·picks·participation */
{
  const t0 = Date.now()
  const r = await call(envelope('m-1'))
  const took = Date.now() - t0
  if (r.status === 200 && r.body.ok && r.body.winners === 2 && (r.body.warnings ?? []).length === 0) pass('결과 저장', `ok · 발표자 2명 · ${took}ms`)
  else fail('결과 저장', JSON.stringify(r))
  if (took > 3000) fail('결과 저장 시간', `${took}ms — 3초를 넘는다`)
  const sess = await read(`classes/${CID}/sessions/${LID}`)
  const lumi = sess?.lumi ?? {}
  if (lumi.status === 'ended' && lumi.result?.matchId === 'm-1' && JSON.stringify(lumi.result.selectedIds) === JSON.stringify([S1, S2]) && lumi.result.selectedNames?.[S1] === '민준' && lumi.activityInstanceId === ACT && lumi.roomCode === '714347' && /6등·9등/.test(lumi.result.selectionReason))
    pass('세션 lumi.result', '발표자·이름·경기 id·등수 이유가 적히고 활동·방 코드는 그대로다')
  else fail('세션 lumi.result', JSON.stringify(lumi))
  const ladder = sess?.ladders?.[GAME]
  if (ladder?.phase === 'done' && JSON.stringify(ladder.winnerUids) === JSON.stringify([S1, S2]) && ladder.gameId === GAME) pass('세션 ladders', '기존 발표자 구조(winnerUids)에도 같은 발표자가 있다')
  else fail('세션 ladders', JSON.stringify(ladder))
  const res = await read(`classes/${CID}/lumiResults/${ACT}__m-1`)
  if (res && res.selectedCount === 2 && res.requestedCount === 2 && res.players?.length === 3 && res.roomCode === '714347' && JSON.stringify(res.rules?.ranks) === '[6,9]' && res.rules?.timeLimit === 60) pass('lumiResults', '전체 결과 문서(참가자 3 · 선정 2 · 등수 6·9 · 제한 60초)')
  else fail('lumiResults', JSON.stringify(res))
  const pick = await read(`classes/${CID}/picks/${GAME}-lumi-m-1`)
  if (pick && pick.runBy === 'lumi-run' && JSON.stringify(pick.winnerUids) === JSON.stringify([S1, S2]) && pick.candidateUids?.length === 3) pass('picks', '뽑기 기록이 남는다')
  else fail('picks', JSON.stringify(pick))
  const p1 = await read(`classes/${CID}/participation/${S1}`)
  const p2 = await read(`classes/${CID}/participation/${S2}`)
  const p3 = await read(`classes/${CID}/participation/${S3}`)
  if (p1?.presentCount === 3 && p2?.presentCount === 1 && !p3) pass('발표 횟수', `민준 2→3 · 서연 0→1 · 도윤 그대로`)
  else fail('발표 횟수', JSON.stringify({ p1, p2, p3 }))
}

/* 2 같은 경기 재전송 → 한 번만 */
{
  const r = await call(envelope('m-1'))
  const p1 = await read(`classes/${CID}/participation/${S1}`)
  if (r.status === 200 && r.body.ok && r.body.duplicate === true && p1?.presentCount === 3) pass('멱등', '같은 경기가 다시 와도 duplicate · 발표 횟수 그대로')
  else fail('멱등', JSON.stringify({ r, p1 }))
}

/* 3 서명 불일치 → 200 ok:false (재시도 없이) · 아무것도 안 바뀜 */
{
  const r = await call(envelope('m-2', ACT, [S3]), { secret: 'wrong' })
  const sess = await read(`classes/${CID}/sessions/${LID}`)
  if (r.status === 200 && r.body.ok === false && sess?.lumi?.result?.matchId === 'm-1') pass('서명 불일치', `거절 (${r.body.message}) · 발표자 그대로`)
  else fail('서명 불일치', JSON.stringify(r))
}

/* 4 지난 활동의 결과 → 거절 */
{
  const r = await call(envelope('m-3', `${CID}:${LID}:old`, [S3]))
  const sess = await read(`classes/${CID}/sessions/${LID}`)
  if (r.status === 200 && r.body.ok === false && sess?.lumi?.result?.matchId === 'm-1') pass('지난 활동', `거절 (${r.body.message}) · 발표자 그대로`)
  else fail('지난 활동', JSON.stringify(r))
}

/* 5 재경기(새 경기 id) → 새 발표자 · 횟수 누적 · 교사 종료는 emergency */
{
  const r = await call(envelope('m-4', ACT, [S3], 'teacher'))
  const sess = await read(`classes/${CID}/sessions/${LID}`)
  const p3 = await read(`classes/${CID}/participation/${S3}`)
  if (r.body.ok && sess?.lumi?.result?.matchId === 'm-4' && JSON.stringify(sess.lumi.result.selectedIds) === JSON.stringify([S3]) && sess.ladders?.[GAME]?.emergency === true && p3?.presentCount === 1)
    pass('재경기', '새 경기 id 로 발표자가 바뀌고 도윤 0→1 · 교사 종료 표시')
  else fail('재경기', JSON.stringify({ r, lumi: sess?.lumi, ladder: sess?.ladders?.[GAME], p3 }))
}

/* 6 선정 없음(완주 부족) → 빈 결과를 그대로 적고 발표 횟수는 아무도 안 오른다 */
{
  const before = await read(`classes/${CID}/participation/${S1}`)
  const r = await call(envelope('m-5', ACT, [], 'timeout'))
  const sess = await read(`classes/${CID}/sessions/${LID}`)
  const after = await read(`classes/${CID}/participation/${S1}`)
  if (r.body.ok && r.body.winners === 0 && sess?.lumi?.result?.selectedCount === 0 && before?.presentCount === after?.presentCount) pass('선정 없음', '빈 결과는 빈 대로 적고 임의로 채우지 않는다')
  else fail('선정 없음', JSON.stringify({ r, result: sess?.lumi?.result }))
}

/* 7 규칙 — 학생은 lumiResults 를 못 읽고, 강사는 읽고 지운다 */
{
  const student = env.authenticatedContext(S1).firestore()
  const teacher = env.authenticatedContext('teacher-1').firestore()
  let studentRead = 'ok'
  try {
    await student.doc(`classes/${CID}/lumiResults/${ACT}__m-1`).get()
  } catch (e) {
    studentRead = e.code ?? 'denied'
  }
  let teacherRead = false
  try {
    teacherRead = (await teacher.doc(`classes/${CID}/lumiResults/${ACT}__m-1`).get()).exists
  } catch {
    teacherRead = false
  }
  let teacherDelete = 'ok'
  try {
    await teacher.doc(`classes/${CID}/lumiResults/${ACT}__m-5`).delete()
  } catch (e) {
    teacherDelete = e.code ?? 'denied'
  }
  if (studentRead !== 'ok' && teacherRead && teacherDelete === 'ok') pass('규칙 lumiResults', '학생 읽기 거부 · 강사 읽기·지우기 허용')
  else fail('규칙 lumiResults', JSON.stringify({ studentRead, teacherRead, teacherDelete }))
}

await env.cleanup()
report('test:lumi')

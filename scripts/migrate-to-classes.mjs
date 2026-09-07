/**
 * courses/* → lessons/* + classes/* 마이그레이션 (2차 지시서 A.7)
 *
 * ★ 기본값은 검증만 하는 모드다. 실제 이동은 --apply 를 붙여야 한다.
 *
 *   node scripts/migrate-to-classes.mjs                 무엇이 있는지 세기만 한다
 *   node scripts/migrate-to-classes.mjs --apply         실제로 옮긴다
 *
 * 첫째 할 일은 A.7 의 갈림길에 답하는 것이다:
 *   "지금 데이터베이스에 실제 학생 응답이 있는가?"
 * 없으면 옮길 것이 없고, 새 구조로 그냥 쓰면 된다.
 *
 * 옮기더라도 courses/* 는 지우지 않는다. 확인이 끝난 뒤 손으로 지운다.
 */
import { readFile } from 'node:fs/promises'

const APPLY = process.argv.includes('--apply')
const COURSE_ID = process.env.COURSE_ID || 'khu-science-2026'

/* ── 인증: 서비스 계정 또는 gcloud ADC ── */
const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
const projectId = process.env.FIREBASE_PROJECT_ID || 'scienced-e721d'

if (!saPath) {
  console.error(
    '\n서비스 계정이 필요합니다.\n' +
      '  set GOOGLE_APPLICATION_CREDENTIALS=C:\\경로\\키.json\n' +
      '  node scripts/migrate-to-classes.mjs\n',
  )
  process.exit(1)
}

const sa = JSON.parse(await readFile(saPath, 'utf8'))

/* ── OAuth2 토큰 (shared/ai-core.ts 와 같은 방식) ── */
function b64url(buf) {
  return Buffer.from(buf).toString('base64url')
}

async function getToken() {
  const { createSign } = await import('node:crypto')
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  )
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claim}`)
  const sig = b64url(signer.sign(sa.private_key.replace(/\\n/g, '\n')))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${sig}`,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`토큰 실패: ${JSON.stringify(data)}`)
  return data.access_token
}

const token = await getToken()
const BASE = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init.headers },
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(`${res.status} ${path}: ${await res.text()}`)
  }
  return res.status === 404 ? null : res.json()
}

/** 컬렉션 안의 문서를 전부 읽는다 (페이지 넘김 포함). */
async function listDocs(path) {
  const out = []
  let pageToken = ''
  do {
    const q = pageToken ? `?pageToken=${pageToken}&pageSize=300` : '?pageSize=300'
    const data = await api(`/${path}${q}`)
    if (!data) break
    out.push(...(data.documents ?? []))
    pageToken = data.nextPageToken ?? ''
  } while (pageToken)
  return out
}

const id = (doc) => doc.name.split('/').pop()

/**
 * 2차 B.1 에서 이름을 바꾼 단계.
 *
 * 「퇴실표」는 하루짜리 연수의 말이라 「이번 수업 정리」로 바꿨고, 단계 id 도 따라갔다.
 * 옛 id 로 저장된 응답이 있으면 여기서 새 id 로 옮겨 붙인다.
 * 옮기지 않으면 학생이 쓴 답이 화면에 뜨지 않는다 — 지워지지는 않지만 아무도 못 본다.
 */
const RENAMED_STEPS = { 'step-exit': 'step-wrapup' }
const newStepId = (sid) => RENAMED_STEPS[sid] ?? sid

/* ─────────────────── 1. 무엇이 있는지 센다 ─────────────────── */

console.log(`\n프로젝트 ${projectId} · courses/${COURSE_ID}\n`)
console.log(APPLY ? '모드: 실제 이동 (--apply)\n' : '모드: 검증만 (실제로 옮기려면 --apply)\n')

const lessons = await listDocs(`courses/${COURSE_ID}/lessons`)
let responseCount = 0
let postCount = 0
const responseDocs = []
const postDocs = []

for (const lesson of lessons) {
  const lid = id(lesson)
  const steps = await listDocs(`courses/${COURSE_ID}/lessons/${lid}/steps`)
  for (const step of steps) {
    const sid = id(step)
    const responses = await listDocs(
      `courses/${COURSE_ID}/lessons/${lid}/steps/${sid}/responses`,
    )
    const posts = await listDocs(`courses/${COURSE_ID}/lessons/${lid}/steps/${sid}/posts`)
    responseCount += responses.length
    postCount += posts.length
    for (const r of responses) responseDocs.push({ lid, sid, uid: id(r), doc: r })
    for (const p of posts) postDocs.push({ lid, sid, pid: id(p), doc: p })
  }
}

const sessions = await listDocs(`courses/${COURSE_ID}/sessions`)
const groups = await listDocs(`courses/${COURSE_ID}/groups`)
const picks = await listDocs(`courses/${COURSE_ID}/picks`)
const participation = await listDocs(`courses/${COURSE_ID}/participation`)
const users = await listDocs('users')
const students = users.filter((u) => u.fields?.role?.stringValue === 'student')

console.log('─'.repeat(52))
console.log(`차시 문서        ${lessons.length}`)
console.log(`학생 응답        ${responseCount}   ← A.7 의 갈림길`)
console.log(`의견 광장 글     ${postCount}`)
console.log(`차시 진행 상태   ${sessions.length}`)
console.log(`모둠             ${groups.length}`)
console.log(`추첨 기록        ${picks.length}`)
console.log(`참여 기록        ${participation.length}`)
console.log(`학생 계정        ${students.length}`)
console.log('─'.repeat(52))

if (responseCount === 0 && postCount === 0) {
  console.log(
    '\n실제 학생 자료가 없습니다.\n' +
      '  → 마이그레이션이 필요 없습니다. 새 구조(classes/*)로 그냥 쓰시면 됩니다.\n' +
      '  → courses/* 아래에 남은 것이 있으면 콘솔에서 지워도 됩니다.\n',
  )
  process.exit(0)
}

const renamedHits = [...responseDocs, ...postDocs].filter((d) => RENAMED_STEPS[d.sid]).length

console.log(
  '\n실제 학생 자료가 있습니다.\n' +
    '  → 아래 계획대로 옮깁니다.\n' +
    (renamedHits > 0
      ? `  → 이름이 바뀐 단계에 ${renamedHits}건이 있습니다. 새 id 로 함께 옮깁니다.\n`
      : ''),
)

/* ─────────────────── 2. 옮길 계획 ─────────────────── */

const NEW_CLASS = process.env.TARGET_CLASS_ID || `c-migrated-${Date.now().toString(36)}`

const plan = [
  `lessons/*            ← courses/${COURSE_ID}/lessons/* (published 필드는 떼어 냄) · ${lessons.length}건`,
  `classes/${NEW_CLASS}  새로 만듦 (현재 학기)`,
  `  lessonState/*      ← 기존 published 값 · ${lessons.length}건`,
  `  …/responses/*      ← ${responseCount}건`,
  `  …/posts/*          ← ${postCount}건`,
  `  sessions/*         ← ${sessions.length}건`,
  `  groups/*           ← ${groups.length}건`,
  `  picks/*            ← ${picks.length}건`,
  `  participation/*    ← ${participation.length}건`,
  `  enrollments/*      ← users 의 학생 ${students.length}명 (rosterName 은 비워 둠)`,
]
console.log('계획:')
for (const line of plan) console.log('  ' + line)

if (!APPLY) {
  console.log('\n검증만 했습니다. 실제로 옮기려면:')
  console.log('  node scripts/migrate-to-classes.mjs --apply\n')
  process.exit(0)
}

/* ─────────────────── 3. 실제 이동 ─────────────────── */

console.log('\n옮기는 중…')

async function put(path, fields) {
  await api(`/${path}`, { method: 'PATCH', body: JSON.stringify({ fields }) })
}

// 3-1. 콘텐츠 마스터 — published 는 떼어 낸다
for (const lesson of lessons) {
  const lid = id(lesson)
  const fields = { ...lesson.fields }
  const published = fields.published?.booleanValue === true
  delete fields.published
  delete fields.publishedAt
  await put(`lessons/${lid}`, fields)

  const steps = await listDocs(`courses/${COURSE_ID}/lessons/${lid}/steps`)
  for (const step of steps) {
    await put(`lessons/${lid}/steps/${newStepId(id(step))}`, step.fields ?? {})
  }
  // 공개 여부는 클래스로 옮긴다
  await put(`classes/${NEW_CLASS}/lessonState/${lid}`, {
    lessonId: { stringValue: lid },
    published: { booleanValue: published },
    publishedAt: published ? { integerValue: String(Date.now()) } : { nullValue: null },
  })
}
console.log(`  ✓ 차시 ${lessons.length}건`)

// 3-2. 클래스 문서
await put(`classes/${NEW_CLASS}`, {
  id: { stringValue: NEW_CLASS },
  ownerUid: { stringValue: process.env.OWNER_UID || '' },
  affiliation: { stringValue: 'undergrad' },
  year: { integerValue: String(new Date().getFullYear()) },
  term: { stringValue: '1' },
  days: { arrayValue: { values: [] } },
  startTime: { stringValue: '13:00' },
  endTime: { stringValue: '15:45' },
  credits: { integerValue: '3' },
  displayName: { stringValue: '이전 학기에서 옮긴 클래스' },
  joinCode: { stringValue: 'MIGRAT' },
  requireJoinCode: { booleanValue: false },
  enrollmentOpen: { booleanValue: false },
  status: { stringValue: 'active' },
  createdAt: { integerValue: String(Date.now()) },
})

// 3-3. 응답과 의견
for (const r of responseDocs) {
  await put(
    `classes/${NEW_CLASS}/lessons/${r.lid}/steps/${newStepId(r.sid)}/responses/${r.uid}`,
    r.doc.fields ?? {},
  )
}
for (const p of postDocs) {
  await put(
    `classes/${NEW_CLASS}/lessons/${p.lid}/steps/${newStepId(p.sid)}/posts/${p.pid}`,
    p.doc.fields ?? {},
  )
}
console.log(`  ✓ 응답 ${responseDocs.length}건 · 의견 ${postDocs.length}건`)

// 3-4. 나머지
for (const [name, docs] of [
  ['sessions', sessions],
  ['groups', groups],
  ['picks', picks],
  ['participation', participation],
]) {
  for (const d of docs) await put(`classes/${NEW_CLASS}/${name}/${id(d)}`, d.fields ?? {})
  console.log(`  ✓ ${name} ${docs.length}건`)
}

// 3-5. 등록. rosterName 은 비워 둔다 — 강사가 명단 화면에서 채운다.
for (const u of students) {
  const uid = id(u)
  await put(`classes/${NEW_CLASS}/enrollments/${uid}`, {
    uid: { stringValue: uid },
    studentId: u.fields?.studentId ?? { nullValue: null },
    nickname: u.fields?.nickname ?? { stringValue: '' },
    groupId: { nullValue: null },
    joinedAt: { integerValue: String(Date.now()) },
    lastSeenAt: { integerValue: '0' },
    status: { stringValue: 'active' },
  })
}
console.log(`  ✓ 등록 ${students.length}명 (실명은 비어 있음 — 명단 화면에서 채우세요)`)

console.log(
  `\n끝났습니다. 새 클래스 id: ${NEW_CLASS}\n` +
    `  · courses/${COURSE_ID} 는 지우지 않았습니다. 화면에서 확인한 뒤 콘솔에서 지우세요.\n` +
    '  · 클래스 표시 이름과 요일·시간은 「수강 클래스」 화면에서 고치세요.\n',
)

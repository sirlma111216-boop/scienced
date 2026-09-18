/**
 * npm run test:writes
 *
 * 앱이 **실제로 보내는 그 값**이 보안 규칙을 통과하는가.
 *
 * ── 왜 따로 만들었나 ──
 * test:rules 와 test:flow 는 규칙만 봤다. 문서를 저장할 때 내가 생각한 모양으로
 * 직접 써 넣었으므로, 앱이 다른 모양을 보내고 있어도 통과했다.
 * 실제로 그랬다 — completeReset 이 user 객체를 통째로 보내 규칙에 막혔는데
 * 「전부 통과」라고 나왔다. 검사가 검사하지 않는 것을 검사하고 있었다.
 *
 * 그래서 여기서는 화면이 부르는 그 함수의 **payload 를 그대로** 만들어 보낸다.
 * 저장 모양이 바뀌면 이 파일도 함께 바뀌어야 한다. 그것이 이 파일의 목적이다.
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

/* 앱의 저장 계층을 그대로 쓴다. 검사용으로 다시 쓴 코드가 아니다. */
const { createFirestoreRepo } = await import('../src/lib/repo-firestore.ts')
/* 앱이 실제로 보내는 필드 목록. auth.tsx 와 같은 배열이어야 한다. */
const authSrc = await readFile('src/lib/auth.tsx', 'utf8')

const env = await initializeTestEnvironment({
  projectId: 'sls-writes-' + Date.now(),
  firestore: {
    rules: await readFile('firestore.rules', 'utf8'),
    host: HOST.split(':')[0],
    port: Number(HOST.split(':')[1]),
  },
})

const TEACHER = 'teacher-1'
const STUDENT = 'student-1'
const STUDENT2 = 'student-2'
const CID = 'c-w1'

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  await db.doc(`instructors/${TEACHER}`).set({ role: 'instructor' })
  await db.doc(`classes/${CID}`).set({
    id: CID, ownerUid: TEACHER, status: 'active', enrollmentOpen: true,
    requireJoinCode: false, displayName: '과학교육론', courseTitle: '과학교육론',
  })
  await db.doc(`classes/${CID}/lessonState/01`).set({ lessonId: '01', published: true })
  await db.doc(`classes/${CID}/enrollments/${STUDENT2}`).set({ uid: STUDENT2, status: 'active' })
  // 명단 가져오기가 만든 상태 그대로 (반쪽이 아닌 온전한 문서)
  await db.doc(`users/${STUDENT}`).set({
    uid: STUDENT, role: 'student', studentId: '2024123456', displayName: '이나나',
    nickname: '', mustResetPassword: true, groupId: null, lastClassId: null,
    createdAt: Date.now(), lastLoginAt: 0,
  })
})

const studentRepo = createFirestoreRepo(env.authenticatedContext(STUDENT).firestore())

/* ── ① auth.tsx 가 규칙과 같은 필드 목록을 쓰는가 ── */
{
  /*
   * 주석을 먼저 걷어낸다. 파일 머리의 설명에도 hasOnly([...]) 가 있어서
   * 그것이 먼저 잡히면 빈 목록을 규칙으로 착각한다.
   * 규칙 파일은 목록을 여러 줄에 걸쳐 쓰므로 닫는 대괄호와 괄호 사이의 줄바꿈도 허용한다.
   */
  const rules = (await readFile('firestore.rules', 'utf8')).replace(/^\s*\/\/.*$/gm, '')
  const m = rules.match(/changedKeys\(\)\.hasOnly\(\s*\[([\s\S]*?)\]\s*\)/)
  if (!m) {
    fail('허용 필드', 'firestore.rules 에서 users 의 hasOnly 목록을 찾지 못했다')
  } else {
    const allowed = [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1]).sort()
    const inCode = [...(authSrc.match(/const STUDENT_WRITABLE = \[([\s\S]*?)\]/)?.[1] ?? '')
      .matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1]).sort()
    if (inCode.length === 0) {
      fail('허용 필드', 'auth.tsx 에 STUDENT_WRITABLE 목록이 없다')
    } else if (allowed.join(',') !== inCode.join(',')) {
      fail(
        '허용 필드',
        `규칙과 코드의 목록이 다르다 — 규칙 [${allowed}] · 코드 [${inCode}]. 하나만 어긋나도 저장이 통째로 거절된다`,
      )
    } else {
      pass('허용 필드', `규칙과 코드가 같은 목록을 쓴다 (${allowed.join(' · ')})`)
    }
  }
}

/* ── ② 로그인할 때 보내는 값 ── */
{
  // auth.tsx 의 writableUser() 가 만드는 그 모양
  const payload = {
    uid: STUDENT, nickname: '', mustResetPassword: true,
    groupId: null, lastClassId: null, lastLoginAt: Date.now(),
  }
  try {
    await studentRepo.upsertUser(payload)
    pass('로그인 저장', '로그인할 때 보내는 값이 그대로 통과한다')
  } catch (err) {
    fail('로그인 저장', `막힌다 — ${err.message} · 「불러오는 중…」에서 멈춘다`)
  }
}

/* ── ③ 닉네임·비밀번호 설정을 마칠 때 ── */
{
  const payload = {
    uid: STUDENT, nickname: '이나나나', mustResetPassword: false,
    groupId: null, lastClassId: null, lastLoginAt: Date.now(),
  }
  try {
    await studentRepo.upsertUser(payload)
    pass('설정 마치기', '「저장하고 시작하기」가 보내는 값이 통과한다')
  } catch (err) {
    fail('설정 마치기', `막힌다 — ${err.message}`)
  }
}

/* ── ④ 수강 등록 ── */
{
  // auth.tsx 의 enroll 호출부와 같은 모양. undefined 가 하나라도 있으면 SDK 가 먼저 거부한다.
  const payload = {
    uid: STUDENT, studentId: '2024123456', nickname: '이나나나',
    groupId: null, joinedAt: Date.now(), lastSeenAt: Date.now(), status: 'active',
  }
  if (Object.values(payload).some((v) => v === undefined)) {
    fail('수강 등록', 'payload 에 undefined 가 있다 — Firestore 는 담지 못한다')
  } else {
    try {
      await studentRepo.enroll(CID, payload)
      pass('수강 등록', '학생이 스스로 등록하는 값이 통과한다')
    } catch (err) {
      fail('수강 등록', `막힌다 — ${err.message}`)
    }
  }
}

/* ── ④-b 내보내진 뒤 다시 등록 ── */
{
  /*
   * 강사가 내보내면(status: ended) 등록 문서에 모둠 자리(currentGroupId·currentRoundId)가 남는다.
   * 그 학생이 다시 등록할 때 문서를 통째로 덮어쓰면 그 두 키가 「바뀐 키」에 들어가
   * 규칙(학생은 모둠 자리를 못 옮긴다)에 막힌다 — 「Missing or insufficient permissions」.
   * 실제로 한 학생이 이 자리에 갇혔다(2026-09-15). 다시 등록은 반드시 통과해야 한다.
   */
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`classes/${CID}/enrollments/${STUDENT}`).set(
      { status: 'ended', currentGroupId: '2', currentRoundId: `${CID}-01` },
      { merge: true },
    )
  })
  const payload = {
    uid: STUDENT, studentId: '2024123456', nickname: '이나나나',
    groupId: null, joinedAt: Date.now(), lastSeenAt: Date.now(), status: 'active',
  }
  try {
    await studentRepo.enroll(CID, payload)
    let back = null
    await env.withSecurityRulesDisabled(async (ctx) => {
      back = (await ctx.firestore().doc(`classes/${CID}/enrollments/${STUDENT}`).get()).data()
    })
    if (back?.status !== 'active') fail('다시 등록', `등록했는데 status 가 ${back?.status} 다`)
    else pass('다시 등록', '내보내진 학생이 다시 등록하면 active 로 돌아온다 — 모둠 자리 키가 있어도 막히지 않는다')
  } catch (err) {
    fail('다시 등록', `내보내진 학생이 다시 등록하지 못한다 — ${err.message}`)
  }
}

/* ── ⑤ 마지막으로 본 클래스 저장 ── */
{
  const payload = {
    uid: STUDENT, nickname: '이나나나', mustResetPassword: false,
    groupId: null, lastClassId: CID, lastLoginAt: Date.now(),
  }
  try {
    await studentRepo.upsertUser(payload)
    pass('클래스 기억', '고른 클래스를 저장하는 값이 통과한다')
  } catch (err) {
    fail('클래스 기억', `막힌다 — ${err.message} · 다음에 들어올 때 클래스를 다시 골라야 한다`)
  }
}

/* ── ⑥ 1강 자동저장 → 제출 ── */
{
  try {
    await studentRepo.saveDraft(CID, '01', 'intro', STUDENT, { choice: '초안' })
    await studentRepo.submitResponse(CID, '01', 'intro', STUDENT, { choice: '학습의 증거' }, {
      confidence: 3,
      changedReason: null,
    })
    const doc = await studentRepo.getResponse(CID, '01', 'intro', STUDENT)
    if ((doc?.versions?.length ?? 0) !== 1) {
      fail('1강 제출', `버전이 ${doc?.versions?.length ?? 0}개다 (1개여야 한다)`)
    } else {
      pass('1강 제출', '자동저장 뒤 제출까지 앱의 코드로 통과한다')
    }
  } catch (err) {
    fail('1강 제출', `막힌다 — ${err.message}`)
  }
}

/* ── ⑥-b 잠깐 확인: 카드마다 고른 자리가 한 문서에 모이고, 강사가 분포를 읽는다 (강의자 지시 2026-09-18) ── */
{
  const { saveConceptCheck, checkChoices, checkTally } = await import('../src/lib/concept-check.ts')
  const { loadAllLessons } = await import('../src/content/courses/index.ts')
  const l01 = (await loadAllLessons('method')).find((l) => l.id === '01')
  const [k1, k2] = l01.concepts
  const repo2 = createFirestoreRepo(env.authenticatedContext(STUDENT2).firestore())
  const teacher = createFirestoreRepo(env.authenticatedContext(TEACHER).firestore())
  try {
    /* 화면(StudentConceptCards)과 같은 순서 — 앞 답을 담아 뒤 답을 낸다 */
    let prev = checkChoices(await studentRepo.getResponse(CID, '01', 'concepts', STUDENT))
    prev = await saveConceptCheck(studentRepo, { classId: CID, lessonId: '01', stepId: 'concepts', uid: STUDENT, prev, conceptId: k1.id, choice: k1.check.answer })
    prev = await saveConceptCheck(studentRepo, { classId: CID, lessonId: '01', stepId: 'concepts', uid: STUDENT, prev, conceptId: k2.id, choice: (k2.check.answer + 1) % 4 })
    await saveConceptCheck(repo2, { classId: CID, lessonId: '01', stepId: 'concepts', uid: STUDENT2, prev: {}, conceptId: k1.id, choice: (k1.check.answer + 2) % 4 })
    const mine = checkChoices(await studentRepo.getResponse(CID, '01', 'concepts', STUDENT))
    /* 강사는 화면이 쓰는 구독으로 읽는다 */
    const docs = await new Promise((resolve) => {
      const off = teacher.watchAllResponses(CID, '01', 'concepts', (d) => {
        if (d.length >= 2) {
          off()
          resolve(d)
        }
      })
    })
    const t1 = checkTally(docs, k1.id)
    const t2 = checkTally(docs, k2.id)
    let peeked = false
    try {
      await repo2.getResponse(CID, '01', 'concepts', STUDENT)
      peeked = true
    } catch { /* 막혀야 한다 */ }
    if (mine[k1.id] !== k1.check.answer || mine[k2.id] !== (k2.check.answer + 1) % 4) fail('잠깐 확인', `둘째 답을 낸 뒤 첫째 답이 남지 않았다 — ${JSON.stringify(mine)}`)
    else if (t1.answered !== 2 || t1.counts[k1.check.answer] !== 1 || t2.answered !== 1 || t2.counts[k2.check.answer] !== 0) fail('잠깐 확인', `강사 분포가 맞지 않다 — ${JSON.stringify({ t1, t2 })}`)
    else if (peeked) fail('잠깐 확인', '학생이 남의 확인 답을 읽었다 — 규칙이 막아야 한다')
    else pass('잠깐 확인', `카드 두 장의 답이 한 문서에 모이고(앱의 saveConceptCheck), 강사 분포가 맞다 — 1번 카드 ${t1.answered}명 중 맞힘 ${t1.counts[k1.check.answer]} · 남의 답은 못 읽는다`)
  } catch (err) {
    fail('잠깐 확인', `막힌다 — ${err.message}`)
  }
}

/* ── ⑦ 모둠 데이터(8차 4.6): 제출한 사람의 값이 모둠에 모이고 평균이 맞는가 ── */
{
  const repo2 = createFirestoreRepo(env.authenticatedContext(STUDENT2).firestore())
  const STEP = 'activity'

  /* 화면과 같은 순서다. 먼저 각자 제출해야 모둠 화면이 열린다. */
  await studentRepo.submitResponse(CID, '01', STEP, STUDENT, {
    allocation: { fun: 20, evidence: 60, safety: 20 }, opinion: '증거가 남아야 수업이다',
  }, { confidence: null, changedReason: null })
  await repo2.submitResponse(CID, '01', STEP, STUDENT2, {
    allocation: { fun: 60, evidence: 20, safety: 20 }, opinion: '보고 싶어야 남는다',
  }, { confidence: null, changedReason: null })

  /* 제출 전에는 규칙이 막아야 한다 — 남의 배분을 먼저 보는 길이 없어야 한다. */
  const NOTYET = 'wrapup'
  let blocked = false
  try {
    await studentRepo.setGroupShare(CID, '01', NOTYET, {
      uid: STUDENT, nickname: '나', groupId: '1', value: {}, reason: 'x', updatedAt: Date.now(),
    })
  } catch {
    blocked = true
  }
  if (!blocked) fail('모둠 데이터 관문', '제출하지 않은 단계에서도 모둠에 값이 들어가진다')

  /* 둘 다 1모둠을 고른다. */
  await studentRepo.setGroupShare(CID, '01', STEP, {
    uid: STUDENT, nickname: '이나나나', groupId: '1',
    value: { fun: 20, evidence: 60, safety: 20 }, reason: '증거가 남아야 수업이다',
    updatedAt: Date.now(),
  })
  await repo2.setGroupShare(CID, '01', STEP, {
    uid: STUDENT2, nickname: '박두두', groupId: '1',
    value: { fun: 60, evidence: 20, safety: 20 }, reason: '보고 싶어야 남는다',
    updatedAt: Date.now(),
  })

  /* 화면이 쓰는 그 구독으로 읽는다. */
  const seen = await new Promise((resolve) => {
    const stop = studentRepo.watchGroupShares(CID, '01', STEP, (list) => {
      if (list.length >= 2) {
        stop()
        resolve(list)
      }
    })
    setTimeout(() => {
      stop()
      resolve([])
    }, 5000)
  })

  if (seen.length !== 2) {
    fail('모둠 데이터', `모둠원이 ${seen.length}명 보인다 — 2명이어야 한다`)
  } else {
    /* 화면이 그리는 그 계산(group-math)을 그대로 쓴다 */
    const { allocationAverage } = await import('../src/lib/group-math.ts')
    const field = { key: 'allocation', kind: 'allocation', label: '', items: [{ id: 'fun', label: '재미' }, { id: 'evidence', label: '증거' }, { id: 'safety', label: '안전' }] }
    const rows = allocationAverage(field, seen.map((g) => ({ uid: g.uid, nickname: g.nickname, value: g.value })))
    const avg = (id) => rows.find((r) => r.id === id)?.avg
    if (avg('fun') !== 40 || avg('evidence') !== 40) {
      fail('모둠 평균', `평균이 fun ${avg('fun')} · evidence ${avg('evidence')} 다 (둘 다 40이어야 한다)`)
    } else {
      /* 대표가 합의 문장을 올리면 의견 광장의 글이 된다. */
      await studentRepo.upsertPost(CID, '01', STEP, {
        uid: STUDENT, nickname: '이나나나', groupId: '1', content: '우리 모둠은 증거와 재미를 반씩 두었다',
      })
      const posts = await new Promise((resolve) => {
        const stop = repo2.watchPosts(CID, '01', STEP, (list) => {
          if (list.length > 0) {
            stop()
            resolve(list)
          }
        })
        setTimeout(() => {
          stop()
          resolve([])
        }, 5000)
      })
      if (posts.length !== 1 || posts[0].groupId !== '1') {
        fail('모둠 문장 공개', '다른 모둠원이 합의 문장을 읽지 못한다')
      } else {
        /*
         * 다시 올리면 글이 늘지 않고 그 글의 내용이 바뀌어야 한다.
         * 규칙이 작성자에게 versions·latestV 만 열어 주므로, createdAt 을 건드리면 통째로 막힌다.
         * 실제로 막히는지 앱의 코드로 확인한다.
         */
        await studentRepo.upsertPost(CID, '01', STEP, {
          uid: STUDENT, nickname: '이나나나', groupId: '1', content: '고쳐 쓴 문장',
        })
        const after = await new Promise((resolve) => {
          const stop = repo2.watchPosts(CID, '01', STEP, (list) => {
            if (list.some((p) => p.versions?.[0]?.content === '고쳐 쓴 문장')) {
              stop()
              resolve(list)
            }
          })
          setTimeout(() => {
            stop()
            resolve([])
          }, 5000)
        })
        if (after.length !== 1) {
          fail('글 덮어쓰기', `다시 올렸더니 글이 ${after.length}개다 — 1개여야 한다`)
        } else if (after[0].latestV !== 1 || after[0].versions.length !== 1) {
          fail('글 덮어쓰기', '다시 올렸는데 버전이 쌓였다')
        } else {
          pass('모둠 데이터', '제출 뒤에만 열리고, 같은 모둠 두 사람의 배분 평균이 맞고, 광장 글이 뜬다')
          pass('글 덮어쓰기', '다시 올리면 글이 늘지 않고 그 글의 내용만 바뀐다')
        }
      }
    }
  }

  /* 자리는 기록이 아니다. 나가면 사라져야 한다. */
  await studentRepo.clearGroupShare(CID, '01', STEP, STUDENT)
}

/* ── ⑧ 사다리 자리: 한 사람이 하나만 ── */
{
  const GAME = '01-activity-ladder'
  const repo2 = createFirestoreRepo(env.authenticatedContext(STUDENT2).firestore())

  /* 강사가 판을 연 상태를 만든다 */
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`classes/${CID}/sessions/01`).set({
      lessonId: '01',
      currentStepId: 'activity',
      stepOpen: true,
      pollResults: {},
      ladders: {
        [GAME]: {
          gameId: GAME, phase: 'seating', round: 1, seed: `${GAME}::r1::1`,
          columns: 6, seats: {}, presentSlots: [], winnerUids: [], excludedUids: [],
          emergency: false, runAt: null,
        },
      },
      pinnedPostRef: null, instructorAt: null, updatedAt: Date.now(),
    })
  })

  const seatsNow = async () =>
    new Promise((resolve) => {
      const stop = studentRepo.watchSession(CID, '01', (sess) => {
        stop()
        resolve(sess?.ladders?.[GAME]?.seats ?? {})
      })
      setTimeout(() => {
        stop()
        resolve({})
      }, 5000)
    })

  /* 1번을 잡았다가 3번으로 옮긴다. 앱의 코드 그대로. */
  const first = await studentRepo.claimLadderSeat(CID, '01', GAME, 0, STUDENT)
  const moved = await studentRepo.claimLadderSeat(CID, '01', GAME, 2, STUDENT)
  const seats = await seatsNow()
  const mine = Object.entries(seats).filter(([, u]) => u === STUDENT).map(([k]) => k)

  if (!first || !moved) {
    fail('사다리 자리', '자리를 잡지 못했다')
  } else if (mine.length !== 1) {
    /*
     * 여기서 실제로 걸렸다. merge:true 는 지도에서 없어진 열쇠를 지우지 않아
     * 옛 자리가 서버에 남았고, 한 사람이 두 자리를 차지했다.
     */
    fail('사다리 자리', `한 사람이 ${mine.length}자리를 잡고 있다 (${mine.join(', ')}번) — 하나여야 한다`)
  } else if (mine[0] !== '2') {
    fail('사다리 자리', `옮긴 자리가 ${mine[0]}번이다 (2번이어야 한다)`)
  } else {
    /* 남의 자리는 못 뺏는다 */
    const stolen = await repo2.claimLadderSeat(CID, '01', GAME, 2, STUDENT2)
    if (stolen) {
      fail('사다리 자리', '이미 잡힌 자리를 다른 사람이 가져갔다')
    } else {
      pass('사다리 자리', '자리를 옮기면 옛 자리가 실제로 비고, 남의 자리는 못 가져간다')
    }
  }
}

/* ── ⑨ 옛 글이 여러 장이면 다시 올릴 때 하나로 거둔다 ── */
{
  const STEP = 'activity'
  /*
   * 문서 id 가 uid 가 아니던 시절의 글을 심는다.
   * 그때는 누를 때마다 새 글이 생겨 같은 사람의 글이 흩어졌다.
   */
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    for (const id of ['old-1', 'old-2']) {
      await db.doc(`classes/${CID}/lessons/01/steps/${STEP}/posts/${id}`).set({
        uid: STUDENT, nickname: '이나나나', groupId: null,
        versions: [{ v: 1, content: '옛 글 ' + id, changedReason: null, createdAt: Date.now() }],
        latestV: 1, reactions: {}, comments: [],
        isPinned: false, isHidden: false, hiddenReason: null, createdAt: Date.now(),
      })
    }
  })

  await studentRepo.upsertPost(CID, '01', STEP, {
    uid: STUDENT, nickname: '이나나나', groupId: null, content: '지금 생각',
  })

  await env.withSecurityRulesDisabled(async (ctx) => {
    const snap = await ctx.firestore()
      .collection(`classes/${CID}/lessons/01/steps/${STEP}/posts`)
      .get()
    const mine = snap.docs.filter((d) => d.data().uid === STUDENT)
    if (mine.length !== 1) {
      fail('옛 글 거두기', `같은 사람의 글이 ${mine.length}장 남았다 — 1장이어야 한다`)
    } else if (mine[0].id !== STUDENT) {
      fail('옛 글 거두기', `남은 글의 id 가 ${mine[0].id} 다 — uid 여야 한다`)
    } else if (mine[0].data().versions[0].content !== '지금 생각') {
      fail('옛 글 거두기', '남은 글이 최신 내용이 아니다')
    } else {
      pass('옛 글 거두기', '다시 올리면 흩어져 있던 옛 글이 거둬지고 최신 한 장만 남는다')
    }
  })
}

/* ── ⑩ 내보내기: 이 클래스에서만 빼고 계정은 남는다 ── */
{
  const teacherRepo = createFirestoreRepo(env.authenticatedContext(TEACHER).firestore())
  const STEP = 'activity'

  const t0 = Date.now()
  await teacherRepo.removeEnrollment(CID, STUDENT)
  const ms = Date.now() - t0
  console.log(`  내보내기: ${ms}ms (에뮬레이터 기준)`)
  /* 화면에서 끝나지 않는 것처럼 보이는 순간부터는 동작하지 않는 것과 같다 */
  if (ms > 15000) fail('내보내기 속도', `${ms}ms 걸렸다 — 수업 중에 쓸 수 없다`)

  /* 규칙을 우회해 정말 사라졌는지 본다 — 규칙에 가려 안 보이는 것과 없는 것은 다르다 */
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const gone = async (label, path) => {
      const snap = await db.doc(path).get()
      if (snap.exists) fail('내보내기', `${label} 이 남아 있다 — ${path}`)
      return !snap.exists
    }
    const kept = async (label, path) => {
      const snap = await db.doc(path).get()
      if (!snap.exists) fail('내보내기', `${label} 까지 지워졌다 — ${path}`)
      return snap.exists
    }
    const checks = await Promise.all([
      gone('등록', `classes/${CID}/enrollments/${STUDENT}`),
      gone('응답', `classes/${CID}/lessons/01/steps/${STEP}/responses/${STUDENT}`),
      gone('의견 글', `classes/${CID}/lessons/01/steps/${STEP}/posts/${STUDENT}`),
      gone('모둠 자리', `classes/${CID}/lessons/01/steps/${STEP}/groupshares/${STUDENT}`),
      /* ⑥-b 에서 남긴 잠깐 확인의 답 — 개념 단계도 치운다 */
      gone('잠깐 확인 답', `classes/${CID}/lessons/01/steps/concepts/responses/${STUDENT}`),
      /* ★ 계정은 남아야 한다. 다른 학기 수강도 그대로다. */
      kept('계정', `users/${STUDENT}`),
      /* 같은 클래스의 다른 사람 자료는 건드리지 않는다 */
      kept('다른 수강생 등록', `classes/${CID}/enrollments/${STUDENT2}`),
      kept('다른 수강생 잠깐 확인 답', `classes/${CID}/lessons/01/steps/concepts/responses/${STUDENT2}`),
    ])
    if (checks.every(Boolean)) {
      pass('내보내기', '이 클래스의 등록·응답·의견·모둠 자리만 사라지고, 계정과 남은 사람은 그대로다')
    }
  })
}

/* ── ⑪ 모둠 나누기 (6차): 회차 확정 → 기록·현재 모둠, 늦게 합류, 게임 선택 ── */
{
  const teacherRepo = createFirestoreRepo(env.authenticatedContext(TEACHER).firestore())
  const { assignGroups, applyRound, encodePlan, decodePlan } = await import('../shared/groups-core.ts')
  const CID2 = 'c-w2'
  const uids = ['g-a', 'g-b', 'g-c', 'g-d', 'g-e', 'g-f', 'g-g', 'g-h']
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await db.doc(`classes/${CID2}`).set({
      id: CID2, ownerUid: TEACHER, status: 'active', enrollmentOpen: true,
      requireJoinCode: false, displayName: '모둠 검사', courseTitle: '과학교육론', groupCount: 2,
    })
    for (const u of uids) await db.doc(`classes/${CID2}/enrollments/${u}`).set({ uid: u, status: 'active', nickname: u })
  })

  /* 학생이 질문에 답한다 — 앱의 코드로 (8차 5절) */
  const sA = createFirestoreRepo(env.authenticatedContext('g-a').firestore())
  await sA.setGroupInput(CID2, { uid: 'g-a', lessonId: '01', questionId: 'country', choice: '일본', updatedAt: Date.now() })
  /* 남의 것을 쓰려 하면 막힌다 */
  let stolen = false
  try {
    await sA.setGroupInput(CID2, { uid: 'g-b', lessonId: '01', questionId: 'country', choice: '일본', updatedAt: Date.now() })
    stolen = true
  } catch { /* 막혀야 한다 */ }
  if (stolen) fail('질문 답', '학생이 남의 답을 썼다 — 규칙이 막아야 한다')

  /* 두 회차를 앱의 계산 코드로 짜서 확정한다 */
  let history = {}
  const t0 = Date.now()
  const r1 = assignGroups({ uids, groupCount: 2, history, round: 1, roundsAhead: 2, seed: 'test:1' })
  const round1 = {
    id: `${CID2}-01`, round: 1, lessonId: '01', questionId: 'country',
    groups: r1.groups.map((m, i) => ({ id: String(i + 1), name: `${i + 1}모둠`, memberUids: m })),
    absentUids: [], seed: r1.seed, cost: r1.repeats, createdBy: TEACHER, createdAt: Date.now(),
    manualEdits: [], plannedNext: encodePlan(r1.plannedNext), followedPlan: r1.followedPlan, lateJoins: [],
  }
  await teacherRepo.confirmGroupRound(CID2, round1)
  history = applyRound(history, r1.groups, 1)
  const r2 = assignGroups({ uids, groupCount: 2, history, round: 2, roundsAhead: 1, seed: 'test:2', plannedRemaining: decodePlan(round1.plannedNext), planStale: !r1.followedPlan })
  const round2 = { ...round1, id: `${CID2}-03`, round: 2, lessonId: '03', questionId: 'drink', groups: r2.groups.map((m, i) => ({ id: String(i + 1), name: `${i + 1}모둠`, memberUids: m })), seed: r2.seed, cost: r2.repeats, plannedNext: encodePlan(r2.plannedNext), followedPlan: r2.followedPlan }
  await teacherRepo.confirmGroupRound(CID2, round2)
  const ms = Date.now() - t0
  console.log(`  모둠 확정 2회: ${ms}ms (에뮬레이터 기준)`)
  if (ms > 15000) fail('모둠 확정 속도', `${ms}ms 걸렸다 — 수업 중에 쓸 수 없다`)

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    /* 동석 기록 — 짝마다 정확히 몇 번인지. 2회차 짝은 count 1 씩, 두 번 만난 짝은 2 */
    const hist = await db.collection(`classes/${CID2}/pairHistory`).get()
    const byKey = Object.fromEntries(hist.docs.map((d) => [d.id, d.data()]))
    const expected = applyRound(history, r2.groups, 2)
    let bad = 0
    for (const [k, rec] of Object.entries(expected)) if (byKey[k]?.count !== rec.count || byKey[k]?.lastRound !== rec.lastRound) bad += 1
    if (Object.keys(byKey).length !== Object.keys(expected).length) bad += 1
    if (bad > 0) fail('동석 기록', `pairHistory 가 계산과 ${bad}곳 다르다 — increment 나 lastRound 가 틀렸다`)
    else pass('동석 기록', `짝 ${Object.keys(expected).length}개의 count·lastRound 가 앱의 계산과 정확히 같다`)

    /* 현재 모둠 — 등록 문서에 2회차 모둠이 적혀 있다 */
    const enr = await db.doc(`classes/${CID2}/enrollments/g-a`).get()
    const gA = round2.groups.find((g) => g.memberUids.includes('g-a'))
    if (enr.data()?.currentGroupId !== gA.id || enr.data()?.currentRoundId !== round2.id) {
      fail('현재 모둠', `등록의 currentGroupId 가 ${enr.data()?.currentGroupId} — 2회차 ${gA.id} 이어야 한다`)
    } else pass('현재 모둠', '회차를 확정하면 등록 문서의 현재 모둠이 그 회차로 바뀐다')
  })

  /* 늦게 합류 — 새 사람을 비용이 가장 적게 느는 모둠에. 배정을 다시 돌리지 않는다. */
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`classes/${CID2}/enrollments/g-late`).set({ uid: 'g-late', status: 'active', nickname: 'late' })
  })
  await teacherRepo.addLateJoiner(CID2, round2.id, 'g-late', '2')
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const snap = await db.doc(`classes/${CID2}/groupRounds/${round2.id}`).get()
    const g2 = snap.data().groups.find((g) => g.id === '2')
    const others = round2.groups.find((g) => g.id === '2').memberUids
    const okMember = g2.memberUids.includes('g-late') && others.every((u) => g2.memberUids.includes(u))
    const late = snap.data().lateJoins?.[0]
    const pair = await db.doc(`classes/${CID2}/pairHistory/${['g-late', others[0]].sort().join('|')}`).get()
    if (!okMember || late?.uid !== 'g-late' || pair.data()?.count !== 1) {
      fail('지각 합류', '늦게 온 사람이 모둠에 들어가고 기록에 남아야 한다 — 회차 문서·lateJoins·pairHistory 중 하나가 틀렸다')
    } else pass('지각 합류', '늦게 온 사람이 지정한 모둠에 들어가고, 기록(lateJoins·동석)이 남는다')
  })

  /*
   * 다시 확정 — 콘솔의 「다시 나누기」. 같은 회차를 새 모둠으로 다시 확정하면
   * 이전 확정의 짝은 빠지고 새 짝만 남아야 한다. +1 만 하면 한 회차가 두 번 세어진다.
   * 기대값: 1회차 + (다시 짠) 2회차 + 지각 합류. 이전 2회차의 짝은 흔적이 없어야 한다.
   */
  {
    const r2b = assignGroups({ uids, groupCount: 2, history, round: 2, roundsAhead: 1, seed: 'test:2-redo' })
    const round2b = { ...round2, groups: r2b.groups.map((m, i) => ({ id: String(i + 1), name: `${i + 1}모둠`, memberUids: m })), seed: r2b.seed, cost: r2b.repeats, plannedNext: encodePlan(r2b.plannedNext), followedPlan: r2b.followedPlan }
    await teacherRepo.confirmGroupRound(CID2, round2b)
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      const hist = await db.collection(`classes/${CID2}/pairHistory`).get()
      const byKey = Object.fromEntries(hist.docs.map((d) => [d.id, d.data()]))
      const expected = applyRound(history, r2b.groups, 2)
      let bad = 0
      for (const [k, rec] of Object.entries(expected)) if ((byKey[k]?.count ?? 0) !== rec.count) bad += 1
      /* 지각 합류의 짝(count 1)은 남고, 그 밖에 기대에 없는데 count 가 0 이 아닌 짝이 있으면 두 번 세어진 것이다 */
      const stray = Object.entries(byKey).filter(([k, v]) => !(k in expected) && !k.includes('g-late') && v.count !== 0).length
      if (bad > 0 || stray > 0) fail('다시 확정', `같은 회차를 다시 확정했더니 pairHistory 가 ${bad}곳 다르고 이전 짝 ${stray}개가 남아 있다 — 이전 확정의 짝을 빼야 한다`)
      else pass('다시 확정', '같은 회차를 다시 확정하면 이전 확정의 짝이 빠지고 새 짝만 남는다 (두 번 세지 않는다)')
      const enr = await db.doc(`classes/${CID2}/enrollments/g-a`).get()
      const gA = round2b.groups.find((g) => g.memberUids.includes('g-a'))
      if (enr.data()?.currentGroupId !== gA.id) fail('다시 확정 · 현재 모둠', `등록의 currentGroupId 가 ${enr.data()?.currentGroupId} — 다시 확정한 ${gA.id} 이어야 한다`)
    })
  }

  /* 확정하면 클래스 문서에 쓴 질문이 남는다 — 학기 안에 되풀이하지 않는다 (8차 5.2) */
  await env.withSecurityRulesDisabled(async (ctx) => {
    const c = await ctx.firestore().doc(`classes/${CID2}`).get()
    const fq = c.data()?.formationQuestions ?? {}
    if (fq['01'] !== 'country' || fq['03'] !== 'drink') fail('질문 기록', `클래스 문서의 formationQuestions 가 ${JSON.stringify(fq)} — 01:country · 03:drink 여야 한다`)
    else pass('질문 기록', '회차를 확정하면 쓴 질문이 클래스 문서에 남는다')
  })

  /* ── ⑫ 모둠 값(8차 4.6): 내 모둠에만 쓴다. 제출이 먼저다 ── */
  {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`classes/${CID2}/lessonState/03`).set({ lessonId: '03', published: true })
    })
    const gA = (await new Promise((resolve) => {
      const stop = sA.watchGroupRounds(CID2, (rs) => {
        const r = rs.find((x) => x.id === `${CID2}-03`)
        if (r) { stop(); resolve(r) }
      })
      setTimeout(() => { stop(); resolve(null) }, 5000)
    }))?.groups.find((g) => g.memberUids.includes('g-a'))
    const other = gA?.id === '1' ? '2' : '1'
    /* 제출 전에는 못 쓴다 */
    let early = false
    try {
      await sA.setGroupValue(CID2, '03', 'activity', { groupId: gA.id, format: 'sentence', value: '아직', byUid: 'g-a', updatedAt: Date.now() })
      early = true
    } catch { /* 막혀야 한다 */ }
    await sA.submitResponse(CID2, '03', 'activity', 'g-a', { opinion: '한 문장' }, { confidence: null, changedReason: null })
    await sA.setGroupValue(CID2, '03', 'activity', { groupId: gA.id, format: 'sentence', value: '우리 모둠의 한 문장', byUid: 'g-a', updatedAt: Date.now() })
    let wrongGroup = false
    try {
      await sA.setGroupValue(CID2, '03', 'activity', { groupId: other, format: 'sentence', value: '남의 모둠', byUid: 'g-a', updatedAt: Date.now() })
      wrongGroup = true
    } catch { /* 막혀야 한다 */ }
    const values = await new Promise((resolve) => {
      const stop = sA.watchGroupValues(CID2, '03', 'activity', (list) => { if (list.length > 0) { stop(); resolve(list) } })
      setTimeout(() => { stop(); resolve([]) }, 5000)
    })
    if (early) fail('모둠 값', '제출 전에 모둠 값을 썼다 — 규칙이 막아야 한다')
    else if (wrongGroup) fail('모둠 값', '남의 모둠 값을 썼다 — 규칙이 막아야 한다')
    else if (values.length !== 1 || values[0].value !== '우리 모둠의 한 문장') fail('모둠 값', `모둠 값이 ${JSON.stringify(values)} 다`)
    else pass('모둠 값', '제출한 뒤 내 모둠의 값만 쓸 수 있고, 같은 단계 사람이 그것을 읽는다')
  }

  /* ── ⑬ 게임 참가·입력(8차 6.4): 자기 문서만, 모두가 읽는다 ── */
  {
    const sB = createFirestoreRepo(env.authenticatedContext('g-b').firestore())
    const t0 = Date.now()
    await sA.setGameInput(CID2, '03', { uid: 'g-a', stepId: 'activity', round: 1, joinedAt: t0, value: {}, updatedAt: t0 })
    await sA.setGameInput(CID2, '03', { uid: 'g-a', stepId: 'activity', round: 1, joinedAt: t0, value: { n: 42 }, updatedAt: t0 + 1 })
    let stolenInput = false
    try {
      await sA.setGameInput(CID2, '03', { uid: 'g-b', stepId: 'activity', round: 1, joinedAt: t0, value: { n: 1 }, updatedAt: t0 })
      stolenInput = true
    } catch { /* 막혀야 한다 */ }
    await sB.setGameInput(CID2, '03', { uid: 'g-b', stepId: 'activity', round: 1, joinedAt: t0 + 5, value: { n: 7 }, updatedAt: t0 + 5 })
    const inputs = await new Promise((resolve) => {
      const stop = sB.watchGameInputs(CID2, '03', 'activity', (list) => { if (list.length >= 2) { stop(); resolve(list) } })
      setTimeout(() => { stop(); resolve([]) }, 5000)
    })
    const { derive } = await import('../src/lib/game-core.ts')
    const state = { kind: 'closest', stepId: 'activity', phase: 'running', round: 1, seed: 'writes::closest', startedAt: t0, state: null, result: null, updatedAt: t0 }
    const d = derive({ state, inputs, now: t0 + 1000, groups: [] })
    if (stolenInput) fail('게임 입력', '학생이 남의 게임 입력을 썼다 — 규칙이 막아야 한다')
    else if (inputs.length !== 2) fail('게임 입력', `다른 학생에게 입력이 ${inputs.length}개 보인다 — 2개여야 한다`)
    else if (!d.finished || d.winnerUids.length === 0) fail('게임 계산', `두 사람이 다 냈는데 게임이 끝나지 않는다 — ${JSON.stringify(d)}`)
    else pass('게임 입력', `자기 입력만 쓰고 모두가 읽는다 · 같은 입력으로 앱의 계산(game-core)이 발표자를 낸다 (${d.reason})`)
  }

  /* 학생은 자기 등록의 모둠 자리를 못 옮긴다 */
  let moved = false
  try {
    await sA.updateEnrollment(CID2, 'g-a', { currentGroupId: '9' })
    moved = true
  } catch { /* 막혀야 한다 */ }
  if (moved) fail('모둠 자리 잠금', '학생이 자기 등록의 currentGroupId 를 바꿨다 — 규칙이 막아야 한다')
  else pass('모둠 자리 잠금', '학생은 자기 등록의 모둠 자리를 옮기지 못한다')
}

await env.cleanup()
report('test:writes')

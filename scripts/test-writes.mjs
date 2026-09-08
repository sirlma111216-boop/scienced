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
    await studentRepo.saveDraft(CID, '01', 'step-recall', STUDENT, { scene: '초안' })
    await studentRepo.submitResponse(CID, '01', 'step-recall', STUDENT, { scene: '제출' }, {
      confidence: 3,
      changedReason: null,
    })
    const doc = await studentRepo.getResponse(CID, '01', 'step-recall', STUDENT)
    if ((doc?.versions?.length ?? 0) !== 1) {
      fail('1강 제출', `버전이 ${doc?.versions?.length ?? 0}개다 (1개여야 한다)`)
    } else {
      pass('1강 제출', '자동저장 뒤 제출까지 앱의 코드로 통과한다')
    }
  } catch (err) {
    fail('1강 제출', `막힌다 — ${err.message}`)
  }
}

/* ── ⑦ 즉석 모둠: 같은 번호를 고른 두 사람이 서로 보이는가 ── */
{
  const repo2 = createFirestoreRepo(env.authenticatedContext(STUDENT2).firestore())
  const STEP = 'step-auction'

  /* 화면과 같은 순서다. 먼저 각자 제출해야 모둠 화면이 열린다. */
  await studentRepo.submitResponse(CID, '01', STEP, STUDENT, {
    allocation: { fun: 20, evidence: 60, safety: 20 }, opinion: '증거가 남아야 수업이다',
  }, { confidence: null, changedReason: null })
  await repo2.submitResponse(CID, '01', STEP, STUDENT2, {
    allocation: { fun: 60, evidence: 20, safety: 20 }, opinion: '보고 싶어야 남는다',
  }, { confidence: null, changedReason: null })

  /* 제출 전에는 규칙이 막아야 한다 — 남의 배분을 먼저 보는 길이 없어야 한다. */
  const NOTYET = 'step-compare'
  let blocked = false
  try {
    await studentRepo.setGroupShare(CID, '01', NOTYET, {
      uid: STUDENT, nickname: '나', groupId: '1', allocation: {}, opinion: 'x', updatedAt: Date.now(),
    })
  } catch {
    blocked = true
  }
  if (!blocked) fail('즉석 모둠 관문', '제출하지 않은 단계에서도 모둠에 들어가진다')

  /* 둘 다 1모둠을 고른다. */
  await studentRepo.setGroupShare(CID, '01', STEP, {
    uid: STUDENT, nickname: '이나나나', groupId: '1',
    allocation: { fun: 20, evidence: 60, safety: 20 }, opinion: '증거가 남아야 수업이다',
    updatedAt: Date.now(),
  })
  await repo2.setGroupShare(CID, '01', STEP, {
    uid: STUDENT2, nickname: '박두두', groupId: '1',
    allocation: { fun: 60, evidence: 20, safety: 20 }, opinion: '보고 싶어야 남는다',
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
    fail('즉석 모둠', `모둠원이 ${seen.length}명 보인다 — 2명이어야 한다`)
  } else {
    /* 화면이 그리는 그 평균을 여기서도 계산해 본다. */
    const avg = (id) => Math.round(seen.reduce((s, g) => s + (g.allocation[id] || 0), 0) / seen.length)
    if (avg('fun') !== 40 || avg('evidence') !== 40) {
      fail('즉석 모둠 평균', `평균이 fun ${avg('fun')} · evidence ${avg('evidence')} 다 (둘 다 40이어야 한다)`)
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
          pass('즉석 모둠', '제출 뒤에만 열리고, 같은 번호를 고른 두 사람의 평균이 맞고, 합의 문장이 광장에 뜬다')
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
  const GAME = '01-auction'
  const repo2 = createFirestoreRepo(env.authenticatedContext(STUDENT2).firestore())

  /* 강사가 판을 연 상태를 만든다 */
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`classes/${CID}/sessions/01`).set({
      lessonId: '01',
      currentStepId: 'step-auction',
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
  const STEP = 'step-auction'
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
  const STEP = 'step-auction'

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
      /* ★ 계정은 남아야 한다. 다른 학기 수강도 그대로다. */
      kept('계정', `users/${STUDENT}`),
      /* 같은 클래스의 다른 사람 자료는 건드리지 않는다 */
      kept('다른 수강생 등록', `classes/${CID}/enrollments/${STUDENT2}`),
    ])
    if (checks.every(Boolean)) {
      pass('내보내기', '이 클래스의 등록·응답·의견·모둠 자리만 사라지고, 계정과 남은 사람은 그대로다')
    }
  })
}

await env.cleanup()
report('test:writes')

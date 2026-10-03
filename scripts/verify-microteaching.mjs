/**
 * npm run verify:microteaching (강의자 지시 2026-10-03)
 *
 *   · 일정 — 자리 수의 합이 수강 인원과 같다 (교육론 19 · 교수법 14) · 날짜 꼴 · 순서
 *   · 순수 함수 — 자리 id · 여는 때(닫힘 · 예정 · 열림) · 날짜 이름
 *   · 서버 함수 둘(apply · cancel)이 있고, 자리 생성은 「없을 때만」 조건을 걸고, 옛 자리를 같은 commit 에서 지운다
 *   · 화면은 apiPost 로만 서버를 부른다 · 보안 규칙에 mtSlots · mtApplications 가 있고 학생 쓰기는 없다
 *   · 경로 · 길잡이 · 클래스 관리 탭 · 로컬 저장소도 같은 검사를 한다
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fail, pass, report } from './_report.mjs'

const { MT_SCHEDULE, MT_ORDER_LABEL, isMtSlot, mtDateLabel, mtOpenState, mtScheduleProblems, mtSlotId, mtSlots } = await import('../shared/microteaching.ts')

/* ── 일정 ── */
{
  const probs = mtScheduleProblems()
  for (const p of probs) fail('일정', p)
  const want = { edu: [19, '2026-11-02', '2026-12-14', 7], method: [14, '2026-10-27', '2026-12-01', 6] }
  for (const [k, [total, first, last, days]] of Object.entries(want)) {
    const s = MT_SCHEDULE[k]
    if (s.total !== total) fail('일정', `${s.title} 인원 ${s.total} (기대 ${total})`)
    if (s.days[0].date !== first || s.days[s.days.length - 1].date !== last || s.days.length !== days) fail('일정', `${s.title} 날짜가 ${s.days[0].date}~${s.days[s.days.length - 1].date} ${s.days.length}일 (기대 ${first}~${last} ${days}일)`)
    if (mtSlots(k).length !== total) fail('일정', `${s.title} 자리 ${mtSlots(k).length}개`)
  }
  if (MT_SCHEDULE.edu.days.map((d) => d.count).join() !== '2,2,3,3,3,3,3') fail('일정', `교육론 인원 배열이 ${MT_SCHEDULE.edu.days.map((d) => d.count).join()}`)
  if (MT_SCHEDULE.method.days.map((d) => d.count).join() !== '2,2,2,2,3,3') fail('일정', `교수법 인원 배열이 ${MT_SCHEDULE.method.days.map((d) => d.count).join()}`)
  if (!/10분/.test(MT_SCHEDULE.edu.minutes) || !/15분.*20분/.test(MT_SCHEDULE.method.minutes)) fail('일정', '발표 시간 안내가 지시(교육론 10분 안팎 · 교수법 15~20분)와 다르다')
  if (probs.length === 0) pass('일정', '교육론 19자리(11/2~12/14 · 2·2·3·3·3·3·3) · 교수법 14자리(10/27~12/1 · 2·2·2·2·3·3)가 수강 인원과 맞는다')
}

/* ── 순수 함수 ── */
{
  let bad = 0
  const check = (label, got, want) => {
    if (got !== want) {
      bad += 1
      fail('함수', `${label}: ${JSON.stringify(got)} (기대 ${JSON.stringify(want)})`)
    }
  }
  check('자리 id', mtSlotId('2026-11-02', 1), '2026-11-02_1')
  check('있는 자리', isMtSlot('edu', '2026-11-02_2'), true)
  check('그날 인원 밖', isMtSlot('edu', '2026-11-02_3'), false)
  check('다른 과목의 날짜', isMtSlot('edu', '2026-10-27_1'), false)
  check('때를 안 정했으면 닫힘', mtOpenState(null, 100), 'closed')
  check('때가 아직이면 예정', mtOpenState(200, 100), 'scheduled')
  check('때가 지나면 열림', mtOpenState(100, 100), 'open')
  check('날짜 이름 (11월 2일은 월요일)', mtDateLabel('2026-11-02'), '11월 2일 (월)')
  check('날짜 이름 (10월 27일은 화요일)', mtDateLabel('2026-10-27'), '10월 27일 (화)')
  check('순서 이름 셋', MT_ORDER_LABEL.slice(0, 3).join('·'), '첫 번째 발표·두 번째 발표·세 번째 발표')
  if (bad === 0) pass('함수', '자리 id · 여는 때(닫힘 → 예정 → 열림) · 날짜 이름이 맞다')
}

/* ── 서버 함수 · 화면 · 규칙 ── */
{
  let bad = 0
  const must = (cond, label, msg) => {
    if (!cond) {
      bad += 1
      fail(label, msg)
    }
  }
  must(existsSync('functions/api/microteaching/apply.ts') && existsSync('functions/api/microteaching/cancel.ts'), '서버 함수', 'apply · cancel 함수 파일이 없다')
  const lib = await readFile('functions/api/_lib/microteaching.ts', 'utf8')
  must(/currentDocument: \{ exists: false \}/.test(lib), '서버 함수', '자리 생성에 「없을 때만」 조건이 없다 — 두 사람이 같은 순간 누르면 둘 다 들어간다')
  must(/writes\.push\(\{ delete:/.test(lib), '서버 함수', '옛 자리를 같은 commit 에서 지우지 않는다 — 한 사람이 두 자리를 갖게 된다')
  must(/isMtSlot\(/.test(lib), '서버 함수', '자리가 일정에 있는지 서버가 확인하지 않는다')
  must(/openAt/.test(lib) && /아직 신청 기간이 아닙니다/.test(lib), '서버 함수', '여는 때를 서버가 확인하지 않는다 — 화면만 막으면 주소로 들어와 신청한다')
  must(/roster/.test(lib), '서버 함수', '명단의 실명을 옮겨 적지 않는다')
  for (const f of ['apply', 'cancel']) {
    const src = await readFile(`functions/api/microteaching/${f}.ts`, 'utf8')
    must(/verifyIdToken/.test(src), '서버 함수', `${f} 가 토큰을 확인하지 않는다`)
  }
  const cancel = await readFile('functions/api/microteaching/cancel.ts', 'utf8')
  must(/isInstructorUid/.test(cancel), '서버 함수', '남의 신청 취소에 강사 확인이 없다')

  const fsRepo = await readFile('src/lib/repo-firestore.ts', 'utf8')
  must(/apiPost\('\/api\/microteaching\/apply'/.test(fsRepo) && /apiPost\('\/api\/microteaching\/cancel'/.test(fsRepo), '화면', 'Firestore 저장소가 apiPost 로 서버 함수를 부르지 않는다')
  must(!/mtSlots'\)[^]*setDoc/.test(fsRepo.split('watchMtSlots')[1]?.split('watchPicks')[0] ?? ''), '화면', '화면이 자리 문서를 직접 쓴다 — 쓰기는 서버 함수만')
  const local = await readFile('src/lib/repo-local.ts', 'utf8')
  for (const k of ['mtOpenState', 'isMtSlot', '방금 다른 사람이']) must(local.includes(k), '로컬 저장소', `로컬 저장소에 서버와 같은 검사(${k})가 없다`)

  const rules = await readFile('firestore.rules', 'utf8')
  const block = (name) => rules.split(`match /${name} {`)[1]?.split('match /')[0] ?? ''
  must(/allow read: if isEnrolled\(cid\) \|\| isInstructor\(\)/.test(block('mtSlots/{slotId}').replace(/\s+/g, ' ')) || /isEnrolled\(cid\) \|\| isInstructor\(\)/.test(block('mtSlots/{slotId}')), '규칙', 'mtSlots 읽기 규칙이 없다')
  must(/allow write: if isInstructor\(\)/.test(block('mtSlots/{slotId}')), '규칙', 'mtSlots 를 학생이 쓸 수 있다')
  must(/allow write: if isInstructor\(\)/.test(block('mtApplications/{userId}')), '규칙', 'mtApplications 를 학생이 쓸 수 있다')

  const app = await readFile('src/App.tsx', 'utf8')
  must(/path="\/microteaching\/apply"/.test(app) && /path="\/instructor\/class\/:classId\/microteaching"/.test(app), '경로', '학생 신청 경로나 강사 탭 경로가 없다')
  must(/lazyRoute\('마이크로티칭 신청'/.test(app), '경로', '신청 화면이 첫 번들에 들어갔다 — lazyRoute 로 둔다')
  const admin = await readFile('src/components/instructor/ClassAdmin.tsx', 'utf8')
  must(/to: 'microteaching'/.test(admin), '길잡이', '클래스 관리 탭에 마이크로티칭 신청이 없다 — 강사가 현황을 볼 자리')
  const board = await readFile('src/components/microteaching/ApplyBoard.tsx', 'utf8')
  for (const k of ['취소', '전체 일정', 'datetime-local', '아직 신청하지 않은 사람']) must(board.includes(k), '화면', `신청 판에 「${k}」가 없다`)
  must(/isMine \|\| isInstructor/.test(board), '화면', '남의 자리에 취소 단추가 보인다 (강사 빼고)')
  if (bad === 0) pass('서버 함수 · 화면 · 규칙', '서버가 자격 · 기간 · 자리 · 동시 신청을 가리고, 화면은 apiPost 로만 부르며, 학생은 자리 문서를 쓰지 못한다')
}

report('verify:microteaching')

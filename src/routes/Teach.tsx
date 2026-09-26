import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { buildSteps } from '@/content/steps'
import { indexEntry } from '@/content/courses'
import { answeredUids, attendanceEdit, attendingStudents, withAttendance } from '@/lib/attendance'
import { useAuth } from '@/lib/auth'
import { rememberTaught } from '@/lib/last-taught'
import { attendanceLessonOf, formationLessons, historyFromDocs, questionForLesson, roundForLesson } from '@/lib/groups'
import { courseOf, useLesson } from '@/lib/lesson-data'
import type { AppUser, Enrollment, GroupInput, GroupRound, PairHistoryDoc, Participation, ResponseDoc, RosterEntry, SessionState } from '@/lib/types'
import { LessonBody } from '@/components/lesson/LessonBody'
import { LessonHeader } from '@/components/lesson/LessonHeader'
import { FormationPanel } from '@/components/groups/FormationPanel'
import { MusicToggle } from '@/components/teach/MusicToggle'
import { NamesProvider, Overlay, useNames } from '@/components/teach/names'
import { TheoryProvider } from '@/components/theory/TheoryContext'
import { Button, Caption } from '@/components/ui'

/**
 * 강사 — 수업 화면 /teach/:classId/:lessonId (8차 7절). 화면 하나로 가르친다.
 *
 *   머리   ← 차시 목록 · 제목 · 단계 알약(가로 스크롤) · 실명 가리기 · 명단 n/N · 음악
 *   본문   학생 화면과 같은 블록(LessonBody)에 조작부가 인라인으로 붙는다
 *
 * ★ 수업 중에 누르는 단추는 다섯 가지뿐이다 (7.3 · verify:teach — 발표 모드는 강의자 지시로 뺐다):
 *   단계 열기 · 자료 공개 · 모둠 나누기 · 게임 시작 · 응답 펼치기(응답 n/N ▸ · 올라온 글 n ▸ · 모둠별 ▸)
 * 화면을 띄울 때 실명은 「실명 가리기」로 가린다.
 */
export function Teach() {
  const { classId = '', lessonId = '' } = useParams()
  const { repo, isInstructor, classes, selectClass } = useAuth()
  const cls = classes.find((c) => c.id === classId) ?? null
  const courseId = courseOf(cls)
  const entry = indexEntry(courseId, lessonId)
  const { lesson, loading, error } = useLesson(courseId, lessonId || null, Boolean(entry))
  const steps = useMemo(() => (lesson ? buildSteps(lesson) : []), [lesson])
  const [stepId, setStepId] = useState<string | null>(null)
  const step = steps.find((s) => s.id === stepId) ?? steps[0]

  const [session, setSession] = useState<SessionState | null>(null)
  /* 따르는 차시(교수법 2~12 짝수)의 출석은 앞 차시 문서에 있다 — 같은 날이라 출석은 하루에 하나다 */
  const [attendSession, setAttendSession] = useState<SessionState | null>(null)
  const formation = formationLessons(cls, courseId)
  const attendanceLessonId = attendanceLessonOf(lessonId, formation)
  const [users, setUsers] = useState<AppUser[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [participation, setParticipation] = useState<Participation[]>([])
  const [groupRounds, setGroupRounds] = useState<GroupRound[]>([])
  const [pairHistory, setPairHistory] = useState<PairHistoryDoc[]>([])
  const [groupInputs, setGroupInputs] = useState<GroupInput[]>([])
  const [docs, setDocs] = useState<ResponseDoc[]>([])
  const [hideNames, setHideNames] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [formationOpen, setFormationOpen] = useState(false)

  useEffect(() => {
    if (classId) void selectClass(classId)
  }, [classId, selectClass])

  /* 강사 홈의 「이어서 할 차시」 — 이 브라우저에만 남는다 */
  useEffect(() => {
    if (classId && lessonId) rememberTaught(classId, lessonId)
  }, [classId, lessonId])

  useEffect(() => {
    if (!repo || !classId || !lessonId) return
    const offs = [
      repo.watchSession(classId, lessonId, setSession),
      repo.watchUsers(setUsers),
      repo.watchEnrollments(classId, setEnrollments),
      repo.watchRoster(classId, setRoster),
      repo.watchParticipation(classId, setParticipation),
      repo.watchGroupRounds(classId, setGroupRounds),
      repo.watchPairHistory(classId, setPairHistory),
      repo.watchGroupInputs(classId, attendanceLessonId, setGroupInputs),
    ]
    return () => offs.forEach((off) => off())
  }, [repo, classId, lessonId, attendanceLessonId])

  /* 출석을 다른 차시에서 읽어야 하면 그 차시의 진행 문서도 본다 */
  useEffect(() => {
    if (!repo || !classId || attendanceLessonId === lessonId) {
      setAttendSession(null)
      return
    }
    return repo.watchSession(classId, attendanceLessonId, setAttendSession)
  }, [repo, classId, lessonId, attendanceLessonId])

  useEffect(() => {
    if (!repo || !classId || !lessonId || !step) return
    return repo.watchAllResponses(classId, lessonId, step.id, setDocs)
  }, [repo, classId, lessonId, step])

  /* 강사가 보고 있는 단계 — 학생 화면의 알약에 ● 로 보인다 */
  useEffect(() => {
    if (!repo || !classId || !lessonId || !step) return
    if (session && session.instructorAt === step.id) return
    void repo.setSession(classId, lessonId, { instructorAt: step.id }).catch((err) => console.warn('[수업] 위치를 적지 못했다:', err))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, classId, lessonId, step?.id])

  const enrolled = useMemo(() => enrollments.filter((e) => e.status === 'active'), [enrollments])
  /**
   * 오늘의 기준은 출석한 사람이다 — 「오늘의 질문」에 답한 사람 (강의자 지시 2026-09-22).
   * 아래 화면 전부(응답 n/N · 게임 참가 · 발표자 뽑기 · 모둠)가 이 목록을 분모로 쓴다.
   * 따르는 차시는 같은 날 앞 차시의 출석을 그대로 읽고 쓴다 — 그 차시에는 질문이 없다 (강의자 지시 2026-09-26).
   */
  const attendanceSource = attendanceLessonId === lessonId ? session : attendSession
  const attendEdit = useMemo(() => attendanceEdit(attendanceSource?.attendance), [attendanceSource?.attendance])
  const students = useMemo(() => attendingStudents(enrolled, groupInputs, attendEdit), [enrolled, groupInputs, attendEdit])
  const answered = useMemo(() => answeredUids(groupInputs), [groupInputs])
  const setAttending = useCallback(
    async (uid: string, attending: boolean) => {
      if (!repo) return
      try {
        await repo.setSession(classId, attendanceLessonId, { attendance: withAttendance(attendEdit, uid, answered.has(uid), attending) })
      } catch (err) {
        console.error('[출석] 고치지 못했다:', err)
      }
    },
    [repo, classId, attendanceLessonId, attendEdit, answered],
  )
  const openSteps = useMemo(() => session?.openSteps ?? [], [session?.openSteps])
  const toggleStep = useCallback(
    async (sid: string) => {
      if (!repo) return
      const next = openSteps.includes(sid) ? openSteps.filter((x) => x !== sid) : [...openSteps, sid]
      try {
        await repo.setSession(classId, lessonId, { openSteps: next, currentStepId: sid, stepOpen: next.includes(sid) })
      } catch (err) {
        console.error('[수업] 단계를 열지 못했다:', err)
      }
    },
    [repo, classId, lessonId, openSteps],
  )
  const onReveal = useCallback(
    async (gateId: string, open: boolean) => {
      if (!repo) return
      const cur = session?.revealed ?? []
      const next = open ? [...new Set([...cur, gateId])] : cur.filter((x) => x !== gateId)
      try {
        await repo.setSession(classId, lessonId, { revealed: next })
      } catch (err) {
        console.error('[수업] 자료를 공개하지 못했다:', err)
      }
    },
    [repo, classId, lessonId, session?.revealed],
  )

  if (!isInstructor) return <Navigate to="/" replace />
  if (!classId || !lessonId) return <Navigate to="/instructor/classes" replace />
  if (!entry) return <Navigate to="/instructor/classes" replace />

  const isFormationLesson = formation.includes(lessonId)
  const activeRound = roundForLesson(lessonId, groupRounds, formation)
  const question = questionForLesson(cls, lessonId)
  const tally = question.options.map((o) => ({ option: o, count: groupInputs.filter((i) => i.questionId === question.id && i.choice === o).length }))
  const nicknames = Object.fromEntries([...users.map((u) => [u.uid, u.nickname || '이름 없음']), ...enrollments.filter((e) => e.nickname).map((e) => [e.uid, e.nickname])]) as Record<string, string>
  const submittedCount = docs.filter((d) => (d.latestV ?? 0) > 0).length

  return (
    <NamesProvider users={users} enrollments={enrollments} roster={roster} hideNames={hideNames}>
      <TheoryProvider value={{ entries: lesson?.theory?.entries ?? [] }}>
        <div className="min-h-screen bg-canvas text-ink flex flex-col">
          <header className="sticky top-0 z-10 bg-canvas no-print" style={{ boxShadow: 'inset 0 -1px 0 #e6e6e6' }}>
            <div className="shell flex flex-wrap items-center gap-xs" style={{ minHeight: 56, paddingTop: 6, paddingBottom: 6 }}>
              <Link to="/instructor/classes" className="btn-tertiary" style={{ paddingLeft: 0 }}>
                ← 차시 목록
              </Link>
              <span className="text-body-sm" style={{ fontWeight: 540 }}>
                {Number(lessonId)}강 {entry.title}
              </span>
              <Caption>{cls?.displayName ?? classId}</Caption>
              <span className="flex-1" />
              <label className="text-body-sm flex items-center gap-xxs">
                <input type="checkbox" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} /> 실명 가리기
              </label>
              <button type="button" className="tab" aria-expanded={rosterOpen} onClick={() => setRosterOpen(true)}>
                명단 · 출석 {students.length}/{enrolled.length}
              </button>
              <MusicToggle />
            </div>
            {steps.length > 0 ? (
              <div className="shell no-print" style={{ paddingBottom: 8 }}>
                <ol role="tablist" aria-label="수업 단계" className="step-tabs" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
                  {steps.map((s, i) => {
                    const selected = s.id === step?.id
                    const opened = openSteps.includes(s.id)
                    return (
                      <li key={s.id} role="presentation">
                        <button type="button" role="tab" id={`step-tab-${s.id}`} aria-selected={selected} aria-controls={`step-panel-${s.id}`} tabIndex={selected ? 0 : -1} className="tab-step" onClick={() => setStepId(s.id)} aria-label={`${i + 1}단계 ${s.title}${opened ? ' · 열림' : ''}`} title={s.title}>
                          <span className="step-meta" aria-hidden="true">
                            {String(i + 1).padStart(2, '0')}
                            {opened ? ' ✓' : ''}
                          </span>
                          <span className="step-name step-name-short" aria-hidden="true">
                            {s.shortTitle}
                          </span>
                          <span className="step-name step-name-full" aria-hidden="true">
                            {s.title}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>
            ) : null}
          </header>

          <main id="main" className="flex-1 shell" style={{ paddingTop: 24, paddingBottom: 96 }}>
            {loading ? <p className="text-body">불러오는 중…</p> : null}
            {error ? <p className="text-body" role="alert">{error}</p> : null}
            {lesson && step ? (
              <div role="tabpanel" id={`step-panel-${step.id}`} aria-labelledby={`step-tab-${step.id}`}>
                {/* 차시 머리 — 학생과 같은 부품 */}
                {step.kind === 'intro' ? <LessonHeader lesson={lesson} /> : null}

                {/* 단계 머리 — 단계 열기. 모둠 나누기는 본문의 오늘의 질문 블록 옆에 있다 */}
                <div className="flex items-center gap-xs no-print" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
                  <h2 className="text-headline" style={{ margin: 0 }}>
                    {step.title}
                  </h2>
                  {step.fields.length > 0 ? (
                    <Button variant={openSteps.includes(step.id) ? 'primary' : 'secondary'} aria-pressed={openSteps.includes(step.id)} onClick={() => void toggleStep(step.id)}>
                      단계 열기
                    </Button>
                  ) : null}
                  {step.fields.length > 0 ? <Caption>{openSteps.includes(step.id) ? '학생이 쓸 수 있다' : '누르면 이 단계의 칸이 열린다'}</Caption> : null}
                </div>
                <p className="text-body-sm no-print" style={{ margin: '0 0 16px', opacity: 0.72 }}>
                  아래는 학생 화면 그대로다. 잠긴 것은 학생에게도 잠겨 있다. 단추와 「… ▸」 접기만 강사에게 보인다.
                </p>

                <LessonBody
                  classId={classId}
                  courseId={courseId}
                  lesson={lesson}
                  step={step}
                  session={session}
                  round={activeRound}
                  groupRounds={groupRounds}
                  formationLesson={isFormationLesson} formationList={formation}
                  question={question}
                  nicknames={nicknames}
                  tally={tally}
                  teacher={{ students, participation, docs, inputs: groupInputs, enrolled: enrolled.length, onReveal, onFormation: () => setFormationOpen(true), nameOf: (uid) => nicknames[uid] ?? '이름 없음' }}
                />
              </div>
            ) : null}
          </main>

          {rosterOpen ? (
            <Overlay title={`명단 · 출석 ${students.length}/${enrolled.length} · 이 단계 제출 ${submittedCount}/${students.length}`} onClose={() => setRosterOpen(false)}>
              <RosterList enrolled={enrolled} attending={students} answered={answered} docs={docs} onAttending={setAttending} />
            </Overlay>
          ) : null}
          {formationOpen && cls ? (
            <Overlay title="모둠 나누기" onClose={() => setFormationOpen(false)} wide>
              <FormationPanel classId={classId} lessonId={lessonId} cls={cls} students={enrolled} hist={historyFromDocs(pairHistory)} rounds={groupRounds} />
            </Overlay>
          ) : null}
        </div>
      </TheoryProvider>
    </NamesProvider>
  )
}

/**
 * 명단 서랍 — 오늘 온 사람과 이 단계의 제출 여부.
 *
 * 출석은 학생이 「오늘의 질문」에 답하면 저절로 켜진다. 여기 체크 상자는 그 기준을 고치는 자리다 —
 * 기기가 안 되는 사람을 넣고, 자리에 없는 사람을 뺀다. 수업 흐름을 여는 단추가 아니다.
 * 실명은 NamesProvider 가 정한 대로만 나간다 (실명 가리기면 닉네임).
 */
function RosterList({
  enrolled,
  attending,
  answered,
  docs,
  onAttending,
}: {
  enrolled: Enrollment[]
  attending: Enrollment[]
  answered: Set<string>
  docs: ResponseDoc[]
  onAttending: (uid: string, attending: boolean) => Promise<void>
}) {
  const { nameOf } = useNames()
  const done = new Set(docs.filter((d) => (d.latestV ?? 0) > 0).map((d) => d.uid))
  const here = new Set(attending.map((s) => s.uid))
  const rows = [...enrolled].sort((a, b) => Number(here.has(b.uid)) - Number(here.has(a.uid)))
  return (
    <>
      <p className="text-body-sm" style={{ margin: '0 0 12px' }}>
        오늘의 질문에 답한 사람이 출석입니다. 못 누른 사람은 체크해서 넣고, 자리에 없는 사람은 체크를 풉니다. 아래 ✓ 는 이 단계의 제출입니다.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 6 }}>
        {rows.map((s) => {
          const present = here.has(s.uid)
          return (
            <li key={s.uid}>
              <label
                className="text-body-sm flex items-center gap-xxs rounded-md"
                style={{ padding: '6px 10px', boxShadow: `inset 0 0 0 1px ${present ? '#111' : '#e6e6e6'}`, background: done.has(s.uid) ? '#eaf4ec' : '#fff', opacity: present ? 1 : 0.6 }}
              >
                <input type="checkbox" checked={present} aria-label={`${nameOf(s.uid)} 출석`} onChange={(e) => void onAttending(s.uid, e.target.checked)} />
                <span style={{ flex: 1 }}>{nameOf(s.uid)}</span>
                {answered.has(s.uid) ? <span className="caption">답함</span> : null}
                {done.has(s.uid) ? <span aria-label="제출함">✓</span> : null}
              </label>
            </li>
          )
        })}
      </ul>
    </>
  )
}

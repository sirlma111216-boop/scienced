import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { buildSteps } from '@/content/steps'
import { indexEntry } from '@/content/courses'
import { useAuth } from '@/lib/auth'
import { formationLessons, historyFromDocs, questionForLesson, roundForLesson } from '@/lib/groups'
import { courseOf, useLesson } from '@/lib/lesson-data'
import type { AppUser, Enrollment, GroupInput, GroupRound, PairHistoryDoc, Participation, ResponseDoc, RosterEntry, SessionState } from '@/lib/types'
import { LessonBody } from '@/components/lesson/LessonBody'
import { FormationPanel } from '@/components/groups/FormationPanel'
import { MusicToggle } from '@/components/teach/MusicToggle'
import { NamesProvider, Overlay, useNames } from '@/components/teach/names'
import { Rich } from '@/components/theory/Rich'
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
      repo.watchGroupInputs(classId, lessonId, setGroupInputs),
    ]
    return () => offs.forEach((off) => off())
  }, [repo, classId, lessonId])

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

  const students = useMemo(() => enrollments.filter((e) => e.status === 'active'), [enrollments])
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

  const isFormationLesson = formationLessons(cls, courseId).includes(lessonId)
  const roundHere = groupRounds.find((r) => r.lessonId === lessonId) ?? null
  const activeRound = roundForLesson(lessonId, groupRounds)
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
                명단 {submittedCount}/{students.length}
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
                {step.kind === 'intro' ? (
                  <section style={{ marginBottom: 24 }}>
                    <h1 className="text-display-lg" style={{ margin: 0 }}>
                      {lesson.title}
                    </h1>
                    <p className="text-subhead" style={{ marginTop: 12, maxWidth: 760 }}>
                      {lesson.centralQuestion}
                    </p>
                    <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                      {lesson.objectives.map((o, i) => (
                        <li key={i} className="text-body-sm">
                          <Rich text={o} />
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}

                {/* 단계 머리 — 단계 열기 · (도입) 모둠 나누기 */}
                <div className="flex items-center gap-xs no-print" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
                  <h2 className="text-headline" style={{ margin: 0 }}>
                    {step.title}
                  </h2>
                  {step.fields.length > 0 ? (
                    <Button variant={openSteps.includes(step.id) ? 'primary' : 'secondary'} aria-pressed={openSteps.includes(step.id)} onClick={() => void toggleStep(step.id)}>
                      단계 열기
                    </Button>
                  ) : null}
                  {step.fields.length > 0 ? <Caption>{openSteps.includes(step.id) ? '학생이 쓸 수 있다' : '누르면 이 단계의 칸이 열린다'}</Caption> : null}
                  {step.kind === 'intro' && isFormationLesson ? (
                    <Button variant="secondary" onClick={() => setFormationOpen(true)}>
                      모둠 나누기
                    </Button>
                  ) : null}
                  {step.kind === 'intro' && isFormationLesson ? <Caption>{roundHere ? `확정됨 · 모둠 ${roundHere.groups.length}` : `질문 답 ${groupInputs.filter((i) => i.questionId === question.id).length}/${students.length}`}</Caption> : null}
                  {step.activity ? <Caption>{step.activity.task}</Caption> : null}
                </div>

                <LessonBody classId={classId} courseId={courseId} lesson={lesson} step={step} session={session} round={activeRound} nicknames={nicknames} tally={tally} teacher={{ students, participation, docs, onReveal, nameOf: (uid) => nicknames[uid] ?? '이름 없음' }} />
              </div>
            ) : null}
          </main>

          {rosterOpen ? (
            <Overlay title={`명단 · 제출 ${submittedCount}/${students.length}`} onClose={() => setRosterOpen(false)}>
              <RosterList students={students} docs={docs} />
            </Overlay>
          ) : null}
          {formationOpen && cls ? (
            <Overlay title="모둠 나누기" onClose={() => setFormationOpen(false)} wide>
              <FormationPanel classId={classId} lessonId={lessonId} cls={cls} students={students} hist={historyFromDocs(pairHistory)} rounds={groupRounds} />
            </Overlay>
          ) : null}
        </div>
      </TheoryProvider>
    </NamesProvider>
  )
}

/** 명단 서랍 — 이 단계의 제출 여부. 실명은 NamesProvider 가 정한 대로만 (실명 가리기면 닉네임) */
function RosterList({ students, docs }: { students: Enrollment[]; docs: ResponseDoc[] }) {
  const { nameOf } = useNames()
  const done = new Set(docs.filter((d) => (d.latestV ?? 0) > 0).map((d) => d.uid))
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
      {students.map((s) => (
        <li key={s.uid} className="text-body-sm rounded-md" style={{ padding: '6px 10px', boxShadow: 'inset 0 0 0 1px #e6e6e6', background: done.has(s.uid) ? '#eaf4ec' : '#fff' }}>
          {done.has(s.uid) ? '✓ ' : '· '}
          {nameOf(s.uid)}
        </li>
      ))}
    </ul>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { buildSteps } from '@/content/steps'
import type { LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { formationLessons, questionForLesson, roundForLesson } from '@/lib/groups'
import { courseOf, useLesson } from '@/lib/lesson-data'
import type { AppUser, Enrollment, GroupRound, SessionState } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { LessonBody } from '@/components/lesson/LessonBody'
import { FormationQuestionView } from '@/components/formation/FormationQuestion'
import { Rich } from '@/components/theory/Rich'
import { TheoryProvider } from '@/components/theory/TheoryContext'
import { Button, Caption, ColorBlock } from '@/components/ui'

/**
 * 학생 — 차시 화면 (8차).
 *
 * 차시 머리는 제목·중심 질문·학습목표 셋뿐이다 (원칙 11). 단계는 도입 → 개념 → 활동 → 정리.
 * 내용은 공개된 차시일 때만 import() 로 내려온다 (부록 ①). 강사가 단계를 열기 전에는 쓰는 칸이 잠겨 있다.
 * 모둠을 새로 나누는 차시면 도입 단계 위에 아이스브레이킹 질문이 온다 (5절).
 */
export function Lesson() {
  const { id } = useParams()
  const { repo, user, isInstructor, classId, currentClass } = useAuth()
  const courseId = courseOf(currentClass)
  const [published, setPublished] = useState<LessonId[] | null>(null)
  const [session, setSession] = useState<SessionState | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [groupRounds, setGroupRounds] = useState<GroupRound[]>([])
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!repo || !classId) return
    return repo.watchLessonState(classId, setPublished)
  }, [repo, classId])

  const open = Boolean(id) && (isInstructor || (published?.includes(id!) ?? false))
  const { lesson, loading, error } = useLesson(courseId, id ?? null, open)
  const steps = useMemo(() => (lesson ? buildSteps(lesson) : []), [lesson])
  const step = steps[stepIndex]

  useEffect(() => {
    if (!repo || !classId || !id || !open) return
    const offs = [repo.watchSession(classId, id, setSession), repo.watchUsers(setUsers), repo.watchEnrollments(classId, setEnrollments), repo.watchGroupRounds(classId, setGroupRounds)]
    return () => offs.forEach((off) => off())
  }, [repo, classId, id, open])

  const nicknames = useMemo(
    () => Object.fromEntries([...users.map((u) => [u.uid, u.nickname || '이름 없음']), ...enrollments.filter((e) => e.nickname).map((e) => [e.uid, e.nickname])]) as Record<string, string>,
    [users, enrollments],
  )

  if (!id) return <Navigate to="/" replace />
  if (published === null || (open && loading)) {
    return (
      <AppShell>
        <p className="text-body">불러오는 중…</p>
      </AppShell>
    )
  }
  if (!open) {
    return (
      <AppShell>
        <ColorBlock tone="cream">
          <p className="eyebrow">아직 열리지 않았다</p>
          <p className="text-subhead" style={{ marginTop: 12 }}>
            이 차시는 아직 공개되지 않았다. 강사가 열면 학기 홈에 나타난다.
          </p>
        </ColorBlock>
      </AppShell>
    )
  }
  if (!lesson || !step) {
    return (
      <AppShell>
        <ColorBlock tone="cream">
          <p className="text-subhead" style={{ margin: 0 }}>
            {error ?? '그 차시가 없다.'}
          </p>
        </ColorBlock>
      </AppShell>
    )
  }

  const isFormationLesson = formationLessons(currentClass, courseId).includes(lesson.id)
  const roundHere = groupRounds.find((r) => r.lessonId === lesson.id) ?? null
  const activeRound = roundForLesson(lesson.id, groupRounds)
  const question = questionForLesson(currentClass, lesson.id)
  const navItems = steps.map((s) => ({ id: s.id, label: s.title, shortLabel: s.shortTitle, instructorHere: session?.instructorAt === s.id, done: (session?.openSteps ?? []).includes(s.id) }))

  return (
    <TheoryProvider value={{ entries: lesson.theory?.entries ?? [] }}>
      <AppShell
        title={`${Number(lesson.id)}강 ${lesson.title}`}
        steps={navItems}
        activeStepId={step.id}
        onSelectStep={(sid) => {
          const i = steps.findIndex((s) => s.id === sid)
          if (i >= 0) setStepIndex(i)
        }}
      >
        {stepIndex === 0 ? (
          <section style={{ marginBottom: 40 }}>
            <p className="eyebrow">{Number(lesson.id)}강</p>
            <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
              {lesson.title}
            </h1>
            <p className="text-subhead" style={{ marginTop: 24, maxWidth: 760 }}>
              {lesson.centralQuestion}
            </p>
            <div style={{ marginTop: 24 }}>
              <Caption>학습목표</Caption>
              <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                {lesson.objectives.map((o, i) => (
                  <li key={i} className="text-body" style={{ marginBottom: 6 }}>
                    <Rich text={o} />
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : null}

        {/* 오늘의 질문은 매 차시 뜬다 — 답하면 그날 출석이다 (강의자 지시 2026-09-22) */}
        {stepIndex === 0 && classId ? <FormationQuestionView classId={classId} lessonId={lesson.id} question={question} forGroups={isFormationLesson} round={isFormationLesson ? roundHere : null} rounds={groupRounds} nicknames={nicknames} /> : null}

        {activeRound && user ? (
          (() => {
            const g = activeRound.groups.find((x) => x.memberUids.includes(user.uid))
            return g ? (
              <p className="flex items-center gap-xs text-body-sm" style={{ margin: '0 0 16px', flexWrap: 'wrap' }}>
                <span className="text-card-title" style={{ padding: '2px 14px', borderRadius: 999, background: '#111', color: '#fff', lineHeight: 1.5 }}>
                  {g.name}
                </span>
                <span>{g.memberUids.map((u) => nicknames[u] ?? '이름 없음').join(' · ')}</span>
              </p>
            ) : null
          })()
        ) : null}

        <h2 className="text-headline" style={{ margin: '0 0 16px' }}>
          {step.title}
        </h2>

        <LessonBody classId={classId!} courseId={courseId} lesson={lesson} step={step} session={session} round={activeRound} nicknames={nicknames} />

        <nav className="flex items-center gap-md no-print" style={{ marginTop: 48, paddingTop: 24, boxShadow: 'inset 0 1px 0 #f1f1f1' }}>
          <Button variant="secondary" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
            이전 단계
          </Button>
          <span className="flex-1" />
          <Caption>
            {stepIndex + 1} / {steps.length}
          </Caption>
          <span className="flex-1" />
          <Button disabled={stepIndex === steps.length - 1} onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}>
            다음 단계
          </Button>
        </nav>
      </AppShell>
    </TheoryProvider>
  )
}

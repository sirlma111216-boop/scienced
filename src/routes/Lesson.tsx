import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getLesson } from '@/content/lessons'
import { GAMES_BY_LESSON } from '@/content/games'
import type { LessonId, Step } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { weightFromPresentCount } from '@/lib/ladder'
import { lessonView } from '@/lib/console-registry'
import type { AppUser, LadderState, Participation, ResponseDoc, SessionState } from '@/lib/types'
import { AppShell, InstructorMovedBanner } from '@/components/layout/AppShell'
import { AiAssistPanel } from '@/components/ai/AiAssistPanel'
import { ConceptCard } from '@/components/concept/ConceptCard'
import { LadderGame } from '@/components/activity/LadderGame'
import { LumiStudent } from '@/components/lumi/LumiStudent'
import { isLumiGame } from '@/lib/lumi'
import { GroupPanel } from '@/components/activity/GroupPanel'
import { LockedCard, StimulusView } from '@/components/stimulus/StimulusView'
import { ModuleHost } from '@/components/activity/ModuleHost'
import { DistributionView } from '@/components/response/DistributionView'
import { ResponseCollector } from '@/components/response/ResponseCollector'
import { ShareBar } from '@/components/wall/Wall'
import { Rich } from '@/components/theory/Rich'
import { TheoryPage } from '@/components/theory/TheoryPage'
import { TheoryProvider } from '@/components/theory/TheoryContext'
import { GroupGame } from '@/components/groups/GroupGame'
import { formationLessons, gameForLesson, roundForLesson } from '@/lib/groups'
import type { Enrollment, GroupRound } from '@/lib/types'
import { Button, Caption, ColorBlock, Notice } from '@/components/ui'

/**
 * 차시 진행 화면 — 8차 A 과도기 판.
 *
 * 차시 머리는 제목·중심 질문·학습목표 셋뿐이다 (8차 원칙 11).
 * 판(tier)·「수업 후 이어서」·강사 알림 카드·타임라인·학생 발화 인용은 없다.
 * 강사가 단계를 옮겨도 학생 화면을 강제로 이동시키지 않는다. 안내와 이동 버튼만 띄운다.
 */
export function Lesson() {
  const { id } = useParams()
  const { repo, user, isInstructor, classId, currentClass } = useAuth()
  const lesson = getLesson(id ?? '')
  const [stepIndex, setStepIndex] = useState(0)
  const [session, setSession] = useState<SessionState | null>(null)
  const [published, setPublished] = useState<LessonId[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [dismissedAt, setDismissedAt] = useState<string | null>(null)
  const [allDocs, setAllDocs] = useState<ResponseDoc[]>([])
  const [participation, setParticipation] = useState<Participation[]>([])
  const [groupRounds, setGroupRounds] = useState<GroupRound[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [showTheory, setShowTheory] = useState(false)
  const [focusEntryId, setFocusEntryId] = useState<string | null>(null)

  const views = useMemo(() => (lesson ? lessonView(lesson) : []), [lesson])
  const stepView = views[stepIndex]
  const step: Step | undefined = stepView?.step

  useEffect(() => {
    if (!repo || !classId) return
    return repo.watchLessonState(classId, setPublished)
  }, [repo, classId])

  useEffect(() => {
    if (!repo || !lesson || !classId) return
    return repo.watchSession(classId, lesson.id, setSession)
  }, [repo, lesson, classId])

  useEffect(() => {
    if (!repo || !classId) return
    const offs = [
      repo.watchUsers(setUsers),
      repo.watchParticipation(classId, setParticipation),
      repo.watchGroupRounds(classId, setGroupRounds),
      repo.watchEnrollments(classId, setEnrollments),
    ]
    return () => offs.forEach((off) => off())
  }, [repo, classId])

  useEffect(() => {
    if (!repo || !lesson || !step || !classId || !isInstructor) return
    return repo.watchAllResponses(classId, lesson.id, step.id, setAllDocs)
  }, [repo, lesson, step, classId, isInstructor])

  const nicknames = useMemo(
    () =>
      Object.fromEntries([
        ...users.map((u) => [u.uid, u.nickname || '이름 없음']),
        ...enrollments.filter((e) => e.nickname).map((e) => [e.uid, e.nickname]),
      ]) as Record<string, string>,
    [users, enrollments],
  )

  const weights = useMemo(
    () =>
      Object.fromEntries(
        users
          .filter((u) => u.role === 'student')
          .map((u) => [u.uid, weightFromPresentCount(participation.find((p) => p.uid === u.uid)?.presentCount ?? 0)]),
      ),
    [users, participation],
  )

  if (!lesson) return <Navigate to="/" replace />

  const open = published.includes(lesson.id) || isInstructor
  if (!open) {
    return (
      <AppShell>
        <ColorBlock tone="cream">
          <p className="eyebrow">아직 열리지 않았습니다</p>
          <p className="text-subhead" style={{ marginTop: 12 }}>
            이 차시는 아직 공개되지 않았습니다. 강사가 열면 학기 홈에 나타납니다.
          </p>
        </ColorBlock>
      </AppShell>
    )
  }

  const navItems = [
    ...views.map((s) => ({
      id: s.step.id,
      label: s.step.title,
      shortLabel: s.step.shortTitle,
      instructorHere: session?.instructorAt === s.step.id,
    })),
    { id: 'theory', label: '이론 배경', shortLabel: '이론 배경', fixed: true },
  ]
  const theoryEntries = lesson.theory?.entries ?? []
  const isFormationLesson = formationLessons(currentClass).includes(lesson.id)
  const groupGame = isFormationLesson ? gameForLesson(lesson.id) : null
  const roundHere = groupRounds.find((r) => r.lessonId === lesson.id) ?? null
  const activeRound = roundForLesson(lesson.id, groupRounds)
  const myGroup = user ? (activeRound?.groups.find((g) => g.memberUids.includes(user.uid)) ?? null) : null
  function openEntry(entryId: string) {
    setFocusEntryId(entryId)
    setShowTheory(true)
  }

  const instructorStep = views.find((s) => s.step.id === session?.instructorAt)?.step
  const showMoved = instructorStep && instructorStep.id !== step?.id && dismissedAt !== instructorStep.id

  const revealed = session?.revealed ?? []
  function isOpen(gate: { type: string; of: string }): boolean {
    if (gate.type === 'afterSubmit') return true
    return revealed.includes(gate.of)
  }

  const splitWork = (stepView?.material.length ?? 0) > 0 && (stepView?.fields.length ?? 0) > 0
  const game = GAMES_BY_LESSON[lesson.id]
  const ladder: LadderState | null = game ? (session?.ladders?.[game.id] ?? null) : null

  return (
    <TheoryProvider value={{ entries: theoryEntries, openEntry }}>
      <AppShell
        title={`${lesson.id}강 ${lesson.title}`}
        steps={navItems}
        activeStepId={showTheory ? 'theory' : step?.id}
        onSelectStep={(sid) => {
          if (sid === 'theory') {
            setShowTheory(true)
            return
          }
          setShowTheory(false)
          setFocusEntryId(null)
          const i = views.findIndex((s) => s.step.id === sid)
          if (i >= 0) setStepIndex(i)
        }}
      >
        {showTheory ? <TheoryPage lesson={lesson} focusEntryId={focusEntryId} isInstructor={isInstructor} /> : null}

        {showMoved && instructorStep ? (
          <InstructorMovedBanner
            label={instructorStep.title}
            onGo={() => {
              const i = views.findIndex((s) => s.step.id === instructorStep.id)
              if (i >= 0) setStepIndex(i)
            }}
            onDismiss={() => setDismissedAt(instructorStep.id)}
          />
        ) : null}

        {!showTheory && stepIndex === 0 && groupGame && classId ? (
          <GroupGame classId={classId} lessonId={lesson.id} game={groupGame} round={roundHere} rounds={groupRounds} nicknames={nicknames} />
        ) : null}

        {/* 차시 머리 — 제목 · 중심 질문 · 학습목표 셋뿐 */}
        {!showTheory && stepIndex === 0 ? (
          <section style={{ marginBottom: 48 }}>
            <p className="eyebrow">{lesson.id}강</p>
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

        {!showTheory && step && stepView ? (
          <>
            <section>
              {myGroup && activeRound ? (
                <p className="flex items-center gap-xs text-body-sm" style={{ margin: '0 0 12px', flexWrap: 'wrap' }}>
                  <span className="text-card-title" style={{ padding: '2px 14px', borderRadius: 999, background: '#111', color: '#fff', lineHeight: 1.5 }}>
                    {myGroup.id}모둠
                  </span>
                  <span>
                    <strong>{myGroup.name}</strong> · {myGroup.memberUids.map((u) => nicknames[u] ?? '이름 없음').join(' · ')}
                  </span>
                </p>
              ) : null}
              <h2 className="text-headline" style={{ margin: '0 0 8px' }}>
                {step.title}
              </h2>
              {step.doNow ? (
                <div className="rounded-md" style={{ padding: '14px 18px', margin: '0 0 16px', boxShadow: 'inset 0 0 0 2px #000' }}>
                  <Caption>지금 할 일</Caption>
                  <p className="text-body-lg" style={{ margin: '6px 0 0', fontWeight: 480 }}>
                    {step.doNow}
                  </p>
                </div>
              ) : null}

              <p className="text-body-lg" style={{ whiteSpace: 'pre-line', marginTop: 0 }}>
                {step.lead}
              </p>

              {step.type === 'concepts' ? (
                <div className="flex flex-col" style={{ gap: 64, marginTop: 40 }}>
                  {stepView.concepts.map((concept, i) => (
                    <ConceptCard key={concept.id} concept={concept} index={i} />
                  ))}
                </div>
              ) : null}

              <div className={splitWork ? 'split-work' : undefined}>
                <div className={splitWork ? 'split-source' : undefined}>
                  {stepView.material.map((m) =>
                    m.gate && !isOpen(m.gate) ? (
                      <LockedCard key={m.id} title={m.title} message={m.gate.lockedMessage} />
                    ) : (
                      <StimulusView key={m.id} stimulus={m} />
                    ),
                  )}
                </div>

                <div className={splitWork ? 'split-input' : undefined}>
                  {stepView.fields.length > 0 || step.moduleComponent ? (
                    <div style={{ marginTop: 32 }}>
                      <ResponseCollector
                        classId={classId!}
                        lessonId={lesson.id}
                        step={step}
                        isGateOpen={isOpen}
                        renderModule={
                          step.moduleComponent
                            ? (value, onChange, locked) => (
                                <ModuleHost kind={step.moduleComponent!} lessonId={lesson.id} value={value} onChange={onChange} locked={locked} />
                              )
                            : undefined
                        }
                      >
                        {(submitted, doc) => (
                          <>
                            {submitted ? (
                              <div className="flex flex-col gap-xl" style={{ marginTop: 32 }}>
                                {stepView.fields.find((f) => f.kind === 'choice') ? (
                                  isInstructor ? (
                                    <DistributionView
                                      docs={allDocs}
                                      field={stepView.fields.find((f) => f.kind === 'choice')!}
                                      reasonKey={stepView.fields.find((f) => /reason/i.test(f.key))?.key}
                                    />
                                  ) : (
                                    <p className="text-body-sm" style={{ opacity: 0.7, margin: 0 }}>
                                      반 전체 분포는 강사 화면에서 함께 봅니다. 다른 사람 생각은 아래 의견 광장에서 읽습니다.
                                    </p>
                                  )
                                ) : null}
                                {step.aiTasks.includes('recall-probe') ? <AiAssistPanel taskId="recall-probe" inputs={{ context: step.title }} /> : null}
                                {step.aiTasks.includes('wrapup-self-check') ? <AiAssistPanel taskId="wrapup-self-check" inputs={{ context: step.title }} /> : null}
                              </div>
                            ) : null}

                            {step.groupBuild && submitted ? (
                              <div style={{ marginTop: 32 }}>
                                <GroupPanel
                                  classId={classId!}
                                  lessonId={lesson.id}
                                  step={step}
                                  config={step.groupBuild}
                                  myValues={doc?.versions?.[doc.versions.length - 1]?.payload ?? null}
                                  assigned={myGroup ? { id: myGroup.id, name: myGroup.name } : null}
                                  roundLessonId={activeRound?.lessonId ?? null}
                                />
                              </div>
                            ) : null}

                            {step.wall?.enabled ? (
                              <div style={{ marginTop: 32 }}>
                                <ShareBar
                                  classId={classId!}
                                  lessonId={lesson.id}
                                  stepId={step.id}
                                  prompt={step.wall.prompt}
                                  unlocked={submitted || !step.wall.opensAfterSubmit}
                                  fields={stepView.fields}
                                />
                              </div>
                            ) : null}
                          </>
                        )}
                      </ResponseCollector>
                    </div>
                  ) : null}
                </div>
              </div>

              {step.picker?.enabled && game && isLumiGame(game) && classId ? (
                <div style={{ marginTop: 48 }}>
                  <LumiStudent classId={classId} lessonId={lesson.id} game={game} session={session} nicknames={nicknames} />
                </div>
              ) : step.picker?.enabled && game ? (
                <div style={{ marginTop: 48 }}>
                  <LadderGame classId={classId!} lessonId={lesson.id} game={game} state={ladder} nicknames={nicknames} weights={game.revealWeights ? weights : undefined} />
                </div>
              ) : null}
            </section>

            <nav className="flex items-center gap-md no-print" style={{ marginTop: 64, paddingTop: 24, boxShadow: 'inset 0 1px 0 #f1f1f1' }}>
              <Button variant="secondary" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
                이전 단계
              </Button>
              <span className="flex-1" />
              <Caption>
                {stepIndex + 1} / {views.length}
              </Caption>
              <span className="flex-1" />
              <Button disabled={stepIndex === views.length - 1} onClick={() => setStepIndex((i) => Math.min(views.length - 1, i + 1))}>
                다음 단계
              </Button>
            </nav>

            {stepIndex === views.length - 1 ? (
              <div style={{ marginTop: 48 }}>
                <Notice tone="mint">
                  <p className="text-body-sm" style={{ margin: 0 }}>
                    이 차시의 산출물은 포트폴리오에 저장되었습니다.
                  </p>
                </Notice>
              </div>
            ) : null}
          </>
        ) : null}
      </AppShell>
    </TheoryProvider>
  )
}

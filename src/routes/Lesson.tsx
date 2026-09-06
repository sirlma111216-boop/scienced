import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getLesson } from '@/content/lessons'
import { GAMES_BY_LESSON } from '@/content/games'
import type { LessonId, Step } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { weightFromPresentCount } from '@/lib/ladder'
import type { AppUser, LadderState, Participation, ResponseDoc, SessionState } from '@/lib/types'
import { AppShell, InstructorMovedBanner } from '@/components/layout/AppShell'
import { AiAssistPanel } from '@/components/ai/AiAssistPanel'
import { ConceptCard } from '@/components/concept/ConceptCard'
import { LadderGame } from '@/components/activity/LadderGame'
import { ModuleHost } from '@/components/activity/ModuleHost'
import { DistributionView } from '@/components/response/DistributionView'
import { ResponseCollector } from '@/components/response/ResponseCollector'
import { MustSay } from '@/components/teach/MustSay'
import { ShareBar } from '@/components/wall/Wall'
import { Badge, Button, Caption, ColorBlock, Notice, ScrollX } from '@/components/ui'

/**
 * 차시 진행 화면.
 *
 * 지시서 8절의 흐름을 그대로 그린다.
 * 강사가 단계를 옮겨도 학생 화면을 강제로 이동시키지 않는다. 안내와 이동 버튼만 띄운다.
 */
export function Lesson() {
  const { id } = useParams()
  const { repo, isInstructor } = useAuth()
  const lesson = getLesson(id ?? '')
  const [stepIndex, setStepIndex] = useState(0)
  const [session, setSession] = useState<SessionState | null>(null)
  const [published, setPublished] = useState<LessonId[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [dismissedAt, setDismissedAt] = useState<string | null>(null)
  const [allDocs, setAllDocs] = useState<ResponseDoc[]>([])
  const [participation, setParticipation] = useState<Participation[]>([])

  const step: Step | undefined = lesson?.steps[stepIndex]

  useEffect(() => {
    if (!repo) return
    return repo.watchPublished(setPublished)
  }, [repo])

  useEffect(() => {
    if (!repo || !lesson) return
    return repo.watchSession(lesson.id, setSession)
  }, [repo, lesson])

  useEffect(() => {
    if (!repo) return
    const a = repo.watchUsers(setUsers)
    const b = repo.watchParticipation(setParticipation)
    return () => {
      a()
      b()
    }
  }, [repo])

  useEffect(() => {
    if (!repo || !lesson || !step) return
    return repo.watchAllResponses(lesson.id, step.id, setAllDocs)
  }, [repo, lesson, step])

  if (!lesson) return <Navigate to="/" replace />

  // 미공개 차시는 내용을 아예 그리지 않는다. 규칙에서도 막히지만 화면에서도 막는다.
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

  const navItems = lesson.steps.map((s) => ({
    id: s.id,
    label: s.title,
    minutes: s.durationMinutes,
    instructorHere: session?.instructorAt === s.id,
  }))

  const instructorStep = lesson.steps.find((s) => s.id === session?.instructorAt)
  const showMoved =
    instructorStep && instructorStep.id !== step?.id && dismissedAt !== instructorStep.id

  const game = GAMES_BY_LESSON[lesson.id]
  const ladder: LadderState | null = game ? (session?.ladders?.[game.id] ?? null) : null
  const nicknames = useMemo(
    () => Object.fromEntries(users.map((u) => [u.uid, u.nickname || '이름 없음'])),
    [users],
  )

  // 14·18강은 가중치를 학생 화면에 그대로 공개한다. 규칙 자체가 그날의 학습 내용이다.
  const weights = useMemo(
    () =>
      Object.fromEntries(
        users
          .filter((u) => u.role === 'student')
          .map((u) => [
            u.uid,
            weightFromPresentCount(participation.find((p) => p.uid === u.uid)?.presentCount ?? 0),
          ]),
      ),
    [users, participation],
  )

  return (
    <AppShell
      title={`${lesson.id}강 ${lesson.title}`}
      steps={navItems}
      activeStepId={step?.id}
      onSelectStep={(sid) => {
        const i = lesson.steps.findIndex((s) => s.id === sid)
        if (i >= 0) setStepIndex(i)
      }}
    >
      {showMoved && instructorStep ? (
        <InstructorMovedBanner
          label={instructorStep.title}
          onGo={() => {
            const i = lesson.steps.findIndex((s) => s.id === instructorStep.id)
            if (i >= 0) setStepIndex(i)
          }}
          onDismiss={() => setDismissedAt(instructorStep.id)}
        />
      ) : null}

      {/* ① 오늘의 문 */}
      {stepIndex === 0 ? (
        <section style={{ marginBottom: 48 }}>
          <p className="eyebrow">{lesson.id}강</p>
          <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
            {lesson.title}
          </h1>
          <p className="text-subhead" style={{ marginTop: 24, maxWidth: 760 }}>
            {lesson.centralQuestion}
          </p>

          <div style={{ marginTop: 32 }}>
            <ColorBlock tone="lilac">
              <p className="eyebrow">학생의 말</p>
              <blockquote className="text-headline" style={{ margin: '12px 0 0' }}>
                “{lesson.studentVoice}”
              </blockquote>
            </ColorBlock>
          </div>

          <div className="card" style={{ marginTop: 32 }}>
            <Caption>먼저 한 문장</Caption>
            <p className="text-body-lg" style={{ margin: '8px 0 24px', fontWeight: 480 }}>
              {lesson.firstSentence}
            </p>
            <Caption>친절한 길잡이</Caption>
            <p className="text-body" style={{ margin: '8px 0 0' }}>
              {lesson.guide}
            </p>
          </div>

          <div style={{ marginTop: 32 }}>
            <Caption>오늘의 학습목표</Caption>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {lesson.objectives.map((o, i) => (
                <li key={i} className="text-body" style={{ marginBottom: 6 }}>
                  {o}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 32 }}>
            <ScrollX>
              <table style={{ borderCollapse: 'collapse', minWidth: 480 }}>
                <caption className="caption" style={{ textAlign: 'left', paddingBottom: 8 }}>
                  50분 흐름
                </caption>
                <tbody>
                  {lesson.timeline.map((t) => (
                    <tr key={t.stepId} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                      <td className="font-mono text-body-sm" style={{ padding: '8px 16px 8px 0' }}>
                        {t.minutes}분
                      </td>
                      <td className="text-body-sm" style={{ padding: '8px 0' }}>
                        {t.label}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
          </div>

          <div className="flex items-center gap-xs" style={{ marginTop: 24 }}>
            <Badge>{lesson.curriculumLink.label}</Badge>
            <p className="text-body-sm" style={{ margin: 0, opacity: 0.78 }}>
              {lesson.curriculumLink.text}
            </p>
          </div>
        </section>
      ) : null}

      {step ? (
        <>
          <MustSay lines={lesson.instructorScript} stepId={step.id} isInstructor={isInstructor} />

          <section>
            <div className="flex items-baseline gap-md" style={{ marginBottom: 8 }}>
              <h2 className="text-headline" style={{ margin: 0 }}>
                {step.title}
              </h2>
              <Caption>{step.durationMinutes}분</Caption>
            </div>
            <p className="text-body-lg" style={{ whiteSpace: 'pre-line', marginTop: 0 }}>
              {step.lead}
            </p>

            {/* ② 시작 현상 / 읽을 자료 */}
            {step.material?.map((m, i) => (
              <div key={i} className="card" style={{ marginTop: 24 }}>
                <Caption>{m.kind === 'transcript' ? '수업 기록' : '자료'}</Caption>
                <h3 className="text-card-title" style={{ margin: '8px 0 12px' }}>
                  {m.title}
                </h3>
                <p className="text-body" style={{ whiteSpace: 'pre-line', margin: 0 }}>
                  {m.body}
                </p>
              </div>
            ))}

            {/* ⑤ 개념 카드 */}
            {step.type === 'concepts' ? (
              <div className="flex flex-col" style={{ gap: 96, marginTop: 48 }}>
                {(step.conceptIds ?? []).map((cid, i) => {
                  const concept = lesson.keyConcepts.find((c) => c.id === cid)
                  if (!concept) return null
                  return <ConceptCard key={cid} concept={concept} index={i} />
                })}
              </div>
            ) : null}

            {/* ③ 내 생각 먼저 → ⑥ 핵심 모듈 → ④ 의견 광장 → 분포 */}
            {step.fields.length > 0 || step.moduleComponent ? (
              <div style={{ marginTop: 32 }}>
                <ResponseCollector
                  lessonId={lesson.id}
                  step={step}
                  renderModule={
                    step.moduleComponent
                      ? (value, onChange, locked) => (
                          <ModuleHost
                            kind={step.moduleComponent!}
                            lessonId={lesson.id}
                            value={value}
                            onChange={onChange}
                            locked={locked}
                          />
                        )
                      : undefined
                  }
                >
                  {(submitted) => (
                    <>
                      {submitted ? (
                        <div className="flex flex-col gap-xl" style={{ marginTop: 32 }}>
                          {step.fields.find((f) => f.kind === 'choice') ? (
                            <DistributionView
                              docs={allDocs}
                              field={step.fields.find((f) => f.kind === 'choice')!}
                              reasonKey={
                                step.fields.find((f) => /reason/i.test(f.key))?.key
                              }
                            />
                          ) : null}

                          {step.aiTasks.includes('recall-probe') ? (
                            <AiAssistPanel
                              taskId="recall-probe"
                              inputs={{ context: step.title }}
                            />
                          ) : null}
                          {step.aiTasks.includes('exit-self-check') ? (
                            <AiAssistPanel
                              taskId="exit-self-check"
                              inputs={{ context: step.title }}
                            />
                          ) : null}
                        </div>
                      ) : null}

                      {step.wall?.enabled ? (
                        <div style={{ marginTop: 32 }}>
                          <ShareBar
                            lessonId={lesson.id}
                            stepId={step.id}
                            prompt={step.wall.prompt}
                            unlocked={submitted || !step.wall.opensAfterSubmit}
                          />
                        </div>
                      ) : null}
                    </>
                  )}
                </ResponseCollector>
              </div>
            ) : null}

            {/* ⑦ 발표자 뽑기 */}
            {step.picker?.enabled && game ? (
              <div style={{ marginTop: 48 }}>
                <LadderGame
                  lessonId={lesson.id}
                  game={game}
                  state={ladder}
                  nicknames={nicknames}
                  weights={game.revealWeights ? weights : undefined}
                />
              </div>
            ) : null}

            {/* 인쇄 활동지 — 같은 목표의 오프라인 대안 */}
            <details className="no-print" style={{ marginTop: 48 }}>
              <summary className="caption" style={{ cursor: 'pointer' }}>
                인쇄 활동지 안내 (기기 없이 같은 활동을 하는 법)
              </summary>
              <p className="text-body-sm" style={{ marginTop: 8, opacity: 0.78 }}>
                {step.printableAlternative}
              </p>
              <Button variant="secondary" onClick={() => window.print()} className="mt-md">
                이 화면 인쇄
              </Button>
            </details>
          </section>

          <nav
            className="flex items-center gap-md no-print"
            style={{ marginTop: 64, paddingTop: 24, boxShadow: 'inset 0 1px 0 #f1f1f1' }}
          >
            <Button
              variant="secondary"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            >
              이전 단계
            </Button>
            <span className="flex-1" />
            <Caption>
              {stepIndex + 1} / {lesson.steps.length}
            </Caption>
            <span className="flex-1" />
            <Button
              disabled={stepIndex === lesson.steps.length - 1}
              onClick={() => setStepIndex((i) => Math.min(lesson.steps.length - 1, i + 1))}
            >
              다음 단계
            </Button>
          </nav>

          {stepIndex === lesson.steps.length - 1 ? (
            <div style={{ marginTop: 48 }}>
              <Notice tone="mint">
                <p className="text-body-sm">
                  이 차시의 산출물은 포트폴리오에 저장되었습니다. 마지막 시간에 1강의 답과 나란히
                  놓고 비교합니다.
                </p>
              </Notice>
            </div>
          ) : null}
        </>
      ) : null}
    </AppShell>
  )
}

export type { AppUser, ResponseDoc, LessonId, LadderState, SessionState }
export { useAuth }

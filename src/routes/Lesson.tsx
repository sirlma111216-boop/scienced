import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getLesson } from '@/content/lessons'
import { GAMES_BY_LESSON } from '@/content/games'
import { SESSION_LENGTHS, sessionLengthShort } from '@/content/classes'
import type { LessonId, Step, Tier } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { weightFromPresentCount } from '@/lib/ladder'
import {
  buildLessonView,
  classSessionLength,
  classShowsDeferred,
  tierKey,
  type TierOverrides,
} from '@/lib/tiers'
import type {
  AppUser,
  LadderState,
  Participation,
  ResponseDoc,
  SessionLength,
  SessionState,
} from '@/lib/types'
import { AfterClass } from '@/components/response/AfterClass'
import { AppShell, InstructorMovedBanner } from '@/components/layout/AppShell'
import { AiAssistPanel } from '@/components/ai/AiAssistPanel'
import { ConceptCard } from '@/components/concept/ConceptCard'
import { LadderGame } from '@/components/activity/LadderGame'
import { GroupPanel } from '@/components/activity/GroupPanel'
import { LockedCard, StimulusView } from '@/components/stimulus/StimulusView'
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
  const { repo, isInstructor, classId, currentClass } = useAuth()
  const lesson = getLesson(id ?? '')
  const [stepIndex, setStepIndex] = useState(0)
  const [tierOverrides, setTierOverrides] = useState<TierOverrides>({})
  /**
   * 강사 미리보기 (3차 F.6).
   * 실제 클래스 설정과 무관하게 두 판을 다 확인할 수 있어야 한다.
   * null 이면 이 클래스의 설정을 따른다.
   */
  const [preview, setPreview] = useState<SessionLength | null>(null)
  const [session, setSession] = useState<SessionState | null>(null)
  const [published, setPublished] = useState<LessonId[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [dismissedAt, setDismissedAt] = useState<string | null>(null)
  const [allDocs, setAllDocs] = useState<ResponseDoc[]>([])
  const [participation, setParticipation] = useState<Participation[]>([])

  /* 이 클래스가 도는 판. 강사가 미리보기를 켜면 그쪽을 따른다. */
  const length: SessionLength = preview ?? classSessionLength(currentClass)

  /**
   * 차시를 판에 맞춰 자른다.
   * 50분 판에서는 심화 블록이 흐름에서 빠지고 「수업 후 이어서」로 내려간다.
   */
  const view = useMemo(
    () => (lesson ? buildLessonView(lesson, length, tierOverrides) : null),
    [lesson, length, tierOverrides],
  )

  const stepView = view?.steps[stepIndex]
  const step: Step | undefined = stepView?.step

  useEffect(() => {
    if (!repo || !classId) return
    return repo.watchLessonState(classId, setPublished)
  }, [repo, classId])

  useEffect(() => {
    if (!repo || !classId || !lesson) return
    return repo.watchLessonTiers(classId, lesson.id, setTierOverrides)
  }, [repo, classId, lesson])

  /* 판이 바뀌면 단계 수가 달라진다. 범위를 벗어난 자리에 머물지 않게 한다. */
  useEffect(() => {
    const n = view?.steps.length ?? 0
    if (n > 0 && stepIndex >= n) setStepIndex(n - 1)
  }, [view, stepIndex])

  useEffect(() => {
    if (!repo || !lesson || !classId) return
    return repo.watchSession(classId, lesson.id, setSession)
  }, [repo, lesson, classId])

  useEffect(() => {
    if (!repo || !classId) return
    const a = repo.watchUsers(setUsers)
    const b = repo.watchParticipation(classId, setParticipation)
    return () => {
      a()
      b()
    }
  }, [repo, classId])

  useEffect(() => {
    if (!repo || !lesson || !step || !classId) return
    return repo.watchAllResponses(classId, lesson.id, step.id, setAllDocs)
  }, [repo, lesson, step, classId])

  /*
   * ★ 훅은 조기 반환보다 위에 있어야 한다.
   *   아래의 `if (!open) return` 은 차시가 수업 중에 공개되는 순간 false→true 로 바뀐다.
   *   그때 훅이 반환문 아래 있으면 렌더마다 훅 개수가 달라져 화면이 깨진다.
   *   실제로 그렇게 있었고, eslint(react-hooks/rules-of-hooks)가 잡았다.
   */
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

  if (!lesson || !view) return <Navigate to="/" replace />

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

  /* 50분 판에서는 심화 단계가 네비게이션에도 나오지 않는다 (3차 F.3). */
  const navItems = view.steps.map((s) => ({
    id: s.step.id,
    label: s.step.title,
    shortLabel: s.step.shortTitle,
    instructorHere: session?.instructorAt === s.step.id,
  }))

  const instructorStep = view.steps.find((s) => s.step.id === session?.instructorAt)?.step
  const showMoved =
    instructorStep && instructorStep.id !== step?.id && dismissedAt !== instructorStep.id

  /*
   * 블록을 여는 조건 (4차 H.4).
   *
   * afterReveal / afterInstructorOpen 은 둘 다 강사가 진행 콘솔에서 여는 것이라
   * 같은 목록(sessions.revealed)에 id 로 들어간다. 되돌릴 수 있다 — 빼면 다시 잠긴다.
   * afterSubmit 은 본인이 제출했는가로 판정하므로 수집기 안에서 따로 본다.
   */
  const revealed = session?.revealed ?? []
  function isOpen(gate: { type: string; of: string }): boolean {
    if (gate.type === 'afterSubmit') return true
    return revealed.includes(gate.of)
  }

  /*
   * 자료와 입력 칸이 함께 있으면 넓은 화면에서 좌우로 나눈다.
   * 읽을 것과 적을 칸이 한 화면에 같이 있어야 한다 —
   * 위아래로 두면 칸마다 스크롤을 오르내려야 한다.
   */
  const splitWork = (stepView?.material.length ?? 0) > 0 && (stepView?.fields.length ?? 0) > 0

  const game = GAMES_BY_LESSON[lesson.id]
  const ladder: LadderState | null = game ? (session?.ladders?.[game.id] ?? null) : null

  return (
    <AppShell
      title={`${lesson.id}강 ${lesson.title}`}
      steps={navItems}
      activeStepId={step?.id}
      onSelectStep={(sid) => {
        const i = view.steps.findIndex((s) => s.step.id === sid)
        if (i >= 0) setStepIndex(i)
      }}
    >
      {/* 강사만 보는 판 미리보기. 실제 클래스 설정과 무관하게 두 판을 다 확인한다 (3차 F.6). */}
      {isInstructor ? (
        <PlanPreviewBar
          classLength={classSessionLength(currentClass)}
          preview={preview}
          onPreview={setPreview}
        />
      ) : null}

      {showMoved && instructorStep ? (
        <InstructorMovedBanner
          label={instructorStep.title}
          onGo={() => {
            const i = view.steps.findIndex((s) => s.step.id === instructorStep.id)
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

          {/*
            수업 흐름. 순서만 보이고 소요 시간은 넣지 않는다 (3차 D).
            시간 배분은 데이터(durationMinutes)에 그대로 남아 있지만 화면에 나가지 않는다.
          */}
          <div style={{ marginTop: 32 }}>
            <ScrollX>
              <table style={{ borderCollapse: 'collapse', minWidth: 320 }}>
                <caption className="caption" style={{ textAlign: 'left', paddingBottom: 8 }}>
                  수업 흐름
                </caption>
                <tbody>
                  {lesson.timeline.map((t, i) => (
                    <tr key={t.stepId} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                      <td className="font-mono text-body-sm" style={{ padding: '8px 16px 8px 0' }}>
                        {String(i + 1).padStart(2, '0')}
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

      {step && stepView ? (
        <>
          <MustSay lines={lesson.instructorScript} stepId={step.id} isInstructor={isInstructor} />

          <section>
            {/* 단계 제목 옆에 소요 시간을 붙이지 않는다 (3차 D). */}
            <h2 className="text-headline" style={{ margin: '0 0 8px' }}>
              {step.title}
            </h2>
            {isInstructor ? (
              <TierBadge
                tier={stepView.tier}
                onChange={(t) =>
                  classId && void repo?.setLessonTier(classId, lesson.id, tierKey.step(step.id), t)
                }
              />
            ) : null}
            {/*
              ① 지금 할 일 (4차 H.1).
              학생이 지금 손으로 할 행동 한 문장. 안내 문구보다 먼저, 눈에 띄게 둔다.
              강사 설명 없이 화면만 읽고도 무엇을 할지 알아야 한다.
            */}
            {step.doNow ? (
              <div
                className="rounded-md"
                style={{
                  padding: '14px 18px',
                  margin: '0 0 16px',
                  boxShadow: 'inset 0 0 0 2px #000',
                }}
              >
                <Caption>지금 할 일</Caption>
                <p className="text-body-lg" style={{ margin: '6px 0 0', fontWeight: 480 }}>
                  {step.doNow}
                </p>
              </div>
            ) : null}

            <p className="text-body-lg" style={{ whiteSpace: 'pre-line', marginTop: 0 }}>
              {step.lead}
            </p>

            {/* ⑤ 개념 카드 — 이 판에 나오는 것만 */}
            {step.type === 'concepts' ? (
              <div className="flex flex-col" style={{ gap: 96, marginTop: 48 }}>
                {stepView.concepts.map((concept, i) => (
                  <div key={concept.id}>
                    {isInstructor ? (
                      <TierBadge
                        tier={concept.tier ?? 'core'}
                        onChange={(t) =>
                          classId &&
                          void repo?.setLessonTier(
                            classId,
                            lesson.id,
                            tierKey.concept(concept.id),
                            t,
                          )
                        }
                      />
                    ) : null}
                    <ConceptCard concept={concept} index={i} />
                  </div>
                ))}
              </div>
            ) : null}


            {/*
              ② 읽을 것·볼 것 — 이 판에 나오는 것만.
              강사가 공개해야 열리는 자료는 잠긴 카드로 자리를 지킨다.
              자리를 아예 비우면 학생이 다음에 무엇이 오는지 모른다.
            */}
            {/*
              자료와 입력 칸이 함께 있는 단계는 넓은 화면에서 좌우로 나눈다.
              위아래로 두면 대본을 보고 → 아래로 내려 적고 → 다시 올려 확인하고를
              칸마다 되풀이해야 한다. 두 수업 비교에서 그것이 특히 심했다.
              좁은 화면에서는 나눌 폭이 없으므로 지금처럼 위아래로 둔다.
            */}
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
              {/* ③ 내 생각 먼저 → ⑥ 핵심 모듈 → ④ 의견 광장 → 분포 */}
              {stepView.fields.length > 0 || step.moduleComponent ? (
                <div style={{ marginTop: 32 }}>
                  <ResponseCollector
                    classId={classId!}
                    lessonId={lesson.id}
                    step={{ ...step, fields: stepView.fields, material: stepView.material }}
                    isGateOpen={isOpen}
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
                    {(submitted, doc) => (
                      <>
                        {submitted ? (
                          <div className="flex flex-col gap-xl" style={{ marginTop: 32 }}>
                            {/*
                              ★ 반 전체 분포는 강사만 읽을 수 있다 (보안 규칙).
                                학생 화면에서도 그리고 있었는데, 규칙에 막혀 언제나 0명 0개였다.
                                채워질 수 없는 표를 두면 「내가 고른 것도 왜 안 세지?」가 된다.
                                학생에게는 어디서 함께 보는지만 알린다.
                            */}
                            {stepView.fields.find((f) => f.kind === 'choice') ? (
                              isInstructor ? (
                                <DistributionView
                                  docs={allDocs}
                                  field={stepView.fields.find((f) => f.kind === 'choice')!}
                                  reasonKey={
                                    stepView.fields.find((f) => /reason/i.test(f.key))?.key
                                  }
                                />
                              ) : (
                                <p className="text-body-sm" style={{ opacity: 0.7, margin: 0 }}>
                                  반 전체 분포는 강사 화면에서 함께 봅니다. 내가 낸 답은 위에
                                  그대로 있고, 다른 사람 생각은 아래 의견 광장에서 볼 수 있습니다.
                                </p>
                              )
                            ) : null}

                            {step.aiTasks.includes('recall-probe') ? (
                              <AiAssistPanel
                                taskId="recall-probe"
                                inputs={{ context: step.title }}
                              />
                            ) : null}
                            {step.aiTasks.includes('wrapup-self-check') ? (
                              <AiAssistPanel
                                taskId="wrapup-self-check"
                                inputs={{ context: step.title }}
                              />
                            ) : null}
                          </div>
                        ) : null}

                        {/*
                          즉석 모둠 — 제출한 뒤에만. 의견 광장보다 먼저 온다.
                          모둠에서 합의한 문장이 의견 광장의 글이 되기 때문에 순서가 뒤집히면 안 된다.
                        */}
                        {step.groupBuild && submitted ? (
                          <div style={{ marginTop: 32 }}>
                            <GroupPanel
                              classId={classId!}
                              lessonId={lesson.id}
                              step={step}
                              config={step.groupBuild}
                              myValues={
                                doc?.versions?.[doc.versions.length - 1]?.payload ?? null
                              }
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
                              /* 공유 상자를 열 때 내가 낸 답을 불러오는 데 쓴다 */
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

            {/* ⑦ 발표자 뽑기 */}
            {step.picker?.enabled && game ? (
              <div style={{ marginTop: 48 }}>
                <LadderGame
                  classId={classId!}
                  lessonId={lesson.id}
                  game={game}
                  state={ladder}
                  nicknames={nicknames}
                  weights={game.revealWeights ? weights : undefined}
                />
              </div>
            ) : null}

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
              {stepIndex + 1} / {view.steps.length}
            </Caption>
            <span className="flex-1" />
            <Button
              disabled={stepIndex === view.steps.length - 1}
              onClick={() => setStepIndex((i) => Math.min(view.steps.length - 1, i + 1))}
            >
              다음 단계
            </Button>
          </nav>

          {stepIndex === view.steps.length - 1 ? (
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

      {/*
        「수업 후 이어서」 — 흐름에서 뺀 블록 (3차 F.2 ① · F.6).
        클래스 설정에서 끄면(extendedAsHomework: false) 아예 보이지 않는다.
      */}
      {classId && classShowsDeferred(currentClass) ? (
        <AfterClass classId={classId} lesson={lesson} view={view} />
      ) : null}
    </AppShell>
  )
}

/** 강사만 보는 판 미리보기 (3차 F.6). 학생 화면에는 나오지 않는다. */
function PlanPreviewBar({
  classLength,
  preview,
  onPreview,
}: {
  classLength: SessionLength
  preview: SessionLength | null
  onPreview: (v: SessionLength | null) => void
}) {
  const active = preview ?? classLength
  return (
    <div
      className="flex flex-wrap items-center gap-xs no-print"
      style={{ marginBottom: 24 }}
    >
      <Caption>미리보기</Caption>
      {SESSION_LENGTHS.map((s) => (
        <button
          key={s.key}
          type="button"
          className="tab"
          aria-pressed={active === s.key}
          data-selected={active === s.key}
          style={{ fontSize: 13, minHeight: 36, padding: '4px 12px' }}
          onClick={() => onPreview(s.key === classLength ? null : s.key)}
        >
          {s.label}
        </button>
      ))}
      {preview && preview !== classLength ? (
        <Caption>이 클래스는 {sessionLengthShort(classLength)}으로 돕니다 — 보기만 바꾼 것입니다</Caption>
      ) : null}
    </div>
  )
}

/**
 * 핵심 / 심화 배지 (3차 F.6).
 * 차시별 판단의 최종 결정권은 강의자에게 있다. 누르면 이 클래스에서만 바뀐다.
 */
function TierBadge({ tier, onChange }: { tier: Tier; onChange: (t: Tier) => void }) {
  return (
    <button
      type="button"
      className="badge no-print"
      aria-label={`이 블록은 ${tier === 'core' ? '핵심' : '심화'}입니다. 눌러서 바꿉니다.`}
      style={{ cursor: 'pointer', marginBottom: 8 }}
      onClick={() => onChange(tier === 'core' ? 'extended' : 'core')}
    >
      {tier === 'core' ? '핵심' : '심화'}
    </button>
  )
}

export type { AppUser, ResponseDoc, LessonId, LadderState, SessionState }
export { useAuth }

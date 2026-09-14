import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getLesson } from '@/content/lessons'
import { GAMES_BY_LESSON } from '@/content/games'
import { useAuth } from '@/lib/auth'
import { buildLessonView, classSessionLength, type TierOverrides } from '@/lib/tiers'
import { formationLessons, historyFromDocs, roundForLesson } from '@/lib/groups'
import { deferredBlock, gatesOf, stepBlocks, type ConsoleBlock } from '@/lib/console-registry'
import type {
  AiProposal,
  AppUser,
  Enrollment,
  GroupRound,
  GroupShare,
  PairHistoryDoc,
  Participation,
  Post,
  ResponseDoc,
  RosterEntry,
  SessionState,
} from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { FormationPanel } from '@/components/groups/FormationPanel'
import { LadderPanel } from '@/components/teach/LadderPanel'
import { Badge, Button, Caption, usePresent } from '@/components/ui'
import { NamesProvider, Overlay, submitted, useNames } from '@/components/console/shared'
import { CanvasGridView, CanvasThumb, ChoiceView, GateView, ResponseCardsView, SorterView, WallView } from '@/components/console/BlockViews'
import { RosterColumn, StudentDetail } from '@/components/console/Roster'

/**
 * 진행 콘솔 (7차 지시서 작업 R).
 *
 * 콘솔은 학생 화면이 읽는 것과 같은 블록 정의(console-registry.stepBlocks)를 읽고,
 * 블록 종류에 따라 등록표가 정한 조작부만 그린다. 그래서 학생 화면과 어긋날 수 없다.
 *
 *   진행 바   차시·단계 이동 · 열기/닫기 · 자료 공개 · 모둠 · 뽑기 · 분기 · 발표 모드 · 실명 가리기 — 늘 보인다
 *   응답 화면  왼쪽에 이 단계의 블록 목록(제출 수), 오른쪽에 고른 블록의 응답 — 기본 화면
 *   명단 열    참석·제출 · 미제출자 위에 · 알림 · 「수업 후 이어서」 제출 여부
 *   덮개 화면  모둠 나누기 · 발표자 뽑기 · 개인 화면 · 크게 띄우기 — 화면을 떠나지 않는다
 *
 * 콘솔에는 수업 중에 누르는 것만 둔다. 블록을 만들고 고치는 일은 여기서 하지 않는다.
 * 강사 대본은 없다 (R.5). 학생 순위·정답률 랭킹은 만들지 않는다.
 * 그 단계에 없는 기능의 단추는 그리지 않는다 — 흐리게 두지 않고 아예 없앤다 (R.1).
 */

type OverlayState =
  | null
  | { kind: 'groups' }
  | { kind: 'ladder' }
  | { kind: 'student'; uid: string }
  | { kind: 'spotlight'; uid: string; text: string }
  | { kind: 'canvas'; uid: string; value: { nodes?: Array<{ id: string; label?: string; x: number; y: number }>; edges?: Array<{ from: string; to: string }> } }

export function InstructorLive() {
  const { id } = useParams()
  const { repo, isInstructor, classId, currentClass } = useAuth()
  const lesson = getLesson(id ?? '')
  const [tierOverrides, setTierOverrides] = useState<TierOverrides>({})
  const [stepIndex, setStepIndex] = useState(0)
  const [session, setSession] = useState<SessionState | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [participation, setParticipation] = useState<Participation[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [groupRounds, setGroupRounds] = useState<GroupRound[]>([])
  const [pairHistory, setPairHistory] = useState<PairHistoryDoc[]>([])
  const [proposals, setProposals] = useState<AiProposal[]>([])
  const [docsByStep, setDocsByStep] = useState<Record<string, ResponseDoc[]>>({})
  const [posts, setPosts] = useState<Post[]>([])
  const [shares, setShares] = useState<GroupShare[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<OverlayState>(null)
  const [hideNames, setHideNames] = useState(false)
  /* 타이머 — 강사가 직접 눌러 시작하는 진행 도구. 기본값은 비워 둔다 (3차 D.3). */
  const [timerMinutes, setTimerMinutes] = useState('')

  /* 진행 콘솔은 현재 클래스의 판을 따른다 (3차 F.6). 50분 반을 진행하면서 1시간 판의 단계를 제어하면 학생 화면과 어긋난다. */
  const view = useMemo(
    () => (lesson ? buildLessonView(lesson, classSessionLength(currentClass), tierOverrides) : null),
    [lesson, currentClass, tierOverrides],
  )
  const stepView = view?.steps[stepIndex]
  const step = stepView?.step
  const formationRound = lesson ? formationLessons(currentClass).includes(lesson.id) : false

  /* ── 구독 ── */
  useEffect(() => {
    if (!repo || !lesson || !classId) return
    return repo.watchSession(classId, lesson.id, setSession)
  }, [repo, lesson, classId])
  useEffect(() => {
    if (!repo || !classId || !lesson) return
    return repo.watchLessonTiers(classId, lesson.id, setTierOverrides)
  }, [repo, classId, lesson])
  useEffect(() => {
    if (!repo || !classId) return
    const offs = [
      repo.watchUsers(setUsers),
      repo.watchParticipation(classId, setParticipation),
      repo.watchAiProposals(classId, setProposals),
      repo.watchEnrollments(classId, setEnrollments),
      repo.watchRoster(classId, setRoster),
      repo.watchGroupRounds(classId, setGroupRounds),
      repo.watchPairHistory(classId, setPairHistory),
    ]
    return () => offs.forEach((off) => off())
  }, [repo, classId])
  /* 응답은 차시의 모든 단계를 본다 — 개인 화면과 「수업 후 이어서」 현황이 다른 단계의 응답을 쓴다 */
  useEffect(() => {
    if (!repo || !lesson || !classId) return
    const offs = lesson.steps.map((s) =>
      repo.watchAllResponses(classId, lesson.id, s.id, (docs) => setDocsByStep((prev) => ({ ...prev, [s.id]: docs }))),
    )
    return () => offs.forEach((off) => off())
  }, [repo, lesson, classId])
  useEffect(() => {
    if (!repo || !lesson || !step || !classId) return
    const a = repo.watchPosts(classId, lesson.id, step.id, setPosts)
    const b = step.groupBuild ? repo.watchGroupShares(classId, lesson.id, step.id, setShares) : () => {}
    return () => {
      a()
      b()
    }
  }, [repo, lesson, step, classId])
  useEffect(() => {
    const n = view?.steps.length ?? 0
    if (n > 0 && stepIndex >= n) setStepIndex(n - 1)
  }, [view, stepIndex])

  /* ── 파생 ── */
  /* 이 클래스에 등록한 사람만 센다. 내보낸 계정은 곧바로 사라진다. */
  const studentUids = useMemo(() => enrollments.filter((e) => e.status === 'active').map((e) => e.uid), [enrollments])
  const activeEnrollments = useMemo(() => enrollments.filter((e) => e.status === 'active'), [enrollments])
  const pairHist = useMemo(() => historyFromDocs(pairHistory), [pairHistory])
  const docs = step ? (docsByStep[step.id] ?? []) : []

  const blocks = useMemo(() => (stepView ? stepBlocks(stepView, { formationRound }) : []), [stepView, formationRound])
  const deferred = useMemo(() => (lesson && view ? deferredBlock(lesson, view) : null), [lesson, view])
  const allBlocks = useMemo(() => (deferred ? [...blocks, deferred] : blocks), [blocks, deferred])
  /* 기본 화면은 응답이다 (R.2) — 고른 것이 없으면 학생이 올리는 첫 블록을 연다 */
  const RESPONSE_KINDS: ConsoleBlock['kind'][] = ['choice', 'input', 'sorter', 'canvas', 'module']
  const selected =
    allBlocks.find((b) => b.id === selectedBlockId) ??
    allBlocks.find((b) => RESPONSE_KINDS.includes(b.kind)) ??
    allBlocks.find((b) => b.controls.length > 0) ??
    allBlocks[0] ??
    null
  const gates = gatesOf(blocks)
  const revealed = session?.revealed ?? []

  /* 「수업 후 이어서」 — 내려간 단계·칸의 제출 여부 */
  const deferredStatus = useMemo(() => {
    if (!view) return { total: 0, byUid: {} as Record<string, number> }
    const stepIds = [...view.deferredSteps.map((v) => v.step.id), ...view.steps.filter((v) => v.deferredFields.length > 0).map((v) => v.step.id)]
    const byUid: Record<string, number> = {}
    for (const sid of stepIds) for (const d of docsByStep[sid] ?? []) if (submitted(d)) byUid[d.uid] = (byUid[d.uid] ?? 0) + 1
    return { total: stepIds.length, byUid }
  }, [view, docsByStep])

  const setSess = useCallback(
    (patch: Partial<SessionState>) => {
      if (!repo || !classId || !lesson) return
      void repo.setSession(classId, lesson.id, patch)
    },
    [repo, classId, lesson],
  )

  if (!isInstructor) return <Navigate to="/" replace />
  if (!lesson || !view) return <Navigate to="/instructor/lessons" replace />

  const game = GAMES_BY_LESSON[lesson.id]
  const round = roundForLesson(lesson.id, groupRounds)

  async function moveTo(i: number) {
    setStepIndex(i)
    setSelectedBlockId(null)
    const s = view!.steps[i]?.step
    if (!s) return
    // 학생 화면을 강제로 옮기지 않는다. 어디에 있는지만 알린다.
    setSess({ instructorAt: s.id, currentStepId: s.id })
  }
  function toggleGate(gateId: string) {
    const on = revealed.includes(gateId)
    setSess({ revealed: on ? revealed.filter((x) => x !== gateId) : [...revealed, gateId] })
  }
  function notice(kind: 'explain' | 'pair' | 'reask') {
    if (!step) return
    setSess({ notice: { kind, stepId: step.id, at: Date.now() } })
  }
  function nudge(uids: string[], kind: 'submit' | 'reask') {
    if (!step) return
    const at = Date.now()
    const nudges: SessionState['nudges'] = { ...(session?.nudges ?? {}) }
    for (const u of uids) nudges[u] = { kind, stepId: step.id, at }
    setSess({ nudges })
  }
  function reask(uids: string[] | 'all') {
    if (uids === 'all') notice('reask')
    else nudge(uids, 'reask')
  }
  const openStudent = (uid: string) => setOverlay({ kind: 'student', uid })
  const spotlight = (uid: string, text: string) => setOverlay({ kind: 'spotlight', uid, text })
  const nudgedAt: Record<string, number> = Object.fromEntries(Object.entries(session?.nudges ?? {}).map(([u, n]) => [u, n.at]))

  return (
    <NamesProvider users={users} enrollments={enrollments} roster={roster} hideNames={hideNames}>
      <AppShell title={`${lesson.id}강 진행 콘솔`}>
        {/* ── 진행 바 — 스크롤해도 따라온다 (R.1) ── */}
        <ProgressBar
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          steps={view.steps.map((v) => v.step)}
          deferredSteps={view.deferredSteps.map((v) => v.step)}
          stepIndex={stepIndex}
          onMove={(i) => void moveTo(i)}
          stepOpen={Boolean(session?.stepOpen)}
          onToggleStep={() => setSess({ stepOpen: !session?.stepOpen })}
          gates={gates.map((g) => ({ ...g, on: revealed.includes(g.id) }))}
          onToggleGate={toggleGate}
          showGroups={formationRound && step?.order === 1}
          onGroups={() => setOverlay({ kind: 'groups' })}
          groupsDone={Boolean(groupRounds.find((r) => r.lessonId === lesson.id))}
          showLadder={Boolean(step?.picker?.enabled && game)}
          onLadder={() => setOverlay({ kind: 'ladder' })}
          onNotice={notice}
          timerMinutes={timerMinutes}
          onTimerMinutes={setTimerMinutes}
          timerOn={Boolean(session?.timerEndsAt && session.timerEndsAt > Date.now())}
          onTimerStart={() => {
            const m = Number(timerMinutes)
            if (m > 0) setSess({ timerEndsAt: Date.now() + m * 60 * 1000 })
          }}
          onTimerStop={() => setSess({ timerEndsAt: null })}
          hideNames={hideNames}
          onHideNames={setHideNames}
        />

        {/* ── 본문: 블록 목록 | 응답 | 명단 ── */}
        <div className="console-grid" style={{ marginTop: 24 }}>
          <nav aria-label="이 단계의 블록" className="console-blocks">
            <Caption>{step ? `${step.order}단계 · ${step.title}` : ''}</Caption>
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
              {allBlocks.map((b) => {
                const count = blockCount(b, docs, docsByStep, studentUids, posts)
                const on = selected?.id === b.id
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => setSelectedBlockId(b.id)}
                      className="flex items-center gap-xs"
                      style={{ width: '100%', textAlign: 'left', border: 0, background: on ? '#111' : 'transparent', color: on ? '#fff' : '#111', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', marginBottom: 2 }}
                    >
                      <span className="text-body-sm" style={{ flex: 1, opacity: b.controls.length === 0 ? 0.6 : 1 }}>
                        {b.label}
                      </span>
                      {count ? (
                        <span className="font-mono text-caption" style={{ opacity: 0.85 }}>
                          {count}
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <section aria-live="off" className="console-main">
            {selected ? (
              <>
                <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
                  <h2 className="text-card-title" style={{ margin: 0 }}>
                    {selected.label}
                  </h2>
                  <Badge>{kindLabel(selected)}</Badge>
                </div>
                <BlockBody
                  block={selected}
                  classId={classId!}
                  lesson={lesson}
                  step={step!}
                  docs={selected.stepId && selected.stepId !== step?.id ? (docsByStep[selected.stepId] ?? []) : docs}
                  docsByStep={docsByStep}
                  studentUids={studentUids}
                  posts={posts}
                  shares={shares}
                  proposals={proposals}
                  round={round}
                  revealed={revealed}
                  onToggleGate={toggleGate}
                  onSpotlight={spotlight}
                  onReask={reask}
                  onOpenStudent={openStudent}
                  onEnlarge={(uid, value) => setOverlay({ kind: 'canvas', uid, value })}
                  onGroups={() => setOverlay({ kind: 'groups' })}
                  onLadder={() => setOverlay({ kind: 'ladder' })}
                  deferredStatus={deferredStatus}
                />
              </>
            ) : (
              <p className="text-body-sm" style={{ opacity: 0.7 }}>
                이 단계에는 학생이 올리는 블록이 없습니다.
              </p>
            )}
          </section>

          <RosterColumn
            studentUids={studentUids}
            docs={docs}
            deferredDocs={deferredStatus}
            hasDeferred={Boolean(deferred)}
            nudgedAt={nudgedAt}
            onNudge={(u) => nudge([u], 'submit')}
            onNudgeAll={(us) => nudge(us, 'submit')}
            onOpenStudent={openStudent}
          />
        </div>

        {/* ── 덮개 화면 (R.3) ── */}
        {overlay?.kind === 'groups' && classId ? (
          <Overlay title={`${lesson.id}강 모둠 나누기`} onClose={() => setOverlay(null)} wide>
            <FormationPanel classId={classId} lessonId={lesson.id} cls={currentClass} students={activeEnrollments} hist={pairHist} rounds={groupRounds} showPairs />
            <Caption style={{ marginTop: 8 }}>
              회차 목록·동석 격자 전체는{' '}
              <Link to={`/instructor/class/${classId}/groups`} className="text-link">
                모둠 관리
              </Link>
              에 있습니다.
            </Caption>
          </Overlay>
        ) : null}
        {overlay?.kind === 'ladder' && classId && step && game ? (
          <Overlay title={`발표자 뽑기 · ${step.title}`} onClose={() => setOverlay(null)} wide>
            <LadderPanel classId={classId} lessonId={lesson.id} stepId={step.id} game={game} state={session?.ladders?.[game.id] ?? null} users={users} enrollments={activeEnrollments} participation={participation} groupRound={round} />
          </Overlay>
        ) : null}
        {overlay?.kind === 'student' ? (
          <Overlay title="학생 응답" onClose={() => setOverlay(null)} wide>
            <StudentDetail uid={overlay.uid} lesson={lesson} view={view} docsByStep={docsByStep} onReask={(us) => nudge(us, 'reask')} />
          </Overlay>
        ) : null}
        {overlay?.kind === 'spotlight' ? <Spotlight uid={overlay.uid} text={overlay.text} onClose={() => setOverlay(null)} /> : null}
        {overlay?.kind === 'canvas' ? (
          <Overlay title="크게 보기" onClose={() => setOverlay(null)} wide>
            <CanvasNameLine uid={overlay.uid} />
            <CanvasThumb value={overlay.value} big />
          </Overlay>
        ) : null}
      </AppShell>
    </NamesProvider>
  )
}

/* ── 진행 바 ── */
function ProgressBar(p: {
  lessonId: string
  lessonTitle: string
  steps: Array<{ id: string; order: number; shortTitle: string; title: string }>
  deferredSteps: Array<{ id: string; order: number; shortTitle: string; title: string }>
  stepIndex: number
  onMove: (i: number) => void
  stepOpen: boolean
  onToggleStep: () => void
  gates: Array<{ id: string; label: string; kind: 'reveal' | 'open'; on: boolean }>
  onToggleGate: (id: string) => void
  showGroups: boolean
  groupsDone: boolean
  onGroups: () => void
  showLadder: boolean
  onLadder: () => void
  onNotice: (kind: 'explain' | 'pair' | 'reask') => void
  timerMinutes: string
  onTimerMinutes: (v: string) => void
  timerOn: boolean
  onTimerStart: () => void
  onTimerStop: () => void
  hideNames: boolean
  onHideNames: (v: boolean) => void
}) {
  const { present, toggle } = usePresent()
  const cur = p.steps[p.stepIndex]
  return (
    <div className="console-bar no-print" role="toolbar" aria-label="진행">
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <span className="text-body-sm" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
          {Number(p.lessonId)}강
        </span>
        <Button variant="tertiary" onClick={() => p.onMove(p.stepIndex - 1)} disabled={p.stepIndex === 0} aria-label="이전 단계">
          ‹
        </Button>
        <select className="field" style={{ minHeight: 36, padding: '2px 8px', maxWidth: 260 }} value={cur?.id ?? ''} onChange={(e) => p.onMove(p.steps.findIndex((s) => s.id === e.target.value))} aria-label="단계 고르기">
          {p.steps.map((s) => (
            <option key={s.id} value={s.id}>
              {s.order}. {s.title}
            </option>
          ))}
          {/* 50분 판에서 내려간 단계는 흐리게 — 고를 수는 없다 */}
          {p.deferredSteps.map((s) => (
            <option key={s.id} value={`deferred-${s.id}`} disabled>
              {s.order}. {s.title} — 수업 후 이어서
            </option>
          ))}
        </select>
        <Button variant="tertiary" onClick={() => p.onMove(p.stepIndex + 1)} disabled={p.stepIndex >= p.steps.length - 1} aria-label="다음 단계">
          ›
        </Button>

        <Button onClick={p.onToggleStep} aria-pressed={p.stepOpen}>
          {p.stepOpen ? '단계 닫기' : '단계 열기'}
        </Button>

        {/* 자료 공개 — 이 단계에 여는 것이 있을 때만 (R.1). 없으면 단추 자체가 없다. */}
        {p.gates.map((g) => (
          <Button key={g.id} variant={g.on ? 'primary' : 'secondary'} aria-pressed={g.on} onClick={() => p.onToggleGate(g.id)}>
            {g.on ? '↩ ' : '▸ '}
            {g.kind === 'reveal' ? '자료 공개' : '열기'} · {g.label}
          </Button>
        ))}

        {p.showGroups ? (
          <Button variant="secondary" onClick={p.onGroups}>
            모둠{p.groupsDone ? ' ✓' : ''}
          </Button>
        ) : null}
        {p.showLadder ? (
          <Button variant="secondary" onClick={p.onLadder}>
            뽑기
          </Button>
        ) : null}

        <span aria-hidden style={{ width: 1, height: 24, background: '#e6e6e6', margin: '0 4px' }} />

        {/* 분기 — 누르면 학생 화면에 안내 카드가 뜬다 */}
        <Button variant="tertiary" onClick={() => p.onNotice('explain')}>
          설명 추가
        </Button>
        <Button variant="tertiary" onClick={() => p.onNotice('pair')}>
          짝 토론
        </Button>
        <Button variant="tertiary" onClick={() => p.onNotice('reask')}>
          재응답 요청
        </Button>

        <span aria-hidden style={{ width: 1, height: 24, background: '#e6e6e6', margin: '0 4px' }} />

        <label className="flex items-center gap-xxs">
          <span className="caption">타이머</span>
          <input className="field" type="number" min={1} max={90} inputMode="numeric" aria-label="타이머 길이 (분)" value={p.timerMinutes} onChange={(e) => p.onTimerMinutes(e.target.value)} style={{ width: 64, minHeight: 36, padding: '2px 8px' }} />
        </label>
        {p.timerOn ? (
          <Button variant="tertiary" onClick={p.onTimerStop}>
            타이머 해제
          </Button>
        ) : (
          <Button variant="tertiary" disabled={!(Number(p.timerMinutes) > 0)} onClick={p.onTimerStart}>
            타이머 시작
          </Button>
        )}

        <span style={{ flex: 1 }} />

        <label className="flex items-center gap-xxs text-body-sm">
          <input type="checkbox" checked={p.hideNames || present} disabled={present} onChange={(e) => p.onHideNames(e.target.checked)} />
          실명 가리기
        </label>
        <Button variant={present ? 'primary' : 'secondary'} aria-pressed={present} onClick={toggle}>
          발표 모드
        </Button>
      </div>
    </div>
  )
}

/* ── 고른 블록의 본문 ── */
function BlockBody(p: {
  block: ConsoleBlock
  classId: string
  lesson: NonNullable<ReturnType<typeof getLesson>>
  step: NonNullable<ReturnType<typeof getLesson>>['steps'][number]
  docs: ResponseDoc[]
  docsByStep: Record<string, ResponseDoc[]>
  studentUids: string[]
  posts: Post[]
  shares: GroupShare[]
  proposals: AiProposal[]
  round: GroupRound | null
  revealed: string[]
  onToggleGate: (id: string) => void
  onSpotlight: (uid: string, text: string) => void
  onReask: (uids: string[] | 'all') => void
  onOpenStudent: (uid: string) => void
  onEnlarge: (uid: string, value: { nodes?: Array<{ id: string; label?: string; x: number; y: number }>; edges?: Array<{ from: string; to: string }> }) => void
  onGroups: () => void
  onLadder: () => void
  deferredStatus: { total: number; byUid: Record<string, number> }
}) {
  const { nameOf } = useNames()
  const b = p.block
  const common = { classId: p.classId, lessonId: p.lesson.id, block: b, docs: p.docs, studentUids: p.studentUids, onSpotlight: p.onSpotlight, onReask: p.onReask, onOpenStudent: p.onOpenStudent }
  switch (b.kind) {
    case 'stimulus':
    case 'concepts':
      return (
        <p className="text-body-sm" style={{ opacity: 0.7 }}>
          학생이 읽는 블록입니다. 콘솔에서 할 일은 없습니다.
        </p>
      )
    case 'stimulusReveal':
    case 'gateOpen':
      return <GateView label={b.material?.title ?? b.field?.label ?? b.label} kind={b.kind === 'stimulusReveal' ? 'reveal' : 'open'} on={p.revealed.includes(b.gateId!)} onToggle={() => p.onToggleGate(b.gateId!)} />
    case 'choice':
      return <ChoiceView {...common} />
    case 'input':
    case 'module':
      return <ResponseCardsView {...common} proposals={p.proposals} stepTitle={`${p.lesson.id}강 ${p.step.title}`} />
    case 'sorter':
      return <SorterView {...common} shares={p.shares} groupNameOf={(gid) => p.round?.groups.find((g) => g.id === gid)?.name ? `${gid}모둠 ${p.round!.groups.find((g) => g.id === gid)!.name}` : `${gid}모둠`} />
    case 'groupBuild': {
      const alloc = p.step.fields.find((f) => f.kind === 'allocation')
      const fake: ConsoleBlock = { ...b, field: alloc, kind: 'sorter' }
      if (!alloc) {
        return (
          <div>
            <Caption>모둠별로 모인 글</Caption>
            {p.shares.length === 0 ? (
              <p className="text-body-sm" style={{ marginTop: 8, opacity: 0.6 }}>
                아직 모둠에 들어간 사람이 없습니다.
              </p>
            ) : (
              [...new Set(p.shares.map((s) => s.groupId))].sort((a, c) => Number(a) - Number(c)).map((gid) => (
                <div key={gid} style={{ marginTop: 12 }}>
                  <Badge solid>{gid}모둠</Badge>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
                    {p.shares
                      .filter((s) => s.groupId === gid)
                      .map((s) => (
                        <li key={s.uid} className="text-body-sm" style={{ padding: '4px 0', boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                          <strong>{nameOf(s.uid)}</strong>
                          {s.headline ? ` · ${s.headline}` : ''} — {s.opinion}
                        </li>
                      ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )
      }
      return <SorterView {...common} block={fake} shares={p.shares} groupNameOf={(gid) => `${gid}모둠`} />
    }
    case 'canvas':
      return <CanvasGridView {...common} onEnlarge={p.onEnlarge} />
    case 'opinionWall':
      return <WallView classId={p.classId} lessonId={p.lesson.id} stepId={p.step.id} stepTitle={`${p.lesson.id}강 ${p.step.title}`} posts={p.posts} proposals={p.proposals} />
    case 'ladder':
      return (
        <div>
          <p className="text-body-sm" style={{ margin: 0 }}>
            발표자 뽑기는 덮개 화면에서 합니다 — 후보 확인 → 제외 → 실행 → 결과 → 재추첨 / 수동 지정.
          </p>
          <Button style={{ marginTop: 12 }} onClick={p.onLadder}>
            뽑기 열기
          </Button>
        </div>
      )
    case 'groupGame':
      return (
        <div>
          <p className="text-body-sm" style={{ margin: 0 }}>
            {p.round ? `확정됨 · 모둠 ${p.round.groups.length}개 · 중복 ${p.round.cost}` : '아직 나누지 않았습니다.'} 참석자 확인 → 실행 → 미리보기 → 확정은 덮개 화면에서 합니다.
          </p>
          <Button style={{ marginTop: 12 }} onClick={p.onGroups}>
            모둠 나누기 열기
          </Button>
        </div>
      )
    case 'deferred':
      return (
        <div>
          <div className="flex items-center gap-xs">
            <Badge>{p.deferredStatus.total}곳</Badge>
            <Caption>짧은 판에서 수업 밖으로 내려간 단계·칸. 학생이 수업 뒤에 내면 여기와 명단 열에 표시됩니다.</Caption>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
            {p.studentUids.map((u) => (
              <li key={u} className="flex items-center gap-xs text-body-sm" style={{ padding: '4px 0', boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                <button type="button" className="text-link" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: 15, flex: 1, textAlign: 'left' }} onClick={() => p.onOpenStudent(u)}>
                  {nameOf(u)}
                </button>
                <span className="font-mono text-caption">
                  {p.deferredStatus.byUid[u] ?? 0} / {p.deferredStatus.total}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )
    default:
      return null
  }
}

function kindLabel(b: ConsoleBlock): string {
  const map: Record<ConsoleBlock['kind'], string> = {
    stimulus: '자료',
    stimulusReveal: '자료 공개',
    input: '서술형',
    choice: '선택형',
    sorter: '배분·정렬',
    canvas: '그림·노드',
    module: '전용 모듈',
    opinionWall: '의견 광장',
    ladder: '발표자 뽑기',
    groupGame: '모둠 나누기',
    groupBuild: '즉석 모둠',
    concepts: '개념 카드',
    gateOpen: '열기',
    deferred: '수업 후 이어서',
  }
  return map[b.kind]
}

/** 블록 목록 옆의 숫자 — 제출 수 / 학생 수, 의견 광장은 글 수 */
function blockCount(b: ConsoleBlock, docs: ResponseDoc[], docsByStep: Record<string, ResponseDoc[]>, studentUids: string[], posts: Post[]): string {
  if (b.kind === 'opinionWall') return `${posts.length}`
  if (b.kind === 'input' || b.kind === 'choice' || b.kind === 'sorter' || b.kind === 'canvas' || b.kind === 'module') {
    const list = b.stepId ? (docsByStep[b.stepId] ?? docs) : docs
    const key = b.field?.key ?? '__module'
    const n = list.filter((d) => submitted(d) && studentUids.includes(d.uid) && hasValue((d.versions[d.versions.length - 1]?.payload as Record<string, unknown>)?.[key])).length
    return `${n}/${studentUids.length}`
  }
  return ''
}
function hasValue(v: unknown): boolean {
  if (v == null || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v as object).length > 0
  return true
}

/* ── 크게 띄우기 — 닉네임만 나간다 ── */
function Spotlight({ uid, text, onClose }: { uid: string; text: string; onClose: () => void }) {
  const { nicknameOf } = useNames()
  return (
    <Overlay title="크게 띄우기" onClose={onClose} wide>
      <p className="eyebrow">{nicknameOf(uid)}</p>
      <p className="text-headline" style={{ margin: '12px 0 0', whiteSpace: 'pre-line', fontSize: 34, lineHeight: 1.4 }}>
        {text}
      </p>
    </Overlay>
  )
}

function CanvasNameLine({ uid }: { uid: string }) {
  const { nicknameOf } = useNames()
  return <p className="eyebrow">{nicknameOf(uid)}</p>
}

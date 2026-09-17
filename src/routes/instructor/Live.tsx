import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getLesson } from '@/content/lessons'
import { GAMES_BY_LESSON } from '@/content/games'
import { useAuth } from '@/lib/auth'
import { formationLessons, historyFromDocs, roundForLesson } from '@/lib/groups'
import { gatesOf, lessonView, stepBlocks, type ConsoleBlock } from '@/lib/console-registry'
import type { AiProposal, AppUser, Enrollment, GroupRound, GroupShare, PairHistoryDoc, Participation, Post, ResponseDoc, RosterEntry, SessionState } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { FormationPanel } from '@/components/groups/FormationPanel'
import { LadderPanel } from '@/components/teach/LadderPanel'
import { LumiTeacher } from '@/components/lumi/LumiTeacher'
import { isLumiGame } from '@/lib/lumi'
import { Badge, Button, Caption, usePresent } from '@/components/ui'
import { NamesProvider, Overlay, submitted, useNames } from '@/components/console/shared'
import { CanvasGridView, CanvasThumb, ChoiceView, GateView, ResponseCardsView, SorterView, WallView } from '@/components/console/BlockViews'
import { RosterColumn, StudentDetail } from '@/components/console/Roster'
import { MusicToggle } from '@/components/console/MusicToggle'

/**
 * 진행 콘솔 (7차 R · 8차 A 과도기 판).
 *
 * 8차 A 에서 뺀 것: 분기 단추(설명 추가·짝 토론·재응답 요청) · 미제출 알림 · 「수업 후 이어서」 · 판(tier).
 * C 단계에서 `/teach/:classId/:lessonId` 한 화면으로 바뀌고 이 경로는 사라진다.
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
  const [timerMinutes, setTimerMinutes] = useState('')

  const views = useMemo(() => (lesson ? lessonView(lesson) : []), [lesson])
  const stepView = views[stepIndex]
  const step = stepView?.step
  const formationRound = lesson ? formationLessons(currentClass).includes(lesson.id) : false

  useEffect(() => {
    if (!repo || !lesson || !classId) return
    return repo.watchSession(classId, lesson.id, setSession)
  }, [repo, lesson, classId])
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
  useEffect(() => {
    if (!repo || !lesson || !classId) return
    const offs = lesson.steps.map((s) => repo.watchAllResponses(classId, lesson.id, s.id, (docs) => setDocsByStep((prev) => ({ ...prev, [s.id]: docs }))))
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

  const studentUids = useMemo(() => enrollments.filter((e) => e.status === 'active').map((e) => e.uid), [enrollments])
  const activeEnrollments = useMemo(() => enrollments.filter((e) => e.status === 'active'), [enrollments])
  const pairHist = useMemo(() => historyFromDocs(pairHistory), [pairHistory])
  const docs = step ? (docsByStep[step.id] ?? []) : []

  const blocks = useMemo(() => (stepView ? stepBlocks(stepView, { formationRound }) : []), [stepView, formationRound])
  const RESPONSE_KINDS: ConsoleBlock['kind'][] = ['choice', 'input', 'sorter', 'canvas', 'module']
  const selected = blocks.find((b) => b.id === selectedBlockId) ?? blocks.find((b) => RESPONSE_KINDS.includes(b.kind)) ?? blocks.find((b) => b.controls.length > 0) ?? blocks[0] ?? null
  const gates = gatesOf(blocks)
  const revealed = session?.revealed ?? []

  const setSess = useCallback(
    (patch: Partial<SessionState>) => {
      if (!repo || !classId || !lesson) return
      repo.setSession(classId, lesson.id, patch).catch((err) => console.error('[콘솔] 진행 상태를 쓰지 못했다:', err))
    },
    [repo, classId, lesson],
  )

  if (!isInstructor) return <Navigate to="/" replace />
  if (!lesson) return <Navigate to="/instructor/lessons" replace />

  const game = GAMES_BY_LESSON[lesson.id]
  const round = roundForLesson(lesson.id, groupRounds)

  function moveTo(i: number) {
    setStepIndex(i)
    setSelectedBlockId(null)
    const s = views[i]?.step
    if (!s) return
    setSess({ instructorAt: s.id, currentStepId: s.id })
  }
  function toggleGate(gateId: string) {
    const on = revealed.includes(gateId)
    setSess({ revealed: on ? revealed.filter((x) => x !== gateId) : [...revealed, gateId] })
  }
  const openStudent = (uid: string) => setOverlay({ kind: 'student', uid })
  const spotlight = (uid: string, text: string) => setOverlay({ kind: 'spotlight', uid, text })

  return (
    <NamesProvider users={users} enrollments={enrollments} roster={roster} hideNames={hideNames}>
      <AppShell title={`${lesson.id}강 진행 콘솔`}>
        <ProgressBar
          lessonId={lesson.id}
          steps={views.map((v) => v.step)}
          stepIndex={stepIndex}
          onMove={moveTo}
          stepOpen={Boolean(session?.stepOpen)}
          onToggleStep={() => setSess({ stepOpen: !session?.stepOpen })}
          gates={gates.map((g) => ({ ...g, on: revealed.includes(g.id) }))}
          onToggleGate={toggleGate}
          showGroups={formationRound && step?.order === 1}
          onGroups={() => setOverlay({ kind: 'groups' })}
          groupsDone={Boolean(groupRounds.find((r) => r.lessonId === lesson.id))}
          showLadder={Boolean(step?.picker?.enabled && game)}
          onLadder={() => setOverlay({ kind: 'ladder' })}
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

        <div className="console-grid" style={{ marginTop: 24 }}>
          <nav aria-label="이 단계의 블록" className="console-blocks">
            <Caption>{step ? `${step.order}단계 · ${step.title}` : ''}</Caption>
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
              {blocks.map((b) => {
                const count = blockCount(b, docs, studentUids, posts)
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
                  docs={docs}
                  studentUids={studentUids}
                  posts={posts}
                  shares={shares}
                  proposals={proposals}
                  round={round}
                  revealed={revealed}
                  onToggleGate={toggleGate}
                  onSpotlight={spotlight}
                  onOpenStudent={openStudent}
                  onEnlarge={(uid, value) => setOverlay({ kind: 'canvas', uid, value })}
                  onGroups={() => setOverlay({ kind: 'groups' })}
                  onLadder={() => setOverlay({ kind: 'ladder' })}
                />
              </>
            ) : (
              <p className="text-body-sm" style={{ opacity: 0.7 }}>
                이 단계에는 학생이 올리는 블록이 없습니다.
              </p>
            )}
          </section>

          <RosterColumn studentUids={studentUids} docs={docs} onOpenStudent={openStudent} />
        </div>

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
            {isLumiGame(game) ? (
              <LumiTeacher classId={classId} lessonId={lesson.id} stepId={step.id} game={game} session={session} students={activeEnrollments} />
            ) : (
              <LadderPanel classId={classId} lessonId={lesson.id} stepId={step.id} game={game} state={session?.ladders?.[game.id] ?? null} users={users} enrollments={activeEnrollments} participation={participation} groupRound={round} />
            )}
          </Overlay>
        ) : null}
        {overlay?.kind === 'student' ? (
          <Overlay title="학생 응답" onClose={() => setOverlay(null)} wide>
            <StudentDetail uid={overlay.uid} lesson={lesson} docsByStep={docsByStep} />
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
  steps: Array<{ id: string; order: number; shortTitle: string; title: string }>
  stepIndex: number
  onMove: (i: number) => void
  stepOpen: boolean
  onToggleStep: () => void
  gates: Array<{ id: string; label: string; on: boolean }>
  onToggleGate: (id: string) => void
  showGroups: boolean
  groupsDone: boolean
  onGroups: () => void
  showLadder: boolean
  onLadder: () => void
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
        </select>
        <Button variant="tertiary" onClick={() => p.onMove(p.stepIndex + 1)} disabled={p.stepIndex >= p.steps.length - 1} aria-label="다음 단계">
          ›
        </Button>

        <Button onClick={p.onToggleStep} aria-pressed={p.stepOpen}>
          {p.stepOpen ? '단계 닫기' : '단계 열기'}
        </Button>

        {p.gates.map((g) => (
          <Button key={g.id} variant={g.on ? 'primary' : 'secondary'} aria-pressed={g.on} onClick={() => p.onToggleGate(g.id)}>
            {g.on ? '되돌리기' : '자료 공개'} · {g.label}
          </Button>
        ))}

        {p.showGroups ? (
          <Button variant="secondary" onClick={p.onGroups}>
            모둠{p.groupsDone ? ' (확정됨)' : ''}
          </Button>
        ) : null}
        {p.showLadder ? (
          <Button variant="secondary" onClick={p.onLadder}>
            뽑기
          </Button>
        ) : null}

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

        <MusicToggle />
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
  studentUids: string[]
  posts: Post[]
  shares: GroupShare[]
  proposals: AiProposal[]
  round: GroupRound | null
  revealed: string[]
  onToggleGate: (id: string) => void
  onSpotlight: (uid: string, text: string) => void
  onOpenStudent: (uid: string) => void
  onEnlarge: (uid: string, value: { nodes?: Array<{ id: string; label?: string; x: number; y: number }>; edges?: Array<{ from: string; to: string }> }) => void
  onGroups: () => void
  onLadder: () => void
}) {
  const { nameOf } = useNames()
  const b = p.block
  const common = { classId: p.classId, lessonId: p.lesson.id, block: b, docs: p.docs, studentUids: p.studentUids, onSpotlight: p.onSpotlight, onOpenStudent: p.onOpenStudent }
  switch (b.kind) {
    case 'stimulus':
    case 'concepts':
      return (
        <p className="text-body-sm" style={{ opacity: 0.7 }}>
          학생이 읽는 블록입니다. 콘솔에서 할 일은 없습니다.
        </p>
      )
    case 'stimulusReveal':
      return <GateView label={b.material?.title ?? b.label} on={p.revealed.includes(b.gateId!)} onToggle={() => p.onToggleGate(b.gateId!)} />
    case 'choice':
      return <ChoiceView {...common} />
    case 'input':
    case 'module':
      return <ResponseCardsView {...common} proposals={p.proposals} stepTitle={`${p.lesson.id}강 ${p.step.title}`} />
    case 'sorter':
      return <SorterView {...common} shares={p.shares} groupNameOf={(gid) => (p.round?.groups.find((g) => g.id === gid)?.name ? `${gid}모둠 ${p.round!.groups.find((g) => g.id === gid)!.name}` : `${gid}모둠`)} />
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
              [...new Set(p.shares.map((s) => s.groupId))]
                .sort((a, c) => Number(a) - Number(c))
                .map((gid) => (
                  <div key={gid} style={{ marginTop: 12 }}>
                    <Badge solid>{gid}모둠</Badge>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
                      {p.shares
                        .filter((s) => s.groupId === gid)
                        .map((s) => (
                          <li key={s.uid} className="text-body-sm" style={{ padding: '4px 0', boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                            <strong>{nameOf(s.uid)}</strong>
                            {s.headline ? ` · ${s.headline}` : ''} — {s.opinion}
                            {Object.entries(s.extra ?? {}).map(([k, v]) => (
                              <span key={k} style={{ display: 'block', opacity: 0.8 }}>
                                {p.step.fields.find((f) => f.key === k)?.label ?? k} · {v}
                              </span>
                            ))}
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
      return <WallView posts={p.posts} />
    case 'ladder':
      return (
        <div>
          <p className="text-body-sm" style={{ margin: 0 }}>
            {isLumiGame(GAMES_BY_LESSON[p.lesson.id]) ? '이 차시의 발표자는 루미 런(게임)으로 정합니다 — 덮개 화면에서 방 만들기 → 학생 자동 참가 → 시작 → 결과.' : '발표자 뽑기는 덮개 화면에서 합니다 — 후보 확인 → 제외 → 실행 → 결과 → 재추첨 / 수동 지정.'}
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
    groupBuild: '모둠 토의',
    concepts: '개념 카드',
  }
  return map[b.kind]
}

/** 블록 목록 옆의 숫자 — 제출 수 / 학생 수, 의견 광장은 글 수 */
function blockCount(b: ConsoleBlock, docs: ResponseDoc[], studentUids: string[], posts: Post[]): string {
  if (b.kind === 'opinionWall') return `${posts.length}`
  if (b.kind === 'input' || b.kind === 'choice' || b.kind === 'sorter' || b.kind === 'canvas' || b.kind === 'module') {
    const key = b.field?.key ?? '__module'
    const n = docs.filter((d) => submitted(d) && studentUids.includes(d.uid) && hasValue((d.versions[d.versions.length - 1]?.payload as Record<string, unknown>)?.[key])).length
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

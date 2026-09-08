import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getLesson } from '@/content/lessons'
import { GAMES_BY_LESSON } from '@/content/games'
import { useAuth } from '@/lib/auth'
import { buildLessonView, classSessionLength, type TierOverrides } from '@/lib/tiers'
import type {
  AiProposal,
  AppUser,
  Enrollment,
  Participation,
  Post,
  ResponseDoc,
  SessionState,
} from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { DistributionView } from '@/components/response/DistributionView'
import { LadderPanel } from '@/components/teach/LadderPanel'
import { MustSay } from '@/components/teach/MustSay'
import { SubmissionList } from '@/components/teach/SubmissionList'
import { AiClusterPanel } from '@/components/teach/AiClusterPanel'
import { WallCard } from '@/components/wall/Wall'
import { Badge, Button, Caption, Card, ColorBlock, ScrollX } from '@/components/ui'

/**
 * 진행 콘솔.
 *
 * 진행 제어 · 강사 대본 · 제출/미제출 명단 · 익명 분포 · 의견 조정 ·
 * 추첨(제외·재추첨·비상) · 분기 버튼.
 *
 * 학생 순위, 정답률 랭킹, 개인 점수 비교를 넣지 않는다.
 */
export function InstructorLive() {
  const { id } = useParams()
  const { repo, isInstructor, classId, currentClass } = useAuth()
  const lesson = getLesson(id ?? '')
  const [tierOverrides, setTierOverrides] = useState<TierOverrides>({})
  const [stepIndex, setStepIndex] = useState(0)
  const [session, setSession] = useState<SessionState | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [participation, setParticipation] = useState<Participation[]>([])
  const [docs, setDocs] = useState<ResponseDoc[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [proposals, setProposals] = useState<AiProposal[]>([])
  /*
   * 타이머는 남긴다. 강사가 직접 눌러 시작하는 진행 도구이지 차시 설계 표시가 아니다.
   * 다만 기본값을 미리 채워 두지 않는다 (3차 D.3) — 몇 분을 줄지는 그때 정한다.
   */
  const [timerMinutes, setTimerMinutes] = useState('')

  /*
   * 진행 콘솔은 현재 클래스의 판을 따른다 (3차 F.6).
   * 50분 반을 진행하면서 1시간 판의 단계를 제어할 수 있으면 학생 화면과 어긋난다.
   */
  const view = useMemo(
    () =>
      lesson
        ? buildLessonView(lesson, classSessionLength(currentClass), tierOverrides)
        : null,
    [lesson, currentClass, tierOverrides],
  )
  const step = view?.steps[stepIndex]?.step

  /*
   * 강사가 열 수 있는 것을 단계별로 모은다.
   *
   * ★ 예전에는 차시 전체를 한 줄에 쏟아 놓았다. 4단계를 보고 있는데 3단계 자료가
   *   먼저 나와서, 눌러야 할 것 대신 위에 있는 것을 눌렀다. 그러고는
   *   「풀었는데 학생 화면이 그대로다」가 됐다. 단계를 함께 적는다.
   * 자료 블록의 gate 와 입력 칸의 gate 를 id 로 합친다 — 여는 사람도 시점도 같다.
   */
  /*
   * 지금 보고 있는 단계에서 강사가 열 수 있는 것.
   * 자료 블록의 gate 와 입력 칸의 gate 를 id 로 합친다 — 여는 사람도 시점도 같다.
   */
  const stepGates = (() => {
    const found = new Map<string, string>()
    for (const m of step?.material ?? []) {
      if (m.gate && m.gate.type !== 'afterSubmit') found.set(m.gate.of, m.title)
    }
    for (const f of step?.fields ?? []) {
      if (f.gate && f.gate.type !== 'afterSubmit' && !found.has(f.gate.of)) {
        found.set(f.gate.of, f.gate.of === 'secondRound' ? '2차 응답' : f.label)
      }
    }
    return [...found].map(([id, label]) => ({ id, label }))
  })()

  const revealed = session?.revealed ?? []

  useEffect(() => {
    if (!repo || !lesson || !classId) return
    return repo.watchSession(classId, lesson.id, setSession)
  }, [repo, lesson, classId])

  useEffect(() => {
    if (!repo || !classId || !lesson) return
    return repo.watchLessonTiers(classId, lesson.id, setTierOverrides)
  }, [repo, classId, lesson])

  useEffect(() => {
    const n = view?.steps.length ?? 0
    if (n > 0 && stepIndex >= n) setStepIndex(n - 1)
  }, [view, stepIndex])

  useEffect(() => {
    if (!repo || !classId) return
    const a = repo.watchUsers(setUsers)
    const b = repo.watchParticipation(classId, setParticipation)
    const c = repo.watchAiProposals(classId, setProposals)
    const d = repo.watchEnrollments(classId, setEnrollments)
    return () => {
      a()
      b()
      c()
      d()
    }
  }, [repo, classId])

  useEffect(() => {
    if (!repo || !lesson || !step || !classId) return
    const a = repo.watchAllResponses(classId, lesson.id, step.id, setDocs)
    const b = repo.watchPosts(classId, lesson.id, step.id, setPosts)
    return () => {
      a()
      b()
    }
  }, [repo, lesson, step, classId])

  /*
   * ★ 이 클래스에 등록한 사람만 센다.
   *
   * 예전에는 전역 사용자 목록에서 role 이 student 인 사람을 전부 데려왔다.
   * 그래서 클래스에서 내보낸 계정이 콘솔 제출 현황에 그대로 남았다 —
   * 수업 내내 시험 계정 두 개가 미제출로 떠 있었다.
   * 내보내기는 등록 문서를 지우는 일이므로, 등록을 기준으로 세면 곧바로 사라진다.
   * 이름은 여전히 사용자 문서에서 가져온다(닉네임이 거기 있다).
   */
  const students = useMemo(() => {
    const byUid = new Map(users.map((u) => [u.uid, u]))
    return enrollments
      .filter((e) => e.status === 'active')
      .map((e) => byUid.get(e.uid) ?? ({ uid: e.uid, nickname: e.nickname } as AppUser))
  }, [enrollments, users])
  const submittedUids = useMemo(
    () => new Set(docs.filter((d) => (d.latestV ?? 0) > 0).map((d) => d.uid)),
    [docs],
  )

  /** 반응이 갈린 글 — 다음 추첨의 후보 풀로 넘어간다 */
  const splitPosts = useMemo(
    () =>
      posts.filter((p) => {
        const agree = (p.reactions?.agreed ?? []).length
        const disagree = (p.reactions?.disagree ?? []).length
        return agree > 0 && disagree > 0
      }),
    [posts],
  )

  if (!isInstructor) return <Navigate to="/" replace />
  if (!lesson || !view) return <Navigate to="/instructor/lessons" replace />

  const game = GAMES_BY_LESSON[lesson.id]
  const choiceField = step?.fields.find((f) => f.kind === 'choice')
  const reasonKey = step?.fields.find((f) => /reason/i.test(f.key))?.key

  async function moveTo(i: number) {
    setStepIndex(i)
    const s = view!.steps[i]?.step
    if (!s) return
    // 학생 화면을 강제로 옮기지 않는다. 어디에 있는지만 알린다.
    if (classId) await repo?.setSession(classId, lesson!.id, { instructorAt: s.id, currentStepId: s.id })
  }

  return (
    <AppShell
      title={`${lesson.id}강 진행 콘솔`}
      steps={view.steps.map((s) => ({
        id: s.step.id,
        label: s.step.title,
        shortLabel: s.step.shortTitle,
        instructorHere: session?.instructorAt === s.step.id,
      }))}
      activeStepId={step?.id}
      onSelectStep={(sid) => {
        const i = view.steps.findIndex((s) => s.step.id === sid)
        if (i >= 0) void moveTo(i)
      }}
    >
      <p className="eyebrow">진행 콘솔</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        {lesson.id}강 {lesson.title}
      </h1>

      <div className="flex flex-wrap gap-xs" style={{ marginTop: 24 }}>
        <Button
          onClick={() => classId && void repo?.setSession(classId, lesson.id, { stepOpen: !session?.stepOpen })}
        >
          {session?.stepOpen ? '단계 닫기' : '단계 열기'}
        </Button>
        <label className="flex items-center gap-xs">
          <span className="caption">타이머</span>
          <input
            className="field"
            type="number"
            min={1}
            max={90}
            inputMode="numeric"
            aria-label="타이머 길이 (분)"
            value={timerMinutes}
            onChange={(e) => setTimerMinutes(e.target.value)}
            style={{ width: 88 }}
          />
          <span className="caption">분</span>
        </label>
        <Button
          variant="secondary"
          disabled={!(Number(timerMinutes) > 0)}
          onClick={() => {
            const m = Number(timerMinutes)
            if (!(m > 0) || !classId) return
            void repo?.setSession(classId, lesson.id, { timerEndsAt: Date.now() + m * 60 * 1000 })
          }}
        >
          타이머 시작
        </Button>
        <Button
          variant="secondary"
          onClick={() => classId && void repo?.setSession(classId, lesson.id, { timerEndsAt: null })}
        >
          타이머 해제
        </Button>
        <Caption style={{ alignSelf: 'center' }}>
          학생 화면은 강제로 이동하지 않습니다. 안내만 뜹니다.
        </Caption>
      </div>

      {step ? (
        <>
          {/*
            이 단계에서 열 것.

            ★ 예전에는 차시 전체의 잠금을 화면 맨 위에 한꺼번에 늘어놓았다.
              탭을 바꿔도 그 자리는 그대로여서, 지금 단계와 상관없는 단추를 먼저 누르게 됐다.
              콘솔은 지금 하는 단계만 보여 준다. 다른 단계 것은 그 탭으로 가면 나온다.
          */}
          {stepGates.length > 0 ? (
            <div style={{ marginTop: 24 }}>
              <Card>
                <h2 className="text-card-title" style={{ margin: 0 }}>
                  이 단계에서 열 것
                </h2>
                <Caption>누르면 학생 화면의 잠긴 카드가 열립니다. 다시 누르면 잠깁니다.</Caption>
                <div className="flex flex-wrap gap-xs" style={{ marginTop: 12 }}>
                  {stepGates.map((g) => {
                    const on = revealed.includes(g.id)
                    return (
                      <Button
                        key={g.id}
                        variant={on ? 'primary' : 'secondary'}
                        aria-pressed={on}
                        onClick={() => {
                          if (!classId) return
                          const next = on
                            ? revealed.filter((x) => x !== g.id)
                            : [...revealed, g.id]
                          void repo?.setSession(classId, lesson.id, { revealed: next })
                        }}
                      >
                        {on ? '↩ 다시 잠그기 · ' : '▸ 열기 · '}
                        {g.label}
                      </Button>
                    )
                  })}
                </div>
              </Card>
            </div>
          ) : null}

          {/* 제출 / 미제출 명단 — 순위가 아니라 명단이다 */}
          <Card>
            <div className="flex items-center gap-md" style={{ marginBottom: 12 }}>
              <h2 className="text-card-title" style={{ margin: 0 }}>
                제출 현황
              </h2>
              <Badge>
                {submittedUids.size} / {students.length}
              </Badge>
            </div>
            <ScrollX>
              <ul
                className="flex flex-wrap gap-xs"
                style={{ listStyle: 'none', padding: 0, margin: 0 }}
              >
                {students.map((s) => {
                  const done = submittedUids.has(s.uid)
                  return (
                    <li key={s.uid}>
                      <span
                        className="badge"
                        style={done ? { background: '#000', color: '#fff', boxShadow: 'none' } : {}}
                      >
                        {/* 색만으로 구분하지 않는다 */}
                        {done ? '제출 ✓' : '미제출'} · {s.nickname || '이름 없음'}
                      </span>
                    </li>
                  )
                })}
                {students.length === 0 ? (
                  <li className="text-body-sm" style={{ opacity: 0.6 }}>
                    아직 수강생 계정이 없습니다.
                  </li>
                ) : null}
              </ul>
            </ScrollX>
            <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.72 }}>
              제출률이 80% 아래면 분포를 열지 않는 편이 낫습니다.
            </p>
          </Card>

          {/*
            지금 들어온 답 — 모든 단계, 모든 칸 종류에서 보인다.
            「우리 반의 답」은 선택형 칸이 있는 단계에서만, 그것도 개수와 익명 이유 몇 개만 보여 준다.
            1강으로 치면 다섯 단계 중 3단계에만 나왔다 — 나머지 넷에서는 누가 냈는지만 알 수 있었다.
          */}
          <SubmissionList fields={step.fields} docs={docs} users={users} />

          {/*
            고쳐 쓴 답만 따로 모은다.
            수업의 목적이 「생각이 움직였는가」이므로, 움직인 것만 보는 자리가 따로 있어야 한다.
            들어온 답에 섞여 있으면 스무 장 중에서 v2 배지를 눈으로 찾아야 한다.
          */}
          <SubmissionList
            fields={step.fields}
            docs={docs}
            users={users}
            title="고쳐 쓴 답"
            only="revised"
            emptyText="아직 고쳐 쓴 사람이 없습니다."
          />

          {choiceField ? (
            <div style={{ marginTop: 32 }}>
              <Card>
                <DistributionView
                  docs={docs}
                  field={choiceField}
                  reasonKey={reasonKey}
                  totalExpected={students.length}
                />
              </Card>
            </div>
          ) : null}

          {/* AI 유형 묶기 — 제안만 만든다. 채택은 검토대에서. */}
          {step.aiTasks.includes('cluster-responses') ? (
            <div style={{ marginTop: 32 }}>
              <AiClusterPanel
                classId={classId!}
                lessonId={lesson.id}
                stepId={step.id}
                stepTitle={`${lesson.id}강 ${step.title}`}
                docs={docs}
                proposals={proposals}
              />
            </div>
          ) : null}

          {/* 분기 */}
          {/*
            분포를 보고 다음에 할 수 있는 일.

            ★ 예전에는 고르는 단추였다. 그런데 고른 것도 적은 근거도 아무 데도 남지 않았고
              학생 화면도 바뀌지 않았다. 「학생 화면에 안내를 밀어 넣는다」고 적어 두고
              실제로는 pollResults 에 1 을 넣는 것이 전부였다.
              하는 일 없는 단추보다 읽을 목록이 낫다 — 실제로 여는 것은 위의 「자료 공개」다.
            차시마다 써 둔 목록을 그대로 읽는다. 예전에는 이 여섯 개가 화면에 박혀 있어
            어느 차시에서나 같은 말이 나왔다.
          */}
          {step.teacherNextMoves && step.teacherNextMoves.length > 0 ? (
            <div style={{ marginTop: 32 }}>
              <Card>
                <h3 className="text-card-title" style={{ margin: 0 }}>
                  분포를 보고 할 수 있는 것
                </h3>
                <Caption>고르지 않는 것도 선택입니다. 다만 근거가 있어야 합니다.</Caption>
                <ul className="text-body" style={{ margin: '12px 0 0', paddingLeft: 20 }}>
                  {step.teacherNextMoves.map((m) => (
                    <li key={m} style={{ marginBottom: 6 }}>
                      {m}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ) : null}

          {/* 의견 조정 */}
          {step.wall?.enabled ? (
            <div style={{ marginTop: 32 }}>
              <Card>
                <div className="flex items-center gap-md" style={{ marginBottom: 12 }}>
                  <h2 className="text-card-title" style={{ margin: 0 }}>
                    의견 광장 조정
                  </h2>
                  <Badge>{posts.length}개</Badge>
                  {splitPosts.length > 0 ? (
                    <Badge solid>반응이 갈린 글 {splitPosts.length}개</Badge>
                  ) : null}
                </div>
                <p className="text-body-sm" style={{ opacity: 0.72 }}>
                  반응이 갈린 글의 작성자가 다음 추첨의 후보가 됩니다. 삭제는 작성자만 할 수 있고,
                  강사는 숨김만 씁니다.
                </p>
                <div style={{ columnWidth: 300, columnGap: 16, marginTop: 16 }}>
                  {(splitPosts.length > 0 ? splitPosts : posts).slice(0, 12).map((p) => (
                    <WallCard key={p.id} classId={classId!} lessonId={lesson.id} stepId={step.id} post={p} />
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {/*
            강사 대본은 접어서 아래에 둔다.
            수업 중에 콘솔에서 급히 찾는 것은 제출 현황과 학생이 쓴 글이다.
            대본은 준비할 때 읽는 것이라, 늘 펴 두면 정작 볼 것을 아래로 밀어낸다.
          */}
          <details className="no-print" style={{ marginTop: 32 }}>
            <summary className="caption" style={{ cursor: 'pointer' }}>
              강사 대본 — 이 단계에서 할 말 (학생 화면에는 보이지 않습니다)
            </summary>
            <div style={{ marginTop: 12 }}>
              <MustSay lines={lesson.instructorScript} stepId={step.id} isInstructor />
            </div>
          </details>

          {/* 추첨 */}
          {step.picker?.enabled && game ? (
            <div style={{ marginTop: 32 }}>
              <LadderPanel
                classId={classId!}
                lessonId={lesson.id}
                stepId={step.id}
                game={game}
                state={session?.ladders?.[game.id] ?? null}
                users={users}
                participation={participation}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <div style={{ marginTop: 96 }}>
        <ColorBlock tone="navy">
          <p className="eyebrow">이 화면에 없는 것</p>
          <p className="text-subhead" style={{ marginTop: 12, maxWidth: 640 }}>
            학생 순위, 정답률 랭킹, 개인 점수 비교는 만들지 않았습니다. 여기의 자료는 다음 수업을
            정하는 데 쓰고, 학생은 자기 변화를 확인하는 데 씁니다.
          </p>
        </ColorBlock>
      </div>
    </AppShell>
  )
}

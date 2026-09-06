import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getLesson } from '@/content/lessons'
import { GAMES_BY_LESSON } from '@/content/games'
import { useAuth } from '@/lib/auth'
import type { AiProposal, AppUser, Participation, Post, ResponseDoc, SessionState } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { DistributionView } from '@/components/response/DistributionView'
import { LadderPanel } from '@/components/teach/LadderPanel'
import { MustSay } from '@/components/teach/MustSay'
import { TeacherBranchBar } from '@/components/teach/TeacherBranchBar'
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
  const { repo, isInstructor } = useAuth()
  const lesson = getLesson(id ?? '')
  const [stepIndex, setStepIndex] = useState(0)
  const [session, setSession] = useState<SessionState | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [participation, setParticipation] = useState<Participation[]>([])
  const [docs, setDocs] = useState<ResponseDoc[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [proposals, setProposals] = useState<AiProposal[]>([])

  const step = lesson?.steps[stepIndex]

  useEffect(() => {
    if (!repo || !lesson) return
    return repo.watchSession(lesson.id, setSession)
  }, [repo, lesson])

  useEffect(() => {
    if (!repo) return
    const a = repo.watchUsers(setUsers)
    const b = repo.watchParticipation(setParticipation)
    const c = repo.watchAiProposals(setProposals)
    return () => {
      a()
      b()
      c()
    }
  }, [repo])

  useEffect(() => {
    if (!repo || !lesson || !step) return
    const a = repo.watchAllResponses(lesson.id, step.id, setDocs)
    const b = repo.watchPosts(lesson.id, step.id, setPosts)
    return () => {
      a()
      b()
    }
  }, [repo, lesson, step])

  const students = useMemo(() => users.filter((u) => u.role === 'student'), [users])
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
  if (!lesson) return <Navigate to="/instructor/lessons" replace />

  const game = GAMES_BY_LESSON[lesson.id]
  const choiceField = step?.fields.find((f) => f.kind === 'choice')
  const reasonKey = step?.fields.find((f) => /reason/i.test(f.key))?.key

  async function moveTo(i: number) {
    setStepIndex(i)
    const s = lesson!.steps[i]
    // 학생 화면을 강제로 옮기지 않는다. 어디에 있는지만 알린다.
    await repo?.setSession(lesson!.id, { instructorAt: s.id, currentStepId: s.id })
  }

  return (
    <AppShell
      title={`${lesson.id}강 진행 콘솔`}
      steps={lesson.steps.map((s) => ({
        id: s.id,
        label: s.title,
        minutes: s.durationMinutes,
        instructorHere: session?.instructorAt === s.id,
      }))}
      activeStepId={step?.id}
      onSelectStep={(sid) => {
        const i = lesson.steps.findIndex((s) => s.id === sid)
        if (i >= 0) void moveTo(i)
      }}
    >
      <p className="eyebrow">진행 콘솔</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        {lesson.id}강 {lesson.title}
      </h1>

      <div className="flex flex-wrap gap-xs" style={{ marginTop: 24 }}>
        <Button
          onClick={() => void repo?.setSession(lesson.id, { stepOpen: !session?.stepOpen })}
        >
          {session?.stepOpen ? '단계 닫기' : '단계 열기'}
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            void repo?.setSession(lesson.id, { timerEndsAt: Date.now() + 5 * 60 * 1000 })
          }
        >
          5분 타이머
        </Button>
        <Button
          variant="secondary"
          onClick={() => void repo?.setSession(lesson.id, { timerEndsAt: null })}
        >
          타이머 해제
        </Button>
        <Caption style={{ alignSelf: 'center' }}>
          학생 화면은 강제로 이동하지 않습니다. 안내만 뜹니다.
        </Caption>
      </div>

      {step ? (
        <>
          <div style={{ marginTop: 32 }}>
            <MustSay lines={lesson.instructorScript} stepId={step.id} isInstructor />
          </div>

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
                lessonId={lesson.id}
                stepId={step.id}
                stepTitle={`${lesson.id}강 ${step.title}`}
                docs={docs}
                proposals={proposals}
              />
            </div>
          ) : null}

          {/* 분기 */}
          {step.type === 'formative' ? (
            <div style={{ marginTop: 32 }}>
              <TeacherBranchBar
                branches={[
                  '설명 추가',
                  '발문 하나 더',
                  '짝 토론',
                  '재실험 / 자료 추가',
                  '개별 비계',
                  '지금은 넘어가고 다음 차시에 다룬다',
                ]}
                onPush={(branch, note) => {
                  void repo?.setSession(lesson.id, {
                    pollResults: {
                      ...(session?.pollResults ?? {}),
                      [`branch_${step.id}`]: 1,
                    },
                  })
                  console.info('[분기]', branch, note)
                }}
              />
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
                    <WallCard key={p.id} lessonId={lesson.id} stepId={step.id} post={p} />
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {/* 추첨 */}
          {step.picker?.enabled && game ? (
            <div style={{ marginTop: 32 }}>
              <LadderPanel
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

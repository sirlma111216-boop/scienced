import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { LESSONS } from '@/content/lessons'
import type { LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import type { AppUser, PickRecord } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Caption, ColorBlock, ScrollX } from '@/components/ui'

/** 강사 대시보드. */
export function InstructorDashboard() {
  const { repo, isInstructor, classId } = useAuth()
  const [published, setPublished] = useState<LessonId[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [picks, setPicks] = useState<PickRecord[]>([])

  useEffect(() => {
    if (!repo || !classId) return
    const a = repo.watchLessonState(classId, setPublished)
    const b = repo.watchUsers(setUsers)
    const c = repo.watchPicks(classId, setPicks)
    return () => {
      a()
      b()
      c()
    }
  }, [repo, classId])

  if (!isInstructor) return <Navigate to="/" replace />

  const students = users.filter((u) => u.role === 'student')
  const nickname = (uid: string) => users.find((u) => u.uid === uid)?.nickname ?? '참여자'

  return (
    <AppShell title="강사 대시보드">
      <p className="eyebrow">강사</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        대시보드
      </h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginTop: 32,
        }}
      >
        <Link to="/instructor/classes" className="tile" style={{ color: 'inherit' }}>
          <p className="text-card-title" style={{ margin: 0 }}>
            수강 클래스
          </p>
          <p className="text-body-sm" style={{ marginTop: 8 }}>
            학기마다 따로 · 자료가 섞이지 않습니다
          </p>
        </Link>
        <Link to="/instructor/lessons" className="tile" style={{ color: 'inherit' }}>
          <p className="text-card-title" style={{ margin: 0 }}>
            차시
          </p>
          <p className="text-body-sm" style={{ marginTop: 8 }}>
            공개 {published.length} / 18
          </p>
        </Link>
        <Link to="/instructor/students" className="tile" style={{ color: 'inherit' }}>
          <p className="text-card-title" style={{ margin: 0 }}>
            수강생
          </p>
          <p className="text-body-sm" style={{ marginTop: 8 }}>
            {students.length}명
          </p>
        </Link>
        <Link to="/instructor/lesson/01/live" className="tile" style={{ color: 'inherit' }}>
          <p className="text-card-title" style={{ margin: 0 }}>
            1강 진행 콘솔
          </p>
          <p className="text-body-sm" style={{ marginTop: 8 }}>
            분포 · 의견 조정 · 사다리
          </p>
        </Link>
        <Link to="/instructor/analytics" className="tile" style={{ color: 'inherit' }}>
          <p className="text-card-title" style={{ margin: 0 }}>
            학습 분석
          </p>
          <p className="text-body-sm" style={{ marginTop: 8 }}>
            익명 · 순위 없음
          </p>
        </Link>
        <Link to="/instructor/ai-review" className="tile" style={{ color: 'inherit' }}>
          <p className="text-card-title" style={{ margin: 0 }}>
            AI 제안 검토대
          </p>
          <p className="text-body-sm" style={{ marginTop: 8 }}>
            채택 전에는 학생에게 안 나갑니다
          </p>
        </Link>
      </div>

      <section style={{ marginTop: 64 }}>
        <div className="flex items-baseline gap-md" style={{ marginBottom: 16 }}>
          <h2 className="text-card-title" style={{ margin: 0 }}>
            추첨 기록
          </h2>
          <Caption>씨앗·후보·가중치가 함께 남습니다</Caption>
        </div>
        {picks.length === 0 ? (
          <p className="text-body-sm" style={{ opacity: 0.6 }}>
            아직 추첨 기록이 없습니다.
          </p>
        ) : (
          <ScrollX>
            <table style={{ borderCollapse: 'collapse', minWidth: 720, width: '100%' }}>
              <thead>
                <tr>
                  {['차시', '게임', '발표자', '후보', '씨앗', '시각'].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="caption"
                      style={{ textAlign: 'left', padding: '8px 16px 8px 0' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...picks]
                  .sort((a, b) => b.runAt - a.runAt)
                  .slice(0, 20)
                  .map((p) => (
                    <tr key={p.id} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                      <td className="font-mono text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {p.lessonId}
                      </td>
                      <td className="text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {p.gameId}
                      </td>
                      <td className="text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {p.winnerUids.map(nickname).join(', ') || '—'}
                      </td>
                      <td className="font-mono text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {p.candidateUids.length}
                      </td>
                      <td
                        className="font-mono text-caption"
                        style={{ padding: '10px 16px 10px 0', maxWidth: 220, overflow: 'hidden' }}
                      >
                        {p.seed}
                      </td>
                      <td className="text-body-sm" style={{ padding: '10px 0' }}>
                        {new Date(p.runAt).toLocaleString('ko-KR')}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </ScrollX>
        )}
      </section>

      <section style={{ marginTop: 64 }}>
        <h2 className="text-card-title">18차시</h2>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '16px 0 0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {LESSONS.map((l) => (
            <li key={l.id} className="tile">
              <div className="flex items-center gap-xs">
                <span className="font-mono text-caption">{l.id}</span>
                {published.includes(l.id) ? <Badge solid>공개</Badge> : <Badge>미공개</Badge>}
              </div>
              <p className="text-body-sm" style={{ marginTop: 8 }}>
                {l.title}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div style={{ marginTop: 96 }}>
        <ColorBlock tone="lime">
          <p className="eyebrow">완료 판정 기준</p>
          <ol className="text-body" style={{ marginTop: 16, paddingLeft: 20, maxWidth: 720 }}>
            <li>어떤 학습목표와 학생 행동을 지원하는가?</li>
            <li>그 행동이 저장된 자료에서 확인되는가?</li>
            <li>교수자가 그 자료로 수업을 바꿀 수 있는가?</li>
            <li>학생이 자신의 생각을 수정할 기회가 있는가?</li>
            <li>기기·언어·장애 때문에 생기는 불필요한 장벽을 줄였는가?</li>
            <li>개인정보 최소 수집과 삭제가 가능한가?</li>
            <li>AI가 포함되면 결과의 근거와 한계를 사람이 검토할 수 있는가?</li>
          </ol>
        </ColorBlock>
      </div>
    </AppShell>
  )
}

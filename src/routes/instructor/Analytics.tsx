import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { lessonIndex } from '@/content/courses'
import { stepIdsOf } from '@/content/steps'
import { useAuth } from '@/lib/auth'
import { courseOf } from '@/lib/lesson-data'
import type { Enrollment, Participation, Post, ResponseDoc } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { Caption, Card, ColorBlock, Notice, ScrollX } from '@/components/ui'

/**
 * 익명 학습 분석 (강의자 답 7 — 남긴다).
 *
 *  · 체류 시간과 클릭 수를 학습으로 간주하지 않는다. 여기에 아예 없다.
 *  · 학생을 비교해 순위를 만들지 않는다. 이름이 나오지 않는다.
 *  · 8차부터 다시 쓰기가 없으므로 「고쳐 쓴 응답」 통계도 없다. 제출 수·광장 글 수·단계별 제출률·발표 횟수 분포만 본다.
 */

interface Row {
  lessonId: string
  stepId: string
  title: string
  docs: ResponseDoc[]
  posts: Post[]
}

const STEP_LABEL: Record<string, string> = { intro: '도입', concepts: '개념', activity: '활동', 'concepts-2': '개념 2부', 'activity-2': '활동 2', wrapup: '정리' }

export function InstructorAnalytics() {
  const { repo, isInstructor, classId, currentClass } = useAuth()
  const courseId = courseOf(currentClass)
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [participation, setParticipation] = useState<Participation[]>([])

  useEffect(() => {
    if (!repo || !classId) return
    const a = repo.watchEnrollments(classId, setEnrollments)
    const b = repo.watchParticipation(classId, setParticipation)
    return () => {
      a()
      b()
    }
  }, [repo, classId])

  useEffect(() => {
    if (!repo || !classId) return
    const unsubs: Array<() => void> = []
    for (const l of lessonIndex(courseId)) {
      for (const s of stepIdsOf(l.layout)) {
        const key = `${l.id}/${s}`
        const title = `${Number(l.id)}강 ${STEP_LABEL[s] ?? s}`
        unsubs.push(
          repo.watchAllResponses(classId, l.id, s, (docs: ResponseDoc[]) =>
            setRows((prev) => ({ ...prev, [key]: { lessonId: l.id, stepId: s, title, docs, posts: prev[key]?.posts ?? [] } })),
          ),
        )
        if (s.startsWith('activity')) {
          unsubs.push(
            repo.watchPosts(classId, l.id, s, (posts: Post[]) =>
              setRows((prev) => ({ ...prev, [key]: { lessonId: l.id, stepId: s, title, docs: prev[key]?.docs ?? [], posts } })),
            ),
          )
        }
      }
    }
    return () => unsubs.forEach((u) => u())
  }, [repo, classId, courseId])

  const all = useMemo(() => Object.values(rows).filter((r) => r.docs.length > 0 || r.posts.length > 0), [rows])
  const students = enrollments.filter((e) => e.status === 'active').length
  const submitted = all.reduce((n, r) => n + r.docs.filter((d) => (d.versions?.length ?? 0) > 0).length, 0)
  const posts = all.reduce((n, r) => n + r.posts.length, 0)

  const presents = useMemo(() => {
    const counts = participation.map((p) => p.presentCount)
    const by = new Map<number, number>()
    for (const c of counts) by.set(c, (by.get(c) ?? 0) + 1)
    const zero = Math.max(0, students - counts.filter((c) => c > 0).length)
    return [...by.entries()].filter(([k]) => k > 0).sort((a, b) => a[0] - b[0]).concat(zero > 0 ? [[0, zero]] : [])
  }, [participation, students])

  if (!isInstructor) return <Navigate to="/" replace />

  return (
    <AppShell title="학습 분석">
      <p className="eyebrow">강사</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        익명 학습 분석
      </h1>

      <div style={{ marginTop: 24 }}>
        <Notice tone="lime">
          <p className="text-body-sm" style={{ margin: 0 }}>
            <strong>여기에 없는 것</strong> — 체류 시간, 클릭 수, 학생 순위, 정답률, 개인 점수 비교. 이 화면의 숫자는 다음 수업을 정하는 데 쓰고, 학생 개인을 평가하는 데 쓰지 않는다. 이름은 나오지 않는다.
          </p>
        </Notice>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 32 }}>
        {[
          { k: '수강생', v: String(students), n: '등록 인원' },
          { k: '제출된 응답', v: String(submitted), n: '단계 × 사람' },
          { k: '광장 글', v: String(posts), n: '단계마다 한 사람 한 글' },
        ].map((s) => (
          <div key={s.k} className="tile">
            <Caption>{s.k}</Caption>
            <p className="text-display-lg font-mono" style={{ margin: '8px 0 0', fontSize: 40 }}>
              {s.v}
            </p>
            <Caption style={{ marginTop: 4 }}>{s.n}</Caption>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <Card>
          <h2 className="text-card-title" style={{ margin: '0 0 4px' }}>
            발표 횟수 분포
          </h2>
          <Caption>누가 몇 번 발표했는지가 아니라 몇 번 발표한 사람이 몇 명인지를 본다. 0번인 사람이 많으면 다음 게임의 가중치가 그쪽으로 기운다.</Caption>
          {presents.length === 0 ? (
            <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.6 }}>
              아직 발표 기록이 없다.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
              {presents.map(([k, n]) => (
                <li key={k} className="flex items-center gap-sm text-body-sm" style={{ marginBottom: 6 }}>
                  <span style={{ minWidth: 80 }}>{k}번 발표</span>
                  <span aria-hidden style={{ display: 'inline-block', height: 10, width: `${Math.max(4, (n / Math.max(1, students)) * 220)}px`, background: '#000', borderRadius: 9999 }} />
                  <span className="font-mono">{n}명</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 32 }}>
        <Card>
          <h2 className="text-card-title" style={{ margin: '0 0 4px' }}>
            단계별 제출
          </h2>
          <Caption>제출률이 낮은 단계가 위에 온다. 순위가 아니라 읽어 볼 순서다.</Caption>
          <ScrollX>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560, marginTop: 16 }}>
              <thead>
                <tr>
                  {['단계', '제출', '광장 글'].map((h) => (
                    <th key={h} scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 16px 8px 0' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {all
                  .map((r) => ({ r, n: r.docs.filter((d) => (d.versions?.length ?? 0) > 0).length }))
                  .sort((a, b) => a.n - b.n || a.r.lessonId.localeCompare(b.r.lessonId))
                  .map((x) => (
                    <tr key={`${x.r.lessonId}/${x.r.stepId}`} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                      <td className="text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {x.r.title}
                      </td>
                      <td className="font-mono text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {x.n}
                        {students ? ` / ${students}` : ''}
                      </td>
                      <td className="font-mono text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {x.r.posts.length}
                      </td>
                    </tr>
                  ))}
                {all.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-body-sm" style={{ padding: 16, opacity: 0.6 }}>
                      아직 제출된 응답이 없다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </ScrollX>
        </Card>
      </div>

      <div style={{ marginTop: 96 }}>
        <ColorBlock tone="navy">
          <p className="eyebrow">이 숫자들의 한계</p>
          <p className="text-subhead" style={{ marginTop: 12, maxWidth: 720 }}>
            여기 있는 것은 전부 대리 지표다. 제출했다가 잘 썼다는 뜻은 아니다. 이 화면은 어떤 응답을 직접 읽어 볼지 고르는 데 쓰고, 판정은 읽고 나서 사람이 한다.
          </p>
        </ColorBlock>
      </div>
    </AppShell>
  )
}

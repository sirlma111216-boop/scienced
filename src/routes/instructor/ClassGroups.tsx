import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { LessonId } from '@/content/types'
import { indexEntry } from '@/content/courses'
import { FORMATION_QUESTION_BY_ID } from '@/content/formation-questions'
import { useAuth } from '@/lib/auth'
import { DEFAULT_CLASS_SIZE, feasibility, formationLessons, groupCountOf, historyFromDocs, planSchedule, questionForLesson } from '@/lib/groups'
import { courseOf } from '@/lib/lesson-data'
import type { Enrollment, GroupRound, PairHistoryDoc } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { FormationPanel, PairGrid } from '@/components/groups/FormationPanel'
import { Badge, Button, Caption, Card, Notice, ScrollX } from '@/components/ui'

/**
 * 강사 — 모둠 관리 (6차 P.2 · 8차 5절).
 *
 *   모둠 수 설정 + 가능 여부
 *   회차 목록 (대기 / 완료) — 회차마다 아이스브레이킹 질문 하나
 *   실행 → 미리보기 → 확정 — FormationPanel. 수업 화면의 「모둠 나누기」도 같은 부품을 쓴다.
 *   동석 기록 격자
 */
export function InstructorClassGroups() {
  const { classId: classIdParam } = useParams()
  const classId = classIdParam ?? ''
  const { repo, isInstructor, classes } = useAuth()
  const cls = classes.find((c) => c.id === classId) ?? null
  const courseId = courseOf(cls)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [history, setHistory] = useState<PairHistoryDoc[]>([])
  const [rounds, setRounds] = useState<GroupRound[]>([])
  const [openLesson, setOpenLesson] = useState<LessonId | null>(null)
  const [planned, setPlanned] = useState<{ n: number; g: number; rounds: number; repeats: number } | null>(null)

  useEffect(() => {
    if (!repo || !classId) return
    const a = repo.watchEnrollments(classId, setEnrollments)
    const b = repo.watchPairHistory(classId, setHistory)
    const c = repo.watchGroupRounds(classId, setRounds)
    return () => {
      a()
      b()
      c()
    }
  }, [repo, classId])

  const students = useMemo(() => enrollments.filter((e) => e.status === 'active'), [enrollments])
  const lessons = formationLessons(cls, courseId)
  const groupCount = groupCountOf(cls)
  const hist = useMemo(() => historyFromDocs(history), [history])
  const n = students.length || DEFAULT_CLASS_SIZE
  const feas = feasibility(n, groupCount, lessons.length)

  useEffect(() => {
    const uids = students.length > 0 ? students.map((s) => s.uid) : Array.from({ length: n }, (_, i) => `p${i}`)
    const t = setTimeout(() => {
      const p = planSchedule({ uids, groupCount, history: hist, rounds: lessons.length, seed: `preview:${classId}:${groupCount}`, restarts: 1, steps: 120000 })
      setPlanned({ n: uids.length, g: groupCount, rounds: lessons.length, repeats: p.repeats })
    }, 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students.length, groupCount, lessons.length, history.length, classId])

  if (!isInstructor) return <Navigate to="/" replace />
  if (!classId) return <Navigate to="/instructor/classes" replace />

  const roundOf = (lessonId: LessonId) => rounds.find((r) => r.lessonId === lessonId) ?? null

  async function setGroupCount(v: number) {
    if (!repo || !cls) return
    const g = Math.max(2, Math.min(12, Math.round(v)))
    await repo.updateClass(cls.id, { groupCount: g })
  }

  return (
    <AppShell title="모둠 관리">
      <p className="eyebrow">강사</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        모둠 나누기
      </h1>
      <p className="text-body-lg" style={{ marginTop: 12 }}>
        {cls?.displayName ?? classId} ·{' '}
        <Link to={`/instructor/class/${classId}/students`} className="text-link">
          수강생 명단
        </Link>
      </p>

      <div style={{ marginTop: 32 }}>
        <Card>
          <Caption>모둠 수</Caption>
          <div className="flex items-center gap-md" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            <label htmlFor="group-count" className="text-body-sm" style={{ fontWeight: 480 }}>
              모둠 수
            </label>
            <input id="group-count" type="number" min={2} max={12} className="field" style={{ width: 96 }} value={groupCount} disabled={!cls || cls.status === 'archived'} onChange={(e) => void setGroupCount(Number(e.target.value))} />
            <span className="text-body-sm" style={{ opacity: 0.8 }}>
              수강생 {students.length}명{students.length === 0 ? ` (아직 없어 ${DEFAULT_CLASS_SIZE}명으로 계산)` : ''} → 모둠 크기 {feas.size}명 · 나누는 회차 {lessons.length}회 ({lessons.map((l) => `${Number(l)}`).join('·')}강)
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <Notice tone={feas.ok ? 'mint' : 'cream'}>
              <p className="text-body-sm" style={{ margin: 0 }}>
                <strong>계산상</strong> 한 사람이 만나는 총 인원 {lessons.length}×{feas.size - 1} = {feas.meets} {feas.ok ? '≤' : '>'} 가능한 상대 {feas.possible} — {feas.ok ? '중복 없이 나눌 수 있다' : `최소 ${feas.minRepeats}회 중복이 생긴다 (한 사람 기준)`}
              </p>
              <p className="text-body-sm" style={{ margin: '6px 0 0' }}>
                <strong>계획기 예상</strong>{' '}
                {planned && planned.g === groupCount && planned.rounds === lessons.length
                  ? planned.repeats === 0
                    ? '지금 명단으로 계획을 짜 보니 남은 회차 동안 중복 0으로 간다.'
                    : `지금 명단으로 계획을 짜 보니 남은 회차 동안 같은 사람을 다시 만나는 일이 ${planned.repeats}번 있다 (짝 기준 합계).`
                  : '계산 중…'}
                {feas.ok && planned && planned.repeats > 0 ? ' 공식은 필요조건일 뿐이라 이런 조합이 있다 — 판단은 강사가 한다.' : ''}
              </p>
            </Notice>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 32 }}>
        <Caption>회차</Caption>
        <ScrollX>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, minWidth: 560 }}>
            <thead>
              <tr>
                {['회차', '차시', '질문', '상태', ''].map((h) => (
                  <th key={h} className="caption" style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lessons.map((lid, i) => {
                const r = roundOf(lid)
                const q = r ? (FORMATION_QUESTION_BY_ID[r.questionId] ?? questionForLesson(cls, lid)) : questionForLesson(cls, lid)
                return (
                  <tr key={lid} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                    <td className="font-mono text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                      {i + 1}
                    </td>
                    <td className="text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                      {Number(lid)}강 {indexEntry(courseId, lid)?.title ?? ''}
                    </td>
                    <td className="text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                      {q.question}
                    </td>
                    <td style={{ padding: '10px 12px 10px 0' }}>{r ? <Badge solid>완료 · 모둠 {r.groups.length} · 중복 {r.cost}</Badge> : <Badge>대기</Badge>}</td>
                    <td style={{ padding: '10px 0' }}>
                      <Button variant={openLesson === lid ? 'primary' : 'secondary'} onClick={() => setOpenLesson(lid)}>
                        {r ? '보기 · 다시' : '실행'}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollX>
      </div>

      {openLesson ? (
        <div style={{ marginTop: 32 }}>
          <FormationPanel key={openLesson} classId={classId} lessonId={openLesson} cls={cls} students={students} hist={hist} rounds={rounds} />
        </div>
      ) : null}

      <div style={{ marginTop: 32 }}>
        <Caption>동석 기록 — 누가 누구와 몇 번</Caption>
        <p className="text-body-sm" style={{ margin: '4px 0 8px', opacity: 0.75 }}>
          빈칸이 아직 한 번도 안 만난 짝이다. 숫자는 함께한 횟수.
        </p>
        <PairGrid students={students} hist={hist} />
      </div>
    </AppShell>
  )
}

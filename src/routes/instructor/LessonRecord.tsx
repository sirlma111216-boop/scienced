import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { lessonIndex } from '@/content/courses'
import { buildSteps, isConceptStepId, stepLabel } from '@/content/steps'
import type { LessonId, Step } from '@/content/types'
import { answeredUids, attendanceEdit, isAttending } from '@/lib/attendance'
import { useAuth } from '@/lib/auth'
import { checkChoices } from '@/lib/concept-check'
import { summarize } from '@/lib/group-math'
import { attendanceLessonOf, formationLessons, roundForLesson } from '@/lib/groups'
import { courseOf, useLesson } from '@/lib/lesson-data'
import { anonLabels, answerText, lastSubmitted, type NameMode } from '@/lib/lesson-record'
import type { Enrollment, GroupInput, GroupRound, GroupValue, Post, ResponseDoc, SessionState } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { ClassAdminHeader } from '@/components/instructor/ClassAdmin'
import { useRosterNames } from '@/components/instructor/roster-names'
import { Badge, Button, Caption, Card, ColorBlock, Notice, ScrollX } from '@/components/ui'

/**
 * 차시 활동 기록 — 강사만 (강의자 지시 2026-10-09).
 *
 * 한 차시에 학생들이 한 것을 한 장에 모은다: 출석 · 모둠 · 단계마다 낸 답 · 잠깐 확인 · 의견 광장 · 모둠 값 · 발표자.
 * 공모전 증빙용이다 — 이름은 실명 · 닉네임 · 익명(학생 1, 2 …) 가운데 고르고, 인쇄하면 PDF 로 남길 수 있다.
 *
 * ★ 읽기만 한다. 이 화면에는 저장 · 수정 · 삭제가 없다 — 학생이 쓴 것은 낸 그대로 보인다.
 *   repo 의 watch* 만 부르고 쓰기 메서드를 부르지 않는다. verify:record 가 센다.
 */
export function LessonRecord() {
  const { classId: classIdParam = '', lessonId: lessonParam } = useParams()
  const classId = classIdParam
  const navigate = useNavigate()
  const { repo, isInstructor, classes } = useAuth()
  const cls = classes.find((c) => c.id === classId) ?? null
  const courseId = courseOf(cls)
  const index = lessonIndex(courseId)
  const lessonId = (lessonParam && index.some((l) => l.id === lessonParam) ? lessonParam : index[0]?.id) as LessonId
  const { lesson, loading, error } = useLesson(courseId, lessonId, Boolean(lessonId))
  const steps = useMemo(() => (lesson ? buildSteps(lesson) : []), [lesson])
  const formation = formationLessons(cls, courseId)
  const attendanceLessonId = attendanceLessonOf(lessonId, formation)

  const [mode, setMode] = useState<NameMode>('anon')
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [docs, setDocs] = useState<Record<string, ResponseDoc[]>>({})
  const [posts, setPosts] = useState<Record<string, Post[]>>({})
  const [values, setValues] = useState<Record<string, GroupValue[]>>({})
  const [session, setSession] = useState<SessionState | null>(null)
  const [attendSession, setAttendSession] = useState<SessionState | null>(null)
  const [groupInputs, setGroupInputs] = useState<GroupInput[]>([])
  const [rounds, setRounds] = useState<GroupRound[]>([])
  const realName = useRosterNames(isInstructor ? classId : '')

  useEffect(() => {
    if (!repo || !classId || !isInstructor) return
    const offs = [repo.watchEnrollments(classId, setEnrollments), repo.watchGroupRounds(classId, setRounds)]
    return () => offs.forEach((o) => o())
  }, [repo, classId, isInstructor])

  useEffect(() => {
    if (!repo || !classId || !isInstructor || !lessonId) return
    setDocs({})
    setPosts({})
    setValues({})
    const offs = [repo.watchSession(classId, lessonId, setSession), repo.watchGroupInputs(classId, attendanceLessonId, setGroupInputs)]
    if (attendanceLessonId !== lessonId) offs.push(repo.watchSession(classId, attendanceLessonId, setAttendSession))
    else setAttendSession(null)
    for (const s of steps) {
      if (s.fields.length > 0 || isConceptStepId(s.id)) offs.push(repo.watchAllResponses(classId, lessonId, s.id, (list) => setDocs((p) => ({ ...p, [s.id]: list }))))
      if (s.activity) {
        offs.push(repo.watchPosts(classId, lessonId, s.id, (list) => setPosts((p) => ({ ...p, [s.id]: list }))))
        offs.push(repo.watchGroupValues(classId, lessonId, s.id, (list) => setValues((p) => ({ ...p, [s.id]: list }))))
      }
    }
    return () => offs.forEach((o) => o())
  }, [repo, classId, isInstructor, lessonId, attendanceLessonId, steps])

  const people = useMemo(() => enrollments.filter((e) => e.status === 'active'), [enrollments])
  const anon = useMemo(() => anonLabels(people), [people])
  const nameOf = (uid: string) => {
    const e = enrollments.find((x) => x.uid === uid)
    if (mode === 'anon') return anon[uid] ?? '학생'
    if (mode === 'nickname') return e?.nickname || anon[uid] || '학생'
    return `${e?.studentId ?? ''} ${realName(uid) || e?.nickname || ''}`.trim() || '학생'
  }
  const order = (uids: string[]) => [...uids].sort((a, b) => (anon[a] ?? '').localeCompare(anon[b] ?? '', 'ko', { numeric: true }))

  const edit = attendanceEdit((attendanceLessonId === lessonId ? session : attendSession)?.attendance)
  const present = order(people.filter((p) => isAttending(p.uid, answeredUids(groupInputs), edit)).map((p) => p.uid))
  const round = roundForLesson(lessonId, rounds, formation)

  if (!isInstructor) return <Navigate to="/" replace />
  if (!classId) return <Navigate to="/instructor/classes" replace />

  const entry = index.find((l) => l.id === lessonId)

  return (
    <AppShell title="차시 활동 기록">
      <div className="no-print">
        <ClassAdminHeader classId={classId} cls={cls} here="record" />
      </div>

      <div className="no-print flex items-center gap-xs" style={{ marginTop: 24, flexWrap: 'wrap' }}>
        <label htmlFor="record-lesson" className="text-body-sm">
          차시
        </label>
        <select id="record-lesson" className="field" value={lessonId} onChange={(e) => navigate(`/instructor/class/${classId}/record/${e.target.value}`)} style={{ minHeight: 36, padding: '2px 8px' }}>
          {index.map((l) => (
            <option key={l.id} value={l.id}>
              {Number(l.id)}강 {l.title}
            </option>
          ))}
        </select>
        <span className="text-body-sm" style={{ marginLeft: 12 }}>
          이름
        </span>
        {(
          [
            ['anon', '익명 (학생 1, 2 …)'],
            ['nickname', '닉네임'],
            ['real', '학번 · 실명'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" className="tab" aria-pressed={mode === k} data-selected={mode === k} onClick={() => setMode(k)}>
            {label}
          </button>
        ))}
        <Button variant="secondary" onClick={() => window.print()}>
          인쇄 · PDF
        </Button>
      </div>
      <p className="no-print text-body-sm" style={{ margin: '8px 0 0', opacity: 0.75 }}>
        학생이 낸 것을 그대로 보여 줍니다. 이 화면에서는 아무것도 고치거나 지우지 않습니다. 강사만 볼 수 있습니다.
      </p>

      {loading ? <p className="text-body" style={{ marginTop: 24 }}>불러오는 중…</p> : null}
      {error ? (
        <div style={{ marginTop: 24 }}>
          <Notice tone="cream">
            <p className="text-body" style={{ margin: 0 }}>
              차시 내용을 불러오지 못했습니다 — {error}. 화면을 새로 고치세요.
            </p>
          </Notice>
        </div>
      ) : null}

      {lesson && entry ? (
        <article style={{ marginTop: 24 }}>
          <ColorBlock tone="lilac">
            <p className="eyebrow" style={{ margin: 0 }}>
              {cls?.displayName ?? ''} · 차시 활동 기록
            </p>
            <h1 className="text-display-lg" style={{ margin: '8px 0 0' }}>
              {Number(lesson.id)}강 {lesson.title}
            </h1>
            <p className="text-body-lg" style={{ marginTop: 8 }}>
              {lesson.centralQuestion}
            </p>
            <div className="flex gap-xs" style={{ marginTop: 12, flexWrap: 'wrap' }}>
              <Badge solid>
                출석 {present.length} / {people.length}
              </Badge>
              {round ? <Badge>모둠 {round.groups.length}개</Badge> : null}
              <Badge>{mode === 'anon' ? '익명 표기' : mode === 'nickname' ? '닉네임 표기' : '학번 · 실명 표기'}</Badge>
            </div>
            <Caption>출력 {new Date().toLocaleString('ko-KR')}</Caption>
          </ColorBlock>

          {round ? (
            <Section title="모둠">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {round.groups.map((g) => (
                  <li key={g.id} className="text-body-sm">
                    <strong>{g.name}</strong> — {order(g.memberUids).map(nameOf).join(', ')}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {steps.map((s) => (
            <StepRecord key={s.id} step={s} layoutLabel={stepLabel(lesson.layout, s.id)} docs={docs[s.id] ?? []} posts={posts[s.id] ?? []} values={values[s.id] ?? []} presentCount={present.length} nameOf={nameOf} order={order} round={round} session={session} />
          ))}
        </article>
      ) : null}
    </AppShell>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 24, breakInside: 'avoid-page' }}>
      <Card>
        <p className="text-card-title" style={{ margin: 0 }}>
          {title}
        </p>
        <div style={{ marginTop: 12 }}>{children}</div>
      </Card>
    </section>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid #000', verticalAlign: 'bottom' }
const td: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid #e5e5e5', verticalAlign: 'top', whiteSpace: 'pre-wrap' }

function StepRecord({
  step,
  layoutLabel,
  docs,
  posts,
  values,
  presentCount,
  nameOf,
  order,
  round,
  session,
}: {
  step: Step
  layoutLabel: string
  docs: ResponseDoc[]
  posts: Post[]
  values: GroupValue[]
  presentCount: number
  nameOf: (uid: string) => string
  order: (uids: string[]) => string[]
  round: GroupRound | null
  session: SessionState | null
}) {
  const submitted = docs.map((d) => ({ uid: d.uid, last: lastSubmitted(d) })).filter((x) => x.last) as Array<{ uid: string; last: { payload: Record<string, unknown>; at: number } }>
  const byUid = new Map(submitted.map((x) => [x.uid, x.last]))
  const uids = order(submitted.map((x) => x.uid))
  const title = step.activity?.task ?? step.prompt ?? ''

  /* 개념 — 잠깐 확인 */
  if (isConceptStepId(step.id)) {
    const cards = step.concepts.filter((c) => c.check)
    if (cards.length === 0) return null
    return (
      <Section title={`${layoutLabel} — 잠깐 확인`}>
        <ScrollX>
          <table className="text-body-sm" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>카드</th>
                <th style={th}>푼 사람</th>
                <th style={th}>맞힌 사람</th>
                <th style={th}>①</th>
                <th style={th}>②</th>
                <th style={th}>③</th>
                <th style={th}>④</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => {
                const picks = docs.map((d) => checkChoices(d)[c.id]).filter((x) => x !== undefined)
                const counts = [0, 1, 2, 3].map((i) => picks.filter((p) => p === i).length)
                const right = c.check!.answer
                return (
                  <tr key={c.id}>
                    <td style={td}>{c.name}</td>
                    <td style={td}>{picks.length}</td>
                    <td style={td}>{typeof right === 'number' ? `${counts[right]} (${picks.length ? Math.round((counts[right] / picks.length) * 100) : 0}%)` : '—'}</td>
                    {counts.map((n, i) => (
                      <td key={i} style={{ ...td, fontWeight: i === right ? 600 : 400 }}>
                        {n}
                        {i === right ? ' ✓' : ''}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollX>
        <Caption>✓ 는 정답 보기입니다. 학생 이름은 싣지 않습니다.</Caption>
      </Section>
    )
  }

  const game = session?.games?.[step.id]?.result ?? null
  const ladder = Object.values(session?.ladders ?? {}).find((l) => l && l.phase === 'done' && l.gameId?.includes(step.id))
  const winners = game?.winnerUids ?? ladder?.winnerUids ?? []
  const groupName = (gid: string) => round?.groups.find((g) => g.id === gid)?.name ?? gid

  if (step.fields.length === 0 && !step.activity) return null

  return (
    <Section title={`${layoutLabel}${title ? ` — ${title}` : ''}`}>
      <Caption>
        낸 사람 {submitted.length} / 출석 {presentCount}
      </Caption>
      {step.fields.length > 0 ? (
        uids.length === 0 ? (
          <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.7 }}>
            아직 낸 사람이 없습니다.
          </p>
        ) : (
          <ScrollX>
            <table className="text-body-sm" style={{ borderCollapse: 'collapse', width: '100%', marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ ...th, whiteSpace: 'nowrap' }}>학생</th>
                  {step.fields.map((f) => (
                    <th key={f.key} style={th}>
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uids.map((u) => {
                  const p = byUid.get(u)!.payload
                  return (
                    <tr key={u}>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{nameOf(u)}</td>
                      {step.fields.map((f) => (
                        <td key={f.key} style={td}>
                          {answerText(f, p[f.key]) || '—'}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollX>
        )
      ) : null}

      {posts.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <p className="text-body-sm" style={{ margin: 0, fontWeight: 600 }}>
            의견 광장 {posts.length}
          </p>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {[...posts]
              .sort((a, b) => a.createdAt - b.createdAt)
              .map((p) => (
                <li key={p.id} className="text-body-sm" style={{ whiteSpace: 'pre-wrap' }}>
                  <strong>{nameOf(p.uid)}</strong> — {p.versions[p.versions.length - 1]?.content ?? ''}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {values.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <p className="text-body-sm" style={{ margin: 0, fontWeight: 600 }}>
            모둠이 정한 것
          </p>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {values.map((v) => (
              <li key={v.groupId} className="text-body-sm" style={{ whiteSpace: 'pre-wrap' }}>
                <strong>{groupName(v.groupId)}</strong> — {groupValueText(v, nameOf, docs, step, round)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {winners.length > 0 ? (
        <p className="text-body-sm" style={{ margin: '16px 0 0' }}>
          <strong>발표자</strong> — {winners.map(nameOf).join(', ')}
          {game?.reason ? ` (${game.reason})` : ''}
        </p>
      ) : null}
    </Section>
  )
}

/** 모둠 값 — 문장은 그대로, 투표는 대표가 고른 사람의 이유, 계산값은 짧게 */
function groupValueText(v: GroupValue, nameOf: (uid: string) => string, docs: ResponseDoc[], step: Step, round: GroupRound | null): string {
  if (v.format === 'sentence') return typeof v.value === 'string' ? v.value : String(v.value ?? '')
  if (v.format === 'vote') {
    const uid = typeof v.value === 'string' ? v.value : ''
    const reasonKey = step.activity && 'group' in step.activity ? step.activity.group?.reasonKey : undefined
    const doc = docs.find((d) => d.uid === uid)
    const reason = reasonKey ? String(lastSubmitted(doc)?.payload[reasonKey] ?? '') : ''
    return uid ? `대표 이유: ${nameOf(uid)}${reason ? ` — ${reason}` : ''}` : '대표가 아직 고르지 않음'
  }
  /* 배분 · 순위 · 분류 — 그 모둠원이 낸 값으로 요약 (group-math 의 summarize, 모둠 화면과 같은 계산) */
  const fieldKey = step.activity && 'group' in step.activity ? step.activity.group?.fieldKey : undefined
  const field = step.fields.find((f) => f.key === fieldKey)
  const members = round?.groups.find((g) => g.id === v.groupId)?.memberUids ?? []
  if (field) {
    const mv = members.flatMap((u) => {
      const p = lastSubmitted(docs.find((d) => d.uid === u))?.payload
      return p && p[field.key] !== undefined ? [{ uid: u, nickname: '', value: p[field.key] }] : []
    })
    return summarize(v.format, field, mv)
  }
  return typeof v.value === 'string' ? v.value : '모둠 값이 있다'
}

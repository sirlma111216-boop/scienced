import { useEffect, useMemo, useState } from 'react'
import type { LessonId } from '@/content/types'
import { FORMATION_QUESTIONS } from '@/content/formation-questions'
import { answeredUids, attendanceEdit, attendingStudents, withAttendance } from '@/lib/attendance'
import { useAuth } from '@/lib/auth'
import { courseOf } from '@/lib/lesson-data'
import {
  decodePlan,
  encodePlan,
  formationLessons,
  groupCountOf,
  groupSizes,
  historyWithoutRound,
  nameGroups,
  pairCount,
  placeLateJoiner,
  questionForLesson,
  roundNumberOf,
  runAssignment,
} from '@/lib/groups'
import type { PairRecord } from '@shared/groups-core'
import type { ClassDoc, Enrollment, GroupInput, GroupRound, GroupRoundGroup, SessionState } from '@/lib/types'
import { Badge, Button, Caption, Card, ScrollX } from '@/components/ui'

/**
 * 강사 — 한 차시의 모둠 나누기: 질문 → 학생 선택 → 서버 배정 → 미리보기·옮기기 → 확정 (8차 5.2).
 *
 * 수업 화면(/teach)의 「모둠 나누기」와 모둠 관리 화면이 같은 부품을 쓴다.
 * 늦게 온 학생·동석 기록은 6차 그대로. 게임만 질문으로 바뀌었다.
 * 「반드시 같이/따로」 고정 규칙은 강의자 지시로 뺐다 (2026-09-18).
 *
 * 배정 대상은 **오늘의 질문에 답한 사람**이다 (강의자 지시 2026-09-22 · lib/attendance.ts).
 * 결석자를 하나씩 빼던 자리가 출석 체크로 바뀌었다 — 답한 사람이 켜져 있고, 못 누른 사람만 손으로 넣는다.
 * 그 손질은 세션 문서에 남아 수업 화면의 분모와 같은 값을 쓴다.
 */

type Preview = {
  lessonId: LessonId
  round: number
  seed: string
  groups: GroupRoundGroup[]
  absentUids: string[]
  cost: number
  plannedNext: string[][][]
  followedPlan: boolean
  fromServer: boolean
  manualEdits: GroupRound['manualEdits']
}

export function FormationPanel({
  classId,
  lessonId,
  cls,
  students,
  hist,
  rounds,
  showPairs = false,
}: {
  classId: string
  lessonId: LessonId
  cls: ClassDoc | null
  students: Enrollment[]
  hist: Record<string, PairRecord>
  rounds: GroupRound[]
  showPairs?: boolean
}) {
  const { repo, user } = useAuth()
  const [inputs, setInputs] = useState<GroupInput[]>([])
  const [session, setSession] = useState<SessionState | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [lateUid, setLateUid] = useState('')
  const [countDraft, setCountDraft] = useState<string | null>(null)

  useEffect(() => {
    if (!repo || !classId || !lessonId) return
    const offs = [repo.watchGroupInputs(classId, lessonId, setInputs), repo.watchSession(classId, lessonId, setSession)]
    return () => offs.forEach((off) => off())
  }, [repo, classId, lessonId])

  const nameOf = useMemo(() => Object.fromEntries(students.map((s) => [s.uid, s.nickname || '이름 없음'])) as Record<string, string>, [students])
  const courseId = courseOf(cls)
  const lessons = formationLessons(cls, courseId)
  const groupCount = groupCountOf(cls)
  const question = questionForLesson(cls, lessonId)
  const round = rounds.find((r) => r.lessonId === lessonId) ?? null
  const roundNo = roundNumberOf(lessonId, lessons)
  /* 출석 = 오늘의 질문에 답한 사람 + 강사가 손으로 넣은 사람 (lib/attendance.ts) */
  const edit = attendanceEdit(session?.attendance)
  const answered = answeredUids(inputs)
  const attendees = attendingStudents(students, inputs, edit)
  const absentees = students.filter((s) => !attendees.some((a) => a.uid === s.uid))

  async function setAttending(uid: string, attending: boolean) {
    if (!repo) return
    try {
      await repo.setSession(classId, lessonId, { attendance: withAttendance(edit, uid, answered.has(uid), attending) })
    } catch (err) {
      console.error('[출석] 고치지 못했다:', err)
      setNote(`출석을 고치지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function saveGroupCount(raw: string) {
    setCountDraft(null)
    if (!repo || !cls) return
    const v = Number(raw)
    if (!Number.isFinite(v)) return
    const g = Math.max(2, Math.min(12, Math.round(v)))
    if (g === groupCount) return
    try {
      await repo.updateClass(cls.id, { groupCount: g })
      setNote(`모둠 수를 ${g}개로 바꿨습니다. 다음 배정부터 적용됩니다.`)
    } catch (err) {
      console.error('[모둠 수] 저장하지 못했다:', err)
      setNote(`모둠 수를 저장하지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  async function pickQuestion(qid: string) {
    if (!repo || !cls) return
    try {
      await repo.updateClass(cls.id, { formationQuestions: { ...(cls.formationQuestions ?? {}), [lessonId]: qid } })
    } catch (err) {
      console.error('[모둠 질문] 저장하지 못했다:', err)
    }
  }
  const sizes = groupSizes(Math.max(attendees.length, groupCount), groupCount)
  const sizeText = sizes.length === 0 ? '' : Math.min(...sizes) === Math.max(...sizes) ? `${sizes[0]}명` : `${Math.min(...sizes)}~${Math.max(...sizes)}명`

  async function run() {
    if (!repo || !user || !roundNo) return
    setBusy(true)
    setNote(null)
    const t0 = Date.now()
    try {
      const prev = rounds.filter((r) => r.round < roundNo).sort((a, b) => b.round - a.round)[0] ?? null
      const history = round ? historyWithoutRound(hist, round.groups.map((g) => g.memberUids)) : hist
      const res = await runAssignment({
        classId,
        lessonId,
        uids: attendees.map((s) => s.uid),
        groupCount,
        history,
        round: roundNo,
        roundsAhead: lessons.length - roundNo + 1,
        inputs: inputs.filter((i) => i.questionId === question.id),
        plannedRemaining: decodePlan(prev?.plannedNext),
        planStale: prev ? !prev.followedPlan : false,
      })
      setPreview({
        lessonId,
        round: roundNo,
        seed: res.seed,
        groups: nameGroups(question, res.groups, inputs),
        absentUids: absentees.map((s) => s.uid),
        cost: res.repeats,
        plannedNext: res.plannedNext,
        followedPlan: res.followedPlan,
        fromServer: res.fromServer,
        manualEdits: [],
      })
      setNote(`배정했습니다 (${((Date.now() - t0) / 1000).toFixed(1)}초 · ${res.fromServer ? '서버 시드' : '로컬 시드'}). 확정 전에 미리 보고 옮길 수 있습니다.`)
    } catch (err) {
      console.error('[모둠 배정] 실패:', err)
      setNote(`배정하지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  function move(uid: string, toGroup: string) {
    if (!preview) return
    const from = preview.groups.find((g) => g.memberUids.includes(uid))
    if (!from || from.id === toGroup) return
    const groups = preview.groups.map((g) => ({
      ...g,
      memberUids: g.id === from.id ? g.memberUids.filter((u) => u !== uid) : g.id === toGroup ? [...g.memberUids, uid] : g.memberUids,
    }))
    setPreview({ ...preview, groups, manualEdits: [...preview.manualEdits, { uid, fromGroup: from.id, toGroup, at: Date.now() }], followedPlan: false })
  }

  async function confirm() {
    if (!preview || !repo || !user) return
    setBusy(true)
    try {
      const next: GroupRound = {
        id: `${classId}-${preview.lessonId}`,
        round: preview.round,
        lessonId: preview.lessonId,
        questionId: question.id,
        groups: preview.groups,
        absentUids: preview.absentUids,
        seed: preview.seed,
        cost: preview.cost,
        createdBy: user.uid,
        createdAt: Date.now(),
        manualEdits: preview.manualEdits,
        plannedNext: encodePlan(preview.plannedNext),
        followedPlan: preview.followedPlan,
        lateJoins: [],
      }
      await repo.confirmGroupRound(classId, next)
      setPreview(null)
      setNote(`${Number(preview.lessonId)}강 모둠을 확정했습니다. 학생 화면에 모둠 카드가 뜹니다.`)
    } catch (err) {
      console.error('[모둠 확정] 실패:', err)
      setNote(`확정하지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function joinLate(r: GroupRound) {
    if (!repo || !lateUid) return
    const idx = placeLateJoiner(r.groups.map((g) => g.memberUids), lateUid, hist, r.round)
    const target = r.groups[idx]
    try {
      await repo.addLateJoiner(classId, r.id, lateUid, target.id)
      setNote(`${nameOf[lateUid] ?? lateUid} 님을 「${target.name}」에 넣었습니다 — 중복이 가장 적게 느는 자리입니다.`)
      setLateUid('')
    } catch (err) {
      console.error('[지각 합류] 실패:', err)
      setNote(`넣지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (!roundNo) {
    return (
      <Card>
        <p className="text-body-sm" style={{ margin: 0, opacity: 0.75 }}>
          이 차시는 모둠을 나누는 회차가 아닙니다. 지난 회차의 모둠을 그대로 씁니다.
        </p>
      </Card>
    )
  }

  const usedElsewhere = new Set(Object.entries(cls?.formationQuestions ?? {}).filter(([lid]) => lid !== lessonId).map(([, q]) => q))

  return (
    <Card>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge>{roundNo}회차</Badge>
        <h2 className="text-card-title" style={{ margin: 0 }}>
          모둠 나누기
        </h2>
        {round ? <Badge solid>확정됨 · 모둠 {round.groups.length}</Badge> : <Badge>아직 안 나눔</Badge>}
      </div>

      {/* 질문 — 학기 안에 되풀이하지 않는다 */}
      <div className="flex items-center gap-xs" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <label htmlFor={`fq-${lessonId}`} className="text-body-sm" style={{ fontWeight: 480 }}>
          질문
        </label>
        <select id={`fq-${lessonId}`} className="field" style={{ maxWidth: 360 }} value={question.id} disabled={Boolean(round) || busy} onChange={(e) => void pickQuestion(e.target.value)}>
          {FORMATION_QUESTIONS.map((q) => (
            <option key={q.id} value={q.id} disabled={usedElsewhere.has(q.id)}>
              {q.question}
              {usedElsewhere.has(q.id) ? ' (이미 씀)' : ''}
            </option>
          ))}
        </select>
        <span className="text-body-sm" role="status">
          답한 사람 <strong>{answered.size} / {students.length}명</strong>. 답한 사람이 오늘 출석이고, 그 사람들만 모둠에 들어갑니다.
        </span>
      </div>

      <div className="flex items-center gap-xs" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <label htmlFor={`group-count-${lessonId}`} className="text-body-sm" style={{ fontWeight: 480 }}>
          모둠 수
        </label>
        <input
          id={`group-count-${lessonId}`}
          type="number"
          min={2}
          max={12}
          inputMode="numeric"
          className="field"
          style={{ width: 88 }}
          value={countDraft ?? String(groupCount)}
          disabled={!cls || cls.status === 'archived' || busy}
          onChange={(e) => setCountDraft(e.target.value)}
          onBlur={(e) => void saveGroupCount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            void saveGroupCount((e.target as HTMLInputElement).value)
          }}
        />
        <span className="text-body-sm" style={{ opacity: 0.8 }}>
          출석 {attendees.length}명 → 모둠 크기 {sizeText}
          {round && round.groups.length !== groupCount ? ` · 확정된 모둠은 ${round.groups.length}개 — 바꾸려면 다시 나눕니다` : ''}
        </span>
      </div>

      {round && !preview ? <RoundSummary round={round} nameOf={nameOf} /> : null}

      <div style={{ marginTop: 20 }}>
        <Caption>출석 — 오늘의 질문에 답하면 켜집니다. 못 누른 사람은 여기서 넣습니다</Caption>
        <ul className="flex flex-wrap gap-xs" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
          {students.map((s) => {
            const here = attendees.some((a) => a.uid === s.uid)
            return (
              <li key={s.uid}>
                <label className="text-body-sm flex items-center gap-xxs" style={{ padding: '4px 8px', boxShadow: `inset 0 0 0 1px ${here ? '#111' : '#e6e6e6'}`, borderRadius: 999, opacity: here ? 1 : 0.6 }}>
                  <input type="checkbox" checked={here} onChange={(e) => void setAttending(s.uid, e.target.checked)} />
                  {s.nickname || '이름 없음'}
                  {answered.has(s.uid) ? (
                    <span aria-label="답함" style={{ opacity: 0.6 }}>
                      ✓
                    </span>
                  ) : null}
                </label>
              </li>
            )
          })}
        </ul>
        <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.75 }}>
          ✓ 는 스스로 답한 사람입니다. 체크만 된 사람은 강사가 넣은 사람입니다. 지금 배정 대상 {attendees.length}명 · 빠지는 사람 {absentees.length}명.
        </p>
      </div>

      <div className="flex items-center gap-md" style={{ marginTop: 20, flexWrap: 'wrap' }}>
        <Button onClick={() => void run()} disabled={busy || attendees.length < 2}>
          {busy ? '배정 중' : preview ? '다시 배정' : round ? '다시 나누기' : '배정 실행'}
        </Button>
        {attendees.length < 2 ? (
          <span className="text-body-sm" style={{ opacity: 0.75 }}>
            아직 답한 사람이 {attendees.length}명입니다. 학생 화면 첫 단계의 질문에 답하면 여기에 쌓입니다.
          </span>
        ) : null}
        {round && !preview ? (
          <span className="text-body-sm" style={{ opacity: 0.7 }}>
            다시 나누면 확정된 모둠과 동석 기록이 새 결과로 바뀝니다.
          </span>
        ) : null}
        {note ? (
          <span className="text-body-sm" role="status">
            {note}
          </span>
        ) : null}
      </div>

      {preview ? (
        <div style={{ marginTop: 20 }}>
          <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
            <Caption>미리보기</Caption>
            <Badge>중복 {preview.cost}</Badge>
            <Badge>{preview.followedPlan ? '계획대로' : '계획에서 벗어남'}</Badge>
            <span className="font-mono text-caption" style={{ opacity: 0.7 }}>
              시드 {preview.seed}
            </span>
          </div>
          <div className="flex flex-wrap gap-md" style={{ marginTop: 12 }}>
            {preview.groups.map((g) => {
              const pairs: Array<[string, string]> = []
              for (let i = 0; i < g.memberUids.length; i++) for (let j = i + 1; j < g.memberUids.length; j++) pairs.push([g.memberUids[i], g.memberUids[j]])
              const fresh = pairs.filter(([a, b]) => pairCount(hist, a, b) === 0).length
              return (
                <div key={g.id} className="rounded-md" style={{ padding: 12, boxShadow: 'inset 0 0 0 1px #e6e6e6', flex: '1 1 200px' }}>
                  <p className="text-body-sm" style={{ margin: 0, fontWeight: 600 }}>
                    {g.name} <span style={{ opacity: 0.6 }}>· {g.memberUids.length}명</span>
                  </p>
                  <p className="text-caption" style={{ margin: '2px 0 0', opacity: 0.75 }}>
                    처음 만나는 짝 {fresh} / {pairs.length}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                    {g.memberUids.map((uid) => (
                      <li key={uid} className="flex items-center gap-xs" style={{ marginBottom: 4 }}>
                        <span className="text-body-sm" style={{ flex: 1 }}>
                          {nameOf[uid] ?? uid}
                          <span className="caption" style={{ marginLeft: 6, opacity: 0.6 }}>
                            {inputs.find((i) => i.uid === uid)?.choice ?? ''}
                          </span>
                        </span>
                        <select className="field" style={{ width: 120, minHeight: 32, padding: '2px 6px', fontSize: 12 }} value={g.id} aria-label={`${nameOf[uid] ?? uid} 옮기기`} onChange={(e) => move(uid, e.target.value)}>
                          {preview.groups.map((o) => (
                            <option key={o.id} value={o.id}>
                              → {o.name}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
          {preview.manualEdits.length > 0 ? (
            <p className="text-body-sm" style={{ marginTop: 8, opacity: 0.75 }}>
              수동 조정 {preview.manualEdits.length}건 — 확정하면 기록에 남습니다.
            </p>
          ) : null}
          <div className="flex items-center gap-md" style={{ marginTop: 16 }}>
            <Button onClick={() => void confirm()} disabled={busy}>
              확정
            </Button>
            <Button variant="secondary" onClick={() => setPreview(null)} disabled={busy}>
              버리기
            </Button>
          </div>
        </div>
      ) : null}

      {round && !preview ? (
        <div style={{ marginTop: 20 }}>
          <Caption>늦게 온 학생 넣기</Caption>
          <div className="flex items-center gap-xs" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            <select className="field" style={{ width: 200 }} value={lateUid} onChange={(e) => setLateUid(e.target.value)} aria-label="늦게 온 학생">
              <option value="">사람 고르기</option>
              {students
                .filter((s) => !round.groups.some((g) => g.memberUids.includes(s.uid)))
                .map((s) => (
                  <option key={s.uid} value={s.uid}>
                    {s.nickname || '이름 없음'}
                  </option>
                ))}
            </select>
            <Button variant="secondary" onClick={() => void joinLate(round)} disabled={!lateUid}>
              비용이 가장 적게 느는 모둠에 넣기
            </Button>
          </div>
        </div>
      ) : null}

      {showPairs ? (
        <div style={{ marginTop: 24 }}>
          <Caption>동석 기록 — 누가 누구와 몇 번. 빈칸이 아직 한 번도 안 만난 짝</Caption>
          <div style={{ marginTop: 8 }}>
            <PairGrid students={students} hist={hist} />
          </div>
        </div>
      ) : null}
    </Card>
  )
}

export function PairGrid({ students, hist }: { students: Enrollment[]; hist: Record<string, { count: number; lastRound: number }> }) {
  if (students.length === 0)
    return (
      <p className="text-body-sm" style={{ opacity: 0.7 }}>
        수강생이 없습니다.
      </p>
    )
  const short = (s: string) => (s.length > 4 ? `${s.slice(0, 4)}…` : s)
  return (
    <ScrollX>
      <table className="font-mono" style={{ borderCollapse: 'collapse', fontSize: 11 }} aria-label="동석 기록 격자">
        <thead>
          <tr>
            <th style={{ padding: 2 }} />
            {students.map((s) => (
              <th key={s.uid} scope="col" style={{ padding: 2, writingMode: 'vertical-rl', textAlign: 'left', fontWeight: 400, maxHeight: 64 }}>
                {short(s.nickname || '?')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((a) => (
            <tr key={a.uid}>
              <th scope="row" style={{ padding: '2px 6px 2px 0', textAlign: 'right', fontWeight: 400, whiteSpace: 'nowrap' }}>
                {short(a.nickname || '?')}
              </th>
              {students.map((b) => {
                if (a.uid === b.uid) return <td key={b.uid} style={{ background: '#f1f1f1', width: 18, height: 18 }} />
                const c = pairCount(hist, a.uid, b.uid)
                return (
                  <td key={b.uid} title={`${a.nickname} · ${b.nickname} — ${c}번`} style={{ width: 18, height: 18, textAlign: 'center', boxShadow: 'inset 0 0 0 1px #eee', background: c === 0 ? '#fff' : c === 1 ? '#e8f4ec' : '#f6d9d9' }}>
                    {c === 0 ? '' : c}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  )
}

export function RoundSummary({ round, nameOf }: { round: GroupRound; nameOf: Record<string, string> }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Caption>확정된 모둠</Caption>
        <Badge>중복 {round.cost}</Badge>
        <Badge>{round.followedPlan ? '계획대로' : '계획에서 벗어남'}</Badge>
        {round.manualEdits.length > 0 ? <Badge>수동 조정 {round.manualEdits.length}</Badge> : null}
        <span className="font-mono text-caption" style={{ opacity: 0.7 }}>
          시드 {round.seed}
        </span>
      </div>
      <ul className="flex flex-wrap gap-xs" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
        {round.groups.map((g) => (
          <li key={g.id} className="text-body-sm rounded-md" style={{ padding: '6px 10px', boxShadow: 'inset 0 0 0 1px #e6e6e6' }}>
            <strong>{g.name}</strong> · {g.memberUids.map((u) => nameOf[u] ?? u).join(', ')}
          </li>
        ))}
      </ul>
      {round.absentUids.length > 0 ? (
        <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.75 }}>
          결석 · {round.absentUids.map((u) => nameOf[u] ?? u).join(', ')}
        </p>
      ) : null}
    </div>
  )
}

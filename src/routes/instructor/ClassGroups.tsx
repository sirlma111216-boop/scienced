import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { LessonId } from '@/content/types'
import { getLesson } from '@/content/lessons'
import { DEFAULT_CLASS_SIZE, gameDealsCards, gameTakesInput } from '@/content/group-games'
import { useAuth } from '@/lib/auth'
import {
  dealSets,
  decodePlan,
  encodePlan,
  feasibility,
  formationLessons,
  gameForLesson,
  groupCountOf,
  historyFromDocs,
  nameGroups,
  pairCount,
  placeLateJoiner,
  planSchedule,
  roundNumberOf,
  runAssignment,
} from '@/lib/groups'
import type { Enrollment, GroupInput, GroupRound, GroupRoundGroup, PairHistoryDoc } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, Card, Notice, ScrollX } from '@/components/ui'

/**
 * 강사 — 모둠 관리 (6차 지시서 P.2).
 *
 *   모둠 수 설정 + 가능 여부
 *   회차 목록 (대기 / 완료)
 *   실행 → 미리보기 → 확정. 미리보기에서 다시 배정하거나 사람을 옮긴다. 옮긴 기록은 남는다.
 *   동석 기록 격자 — 아직 한 번도 안 만난 짝이 눈에 띈다
 *   고정 규칙 · 결석자 · 지각자
 *
 * 난수는 서버가 만든다. 시드는 결과와 함께 저장돼 나중에 확인할 수 있다.
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

export function InstructorClassGroups() {
  const { classId: classIdParam } = useParams()
  const classId = classIdParam ?? ''
  const { repo, user, isInstructor, classes } = useAuth()
  const cls = classes.find((c) => c.id === classId) ?? null
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [history, setHistory] = useState<PairHistoryDoc[]>([])
  const [rounds, setRounds] = useState<GroupRound[]>([])
  const [inputs, setInputs] = useState<GroupInput[]>([])
  const [openLesson, setOpenLesson] = useState<LessonId | null>(null)
  const [absent, setAbsent] = useState<Set<string>>(new Set())
  const [together, setTogether] = useState<Array<[string, string]>>([])
  const [apart, setApart] = useState<Array<[string, string]>>([])
  const [ruleA, setRuleA] = useState('')
  const [ruleB, setRuleB] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [planned, setPlanned] = useState<{ n: number; g: number; rounds: number; repeats: number } | null>(null)
  const [lateUid, setLateUid] = useState('')

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

  useEffect(() => {
    if (!repo || !classId || !openLesson) return
    return repo.watchGroupInputs(classId, openLesson, setInputs)
  }, [repo, classId, openLesson])

  const students = useMemo(() => enrollments.filter((e) => e.status === 'active'), [enrollments])
  const nameOf = useMemo(
    () => Object.fromEntries(students.map((s) => [s.uid, s.nickname || '이름 없음'])) as Record<string, string>,
    [students],
  )
  const lessons = formationLessons(cls)
  const groupCount = groupCountOf(cls)
  const hist = useMemo(() => historyFromDocs(history), [history])
  const n = students.length || DEFAULT_CLASS_SIZE
  const feas = feasibility(n, groupCount, lessons.length)

  /*
   * 가능 여부 (N.5). 공식은 필요조건이다 — 「가능」이라 해도 실제로는 안 되는 조합이 있다
   * (20명·5모둠·6회는 공식상 가능이지만 6회째에는 반드시 중복이 생긴다).
   * 그래서 이 화면이 쓰는 계획기를 짧게 돌려 실제 예상 중복도 함께 보인다. 모둠 수를 바꾸면 곧 다시 센다.
   */
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
  const game = openLesson ? gameForLesson(openLesson) : null
  const attendees = students.filter((s) => !absent.has(s.uid))

  async function setGroupCount(v: number) {
    if (!repo || !cls) return
    const g = Math.max(2, Math.min(12, Math.round(v)))
    await repo.updateClass(cls.id, { groupCount: g })
  }

  function addRule(kind: 'together' | 'apart') {
    if (!ruleA || !ruleB || ruleA === ruleB) return
    const pair: [string, string] = [ruleA, ruleB]
    if (kind === 'together') setTogether((l) => [...l, pair])
    else setApart((l) => [...l, pair])
    setRuleA('')
    setRuleB('')
  }

  async function run() {
    if (!openLesson || !repo || !user) return
    const roundNo = roundNumberOf(openLesson, lessons)
    if (!roundNo) return
    setBusy(true)
    setNote(null)
    const t0 = Date.now()
    try {
      const prev = rounds.filter((r) => r.round < roundNo).sort((a, b) => b.round - a.round)[0] ?? null
      const res = await runAssignment({
        classId,
        lessonId: openLesson,
        game,
        uids: attendees.map((s) => s.uid),
        groupCount,
        history: hist,
        round: roundNo,
        roundsAhead: lessons.length - roundNo + 1,
        inputs,
        mustTogether: together,
        mustApart: apart,
        plannedRemaining: decodePlan(prev?.plannedNext),
        planStale: prev ? !prev.followedPlan : false,
      })
      const dealt = game && gameDealsCards(game) ? dealSets(game, res.groups.length, res.seed) : []
      const groups = game ? nameGroups(game, res.groups, inputs, dealt) : res.groups.map((m, i) => ({ id: String(i + 1), name: `${i + 1}모둠`, memberUids: m }))
      setPreview({
        lessonId: openLesson,
        round: roundNo,
        seed: res.seed,
        groups,
        absentUids: [...absent],
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

  /** 미리보기에서 사람을 옮긴다. 기록에 남는다 (N.7). */
  function move(uid: string, toGroup: string) {
    if (!preview) return
    const from = preview.groups.find((g) => g.memberUids.includes(uid))
    if (!from || from.id === toGroup) return
    const groups = preview.groups.map((g) => ({
      ...g,
      memberUids: g.id === from.id ? g.memberUids.filter((u) => u !== uid) : g.id === toGroup ? [...g.memberUids, uid] : g.memberUids,
    }))
    setPreview({
      ...preview,
      groups,
      manualEdits: [...preview.manualEdits, { uid, fromGroup: from.id, toGroup, at: Date.now() }],
      followedPlan: false,
    })
  }

  async function confirm() {
    if (!preview || !repo || !user || !game) return
    setBusy(true)
    try {
      const round: GroupRound = {
        id: `${classId}-${preview.lessonId}`,
        round: preview.round,
        lessonId: preview.lessonId,
        gameId: game.id,
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
      await repo.confirmGroupRound(classId, round)
      setPreview(null)
      setNote(`${preview.lessonId}강 모둠을 확정했습니다. 학생 화면에 모둠 카드가 뜹니다.`)
    } catch (err) {
      console.error('[모둠 확정] 실패:', err)
      setNote(`확정하지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function joinLate(round: GroupRound) {
    if (!repo || !lateUid) return
    const idx = placeLateJoiner(round.groups.map((g) => g.memberUids), lateUid, hist, round.round)
    const target = round.groups[idx]
    try {
      await repo.addLateJoiner(classId, round.id, lateUid, target.id)
      setNote(`${nameOf[lateUid] ?? lateUid} 님을 「${target.name}」 모둠에 넣었습니다 — 중복이 가장 적게 느는 자리입니다.`)
      setLateUid('')
    } catch (err) {
      console.error('[지각 합류] 실패:', err)
      setNote(`넣지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const inputCount = inputs.filter((i) => attendees.some((a) => a.uid === i.uid)).length

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

      {/* ── 설정과 가능 여부 (N.5) ── */}
      <div style={{ marginTop: 32 }}>
        <Card>
          <Caption>모둠 수</Caption>
          <div className="flex items-center gap-md" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            <label htmlFor="group-count" className="text-body-sm" style={{ fontWeight: 480 }}>
              모둠 수
            </label>
            <input
              id="group-count"
              type="number"
              min={2}
              max={12}
              className="field"
              style={{ width: 96 }}
              value={groupCount}
              disabled={!cls || cls.status === 'archived'}
              onChange={(e) => void setGroupCount(Number(e.target.value))}
            />
            <span className="text-body-sm" style={{ opacity: 0.8 }}>
              수강생 {students.length}명{students.length === 0 ? ` (아직 없어 ${DEFAULT_CLASS_SIZE}명으로 계산)` : ''} → 모둠 크기 {feas.size}명 · 나누는 회차 {lessons.length}회 ({lessons.map((l) => `${Number(l)}`).join('·')}강)
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <Notice tone={feas.ok ? 'mint' : 'cream'}>
              <p className="text-body-sm" style={{ margin: 0 }}>
                <strong>계산상</strong> 한 사람이 만나는 총 인원 {lessons.length}×{feas.size - 1} = {feas.meets} {feas.ok ? '≤' : '>'} 가능한 상대 {feas.possible} —{' '}
                {feas.ok ? '✅ 중복 없이 나눌 수 있습니다' : `⚠️ 최소 ${feas.minRepeats}회 중복이 생깁니다 (한 사람 기준)`}
              </p>
              <p className="text-body-sm" style={{ margin: '6px 0 0' }}>
                <strong>계획기 예상</strong>{' '}
                {planned && planned.g === groupCount && planned.rounds === lessons.length
                  ? planned.repeats === 0
                    ? '지금 명단으로 계획을 짜 보니 남은 회차 동안 중복 0으로 갑니다.'
                    : `지금 명단으로 계획을 짜 보니 남은 회차 동안 같은 사람을 다시 만나는 일이 ${planned.repeats}번 있습니다 (짝 기준 합계).`
                  : '계산 중…'}
                {feas.ok && planned && planned.repeats > 0 ? ' 공식은 필요조건일 뿐이라 이런 조합이 있습니다 — 판단은 강사가 합니다.' : ''}
              </p>
            </Notice>
          </div>
        </Card>
      </div>

      {/* ── 회차 목록 ── */}
      <div style={{ marginTop: 32 }}>
        <Caption>회차</Caption>
        <ScrollX>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, minWidth: 560 }}>
            <thead>
              <tr>
                {['회차', '차시', '게임', '상태', ''].map((h) => (
                  <th key={h} className="caption" style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lessons.map((lid, i) => {
                const r = roundOf(lid)
                const g = gameForLesson(lid)
                return (
                  <tr key={lid} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                    <td className="font-mono text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                      {i + 1}
                    </td>
                    <td className="text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                      {Number(lid)}강 {getLesson(lid)?.title ?? ''}
                    </td>
                    <td className="text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                      {g ? g.title : '게임 없음 — 배정만'}
                    </td>
                    <td style={{ padding: '10px 12px 10px 0' }}>
                      {r ? <Badge solid>완료 · 모둠 {r.groups.length} · 중복 {r.cost}</Badge> : <Badge>대기</Badge>}
                    </td>
                    <td style={{ padding: '10px 0' }}>
                      <Button
                        variant={openLesson === lid ? 'primary' : 'secondary'}
                        onClick={() => {
                          setOpenLesson(lid)
                          setPreview(null)
                          setNote(null)
                        }}
                      >
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

      {/* ── 실행 → 미리보기 → 확정 ── */}
      {openLesson ? (
        <div style={{ marginTop: 32 }}>
          <Card>
            <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
              <Badge>{roundNumberOf(openLesson, lessons)}회차</Badge>
              <h2 className="text-card-title" style={{ margin: 0 }}>
                {Number(openLesson)}강 · {game ? game.title : '배정만'}
              </h2>
            </div>
            {game ? (
              <>
                <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.8 }}>
                  <strong>왜 이렇게 묶는가</strong> · {game.why}
                </p>
                <p className="text-body-sm" style={{ margin: '4px 0 0', opacity: 0.8 }}>
                  <strong>학생에게 보이는 문장</strong> · {game.effectScope}
                </p>
                {gameTakesInput(game) ? (
                  <p className="text-body-sm" style={{ margin: '8px 0 0' }}>
                    학생 선택 {inputCount} / {attendees.length}명 제출.{' '}
                    {inputCount < attendees.length ? '아직 안 고른 사람은 분류 없이 배정됩니다.' : ''}
                  </p>
                ) : null}
              </>
            ) : null}

            {roundOf(openLesson) && !preview ? (
              <RoundSummary round={roundOf(openLesson)!} nameOf={nameOf} />
            ) : null}

            {/* 결석자 */}
            <div style={{ marginTop: 20 }}>
              <Caption>참석자 — 결석자는 체크를 풉니다</Caption>
              <ul className="flex flex-wrap gap-xs" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                {students.map((s) => (
                  <li key={s.uid}>
                    <label className="text-body-sm flex items-center gap-xxs" style={{ padding: '4px 8px', boxShadow: 'inset 0 0 0 1px #e6e6e6', borderRadius: 999 }}>
                      <input
                        type="checkbox"
                        checked={!absent.has(s.uid)}
                        onChange={(e) =>
                          setAbsent((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.delete(s.uid)
                            else next.add(s.uid)
                            return next
                          })
                        }
                      />
                      {s.nickname || '이름 없음'}
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {/* 고정 규칙 */}
            <div style={{ marginTop: 20 }}>
              <Caption>고정 규칙</Caption>
              <div className="flex items-center gap-xs" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                <select className="field" style={{ width: 160 }} value={ruleA} onChange={(e) => setRuleA(e.target.value)} aria-label="첫 번째 사람">
                  <option value="">사람 고르기</option>
                  {students.map((s) => (
                    <option key={s.uid} value={s.uid}>{s.nickname || '이름 없음'}</option>
                  ))}
                </select>
                <select className="field" style={{ width: 160 }} value={ruleB} onChange={(e) => setRuleB(e.target.value)} aria-label="두 번째 사람">
                  <option value="">사람 고르기</option>
                  {students.map((s) => (
                    <option key={s.uid} value={s.uid}>{s.nickname || '이름 없음'}</option>
                  ))}
                </select>
                <Button variant="secondary" onClick={() => addRule('together')}>반드시 같이</Button>
                <Button variant="secondary" onClick={() => addRule('apart')}>반드시 따로</Button>
              </div>
              {together.length + apart.length > 0 ? (
                <ul className="flex flex-wrap gap-xs" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                  {together.map(([a, b], i) => (
                    <li key={`t${i}`}>
                      <Badge solid>같이 · {nameOf[a]} + {nameOf[b]}</Badge>{' '}
                      <button type="button" className="btn-tertiary" style={{ minHeight: 28, fontSize: 12 }} onClick={() => setTogether((l) => l.filter((_, j) => j !== i))}>빼기</button>
                    </li>
                  ))}
                  {apart.map(([a, b], i) => (
                    <li key={`a${i}`}>
                      <Badge>따로 · {nameOf[a]} / {nameOf[b]}</Badge>{' '}
                      <button type="button" className="btn-tertiary" style={{ minHeight: 28, fontSize: 12 }} onClick={() => setApart((l) => l.filter((_, j) => j !== i))}>빼기</button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="flex items-center gap-md" style={{ marginTop: 20, flexWrap: 'wrap' }}>
              <Button onClick={() => void run()} disabled={busy || attendees.length < 2 || !game}>
                {busy ? '배정 중…' : preview ? '다시 배정' : '배정 실행'}
              </Button>
              {!game ? <span className="text-body-sm" style={{ opacity: 0.7 }}>이 차시에는 게임이 없습니다. 게임 없는 회차는 아직 지원하지 않습니다.</span> : null}
              {note ? <span className="text-body-sm" role="status">{note}</span> : null}
            </div>

            {preview ? (
              <div style={{ marginTop: 20 }}>
                <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
                  <Caption>미리보기</Caption>
                  <Badge>중복 {preview.cost}</Badge>
                  <Badge>{preview.followedPlan ? '계획대로' : '계획에서 벗어남'}</Badge>
                  <span className="font-mono text-caption" style={{ opacity: 0.7 }}>시드 {preview.seed}</span>
                </div>
                <div className="flex flex-wrap gap-md" style={{ marginTop: 12 }}>
                  {preview.groups.map((g) => (
                    <div key={g.id} className="rounded-md" style={{ padding: 12, boxShadow: 'inset 0 0 0 1px #e6e6e6', flex: '1 1 200px' }}>
                      <p className="text-body-sm" style={{ margin: 0, fontWeight: 600 }}>
                        {g.id}. {g.name} <span style={{ opacity: 0.6 }}>· {g.memberUids.length}명</span>
                      </p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                        {g.memberUids.map((uid) => (
                          <li key={uid} className="flex items-center gap-xs" style={{ marginBottom: 4 }}>
                            <span className="text-body-sm" style={{ flex: 1 }}>{nameOf[uid] ?? uid}</span>
                            {/* 드래그가 아니다. 키보드로도 옮긴다. */}
                            <select
                              className="field"
                              style={{ width: 88, minHeight: 32, padding: '2px 6px', fontSize: 12 }}
                              value={g.id}
                              aria-label={`${nameOf[uid] ?? uid} 옮기기`}
                              onChange={(e) => move(uid, e.target.value)}
                            >
                              {preview.groups.map((o) => (
                                <option key={o.id} value={o.id}>→ {o.id}</option>
                              ))}
                            </select>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {preview.manualEdits.length > 0 ? (
                  <p className="text-body-sm" style={{ marginTop: 8, opacity: 0.75 }}>
                    수동 조정 {preview.manualEdits.length}건 — 확정하면 기록에 남습니다.
                  </p>
                ) : null}
                <div className="flex items-center gap-md" style={{ marginTop: 16 }}>
                  <Button onClick={() => void confirm()} disabled={busy}>확정</Button>
                  <Button variant="secondary" onClick={() => setPreview(null)} disabled={busy}>버리기</Button>
                </div>
              </div>
            ) : null}

            {/* 지각자 */}
            {roundOf(openLesson) && !preview ? (
              <div style={{ marginTop: 20 }}>
                <Caption>늦게 온 학생 넣기</Caption>
                <div className="flex items-center gap-xs" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                  <select className="field" style={{ width: 200 }} value={lateUid} onChange={(e) => setLateUid(e.target.value)} aria-label="늦게 온 학생">
                    <option value="">사람 고르기</option>
                    {students
                      .filter((s) => !roundOf(openLesson)!.groups.some((g) => g.memberUids.includes(s.uid)))
                      .map((s) => (
                        <option key={s.uid} value={s.uid}>{s.nickname || '이름 없음'}</option>
                      ))}
                  </select>
                  <Button variant="secondary" onClick={() => void joinLate(roundOf(openLesson)!)} disabled={!lateUid}>
                    비용이 가장 적게 느는 모둠에 넣기
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {/* ── 동석 기록 격자 ── */}
      <div style={{ marginTop: 32 }}>
        <Caption>동석 기록 — 누가 누구와 몇 번</Caption>
        <p className="text-body-sm" style={{ margin: '4px 0 8px', opacity: 0.75 }}>
          빈칸이 아직 한 번도 안 만난 짝입니다. 숫자는 함께한 횟수.
        </p>
        <PairGrid students={students} hist={hist} />
      </div>
    </AppShell>
  )
}

function RoundSummary({ round, nameOf }: { round: GroupRound; nameOf: Record<string, string> }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Caption>확정된 모둠</Caption>
        <Badge>중복 {round.cost}</Badge>
        <Badge>{round.followedPlan ? '계획대로' : '계획에서 벗어남'}</Badge>
        {round.manualEdits.length > 0 ? <Badge>수동 조정 {round.manualEdits.length}</Badge> : null}
        <span className="font-mono text-caption" style={{ opacity: 0.7 }}>시드 {round.seed}</span>
      </div>
      <ul className="flex flex-wrap gap-xs" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
        {round.groups.map((g) => (
          <li key={g.id} className="text-body-sm rounded-md" style={{ padding: '6px 10px', boxShadow: 'inset 0 0 0 1px #e6e6e6' }}>
            <strong>{g.id}. {g.name}</strong> · {g.memberUids.map((u) => nameOf[u] ?? u).join(', ')}
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

/** 동석 격자. 색만으로 구분하지 않는다 — 숫자를 함께 둔다. */
function PairGrid({ students, hist }: { students: Enrollment[]; hist: Record<string, { count: number; lastRound: number }> }) {
  if (students.length === 0) return <p className="text-body-sm" style={{ opacity: 0.7 }}>수강생이 없습니다.</p>
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
                  <td
                    key={b.uid}
                    title={`${a.nickname} · ${b.nickname} — ${c}번`}
                    style={{
                      width: 18,
                      height: 18,
                      textAlign: 'center',
                      boxShadow: 'inset 0 0 0 1px #eee',
                      background: c === 0 ? '#fff' : c === 1 ? '#e8f4ec' : '#f6d9d9',
                    }}
                  >
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

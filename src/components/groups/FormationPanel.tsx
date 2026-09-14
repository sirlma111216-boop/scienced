import { useEffect, useMemo, useState } from 'react'
import type { LessonId } from '@/content/types'
import { gameDealsCards, gameTakesInput } from '@/content/group-games'
import { useAuth } from '@/lib/auth'
import {
  dealSets,
  decodePlan,
  encodePlan,
  formationLessons,
  gameForLesson,
  groupCountOf,
  groupSizes,
  historyWithoutRound,
  nameGroups,
  pairCount,
  placeLateJoiner,
  roundNumberOf,
  runAssignment,
} from '@/lib/groups'
import type { PairRecord } from '@shared/groups-core'
import type { ClassDoc, Enrollment, GroupInput, GroupRound, GroupRoundGroup } from '@/lib/types'
import { Badge, Button, Caption, Card, ScrollX } from '@/components/ui'

/**
 * 한 차시의 모둠 나누기 — 실행 → 미리보기 → 확정 (6차 지시서 P.2).
 *
 * 두 곳에서 같은 부품을 쓴다.
 *   · 모둠 관리 화면 (/instructor/class/:id/groups) — 회차를 골라 연다
 *   · 진행 콘솔 — 나누는 차시면 맨 위에 그대로 붙는다
 *
 * ★ 처음에는 모둠 관리 화면에만 있었다. 수업 중 학생들이 게임에서 고르는 것을 콘솔에서 보고 있는데
 *   정작 모둠을 정하는 단추가 콘솔에 없어 다른 화면을 찾아야 했다. 수업 중에 쓰는 것은 콘솔에 있어야 한다.
 *
 * 부르는 쪽이 key={lessonId} 를 주면 차시가 바뀔 때 미리보기·메모가 함께 비워진다.
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
  /** 동석 격자를 아래에 함께 그린다 (콘솔의 덮개 화면 — 7차 R.3) */
  showPairs?: boolean
}) {
  const { repo, user } = useAuth()
  const [inputs, setInputs] = useState<GroupInput[]>([])
  const [absent, setAbsent] = useState<Set<string>>(new Set())
  const [together, setTogether] = useState<Array<[string, string]>>([])
  const [apart, setApart] = useState<Array<[string, string]>>([])
  const [ruleA, setRuleA] = useState('')
  const [ruleB, setRuleB] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [lateUid, setLateUid] = useState('')
  const [countDraft, setCountDraft] = useState<string | null>(null)

  useEffect(() => {
    if (!repo || !classId || !lessonId) return
    return repo.watchGroupInputs(classId, lessonId, setInputs)
  }, [repo, classId, lessonId])

  const nameOf = useMemo(
    () => Object.fromEntries(students.map((s) => [s.uid, s.nickname || '이름 없음'])) as Record<string, string>,
    [students],
  )
  const lessons = formationLessons(cls)
  const groupCount = groupCountOf(cls)
  const game = gameForLesson(lessonId)
  const round = rounds.find((r) => r.lessonId === lessonId) ?? null
  const roundNo = roundNumberOf(lessonId, lessons)
  const attendees = students.filter((s) => !absent.has(s.uid))
  const inputCount = inputs.filter((i) => attendees.some((a) => a.uid === i.uid)).length

  /**
   * 모둠 수 — 강사가 정한다 (6차 P.2). 클래스 설정에 저장돼 모둠 관리 화면과 같은 값을 쓴다.
   * ★ 처음에는 모둠 관리 화면에만 있었다. 콘솔에서 나누는데 몇 모둠으로 나눌지 여기서 못 정하면 빠진 것과 같다.
   */
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
  const sizes = groupSizes(Math.max(attendees.length, groupCount), groupCount)
  const sizeText =
    sizes.length === 0 ? '' : Math.min(...sizes) === Math.max(...sizes) ? `${sizes[0]}명` : `${Math.min(...sizes)}~${Math.max(...sizes)}명`

  function addRule(kind: 'together' | 'apart') {
    if (!ruleA || !ruleB || ruleA === ruleB) return
    const pair: [string, string] = [ruleA, ruleB]
    if (kind === 'together') setTogether((l) => [...l, pair])
    else setApart((l) => [...l, pair])
    setRuleA('')
    setRuleB('')
  }

  async function run() {
    if (!repo || !user || !roundNo) return
    setBusy(true)
    setNote(null)
    const t0 = Date.now()
    try {
      const prev = rounds.filter((r) => r.round < roundNo).sort((a, b) => b.round - a.round)[0] ?? null
      /* 다시 나누기 — 이 회차가 올린 짝은 기록에서 빼고 센다 */
      const history = round ? historyWithoutRound(hist, round.groups.map((g) => g.memberUids)) : hist
      const res = await runAssignment({
        classId,
        lessonId,
        game,
        uids: attendees.map((s) => s.uid),
        groupCount,
        history,
        round: roundNo,
        roundsAhead: lessons.length - roundNo + 1,
        inputs,
        mustTogether: together,
        mustApart: apart,
        plannedRemaining: decodePlan(prev?.plannedNext),
        planStale: prev ? !prev.followedPlan : false,
      })
      const dealt = game && gameDealsCards(game) ? dealSets(game, res.groups.length, res.seed) : []
      const groups = game
        ? nameGroups(game, res.groups, inputs, dealt)
        : res.groups.map((m, i) => ({ id: String(i + 1), name: `${i + 1}모둠`, memberUids: m }))
      setPreview({
        lessonId,
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
      const next: GroupRound = {
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
      setNote(`${nameOf[lateUid] ?? lateUid} 님을 「${target.name}」 모둠에 넣었습니다 — 중복이 가장 적게 느는 자리입니다.`)
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
          이 차시는 모둠을 나누는 회차가 아닙니다.
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge>{roundNo}회차</Badge>
        <h2 className="text-card-title" style={{ margin: 0 }}>
          모둠 나누기 · {game ? game.title : '배정만'}
        </h2>
        {round ? <Badge solid>확정됨 · 모둠 {round.groups.length}</Badge> : <Badge>아직 안 나눔</Badge>}
      </div>

      {/* 모둠 수 — 강사가 정한다 */}
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
          참석 {attendees.length}명 → 모둠 크기 {sizeText}
          {round && round.groups.length !== groupCount ? ` · 확정된 모둠은 ${round.groups.length}개 — 바꾸려면 다시 나눕니다` : ''}
        </span>
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
            <p className="text-body-sm" style={{ margin: '8px 0 0' }} role="status">
              학생 선택 <strong>{inputCount} / {attendees.length}명</strong> 제출.{' '}
              {inputCount < attendees.length ? '아직 안 고른 사람은 분류 없이 배정됩니다.' : '모두 골랐습니다.'}
            </p>
          ) : null}
        </>
      ) : null}

      {round && !preview ? <RoundSummary round={round} nameOf={nameOf} /> : null}

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
                {inputs.some((i) => i.uid === s.uid) ? <span aria-label="골랐음" style={{ opacity: 0.6 }}>✓</span> : null}
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
          {busy ? '배정 중…' : preview ? '다시 배정' : round ? '다시 나누기' : '배정 실행'}
        </Button>
        {!game ? <span className="text-body-sm" style={{ opacity: 0.7 }}>이 차시에는 게임이 없습니다. 게임 없는 회차는 아직 지원하지 않습니다.</span> : null}
        {round && !preview ? (
          <span className="text-body-sm" style={{ opacity: 0.7 }}>다시 나누면 확정된 모둠과 동석 기록이 새 결과로 바뀝니다.</span>
        ) : null}
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
            {preview.groups.map((g) => {
              /* 동석 기록을 미리보기에 함께 — 처음 만나는 짝이 눈에 띄게 (7차 R.3) */
              const pairs: Array<[string, string]> = []
              for (let i = 0; i < g.memberUids.length; i++) for (let j = i + 1; j < g.memberUids.length; j++) pairs.push([g.memberUids[i], g.memberUids[j]])
              const fresh = pairs.filter(([a, b]) => pairCount(hist, a, b) === 0).length
              const metOf = (uid: string) => g.memberUids.filter((o) => o !== uid && pairCount(hist, uid, o) > 0).length
              return (
              <div key={g.id} className="rounded-md" style={{ padding: 12, boxShadow: 'inset 0 0 0 1px #e6e6e6', flex: '1 1 200px' }}>
                <p className="text-body-sm" style={{ margin: 0, fontWeight: 600 }}>
                  {g.id}. {g.name} <span style={{ opacity: 0.6 }}>· {g.memberUids.length}명</span>
                </p>
                <p className="text-caption" style={{ margin: '2px 0 0', opacity: 0.75 }}>
                  처음 만나는 짝 {fresh} / {pairs.length}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                  {g.memberUids.map((uid) => (
                    <li key={uid} className="flex items-center gap-xs" style={{ marginBottom: 4 }}>
                      <span className="text-body-sm" style={{ flex: 1 }}>
                        {nameOf[uid] ?? uid}
                        {g.memberUids.length > 1 && metOf(uid) === 0 ? <span className="caption" style={{ marginLeft: 6 }}>전부 처음</span> : null}
                      </span>
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
              )
            })}
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
      {round && !preview ? (
        <div style={{ marginTop: 20 }}>
          <Caption>늦게 온 학생 넣기</Caption>
          <div className="flex items-center gap-xs" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            <select className="field" style={{ width: 200 }} value={lateUid} onChange={(e) => setLateUid(e.target.value)} aria-label="늦게 온 학생">
              <option value="">사람 고르기</option>
              {students
                .filter((s) => !round.groups.some((g) => g.memberUids.includes(s.uid)))
                .map((s) => (
                  <option key={s.uid} value={s.uid}>{s.nickname || '이름 없음'}</option>
                ))}
            </select>
            <Button variant="secondary" onClick={() => void joinLate(round)} disabled={!lateUid}>
              비용이 가장 적게 느는 모둠에 넣기
            </Button>
          </div>
        </div>
      ) : null}

      {/* 동석 격자 — 콘솔 덮개 화면에서는 여기에 함께 (7차 R.3) */}
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

/** 동석 격자. 색만으로 구분하지 않는다 — 숫자를 함께 둔다. */
export function PairGrid({ students, hist }: { students: Enrollment[]; hist: Record<string, { count: number; lastRound: number }> }) {
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

export function RoundSummary({ round, nameOf }: { round: GroupRound; nameOf: Record<string, string> }) {
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

import { useEffect, useMemo, useState } from 'react'
import type { LessonId } from '@/content/types'
import type { FormationQuestion as FQ } from '@/content/formation-questions'
import { useAuth } from '@/lib/auth'
import { changedSinceLast, metBefore } from '@/lib/groups'
import type { GroupInput, GroupRound } from '@/lib/types'
import { Badge, Button, ColorBlock, Notice } from '@/components/ui'

/**
 * 학생 — 오늘의 질문 (8차 5절). 아이스브레이킹 질문 하나에 답하면 끝이다.
 *
 *   확정 전   질문에 답 하나 고르기 — 이것이 그날 출석이다 (강의자 지시 2026-09-22)
 *   확정 뒤   내 모둠 카드 — 모둠 이름은 답(「일본 모둠」). 처음 만나는 분 배지.
 * 같은 답끼리 모이되 보장은 아니다 — 답이 몰리면 일부가 다른 모둠으로 간다고 그대로 적는다.
 * 모둠을 나누지 않는 차시(forGroups=false)에서는 출석만 한다. 모둠 이야기를 적지 않는다.
 */
export function FormationQuestionView({
  classId,
  lessonId,
  question,
  forGroups,
  round,
  rounds,
  nicknames,
}: {
  classId: string
  lessonId: LessonId
  question: FQ
  /** 이 차시에서 이 답으로 모둠을 나누는가 */
  forGroups: boolean
  round: GroupRound | null
  rounds: GroupRound[]
  nicknames: Record<string, string>
}) {
  const { repo, user } = useAuth()
  const [mine, setMine] = useState<GroupInput | null>(null)
  const [choice, setChoice] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!repo || !user) return
    return repo.watchMyGroupInput(classId, lessonId, user.uid, setMine)
  }, [repo, user, classId, lessonId])

  useEffect(() => {
    if (!mine) return
    setChoice(mine.choice)
    setSaved(true)
  }, [mine])

  async function submit() {
    if (!repo || !user) return
    if (!choice) {
      setError('하나를 고르세요.')
      return
    }
    setError(null)
    try {
      await repo.setGroupInput(classId, { uid: user.uid, lessonId, questionId: question.id, choice, updatedAt: Date.now() })
      setSaved(true)
    } catch (e) {
      console.error('[모둠 질문] 저장하지 못했다:', e)
      setError('저장하지 못했습니다. 잠시 뒤 다시 누르세요.')
    }
  }

  const uid = user?.uid ?? ''
  const myGroup = round?.groups.find((g) => g.memberUids.includes(uid)) ?? null
  const met = useMemo(() => (round ? metBefore(uid, rounds, round.id) : new Set<string>()), [uid, rounds, round])
  const changed = round ? changedSinceLast(uid, round, rounds) : null

  if (round) {
    return (
      <section aria-labelledby="group-result-title" style={{ marginBottom: 40 }}>
        <ColorBlock tone="pink">
          <p className="eyebrow">모둠 나누기 · {question.question}</p>
          {myGroup ? (
            <>
              <h2 id="group-result-title" className="text-display-lg" style={{ margin: '12px 0 0', fontWeight: 600 }}>
                {myGroup.name}
              </h2>
              <div aria-live="polite" style={{ marginTop: 16 }}>
                <ul className="flex flex-wrap gap-xs" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {myGroup.memberUids.map((u) => (
                    <li key={u} className="text-body-sm" style={{ padding: '6px 10px', boxShadow: 'inset 0 0 0 1px #000', borderRadius: 999, background: '#fff' }}>
                      {nicknames[u] ?? '이름 없음'}
                      {u === uid ? ' (나)' : ''}
                      {u !== uid && !met.has(u) ? (
                        <span className="caption" style={{ marginLeft: 6 }}>
                          처음 만나는 분
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {changed !== null ? (
                  <p className="text-body-sm" style={{ margin: '12px 0 0', opacity: 0.8 }}>
                    지난번과 {changed}분이 바뀌었습니다.
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h2 id="group-result-title" className="text-headline" style={{ margin: '12px 0 0' }}>
                모둠이 정해졌습니다
              </h2>
              <Notice tone="cream">
                <p className="text-body-sm" style={{ margin: 0 }}>
                  이번 회차 모둠에 아직 자리가 없습니다. 강사에게 말하면 넣어 줍니다.
                </p>
              </Notice>
            </>
          )}
          <details style={{ marginTop: 12 }}>
            <summary className="caption" style={{ cursor: 'pointer' }}>
              모든 모둠
            </summary>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {round.groups.map((g) => (
                <li key={g.id} className="text-body-sm">
                  <strong>{g.name}</strong> — {g.memberUids.map((u) => nicknames[u] ?? '이름 없음').join(', ')}
                </li>
              ))}
            </ul>
          </details>
        </ColorBlock>
      </section>
    )
  }

  return (
    <section aria-labelledby="group-question-title" style={{ marginBottom: 40 }}>
      <ColorBlock tone="pink">
        <p className="eyebrow">오늘의 질문{forGroups ? ' · 모둠 나누기' : ''}</p>
        <h2 id="group-question-title" className="text-headline" style={{ margin: '12px 0 0' }}>
          {question.question}
        </h2>
        <p className="text-body" style={{ marginTop: 8 }}>
          답을 고르면 오늘 출석입니다. 오늘 활동은 답을 고른 사람들로 진행합니다.
        </p>
        {forGroups ? (
          <p className="text-body-sm" style={{ marginTop: 6, opacity: 0.85 }}>
            같은 답을 고른 사람끼리 되도록 한 모둠이 됩니다. 답이 몰리면 몇 사람은 다른 모둠으로 갑니다. 모둠 이름은 답입니다.
          </p>
        ) : null}
        <fieldset style={{ border: 0, padding: 0, margin: '16px 0 0' }}>
          <legend className="caption">하나만</legend>
          <div className="flex flex-wrap gap-xs" style={{ marginTop: 8 }}>
            {question.options.map((o) => (
              <label key={o} className="text-body-sm rounded-md" style={{ padding: '10px 14px', background: '#fff', boxShadow: `inset 0 0 0 ${choice === o ? 2 : 1}px ${choice === o ? '#000' : '#e6e6e6'}`, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`formation-${question.id}`}
                  value={o}
                  checked={choice === o}
                  onChange={() => {
                    setChoice(o)
                    setSaved(false)
                  }}
                  style={{ marginRight: 6 }}
                />
                {o}
              </label>
            ))}
          </div>
        </fieldset>
        {error ? (
          <p role="alert" className="text-body-sm" style={{ fontWeight: 480, marginTop: 8 }}>
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-md" style={{ marginTop: 16 }}>
          <Button onClick={() => void submit()}>{saved ? '다시 고르기' : '고르기'}</Button>
          {saved ? (
            <span className="caption" role="status">
              <Badge>출석</Badge> {forGroups ? '강사가 모둠을 나누면 여기에 결과가 뜹니다' : '오늘 출석으로 들어갔습니다'}
            </span>
          ) : null}
        </div>
      </ColorBlock>
    </section>
  )
}

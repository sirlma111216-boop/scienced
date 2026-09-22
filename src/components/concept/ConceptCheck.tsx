import { useEffect, useId, useRef, useState } from 'react'
import type { ConceptCheck, LessonId, Step } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { OPTION_MARK, checkChoices, saveConceptCheck, type Choice } from '@/lib/concept-check'
import { Badge, Button, Caption } from '@/components/ui'
import { ConceptCard } from '@/components/concept/ConceptCard'

/**
 * 학생 — 개념 카드와 잠깐 확인 (강의자 지시 2026-09-18).
 *
 * 한 단계의 확인을 응답 문서 하나에 모은다. 새 판이 앞 판을 대신하므로
 * 연달아 누른 답이 서로를 지우지 않게 저장을 줄 세우고, 지금까지 고른 것을 모두 담아 낸다.
 * 단계 열기와 상관없이 풀 수 있다 — 쓰는 칸이 아니다.
 */
export function StudentConceptCards({ classId, lessonId, step }: { classId: string; lessonId: LessonId; step: Step }) {
  const { repo, user } = useAuth()
  const [shown, setShown] = useState<Record<string, Choice>>({})
  const acc = useRef<Record<string, Choice>>({})
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    if (!repo || !user) return
    acc.current = {}
    setShown({})
    return repo.watchResponse(classId, lessonId, step.id, user.uid, (doc) => {
      acc.current = { ...checkChoices(doc), ...acc.current }
      setShown({ ...acc.current })
    })
  }, [repo, user, classId, lessonId, step.id])

  function answer(conceptId: string, choice: Choice): Promise<unknown> {
    if (!repo || !user) return Promise.reject(new Error('로그인하지 않았다'))
    acc.current = { ...acc.current, [conceptId]: choice }
    setShown({ ...acc.current })
    const run = queue.current
      .then(() => saveConceptCheck(repo, { classId, lessonId, stepId: step.id, uid: user.uid, prev: acc.current, conceptId, choice }))
      .catch((err: unknown) => {
        console.error('[잠깐 확인] 저장하지 못했다:', err)
        const rest = { ...acc.current }
        delete rest[conceptId]
        acc.current = rest
        setShown({ ...rest })
        throw err
      })
    queue.current = run.catch(() => undefined)
    return run
  }

  return (
    <div className="flex flex-col" style={{ gap: 48 }}>
      {step.concepts.map((c, j) => (
        <ConceptCard key={c.id} concept={c} index={j}>
          {c.check ? <ConceptCheckView check={c.check} chosen={shown[c.id]} onAnswer={(x) => answer(c.id, x)} /> : null}
        </ConceptCard>
      ))}
    </div>
  )
}

/**
 * 물음 하나 · 보기 넷 · 확인. 고르면 잠기고 맞았는지와 정답 자리를 바로 보여 준다.
 * preview 면 강사 화면이다 — 학생이 보는 그대로이되 고를 수 없고 [확인]이 없다. 정답은 여기 없다 (강사 화면은 접기 안에 둔다).
 */
export function ConceptCheckView({ check, chosen, onAnswer, preview = false }: { check: ConceptCheck; chosen: Choice | undefined; onAnswer?: (c: Choice) => Promise<unknown>; preview?: boolean }) {
  const name = useId()
  const [pick, setPick] = useState<Choice | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const done = chosen !== undefined

  async function submit() {
    if (pick === null || busy || !onAnswer) return
    setBusy(true)
    setError(null)
    try {
      await onAnswer(pick)
    } catch {
      setError('저장하지 못했다. 연결을 확인하고 다시 누르세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="잠깐 확인" className="bg-canvas rounded-md" style={{ padding: '14px 18px', marginTop: 20, boxShadow: 'inset 0 0 0 2px #000' }}>
      <fieldset aria-describedby={`${name}-q`} disabled={preview} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend className="caption" style={{ padding: 0 }}>
          잠깐 확인
        </legend>
        <p id={`${name}-q`} className="text-body" style={{ margin: '6px 0 12px', fontWeight: 480 }}>
          {check.prompt}
        </p>
        <div className="flex flex-col gap-xs">
          {check.options.map((opt, i) => {
            const mine = done ? chosen === i : pick === i
            const isAnswer = done && check.answer === i
            return (
              <label
                key={i}
                className="flex items-start gap-sm rounded-md"
                style={{
                  padding: '10px 14px',
                  boxShadow: `inset 0 0 0 ${mine || isAnswer ? 2 : 1}px ${mine || isAnswer ? '#000' : '#e6e6e6'}`,
                  cursor: done || busy ? 'default' : 'pointer',
                }}
              >
                <input type="radio" name={name} value={opt} aria-label={`${OPTION_MARK[i]} ${opt}`} checked={mine} disabled={done || busy} onChange={() => setPick(i as Choice)} style={{ marginTop: 4 }} />
                <span className="text-body" style={{ flex: 1 }}>
                  <span className="font-mono">{OPTION_MARK[i]}</span> {opt}
                </span>
                {isAnswer ? <Badge solid>정답</Badge> : done && mine ? <Badge>내 답</Badge> : null}
              </label>
            )
          })}
        </div>
      </fieldset>
      {preview ? (
        <Caption>학생은 여기서 하나를 고르고 [확인]을 누른다. 한 번 고르면 바꿀 수 없다.</Caption>
      ) : done ? (
        <p role="status" className="text-body-sm" style={{ margin: '10px 0 0', fontWeight: 480 }}>
          {chosen === check.answer ? '✓ 맞았다.' : `✕ 정답은 ${OPTION_MARK[check.answer]}이다. 카드의 기준으로 다시 읽어 보세요.`}
        </p>
      ) : (
        <div className="flex items-center gap-xs" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <Button onClick={submit} disabled={pick === null || busy}>
            {busy ? '저장 중…' : '확인'}
          </Button>
          <Caption>한 번 고르면 바꿀 수 없다.</Caption>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-body-sm" style={{ fontWeight: 480, margin: '8px 0 0' }}>
          ⚠ {error}
        </p>
      ) : null}
    </section>
  )
}

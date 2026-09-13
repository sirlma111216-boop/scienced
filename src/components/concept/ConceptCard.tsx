import { useEffect, useRef, useState } from 'react'
import type { KeyConcept } from '@/content/types'
import { Badge, Button, Caption, ColorBlock, type BlockTone } from '@/components/ui'
import { Rich } from '@/components/theory/Rich'
import { EntryView } from '@/components/theory/EntryView'
import { useTheory } from '@/components/theory/TheoryContext'

/**
 * 개념 카드.
 *
 * 컨텍스트 1절의 여섯 층을 순서대로 연다.
 *   쉬운 한 문장 → 왜 필요한가 → 교실 장면 → 정확한 정의 → 헷갈리지 말자 → 직접 써 보기
 *
 * 어려운 정의를 먼저 던지고 쉬운 말로 다시 낮추는 순서를 피한다 (컨텍스트 24.3).
 * '잠깐 확인'은 선택만으로 제출되지 않는다. 이유를 한 줄 적어야 한다.
 */

const LAYERS = [
  { key: 'plainOneLiner', label: '먼저 쉽게' },
  { key: 'whyItMatters', label: '왜 필요한가' },
  { key: 'classroomScene', label: '교실 장면' },
  { key: 'formalDefinition', label: '정확한 정의' },
  { key: 'notToConfuseWith', label: '헷갈리지 말자' },
  { key: 'applyQuestion', label: '직접 써 보기' },
  { key: 'deepDive', label: '더 읽기' },
  /* 5차 K.1 — 이 개념이 누구의 무슨 이론인지. 본문은 쉬운 말 그대로 두고 여기에만 학술 용어를 둔다. */
  { key: 'theory', label: '★ 이론 배경' },
] as const

const TONES: BlockTone[] = ['lime', 'lilac', 'cream', 'mint']

export function ConceptCard({
  concept,
  index,
  answer,
  onAnswer,
}: {
  concept: KeyConcept
  index: number
  answer?: { choice: string; reason: string }
  onAnswer?: (choice: string, reason: string) => void
}) {
  const [layer, setLayer] = useState(0)
  const [choice, setChoice] = useState(answer?.choice ?? '')
  const [reason, setReason] = useState(answer?.reason ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(Boolean(answer))
  const { entries, openEntry } = useTheory()
  const linked = entries.filter((e) => e.linkedConceptId === concept.id)

  /*
   * ★ 저장된 답을 화면에 되살린다.
   *
   * 응답 문서는 화면이 그려진 뒤에 도착한다. 처음 값으로만 상태를 만들어 두면
   * 그때 도착한 답이 화면에 반영되지 않는다 — 저장은 됐는데 빈칸으로 보였고,
   * 학생은 사라진 줄 알고 다시 적었다.
   * 한 번만 채운다. 그 뒤에 쓰고 있는 것을 덮어쓰지 않기 위해서다.
   */
  const hydrated = useRef(Boolean(answer))
  useEffect(() => {
    if (hydrated.current || !answer) return
    hydrated.current = true
    setChoice(answer.choice)
    setReason(answer.reason)
    setSaved(true)
  }, [answer])

  const cur = LAYERS[layer]
  const tone = TONES[index % TONES.length]

  function submitCheck() {
    if (!choice) {
      setError('하나를 골라 주세요.')
      return
    }
    if (!reason.trim()) {
      setError('이유를 한 줄이라도 적어야 제출됩니다.')
      return
    }
    setError(null)
    setSaved(true)
    onAnswer?.(choice, reason.trim())
  }

  return (
    <article>
      <ColorBlock tone={tone}>
        <div className="flex items-center gap-xs" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <Badge>개념 {index + 1}</Badge>
          <h3 className="text-headline" style={{ margin: 0 }}>
            {concept.term}
          </h3>
        </div>

        {/* 층 이동 — 순서를 눈에 보이게 둔다 */}
        <nav aria-label={`${concept.term} 설명 단계`} style={{ marginBottom: 16 }}>
          <ol className="flex flex-wrap gap-xxs" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {LAYERS.map((l, i) => (
              <li key={l.key}>
                <button
                  type="button"
                  className="tab"
                  data-selected={i === layer}
                  aria-current={i === layer ? 'step' : undefined}
                  onClick={() => setLayer(i)}
                  style={{ fontSize: 13, minHeight: 36, padding: '4px 12px' }}
                >
                  <span className="font-mono" style={{ marginRight: 4 }}>
                    {i + 1}
                  </span>
                  {l.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/*
          ★ 꼭 알아야 할 것은 층을 넘기지 않아도 늘 보인다.
            층 안에 숨겨 두면 강조한 것이 아니라 숨긴 것이 된다.
        */}
        {(concept.mustKnow?.length ?? 0) > 0 ? (
          <div
            className="bg-canvas rounded-md"
            style={{ padding: '14px 18px', marginBottom: 16, boxShadow: 'inset 0 0 0 2px #000' }}
          >
            <Caption>꼭 알아야 할 것</Caption>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {(concept.mustKnow ?? []).map((m, i) => (
                <li key={i} className="text-body" style={{ marginBottom: 6, fontWeight: 480 }}>
                  <Rich text={m} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div style={{ minHeight: 120 }}>
          <Caption>{cur.label}</Caption>
          {cur.key === 'theory' ? (
            linked.length === 0 ? (
              <p className="text-body" style={{ margin: '8px 0 0', opacity: 0.7 }}>
                이 카드에 붙은 이론 항목이 아직 없습니다. 차시의 「이론 배경」에서 계보를 볼 수 있습니다.
              </p>
            ) : (
              <div className="flex flex-col gap-md" style={{ marginTop: 8 }}>
                {linked.map((e) => (
                  <EntryView key={e.id} entry={e} compact />
                ))}
                {openEntry ? (
                  <div>
                    <Button variant="secondary" onClick={() => openEntry(linked[0].id)}>
                      이론 배경에서 원문·교재·더 읽을 것 보기 →
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          ) : cur.key === 'deepDive' ? (
            (concept.deepDive?.length ?? 0) === 0 ? (
              <p className="text-body" style={{ margin: '8px 0 0', opacity: 0.7 }}>
                아직 더 읽을 내용이 없습니다.
              </p>
            ) : (
              <div className="flex flex-col gap-md" style={{ marginTop: 8 }}>
                {(concept.deepDive ?? []).map((d, i) => (
                  <section key={i}>
                    <h4 className="text-body-lg" style={{ margin: 0, fontWeight: 480 }}>
                      {d.title}
                    </h4>
                    <p
                      className="text-body"
                      style={{ margin: '6px 0 0', whiteSpace: 'pre-line' }}
                    >
                      <Rich text={d.body} />
                    </p>
                  </section>
                ))}
              </div>
            )
          ) : cur.key === 'notToConfuseWith' ? (
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {concept.notToConfuseWith.map((n, i) => (
                <li key={i} className="text-body" style={{ marginBottom: 6 }}>
                  <Rich text={n} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-lg" style={{ margin: '8px 0 0', whiteSpace: 'pre-line' }}>
              <Rich text={concept[cur.key as 'plainOneLiner']} />
            </p>
          )}
        </div>

        <div className="flex gap-xs" style={{ marginTop: 16 }}>
          <Button
            variant="secondary"
            disabled={layer === 0}
            onClick={() => setLayer((l) => Math.max(0, l - 1))}
          >
            이전
          </Button>
          <Button
            variant="secondary"
            disabled={layer === LAYERS.length - 1}
            onClick={() => setLayer((l) => Math.min(LAYERS.length - 1, l + 1))}
          >
            다음
          </Button>
        </div>
      </ColorBlock>

      {/* 잠깐 확인 — 색 블록 밖 흰 바탕에 둔다 */}
      <div className="card" style={{ marginTop: 24 }}>
        <Caption>잠깐 확인</Caption>
        <fieldset style={{ border: 0, padding: 0, margin: '8px 0 0' }}>
          <legend className="text-body" style={{ fontWeight: 480, paddingBottom: 8 }}>
            {concept.check.prompt}
          </legend>
          <div className="flex flex-col gap-xxs">
            {concept.check.options.map((opt) => (
              <label
                key={opt}
                className="flex items-start gap-sm rounded-md"
                style={{
                  padding: '10px 12px',
                  boxShadow: `inset 0 0 0 ${choice === opt ? 2 : 1}px ${choice === opt ? '#000' : '#e6e6e6'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name={`check-${concept.id}`}
                  checked={choice === opt}
                  onChange={() => {
                    setChoice(opt)
                    setSaved(false)
                    setError(null)
                  }}
                  style={{ marginTop: 4 }}
                />
                <span className="text-body-sm">{opt}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-xs" style={{ marginTop: 12 }}>
          <label htmlFor={`reason-${concept.id}`} className="text-body-sm" style={{ fontWeight: 480 }}>
            그렇게 고른 이유 <span className="font-mono text-caption">필수</span>
          </label>
          <input
            id={`reason-${concept.id}`}
            className="field"
            type="text"
            value={reason}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setReason(e.target.value)
              setSaved(false)
              setError(null)
            }}
          />
        </div>

        {error ? (
          <p role="alert" className="text-body-sm" style={{ fontWeight: 480, marginTop: 8 }}>
            ⚠ {error}
          </p>
        ) : null}

        <div className="flex items-center gap-md" style={{ marginTop: 12 }}>
          <Button onClick={submitCheck}>확인</Button>
          {saved ? (
            <span className="caption" role="status">
              저장됨
            </span>
          ) : null}
        </div>

        <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.72 }}>
          <strong>적용 질문</strong> · {concept.applyQuestion}
        </p>
      </div>
    </article>
  )
}

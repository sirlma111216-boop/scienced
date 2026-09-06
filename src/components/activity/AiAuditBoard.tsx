import { useMemo } from 'react'
import { Badge, Caption, ScrollX } from '@/components/ui'

/**
 * AI 응답 검증 보드 (17강).
 *
 * 문장마다 사실 / 해석 / 출처 필요 / 불확실 / 오류를 표시하고,
 * 원출처 링크와 수정 이유를 남긴다.
 *
 * 전체를 통으로 "맞다/틀리다"로 판정하지 않는 것이 핵심이다.
 * 부분적으로 맞는 설명이 가장 위험하다 — 맞는 문장 사이에 틀린 문장이 섞이면
 * 전체가 그럴듯해진다.
 */

export const VERDICTS = [
  { key: 'fact', label: '사실', mark: 'F', hint: '확인 가능한 진술' },
  { key: 'interpretation', label: '해석', mark: 'I', hint: '자료에 의미를 붙인 것' },
  { key: 'needsSource', label: '출처 필요', mark: 'S', hint: '어디서 왔는지 확인해야 함' },
  { key: 'uncertain', label: '불확실', mark: 'U', hint: '지금 자료로는 못 정함' },
  { key: 'error', label: '오류', mark: 'X', hint: '반례가 있음' },
] as const

export type VerdictKey = (typeof VERDICTS)[number]['key']

export interface AiAuditValue {
  /** 문장 번호 → 판정 */
  verdicts: Record<number, VerdictKey>
  /** 문장 번호 → 근거·원출처 */
  notes: Record<number, string>
  counterexample: string
  revised: string
}

export function AiAuditBoard({
  sentences,
  value,
  onChange,
  /** 이 사람에게 배정된 문장 번호. 비면 전부 볼 수 있다. */
  assigned,
}: {
  sentences: string[]
  value: AiAuditValue | null
  onChange: (v: AiAuditValue) => void
  assigned?: number[]
}) {
  const v: AiAuditValue = value ?? { verdicts: {}, notes: {}, counterexample: '', revised: '' }

  const done = useMemo(() => Object.keys(v.verdicts).length, [v.verdicts])
  const errors = useMemo(
    () => Object.entries(v.verdicts).filter(([, k]) => k === 'error').length,
    [v.verdicts],
  )
  const mixed = errors > 0 && errors < sentences.length

  function patch(next: Partial<AiAuditValue>) {
    onChange({ ...v, ...next })
  }

  return (
    <section className="flex flex-col gap-lg">
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge>AI 응답 검증 보드</Badge>
        <Badge>
          {done} / {sentences.length} 문장 판정
        </Badge>
        {errors > 0 ? <Badge solid>오류 {errors}</Badge> : null}
      </div>

      {assigned?.length ? (
        <p className="text-body-sm" style={{ margin: 0 }}>
          배정된 문장: <span className="font-mono">{assigned.map((i) => i + 1).join(', ')}</span>번.
          맡은 문장만 판정하면 됩니다. 대신 그 문장의 원출처까지 실제로 찾아가 주세요.
        </p>
      ) : null}

      <ScrollX>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
          <caption className="caption" style={{ textAlign: 'left', paddingBottom: 8 }}>
            판정 표식 — {VERDICTS.map((d) => `${d.mark} ${d.label}`).join(' · ')}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 12px 8px 0', width: 40 }}>
                번호
              </th>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}>
                문장
              </th>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 12px 8px 0', width: 200 }}>
                판정
              </th>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 0', width: 220 }}>
                근거 · 원출처
              </th>
            </tr>
          </thead>
          <tbody>
            {sentences.map((s, i) => {
              const mine = !assigned?.length || assigned.includes(i)
              const picked = v.verdicts[i]
              return (
                <tr
                  key={i}
                  style={{
                    boxShadow: 'inset 0 -1px 0 #f1f1f1',
                    opacity: mine ? 1 : 0.5,
                  }}
                >
                  <th
                    scope="row"
                    className="font-mono text-body-sm"
                    style={{ textAlign: 'left', padding: '12px 12px 12px 0', fontWeight: 400, verticalAlign: 'top' }}
                  >
                    {i + 1}
                  </th>
                  <td className="text-body-sm" style={{ padding: '12px 12px 12px 0', verticalAlign: 'top' }}>
                    {s}
                  </td>
                  <td style={{ padding: '12px 12px 12px 0', verticalAlign: 'top' }}>
                    <div className="flex flex-wrap gap-xxs">
                      {VERDICTS.map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          className="tab"
                          disabled={!mine}
                          aria-pressed={picked === d.key}
                          data-selected={picked === d.key}
                          title={d.hint}
                          onClick={() =>
                            patch({
                              verdicts:
                                picked === d.key
                                  ? Object.fromEntries(
                                      Object.entries(v.verdicts).filter(([k]) => Number(k) !== i),
                                    )
                                  : { ...v.verdicts, [i]: d.key },
                            })
                          }
                          style={{ fontSize: 13, minHeight: 36, padding: '4px 10px' }}
                        >
                          {/* 색만으로 구분하지 않는다 */}
                          <span className="font-mono" aria-hidden style={{ marginRight: 4 }}>
                            {d.mark}
                          </span>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px 0', verticalAlign: 'top' }}>
                    <input
                      className="field"
                      value={v.notes[i] ?? ''}
                      disabled={!mine}
                      aria-label={`${i + 1}번 문장의 근거와 원출처`}
                      placeholder="검색 결과 첫 페이지가 아니라 원자료까지"
                      onChange={(e) => patch({ notes: { ...v.notes, [i]: e.target.value } })}
                      style={{ minHeight: 40, padding: '6px 10px' }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ScrollX>

      {mixed ? (
        <div
          role="status"
          className="rounded-md bg-coral"
          style={{ padding: '12px 16px' }}
        >
          <p className="text-body-sm" style={{ margin: 0, fontWeight: 480 }}>
            맞는 문장 사이에 틀린 문장이 섞여 있습니다. 전부 틀린 응답보다 이쪽이 더 위험합니다 —
            전체가 그럴듯해 보이기 때문입니다.
          </p>
        </div>
      ) : null}

      <div className="card flex flex-col gap-lg">
        <div className="flex flex-col gap-xs">
          <label htmlFor="aa-counter" className="text-body-sm" style={{ fontWeight: 480 }}>
            이 설명을 무너뜨리는 반례 하나
          </label>
          <input
            id="aa-counter"
            className="field"
            value={v.counterexample}
            onChange={(e) => patch({ counterexample: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-xs">
          <label htmlFor="aa-revised" className="text-body-sm" style={{ fontWeight: 480 }}>
            고쳐 쓴 설명 (중학생용)
          </label>
          <textarea
            id="aa-revised"
            className="field"
            rows={4}
            value={v.revised}
            onChange={(e) => patch({ revised: e.target.value })}
            style={{ resize: 'vertical' }}
          />
        </div>
        <Caption>
          AI 출력에는 모델·날짜·주요 프롬프트·사람의 검증·사용한 출처를 함께 기록합니다.
        </Caption>
      </div>
    </section>
  )
}

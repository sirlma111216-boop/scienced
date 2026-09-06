import { useMemo, useState } from 'react'
import { Badge, Button, Caption, ScrollX } from '@/components/ui'

/**
 * 루브릭 스튜디오 (16강).
 *
 * 채점자 간 차이는 기술어 문장을 늘려서 줄지 않는다.
 * 수준별 실제 산출물(앵커)을 함께 보고 경계 사례를 공동 채점해야 줄어든다.
 *
 * 이 도구가 하는 일:
 *  1. 모호한 낱말을 규칙으로 찾아 표시한다 (AI 없이 먼저 잡는다)
 *  2. 수준마다 앵커를 요구한다
 *  3. 같은 산출물에 매긴 점수를 나란히 놓아 어디서 갈렸는지 보인다
 *
 * 점수를 자동으로 매기지 않는다. 판단은 사람이 한다.
 */

/** 사람마다 다르게 읽히는 낱말. 이 목록은 컨텍스트 23.8 과 18.5 에서 왔다. */
export const VAGUE_WORDS = [
  '충분히',
  '충분한',
  '적절히',
  '적절한',
  '잘',
  '우수',
  '보통',
  '미흡',
  '노력',
  '성실',
  '열심',
  '어느 정도',
  '대체로',
  '깔끔',
  '정확히',
  '많이',
  '다양한',
]

export interface RubricLevel {
  id: string
  label: string
  descriptor: string
  /** 이 수준에 해당하는 실제 학생 문장 */
  anchor: string
}

export interface RubricDimension {
  id: string
  name: string
  levels: RubricLevel[]
}

export interface RubricValue {
  construct: string
  dimensions: RubricDimension[]
  /** 차원 id → 내가 매긴 수준 id */
  myScores: Record<string, string>
  /** 차원 id → 짝이 매긴 수준 id (경계 사례 비교용) */
  peerScores: Record<string, string>
  fairness: string
}

const LEVELS = [
  { id: 'l1', label: '초기' },
  { id: 'l2', label: '발달' },
  { id: 'l3', label: '충실' },
  { id: 'l4', label: '정교' },
]

function newDimension(name = ''): RubricDimension {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    levels: LEVELS.map((l) => ({ id: l.id, label: l.label, descriptor: '', anchor: '' })),
  }
}

const DEFAULT: RubricValue = {
  construct: '',
  dimensions: [newDimension('증거 기반 설명')],
  myScores: {},
  peerScores: {},
  fairness: '',
}

/** 문장에서 모호한 낱말을 찾아 표시한다. */
export function findVague(text: string): string[] {
  return VAGUE_WORDS.filter((w) => text.includes(w))
}

function Highlighted({ text }: { text: string }) {
  const hits = findVague(text)
  if (hits.length === 0) return <>{text}</>
  // 모호한 낱말에 밑줄과 표식을 함께 준다. 색만으로 표시하지 않는다.
  const pattern = new RegExp(`(${hits.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  return (
    <>
      {text.split(pattern).map((part, i) =>
        hits.includes(part) ? (
          <mark
            key={i}
            style={{
              background: 'transparent',
              textDecoration: 'underline wavy',
              textUnderlineOffset: 3,
              fontWeight: 480,
            }}
          >
            {part}
            <span className="font-mono text-caption" style={{ verticalAlign: 'super' }}>
              ?
            </span>
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

export function RubricStudio({
  value,
  onChange,
}: {
  value: RubricValue | null
  onChange: (v: RubricValue) => void
}) {
  const v: RubricValue = value ?? DEFAULT
  const [newName, setNewName] = useState('')

  const vagueCount = useMemo(
    () =>
      v.dimensions.reduce(
        (sum, d) => sum + d.levels.reduce((s, l) => s + findVague(l.descriptor).length, 0),
        0,
      ),
    [v.dimensions],
  )
  const missingAnchors = useMemo(
    () =>
      v.dimensions.reduce(
        (s, d) => s + d.levels.filter((l) => l.descriptor.trim() && !l.anchor.trim()).length,
        0,
      ),
    [v.dimensions],
  )

  /** 나와 짝의 점수가 갈린 차원 — 여기가 오늘의 자료다 */
  const disagreements = v.dimensions.filter(
    (d) => v.myScores[d.id] && v.peerScores[d.id] && v.myScores[d.id] !== v.peerScores[d.id],
  )

  function patch(next: Partial<RubricValue>) {
    onChange({ ...v, ...next })
  }

  function setLevel(dimId: string, levelId: string, field: 'descriptor' | 'anchor', text: string) {
    patch({
      dimensions: v.dimensions.map((d) =>
        d.id !== dimId
          ? d
          : { ...d, levels: d.levels.map((l) => (l.id === levelId ? { ...l, [field]: text } : l)) },
      ),
    })
  }

  return (
    <section className="flex flex-col gap-lg">
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge>루브릭 스튜디오</Badge>
        <Badge>차원 {v.dimensions.length}</Badge>
        {vagueCount > 0 ? <Badge>모호한 표현 {vagueCount}</Badge> : null}
        {missingAnchors > 0 ? <Badge>앵커 없음 {missingAnchors}</Badge> : null}
      </div>

      <div className="card flex flex-col gap-xs">
        <label htmlFor="rs-construct" className="text-body-sm" style={{ fontWeight: 480 }}>
          이 평가로 재려는 구인 — 과제보다 먼저 정합니다
        </label>
        <input
          id="rs-construct"
          className="field"
          value={v.construct}
          placeholder="예: 자료를 골라 주장과 잇고 대안 설명을 검토하는 능력"
          onChange={(e) => patch({ construct: e.target.value })}
        />
        <Caption>‘현미경을 사용할 수 있다’는 기구명 암기일 수도, 상의 질일 수도 있습니다.</Caption>
      </div>

      {v.dimensions.map((d) => (
        <div key={d.id} className="card">
          <div className="flex items-center gap-xs" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              className="field"
              value={d.name}
              aria-label="차원 이름"
              onChange={(e) =>
                patch({
                  dimensions: v.dimensions.map((x) =>
                    x.id === d.id ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
              style={{ maxWidth: 320 }}
            />
            <span className="flex-1" />
            <Button
              variant="tertiary"
              onClick={() =>
                patch({ dimensions: v.dimensions.filter((x) => x.id !== d.id) })
              }
            >
              차원 지우기
            </Button>
          </div>

          <ScrollX>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
              <thead>
                <tr>
                  <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 12px 8px 0', width: 70 }}>
                    수준
                  </th>
                  <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}>
                    기술어
                  </th>
                  <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 0' }}>
                    앵커 — 이 수준의 실제 학생 문장
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.levels.map((l) => {
                  const vague = findVague(l.descriptor)
                  return (
                    <tr key={l.id} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                      <th
                        scope="row"
                        className="text-body-sm"
                        style={{ textAlign: 'left', padding: '10px 12px 10px 0', fontWeight: 480, verticalAlign: 'top' }}
                      >
                        {l.label}
                      </th>
                      <td style={{ padding: '10px 12px 10px 0', verticalAlign: 'top' }}>
                        <textarea
                          className="field"
                          rows={2}
                          value={l.descriptor}
                          aria-label={`${d.name} ${l.label} 기술어`}
                          onChange={(e) => setLevel(d.id, l.id, 'descriptor', e.target.value)}
                          style={{ resize: 'vertical', minHeight: 60 }}
                        />
                        {vague.length > 0 ? (
                          <p className="text-body-sm" style={{ margin: '6px 0 0' }}>
                            <Highlighted text={l.descriptor} />
                          </p>
                        ) : null}
                        {vague.length > 0 ? (
                          <p className="caption" style={{ marginTop: 4 }}>
                            사람마다 다르게 읽힐 말: {vague.join(', ')} — 관찰 가능한 수행으로 바꿔
                            보세요. 문장을 늘리는 것이 아닙니다.
                          </p>
                        ) : null}
                      </td>
                      <td style={{ padding: '10px 0', verticalAlign: 'top' }}>
                        <textarea
                          className="field"
                          rows={2}
                          value={l.anchor}
                          aria-label={`${d.name} ${l.label} 앵커`}
                          placeholder="이 수준에 해당하는 실제 문장을 그대로 옮겨 적습니다"
                          onChange={(e) => setLevel(d.id, l.id, 'anchor', e.target.value)}
                          style={{ resize: 'vertical', minHeight: 60 }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollX>

          {/* 채점 — 나와 짝 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginTop: 16,
            }}
          >
            {[
              { key: 'myScores' as const, label: '내가 매긴 수준' },
              { key: 'peerScores' as const, label: '짝이 매긴 수준' },
            ].map((s) => (
              <div key={s.key} className="flex flex-col gap-xs">
                <label htmlFor={`rs-${s.key}-${d.id}`} className="text-body-sm" style={{ fontWeight: 480 }}>
                  {s.label}
                </label>
                <select
                  id={`rs-${s.key}-${d.id}`}
                  className="field"
                  value={v[s.key][d.id] ?? ''}
                  onChange={(e) => patch({ [s.key]: { ...v[s.key], [d.id]: e.target.value } })}
                >
                  <option value="">아직</option>
                  {d.levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card">
        <Caption>차원 추가</Caption>
        <div className="flex gap-xs" style={{ marginTop: 8 }}>
          <input
            className="field"
            value={newName}
            aria-label="새 차원 이름"
            placeholder="예: 불확실성 처리"
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button
            onClick={() => {
              if (!newName.trim()) return
              patch({ dimensions: [...v.dimensions, newDimension(newName.trim())] })
              setNewName('')
            }}
          >
            추가
          </Button>
        </div>
        <Caption style={{ marginTop: 8 }}>
          차원이 다섯 개를 넘으면 한 수업 안에서 실제로 채점하기 어렵습니다.
        </Caption>
      </div>

      {/* 경계 사례 — 점수가 갈린 자리 */}
      {disagreements.length > 0 ? (
        <div className="card">
          <div className="flex items-center gap-xs" style={{ marginBottom: 12 }}>
            <h4 className="text-card-title" style={{ margin: 0 }}>
              점수가 갈린 차원
            </h4>
            <Badge solid>{disagreements.length}개</Badge>
          </div>
          <p className="text-body-sm" style={{ opacity: 0.72 }}>
            누가 맞았는지 가리지 않습니다. 기준 문구의 어느 말에서 갈렸는지 찾습니다.
          </p>
          <ul style={{ margin: '12px 0 0', paddingLeft: 20 }}>
            {disagreements.map((d) => {
              const mine = d.levels.find((l) => l.id === v.myScores[d.id])
              const peer = d.levels.find((l) => l.id === v.peerScores[d.id])
              return (
                <li key={d.id} className="text-body-sm" style={{ marginBottom: 8 }}>
                  <strong>{d.name}</strong> — 나 {mine?.label} / 짝 {peer?.label}
                  {mine?.descriptor ? (
                    <span style={{ display: 'block', opacity: 0.78 }}>
                      내 기준: <Highlighted text={mine.descriptor} />
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="card flex flex-col gap-xs">
        <label htmlFor="rs-fair" className="text-body-sm" style={{ fontWeight: 480 }}>
          공정성 점검 — 목표와 무관하게 점수를 좌우할 수 있는 요인
        </label>
        <textarea
          id="rs-fair"
          className="field"
          rows={2}
          value={v.fairness}
          placeholder="___ 때문에 ___ 학생이 불리해질 수 있다"
          onChange={(e) => patch({ fairness: e.target.value })}
          style={{ resize: 'vertical' }}
        />
        <Caption>이 점수 차이는 학습목표의 차이인가, 글솜씨·기기·가정 자원의 차이인가?</Caption>
      </div>
    </section>
  )
}

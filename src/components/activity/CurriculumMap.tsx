import { useMemo, useState } from 'react'
import {
  DOMAINS,
  searchStandards,
  type CurriculumEdition,
  type SchoolLevel,
  type Standard,
} from '@/content/curriculum'
import { Badge, Button, Caption, ScrollX } from '@/components/ui'

/**
 * 교육과정 맵 (6강) 겸 교육과정 메타데이터 검색.
 *
 * 학교급·영역·교육과정 판을 고르면 성취기준과 선수·후속 개념이 나온다.
 *
 * 두 가지를 화면에서 강제한다.
 *  · 자료마다 교육과정 판과 적용 연도를 먼저 보인다. 단원 이름이 같아도 같은 교육과정이 아니다.
 *  · 원문 대조를 마치지 않은 항목은 「대표 예시」로 표시하고 성취기준 코드를 붙이지 않는다.
 */

export interface CurriculumMapValue {
  /** 골라서 해부한 성취기준 */
  standardId: string
  layerContent: string
  layerPractice: string
  layerEpistemic: string
  layerValue: string
  bigIdea: string
}

const EMPTY: CurriculumMapValue = {
  standardId: '',
  layerContent: '',
  layerPractice: '',
  layerEpistemic: '',
  layerValue: '',
  bigIdea: '',
}

export function CurriculumMap({
  value,
  onChange,
}: {
  value: CurriculumMapValue | null
  onChange: (v: CurriculumMapValue) => void
}) {
  const v = value ?? EMPTY
  const [edition, setEdition] = useState<CurriculumEdition | ''>('2022 개정')
  const [level, setLevel] = useState<SchoolLevel | ''>('')
  const [domain, setDomain] = useState('')
  const [text, setText] = useState('')

  const results = useMemo(
    () => searchStandards({ edition, level, domain, text }),
    [edition, level, domain, text],
  )
  const picked = results.find((s) => s.id === v.standardId) ?? null

  function patch(next: Partial<CurriculumMapValue>) {
    onChange({ ...v, ...next })
  }

  return (
    <section className="flex flex-col gap-lg">
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge>교육과정 맵</Badge>
        <Badge>{results.length}건</Badge>
      </div>

      {/* 검색 */}
      <div className="card">
        <Caption>찾기 — 교육과정 판을 먼저 고릅니다</Caption>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginTop: 12,
          }}
        >
          <div className="flex flex-col gap-xs">
            <label htmlFor="cm-ed" className="text-body-sm" style={{ fontWeight: 480 }}>
              교육과정 판
            </label>
            <select
              id="cm-ed"
              className="field"
              value={edition}
              onChange={(e) => setEdition(e.target.value as CurriculumEdition | '')}
            >
              <option value="">전부</option>
              <option value="2022 개정">2022 개정</option>
              <option value="2015 개정">2015 개정</option>
            </select>
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor="cm-lv" className="text-body-sm" style={{ fontWeight: 480 }}>
              학교급
            </label>
            <select
              id="cm-lv"
              className="field"
              value={level}
              onChange={(e) => setLevel(e.target.value as SchoolLevel | '')}
            >
              <option value="">전부</option>
              <option value="중학교">중학교</option>
              <option value="고등학교">고등학교</option>
            </select>
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor="cm-dm" className="text-body-sm" style={{ fontWeight: 480 }}>
              영역
            </label>
            <select
              id="cm-dm"
              className="field"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            >
              <option value="">전부</option>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor="cm-q" className="text-body-sm" style={{ fontWeight: 480 }}>
              낱말
            </label>
            <input
              id="cm-q"
              className="field"
              value={text}
              placeholder="예: 입자, 생태계"
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 결과 */}
      <ScrollX>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 780 }}>
          <thead>
            <tr>
              {['판·적용', '학교급·영역', '성취기준', '핵심 아이디어', ''].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="caption"
                  style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((s: Standard) => (
              <tr key={s.id} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                <td style={{ padding: '12px 12px 12px 0', verticalAlign: 'top' }}>
                  <span className="text-body-sm">{s.edition}</span>
                  <span className="font-mono text-caption" style={{ display: 'block', opacity: 0.7 }}>
                    {s.appliedFrom}년 적용
                  </span>
                </td>
                <td className="text-body-sm" style={{ padding: '12px 12px 12px 0', verticalAlign: 'top' }}>
                  {s.level} {s.grade}
                  <span style={{ display: 'block', opacity: 0.7 }}>{s.domain}</span>
                </td>
                <td style={{ padding: '12px 12px 12px 0', verticalAlign: 'top', maxWidth: 300 }}>
                  <span className="text-body-sm">{s.text}</span>
                  <span style={{ display: 'block', marginTop: 6 }}>
                    {/* 원문 대조 전에는 코드를 붙이지 않는다 */}
                    {s.verified && s.code ? (
                      <Badge>{s.code}</Badge>
                    ) : (
                      <Badge>대표 예시 · 원문 대조 전</Badge>
                    )}
                  </span>
                </td>
                <td className="text-body-sm" style={{ padding: '12px 12px 12px 0', verticalAlign: 'top', maxWidth: 240 }}>
                  {s.bigIdea}
                </td>
                <td style={{ padding: '12px 0', verticalAlign: 'top' }}>
                  <Button
                    variant={v.standardId === s.id ? 'primary' : 'secondary'}
                    onClick={() =>
                      patch({
                        standardId: s.id,
                        bigIdea: v.bigIdea || s.bigIdea,
                      })
                    }
                  >
                    {v.standardId === s.id ? '고름' : '이걸로'}
                  </Button>
                </td>
              </tr>
            ))}
            {results.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-body-sm" style={{ padding: 16, opacity: 0.6 }}>
                  조건에 맞는 성취기준이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </ScrollX>

      {/* 선수·후속 */}
      {picked ? (
        <div className="card">
          <Caption>선수 · 후속 개념</Caption>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              marginTop: 12,
            }}
          >
            <div>
              <Caption>앞에 와야 하는 것</Caption>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {picked.prerequisites.map((p) => (
                  <li key={p} className="text-body-sm">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Caption>이 성취기준</Caption>
              <p className="text-body-sm" style={{ margin: '6px 0 0', fontWeight: 480 }}>
                {picked.text}
              </p>
            </div>
            <div>
              <Caption>뒤에 오는 것</Caption>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {picked.next.map((p) => (
                  <li key={p} className="text-body-sm">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <Caption>이 성취기준이 요구하는 세 범주</Caption>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              <li className="text-body-sm">지식·이해 — {picked.categories.knowledge}</li>
              <li className="text-body-sm">과정·기능 — {picked.categories.practice}</li>
              <li className="text-body-sm">가치·태도 — {picked.categories.value}</li>
            </ul>
            <Caption style={{ marginTop: 8 }}>
              위 세 줄은 참고용입니다. 아래 네 층은 직접 써야 저장됩니다.
            </Caption>
          </div>
        </div>
      ) : null}

      {/* 네 층 해부 — 직접 쓴다 */}
      <div className="card flex flex-col gap-lg">
        <Caption>성취기준 네 층 해부 — 직접 씁니다</Caption>
        {[
          { key: 'layerContent' as const, label: '내용 — 학생이 설명에 쓸 개념·원리·모형' },
          { key: 'layerPractice' as const, label: '실행 — 학생이 실제로 해야 하는 과학적 행동' },
          { key: 'layerEpistemic' as const, label: '인식론 — 좋은 수행이라고 판단할 과학적 기준' },
          { key: 'layerValue' as const, label: '가치·태도 — 어떤 책임·협력·참여를 경험하는가' },
          { key: 'bigIdea' as const, label: '이 성취기준이 기여하는 핵심 아이디어 한 문장' },
        ].map((f) => (
          <div key={f.key} className="flex flex-col gap-xs">
            <label htmlFor={`cm-${f.key}`} className="text-body-sm" style={{ fontWeight: 480 }}>
              {f.label}
            </label>
            <input
              id={`cm-${f.key}`}
              className="field"
              value={v[f.key]}
              onChange={(e) => patch({ [f.key]: e.target.value })}
            />
          </div>
        ))}
        <Caption>동사에 밑줄부터 치세요. 명사만 남기면 활동은 생기지만 목표는 사라집니다.</Caption>
      </div>
    </section>
  )
}

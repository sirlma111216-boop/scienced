import type { TheoryEntry } from '@/content/types'
import { Badge, Caption } from '@/components/ui'
import { withEmphasis } from '@/components/emphasis'
import { FigureBlock } from '@/components/stimulus/StimulusView'

/**
 * 이론 항목 하나 (5차 K.1·K.2).
 *
 *   정식 명칭 · 연구자 · 무엇을 주장하는가 · 본문과의 연결 · 한계와 비판 · 원문 인용 · 도식 · 교재 · 더 읽을 것
 *
 * 여기서는 학술 용어를 정확히 쓴다. 쉬운 말 규칙은 본문의 것이고, 이 자리는 그 본문이
 * 누구의 무슨 이론인지를 적는 자리다.
 *
 * ★ verified 가 꺼져 있으면 「확인 중」 배지를 단다. 숨기지 않는다 — 미확인임을 알린 채 보인다.
 *   「대표 예시」 라벨과 같은 방식이다.
 */
export function EntryView({
  entry,
  compact = false,
  isInstructor = false,
}: {
  entry: TheoryEntry
  /** 개념 카드 탭용. 주장·연결·한계만 보이고 나머지는 차시 화면으로 보낸다. */
  compact?: boolean
  isInstructor?: boolean
}) {
  return (
    <article id={`theory-${entry.id}`} style={{ scrollMarginTop: 120 }}>
      <div className="flex items-baseline gap-xs" style={{ flexWrap: 'wrap' }}>
        <h3 className={compact ? 'text-body-lg' : 'text-headline'} style={{ margin: 0 }}>
          {entry.termKo}
        </h3>
        <span className="font-mono text-body-sm" style={{ opacity: 0.75 }}>
          {entry.termEn}
        </span>
        {entry.verified ? null : <Badge>확인 중</Badge>}
      </div>

      <p className="text-body-sm" style={{ margin: '6px 0 0', opacity: 0.85 }}>
        {entry.scholars.map((s, i) => (
          <span key={i}>
            {i > 0 ? ' · ' : ''}
            {s.nameKo}{' '}
            <span className="font-mono" style={{ fontSize: 12 }}>
              ({s.nameEn}
              {s.year ? `, ${s.year}` : ''})
            </span>
          </span>
        ))}
      </p>

      <Section label="무엇을 주장하는가" text={entry.claim} />
      <Section label="본문과의 연결" text={entry.bridgeToPlain} />
      <Section label="한계와 비판" text={entry.limits} />

      {!compact && entry.quotes && entry.quotes.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <Caption>원문 인용</Caption>
          {entry.quotes.map((q, i) => (
            <blockquote
              key={i}
              style={{
                margin: '8px 0 0',
                padding: '10px 16px',
                borderLeft: '3px solid #000',
              }}
            >
              <p className="text-body" style={{ margin: 0 }}>
                {q.ko}
              </p>
              <p
                className="text-body-sm"
                lang="en"
                style={{ margin: '6px 0 0', opacity: 0.72, fontStyle: 'italic' }}
              >
                {q.original}
              </p>
              <p className="caption" style={{ margin: '6px 0 0' }}>
                — {q.source}
              </p>
            </blockquote>
          ))}
        </div>
      ) : null}

      {!compact && entry.figure ? (
        <div style={{ marginTop: 16 }}>
          <Caption>도식</Caption>
          <FigureBlock spec={entry.figure} isInstructor={isInstructor} />
        </div>
      ) : null}

      {!compact ? (
        <div style={{ marginTop: 16 }}>
          <p className="text-body-sm" style={{ margin: 0 }}>
            <strong>교재</strong> · {entry.textbookRef}
          </p>
          {entry.readings.length > 0 ? (
            <>
              <p className="text-body-sm" style={{ margin: '8px 0 0' }}>
                <strong>더 읽을 것</strong>
              </p>
              <ul className="text-body-sm" style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                {entry.readings.map((r, i) => (
                  <li key={i}>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer">
                        {r.title}
                      </a>
                    ) : (
                      r.title
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function Section({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginTop: 12 }}>
      <Caption>{label}</Caption>
      <p className="text-body" style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>
        {withEmphasis(text)}
      </p>
    </div>
  )
}

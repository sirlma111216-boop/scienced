import type { ReactNode } from 'react'
import type { KeyConcept } from '@/content/types'
import { Badge, Caption, ColorBlock, type BlockTone } from '@/components/ui'
import { Rich } from '@/components/theory/Rich'

/**
 * 개념 카드 — 화면 한 장, 넘길 층이 없다 (8차 4.4).
 *
 *   이름 → 무엇인가(문단) → 왜 필요한가(문단) → 교실에서(문단) → 기준 3줄 → 헷갈리는 것 → 잠깐 확인 → (접힘) 더 읽기
 *
 * 쓰는 칸이 없다. 강사가 화면을 띄우고 설명한다.
 * 잠깐 확인(4지선다, 이유 칸 없음)은 children 으로 받는다 — 학생은 푸는 칸, 강사는 분포 (강의자 지시 2026-09-18).
 */

const TONES: BlockTone[] = ['lime', 'lilac', 'cream', 'mint']

export function ConceptCard({ concept, index, children }: { concept: KeyConcept; index: number; children?: ReactNode }) {
  const tone = TONES[index % TONES.length]
  return (
    <article id={`concept-${concept.id}`}>
      <ColorBlock tone={tone}>
        <div className="flex items-center gap-xs" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Badge>개념 {index + 1}</Badge>
          <h3 className="text-headline" style={{ margin: 0 }}>
            {concept.name}
          </h3>
        </div>

        <Paragraph label="무엇인가" text={concept.what} />
        <Paragraph label="왜 필요한가" text={concept.why} />
        <Paragraph label="교실에서" text={concept.inClass} />

        <KeyPoints points={concept.keyPoints} />

        {concept.confusedWith ? (
          <p className="text-body-sm" style={{ margin: '12px 0 0', opacity: 0.85 }}>
            <strong>헷갈리는 것</strong> · <Rich text={concept.confusedWith} />
          </p>
        ) : null}

        {children}

        {concept.more ? (
          <details style={{ marginTop: 16 }}>
            <summary className="caption" style={{ cursor: 'pointer' }}>
              더 읽기 — {concept.more.title}
            </summary>
            <p className="text-body" style={{ margin: '8px 0 0', whiteSpace: 'pre-line' }}>
              <Rich text={concept.more.body} />
            </p>
          </details>
        ) : null}
      </ColorBlock>
    </article>
  )
}

/** 기준 3줄. 정리 단계에서 읽기 전용으로 다시 나온다 */
export function KeyPoints({ points, compact = false, name }: { points: readonly string[]; compact?: boolean; name?: string }) {
  return (
    <div className="bg-canvas rounded-md" style={{ padding: compact ? '10px 14px' : '14px 18px', marginTop: compact ? 0 : 20, boxShadow: 'inset 0 0 0 2px #000' }}>
      <Caption>{name ? `${name} · 기준` : '기준'}</Caption>
      <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
        {points.map((m, i) => (
          <li key={i} className={compact ? 'text-body-sm' : 'text-body'} style={{ marginBottom: 6, fontWeight: 480 }}>
            <Rich text={m} />
          </li>
        ))}
      </ol>
    </div>
  )
}

function Paragraph({ label, text }: { label: string; text: string }) {
  if (!text) return null
  return (
    <div style={{ marginTop: 12 }}>
      <Caption>{label}</Caption>
      <p className="text-body-lg" style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>
        <Rich text={text} />
      </p>
    </div>
  )
}

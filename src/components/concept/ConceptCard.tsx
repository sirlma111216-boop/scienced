import type { KeyConcept } from '@/content/types'
import { Badge, Caption, ColorBlock, type BlockTone } from '@/components/ui'
import { Rich } from '@/components/theory/Rich'

/**
 * 개념 카드 — 화면 한 장, 넘길 층이 없다 (8차 4.4).
 *
 *   이름 → 무엇인가(문단) → 왜 필요한가(문단) → 교실에서(문단) → 기준 3줄 → (접힘) 더 읽기
 *
 * 8차 A 과도기: 옛 차시 파일의 여섯 층 필드를 이 모양으로 접어 그린다.
 *   what     = plainOneLiner + formalDefinition
 *   why      = whyItMatters
 *   inClass  = classroomScene
 *   keyPoints = mustKnow 앞 세 줄 (없으면 notToConfuseWith)
 *   more     = deepDive 첫 편
 * 「잠깐 확인」·이론 배경 탭·적용 질문은 그리지 않는다. B 단계에서 새 KeyConcept 타입으로 바뀐다.
 */

const TONES: BlockTone[] = ['lime', 'lilac', 'cream', 'mint']

export function ConceptCard({ concept, index }: { concept: KeyConcept; index: number }) {
  const tone = TONES[index % TONES.length]
  const what = [concept.plainOneLiner, concept.formalDefinition].filter(Boolean).join(' ')
  const points = (concept.mustKnow?.length ? concept.mustKnow : concept.notToConfuseWith).slice(0, 3)
  const more = concept.deepDive?.[0]

  return (
    <article>
      <ColorBlock tone={tone}>
        <div className="flex items-center gap-xs" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Badge>개념 {index + 1}</Badge>
          <h3 className="text-headline" style={{ margin: 0 }}>
            {concept.term}
          </h3>
        </div>

        <Paragraph label="무엇인가" text={what} />
        <Paragraph label="왜 필요한가" text={concept.whyItMatters} />
        <Paragraph label="교실에서" text={concept.classroomScene} />

        <div className="bg-canvas rounded-md" style={{ padding: '14px 18px', marginTop: 20, boxShadow: 'inset 0 0 0 2px #000' }}>
          <Caption>기준</Caption>
          <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {points.map((m, i) => (
              <li key={i} className="text-body" style={{ marginBottom: 6, fontWeight: 480 }}>
                <Rich text={m} />
              </li>
            ))}
          </ol>
        </div>

        {more ? (
          <details style={{ marginTop: 16 }}>
            <summary className="caption" style={{ cursor: 'pointer' }}>
              더 읽기 — {more.title}
            </summary>
            <p className="text-body" style={{ margin: '8px 0 0', whiteSpace: 'pre-line' }}>
              <Rich text={more.body} />
            </p>
          </details>
        ) : null}
      </ColorBlock>
    </article>
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

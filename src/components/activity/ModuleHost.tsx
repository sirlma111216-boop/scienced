import type { LessonId, ModuleComponent } from '@/content/types'
import { AiAuditBoard, type AiAuditValue } from './AiAuditBoard'
import { CardSorter, type CardSorterValue, type SortBin, type SortCard } from './CardSorter'
import { DataStudio, type DataStudioValue } from './DataStudio'
import { NodeCanvas, type CanvasValue } from './NodeCanvas'
import { RubricStudio, type RubricValue } from './RubricStudio'
import { CurriculumMap, type CurriculumMapValue } from './CurriculumMap'

/**
 * 전용 모듈 화면을 골라 그린다.
 *
 * 어떤 모듈이 어떤 재료를 쓰는지는 여기 한 곳에 모은다.
 * 차시 데이터에는 `moduleComponent` 이름만 두고, 재료는 이 파일에서 붙인다.
 * 그래야 콘텐츠 파일이 화면 구현에 얽히지 않는다.
 */

/* ── 11강 · 비유의 대응과 비대응 ── */
const ANALOGY_CARDS: SortCard[] = [
  { id: 'a1', label: '전지 = 펌프', note: '전류를 밀어내는 원천' },
  { id: 'a2', label: '전선 = 파이프', note: '흐름이 지나는 길' },
  { id: 'a3', label: '전구 = 좁은 관', note: '흐름을 방해하는 곳' },
  { id: 'a4', label: '물이 줄어든다', note: '지나가면 양이 준다' },
  { id: 'a5', label: '물이 파이프 안을 빠르게 흐른다', note: '흐름의 속도' },
  { id: 'a6', label: '펌프가 닳는다', note: '원천이 소모된다' },
  { id: 'a7', label: '파이프가 굵으면 잘 흐른다', note: '저항과 단면적' },
]
const ANALOGY_BINS: SortBin[] = [
  { id: 'maps', label: '대응한다', hint: '이 부분은 전기회로에서도 성립한다' },
  { id: 'breaks', label: '대응하지 않는다', hint: '여기서 비유를 멈춰야 한다' },
]

/* ── 13강 · 사실 질문과 가치 질문 ── */
const SSI_CARDS: SortCard[] = [
  { id: 's1', label: '여름 표면 온도가 몇 도 오르는가' },
  { id: 's2', label: '부상률이 실제로 낮아지는가' },
  { id: 's3', label: '미세플라스틱이 얼마나 유출되는가' },
  { id: 's4', label: '누가 부담을 지는 것이 공정한가' },
  { id: 's5', label: '얼마까지 쓰는 것이 적절한가' },
  { id: 's6', label: '연 40일 더 쓰는 것이 그만한 가치인가' },
  { id: 's7', label: '8년 뒤 교체 비용은 얼마인가' },
]
const SSI_BINS: SortBin[] = [
  { id: 'fact', label: '과학이 답할 수 있는 질문', hint: '조사하면 확인된다' },
  { id: 'value', label: '시민이 숙고할 질문', hint: '자료만으로 정해지지 않는다' },
]

/* ── 17강 · AI 응답 문장 ── */
const AI_SENTENCES = [
  '계절이 바뀌는 이유는 지구가 태양 주위를 타원 궤도로 돌기 때문이다.',
  '지구가 태양에 가까워지는 시기에는 더 많은 열을 받아 여름이 된다.',
  '멀어지면 받는 열이 줄어 겨울이 된다.',
  '지구의 자전축은 약 23.5° 기울어져 있다.',
  '이 기울기 때문에 낮의 길이가 계절마다 달라진다.',
  '따라서 계절은 거리와 기울기가 함께 만드는 현상이다.',
]

export function ModuleHost({
  kind,
  lessonId,
  value,
  onChange,
  locked,
}: {
  kind: ModuleComponent
  lessonId: LessonId
  value: unknown
  onChange: (v: unknown) => void
  locked?: boolean
}) {
  switch (kind) {
    case 'nodeCanvas':
      return (
        <NodeCanvas
          // 9강은 모형, 12강은 논증. 같은 부품이 두 가지로 쓰인다.
          mode={lessonId === '12' ? 'argument' : 'model'}
          value={(value as CanvasValue) ?? null}
          onChange={(v) => onChange(v)}
          readOnly={locked}
        />
      )

    case 'dataStudio':
      return (
        <DataStudio value={(value as DataStudioValue) ?? null} onChange={(v) => onChange(v)} />
      )

    case 'cardSorter':
      return (
        <CardSorter
          cards={lessonId === '13' ? SSI_CARDS : ANALOGY_CARDS}
          bins={lessonId === '13' ? SSI_BINS : ANALOGY_BINS}
          value={(value as CardSorterValue) ?? null}
          onChange={(v) => onChange(v)}
        />
      )

    case 'rubricStudio':
      return <RubricStudio value={(value as RubricValue) ?? null} onChange={(v) => onChange(v)} />

    case 'aiAuditBoard':
      return (
        <AiAuditBoard
          sentences={AI_SENTENCES}
          value={(value as AiAuditValue) ?? null}
          onChange={(v) => onChange(v)}
        />
      )

    case 'curriculumMap':
      return (
        <CurriculumMap
          value={(value as CurriculumMapValue) ?? null}
          onChange={(v) => onChange(v)}
        />
      )

    case 'videoAnnotator':
      // 18강 마이크로티칭은 별도 화면(/microteaching)에서 다룬다.
      return null

    default:
      return null
  }
}

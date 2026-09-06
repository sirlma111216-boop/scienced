import { useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { Badge, Button, Caption, VisuallyHidden } from '@/components/ui'

/**
 * 카드 분류기 — 정렬·분류·근거 달기.
 *
 * 11강 비유의 대응/비대응, 13강 SSI 사실/가치 가르기에 쓴다.
 *
 * 드래그는 편의일 뿐이다. 드래그를 못 해도 같은 일을 할 수 있어야 한다:
 *  · 카드마다 "옮기기" 선택 상자가 있다 (마우스 없이 Tab + 방향키로 조작)
 *  · dnd-kit 의 KeyboardSensor 로 드래그 자체도 키보드로 된다
 *  · 어느 칸에 몇 장이 있는지 글자로도 표시한다 (색만으로 구분하지 않는다)
 *
 * 분류만으로는 끝나지 않는다. 카드마다 "왜 그 칸인가"를 적게 한다.
 */

export interface SortCard {
  id: string
  label: string
  note?: string
}

export interface SortBin {
  id: string
  label: string
  hint?: string
}

export interface CardSorterValue {
  /** 카드 id → 칸 id. 배정되지 않은 카드는 없다. */
  placement: Record<string, string>
  /** 카드 id → 왜 그 칸인가 */
  reasons: Record<string, string>
}

const UNSORTED = '__unsorted'

function Card({
  card,
  bins,
  binId,
  reason,
  onMove,
  onReason,
}: {
  card: SortCard
  bins: SortBin[]
  binId: string
  reason: string
  onMove: (binId: string) => void
  onReason: (text: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        marginBottom: 8,
      }}
      className="bg-canvas rounded-md"
    >
      <div style={{ boxShadow: 'inset 0 0 0 1px #e6e6e6', borderRadius: 8, padding: 12 }}>
        <div className="flex items-start gap-xs">
          {/* 드래그 손잡이. 키보드로도 잡을 수 있다. */}
          <button
            type="button"
            className="btn-icon"
            style={{ width: 32, height: 32, flexShrink: 0 }}
            {...attributes}
            {...listeners}
          >
            <span aria-hidden>⠿</span>
            <VisuallyHidden>{card.label} 옮기기 손잡이. 스페이스로 잡고 방향키로 옮깁니다.</VisuallyHidden>
          </button>
          <div style={{ flex: 1 }}>
            <p className="text-body-sm" style={{ margin: 0, fontWeight: 480 }}>
              {card.label}
            </p>
            {card.note ? (
              <p className="text-body-sm" style={{ margin: '4px 0 0', opacity: 0.66 }}>
                {card.note}
              </p>
            ) : null}
          </div>
        </div>

        {/* 드래그를 못 해도 되는 길 */}
        <div className="flex flex-col gap-xs" style={{ marginTop: 10 }}>
          <label htmlFor={`cs-move-${card.id}`} className="caption">
            어느 칸으로
          </label>
          <select
            id={`cs-move-${card.id}`}
            className="field"
            value={binId}
            onChange={(e) => onMove(e.target.value)}
            style={{ minHeight: 40, padding: '6px 10px' }}
          >
            <option value={UNSORTED}>아직 안 정함</option>
            {bins.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>

          <label htmlFor={`cs-why-${card.id}`} className="caption">
            왜 그 칸인가
          </label>
          <input
            id={`cs-why-${card.id}`}
            className="field"
            value={reason}
            onChange={(e) => onReason(e.target.value)}
            style={{ minHeight: 40, padding: '6px 10px' }}
          />
        </div>
      </div>
    </li>
  )
}

function Bin({
  bin,
  count,
  children,
}: {
  bin: SortBin | null
  count: number
  children: React.ReactNode
}) {
  const id = bin?.id ?? UNSORTED
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <section
      ref={setNodeRef}
      className="rounded-lg"
      style={{
        background: isOver ? '#f1f1f1' : '#f7f7f5',
        padding: 16,
        minHeight: 140,
        // 드롭 대상임을 색만으로 알리지 않는다. 테두리도 함께 바뀐다.
        boxShadow: isOver ? 'inset 0 0 0 2px #000' : 'inset 0 0 0 1px #e6e6e6',
      }}
      aria-label={`${bin?.label ?? '아직 안 정함'} — 카드 ${count}장`}
    >
      <div className="flex items-center gap-xs" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <h4 className="text-body" style={{ margin: 0, fontWeight: 480 }}>
          {bin?.label ?? '아직 안 정함'}
        </h4>
        <Badge>{count}장</Badge>
      </div>
      {bin?.hint ? (
        <Caption style={{ marginBottom: 8 }}>{bin.hint}</Caption>
      ) : null}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{children}</ul>
    </section>
  )
}

export function CardSorter({
  cards,
  bins,
  value,
  onChange,
  requireReason = true,
}: {
  cards: SortCard[]
  bins: SortBin[]
  value: CardSorterValue | null
  onChange: (v: CardSorterValue) => void
  /** 칸에 넣은 카드는 이유를 적어야 완료로 친다 */
  requireReason?: boolean
}) {
  const v: CardSorterValue = value ?? { placement: {}, reasons: {} }
  const [announce, setAnnounce] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // 키보드로도 드래그된다
    useSensor(KeyboardSensor),
  )

  const byBin = useMemo(() => {
    const map: Record<string, SortCard[]> = { [UNSORTED]: [] }
    for (const b of bins) map[b.id] = []
    for (const c of cards) {
      const bin = v.placement[c.id] ?? UNSORTED
      ;(map[bin] ?? map[UNSORTED]).push(c)
    }
    return map
  }, [cards, bins, v.placement])

  function move(cardId: string, binId: string) {
    const next = { ...v.placement }
    if (binId === UNSORTED) delete next[cardId]
    else next[cardId] = binId
    onChange({ ...v, placement: next })
    const card = cards.find((c) => c.id === cardId)
    const bin = bins.find((b) => b.id === binId)
    setAnnounce(`${card?.label ?? '카드'} 을(를) ${bin?.label ?? '아직 안 정함'} 으로 옮겼습니다.`)
  }

  function handleDragEnd(e: DragEndEvent) {
    const cardId = String(e.active.id)
    const binId = e.over ? String(e.over.id) : UNSORTED
    move(cardId, binId)
  }

  const placed = cards.filter((c) => v.placement[c.id]).length
  const missingReason = requireReason
    ? cards.filter((c) => v.placement[c.id] && !v.reasons[c.id]?.trim())
    : []

  return (
    <section className="flex flex-col gap-lg">
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge>
          {placed} / {cards.length} 장 분류함
        </Badge>
        {missingReason.length > 0 ? <Badge>이유 미작성 {missingReason.length}장</Badge> : null}
      </div>

      <p className="text-body-sm" style={{ opacity: 0.72, margin: 0 }}>
        끌어다 놓아도 되고, 카드 안의 선택 상자로 옮겨도 됩니다. 어느 쪽이든 같습니다.
      </p>

      {/* 옮긴 결과를 화면 읽기 프로그램에도 알린다 */}
      <div role="status" aria-live="polite">
        <VisuallyHidden>{announce}</VisuallyHidden>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))`,
            gap: 16,
          }}
        >
          <Bin bin={null} count={byBin[UNSORTED].length}>
            {byBin[UNSORTED].map((c) => (
              <Card
                key={c.id}
                card={c}
                bins={bins}
                binId={UNSORTED}
                reason={v.reasons[c.id] ?? ''}
                onMove={(b) => move(c.id, b)}
                onReason={(t) => onChange({ ...v, reasons: { ...v.reasons, [c.id]: t } })}
              />
            ))}
          </Bin>

          {bins.map((b) => (
            <Bin key={b.id} bin={b} count={byBin[b.id]?.length ?? 0}>
              {(byBin[b.id] ?? []).map((c) => (
                <Card
                  key={c.id}
                  card={c}
                  bins={bins}
                  binId={b.id}
                  reason={v.reasons[c.id] ?? ''}
                  onMove={(x) => move(c.id, x)}
                  onReason={(t) => onChange({ ...v, reasons: { ...v.reasons, [c.id]: t } })}
                />
              ))}
            </Bin>
          ))}
        </div>
      </DndContext>

      {missingReason.length > 0 ? (
        <p className="text-body-sm" style={{ fontWeight: 480 }}>
          ⚠ 이유를 적지 않은 카드가 있습니다: {missingReason.map((c) => c.label).join(', ')}
        </p>
      ) : null}

      <div className="flex gap-xs">
        <Button variant="tertiary" onClick={() => onChange({ placement: {}, reasons: v.reasons })}>
          분류만 초기화
        </Button>
      </div>
    </section>
  )
}

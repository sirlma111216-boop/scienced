import { useId } from 'react'
import type { FieldDef } from '@/content/types'
import { Field, ScrollX, VisuallyHidden } from '@/components/ui'

/**
 * 입력 칸 하나를 그린다.
 *
 * 타협하지 않는 것 (지시서 15절 · 컨텍스트 19.10):
 *  - 드래그만 요구하는 입력은 만들지 않는다. 배분·순위 모두 숫자 입력과 키보드로 조작된다.
 *  - 색만으로 상태를 구분하지 않는다.
 *  - 200% 확대에서 정보가 잘리지 않는다. 넘치는 표는 스스로 스크롤한다.
 */

export type FieldValue = unknown

export interface FieldProps {
  def: FieldDef
  value: FieldValue
  onChange: (v: FieldValue) => void
  error?: string | null
  disabled?: boolean
}

export function FieldRenderer(props: FieldProps) {
  switch (props.def.kind) {
    case 'text':
      return <TextField {...props} />
    case 'longtext':
      return <LongTextField {...props} />
    case 'choice':
      return <ChoiceField {...props} />
    case 'multi':
      return <MultiField {...props} />
    case 'allocation':
      return <AllocationField {...props} />
    case 'quadrant':
      return <QuadrantField {...props} />
    case 'rank':
      return <RankField {...props} />
    default:
      return null
  }
}

/* ─────────────────── 문장 틀 버튼 (컨텍스트 17.3) ─────────────────── */

function SentenceStarters({
  starters,
  onPick,
  disabled,
}: {
  starters?: string[]
  onPick: (s: string) => void
  disabled?: boolean
}) {
  if (!starters?.length) return null
  return (
    <div className="flex flex-wrap gap-xs">
      <span className="caption" style={{ alignSelf: 'center', opacity: 0.6 }}>
        문장 틀
      </span>
      {starters.map((s) => (
        <button
          key={s}
          type="button"
          className="tab"
          disabled={disabled}
          onClick={() => onPick(s)}
          style={{ fontSize: 14, minHeight: 36, padding: '6px 12px' }}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

/* ─────────────────── 글 ─────────────────── */

function TextField({ def, value, onChange, error, disabled }: FieldProps) {
  return (
    <Field label={def.label} help={def.help} error={error} required={def.required}>
      {(id, describedBy) => (
        <input
          id={id}
          className="field"
          type="text"
          value={String(value ?? '')}
          placeholder={def.placeholder}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  )
}

function LongTextField({ def, value, onChange, error, disabled }: FieldProps) {
  const text = String(value ?? '')
  return (
    <Field label={def.label} help={def.help} error={error} required={def.required}>
      {(id, describedBy) => (
        <div className="flex flex-col gap-xs">
          <textarea
            id={id}
            className="field"
            rows={4}
            value={text}
            placeholder={def.placeholder}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            style={{ resize: 'vertical', minHeight: 96 }}
          />
          <SentenceStarters
            starters={def.sentenceStarters}
            disabled={disabled}
            onPick={(s) => onChange(text ? `${text}\n${s}` : s)}
          />
        </div>
      )}
    </Field>
  )
}

/* ─────────────────── 선택 ─────────────────── */

function ChoiceField({ def, value, onChange, error, disabled }: FieldProps) {
  const name = useId()
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="text-body-sm" style={{ fontWeight: 480, paddingBottom: 8 }}>
        {def.label}
        {def.required ? <span className="font-mono text-caption ml-xs">필수</span> : null}
      </legend>
      {def.help ? (
        <p className="text-body-sm" style={{ opacity: 0.72, marginBottom: 8 }}>
          {def.help}
        </p>
      ) : null}
      <div className="flex flex-col gap-xs">
        {(def.options ?? []).map((opt) => (
          <label
            key={opt}
            className="flex items-start gap-sm rounded-md"
            style={{
              padding: '12px 14px',
              boxShadow: `inset 0 0 0 ${value === opt ? 2 : 1}px ${value === opt ? '#000' : '#e6e6e6'}`,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <input
              type="radio"
              name={name}
              value={opt}
              checked={value === opt}
              disabled={disabled}
              onChange={() => onChange(opt)}
              style={{ marginTop: 4 }}
            />
            <span className="text-body">{opt}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-body-sm" style={{ fontWeight: 480, marginTop: 8 }}>
          ⚠ {error}
        </p>
      ) : null}
    </fieldset>
  )
}

function MultiField({ def, value, onChange, error, disabled }: FieldProps) {
  const selected = Array.isArray(value) ? (value as string[]) : []
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="text-body-sm" style={{ fontWeight: 480, paddingBottom: 8 }}>
        {def.label}
        {def.required ? <span className="font-mono text-caption ml-xs">필수</span> : null}
      </legend>
      {def.help ? (
        <p className="text-body-sm" style={{ opacity: 0.72, marginBottom: 8 }}>
          {def.help}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-xs">
        {(def.options ?? []).map((opt) => {
          const on = selected.includes(opt)
          return (
            <label
              key={opt}
              className="flex items-center gap-xs rounded-pill"
              style={{
                padding: '10px 16px',
                minHeight: 44,
                boxShadow: `inset 0 0 0 ${on ? 2 : 1}px ${on ? '#000' : '#e6e6e6'}`,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={disabled}
                onChange={() =>
                  onChange(on ? selected.filter((s) => s !== opt) : [...selected, opt])
                }
              />
              <span className="text-body-sm">{opt}</span>
            </label>
          )
        })}
      </div>
      {error ? (
        <p role="alert" className="text-body-sm" style={{ fontWeight: 480, marginTop: 8 }}>
          ⚠ {error}
        </p>
      ) : null}
    </fieldset>
  )
}

function AllocationField({ def, value, onChange, error, disabled }: FieldProps) {
  const items = def.items ?? []
  const total = def.total ?? 100
  const alloc = (value && typeof value === 'object' ? value : {}) as Record<string, number>
  const sum = items.reduce((s, it) => s + (Number(alloc[it.id]) || 0), 0)
  const left = total - sum

  function set(id: string, n: number) {
    const clean = Math.max(0, Math.min(total, Math.round(Number.isFinite(n) ? n : 0)))
    onChange({ ...alloc, [id]: clean })
  }

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="text-body-sm" style={{ fontWeight: 480, paddingBottom: 8 }}>
        {def.label}
        {def.required ? <span className="font-mono text-caption ml-xs">필수</span> : null}
      </legend>
      {def.help ? (
        <p className="text-body-sm" style={{ opacity: 0.72, marginBottom: 8 }}>
          {def.help}
        </p>
      ) : null}

      <ScrollX>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
          <caption className="caption" style={{ textAlign: 'left', paddingBottom: 8 }}>
            숫자를 직접 입력하거나, 칸을 누른 뒤 화살표 키로 조절할 수 있습니다.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 0' }}>
                요소
              </th>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 0' }}>
                점수
              </th>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 0' }}>
                비율
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const n = Number(alloc[it.id]) || 0
              const pct = total > 0 ? Math.round((n / total) * 100) : 0
              return (
                <tr key={it.id} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                  <th
                    scope="row"
                    style={{ textAlign: 'left', padding: '10px 12px 10px 0', fontWeight: 400 }}
                  >
                    <span className="text-body">{it.label}</span>
                    {it.note ? (
                      <span className="text-body-sm" style={{ display: 'block', opacity: 0.66 }}>
                        {it.note}
                      </span>
                    ) : null}
                  </th>
                  <td style={{ padding: '10px 12px 10px 0' }}>
                    <input
                      type="number"
                      className="field"
                      min={0}
                      max={total}
                      step={1}
                      inputMode="numeric"
                      value={n}
                      disabled={disabled}
                      aria-label={`${it.label} 점수`}
                      onChange={(e) => set(it.id, Number(e.target.value))}
                      style={{ width: 96, minHeight: 44 }}
                    />
                  </td>
                  <td style={{ padding: '10px 0' }}>
                    {/* 막대와 숫자를 함께 보인다 */}
                    <div className="flex items-center gap-xs">
                      <span
                        aria-hidden
                        style={{
                          display: 'inline-block',
                          height: 10,
                          width: `${Math.max(2, pct * 1.6)}px`,
                          background: '#000',
                          borderRadius: 9999,
                        }}
                      />
                      <span className="font-mono text-caption">{pct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ScrollX>

      <p
        className="text-body-sm"
        style={{ marginTop: 12, fontWeight: 480 }}
        role="status"
        aria-live="polite"
      >
        합계 <span className="font-mono">{sum}</span> / {total} ·{' '}
        {left === 0 ? '맞습니다' : left > 0 ? `${left}점 남았습니다` : `${-left}점 넘었습니다`}
      </p>
      {error ? (
        <p role="alert" className="text-body-sm" style={{ fontWeight: 480 }}>
          ⚠ {error}
        </p>
      ) : null}
    </fieldset>
  )
}

/* ─────────────────── 4칸 ─────────────────── */

function QuadrantField({ def, value, onChange, error, disabled }: FieldProps) {
  const quads = def.quadrants ?? []
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, string>
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="text-body-sm" style={{ fontWeight: 480, paddingBottom: 8 }}>
        {def.label}
        {def.required ? <span className="font-mono text-caption ml-xs">필수</span> : null}
      </legend>
      {def.help ? (
        <p className="text-body-sm" style={{ opacity: 0.72, marginBottom: 8 }}>
          {def.help}
        </p>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {quads.map((q) => (
          <div key={q.id} className="tile flex flex-col gap-xs">
            <label className="caption" htmlFor={`${def.key}-${q.id}`}>
              {q.label}
            </label>
            <textarea
              id={`${def.key}-${q.id}`}
              className="field"
              rows={3}
              value={v[q.id] ?? ''}
              disabled={disabled}
              onChange={(e) => onChange({ ...v, [q.id]: e.target.value })}
              style={{ resize: 'vertical' }}
            />
          </div>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-body-sm" style={{ fontWeight: 480, marginTop: 8 }}>
          ⚠ {error}
        </p>
      ) : null}
    </fieldset>
  )
}

/* ─────────────────── 순위 (드래그 없이) ─────────────────── */

function RankField({ def, value, onChange, error, disabled }: FieldProps) {
  const items = def.items ?? []
  const order = Array.isArray(value) && value.length === items.length
    ? (value as string[])
    : items.map((i) => i.id)

  function move(idx: number, dir: -1 | 1) {
    const next = [...order]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="text-body-sm" style={{ fontWeight: 480, paddingBottom: 8 }}>
        {def.label}
        {def.required ? <span className="font-mono text-caption ml-xs">필수</span> : null}
      </legend>
      {def.help ? (
        <p className="text-body-sm" style={{ opacity: 0.72, marginBottom: 8 }}>
          {def.help}
        </p>
      ) : null}
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }} className="flex flex-col gap-xs">
        {order.map((id, idx) => {
          const item = items.find((i) => i.id === id)
          if (!item) return null
          return (
            <li
              key={id}
              className="flex items-center gap-sm rounded-md"
              style={{ padding: '10px 12px', boxShadow: 'inset 0 0 0 1px #e6e6e6' }}
            >
              <span className="font-mono text-caption" style={{ width: 24 }}>
                {idx + 1}
              </span>
              <span className="text-body flex-1">{item.label}</span>
              {/* 드래그가 아니라 버튼으로 옮긴다. 마우스 없이도 순서를 바꿀 수 있다. */}
              <button
                type="button"
                className="btn-icon"
                disabled={disabled || idx === 0}
                onClick={() => move(idx, -1)}
              >
                <span aria-hidden>↑</span>
                <VisuallyHidden>{item.label} 위로</VisuallyHidden>
              </button>
              <button
                type="button"
                className="btn-icon"
                disabled={disabled || idx === order.length - 1}
                onClick={() => move(idx, 1)}
              >
                <span aria-hidden>↓</span>
                <VisuallyHidden>{item.label} 아래로</VisuallyHidden>
              </button>
            </li>
          )
        })}
      </ol>
      {error ? (
        <p role="alert" className="text-body-sm" style={{ fontWeight: 480, marginTop: 8 }}>
          ⚠ {error}
        </p>
      ) : null}
    </fieldset>
  )
}

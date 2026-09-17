import type { FieldProps } from './fields'

/**
 * 카드를 두 통에 나눈다 (8차 4.6 sort 형식). 드래그가 아니다 — 카드마다 통 단추 둘.
 * 값은 { 카드id: 통id }.
 */
export function SortField({ def, value, onChange, error, disabled }: FieldProps) {
  const items = def.items ?? []
  const bins = def.bins ?? []
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, string>
  const placed = items.filter((it) => v[it.id]).length
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
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="flex flex-col gap-xs">
        {items.map((it) => (
          <li key={it.id} className="rounded-md" style={{ padding: '10px 12px', boxShadow: 'inset 0 0 0 1px #e6e6e6' }}>
            <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap' }}>
              <span className="text-body" style={{ flex: '1 1 200px' }}>
                {it.label}
                {it.note ? (
                  <span className="text-body-sm" style={{ display: 'block', opacity: 0.66 }}>
                    {it.note}
                  </span>
                ) : null}
              </span>
              <div className="flex gap-xxs" role="group" aria-label={`${it.label} 을 어느 통에`}>
                {bins.map((b) => {
                  const on = v[it.id] === b.id
                  return (
                    <button key={b.id} type="button" className="tab" data-selected={on} aria-pressed={on} disabled={disabled} onClick={() => onChange({ ...v, [it.id]: b.id })} style={{ minHeight: 40, fontSize: 14, padding: '4px 12px' }}>
                      {b.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-body-sm" style={{ marginTop: 8 }} role="status" aria-live="polite">
        놓은 카드 <span className="font-mono">{placed}</span> / {items.length}
      </p>
      {error ? (
        <p role="alert" className="text-body-sm" style={{ fontWeight: 480 }}>
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

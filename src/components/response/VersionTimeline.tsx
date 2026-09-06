import { useState } from 'react'
import type { FieldDef } from '@/content/types'
import type { ResponseDoc } from '@/lib/types'
import { Badge, Caption, ScrollX } from '@/components/ui'

/**
 * v1 → v2 → v3 와 "무엇을 왜 바꿨는가".
 *
 * 이 화면이 이 앱의 핵심이다. 슬라이드 뷰어가 아니라 학생의 사고 변화를 기록하는 도구이므로,
 * 최초 답은 언제나 여기에 남아 있어야 한다.
 */

function renderValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v || '—'
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>).filter(
      ([, val]) => val !== '' && val != null && val !== 0,
    )
    return entries.length ? entries.map(([k, val]) => `${k} ${String(val)}`).join(' · ') : '—'
  }
  return String(v)
}

export function VersionTimeline({ doc, fields }: { doc: ResponseDoc; fields: FieldDef[] }) {
  const versions = doc.versions ?? []
  const [open, setOpen] = useState(true)
  if (versions.length < 2) return null

  const shown = fields.filter((f) => f.kind !== 'confidence')

  return (
    <section className="card">
      <div className="flex items-center gap-md" style={{ marginBottom: 16 }}>
        <h3 className="text-card-title" style={{ margin: 0 }}>
          내 생각의 변화
        </h3>
        <Badge>{versions.length}개 버전</Badge>
        <span className="flex-1" />
        <button type="button" className="tab" onClick={() => setOpen((o) => !o)}>
          {open ? '접기' : '펼치기'}
        </button>
      </div>

      {open ? (
        <ScrollX>
          <table style={{ borderCollapse: 'collapse', minWidth: 560, width: '100%' }}>
            <caption className="caption" style={{ textAlign: 'left', paddingBottom: 8 }}>
              최초 답은 지워지지 않습니다. 왼쪽이 v1입니다.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}>
                  항목
                </th>
                {versions.map((v) => (
                  <th
                    key={v.v}
                    scope="col"
                    className="caption"
                    style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}
                  >
                    v{v.v}
                    <span style={{ display: 'block', opacity: 0.6 }}>
                      {new Date(v.createdAt).toLocaleDateString('ko-KR', {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((f) => {
                const cells = versions.map((v) => renderValue(v.payload?.[f.key]))
                const changed = cells.some((c) => c !== cells[0])
                return (
                  <tr key={f.key} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                    <th
                      scope="row"
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px 10px 0',
                        fontWeight: 400,
                        verticalAlign: 'top',
                      }}
                    >
                      <span className="text-body-sm">{f.label}</span>
                      {/* 색만으로 표시하지 않는다 */}
                      {changed ? (
                        <span className="font-mono text-caption" style={{ display: 'block' }}>
                          바뀜
                        </span>
                      ) : null}
                    </th>
                    {cells.map((c, i) => (
                      <td
                        key={i}
                        className="text-body-sm"
                        style={{
                          padding: '10px 12px 10px 0',
                          verticalAlign: 'top',
                          maxWidth: 280,
                          fontWeight: changed && i === cells.length - 1 ? 480 : 320,
                        }}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                )
              })}
              <tr>
                <th
                  scope="row"
                  style={{ textAlign: 'left', padding: '10px 12px 10px 0', fontWeight: 400 }}
                >
                  <span className="text-body-sm">확신도</span>
                </th>
                {versions.map((v) => (
                  <td key={v.v} className="font-mono text-body-sm" style={{ padding: '10px 0' }}>
                    {v.confidence != null ? `${v.confidence} / 5` : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </ScrollX>
      ) : null}

      {open ? (
        <div style={{ marginTop: 16 }}>
          <Caption>무엇을 왜 바꿨는가</Caption>
          <ul style={{ paddingLeft: 18, margin: '8px 0 0' }}>
            {versions
              .filter((v) => v.changedReason)
              .map((v) => (
                <li key={v.v} className="text-body-sm" style={{ marginBottom: 6 }}>
                  <span className="font-mono">v{v.v}</span> — {v.changedReason}
                </li>
              ))}
            {versions.every((v) => !v.changedReason) ? (
              <li className="text-body-sm" style={{ opacity: 0.6 }}>
                아직 변경 사유가 없습니다.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

import { useMemo } from 'react'
import type { FieldDef } from '@/content/types'
import type { ResponseDoc } from '@/lib/types'
import { Caption, ScrollX } from '@/components/ui'

/**
 * 익명 분포.
 *
 * 이름을 붙이지 않는다. 순위를 만들지 않는다.
 * 정답률만 보이지 않고 이유 문장을 함께 보인다 (컨텍스트 19.9).
 * 고른 사람 수와 함께 이유 문장을 익명으로 몇 개 보여 준다 — 갈리는 자리가 거기서 드러난다.
 */

interface Bucket {
  label: string
  count: number
  /** 익명 이유 문장 표본 */
  reasons: string[]
}

export function DistributionView({
  docs,
  field,
  reasonKey,
  totalExpected,
}: {
  docs: ResponseDoc[]
  field: FieldDef
  /** 함께 보여 줄 이유 칸의 key */
  reasonKey?: string
  /** 수강 인원. 미제출 수를 계산한다. */
  totalExpected?: number
}) {
  const { buckets, answered } = useMemo(() => {
    const map = new Map<string, { count: number; reasons: string[] }>()
    let n = 0
    for (const d of docs) {
      const latest = d.versions?.[d.versions.length - 1]
      if (!latest) continue
      n++
      const raw = latest.payload?.[field.key]
      const labels =
        field.kind === 'multi'
          ? Array.isArray(raw)
            ? (raw as string[])
            : []
          : [String(raw ?? '(응답 없음)')]
      const reason = reasonKey ? String(latest.payload?.[reasonKey] ?? '') : ''
      for (const label of labels) {
        const cur = map.get(label) ?? { count: 0, reasons: [] }
        cur.count += 1
        if (reason.trim()) cur.reasons.push(reason.trim())
        map.set(label, cur)
      }
    }
    const options = field.options ?? [...map.keys()]
    const out: Bucket[] = options.map((label) => {
      const cur = map.get(label)
      return {
        label,
        count: cur?.count ?? 0,
        reasons: (cur?.reasons ?? []).slice(0, 3),
      }
    })
    // 선택지에 없던 응답도 빠뜨리지 않는다
    for (const [label, cur] of map) {
      if (options.includes(label)) continue
      out.push({
        label,
        count: cur.count,
        reasons: cur.reasons.slice(0, 3),
      })
    }
    return { buckets: out, answered: n }
  }, [docs, field, reasonKey])

  const max = Math.max(1, ...buckets.map((b) => b.count))

  return (
    <section>
      <div className="flex items-baseline gap-md" style={{ marginBottom: 12 }}>
        <h3 className="text-card-title" style={{ margin: 0 }}>
          우리 반의 답
        </h3>
        <Caption>
          {answered}명 제출
          {totalExpected ? ` · ${Math.max(0, totalExpected - answered)}명 미제출` : ''} · 이름은
          표시하지 않습니다
        </Caption>
      </div>

      <ScrollX>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520 }}>
          <thead>
            <tr>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}>
                답
              </th>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}>
                사람 수
              </th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.label} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                <th
                  scope="row"
                  style={{
                    textAlign: 'left',
                    padding: '12px 12px 12px 0',
                    fontWeight: 400,
                    verticalAlign: 'top',
                  }}
                >
                  <span className="text-body">{b.label}</span>
                  {b.reasons.length > 0 ? (
                    <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                      {b.reasons.map((r, i) => (
                        <li key={i} className="text-body-sm" style={{ opacity: 0.72 }}>
                          “{r.length > 90 ? `${r.slice(0, 90)}…` : r}”
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </th>
                <td style={{ padding: '12px 12px 12px 0', verticalAlign: 'top' }}>
                  <div className="flex items-center gap-xs">
                    <span
                      aria-hidden
                      style={{
                        display: 'inline-block',
                        height: 12,
                        width: `${Math.max(4, (b.count / max) * 160)}px`,
                        background: '#000',
                        borderRadius: 9999,
                      }}
                    />
                    {/* 막대 길이만으로 읽게 하지 않는다 */}
                    <span className="font-mono text-body-sm">{b.count}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>

      <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.72 }}>
        고른 사람이 많은 답보다, 이유가 갈리는 답이 다음에 다시 볼 곳입니다.
      </p>
    </section>
  )
}

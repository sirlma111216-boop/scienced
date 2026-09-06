import { useMemo } from 'react'
import { buildLadder, traceLadder, type Ladder } from '@/lib/ladder'
import { ScrollX } from '@/components/ui'

/**
 * 사다리 그림.
 *
 * 씨앗 문자열 하나만 같으면 강사 화면과 모든 학생 화면이 글자 그대로 같은 그림을 그린다.
 * 서버가 결과를 내려보내지 않아도 된다.
 *
 * 접근성: 그림만으로 결과를 읽게 하지 않는다. 그림 아래에 같은 내용을 표로도 낸다.
 */

const COL_W = 56
const ROW_H = 22
const TOP = 44
const BOTTOM = 44

export function LadderBoard({
  seed,
  columns,
  seats,
  presentSlots,
  highlightSeat,
  revealed,
}: {
  seed: string
  columns: number
  /** 자리 번호(문자열) → 표시 이름 */
  seats: Record<string, string>
  presentSlots: number[]
  /** 이 자리에서 내려가는 길을 굵게 그린다 */
  highlightSeat?: number | null
  /** 강사가 결과를 열었는가. 열기 전에는 길을 그리지 않는다. */
  revealed: boolean
}) {
  const ladder: Ladder = useMemo(() => buildLadder(seed, columns), [seed, columns])
  const width = Math.max(1, ladder.columns - 1) * COL_W + 48
  const height = TOP + ladder.rows * ROW_H + BOTTOM

  const path = useMemo(() => {
    if (!revealed || highlightSeat == null) return null
    const pts = traceLadder(ladder, highlightSeat)
    return pts
      .map((p, i) => {
        const x = 24 + p.col * COL_W
        const y = p.row < 0 ? TOP : TOP + (p.row + 1) * ROW_H
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }, [ladder, highlightSeat, revealed])

  const x = (col: number) => 24 + col * COL_W

  return (
    <div>
      <ScrollX>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`자리 ${ladder.columns}개짜리 사다리. 아래쪽 ${presentSlots.map((s) => s + 1).join('번, ')}번 칸이 발표 칸입니다.`}
          style={{ maxWidth: '100%' }}
        >
          {/* 세로줄 */}
          {Array.from({ length: ladder.columns }, (_, c) => (
            <line
              key={`v${c}`}
              x1={x(c)}
              y1={TOP}
              x2={x(c)}
              y2={TOP + ladder.rows * ROW_H}
              stroke="#e6e6e6"
              strokeWidth={3}
              strokeLinecap="round"
            />
          ))}
          {/* 가로줄 */}
          {ladder.rungs.map((line, r) =>
            line.map((on, c) =>
              on ? (
                <line
                  key={`h${r}-${c}`}
                  x1={x(c)}
                  y1={TOP + (r + 1) * ROW_H}
                  x2={x(c + 1)}
                  y2={TOP + (r + 1) * ROW_H}
                  stroke="#e6e6e6"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              ) : null,
            ),
          )}
          {/* 내려간 길 */}
          {path ? (
            <path d={path} fill="none" stroke="#000" strokeWidth={4} strokeLinejoin="round" />
          ) : null}
          {/* 위: 자리 번호 */}
          {Array.from({ length: ladder.columns }, (_, c) => (
            <g key={`t${c}`}>
              <circle
                cx={x(c)}
                cy={TOP - 20}
                r={14}
                fill={seats[String(c)] ? '#000' : '#f7f7f5'}
              />
              <text
                x={x(c)}
                y={TOP - 15}
                textAnchor="middle"
                fontSize={13}
                fontFamily="JetBrains Mono, monospace"
                fill={seats[String(c)] ? '#fff' : '#000'}
              >
                {c + 1}
              </text>
            </g>
          ))}
          {/* 아래: 발표 칸 표시 — 색이 아니라 글자로 구분한다 */}
          {Array.from({ length: ladder.columns }, (_, c) => {
            const isPresent = presentSlots.includes(c)
            const y = TOP + ladder.rows * ROW_H
            if (!revealed) {
              return (
                <text
                  key={`b${c}`}
                  x={x(c)}
                  y={y + 24}
                  textAnchor="middle"
                  fontSize={13}
                  fontFamily="JetBrains Mono, monospace"
                  fill="#000"
                  opacity={0.4}
                >
                  ?
                </text>
              )
            }
            return isPresent ? (
              <g key={`b${c}`}>
                <rect
                  x={x(c) - 26}
                  y={y + 8}
                  width={52}
                  height={26}
                  rx={13}
                  fill="#000"
                />
                <text
                  x={x(c)}
                  y={y + 26}
                  textAnchor="middle"
                  fontSize={13}
                  fill="#fff"
                  fontWeight={540}
                >
                  발표!
                </text>
              </g>
            ) : (
              <text
                key={`b${c}`}
                x={x(c)}
                y={y + 26}
                textAnchor="middle"
                fontSize={13}
                fill="#000"
                opacity={0.45}
              >
                —
              </text>
            )
          })}
        </svg>
      </ScrollX>

      {/* 그림을 못 보는 사람도 같은 결과를 읽을 수 있어야 한다 */}
      {revealed ? (
        <details style={{ marginTop: 12 }}>
          <summary className="caption" style={{ cursor: 'pointer' }}>
            표로 보기
          </summary>
          <table style={{ borderCollapse: 'collapse', marginTop: 8 }}>
            <thead>
              <tr>
                <th scope="col" className="caption" style={{ textAlign: 'left', padding: '4px 12px 4px 0' }}>
                  자리
                </th>
                <th scope="col" className="caption" style={{ textAlign: 'left', padding: '4px 12px 4px 0' }}>
                  고른 사람
                </th>
                <th scope="col" className="caption" style={{ textAlign: 'left', padding: '4px 0' }}>
                  도착
                </th>
              </tr>
            </thead>
            <tbody>
              {ladder.mapping.map((end, start) => (
                <tr key={start}>
                  <td className="font-mono text-body-sm" style={{ padding: '4px 12px 4px 0' }}>
                    {start + 1}
                  </td>
                  <td className="text-body-sm" style={{ padding: '4px 12px 4px 0' }}>
                    {seats[String(start)] || '—'}
                  </td>
                  <td className="text-body-sm" style={{ padding: '4px 0' }}>
                    {end + 1}번 · {presentSlots.includes(end) ? '발표!' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}

      <p className="caption" style={{ marginTop: 8, opacity: 0.6 }}>
        씨앗 {seed}
      </p>
    </div>
  )
}

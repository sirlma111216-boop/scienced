import { useMemo, useState } from 'react'
import { fnv1a, mulberry32 } from '@/lib/ladder'
import { Badge, Button, Caption, ScrollX } from '@/components/ui'

/**
 * 실험 설계 샌드박스 · 데이터 스튜디오 (8강).
 *
 * 변인·표본 수·측정오차를 고르면 가상 자료가 생성된다.
 * 같은 현상에서도 설계에 따라 결론의 확실성이 달라진다는 것을 보이는 도구다.
 *
 * "표본을 늘리면 확실해진다"는 규칙을 가르치는 것이 아니다.
 * 체계 오차가 있으면 표본을 아무리 늘려도 치우침이 사라지지 않는다는 것을 함께 보여 준다.
 *
 * 난수는 사다리와 같은 mulberry32 를 쓴다. 설정이 같으면 모든 화면에 같은 자료가 나온다.
 */

export interface DataStudioValue {
  n: number
  noise: number
  /** 한 방향으로 치우치는 체계적 문제 */
  bias: number
  /** 실제 효과 크기 */
  effect: number
  seed: string
  threeBoxes: string
}

const DEFAULTS: DataStudioValue = {
  n: 5,
  noise: 3,
  bias: 0,
  effect: 8,
  seed: 'sandbox-1',
  threeBoxes: '',
}

interface Sample {
  cold: number[]
  hot: number[]
}

/** 정규분포에 가까운 값을 만든다 (Box–Muller). */
function gaussian(rand: () => number): number {
  const u = Math.max(1e-9, rand())
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function simulate(v: DataStudioValue): Sample {
  const rand = mulberry32(fnv1a(`${v.seed}|${v.n}|${v.noise}|${v.bias}|${v.effect}`))
  const BASE = 40 // 20 °C 에서의 용해 시간(초)
  const cold: number[] = []
  const hot: number[] = []
  for (let i = 0; i < v.n; i++) {
    cold.push(Math.max(1, BASE + gaussian(rand) * v.noise))
    // 체계 오차는 한쪽 집단에만 한 방향으로 얹힌다. 반복해도 사라지지 않는다.
    hot.push(Math.max(1, BASE - v.effect + gaussian(rand) * v.noise + v.bias))
  }
  return { cold, hot }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const sd = (xs: number[]) => {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}

export function DataStudio({
  value,
  onChange,
}: {
  value: DataStudioValue | null
  onChange: (v: DataStudioValue) => void
}) {
  // useMemo 로 감싸지 않으면 렌더마다 새 객체가 되어 아래 simulate 가 매번 다시 돈다.
  const v = useMemo(() => ({ ...DEFAULTS, ...(value ?? {}) }), [value])
  const [showRaw, setShowRaw] = useState(false)
  const sample = useMemo(() => simulate(v), [v])

  const mCold = mean(sample.cold)
  const mHot = mean(sample.hot)
  const diff = mCold - mHot
  const pooledSd = Math.sqrt((sd(sample.cold) ** 2 + sd(sample.hot) ** 2) / 2)
  /** 두 평균 차이가 흩어짐에 비해 얼마나 큰가. 통계 수업이 아니라 판단의 눈금으로만 쓴다. */
  const ratio = pooledSd > 0 ? diff / pooledSd : 0

  const verdict =
    Math.abs(ratio) < 0.5
      ? { label: '아직 말할 수 없다', why: '두 집단의 차이가 흩어짐 안에 묻혀 있습니다.' }
      : Math.abs(ratio) < 1.2
        ? { label: '조심해서 말한다', why: '차이가 보이지만 이 자료만으로 단정하기는 이릅니다.' }
        : { label: '확실히 말할 수 있다', why: '차이가 흩어짐보다 뚜렷합니다.' }

  const biasWarning =
    v.bias !== 0
      ? '체계 오차가 켜져 있습니다. 표본을 아무리 늘려도 이 치우침은 줄지 않습니다.'
      : null

  function set(patch: Partial<DataStudioValue>) {
    onChange({ ...v, ...patch })
  }

  const all = [...sample.cold, ...sample.hot]
  const lo = Math.min(...all, 0)
  const hi = Math.max(...all, 1)
  const W = 560
  const H = 200
  const x = (val: number) => 60 + ((val - lo) / Math.max(1e-9, hi - lo)) * (W - 90)

  return (
    <section className="flex flex-col gap-lg">
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge>실험 설계 샌드박스</Badge>
        <Badge>표본 {v.n}</Badge>
        <Badge>{verdict.label}</Badge>
      </div>

      <p className="text-body-sm" style={{ opacity: 0.72, margin: 0 }}>
        같은 현상(설탕 용해 시간)에 대해 설정만 바꿉니다. 자료가 어떻게 달라지고,
        같은 자료로 무엇까지 말할 수 있는지 봅니다.
      </p>

      {/* 설정 — 전부 숫자 입력. 드래그가 없다. */}
      <div className="card">
        <Caption>설계 설정</Caption>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 16,
            marginTop: 12,
          }}
        >
          {[
            { key: 'n' as const, label: '표본 수 (반복 횟수)', min: 2, max: 60, step: 1 },
            { key: 'noise' as const, label: '측정값의 흩어짐', min: 0, max: 20, step: 1 },
            { key: 'bias' as const, label: '체계 오차 (한 방향 치우침)', min: -15, max: 15, step: 1 },
            { key: 'effect' as const, label: '실제 효과 크기', min: 0, max: 25, step: 1 },
          ].map((f) => (
            <div key={f.key} className="flex flex-col gap-xs">
              <label htmlFor={`ds-${f.key}`} className="text-body-sm" style={{ fontWeight: 480 }}>
                {f.label}
              </label>
              <input
                id={`ds-${f.key}`}
                className="field"
                type="number"
                inputMode="numeric"
                min={f.min}
                max={f.max}
                step={f.step}
                value={v[f.key]}
                onChange={(e) =>
                  set({ [f.key]: Math.max(f.min, Math.min(f.max, Number(e.target.value) || 0)) })
                }
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-md" style={{ marginTop: 16 }}>
          <Button
            variant="secondary"
            onClick={() => set({ seed: `sandbox-${Math.floor(Date.now() / 1000)}` })}
          >
            다시 측정
          </Button>
          <Caption>씨앗 {v.seed} — 같은 설정과 씨앗이면 같은 자료가 나옵니다</Caption>
        </div>
      </div>

      {/* 자료 */}
      <div className="card">
        <Caption>가상 자료 — 완전히 녹기까지 걸린 시간(초)</Caption>
        <ScrollX>
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`20도 평균 ${mCold.toFixed(1)}초, 60도 평균 ${mHot.toFixed(1)}초, 차이 ${diff.toFixed(1)}초. 판단: ${verdict.label}`}
            style={{ maxWidth: '100%', marginTop: 12 }}
          >
            {[
              { name: '20 °C', xs: sample.cold, y: 60, m: mCold },
              { name: '60 °C', xs: sample.hot, y: 130, m: mHot },
            ].map((g) => (
              <g key={g.name}>
                <text x={0} y={g.y + 4} fontSize={13} fill="#000">
                  {g.name}
                </text>
                <line x1={60} y1={g.y} x2={W - 30} y2={g.y} stroke="#e6e6e6" strokeWidth={1} />
                {g.xs.map((val, i) => (
                  <circle
                    key={i}
                    cx={x(val)}
                    cy={g.y}
                    r={4}
                    fill="none"
                    stroke="#000"
                    strokeWidth={1.2}
                    opacity={0.75}
                  />
                ))}
                {/* 평균은 점이 아니라 세로 막대로. 점과 구별된다. */}
                <line
                  x1={x(g.m)}
                  y1={g.y - 16}
                  x2={x(g.m)}
                  y2={g.y + 16}
                  stroke="#000"
                  strokeWidth={3}
                />
                <text x={x(g.m)} y={g.y - 22} fontSize={11} textAnchor="middle" fill="#000">
                  평균 {g.m.toFixed(1)}
                </text>
              </g>
            ))}
            <text x={60} y={H - 8} fontSize={11} fill="#000" opacity={0.6}>
              {lo.toFixed(0)}초
            </text>
            <text x={W - 30} y={H - 8} fontSize={11} textAnchor="end" fill="#000" opacity={0.6}>
              {hi.toFixed(0)}초
            </text>
          </svg>
        </ScrollX>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
            marginTop: 16,
          }}
        >
          {[
            { k: '평균 차이', val: `${diff.toFixed(1)}초` },
            { k: '흩어짐(표준편차)', val: pooledSd.toFixed(1) },
            { k: '차이 ÷ 흩어짐', val: ratio.toFixed(2) },
            { k: '판단', val: verdict.label },
          ].map((s) => (
            <div key={s.k} className="tile">
              <Caption>{s.k}</Caption>
              <p className="text-body-lg font-mono" style={{ margin: '4px 0 0', fontWeight: 480 }}>
                {s.val}
              </p>
            </div>
          ))}
        </div>

        <p className="text-body-sm" style={{ marginTop: 12 }}>
          {verdict.why}
        </p>
        {biasWarning ? (
          <p
            role="status"
            className="text-body-sm"
            style={{ marginTop: 8, fontWeight: 480 }}
          >
            ⚠ {biasWarning}
          </p>
        ) : null}

        <button
          type="button"
          className="btn-tertiary"
          style={{ marginTop: 12, padding: 0 }}
          onClick={() => setShowRaw((s) => !s)}
        >
          {showRaw ? '측정값 접기' : '측정값 표로 보기'}
        </button>
        {showRaw ? (
          <ScrollX>
            <table style={{ borderCollapse: 'collapse', marginTop: 12, minWidth: 320 }}>
              <thead>
                <tr>
                  <th scope="col" className="caption" style={{ textAlign: 'left', padding: '4px 16px 4px 0' }}>
                    회차
                  </th>
                  <th scope="col" className="caption" style={{ textAlign: 'left', padding: '4px 16px 4px 0' }}>
                    20 °C
                  </th>
                  <th scope="col" className="caption" style={{ textAlign: 'left', padding: '4px 0' }}>
                    60 °C
                  </th>
                </tr>
              </thead>
              <tbody>
                {sample.cold.map((c, i) => (
                  <tr key={i} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                    <td className="font-mono text-body-sm" style={{ padding: '4px 16px 4px 0' }}>
                      {i + 1}
                    </td>
                    <td className="font-mono text-body-sm" style={{ padding: '4px 16px 4px 0' }}>
                      {c.toFixed(1)}
                    </td>
                    <td className="font-mono text-body-sm" style={{ padding: '4px 0' }}>
                      {sample.hot[i]?.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        ) : null}
      </div>

      {/* 세 칸 불확실성 */}
      <div className="card flex flex-col gap-xs">
        <label htmlFor="ds-three" className="text-body-sm" style={{ fontWeight: 480 }}>
          이 자료로 — 확실히 말할 수 있는 것 / 조심해서 말할 것 / 아직 말할 수 없는 것
        </label>
        <textarea
          id="ds-three"
          className="field"
          rows={4}
          value={v.threeBoxes}
          placeholder={'확실히: \n조심해서: \n아직: '}
          onChange={(e) => set({ threeBoxes: e.target.value })}
          style={{ resize: 'vertical' }}
        />
        <Caption>중학생에게도 같은 세 칸을 쓰게 할 수 있습니다.</Caption>
      </div>
    </section>
  )
}

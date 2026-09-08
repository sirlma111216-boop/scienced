/**
 * 앱이 직접 그리는 그림 (4차 J.3).
 *
 * 원칙: SVG 로 그릴 수 있으면 그렇게 한다.
 * 확대·대체 설명·색 대비·다크 모드가 한꺼번에 풀리고, 그림 안에 글자를 넣지 않아도 된다.
 * 생성 이미지는 손그림 느낌이 꼭 필요한 곳에만 쓴다 — 3강 학생 그림 같은 것.
 *
 * ★ 그림 안에 글자를 넣지 않는다 (J.2).
 *   라벨은 StimulusView 가 그림 밖에 배지로 얹는다.
 * ★ 정답이 그림에 미리 보이면 안 된다 (J.2 ②).
 *   발자국 도식에 「두 사람이 만났다」는 해석이 드러나면 활동이 성립하지 않는다.
 *   그래서 방향 화살표도, 동물의 모습도, 어느 줄이 먼저인지도 그리지 않는다.
 */

/**
 * 발자국 한 개.
 *
 * 진행 방향으로 선 타원 하나 + 앞쪽에 발가락 자국 셋.
 * 작게 그리면 점으로 보인다 — 두 줄의 크기 차이가 이 활동의 단서이므로
 * 크기와 발가락이 눈에 들어올 만큼은 커야 한다.
 */
function Print({
  x,
  y,
  angle,
  size,
}: {
  x: number
  y: number
  angle: number
  size: number
}) {
  const rx = 9 * size
  const ry = 14 * size
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <ellipse rx={rx} ry={ry} fill="none" stroke="currentColor" strokeWidth={2} />
      {[-0.62, 0, 0.62].map((i) => (
        <ellipse
          key={i}
          cx={i * rx}
          cy={-ry - 3.5 * size}
          rx={2.6 * size}
          ry={3.4 * size}
          fill="currentColor"
        />
      ))}
    </g>
  )
}

/**
 * 발자국 두 줄 (2강).
 *
 * 위 줄 — 작은 발자국. 간격이 처음부터 끝까지 일정하다.
 * 아래 줄 — 큰 발자국. 중간부터 간격이 눈에 띄게 넓어진다.
 * 두 줄은 오른쪽 한 지점에서 모이고, 그 뒤로는 큰 발자국 한 줄만 이어진다.
 *
 * 해석이 갈리도록 일부러 남기지 않은 것: 어느 줄이 먼저 찍혔는지, 언제 찍혔는지.
 * 방향 화살표를 그리지 않는 이유도 같다 — 그리면 답이 그림에 들어간다 (J.2 ②).
 */
function Footprints() {
  /* 두 줄이 만나는 자리. 마지막 발자국을 정확히 겹치지 않게 조금씩 어긋나 놓는다. */
  const MEET = { x: 534, y: 152 }

  /** 한 줄을 놓는다. gaps 는 발자국 사이의 상대 간격이다. */
  function trail(
    from: { x: number; y: number },
    to: { x: number; y: number },
    gaps: number[],
    size: number,
    keyPrefix: string,
  ) {
    const total = gaps.reduce((a, b) => a + b, 0)
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.hypot(dx, dy)
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90
    // 진행 방향에 수직인 단위 벡터. 좌우 발을 번갈아 놓는 데 쓴다.
    const nx = -dy / len
    const ny = dx / len

    const nodes = []
    let travelled = 0
    for (let i = 0; i < gaps.length; i++) {
      travelled += gaps[i]
      const t = travelled / total
      const perp = (i % 2 === 0 ? 1 : -1) * 10 * size
      nodes.push(
        <Print
          key={`${keyPrefix}-${i}`}
          x={from.x + dx * t + nx * perp}
          y={from.y + dy * t + ny * perp}
          angle={angle}
          size={size}
        />,
      )
    }
    return nodes
  }

  return (
    <>
      {/* 젖은 흙 바닥. 옅은 면 하나만 둔다 — 질감을 그리면 발자국이 묻힌다. */}
      <rect x={16} y={24} width={688} height={286} rx={12} fill="currentColor" opacity={0.06} />

      {/* A — 작은 발자국, 간격이 처음부터 끝까지 일정하다 */}
      {trail({ x: 74, y: 66 }, { x: MEET.x - 8, y: MEET.y - 12 }, [0, 1, 1, 1, 1, 1, 1], 0.6, 'a')}

      {/* B — 큰 발자국, 중간부터 간격이 넓어진다 */}
      {trail({ x: 74, y: 288 }, { x: MEET.x + 8, y: MEET.y + 18 }, [0, 0.6, 0.7, 0.9, 1.2, 1.6, 2.1], 1.15, 'b')}

      {/* 만난 뒤 — 큰 발자국 한 줄만 이어진다 */}
      {trail({ x: MEET.x + 62, y: MEET.y - 4 }, { x: 686, y: 96 }, [0, 1, 1.15, 1.3], 1.15, 'c')}

      {/* 축척 막대. 한 칸이 10cm 라는 것은 그림 밖 legend 가 말한다 (그림 안에 글자 없음). */}
      <g transform="translate(24 334)">
        <line x1={0} y1={0} x2={200} y2={0} stroke="currentColor" strokeWidth={2.5} />
        {[0, 40, 80, 120, 160, 200].map((x) => (
          <line key={x} x1={x} y1={-7} x2={x} y2={7} stroke="currentColor" strokeWidth={2.5} />
        ))}
      </g>
    </>
  )
}

const FIGURES: Record<string, () => React.ReactElement> = {
  footprints: Footprints,
}

export function hasFigure(id: string): boolean {
  return id in FIGURES
}

export function FigureSvg({ id, altText }: { id: string; altText: string }) {
  const Draw = FIGURES[id]
  if (!Draw) return null
  return (
    <svg
      viewBox="0 0 720 352"
      role="img"
      aria-label={altText}
      style={{ width: '100%', minWidth: 480, height: 'auto', display: 'block', color: 'inherit' }}
    >
      <Draw />
    </svg>
  )
}

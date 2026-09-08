import type { PickerMode } from '@/content/types'
import { fnv1a, mulberry32 } from '@/lib/ladder'
import { Badge, Caption, ScrollX, VisuallyHidden } from '@/components/ui'
import { LadderBoard } from './LadderBoard'

/**
 * 18종 게임의 화면.
 *
 * 엔진은 전부 같다 — 씨앗 하나로 결과가 정해지고, 같은 씨앗이면 모든 화면이 같은 결과를 본다.
 * 달라지는 것은 그 결과를 무엇으로 보이느냐다. 봉투, 카드, 계단, 룰렛, 대진표, 주사위…
 * 표현이 달라야 학생이 매 차시 같은 활동을 반복한다고 느끼지 않는다.
 *
 * 공통 규칙:
 *  · 결과를 열기 전에는 어느 것이 당첨인지 화면 어디에도 없다.
 *  · 색만으로 당첨을 표시하지 않는다. 글자를 함께 쓴다.
 *  · 그림을 못 보는 사람을 위해 같은 내용을 글로도 낸다.
 */

export interface PickerVisualProps {
  mode: PickerMode
  seed: string
  /** 자리 수 (= 후보 수) */
  columns: number
  /** 자리 번호(문자열) → 표시 이름 */
  seats: Record<string, string>
  /** 당첨 자리 */
  presentSlots: number[]
  /** 내가 고른 자리 */
  mySeat: number | null
  revealed: boolean
  /** 14·18강은 가중치를 화면에 공개한다 */
  weights?: Record<string, number>
  nicknames?: Record<string, string>
}

/** 씨앗에서 결정적인 값 하나를 뽑는다. 모드마다 소금을 달리해 서로 영향을 주지 않게 한다. */
function pick(seed: string, salt: string, max: number): number {
  return Math.floor(mulberry32(fnv1a(`${seed}::${salt}`))() * max)
}

function shuffle<T>(seed: string, salt: string, items: T[]): T[] {
  const rand = mulberry32(fnv1a(`${seed}::${salt}`))
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const label = (seats: Record<string, string>, i: number) => seats[String(i)] || `${i + 1}번 자리`

/* ─────────────────────── 공통 조각 ─────────────────────── */

/** 뽑히지 않은 것과 뽑힌 것을 글자로 구분하는 타일 줄 */
function TileRow({
  count,
  seats,
  presentSlots,
  mySeat,
  revealed,
  render,
  aria,
}: {
  count: number
  seats: Record<string, string>
  presentSlots: number[]
  mySeat: number | null
  revealed: boolean
  render: (i: number, on: boolean, mine: boolean) => React.ReactNode
  aria: string
}) {
  return (
    <>
      <ScrollX>
        <ul
          className="flex flex-wrap gap-xs"
          style={{ listStyle: 'none', padding: 0, margin: 0 }}
          aria-label={aria}
        >
          {Array.from({ length: count }, (_, i) => {
            const on = revealed && presentSlots.includes(i)
            const mine = mySeat === i
            return (
              <li key={i}>{render(i, on, mine)}</li>
            )
          })}
        </ul>
      </ScrollX>
      {revealed ? (
        <p className="text-body-sm" style={{ marginTop: 12 }}>
          발표: {presentSlots.map((s) => label(seats, s)).join(', ')}
        </p>
      ) : null}
    </>
  )
}

const tileStyle = (on: boolean, mine: boolean): React.CSSProperties => ({
  minWidth: 92,
  minHeight: 76,
  borderRadius: 8,
  padding: 10,
  background: on ? '#000' : '#f7f7f5',
  color: on ? '#fff' : '#000',
  boxShadow: mine ? 'inset 0 0 0 2px #000' : 'inset 0 0 0 1px #e6e6e6',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  justifyContent: 'center',
  alignItems: 'center',
  textAlign: 'center',
})

/* ─────────────────────── 모드별 화면 ─────────────────────── */

export function PickerVisual(props: PickerVisualProps) {
  const { mode, seed, columns, seats, presentSlots, mySeat, revealed, weights, nicknames } = props

  const common = { count: columns, seats, presentSlots, mySeat, revealed }

  switch (mode) {
    /* 1강 — 기존 구현 그대로 */
    case 'ladder':
      return (
        <LadderBoard
          seed={seed}
          columns={columns}
          seats={seats}
          presentSlots={presentSlots}
          highlightSeat={mySeat}
          revealed={revealed}
        />
      )

    /* 2강 — 발표자 선정 봉투 */
    case 'sealed-envelope':
      return (
        <div>
          <Caption>봉투 하나에 발표 표시가 들어 있습니다. 열기 전에는 아무도 모릅니다.</Caption>
          <div style={{ marginTop: 12 }}>
            <TileRow
              {...common}
              aria={`봉투 ${columns}개`}
              render={(i, on, mine) => (
                <div style={tileStyle(on, mine)}>
                  <span aria-hidden style={{ fontSize: 22 }}>
                    {revealed ? (on ? '✉' : '▢') : '✉'}
                  </span>
                  <span className="font-mono text-caption">{i + 1}</span>
                  <span className="text-caption">
                    {revealed ? (on ? '발표!' : '빈 봉투') : mine ? '내 봉투' : ''}
                  </span>
                </div>
              )}
            />
          </div>
          <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.72 }}>
            열기 전에 "내가 걸릴 확률"을 적어 두었나요? 연 뒤 예상과 결과의 차이를 한 줄 적습니다.
            지금 확률은 {columns > 0 ? Math.round((presentSlots.length / columns) * 100) : 0}%입니다.
          </p>
        </div>
      )

    /* 3강 — 학생 발화 카드 뒤집기 */
    case 'card-flip': {
      const utterances = [
        '무거운 게 빨리 떨어져요',
        '전류가 전구에서 없어져요',
        '나무는 흙을 먹고 자라요',
        '여름엔 태양이 가까워요',
        '기체는 무게가 없어요',
        '식물은 밤에 숨 안 쉬어요',
      ]
      return (
        <div>
          <Caption>카드 앞면에는 중학생의 말이 있습니다. 한 장 뒤에 발표 표시가 있습니다.</Caption>
          <div style={{ marginTop: 12 }}>
            <TileRow
              {...common}
              aria={`발화 카드 ${columns}장`}
              render={(i, on, mine) => (
                <div style={{ ...tileStyle(on, mine), minWidth: 150, minHeight: 92 }}>
                  <span className="text-caption" style={{ opacity: 0.75 }}>
                    “{utterances[i % utterances.length]}”
                  </span>
                  <span className="font-mono text-caption">{i + 1}</span>
                  {revealed ? (
                    <span className="text-caption">{on ? '발표!' : '—'}</span>
                  ) : mine ? (
                    <span className="text-caption">내 카드</span>
                  ) : null}
                </div>
              )}
            />
          </div>
        </div>
      )
    }

    /* 4강 — 비계 계단 */
    case 'scaffold-stairs': {
      const steps = ['힌트 없음', '무엇을 볼지', '부분 완성 예', '완성 예', '답 제시']
      const stop = revealed ? pick(seed, 'stairs', steps.length) : -1
      return (
        <div>
          <Caption>말이 계단을 오르다 한 칸에서 멈춥니다. 멈춘 칸이 오늘 줄 도움의 수준입니다.</Caption>
          <ol
            style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}
            aria-label="비계 계단"
          >
            {steps.map((s, i) => {
              const here = stop === i
              return (
                <li
                  key={s}
                  className="flex items-center gap-sm"
                  style={{
                    marginLeft: i * 24,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: here ? '#000' : '#f7f7f5',
                    color: here ? '#fff' : '#000',
                    marginBottom: 6,
                    maxWidth: 420,
                  }}
                >
                  <span className="font-mono text-caption">{i + 1}단계</span>
                  <span className="text-body-sm">{s}</span>
                  {here ? (
                    <>
                      <span className="flex-1" />
                      <span className="font-mono text-caption">여기 멈춤</span>
                    </>
                  ) : null}
                </li>
              )
            })}
          </ol>
          {revealed ? (
            <p className="text-body-sm" style={{ marginTop: 12 }}>
              발표: {presentSlots.map((s) => label(seats, s)).join(', ')} — 이 도움을 언제, 어떤
              증거를 보고 줄일 것인지 말해 주세요.
            </p>
          ) : null}
        </div>
      )
    }

    /* 5강 — 설명 생존 */
    case 'survival': {
      const order = shuffle(seed, 'survival', Array.from({ length: columns }, (_, i) => i))
      const rounds = Math.max(0, columns - presentSlots.length)
      return (
        <div>
          <Caption>증거가 한 장씩 공개될 때마다 후보가 한 명씩 빠집니다.</Caption>
          <ol style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }} aria-label="탈락 순서">
            {order.map((seatIdx, r) => {
              const out = revealed && r < rounds
              const survivor = revealed && r >= rounds
              return (
                <li
                  key={seatIdx}
                  className="flex items-center gap-sm"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: survivor ? '#000' : '#f7f7f5',
                    color: survivor ? '#fff' : '#000',
                    marginBottom: 6,
                    maxWidth: 480,
                    textDecoration: out ? 'line-through' : 'none',
                    opacity: out ? 0.55 : 1,
                  }}
                >
                  <span className="font-mono text-caption">
                    {revealed ? (out ? `증거 ${r + 1}` : '생존') : '?'}
                  </span>
                  <span className="text-body-sm">{label(seats, seatIdx)}</span>
                </li>
              )
            })}
          </ol>
          <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.72 }}>
            오래 버틴 설명이 아니라 증거에 맞게 고친 설명을 봅니다.
          </p>
        </div>
      )
    }

    /* 6강 — 교육과정 지도 핀 */
    case 'map-pin': {
      const domains = ['운동과 에너지', '물질', '생명', '지구와 우주', '과학과 사회']
      const at = revealed ? pick(seed, 'pin', domains.length) : -1
      return (
        <div>
          <Caption>영역 지도 위에서 핀이 돌다 멈춥니다.</Caption>
          <ul
            className="flex flex-wrap gap-xs"
            style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}
            aria-label="교육과정 영역"
          >
            {domains.map((d, i) => (
              <li
                key={d}
                style={{
                  padding: '14px 18px',
                  borderRadius: 8,
                  background: at === i ? '#000' : '#f7f7f5',
                  color: at === i ? '#fff' : '#000',
                  boxShadow: 'inset 0 0 0 1px #e6e6e6',
                }}
              >
                <span className="text-body-sm">{d}</span>
                {at === i ? (
                  <span className="font-mono text-caption" style={{ marginLeft: 8 }}>
                    ● 핀
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {revealed ? (
            <p className="text-body-sm" style={{ marginTop: 12 }}>
              발표: {presentSlots.map((s) => label(seats, s)).join(', ')} — 「{domains[at]}」 성취기준의
              세 범주를 갈라 주세요.
            </p>
          ) : null}
        </div>
      )
    }

    /* 7강 — 목표·증거·활동 스피너 */
    case 'triple-spinner': {
      const wheels = [
        { name: '목표', faces: ['동사가 없다', '내용만 있다', '활동을 목표로 썼다', '괜찮다'] },
        { name: '증거', faces: ['산출물이 없다', '활동 완료로 대체', '이유가 빠졌다', '괜찮다'] },
        { name: '활동', faces: ['목표와 무관', '시간 초과', '준비물 과다', '괜찮다'] },
      ]
      return (
        <div>
          <Caption>세 칸 룰렛이 돕니다. 멈춘 칸이 여러분 설계에서 다시 볼 자리입니다.</Caption>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              marginTop: 12,
            }}
          >
            {wheels.map((w, wi) => {
              const at = revealed ? pick(seed, `spin${wi}`, w.faces.length) : -1
              return (
                <div key={w.name} className="tile">
                  <Caption>{w.name}</Caption>
                  <p className="text-body-lg" style={{ margin: '8px 0 0', fontWeight: 480 }}>
                    {revealed ? w.faces[at] : '돌아가는 중…'}
                  </p>
                </div>
              )
            })}
          </div>
          {revealed ? (
            <p className="text-body-sm" style={{ marginTop: 12 }}>
              발표: {presentSlots.map((s) => label(seats, s)).join(', ')}
            </p>
          ) : null}
        </div>
      )
    }

    /* 8강 — 변인 주사위 */
    case 'variable-dice': {
      const vars = ['온도', '입자 크기', '젓는 정도', '물의 양', '용질의 양', '용기 모양']
      const conds = ['같게 둔다', '두 수준으로 바꾼다', '세 수준으로 바꾼다', '측정만 한다', '무시한다', '기록만 한다']
      const a = revealed ? pick(seed, 'dieA', vars.length) : -1
      const b = revealed ? pick(seed, 'dieB', conds.length) : -1
      return (
        <div>
          <Caption>주사위 두 개가 굴러갑니다 — 변인 하나, 조건 하나.</Caption>
          <div className="flex flex-wrap gap-md" style={{ marginTop: 12 }}>
            {[
              { name: '변인', face: revealed ? vars[a] : '?', n: a + 1 },
              { name: '조건', face: revealed ? conds[b] : '?', n: b + 1 },
            ].map((d) => (
              <div
                key={d.name}
                style={{
                  minWidth: 180,
                  padding: 20,
                  borderRadius: 8,
                  background: '#f7f7f5',
                  boxShadow: 'inset 0 0 0 1px #e6e6e6',
                }}
              >
                <Caption>{d.name}</Caption>
                <p className="text-headline" style={{ margin: '8px 0 0' }}>
                  {d.face}
                </p>
                {revealed ? (
                  <span className="font-mono text-caption">주사위 {d.n}</span>
                ) : null}
              </div>
            ))}
          </div>
          {revealed ? (
            <p className="text-body-sm" style={{ marginTop: 12 }}>
              발표: {presentSlots.map((s) => label(seats, s)).join(', ')} — 이 조합에서 무엇을 같게
              두어야 공정한 비교가 되는지 말해 주세요.
            </p>
          ) : null}
        </div>
      )
    }

    /* 9강 — 모형 대진 추첨 */
    case 'bracket': {
      const order = shuffle(seed, 'bracket', Array.from({ length: columns }, (_, i) => i))
      const pairs: Array<[number, number | null]> = []
      for (let i = 0; i < order.length; i += 2) {
        pairs.push([order[i], order[i + 1] ?? null])
      }
      return (
        <div>
          <Caption>무작위 대진표가 모형 두 개를 맞붙입니다. 이기는 모형을 뽑는 게임이 아닙니다.</Caption>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }} aria-label="대진표">
            {pairs.map((p, i) => (
              <li
                key={i}
                className="flex items-center gap-sm"
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: '#f7f7f5',
                  marginBottom: 6,
                  maxWidth: 480,
                  boxShadow: 'inset 0 0 0 1px #e6e6e6',
                }}
              >
                <span className="font-mono text-caption">{i + 1}조</span>
                <span className="text-body-sm">{revealed ? label(seats, p[0]) : '?'}</span>
                <span className="text-caption" style={{ opacity: 0.6 }}>
                  vs
                </span>
                <span className="text-body-sm">
                  {p[1] == null ? '부전승' : revealed ? label(seats, p[1]) : '?'}
                </span>
              </li>
            ))}
          </ul>
          {revealed ? (
            <p className="text-body-sm" style={{ marginTop: 12 }}>
              발표: {presentSlots.map((s) => label(seats, s)).join(', ')} — 두 모형의 설명 범위가
              어디에서 갈리는지 말해 주세요.
            </p>
          ) : null}
        </div>
      )
    }

    /* 10강 — 드래프트 순번 */
    case 'draft-order': {
      const order = shuffle(seed, 'draft', Array.from({ length: columns }, (_, i) => i))
      return (
        <div>
          <Caption>추첨 순번대로 수업 상황 카드를 고릅니다. 마지막 순번이 먼저 발표합니다.</Caption>
          <ol style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }} aria-label="드래프트 순번">
            {order.map((seatIdx, i) => {
              const last = i === order.length - 1
              return (
                <li
                  key={seatIdx}
                  className="flex items-center gap-sm"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: revealed && last ? '#000' : '#f7f7f5',
                    color: revealed && last ? '#fff' : '#000',
                    marginBottom: 6,
                    maxWidth: 460,
                  }}
                >
                  <span className="font-mono text-caption">{i + 1}순위</span>
                  <span className="text-body-sm">{revealed ? label(seats, seatIdx) : '?'}</span>
                  {revealed && last ? (
                    <>
                      <span className="flex-1" />
                      <span className="font-mono text-caption">먼저 발표</span>
                    </>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </div>
      )
    }

    /* 11강 — 표상 룰렛 */
    case 'representation-roulette': {
      const faces = ['현상', '입자 그림', '그래프', '수식']
      const at = revealed ? pick(seed, 'rep', faces.length) : -1
      return (
        <div>
          <Caption>네 칸이 돕니다. 멈춘 표상으로 번역하고, 사라진 정보를 함께 말합니다.</Caption>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(120px, 180px))',
              gap: 8,
              marginTop: 12,
            }}
            aria-label="표상 룰렛"
          >
            {faces.map((f, i) => (
              <div
                key={f}
                style={{
                  padding: '24px 16px',
                  borderRadius: 8,
                  textAlign: 'center',
                  background: at === i ? '#000' : '#f7f7f5',
                  color: at === i ? '#fff' : '#000',
                  boxShadow: 'inset 0 0 0 1px #e6e6e6',
                }}
              >
                <p className="text-body" style={{ margin: 0, fontWeight: 480 }}>
                  {f}
                </p>
                {at === i ? (
                  <span className="font-mono text-caption">여기 멈춤</span>
                ) : null}
              </div>
            ))}
          </div>
          {revealed ? (
            <p className="text-body-sm" style={{ marginTop: 12 }}>
              발표: {presentSlots.map((s) => label(seats, s)).join(', ')} — 「{faces[at]}」(으)로
              번역하고 사라진 정보를 말해 주세요.
            </p>
          ) : null}
        </div>
      )
    }

    /* 12강 — 배심원 역할 추첨 */
    case 'jury-roles': {
      const roles = ['주장자', '반론자', '증거 검토자', '요약자']
      return (
        <div>
          <Caption>네 역할을 동시에 뽑습니다. 역할은 정답 발표자가 아니라 담화 이동입니다.</Caption>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
              marginTop: 12,
            }}
          >
            {roles.map((r, i) => (
              <div key={r} className="tile">
                <Caption>{r}</Caption>
                <p className="text-body" style={{ margin: '6px 0 0', fontWeight: 480 }}>
                  {revealed && presentSlots[i] != null ? label(seats, presentSlots[i]) : '?'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )
    }

    /* 13강 — 이해당사자 제비 */
    case 'stakeholder-lots': {
      const roles = ['연구자', '주민', '기업', '지자체', '학생']
      return (
        <div>
          <Caption>역할 카드를 나눕니다. 찬반이 아니라 그 입장의 기준과 우려를 말합니다.</Caption>
          <ul
            className="flex flex-wrap gap-xs"
            style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}
            aria-label="이해당사자 역할"
          >
            {Array.from({ length: columns }, (_, i) => {
              const role = roles[pick(seed, `role${i}`, roles.length)]
              const on = revealed && presentSlots.includes(i)
              return (
                <li key={i} style={{ ...tileStyle(on, mySeat === i), minWidth: 120 }}>
                  <span className="font-mono text-caption">{i + 1}</span>
                  <span className="text-body-sm">{revealed ? role : '?'}</span>
                  <span className="text-caption">{on ? '발표!' : ''}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )
    }

    /* 14강 — 침묵 데이터 (가중치를 숨기지 않는다) */
    case 'silent-data': {
      const entries = Object.entries(weights ?? {}).sort((a, b) => b[1] - a[1])
      const total = entries.reduce((s, [, w]) => s + w, 0) || 1
      return (
        <div>
          <div
            className="rounded-md"
            style={{ background: '#dceeb1', padding: '12px 16px', marginBottom: 16 }}
          >
            <p className="text-body-sm" style={{ margin: 0, fontWeight: 480 }}>
              이번 추첨은 발표 기회가 적었던 분의 확률을 크게 줍니다. 가중치를 숨기지 않고 그대로
              공개합니다 — 규칙 자체가 오늘의 학습 내용입니다.
            </p>
          </div>
          {entries.length === 0 ? (
            <Caption>가중치 자료가 아직 없습니다.</Caption>
          ) : (
            <ScrollX>
              <table style={{ borderCollapse: 'collapse', minWidth: 420 }}>
                <caption className="caption" style={{ textAlign: 'left', paddingBottom: 8 }}>
                  공개된 가중치
                </caption>
                <thead>
                  <tr>
                    {['참여자', '가중치', '뽑힐 확률'].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="caption"
                        style={{ textAlign: 'left', padding: '4px 16px 4px 0' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map(([uid, w]) => (
                    <tr key={uid} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                      <td className="text-body-sm" style={{ padding: '6px 16px 6px 0' }}>
                        {nicknames?.[uid] ?? uid}
                      </td>
                      <td className="font-mono text-body-sm" style={{ padding: '6px 16px 6px 0' }}>
                        {w.toFixed(2)}
                      </td>
                      <td className="font-mono text-body-sm" style={{ padding: '6px 0' }}>
                        {Math.round((w / total) * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
          )}
          {revealed ? (
            <p className="text-body-sm" style={{ marginTop: 12 }}>
              발표: {presentSlots.map((s) => label(seats, s)).join(', ')}
            </p>
          ) : null}
        </div>
      )
    }

    /* 15강 — 응답 유형별 한 명 */
    case 'by-response-type': {
      const clusters = ['유형 A', '유형 B', '유형 C']
      return (
        <div>
          <Caption>응답이 유형별로 묶였습니다. 묶음마다 한 분씩 뽑습니다. 정답 여부가 아니라 이유의 유형입니다.</Caption>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              marginTop: 12,
            }}
          >
            {clusters.map((c, i) => (
              <div key={c} className="tile">
                <Caption>{c}</Caption>
                <p className="text-body" style={{ margin: '6px 0 0', fontWeight: 480 }}>
                  {revealed && presentSlots[i] != null ? label(seats, presentSlots[i]) : '?'}
                </p>
              </div>
            ))}
          </div>
          <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.72 }}>
            같은 답을 고른 사람들의 서로 다른 이유를 들어 봅니다.
          </p>
        </div>
      )
    }

    /* 16강 — 경계 사례 짝 */
    case 'boundary-pair': {
      const a = presentSlots[0]
      const b = presentSlots[1]
      return (
        <div>
          <Caption>같은 산출물에 다른 점수를 준 두 분을 짝으로 뽑습니다. 누가 맞았는지 가리지 않습니다.</Caption>
          <div className="flex flex-wrap gap-md" style={{ marginTop: 12, alignItems: 'center' }}>
            {[a, b].map((s, i) => (
              <div
                key={i}
                className="tile"
                style={{ minWidth: 160, textAlign: 'center' }}
              >
                <Caption>{i === 0 ? '낮게 준 쪽' : '높게 준 쪽'}</Caption>
                <p className="text-body" style={{ margin: '6px 0 0', fontWeight: 480 }}>
                  {revealed && s != null ? label(seats, s) : '?'}
                </p>
              </div>
            ))}
          </div>
          <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.72 }}>
            기준 문구의 어느 말에서 판단이 갈렸는지 찾습니다.
          </p>
        </div>
      )
    }

    /* 17강 — 문장 감사 배정 */
    case 'sentence-audit': {
      const SENTENCES = 6
      return (
        <div>
          <Caption>AI 응답의 문장 번호를 무작위로 배정합니다. 맡은 문장만 판정하면 됩니다.</Caption>
          <ul
            className="flex flex-wrap gap-xs"
            style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}
            aria-label="문장 배정"
          >
            {Array.from({ length: columns }, (_, i) => {
              const s = pick(seed, `sent${i}`, SENTENCES)
              const on = revealed && presentSlots.includes(i)
              return (
                <li key={i} style={{ ...tileStyle(on, mySeat === i), minWidth: 110 }}>
                  <span className="text-body-sm">{label(seats, i)}</span>
                  <span className="font-mono text-caption">
                    {revealed ? `${s + 1}번 문장` : '?'}
                  </span>
                  <span className="text-caption">{on ? '발표!' : ''}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )
    }

    /* 18강 — 재수업 순번 */
    case 'reteach-order': {
      const order = shuffle(seed, 'reteach', Array.from({ length: columns }, (_, i) => i))
      return (
        <div>
          <Caption>
            마이크로티칭 순서를 뽑습니다. 1강 사다리에서 이미 발표한 분은 후보에서 빠졌습니다.
          </Caption>
          <ol style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }} aria-label="재수업 순번">
            {order.map((seatIdx, i) => (
              <li
                key={seatIdx}
                className="flex items-center gap-sm"
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: revealed && presentSlots.includes(seatIdx) ? '#000' : '#f7f7f5',
                  color: revealed && presentSlots.includes(seatIdx) ? '#fff' : '#000',
                  marginBottom: 6,
                  maxWidth: 460,
                }}
              >
                <span className="font-mono text-caption">{i + 1}번째</span>
                <span className="text-body-sm">{revealed ? label(seats, seatIdx) : '?'}</span>
              </li>
            ))}
          </ol>
        </div>
      )
    }

    default:
      return (
        <div>
          <VisuallyHidden>알 수 없는 게임 형식</VisuallyHidden>
          <Badge>준비 중</Badge>
        </div>
      )
  }
}

/**
 * 어떤 모드에 화면이 있는지는 위 switch 문이 정답이다.
 * verify:games 는 손으로 관리하는 목록이 아니라 이 파일의 `case '…':` 를 직접 읽는다.
 * 그래야 목록과 코드가 어긋날 수 없다.
 */

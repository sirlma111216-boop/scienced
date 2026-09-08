import type { Stimulus, StimulusFormat } from '@/content/types'
import { Badge, Caption, Notice, ScrollX } from '@/components/ui'
import { FigureSvg, hasFigure } from './figures'

/**
 * 자료 블록 (4차 H.1 ②).
 *
 * 읽을 것·볼 것의 실물을 그린다. 「받습니다」라고 적어 놓고 받을 것이 없던 자리를 메우는 것이
 * 4차 지시서의 첫 번째 일이다.
 *
 * 형식마다 다르게 그린다 — 기사는 기사처럼, 대본은 대본처럼, 표는 표로.
 * 이미지에 글자를 박지 않는다 (J.2). 라벨은 그림 옆에 글로 얹는다.
 */

const FORMAT_LABEL: Record<StimulusFormat, string> = {
  article: '기사',
  dialogue: '수업 기록',
  studentWork: '학생 산출물',
  image: '그림',
  dataTable: '측정 자료',
  card: '카드',
  video: '영상',
  standard: '성취기준',
  note: '자료',
}

/** 잠긴 블록. 입력 요소도 본문도 그리지 않는다 — 여는 조건만 남는다 (H.1 ⑤). */
export function LockedCard({ title, message }: { title: string; message: string }) {
  return (
    <div
      className="rounded-lg no-print"
      style={{
        padding: 20,
        marginTop: 24,
        background: '#f7f7f5',
        boxShadow: 'inset 0 0 0 1px #e6e6e6',
      }}
    >
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        {/* 자물쇠는 그림만으로 두지 않는다. 「잠김」이라는 글자를 함께 둔다. */}
        <Badge>🔒 잠김</Badge>
        <span className="text-body-sm" style={{ fontWeight: 480 }}>
          {title}
        </span>
      </div>
      <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.75 }}>
        {message}
      </p>
    </div>
  )
}

function ImageBlock({ s }: { s: Stimulus }) {
  const spec = s.imageSpec
  if (!spec) return null
  const drawn = spec.figureId ? hasFigure(spec.figureId) : false

  return (
    <div style={{ marginTop: 12 }}>
      {drawn ? (
        <>
          <figure style={{ margin: 0 }}>
            <ScrollX>
              <FigureSvg id={spec.figureId!} altText={spec.altText} />
            </ScrollX>
            {spec.labels.length > 0 ? (
              <figcaption style={{ marginTop: 12 }}>
                {/*
                  라벨을 그림 안에 넣지 않는다 (J.2). 이미지 생성 도구가 한국어를 제대로 쓰지 못하고,
                  그림에 박힌 글자는 확대·화면 낭독·번역에서 모두 빠진다.
                */}
                <ul
                  className="flex flex-wrap gap-xs"
                  style={{ listStyle: 'none', padding: 0, margin: 0 }}
                >
                  {spec.labels.map((l) => (
                    <li key={l.text}>
                      <Badge>{l.text}</Badge>
                    </li>
                  ))}
                </ul>
                {spec.legend ? (
                  <p className="text-body-sm" style={{ margin: '10px 0 0', opacity: 0.72 }}>
                    {spec.legend}
                  </p>
                ) : null}
              </figcaption>
            ) : null}
          </figure>

          {/* 그림을 못 보는 자리(인쇄·낭독)에서도 같은 판단이 되도록 글로 남긴다 */}
          <details className="no-print" style={{ marginTop: 12 }}>
            <summary className="caption" style={{ cursor: 'pointer' }}>
              그림 설명 (글로 읽기)
            </summary>
            <p className="text-body-sm" style={{ marginTop: 8, opacity: 0.8 }}>
              {spec.altText}
            </p>
          </details>
          <p className="text-body-sm print-only" style={{ opacity: 0.8 }}>
            {spec.altText}
          </p>
        </>
      ) : (
        /* 그림이 아직 없으면 대안을 그린다. 빈 자리를 남기지 않는다 (J.1 fallback). */
        <Notice tone="cream">
          <p className="text-body-sm" style={{ margin: 0 }}>
            <strong>그림 준비 중</strong> — {spec.fallback}
          </p>
          <p className="text-body-sm" style={{ margin: '8px 0 0' }}>
            {spec.altText}
          </p>
        </Notice>
      )}

      {spec.differsFromReality ? (
        <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.75 }}>
          <strong>실제와 다른 점</strong> · {spec.differsFromReality}
        </p>
      ) : null}
    </div>
  )
}

function TableBlock({ s }: { s: Stimulus }) {
  if (!s.table) return null
  return (
    <ScrollX>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, minWidth: 420 }}>
        <thead>
          <tr>
            {s.table.head.map((h) => (
              <th
                key={h}
                scope="col"
                className="caption"
                style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.table.rows.map((row, i) => (
            <tr key={i} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={j === 0 ? 'text-body' : 'text-body font-mono'}
                  style={{ padding: '10px 12px 10px 0' }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  )
}

export function StimulusView({ stimulus }: { stimulus: Stimulus }) {
  const s = stimulus
  /*
   * 기사·대본·학생 산출물은 인용문이다. 본문 활자와 같은 흐름으로 두면
   * 학생이 앱의 안내와 자료의 문장을 구별하지 못한다. 왼쪽에 선을 세워 가른다.
   */
  const quoted = s.format === 'article' || s.format === 'dialogue' || s.format === 'studentWork'

  return (
    <section className="card" style={{ marginTop: 24 }} aria-labelledby={`stim-${s.id}`}>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Caption>{FORMAT_LABEL[s.format]}</Caption>
        {/* 가상 자료라는 사실을 화면에서 감추지 않는다 (H.5) */}
        {s.label ? <Badge>{s.label}</Badge> : null}
      </div>

      <h3 id={`stim-${s.id}`} className="text-card-title" style={{ margin: '8px 0 0' }}>
        {s.title}
      </h3>
      {s.source ? (
        <p className="text-body-sm" style={{ margin: '4px 0 0', opacity: 0.7 }}>
          {s.source}
        </p>
      ) : null}

      {s.format === 'image' ? <ImageBlock s={s} /> : null}
      {s.format === 'dataTable' ? <TableBlock s={s} /> : null}

      {s.body ? (
        <p
          className="text-body"
          style={{
            whiteSpace: 'pre-line',
            margin: '12px 0 0',
            ...(quoted
              ? { paddingLeft: 16, boxShadow: 'inset 2px 0 0 #000' }
              : null),
          }}
        >
          {s.body}
        </p>
      ) : null}
    </section>
  )
}

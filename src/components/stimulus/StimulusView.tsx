import { useState } from 'react'
import type { Stimulus, StimulusFormat } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { Badge, Caption, Notice, ScrollX } from '@/components/ui'
import { withEmphasis } from '@/components/emphasis'
import { parseBody } from '@/lib/body-text'

/**
 * 자료 블록 (4차 H.1 ②).
 *
 * 읽을 것·볼 것의 실물을 그린다. 「받습니다」라고 적어 놓고 받을 것이 없던 자리를 메우는 것이
 * 4차 지시서의 첫 번째 일이다.
 *
 * ★ 줄머리 꼬리표는 본문과 구분해 그린다.
 *   「제목 식물의 잎 개수와…」가 한 덩어리로 읽히면 「제목」이 꼬리표인지
 *   「제목 식물」이라는 말인지 알 수 없다. 대본의 화자 이름도 마찬가지다.
 *
 * ★ 그림은 앱이 그리지 않는다.
 *   imageSpec.genPrompt 로 강의자가 만들어 넣은 파일을 보여 준다.
 *   파일이 아직 없으면 대안(글·표)을 그리고, 강사에게는 프롬프트를 함께 보여 준다.
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

/**
 * 본문 — 꼬리표를 왼쪽에 세우고 내용을 오른쪽에 둔다.
 *
 * 좁은 화면에서는 위아래로 접는다. 꼬리표를 고정 폭으로 두면 375px 에서
 * 본문이 한 글자씩 끊긴다. 그 사고를 단계 알약에서 이미 한 번 겪었다.
 */
function Body({ body }: { body: string }) {
  const lines = parseBody(body)

  return (
    <div style={{ marginTop: 12 }}>
      {lines.map((l, i) => {
        if (l.kind === 'gap') return <div key={i} style={{ height: 12 }} />
        if (l.kind === 'aside') {
          return (
            <p
              key={i}
              className="text-body-sm"
              style={{ margin: '4px 0', opacity: 0.6, fontStyle: 'italic' }}
            >
              {l.text}
            </p>
          )
        }
        if (l.kind === 'labelled') {
          return (
            <div
              key={i}
              className="stimulus-line"
              style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}
            >
              {/* 꼬리표. 본문과 확실히 갈라 보이게 굵게 + 살짝 작게. */}
              <span
                className="text-body-sm"
                style={{
                  fontWeight: 700,
                  minWidth: 56,
                  flexShrink: 0,
                  letterSpacing: '0.01em',
                }}
              >
                {l.label}
              </span>
              <span className="text-body" style={{ flex: '1 1 260px', minWidth: 0 }}>
                {withEmphasis(l.text)}
              </span>
            </div>
          )
        }
        return (
          <p
            key={i}
            className="text-body"
            style={{ margin: '2px 0', paddingLeft: l.kind === 'cont' ? 68 : 0 }}
          >
            {withEmphasis(l.text)}
          </p>
        )
      })}
    </div>
  )
}

/**
 * 그림.
 *
 * 파일이 있으면 그것을 보여 준다. 앱이 도형으로 흉내 내지 않는다 —
 * 생성 도구로 만든 그림이 비교할 수 없이 낫고, 그것이 J절이 프롬프트를 요구한 이유다.
 */
function ImageBlock({ s, isInstructor }: { s: Stimulus; isInstructor: boolean }) {
  /*
   * 파일이 아직 없을 수 있다. 그림은 강의자가 만들어 넣는 것이고,
   * 넣기 전에 수업이 열릴 수도 있다. 그때 깨진 그림 표시를 보여 주면
   * 학생은 앱이 고장 났다고 읽는다. 대신 글 설명과 대안을 그린다.
   */
  const [failed, setFailed] = useState(false)
  const spec = s.imageSpec
  if (!spec) return null
  const showImage = Boolean(spec.src) && !failed

  return (
    <div style={{ marginTop: 12 }}>
      {showImage ? (
        <figure style={{ margin: 0 }}>
          {/*
            라벨은 그림 위에 얹는다 (J.2 ①). 그림 아래에만 늘어놓으면
            「A 발자국」이 어느 줄인지 알 수 없다 — 라벨이 아니라 목록이 된다.
          */}
          <div style={{ position: 'relative' }}>
            <img
              src={spec.src}
              alt={spec.altText}
              onError={() => setFailed(true)}
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8 }}
            />
            {spec.labels
              .filter((l) => l.x !== undefined && l.y !== undefined)
              .map((l) => (
                <span
                  key={l.text}
                  className="text-body-sm"
                  style={{
                    position: 'absolute',
                    left: `${l.x}%`,
                    top: `${l.y}%`,
                    transform: 'translate(-50%, -50%)',
                    /* 사진 위에서도 읽혀야 한다. 흰 알약에 검은 테두리. */
                    background: '#fff',
                    color: '#000',
                    fontWeight: 540,
                    padding: '3px 9px',
                    borderRadius: 999,
                    boxShadow: '0 0 0 2px #000',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}
                >
                  {l.text}
                </span>
              ))}
          </div>
          {spec.labels.some((l) => l.x === undefined) || spec.legend ? (
            <figcaption style={{ marginTop: 12 }}>
              {/*
                라벨을 그림 안에 넣지 않는다 (J.2). 생성 도구가 한국어를 제대로 쓰지 못하고,
                그림에 박힌 글자는 확대·화면 낭독·번역에서 모두 빠진다.
              */}
              {/* 자리를 정하지 않은 라벨만 아래에 늘어놓는다 */}
              {spec.labels.some((l) => l.x === undefined) ? (
                <ul
                  className="flex flex-wrap gap-xs"
                  style={{ listStyle: 'none', padding: 0, margin: 0 }}
                >
                  {spec.labels
                    .filter((l) => l.x === undefined)
                    .map((l) => (
                      <li key={l.text}>
                        <Badge>{l.text}</Badge>
                      </li>
                    ))}
                </ul>
              ) : null}
              {spec.legend ? (
                <p className="text-body-sm" style={{ margin: '10px 0 0', opacity: 0.72 }}>
                  {spec.legend}
                </p>
              ) : null}
            </figcaption>
          ) : null}

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
        </figure>
      ) : (
        /* 파일이 아직 없다. 빈 자리를 남기지 않고 대안을 그린다 (J.1 fallback). */
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

      {/*
        강사에게만 보이는 제작 명세.
        그림은 강의자가 만든다. 만들 때 필요한 것을 화면에서 바로 꺼낼 수 있어야
        「명세가 어디 있더라」로 시간을 쓰지 않는다.
      */}
      {isInstructor ? (
        <details className="no-print" style={{ marginTop: 16 }}>
          <summary className="caption" style={{ cursor: 'pointer' }}>
            그림 만들기 — 생성 프롬프트와 저장 위치 (강사에게만 보입니다)
          </summary>
          <div style={{ marginTop: 12 }}>
            <p className="text-body-sm" style={{ margin: 0 }}>
              <strong>파일 위치</strong>{' '}
              <span className="font-mono">public{spec.src ?? '/figures/…'}</span>
              {spec.src ? '' : ' — 아직 정해지지 않았습니다'}
            </p>
            <p className="text-body-sm" style={{ margin: '10px 0 4px' }}>
              <strong>생성 프롬프트</strong> (그대로 붙여 넣으세요)
            </p>
            <pre
              className="font-mono text-body-sm"
              style={{
                whiteSpace: 'pre-wrap',
                margin: 0,
                padding: 12,
                background: '#f7f7f5',
                borderRadius: 6,
                boxShadow: 'inset 0 0 0 1px #e6e6e6',
              }}
            >
              {spec.genPrompt}
            </pre>
            <p className="text-body-sm" style={{ margin: '12px 0 4px' }}>
              <strong>반드시 보여야 할 것</strong>
            </p>
            <ul className="text-body-sm" style={{ margin: 0, paddingLeft: 20 }}>
              {spec.mustShow.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p className="text-body-sm" style={{ margin: '10px 0 4px' }}>
              <strong>보이면 안 되는 것</strong> — 정답이 그림에 드러나면 활동이 성립하지 않습니다
            </p>
            <ul className="text-body-sm" style={{ margin: 0, paddingLeft: 20 }}>
              {spec.mustNotShow.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </details>
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
  const { isInstructor } = useAuth()
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

      {s.format === 'image' ? <ImageBlock s={s} isInstructor={isInstructor} /> : null}
      {s.format === 'dataTable' ? <TableBlock s={s} /> : null}

      {s.body ? (
        <div style={quoted ? { paddingLeft: 16, boxShadow: 'inset 2px 0 0 #000' } : undefined}>
          <Body body={s.body} />
        </div>
      ) : null}
    </section>
  )
}

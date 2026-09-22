import type { Activity, Step } from '@/content/types'
import { objectParticle } from '@/lib/particle'
import { Caption, ColorBlock } from '@/components/ui'
import { Rich } from '@/components/theory/Rich'

/**
 * 과제 — 활동 단계의 맨 앞 (강의자 지시 2026-09-21).
 *
 * 전에는 과제문이 화면 머리에 캡션(작은 글자)으로만 붙어 있어 무엇을 하라는 것인지 읽히지 않았다.
 * 자료보다 먼저, 제목만큼 큰 글자로 놓고 그 아래에 판단에 필요한 것을 적는다:
 *   · 무엇을 보고 정하나 — 이 단계의 자료와 앞 단계의 기준
 *   · 무엇을 쓰나 — 칸 이름과 그 칸의 안내 한 줄
 *   · 답이 하나가 아니라는 것 — 고른 것이 아니라 고른 까닭이 남는다
 * 학생 화면과 강사 화면이 같은 것을 본다.
 */
export function TaskCard({ activity, step }: { activity: Activity; step: Step }) {
  const sources = step.material.map((m) => m.title)
  const sourceLine = sources.join('」 · 「')
  return (
    <ColorBlock tone="cream">
      <p className="eyebrow" style={{ margin: 0 }}>
        과제
      </p>
      <p className="text-headline" style={{ margin: '10px 0 0' }}>
        <Rich text={activity.task} />
      </p>

      <div className="flex flex-col" style={{ gap: 14, marginTop: 20 }}>
        <div>
          <Caption>무엇을 보고 정하나</Caption>
          <p className="text-body" style={{ margin: '4px 0 0' }}>
            {sources.length > 0 ? `「${sourceLine}」${objectParticle(sources[sources.length - 1])} 읽고, 앞 단계 개념 카드의 기준으로 판단한다.` : '앞 단계 개념 카드의 기준으로 판단한다.'}
          </p>
        </div>

        <div>
          <Caption>무엇을 쓰나</Caption>
          <ol style={{ margin: '4px 0 0', paddingLeft: 20 }}>
            {activity.fields.map((f) => (
              <li key={f.key} className="text-body" style={{ marginBottom: 4 }}>
                <strong>{f.label}</strong>
                {f.help ? <span style={{ opacity: 0.85 }}> — {f.help}</span> : null}
              </li>
            ))}
          </ol>
        </div>

        <p className="text-body-sm" style={{ margin: 0, opacity: 0.8 }}>
          답은 하나가 아니다. 고른 것보다 고른 까닭이 남는다.
        </p>
      </div>
    </ColorBlock>
  )
}

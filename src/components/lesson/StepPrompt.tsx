import type { Step } from '@/content/types'
import { objectParticle } from '@/lib/particle'
import { Caption, ColorBlock } from '@/components/ui'
import { Rich } from '@/components/theory/Rich'

/**
 * 도입·정리의 물음 — 그 단계의 맨 앞 (강의자 지시 2026-09-21).
 *
 * 전에는 물음이 입력 칸의 라벨(작은 글자)로만 있어서 무엇을 묻는지가 자료에 묻혔다.
 * 활동의 과제와 같은 꼴로 앞에 세우고, 무엇을 보고 어떻게 쓰는지 한 줄을 붙인다.
 */
export function StepPrompt({ step }: { step: Step }) {
  if (!step.prompt) return null
  const intro = step.kind === 'intro'
  const sources = step.material.map((m) => m.title)
  return (
    <ColorBlock tone={intro ? 'lilac' : 'mint'}>
      <p className="eyebrow" style={{ margin: 0 }}>
        {intro ? '오늘의 물음' : '오늘의 정리'}
      </p>
      <p className="text-headline" style={{ margin: '10px 0 0' }}>
        <Rich text={step.prompt} />
      </p>
      <div style={{ marginTop: 16 }}>
        {intro ? (
          <>
            <Caption>무엇을 보고 정하나</Caption>
            <p className="text-body" style={{ margin: '4px 0 0' }}>
              {sources.length > 0 ? `「${sources.join('」 · 「')}」${objectParticle(sources[sources.length - 1])} 읽고 지금 생각을 고른다.` : '지금 생각을 고른다.'}
            </p>
            <Caption style={{ marginTop: 12 }}>맞히는 물음이 아니다. 수업이 끝날 때 이 답과 견준다.</Caption>
          </>
        ) : (
          <>
            <Caption>무엇을 보고 쓰나</Caption>
            <p className="text-body" style={{ margin: '4px 0 0' }}>
              오늘 활동에서 내가 고른 것과 그 까닭을 다시 보고 쓴다. 아래에 오늘의 기준이 다시 나와 있다.
            </p>
            <Caption style={{ marginTop: 12 }}>근거가 된 개념 하나와, 그 개념이 없었다면 무엇을 달리 했을지를 함께 적는다.</Caption>
          </>
        )}
      </div>
    </ColorBlock>
  )
}

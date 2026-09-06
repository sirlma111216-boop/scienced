import { useState } from 'react'
import type { AiTaskId } from '@/content/types'
import { Badge, Button, Caption, Card } from '@/components/ui'

/**
 * AI 도움 패널.
 *
 * 규칙 (지시서 14절):
 *  - 클라이언트가 프롬프트 원문을 보내지 않는다. `{ taskId, inputs }` 만 보낸다.
 *  - 학생 이름·학번·닉네임을 넣지 않는다.
 *  - AI 는 점수를 매기지 않는다. 정답을 주지 않는다.
 *  - 출력에 모델명·시각·"사람이 최종 판단합니다"를 표시한다.
 *  - 채택했을 때만 저장하고 채택 여부를 기록한다.
 *
 * 출력 형식은 GOOD / THINK / SUGGEST / ASK 네 줄.
 * ASK 는 물음표로 끝나는 한 문장이고 답을 주지 않는다.
 */

/**
 * 이 패널이 다룰 수 있는 작업.
 *
 * `cluster-responses` 는 여기 없다. 그것은 교사용 분류이고, 반드시 검토대(AiClusterPanel →
 * addAiProposal)를 지나야 한다. 타입에서 빼 두면 실수로 넘길 수 없다.
 */
export type StudentAiTaskId = Exclude<AiTaskId, 'cluster-responses'>

const TASK_LABELS: Record<StudentAiTaskId, { title: string; blurb: string; button: string }> = {
  'recall-probe': {
    title: '되묻기',
    blurb: '내가 쓴 이유를 읽고 질문 하나를 돌려줍니다. 정답은 주지 않습니다.',
    button: '질문 하나 받기',
  },
  'exit-self-check': {
    title: '자기 점검 기준',
    blurb: '내 문장이 ‘증거’인지 스스로 판단할 기준 세 개를 제시합니다. 문장을 고쳐 주지 않습니다.',
    button: '기준 세 개 받기',
  },
  'ai-audit-source': {
    title: '주장 단위로 쪼개기',
    blurb: '검증할 수 있는 주장 단위로만 나눕니다. 진위를 판정하지 않습니다.',
    button: '문장 나누기',
  },
  'rubric-language-check': {
    title: '모호한 표현 찾기',
    blurb: '사람마다 다르게 읽힐 구절을 표시하고 대안 예시를 보입니다.',
    button: '모호한 말 찾기',
  },
}

interface AiResult {
  good?: string
  think?: string
  suggest?: string
  ask?: string
  model: string
  at: number
}

function parseFourLines(text: string, model: string): AiResult {
  const pick = (tag: string) => {
    const m = text.match(new RegExp(`^\\s*${tag}\\s*[:：]\\s*(.+)$`, 'im'))
    return m?.[1]?.trim()
  }
  return {
    good: pick('GOOD'),
    think: pick('THINK'),
    suggest: pick('SUGGEST'),
    ask: pick('ASK'),
    model,
    at: Date.now(),
  }
}

export function AiAssistPanel({
  taskId,
  inputs,
  onAdopt,
}: {
  /** 교사용 분류(cluster-responses)는 여기로 올 수 없다. 타입에서 막혀 있다. */
  taskId: StudentAiTaskId
  /** 서버로 보내는 값. 이름·학번·닉네임을 넣지 않는다. */
  inputs: Record<string, string>
  /** 학생이 채택했을 때만 부른다. 채택 여부가 기록된다. */
  onAdopt?: (result: AiResult) => void
}) {
  const [result, setResult] = useState<AiResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [adopted, setAdopted] = useState(false)

  const meta = TASK_LABELS[taskId]

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // 프롬프트 원문이 아니라 taskId 와 입력값만 보낸다.
        body: JSON.stringify({ taskId, inputs }),
      })
      // 오류여도 HTTP 200 + JSON 으로 온다. 5xx 를 던지면 엣지가 본문을 덮어쓴다.
      const data = (await res.json()) as { ok: boolean; message?: string; text?: string; model?: string }
      if (!data.ok) {
        setError(data.message || 'AI 응답을 받지 못했습니다. 이 활동은 AI 없이도 진행됩니다.')
        return
      }
      setResult(parseFourLines(data.text ?? '', data.model ?? '알 수 없음'))
    } catch {
      setError('AI 서버에 닿지 못했습니다. 이 활동은 AI 없이도 진행됩니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-xs" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <Badge>AI 도움</Badge>
        <h3 className="text-card-title" style={{ margin: 0 }}>
          {meta.title}
        </h3>
      </div>
      <p className="text-body-sm" style={{ opacity: 0.72 }}>
        {meta.blurb}
      </p>

      {!result ? (
        <div className="flex items-center gap-md" style={{ marginTop: 16 }}>
          <Button disabled={busy} onClick={() => void run()}>
            {busy ? '생각하는 중…' : meta.button}
          </Button>
          <Caption>요청할 때만 동작합니다</Caption>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-body-sm" style={{ marginTop: 12, fontWeight: 480 }}>
          ⚠ {error}
        </p>
      ) : null}

      {result ? (
        <div style={{ marginTop: 16 }}>
          <dl style={{ margin: 0 }}>
            {result.good ? (
              <>
                <dt className="caption">잘 된 곳</dt>
                <dd className="text-body" style={{ margin: '4px 0 12px' }}>
                  {result.good}
                </dd>
              </>
            ) : null}
            {result.think ? (
              <>
                <dt className="caption">생각해 볼 곳</dt>
                <dd className="text-body" style={{ margin: '4px 0 12px' }}>
                  {result.think}
                </dd>
              </>
            ) : null}
            {result.suggest ? (
              <>
                <dt className="caption">해 볼 것</dt>
                <dd className="text-body" style={{ margin: '4px 0 12px' }}>
                  {result.suggest}
                </dd>
              </>
            ) : null}
            {result.ask ? (
              <>
                <dt className="caption">되묻는 질문</dt>
                <dd
                  className="text-body-lg"
                  style={{ margin: '4px 0 12px', fontWeight: 480 }}
                >
                  {result.ask}
                </dd>
              </>
            ) : null}
          </dl>

          {/* 근거·한계 배지 — 필수 */}
          <div
            className="rounded-md"
            style={{ padding: '12px 16px', boxShadow: 'inset 0 0 0 1px #e6e6e6', marginTop: 8 }}
          >
            <p className="text-body-sm" style={{ margin: 0, fontWeight: 480 }}>
              AI가 만든 제안입니다. 최종 판단은 본인이 합니다.
            </p>
            <p className="caption" style={{ marginTop: 6, opacity: 0.7 }}>
              모델 {result.model} · {new Date(result.at).toLocaleString('ko-KR')} · 점수를 매기지
              않으며 정답을 판정하지 않습니다
            </p>
          </div>

          <div className="flex flex-wrap gap-xs" style={{ marginTop: 16 }}>
            <Button
              disabled={adopted}
              onClick={() => {
                setAdopted(true)
                onAdopt?.(result)
              }}
            >
              {adopted ? '채택함' : '이 제안을 받아들이기'}
            </Button>
            <Button variant="tertiary" onClick={() => setResult(null)}>
              쓰지 않기
            </Button>
          </div>
          <Caption>채택했을 때만 저장되고, 채택 여부가 함께 기록됩니다.</Caption>
        </div>
      ) : null}
    </Card>
  )
}

import { useState } from 'react'
import { apiPost } from '@/lib/api'
import { useAuth } from '@/lib/auth'
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
  'wrapup-self-check': {
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
  /** 서버가 남긴 사용 기록의 id. 채택 표시를 되돌려 보낼 때 쓴다. */
  logId?: string
}

function parseFourLines(text: string, model: string, logId?: string): AiResult {
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
    logId,
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
  const { isInstructor } = useAuth()

  const meta = TASK_LABELS[taskId]

  async function run() {
    setBusy(true)
    setError(null)
    try {
      // 프롬프트 원문이 아니라 taskId 와 입력값만 보낸다.
      // 오류여도 HTTP 200 + JSON 으로 온다. 5xx 를 던지면 엣지가 본문을 덮어쓴다.
      const data = await apiPost<{
        ok: boolean
        message?: string
        text?: string
        model?: string
        logId?: string
      }>('/api/ai/generate', { taskId, inputs })
      if (!data.ok) {
        const reason = data.message || 'AI 응답을 받지 못했습니다.'
        // 화면에는 다음에 할 일을, 콘솔에는 이유를 남긴다.
        console.warn('[AI]', taskId, reason)
        setError(reason)
        return
      }
      setResult(parseFourLines(data.text ?? '', data.model ?? '알 수 없음', data.logId))
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

      {/*
        실패했을 때.

        학생에게는 한국어 한 줄과 다시 시도 버튼만 보인다.
        구글이 돌려주는 원문은 영어 여러 줄에 콘솔 주소까지 들어 있어,
        수업 중에 그것을 학생 화면에 그대로 띄우면 읽는 사람이 당황한다.
        ★ 원문을 버리지는 않는다 — 강사 화면에서 펼쳐 볼 수 있고, 콘솔에도 남긴다.
          「실패했습니다」만 남기면 원인이 사라진다. 그 사고를 이미 겪었다.
      */}
      {error ? (
        <div style={{ marginTop: 12 }}>
          <p role="alert" className="text-body-sm" style={{ fontWeight: 480, margin: 0 }}>
            ⚠ AI 도움을 받지 못했습니다. 이 활동은 AI 없이도 그대로 진행됩니다.
          </p>
          <div className="flex items-center gap-md" style={{ marginTop: 8 }}>
            <Button variant="secondary" disabled={busy} onClick={() => void run()}>
              다시 시도
            </Button>
            <Caption>작성한 내용은 그대로 있습니다</Caption>
          </div>
          {isInstructor ? (
            <details className="no-print" style={{ marginTop: 12 }}>
              <summary className="caption" style={{ cursor: 'pointer' }}>
                실패 원문 (강사에게만 보입니다)
              </summary>
              <p
                className="text-body-sm"
                style={{ marginTop: 8, opacity: 0.8, wordBreak: 'break-word' }}
              >
                {error}
              </p>
            </details>
          ) : null}
        </div>
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
                /*
                 * 채택했다는 사실만 서버에 남긴다.
                 * 실패해도 화면은 그대로 「채택함」이다 — 기록 때문에 학생을 막지 않는다.
                 */
                if (result.logId) {
                  void apiPost('/api/ai/adopt', { logId: result.logId }).catch((e) => {
                    console.warn('[AI] 채택 기록 실패:', e)
                  })
                }
              }}
            >
              {adopted ? '채택함' : '이 제안을 받아들이기'}
            </Button>
            <Button variant="tertiary" onClick={() => setResult(null)}>
              쓰지 않기
            </Button>
          </div>
          <Caption>
            채택하면 「누가 · 어떤 작업 · 언제 · 채택함」만 기록됩니다. 쓴 내용과 모델의 답은
            저장되지 않습니다.
          </Caption>
        </div>
      ) : null}
    </Card>
  )
}

import { useMemo, useState } from 'react'
import { apiPost } from '@/lib/api'
import { Link } from 'react-router-dom'
import type { LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import type { AiProposal, ResponseDoc } from '@/lib/types'
import { Badge, Button, Caption, Card, Notice } from '@/components/ui'

/**
 * 응답 유형 묶기 — AI 제안 만들기 (4단계).
 *
 * 여기서 만든 것은 곧바로 쓰이지 않는다. `pending` 제안으로 검토대에 쌓인다.
 * 교수자가 읽고 고치고 채택해야 화면에 나간다.
 *
 * 프롬프트에 들어가는 것:
 *  · 문항 제목과 익명 이유 문장뿐이다.
 *  · 이름·학번·닉네임·uid 는 넣지 않는다. 서버에서도 한 번 더 지운다.
 */
export function AiClusterPanel({
  classId,
  lessonId,
  stepId,
  stepTitle,
  docs,
  proposals,
}: {
  classId: string
  lessonId: LessonId
  stepId: string
  stepTitle: string
  docs: ResponseDoc[]
  proposals: AiProposal[]
}) {
  const { repo } = useAuth()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  /** 이유 문장만 익명으로 모은다. 누가 썼는지는 담지 않는다. */
  const reasons = useMemo(() => {
    const out: string[] = []
    for (const d of docs) {
      const last = d.versions?.[d.versions.length - 1]
      if (!last) continue
      for (const [k, val] of Object.entries(last.payload ?? {})) {
        if (/reason|이유|defense|opinion/i.test(k) && typeof val === 'string' && val.trim()) {
          out.push(val.trim())
        }
      }
    }
    return out
  }, [docs])

  const mine = proposals.filter(
    (p) => p.lessonId === lessonId && p.stepId === stepId && p.taskId === 'cluster-responses',
  )
  const pending = mine.filter((p) => p.status === 'pending')
  const accepted = mine.filter((p) => p.status === 'accepted')

  async function request() {
    if (!repo) return
    setBusy(true)
    setMessage(null)
    try {
      const data = await apiPost<{
        ok: boolean
        message?: string
        text?: string
        model?: string
      }>('/api/ai/generate', {
          taskId: 'cluster-responses',
          inputs: {
            question: stepTitle,
            // 번호만 붙인다. 번호는 사람과 이어지지 않는다.
            responses: reasons.map((r, i) => `${i + 1}. ${r}`).join('\n'),
          },
      })
      if (!data.ok) {
        setMessage(data.message || 'AI 응답을 받지 못했습니다. 손으로 묶으셔도 됩니다.')
        return
      }
      // 곧바로 쓰지 않는다. 제안으로 넣는다.
      await repo.addAiProposal(classId, {
        id: `cl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        taskId: 'cluster-responses',
        lessonId,
        stepId,
        original: data.text ?? '',
        edited: data.text ?? '',
        status: 'pending',
        rejectedReason: null,
        model: data.model ?? '알 수 없음',
        createdAt: Date.now(),
        reviewedAt: null,
        reviewedBy: null,
      })
      setMessage('제안을 만들었습니다. 검토대에서 읽고 고친 뒤 채택하세요.')
    } catch {
      setMessage('AI 서버에 닿지 못했습니다. 손으로 묶으셔도 됩니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-xs" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <Badge>AI 도움</Badge>
        <h3 className="text-card-title" style={{ margin: 0 }}>
          응답 유형 묶기
        </h3>
        {pending.length > 0 ? <Badge solid>검토 대기 {pending.length}</Badge> : null}
      </div>

      <p className="text-body-sm" style={{ opacity: 0.72 }}>
        익명 이유 문장 {reasons.length}개를 유형으로 묶어 제안합니다. 정답률을 계산하지 않고 점수를
        매기지 않습니다. 묶음은 제안일 뿐이며 합치고 나누고 이름을 바꿀 수 있습니다.
      </p>

      <div className="flex flex-wrap items-center gap-md" style={{ marginTop: 16 }}>
        <Button disabled={busy || reasons.length < 3} onClick={() => void request()}>
          {busy ? '묶는 중…' : '유형 묶기 제안 받기'}
        </Button>
        {reasons.length < 3 ? (
          <Caption>이유 문장이 3개 이상 모여야 묶을 수 있습니다</Caption>
        ) : null}
        <Link to="/instructor/ai-review" className="btn-tertiary">
          검토대 열기
        </Link>
      </div>

      {message ? (
        <p role="status" className="text-body-sm" style={{ marginTop: 12, fontWeight: 480 }}>
          {message}
        </p>
      ) : null}

      {pending.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <Notice tone="cream">
            <p className="text-body-sm" style={{ margin: 0 }}>
              검토를 기다리는 제안이 있습니다. <strong>채택하기 전에는 학생 화면에 나가지
              않습니다.</strong>
            </p>
          </Notice>
        </div>
      ) : null}

      {/* 채택한 묶음만 여기 보인다 */}
      {accepted.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <Caption>채택한 묶음</Caption>
          {accepted.map((p) => (
            <div key={p.id} style={{ marginTop: 8 }}>
              <p
                className="text-body-sm"
                style={{
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  padding: 12,
                  background: '#f7f7f5',
                  borderRadius: 8,
                }}
              >
                {p.edited}
              </p>
              <Caption style={{ marginTop: 6 }}>
                {p.model} · 교수자가 검토·채택함 · 최종 판단은 사람이 합니다
              </Caption>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  )
}

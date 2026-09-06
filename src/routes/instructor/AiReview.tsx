import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import type { AiProposal } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, Card, ColorBlock, Notice, ScrollX } from '@/components/ui'

/**
 * AI 제안 검토대.
 *
 * 지시서 17절이 4단계의 선행 조건으로 못박은 기능이다.
 * "AI 응답 분류·피드백 제안. 교사의 검토·수정·거부 기능이 먼저 완성된 뒤에만 착수."
 *
 * 그래서 이 화면이 관문이다.
 *  · AI 가 만든 것은 전부 pending 으로 여기 쌓인다.
 *  · 교사가 읽고, 고치고, 채택하기 전에는 학생 화면에 나가지 않는다.
 *  · 원문(original)은 절대 덮어쓰지 않는다. 무엇을 고쳤는지가 남는다.
 *  · 거부한 제안도 지우지 않는다. 무엇을 왜 거부했는지가 자료다.
 */

const TASK_LABEL: Record<string, string> = {
  'recall-probe': '되묻는 질문',
  'cluster-responses': '응답 유형 묶기',
  'exit-self-check': '자기 점검 기준',
  'ai-audit-source': '주장 단위 쪼개기',
  'rubric-language-check': '모호한 표현 찾기',
}

export function InstructorAiReview() {
  const { user, repo, isInstructor } = useAuth()
  const [list, setList] = useState<AiProposal[]>([])
  const [filter, setFilter] = useState<'pending' | 'accepted' | 'rejected' | 'all'>('pending')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!repo) return
    return repo.watchAiProposals(setList)
  }, [repo])

  const shown = useMemo(() => {
    const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt)
    return filter === 'all' ? sorted : sorted.filter((p) => p.status === filter)
  }, [list, filter])

  const counts = useMemo(
    () => ({
      pending: list.filter((p) => p.status === 'pending').length,
      accepted: list.filter((p) => p.status === 'accepted').length,
      rejected: list.filter((p) => p.status === 'rejected').length,
    }),
    [list],
  )

  if (!isInstructor) return <Navigate to="/" replace />

  async function review(
    p: AiProposal,
    status: AiProposal['status'],
  ) {
    if (!repo || !user) return
    if (status === 'rejected' && !reasons[p.id]?.trim()) {
      return
    }
    await repo.reviewAiProposal(
      p.id,
      {
        edited: drafts[p.id] ?? p.edited,
        status,
        rejectedReason: status === 'rejected' ? reasons[p.id].trim() : null,
      },
      user.uid,
    )
  }

  return (
    <AppShell title="AI 제안 검토">
      <p className="eyebrow">강사</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        AI 제안 검토대
      </h1>

      <div style={{ marginTop: 24 }}>
        <Notice tone="lilac">
          <p className="text-body-sm" style={{ margin: 0 }}>
            <strong>여기를 지나지 않은 AI 결과는 학생 화면에 나가지 않습니다.</strong> AI 는 제안만
            만들고, 채택 여부는 교수자가 정합니다. 원문은 지워지지 않으므로 무엇을 어떻게 고쳤는지
            나중에 확인할 수 있습니다.
          </p>
        </Notice>
      </div>

      <div className="flex flex-wrap gap-xs" style={{ marginTop: 32 }}>
        {(
          [
            ['pending', `검토 대기 ${counts.pending}`],
            ['accepted', `채택 ${counts.accepted}`],
            ['rejected', `거부 ${counts.rejected}`],
            ['all', '전체'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className="tab"
            data-selected={filter === k}
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div style={{ marginTop: 32 }}>
          <ColorBlock tone="cream">
            <p className="text-subhead" style={{ margin: 0 }}>
              {filter === 'pending'
                ? '검토를 기다리는 제안이 없습니다.'
                : '해당하는 제안이 없습니다.'}
            </p>
          </ColorBlock>
        </div>
      ) : (
        <div className="flex flex-col gap-lg" style={{ marginTop: 32 }}>
          {shown.map((p) => {
            const draft = drafts[p.id] ?? p.edited ?? p.original
            const changed = draft.trim() !== p.original.trim()
            return (
              <Card key={p.id}>
                <div className="flex items-center gap-xs" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
                  <Badge solid>{TASK_LABEL[p.taskId] ?? p.taskId}</Badge>
                  <Badge>
                    {p.lessonId}강 · {p.stepId}
                  </Badge>
                  <Badge>
                    {p.status === 'pending' ? '검토 대기' : p.status === 'accepted' ? '채택함' : '거부함'}
                  </Badge>
                  {changed ? <Badge>수정됨</Badge> : null}
                  <span className="flex-1" />
                  <Caption>
                    {p.model} · {new Date(p.createdAt).toLocaleString('ko-KR')}
                  </Caption>
                </div>

                <ScrollX>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: 16,
                    }}
                  >
                    <div>
                      <Caption>AI 원문 — 지워지지 않습니다</Caption>
                      <p
                        className="text-body-sm"
                        style={{
                          whiteSpace: 'pre-wrap',
                          margin: '8px 0 0',
                          padding: 12,
                          background: '#f7f7f5',
                          borderRadius: 8,
                        }}
                      >
                        {p.original}
                      </p>
                    </div>
                    <div className="flex flex-col gap-xs">
                      <label htmlFor={`ai-edit-${p.id}`} className="caption">
                        교수자가 고친 것 — 채택하면 이쪽이 나갑니다
                      </label>
                      <textarea
                        id={`ai-edit-${p.id}`}
                        className="field"
                        rows={6}
                        value={draft}
                        disabled={p.status !== 'pending'}
                        onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                        style={{ resize: 'vertical' }}
                      />
                    </div>
                  </div>
                </ScrollX>

                {p.status === 'pending' ? (
                  <>
                    <div className="flex flex-col gap-xs" style={{ marginTop: 16 }}>
                      <label htmlFor={`ai-rej-${p.id}`} className="caption">
                        거부한다면 그 이유 — 거부에도 근거를 남깁니다
                      </label>
                      <input
                        id={`ai-rej-${p.id}`}
                        className="field"
                        value={reasons[p.id] ?? ''}
                        placeholder="예: 학생 답을 판정하는 문장이 들어 있다"
                        onChange={(e) => setReasons((r) => ({ ...r, [p.id]: e.target.value }))}
                      />
                    </div>

                    <div className="flex flex-wrap gap-xs" style={{ marginTop: 16 }}>
                      <Button onClick={() => void review(p, 'accepted')}>
                        {changed ? '고쳐서 채택' : '그대로 채택'}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={!reasons[p.id]?.trim()}
                        onClick={() => void review(p, 'rejected')}
                      >
                        거부
                      </Button>
                      {!reasons[p.id]?.trim() ? (
                        <Caption style={{ alignSelf: 'center' }}>
                          거부하려면 이유를 적어야 합니다
                        </Caption>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: 16 }}>
                    <Caption>
                      {p.status === 'accepted' ? '채택함' : '거부함'} ·{' '}
                      {p.reviewedAt ? new Date(p.reviewedAt).toLocaleString('ko-KR') : '—'}
                    </Caption>
                    {p.rejectedReason ? (
                      <p className="text-body-sm" style={{ marginTop: 6 }}>
                        거부 사유 · {p.rejectedReason}
                      </p>
                    ) : null}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 96 }}>
        <ColorBlock tone="navy">
          <p className="eyebrow">이 관문이 있는 이유</p>
          <p className="text-subhead" style={{ marginTop: 12, maxWidth: 720 }}>
            AI 가 유창하게 설명했다는 이유로 과학적 타당성을 인정하지 않습니다. 학생의 최종 판단과
            교사의 평가 책임을 보존하기 위해, AI 결과는 언제나 제안으로만 들어오고 사람이 채택한
            것만 학생에게 갑니다.
          </p>
        </ColorBlock>
      </div>
    </AppShell>
  )
}

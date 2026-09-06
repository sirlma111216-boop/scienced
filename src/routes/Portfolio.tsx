import { useEffect, useState } from 'react'
import { LESSONS } from '@/content/lessons'
import { useAuth } from '@/lib/auth'
import type { ResponseDoc } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, ColorBlock } from '@/components/ui'

/**
 * 수업설계 포트폴리오.
 *
 * 완성본 보관함이 아니다. 초안 – 피드백 – 수정본 – 성찰이 한 묶음으로 남는다.
 * 여기서는 각 차시의 응답 버전을 모아 보여 주고, 인쇄와 내려받기를 제공한다.
 */
export function Portfolio() {
  const { user, repo } = useAuth()
  const [byStep, setByStep] = useState<Record<string, ResponseDoc>>({})

  useEffect(() => {
    if (!repo || !user) return
    const unsubs: Array<() => void> = []
    for (const l of LESSONS) {
      for (const s of l.steps) {
        unsubs.push(
          repo.watchResponse(l.id, s.id, user.uid, (d) => {
            if (!d || (d.latestV ?? 0) === 0) return
            setByStep((prev) => ({ ...prev, [`${l.id}/${s.id}`]: d }))
          }),
        )
      }
    }
    return () => unsubs.forEach((u) => u())
  }, [repo, user])

  const entries = Object.entries(byStep)
  const totalVersions = entries.reduce((s, [, d]) => s + (d.versions?.length ?? 0), 0)
  const revised = entries.filter(([, d]) => (d.versions?.length ?? 0) > 1).length

  function download() {
    const data = { user: user?.nickname, exportedAt: new Date().toISOString(), responses: byStep }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `portfolio-${user?.nickname || 'me'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppShell title="포트폴리오">
      <p className="eyebrow">한 학기</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        수업설계 포트폴리오
      </h1>
      <p className="text-subhead" style={{ marginTop: 16, maxWidth: 760 }}>
        완성본만 모으지 않습니다. 처음 쓴 것, 무엇을 왜 바꿨는지, 지금의 생각이 함께 남습니다.
      </p>

      <div className="flex flex-wrap gap-xs" style={{ marginTop: 24 }}>
        <Badge>제출한 단계 {entries.length}개</Badge>
        <Badge>전체 버전 {totalVersions}개</Badge>
        <Badge>고쳐 쓴 단계 {revised}개</Badge>
      </div>

      <div className="flex gap-xs no-print" style={{ marginTop: 24 }}>
        <Button variant="secondary" onClick={() => window.print()}>
          인쇄
        </Button>
        <Button variant="secondary" onClick={download}>
          내 자료 내려받기
        </Button>
      </div>

      {entries.length === 0 ? (
        <div style={{ marginTop: 48 }}>
          <ColorBlock tone="cream">
            <p className="text-subhead" style={{ margin: 0 }}>
              아직 제출한 것이 없습니다. 차시를 열고 첫 답을 남기면 여기에 쌓입니다.
            </p>
          </ColorBlock>
        </div>
      ) : (
        <div className="flex flex-col gap-xl" style={{ marginTop: 48 }}>
          {LESSONS.map((l) => {
            const rows = l.steps
              .map((s) => ({ step: s, doc: byStep[`${l.id}/${s.id}`] }))
              .filter((r) => r.doc)
            if (rows.length === 0) return null
            return (
              <section key={l.id} className="card">
                <div className="flex items-center gap-xs" style={{ marginBottom: 12 }}>
                  <span className="font-mono text-caption">{l.id}강</span>
                  <h2 className="text-card-title" style={{ margin: 0 }}>
                    {l.title}
                  </h2>
                </div>
                {rows.map(({ step, doc }) => {
                  const latest = doc.versions[doc.versions.length - 1]
                  return (
                    <div
                      key={step.id}
                      style={{ paddingTop: 16, marginTop: 16, boxShadow: 'inset 0 1px 0 #f1f1f1' }}
                    >
                      <div className="flex items-center gap-xs">
                        <Caption>{step.title}</Caption>
                        <Badge>v{doc.versions.length}</Badge>
                        {latest.confidence != null ? (
                          <Caption>확신도 {latest.confidence}/5</Caption>
                        ) : null}
                      </div>
                      {doc.versions.length > 1 ? (
                        <p className="text-body-sm" style={{ marginTop: 8 }}>
                          <strong>바꾼 이유</strong> ·{' '}
                          {doc.versions
                            .filter((v) => v.changedReason)
                            .map((v) => v.changedReason)
                            .join(' / ') || '적지 않음'}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </section>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 96 }}>
        <ColorBlock tone="lilac">
          <p className="eyebrow">보관과 삭제</p>
          <p className="text-subhead" style={{ marginTop: 12, maxWidth: 700 }}>
            여러분의 응답은 학기 종료 후 180일이 지나면 삭제됩니다. 그 전에도 요청하면 지울 수
            있습니다. 내려받기로 자기 자료를 언제든 가져갈 수 있습니다.
          </p>
        </ColorBlock>
      </div>
    </AppShell>
  )
}

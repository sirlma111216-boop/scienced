import { useEffect, useState } from 'react'
import { lessonIndex } from '@/content/courses'
import { isConceptStepId, stepIdsOf } from '@/content/steps'
import type { LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { courseOf } from '@/lib/lesson-data'
import type { ResponseDoc } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, ColorBlock } from '@/components/ui'

/**
 * 포트폴리오 — 차시마다 낸 답이 그대로 남는다.
 *
 * 내용 파일을 불러오지 않는다. 색인의 골격(stepIdsOf)과 옛 단계 id(legacyStepIds)만으로 응답 경로를 안다.
 * 개념 단계는 뺀다 — 잠깐 확인의 답(보기 자리)만 있어 내용 없이는 읽을 수 없다.
 * 공개된 차시만 구독한다 — 규칙이 미공개 차시의 응답 읽기를 막으므로 헛된 구독을 만들지 않는다.
 */
const STEP_LABEL: Record<string, string> = { intro: '도입', concepts: '개념', activity: '활동', 'concepts-2': '개념 2부', 'activity-2': '활동 2', wrapup: '정리' }

export function Portfolio() {
  const { user, repo, classId, currentClass, isInstructor } = useAuth()
  const courseId = courseOf(currentClass)
  const [published, setPublished] = useState<LessonId[]>([])
  const [byStep, setByStep] = useState<Record<string, ResponseDoc>>({})

  useEffect(() => {
    if (!repo || !classId) return
    return repo.watchLessonState(classId, setPublished)
  }, [repo, classId])

  const index = lessonIndex(courseId)
  const visible = index.filter((l) => isInstructor || published.includes(l.id))
  const visibleKey = visible.map((l) => l.id).join(',')

  useEffect(() => {
    if (!repo || !user || !classId) return
    const unsubs: Array<() => void> = []
    for (const l of visible) {
      for (const s of [...stepIdsOf(l.layout).filter((x) => !isConceptStepId(x)), ...(l.legacyStepIds ?? [])]) {
        unsubs.push(
          repo.watchResponse(classId, l.id, s, user.uid, (d: ResponseDoc | null) => {
            if (!d || (d.latestV ?? 0) === 0) return
            setByStep((prev) => ({ ...prev, [`${l.id}/${s}`]: d }))
          }),
        )
      }
    }
    return () => unsubs.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, user, classId, visibleKey])

  const entries = Object.entries(byStep)

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
        포트폴리오
      </h1>
      <p className="text-subhead" style={{ marginTop: 16, maxWidth: 760 }}>
        차시마다 낸 답이 그대로 남는다.
      </p>

      <div className="flex flex-wrap gap-xs" style={{ marginTop: 24 }}>
        <Badge>제출한 단계 {entries.length}개</Badge>
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
              아직 제출한 것이 없다. 차시를 열고 첫 답을 남기면 여기에 쌓인다.
            </p>
          </ColorBlock>
        </div>
      ) : (
        <div className="flex flex-col gap-xl" style={{ marginTop: 48 }}>
          {visible.map((l) => {
            const ids = [...stepIdsOf(l.layout).filter((x) => !isConceptStepId(x)), ...(l.legacyStepIds ?? [])]
            const rows = ids.map((s) => ({ stepId: s, doc: byStep[`${l.id}/${s}`] })).filter((r) => r.doc)
            if (rows.length === 0) return null
            return (
              <section key={l.id} className="card">
                <div className="flex items-center gap-xs" style={{ marginBottom: 12 }}>
                  <span className="font-mono text-caption">{Number(l.id)}강</span>
                  <h2 className="text-card-title" style={{ margin: 0 }}>
                    {l.title}
                  </h2>
                </div>
                {rows.map(({ stepId, doc }) => (
                  <div key={stepId} style={{ paddingTop: 16, marginTop: 16, boxShadow: 'inset 0 1px 0 #f1f1f1' }}>
                    <Caption>{STEP_LABEL[stepId] ?? `옛 단계 · ${stepId}`}</Caption>
                    <p className="text-body-sm" style={{ marginTop: 8, whiteSpace: 'pre-line' }}>
                      {Object.values((doc.versions[doc.versions.length - 1]?.payload ?? {}) as Record<string, unknown>)
                        .map((v) => (typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.join(', ') : v && typeof v === 'object' ? Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k} ${String(x)}`).join(' · ') : ''))
                        .filter(Boolean)
                        .join('\n')}
                    </p>
                  </div>
                ))}
              </section>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 96 }}>
        <ColorBlock tone="lilac">
          <p className="eyebrow">보관과 삭제</p>
          <p className="text-subhead" style={{ marginTop: 12, maxWidth: 700 }}>
            응답은 학기 종료 후 180일이 지나면 삭제된다. 그 전에도 요청하면 지울 수 있다. 내려받기로 자기 자료를 언제든 가져갈 수 있다.
          </p>
        </ColorBlock>
      </div>
    </AppShell>
  )
}

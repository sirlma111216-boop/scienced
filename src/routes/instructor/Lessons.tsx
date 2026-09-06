import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LESSONS } from '@/content/lessons'
import type { LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, ScrollX } from '@/components/ui'

/**
 * 18개 차시 · 공개 토글.
 *
 * 공개를 끌 때 "이미 제출한 응답은 남습니다. 학생 화면에서만 숨겨집니다"를 확인받는다.
 */
export function InstructorLessons() {
  const { repo } = useAuth()
  const [published, setPublished] = useState<LessonId[]>([])

  useEffect(() => {
    if (!repo) return
    return repo.watchPublished(setPublished)
  }, [repo])

  async function toggle(id: LessonId, next: boolean) {
    if (!next) {
      const ok = confirm(
        '이 차시를 비공개로 돌립니다.\n\n이미 제출한 응답은 남습니다. 학생 화면에서만 숨겨집니다.\n계속할까요?',
      )
      if (!ok) return
    }
    await repo?.setPublished(id, next)
  }

  return (
    <AppShell title="차시 공개 관리">
      <p className="eyebrow">강사</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        차시
      </h1>
      <p className="text-body-lg" style={{ marginTop: 16, maxWidth: 700 }}>
        학생 홈에는 공개된 차시만 보입니다. 미공개 차시는 개수도 제목도 나가지 않습니다.
      </p>

      <ScrollX>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720, marginTop: 32 }}>
          <thead>
            <tr>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 16px 8px 0' }}>
                차시
              </th>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 16px 8px 0' }}>
                제목
              </th>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 16px 8px 0' }}>
                상태
              </th>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 0' }}>
                진행
              </th>
            </tr>
          </thead>
          <tbody>
            {LESSONS.map((l) => {
              const on = published.includes(l.id)
              return (
                <tr key={l.id} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                  <td className="font-mono text-body-sm" style={{ padding: '12px 16px 12px 0' }}>
                    {l.id}
                  </td>
                  <td style={{ padding: '12px 16px 12px 0' }}>
                    <span className="text-body">{l.title}</span>
                    <Caption>{l.moduleName}</Caption>
                  </td>
                  <td style={{ padding: '12px 16px 12px 0' }}>
                    <button
                      type="button"
                      className="tab"
                      role="switch"
                      aria-checked={on}
                      data-selected={on}
                      onClick={() => void toggle(l.id, !on)}
                      style={{ minHeight: 40 }}
                    >
                      {on ? '공개 중' : '미공개'}
                    </button>
                  </td>
                  <td style={{ padding: '12px 0' }}>
                    <Link to={`/instructor/lesson/${l.id}/live`}>
                      <Button variant="secondary">진행 콘솔</Button>
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ScrollX>

      <p className="text-body-sm" style={{ marginTop: 24, opacity: 0.72 }}>
        <Badge>시드</Badge> 처음 상태에서는 1강만 공개되어 있습니다.
      </p>
    </AppShell>
  )
}

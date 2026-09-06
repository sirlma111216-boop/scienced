import type { ScriptLine } from '@/content/types'
import { Badge, Caption, usePresent } from '@/components/ui'

/**
 * 강사 대본.
 *
 * 발표 모드에서만 빨간 표식과 "왜 빼면 안 되는가"가 뜬다.
 * 학생 화면에는 진행 팁과 토론 타이머가 뜨지 않는다.
 *
 * 이 컴포넌트를 학생 경로에서 부르면 아무것도 그리지 않는다(instructorOnly 기본값).
 */
export function MustSay({
  lines,
  stepId,
  instructorOnly = true,
  isInstructor,
}: {
  lines: ScriptLine[]
  stepId?: string
  instructorOnly?: boolean
  isInstructor: boolean
}) {
  const { present } = usePresent()
  if (instructorOnly && !isInstructor) return null

  const shown = stepId ? lines.filter((l) => l.stepId === stepId) : lines
  if (shown.length === 0) return null

  return (
    <section
      className="no-print rounded-lg"
      style={{
        boxShadow: 'inset 0 0 0 2px #000',
        padding: present ? 24 : 16,
        marginBottom: 24,
      }}
      aria-label="강사 대본"
    >
      <div className="flex items-center gap-xs" style={{ marginBottom: 12 }}>
        <Badge solid>강사 대본</Badge>
        <Caption>학생 화면에는 보이지 않습니다</Caption>
      </div>

      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {shown.map((l, i) => (
          <li
            key={`${l.stepId}-${i}`}
            style={{
              paddingTop: i === 0 ? 0 : 16,
              marginTop: i === 0 ? 0 : 16,
              boxShadow: i === 0 ? 'none' : 'inset 0 1px 0 #f1f1f1',
            }}
          >
            <Caption>{l.cue}</Caption>
            <p
              className={present ? 'text-headline' : 'text-body'}
              style={{ margin: '6px 0', fontWeight: 480 }}
            >
              <span className="font-mono" aria-hidden style={{ marginRight: 8 }}>
                ▮
              </span>
              “{l.sayThis}”
            </p>
            {/* 왜 빼면 안 되는가 — 발표 모드에서만 */}
            {present ? (
              <>
                <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.8 }}>
                  <strong>빼면 안 되는 이유</strong> · {l.whyNotSkip}
                </p>
                <p className="text-body-sm" style={{ margin: '4px 0 0', opacity: 0.8 }}>
                  <strong>무엇을 볼 것인가</strong> · {l.watchFor}
                </p>
              </>
            ) : (
              <details>
                <summary className="caption" style={{ cursor: 'pointer' }}>
                  왜 빼면 안 되는가 · 무엇을 볼 것인가
                </summary>
                <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.8 }}>
                  {l.whyNotSkip}
                </p>
                <p className="text-body-sm" style={{ margin: '4px 0 0', opacity: 0.8 }}>
                  {l.watchFor}
                </p>
              </details>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

/** 짧은 진행 팁. 발표 모드에서만 드러난다. */
export function TeachTip({ children, isInstructor }: { children: React.ReactNode; isInstructor: boolean }) {
  const { present } = usePresent()
  if (!isInstructor || !present) return null
  return (
    <p
      className="no-print text-body-sm rounded-md"
      style={{ padding: '8px 12px', boxShadow: 'inset 0 0 0 1px #000', marginTop: 12 }}
    >
      <span className="font-mono" aria-hidden style={{ marginRight: 6 }}>
        ▮
      </span>
      {children}
    </p>
  )
}

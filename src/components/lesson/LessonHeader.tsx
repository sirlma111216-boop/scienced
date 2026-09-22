import type { Lesson } from '@/content/types'
import { Caption } from '@/components/ui'
import { Rich } from '@/components/theory/Rich'

/**
 * 차시 머리 — 제목 · 중심 질문 · 학습목표 셋뿐이다 (8차 원칙 11).
 * 학생 화면과 강사 수업 화면이 같은 부품을 쓴다. 강사 화면이 학생과 다른 머리를 그리지 않는다 (강의자 지시 2026-09-22).
 */
export function LessonHeader({ lesson }: { lesson: Lesson }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <p className="eyebrow">{Number(lesson.id)}강</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        {lesson.title}
      </h1>
      <p className="text-subhead" style={{ marginTop: 24, maxWidth: 760 }}>
        {lesson.centralQuestion}
      </p>
      <div style={{ marginTop: 24 }}>
        <Caption>학습목표</Caption>
        <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
          {lesson.objectives.map((o, i) => (
            <li key={i} className="text-body" style={{ marginBottom: 6 }}>
              <Rich text={o} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

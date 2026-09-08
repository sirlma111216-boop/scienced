import { useState } from 'react'
import { AFTER_CLASS_LABEL, type LessonId, type Lesson } from '@/content/types'
import type { LessonView, StepView } from '@/lib/tiers'
import { ConceptCard } from '@/components/concept/ConceptCard'
import { StimulusView } from '@/components/stimulus/StimulusView'
import { ResponseCollector } from './ResponseCollector'
import { Caption, Notice } from '@/components/ui'

/**
 * 「수업 후 이어서」 (3차 F.2 ① · F.6).
 *
 * 50분 판에서 흐름을 빠진 블록은 사라지지 않는다. 여기로 내려온다.
 * 두 반은 같은 강의고 같은 산출물을 남겨야 하기 때문이다 —
 * 이것이 없으면 50분 반 학생만 포트폴리오가 얇아진다.
 *
 * 기한은 두지 않는다. 강의자가 마감으로 몰지 않기로 했다.
 *
 * ── 같은 단계에 수집기가 둘 붙는 문제 ──
 * 단계 전체가 내려온 경우(예: 이번 수업 정리)는 흐름에 그 단계가 없으니 겹치지 않는다.
 * 칸 일부만 내려온 경우는 흐름에도 같은 단계가 있다. 그때 초안을 양쪽에서 쓰면 서로 덮어쓴다.
 * 그래서 여기서는 초안 저장을 끈다(autosave={false}).
 * 제출은 마지막 제출본을 불러와 통째로 다시 쓰므로 앞서 낸 답이 지워지지 않는다.
 */
export function AfterClass({
  classId,
  lesson,
  view,
}: {
  classId: string
  lesson: Lesson
  view: LessonView
}) {
  const [open, setOpen] = useState(false)

  /* 흐름에 남은 단계 중 일부 블록만 내려온 것 + 통째로 내려온 단계 */
  const partials = view.steps.filter(
    (s) => s.deferredFields.length + s.deferredMaterial.length + s.deferredConcepts.length > 0,
  )
  const groups = [...partials, ...view.deferredSteps]
  if (groups.length === 0) return null

  return (
    <section className="no-print" style={{ marginTop: 64 }}>
      <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary
          className="text-card-title"
          style={{ cursor: 'pointer', paddingBottom: 8, minHeight: 44 }}
        >
          {AFTER_CLASS_LABEL}
          <span className="font-mono text-caption" style={{ marginLeft: 10, opacity: 0.7 }}>
            {groups.length}
          </span>
        </summary>

        <Notice tone="cream">
          <p className="text-body-sm" style={{ margin: 0 }}>
            수업 시간에 다루지 않은 부분입니다. 이어서 작성해 주세요. 여기서 낸 답도 수업 중 제출과
            똑같이 포트폴리오에 쌓입니다.
          </p>
        </Notice>

        {/* 열기 전에는 그리지 않는다 — 같은 단계의 수집기가 둘 뜨는 시간을 줄인다. */}
        {open
          ? groups.map((g) => (
              <AfterClassGroup key={g.step.id} classId={classId} lesson={lesson} group={g} />
            ))
          : null}
      </details>
    </section>
  )
}

function AfterClassGroup({
  classId,
  lesson,
  group,
}: {
  classId: string
  lesson: Lesson
  group: StepView
}) {
  /*
   * 단계 전체가 내려온 경우에는 그 단계의 모든 블록이 이미 deferred 쪽에 들어 있다.
   * 그래서 두 경우를 나눌 필요가 없다 — 언제나 deferred 쪽만 그리면 된다.
   */
  const whole = group.step.fields.length === group.deferredFields.length && group.deferredFields.length > 0
  const fields = group.deferredFields
  const material = group.deferredMaterial
  const concepts = group.deferredConcepts

  const partStep = { ...group.step, fields, material }
  const lessonId: LessonId = lesson.id

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <Caption>{whole ? '이 단계 전체' : '이 단계의 남은 부분'}</Caption>
      <h3 className="text-card-title" style={{ margin: '8px 0 4px' }}>
        {group.step.title}
      </h3>

      {material.map((m) => (
        <StimulusView key={m.id} stimulus={m} />
      ))}

      {concepts.length > 0 ? (
        <div className="flex flex-col" style={{ gap: 64, marginTop: 32 }}>
          {concepts.map((c, i) => (
            <ConceptCard key={c.id} concept={c} index={i} />
          ))}
        </div>
      ) : null}

      {fields.length > 0 ? (
        <div style={{ marginTop: 24 }}>
          <ResponseCollector
            classId={classId}
            lessonId={lessonId}
            step={partStep}
            autosave={false}
          />
        </div>
      ) : null}
    </div>
  )
}

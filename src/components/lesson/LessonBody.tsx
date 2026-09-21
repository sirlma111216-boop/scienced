import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CourseId, FieldDef, KeyConcept, Lesson, LessonId, Step } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { allocationAverage, rankSum, sortTally, voteCounts, type MemberValue } from '@/lib/group-math'
import { OPTION_MARK, checkTally } from '@/lib/concept-check'
import { stepBlocks, type Block } from '@/lib/teach-registry'
import type { Enrollment, GroupRound, GroupShare, GroupValue, Participation, Post, ResponseDoc, SessionState } from '@/lib/types'
import { Badge, Button, Caption, ScrollX } from '@/components/ui'
import { ConceptCard, KeyPoints } from '@/components/concept/ConceptCard'
import { StudentConceptCards } from '@/components/concept/ConceptCheck'
import { StepPrompt } from './StepPrompt'
import { TaskCard } from './TaskCard'
import { LockedCard, StimulusView } from '@/components/stimulus/StimulusView'
import { DistributionView } from '@/components/response/DistributionView'
import { ResponseCollector } from '@/components/response/ResponseCollector'
import { ShareBar, WallCard } from '@/components/wall/Wall'
import { GroupBoard } from '@/components/group/GroupBoard'
import { GroupStep } from '@/components/group/GroupStep'
import { GameShell, type TeacherGameProps } from '@/components/games/GameShell'
import { TheoryPage } from '@/components/theory/TheoryPage'
import { payloadOf, submitted as isSubmitted } from '@/components/teach/names'

/**
 * 한 단계의 본문 — 학생 화면과 강사 수업 화면이 같은 부품이다 (8차 7절).
 *
 * 블록 순서는 teach-registry 의 stepBlocks() 하나가 정한다. 강사(teacher prop)면 블록 옆에 등록표가 정한 조작부만 붙는다:
 *   prompt → 도입·정리의 물음 · task → 과제문(조작부 없음) · stimulusReveal → [자료 공개] · concepts → 잠깐 확인 「응답 n/N ▸」 · field → 「응답 n/N ▸」 · wall → 「올라온 글 n ▸」 · group → 「모둠별 ▸」 · game → [게임 시작]
 * 학생의 쓰는 칸은 강사가 「단계 열기」를 누른 뒤에만 열린다 (session.openSteps).
 */
export interface TeacherView extends TeacherGameProps {
  /** 이 단계의 응답 전부 */
  docs: ResponseDoc[]
  onReveal: (gateId: string, open: boolean) => void
}

export function LessonBody({
  classId,
  courseId,
  lesson,
  step,
  session,
  round,
  nicknames,
  teacher,
  tally,
}: {
  classId: string
  courseId: CourseId
  lesson: Lesson
  step: Step
  session: SessionState | null
  round: GroupRound | null
  nicknames: Record<string, string>
  teacher?: TeacherView | null
  tally?: Array<{ option: string; count: number }>
}) {
  const { user, isInstructor } = useAuth()
  const blocks = useMemo(() => stepBlocks(step, lesson), [step, lesson])
  const revealed = session?.revealed ?? []
  const stepOpen = Boolean(teacher) || (session?.openSteps ?? []).includes(step.id)
  const isOpen = (gate: { type: string; of: string }) => (gate.type === 'afterSubmit' ? true : revealed.includes(gate.of))
  const firstField = blocks.findIndex((b) => b.kind === 'field')
  const groups = round?.groups ?? []
  const myGroup = user ? (groups.find((g) => g.memberUids.includes(user.uid)) ?? null) : null
  const groupField = step.activity ? step.fields.find((f) => f.key === step.activity!.group.fieldKey) : undefined

  return (
    <div className="flex flex-col" style={{ gap: 24 }}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'prompt':
            return <StepPrompt key={b.id} step={step} />
          case 'task':
            return step.activity ? <TaskCard key={b.id} activity={step.activity} step={step} /> : null
          case 'stimulus':
            return <StimulusView key={b.id} stimulus={b.material!} />
          case 'stimulusReveal': {
            const open = revealed.includes(b.gateId!)
            if (teacher) {
              return (
                <div key={b.id}>
                  <Control>
                    <Button variant={open ? 'primary' : 'secondary'} aria-pressed={open} onClick={() => teacher.onReveal(b.gateId!, !open)}>
                      자료 공개
                    </Button>
                    <Caption>{open ? '학생 화면에 열려 있다' : '누르면 학생 화면에 열린다'}</Caption>
                  </Control>
                  <StimulusView stimulus={b.material!} />
                </div>
              )
            }
            return open ? <StimulusView key={b.id} stimulus={b.material!} /> : <LockedCard key={b.id} title={b.material!.title} message={b.material!.gate?.lockedMessage ?? '강사가 공개하면 열린다.'} />
          }
          case 'concepts':
            if (!teacher) return <StudentConceptCards key={b.id} classId={classId} lessonId={lesson.id} step={step} />
            return (
              <div key={b.id} className="flex flex-col" style={{ gap: 48 }}>
                {step.concepts.map((c, j) => (
                  <ConceptCard key={c.id} concept={c} index={j}>
                    <TeacherCheck concept={c} docs={teacher.docs} students={teacher.students} nameOf={teacher.nameOf} />
                  </ConceptCard>
                ))}
              </div>
            )
          case 'recap':
            return (
              <section key={b.id} aria-label="기준 다시 보기">
                <Caption>오늘의 기준 — 읽기만</Caption>
                <div className="flex flex-col" style={{ gap: 12, marginTop: 8 }}>
                  {(step.recap ?? []).map((c) => (
                    <KeyPoints key={c.id} points={c.keyPoints} compact name={c.name} />
                  ))}
                </div>
              </section>
            )
          case 'field':
            if (teacher) return <TeacherResponses key={b.id} block={b} field={b.field!} docs={teacher.docs} students={teacher.students} nameOf={teacher.nameOf} />
            if (i !== firstField) return null
            return (
              <div key={b.id}>
                {stepOpen ? (
                  <ResponseCollector classId={classId} lessonId={lesson.id} step={step} isGateOpen={isOpen}>
                    {(submitted, doc) =>
                      step.activity && submitted ? (
                        <div className="flex flex-col" style={{ gap: 24, marginTop: 24 }}>
                          <ShareBar classId={classId} lessonId={lesson.id} stepId={step.id} prompt={step.activity.share.prompt} unlocked={submitted} fields={step.fields} groupId={myGroup?.id ?? null} />
                          {groupField ? <GroupStep classId={classId} lessonId={lesson.id} stepId={step.id} group={step.activity.group} field={groupField} myValues={payloadOf(doc)} myGroup={myGroup} /> : null}
                          <GameShell classId={classId} lessonId={lesson.id} courseId={courseId} step={step} activity={step.activity} session={session} round={round} nicknames={nicknames} tally={tally} />
                        </div>
                      ) : null
                    }
                  </ResponseCollector>
                ) : (
                  <LockedCard title={step.fields.map((f) => f.label).join(' · ')} message="강사가 이 단계를 열면 쓸 수 있다." />
                )}
              </div>
            )
          case 'wall':
            return teacher ? <TeacherWall key={b.id} classId={classId} lessonId={lesson.id} stepId={step.id} prompt={step.activity?.share.prompt ?? ''} /> : null
          case 'group':
            return teacher && step.activity && groupField ? <TeacherGroups key={b.id} classId={classId} lessonId={lesson.id} stepId={step.id} group={step.activity.group} field={groupField} groups={groups} nameOf={teacher.nameOf} /> : null
          case 'game':
            return teacher && step.activity ? <GameShell key={b.id} classId={classId} lessonId={lesson.id} courseId={courseId} step={step} activity={step.activity} session={session} round={round} nicknames={nicknames} teacher={teacher} tally={tally} /> : null
          case 'more':
            return (
              <details key={b.id} className="card">
                <summary className="text-card-title" style={{ cursor: 'pointer' }}>
                  더 읽기 — 이론 배경
                </summary>
                <div style={{ marginTop: 16 }}>
                  <TheoryPage lesson={lesson} isInstructor={isInstructor} />
                </div>
              </details>
            )
          default:
            return null
        }
      })}
    </div>
  )
}

function Control({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-xs no-print" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
      {children}
    </div>
  )
}

/* ─────────────────────────── 강사 — 잠깐 확인 응답 n/N ▸ ─────────────────────────── */

/** 물음과 보기는 펼쳐 두고, 정답과 분포는 접어 둔다 — 띄운 화면에 정답이 먼저 나오지 않게 */
function TeacherCheck({ concept, docs, students, nameOf }: { concept: KeyConcept; docs: ResponseDoc[]; students: Enrollment[]; nameOf: (uid: string) => string }) {
  const check = concept.check
  if (!check) return null
  const t = checkTally(docs, concept.id)
  return (
    <section aria-label="잠깐 확인" className="bg-canvas rounded-md" style={{ padding: '14px 18px', marginTop: 20, boxShadow: 'inset 0 0 0 2px #000' }}>
      <Caption>잠깐 확인</Caption>
      <p className="text-body" style={{ margin: '6px 0 8px', fontWeight: 480 }}>
        {check.prompt}
      </p>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {check.options.map((o, i) => (
          <li key={i} className="text-body" style={{ marginBottom: 4 }}>
            <span className="font-mono">{OPTION_MARK[i]}</span> {o}
          </li>
        ))}
      </ol>
      <details style={{ marginTop: 12 }}>
        <summary className="text-body" style={{ cursor: 'pointer', fontWeight: 480 }}>
          응답 {t.answered}/{students.length} ▸
        </summary>
        <p className="text-body-sm" style={{ margin: '8px 0', fontWeight: 480 }}>
          정답 {OPTION_MARK[check.answer]} · 맞힘 {t.counts[check.answer]}/{t.answered}
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {t.counts.map((n, i) => (
            <li key={i} className="text-body-sm" style={{ marginBottom: 4 }}>
              <strong className="font-mono">{OPTION_MARK[i]}</strong> {n}명{i === check.answer ? ' · 정답' : ''}
              {t.byOption[i].length > 0 ? <span style={{ opacity: 0.7 }}> — {t.byOption[i].map(nameOf).join(', ')}</span> : null}
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

/* ─────────────────────────── 강사 — 응답 n/N ▸ ─────────────────────────── */

function TeacherResponses({ block, field, docs, students, nameOf }: { block: Block; field: FieldDef; docs: ResponseDoc[]; students: Enrollment[]; nameOf: (uid: string) => string }) {
  const done = docs.filter((d) => isSubmitted(d) && payloadOf(d)[field.key] !== undefined)
  const members: MemberValue[] = done.map((d) => ({ uid: d.uid, nickname: nameOf(d.uid), value: payloadOf(d)[field.key], reason: block.reasonKey ? String(payloadOf(d)[block.reasonKey] ?? '') : undefined }))
  const missing = students.filter((s) => !done.some((d) => d.uid === s.uid))
  return (
    <details className="card">
      <summary className="text-body" style={{ cursor: 'pointer', fontWeight: 480 }}>
        {field.label} — 응답 {done.length}/{students.length} ▸
      </summary>
      <div style={{ marginTop: 12 }}>
        {field.kind === 'choice' || field.kind === 'multi' ? (
          <DistributionView docs={done} field={field} reasonKey={block.reasonKey} totalExpected={students.length} />
        ) : null}
        <ResponseTable field={field} members={members} />
        {missing.length > 0 ? <Caption>미제출 · {missing.map((s) => nameOf(s.uid)).join(', ')}</Caption> : null}
      </div>
    </details>
  )
}

function ResponseTable({ field, members }: { field: FieldDef; members: MemberValue[] }) {
  const cls = 'text-body-sm'
  if (members.length === 0)
    return (
      <p className="text-body-sm" style={{ opacity: 0.6, margin: 0 }}>
        아직 낸 사람이 없다.
      </p>
    )
  if (field.kind === 'allocation') {
    const rows = allocationAverage(field, members)
    return (
      <ScrollX>
        <table style={{ borderCollapse: 'collapse', minWidth: 480, marginTop: 8 }}>
          <thead>
            <tr>
              <th className="caption" style={{ textAlign: 'left', padding: '4px 12px 4px 0' }}>사람</th>
              {(field.items ?? []).map((it) => (
                <th key={it.id} className="caption" style={{ textAlign: 'left', padding: '4px 12px 4px 0' }}>
                  {it.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.uid} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                <td className={cls} style={{ padding: '4px 12px 4px 0', whiteSpace: 'nowrap' }}>{m.nickname}</td>
                {(field.items ?? []).map((it) => (
                  <td key={it.id} className="font-mono text-body-sm" style={{ padding: '4px 12px 4px 0' }}>
                    {String((m.value as Record<string, number> | undefined)?.[it.id] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="caption" style={{ padding: '4px 12px 4px 0' }}>평균</td>
              {rows.map((r) => (
                <td key={r.id} className="font-mono text-body-sm" style={{ padding: '4px 12px 4px 0', fontWeight: 600 }}>
                  {r.avg}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </ScrollX>
    )
  }
  if (field.kind === 'rank') {
    const rows = rankSum(field, members)
    return (
      <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
        {rows.map((r) => (
          <li key={r.id} className={cls}>
            {r.label} <span className="font-mono text-caption">합 {r.sum}</span>
          </li>
        ))}
      </ol>
    )
  }
  if (field.kind === 'sort') {
    const rows = sortTally(field, members)
    return (
      <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
        {rows.map((r) => (
          <li key={r.id} className={cls}>
            {r.label} — {(field.bins ?? []).map((b) => `${b.label} ${r.counts[b.id] ?? 0}`).join(' · ')}
            {r.split ? <Badge>갈림</Badge> : null}
          </li>
        ))}
      </ul>
    )
  }
  if (field.kind === 'choice' || field.kind === 'multi') {
    const rows = voteCounts(field, members)
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
        {rows.map((r) => (
          <li key={r.option} className={cls} style={{ marginBottom: 4 }}>
            <strong>{r.option}</strong> · {r.uids.map((u) => members.find((m) => m.uid === u)?.nickname ?? u).join(', ') || '—'}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
      {members.map((m) => (
        <li key={m.uid} className="rounded-md" style={{ padding: '8px 10px', marginBottom: 6, boxShadow: 'inset 0 0 0 1px #e6e6e6' }}>
          <span className="text-body-sm" style={{ fontWeight: 480 }}>
            {m.nickname}
          </span>
          <p className={cls} style={{ margin: '2px 0 0', whiteSpace: 'pre-line' }}>
            {typeof m.value === 'string' ? m.value : JSON.stringify(m.value)}
          </p>
        </li>
      ))}
    </ul>
  )
}

/* ─────────────────────────── 강사 — 올라온 글 n ▸ ─────────────────────────── */

function TeacherWall({ classId, lessonId, stepId, prompt }: { classId: string; lessonId: LessonId; stepId: string; prompt: string }) {
  const { repo } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  useEffect(() => {
    if (!repo) return
    return repo.watchPosts(classId, lessonId, stepId, setPosts)
  }, [repo, classId, lessonId, stepId])
  const list = useMemo(() => [...posts].sort((a, b) => b.createdAt - a.createdAt), [posts])
  return (
    <details className="card">
      <summary className="text-body" style={{ cursor: 'pointer', fontWeight: 480 }}>
        공유 — 올라온 글 {list.length} ▸
      </summary>
      <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.7 }}>
        {prompt}
      </p>
      {list.length === 0 ? (
        <p className="text-body-sm" style={{ opacity: 0.6, marginTop: 8 }}>
          아직 올라온 글이 없다.
        </p>
      ) : (
        <div style={{ columnWidth: 300, columnGap: 16, marginTop: 12 }}>
          {list.map((p) => (
            <WallCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </details>
  )
}

/* ─────────────────────────── 강사 — 모둠별 ▸ ─────────────────────────── */

function TeacherGroups({ classId, lessonId, stepId, group, field, groups, nameOf }: { classId: string; lessonId: LessonId; stepId: string; group: NonNullable<Step['activity']>['group']; field: FieldDef; groups: Array<{ id: string; name: string }>; nameOf: (uid: string) => string }) {
  const { repo } = useAuth()
  const [shares, setShares] = useState<GroupShare[]>([])
  const [values, setValues] = useState<GroupValue[]>([])
  useEffect(() => {
    if (!repo) return
    const a = repo.watchGroupShares(classId, lessonId, stepId, setShares)
    const b = repo.watchGroupValues(classId, lessonId, stepId, setValues)
    return () => {
      a()
      b()
    }
  }, [repo, classId, lessonId, stepId])
  return (
    <details className="card">
      <summary className="text-body" style={{ cursor: 'pointer', fontWeight: 480 }}>
        모둠별 ▸ <span className="caption">{shares.length}명 냈다</span>
      </summary>
      <div style={{ marginTop: 12 }}>
        <GroupBoard group={group} field={field} groups={groups} shares={shares} values={values} nameOf={nameOf} />
      </div>
    </details>
  )
}

export type { Participation }

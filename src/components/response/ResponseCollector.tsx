import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LessonId, Step } from '@/content/types'
import { useAuth } from '@/lib/auth'
import type { ResponseDoc } from '@/lib/types'
import { Button, Notice } from '@/components/ui'
import { LockedCard } from '@/components/stimulus/StimulusView'
import { FieldRenderer } from './fields'

/**
 * 답과 이유를 받는다.
 *
 * 지키는 것:
 *  - 입력 중 자동 저장. 새로고침해도 쓰던 것이 남는다.
 *  - 제출 전에는 다른 사람 응답이 보이지 않는다 (컨텍스트 15.2).
 *  - 제출은 버전으로 쌓인다. 최초 답을 지우지 않는다.
 *  - 이유 칸이 비면 제출되지 않는다.
 */

const AUTOSAVE_MS = 800

/** 전용 모듈 화면이 쓰는 값의 키. 일반 입력 칸과 섞이지 않게 따로 둔다. */
export const MODULE_KEY = '__module'

export function ResponseCollector({
  classId,
  lessonId,
  step,
  onSubmitted,
  renderModule,
  autosave = true,
  isGateOpen,
  children,
}: {
  classId: string
  lessonId: LessonId
  step: Step
  onSubmitted?: (payload: Record<string, unknown>) => void
  /**
   * 초안 자동 저장을 끈다.
   *
   * 「수업 후 이어서」는 같은 단계의 나머지 칸을 받는다 (3차 F.6).
   * 그래서 한 단계에 수집기가 둘 붙을 수 있는데, 둘 다 초안을 쓰면 서로 덮어쓴다.
   * 제출은 마지막 제출본을 불러와 통째로 다시 쓰므로 안전하다 — 초안만 끄면 된다.
   */
  autosave?: boolean
  /**
   * 칸을 여는 조건을 판정한다 (4차 H.4).
   *
   * 잠긴 칸은 입력 요소를 아예 그리지 않는다 — 회색 카드와 여는 조건만 남는다.
   * 화면에 두고 disabled 로만 막으면 학생에게는 같은 질문이 두 번 있는 것으로 보이고,
   * 실제로 그렇게 보였다. 필수 검사에서도 빠진다 — 열리지 않은 칸을 비웠다고 막으면 안 된다.
   */
  isGateOpen?: (gate: { type: string; of: string }) => boolean
  /**
   * 전용 모듈 화면. 모형 캔버스·데이터 스튜디오 같은 것.
   * 여기서 만든 값은 일반 입력 칸과 함께 같은 응답 버전에 저장되므로
   * VersionTimeline 에서 v1 → v2 비교가 그대로 된다.
   */
  renderModule?: (
    value: unknown,
    onChange: (v: unknown) => void,
    locked: boolean,
  ) => React.ReactNode
  /** 제출 뒤에만 보여 줄 것 (분포·의견 광장 등) */
  children?: (submitted: boolean, doc: ResponseDoc | null) => React.ReactNode
}) {
  const { user, repo } = useAuth()
  const [doc, setDoc] = useState<ResponseDoc | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [revising, setRevising] = useState(false)
  const [changedReason, setChangedReason] = useState('')
  const timer = useRef<number | null>(null)
  const hydrated = useRef(false)

  const uid = user?.uid ?? null

  useEffect(() => {
    if (!repo || !uid) return
    return repo.watchResponse(classId, lessonId, step.id, uid, (d) => {
      setDoc(d)
      if (hydrated.current) return
      hydrated.current = true
      // 초안이 있으면 초안을, 없으면 마지막 제출본을 불러온다.
      const latest = d?.versions?.[d.versions.length - 1]
      setValues(d?.draft?.payload ?? latest?.payload ?? {})
    })
  }, [repo, uid, classId, lessonId, step.id])

  const submitted = (doc?.latestV ?? 0) > 0

  /** 입력이 멈추면 자동 저장한다. */
  const scheduleSave = useCallback(
    (next: Record<string, unknown>) => {
      if (!repo || !uid || !autosave) return
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        void repo.saveDraft(classId, lessonId, step.id, uid, next).then(() => setSavedAt(Date.now()))
      }, AUTOSAVE_MS)
    },
    [repo, uid, classId, lessonId, step.id, autosave],
  )

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  function set(key: string, v: unknown) {
    const next = { ...values, [key]: v }
    setValues(next)
    setErrors((e) => ({ ...e, [key]: '' }))
    scheduleSave(next)
  }

  /** 지금 열려 있는 칸만. 잠긴 칸은 그리지도, 검사하지도 않는다. */
  function open(f: { gate?: { type: string; of: string } }): boolean {
    if (!f.gate) return true
    if (f.gate.type === 'afterSubmit') return submitted
    return isGateOpen ? isGateOpen(f.gate) : false
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    for (const f of step.fields) {
      if (!f.required || !open(f)) continue
      const v = values[f.key]
      if (f.kind === 'allocation') {
        const alloc = (v ?? {}) as Record<string, number>
        const sum = (f.items ?? []).reduce((s, it) => s + (Number(alloc[it.id]) || 0), 0)
        if (sum !== (f.total ?? 100)) {
          next[f.key] = `합계가 ${f.total ?? 100}이어야 합니다. 지금은 ${sum}입니다.`
        }
        continue
      }
      if (f.kind === 'multi') {
        if (!Array.isArray(v) || v.length === 0) next[f.key] = '하나 이상 골라 주세요.'
        continue
      }
      if (f.kind === 'quadrant') {
        const q = (v ?? {}) as Record<string, string>
        const empty = (f.quadrants ?? []).filter((x) => !q[x.id]?.trim())
        if (empty.length > 0) {
          next[f.key] = `${empty.map((x) => x.label).join(', ')} 칸이 비었습니다. 없으면 “없음”이라고 적어 주세요.`
        }
        continue
      }
      if (typeof v !== 'string' || v.trim().length === 0) {
        // 이유 칸은 특히 강하게 막는다. 선택만으로는 제출되지 않는다.
        next[f.key] = /reason|이유/.test(f.key + f.label)
          ? '이유를 한 줄이라도 적어야 제출됩니다.'
          : '이 칸을 채워 주세요.'
      }
    }
    setErrors(next)
    if (Object.keys(next).length > 0) {
      const first = document.querySelector('[aria-invalid="true"], [role="alert"]')
      first?.scrollIntoView({ block: 'center' })
    }
    return Object.keys(next).length === 0
  }

  async function submit() {
    if (!repo || !uid) return
    if (!validate()) return
    if (submitted && !changedReason.trim()) {
      setErrors((e) => ({ ...e, __changed: '무엇을 왜 바꿨는지(또는 왜 유지했는지) 적어 주세요.' }))
      return
    }
    await repo.submitResponse(classId, lessonId, step.id, uid, values, {
      /* 확신도는 더 이상 받지 않는다. 옛 문서에 남은 값은 그대로 둔다. */
      confidence: null,
      changedReason: submitted ? changedReason.trim() : null,
    })
    setRevising(false)
    setChangedReason('')
    onSubmitted?.(values)
  }

  const locked = submitted && !revising

  /**
   * 잠금을 풀고 첫 칸으로 데려간다.
   * 버튼이 화면 아래에 있어서, 풀어도 어디가 열렸는지 보이지 않으면 여전히 막힌 것 같다.
   */
  function startRevising() {
    setRevising(true)
    window.setTimeout(() => {
      const first = document.querySelector<HTMLElement>(
        '.flex.flex-col.gap-xl textarea:not([disabled]), .flex.flex-col.gap-xl input:not([disabled])',
      )
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      first?.focus()
    }, 60)
  }
  const versionCount = doc?.versions?.length ?? 0

  const savedLabel = useMemo(() => {
    if (!savedAt) return null
    const d = new Date(savedAt)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 자동 저장됨`
  }, [savedAt])

  const moduleSlot = renderModule
    ? renderModule(values[MODULE_KEY], (v) => set(MODULE_KEY, v), locked)
    : null

  // 입력 칸도 모듈도 없으면 그릴 것이 없다 (개념 카드 단계 등).
  if (step.fields.length === 0 && !renderModule) return <>{children?.(true, doc)}</>

  return (
    <div className="flex flex-col gap-lg">
      {/*
        잠긴 이유와 푸는 법을 칸 바로 위에서 말한다.
        제출하면 칸이 잠기는데, 화면이 그것을 말하지 않으면 눌러도 안 써지는 것만 보인다.
        「수정이 안 된다」로 읽힌다 — 실제로 그렇게 막혔다.
        푸는 버튼을 아래쪽에만 두지 않고 여기에도 둔다.
      */}
      {locked ? (
        <Notice tone="mint">
          <p className="text-body-sm" style={{ margin: 0 }}>
            제출했습니다. 지금까지 <span className="font-mono">v{versionCount}</span>개 버전이
            남아 있습니다. <strong>지금은 칸이 잠겨 있습니다.</strong> 고치려면 아래 버튼을
            누르세요 — <strong>처음 답은 지워지지 않고</strong> 새 버전으로 쌓입니다.
          </p>
          <div style={{ marginTop: 12 }}>
            <Button variant="secondary" onClick={startRevising}>
              고쳐 쓰기
            </Button>
          </div>
        </Notice>
      ) : null}

      {/* 전용 모듈 화면이 있으면 입력 칸보다 먼저 온다 */}
      {moduleSlot ? <div>{moduleSlot}</div> : null}

      <div className="flex flex-col gap-xl" aria-disabled={locked}>
        {step.fields.map((f) =>
          open(f) ? (
            <FieldRenderer
              key={f.key}
              def={f}
              value={values[f.key]}
              error={errors[f.key] || null}
              disabled={locked}
              onChange={(v) => set(f.key, v)}
            />
          ) : (
            <LockedCard key={f.key} title={f.label} message={f.gate!.lockedMessage} />
          ),
        )}
      </div>

      {submitted && revising ? (
        <div className="flex flex-col gap-xs">
          <label htmlFor="changed-reason" className="text-body-sm" style={{ fontWeight: 480 }}>
            무엇을 왜 바꿨는가 / 왜 유지했는가
            <span className="font-mono text-caption ml-xs">필수</span>
          </label>
          <textarea
            id="changed-reason"
            className="field"
            rows={2}
            value={changedReason}
            aria-invalid={errors.__changed ? true : undefined}
            onChange={(e) => {
              setChangedReason(e.target.value)
              setErrors((x) => ({ ...x, __changed: '' }))
            }}
          />
          {errors.__changed ? (
            <p role="alert" className="text-body-sm" style={{ fontWeight: 480 }}>
              ⚠ {errors.__changed}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-md no-print">
        {locked ? (
          <Button variant="secondary" onClick={startRevising}>
            고쳐 쓰기 — 새 버전으로 남습니다
          </Button>
        ) : (
          <Button onClick={() => void submit()}>
            {submitted ? `v${versionCount + 1}로 제출` : '제출하기'}
          </Button>
        )}
        {savedLabel && !locked ? (
          <span className="caption" role="status" aria-live="polite">
            {savedLabel}
          </span>
        ) : null}
        {!submitted ? (
          <span className="text-body-sm" style={{ opacity: 0.66 }}>
            제출하기 전에는 다른 사람의 답이 보이지 않습니다.
          </span>
        ) : null}
      </div>

      {/*
        「내 생각의 변화」 비교표를 학생 화면에서 뺐다.
        한 자리에서 v1·v2 를 연달아 쓰면 거의 같은 두 줄이 나란히 뜬다. 읽는 시간만 쓴다.
        ★ 버전은 그대로 쌓인다 — 18강에서 1강의 답을 다시 꺼내고,
          강사의 학습 분석이 「확신은 올랐는데 이유는 그대로」를 여기서 읽는다.
      */}

      {/* 제출한 사람에게만 열린다 */}
      {children?.(submitted, doc)}
    </div>
  )
}

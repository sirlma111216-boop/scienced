import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LessonId, Step } from '@/content/types'
import { useAuth } from '@/lib/auth'
import type { ResponseDoc } from '@/lib/types'
import { Button, Notice } from '@/components/ui'
import { LockedCard } from '@/components/stimulus/StimulusView'
import { FieldRenderer } from './fields'

/**
 * 답을 받는다 — 한 번만 (8차 원칙 2).
 *
 *  - 입력 중 자동 저장. 새로고침해도 쓰던 것이 남는다.
 *  - 제출 전에는 다른 사람 응답이 보이지 않는다.
 *  - 제출하면 칸이 잠긴다. 「고쳐 쓰기」·2차 응답·「무엇을 왜 바꿨는가」는 없다.
 *    이미 쌓인 버전은 지우지 않고 마지막 것을 읽기 전용으로 보인다.
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
  isGateOpen,
  children,
}: {
  classId: string
  lessonId: LessonId
  step: Step
  onSubmitted?: (payload: Record<string, unknown>) => void
  /** 칸을 여는 조건 판정 — 강사가 자료를 공개했는가 (afterReveal) */
  isGateOpen?: (gate: { type: string; of: string }) => boolean
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
  const [busy, setBusy] = useState(false)
  const timer = useRef<number | null>(null)
  const hydrated = useRef(false)

  const uid = user?.uid ?? null

  useEffect(() => {
    if (!repo || !uid) return
    /* 단계가 바뀌면 다시 불러온다 — 수집기는 자리가 같아 React 가 다시 쓴다 */
    hydrated.current = false
    setValues({})
    setErrors({})
    setSavedAt(null)
    return repo.watchResponse(classId, lessonId, step.id, uid, (d) => {
      setDoc(d)
      if (hydrated.current) return
      hydrated.current = true
      const latest = d?.versions?.[d.versions.length - 1]
      setValues(latest?.payload ?? d?.draft?.payload ?? {})
    })
  }, [repo, uid, classId, lessonId, step.id])

  const submitted = (doc?.latestV ?? 0) > 0

  const scheduleSave = useCallback(
    (next: Record<string, unknown>) => {
      if (!repo || !uid) return
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        repo
          .saveDraft(classId, lessonId, step.id, uid, next)
          .then(() => setSavedAt(Date.now()))
          .catch((err) => console.warn('[응답] 초안을 저장하지 못했다:', err))
      }, AUTOSAVE_MS)
    },
    [repo, uid, classId, lessonId, step.id],
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
        if (!Array.isArray(v) || v.length === 0) next[f.key] = '하나 이상 고르세요.'
        continue
      }
      if (f.kind === 'rank' || f.kind === 'sort') {
        if (f.kind === 'sort') {
          const s = (v ?? {}) as Record<string, string>
          const missing = (f.items ?? []).filter((it) => !s[it.id])
          if (missing.length > 0) next[f.key] = `카드 ${missing.length}장을 아직 놓지 않았습니다.`
        }
        continue
      }
      if (f.kind === 'quadrant') {
        const q = (v ?? {}) as Record<string, string>
        const empty = (f.quadrants ?? []).filter((x) => !q[x.id]?.trim())
        if (empty.length > 0) {
          next[f.key] = `${empty.map((x) => x.label).join(', ')} 칸이 비었습니다. 없으면 “없음”이라고 적으세요.`
        }
        continue
      }
      if (typeof v !== 'string' || v.trim().length === 0) {
        next[f.key] = /reason|이유/.test(f.key + f.label)
          ? '이유를 한 줄이라도 적어야 제출됩니다.'
          : '이 칸을 채우세요.'
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
    if (!repo || !uid || submitted) return
    if (!validate()) return
    setBusy(true)
    try {
      await repo.submitResponse(classId, lessonId, step.id, uid, values, {
        confidence: null,
        changedReason: null,
      })
      onSubmitted?.(values)
    } catch (err) {
      console.error('[응답] 제출하지 못했다:', err)
      setErrors((e) => ({ ...e, __submit: '제출하지 못했습니다. 잠시 뒤 다시 누르세요.' }))
    } finally {
      setBusy(false)
    }
  }

  const locked = submitted

  const savedLabel = useMemo(() => {
    if (!savedAt) return null
    const d = new Date(savedAt)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 자동 저장됨`
  }, [savedAt])

  const moduleSlot = renderModule
    ? renderModule(values[MODULE_KEY], (v) => set(MODULE_KEY, v), locked)
    : null

  if (step.fields.length === 0 && !renderModule) return <>{children?.(true, doc)}</>

  return (
    <div className="flex flex-col gap-lg">
      {locked ? (
        <Notice tone="mint">
          <p className="text-body-sm" style={{ margin: 0 }}>
            제출했습니다. 낸 답은 그대로 남고, 다시 쓰지 않습니다.
          </p>
        </Notice>
      ) : null}

      {moduleSlot ? <div>{moduleSlot}</div> : null}

      <div className="flex flex-col gap-xl" aria-disabled={locked}>
        {step.fields.map((f) =>
          !f.gate || open(f) ? (
            <FieldRenderer
              key={f.key}
              def={f}
              value={values[f.key]}
              error={errors[f.key] || null}
              disabled={locked}
              onChange={(v) => set(f.key, v)}
            />
          ) : (
            <LockedCard key={f.key} title={f.label} message={f.gate.lockedMessage} />
          ),
        )}
      </div>

      {!locked ? (
        <div className="flex flex-wrap items-center gap-md no-print">
          <Button disabled={busy} onClick={() => void submit()}>
            {busy ? '제출하는 중' : '제출하기'}
          </Button>
          {savedLabel ? (
            <span className="caption" role="status" aria-live="polite">
              {savedLabel}
            </span>
          ) : null}
          <span className="text-body-sm" style={{ opacity: 0.66 }}>
            제출하기 전에는 다른 사람의 답이 보이지 않습니다. 제출하면 다시 쓰지 않습니다.
          </span>
          {errors.__submit ? (
            <p role="alert" className="text-body-sm" style={{ fontWeight: 480, margin: 0 }}>
              {errors.__submit}
            </p>
          ) : null}
        </div>
      ) : null}

      {children?.(submitted, doc)}
    </div>
  )
}

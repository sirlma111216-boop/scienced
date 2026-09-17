import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { AppUser, Enrollment, ResponseDoc, RosterEntry } from '@/lib/types'
import { usePresent } from '@/components/ui'

/**
 * 진행 콘솔의 공용 부품 (7차).
 *
 *   NamesProvider / useNames  — 학생 이름. 기본은 강사가 적은 이름(rosterName), 없으면 닉네임.
 *                               발표 모드거나 「실명 가리기」가 켜지면 닉네임만 (작업 S).
 *   Overlay                   — 화면을 떠나지 않고 위에 덮는 판 (모둠 · 뽑기 · 개인 화면 · 크게 띄우기)
 *   latestOf / payloadOf      — 응답 문서에서 마지막 버전을 꺼낸다
 */

interface Names {
  /** 화면에 적을 이름 */
  nameOf: (uid: string) => string
  /** 닉네임만 (발표 모드 · 크게 띄우기) */
  nicknameOf: (uid: string) => string
  /** 지금 실명이 가려져 있는가 */
  masked: boolean
}

const NamesCtx = createContext<Names>({ nameOf: () => '이름 없음', nicknameOf: () => '이름 없음', masked: false })

export function NamesProvider({
  users,
  enrollments,
  roster,
  hideNames,
  children,
}: {
  users: AppUser[]
  enrollments: Enrollment[]
  roster: RosterEntry[]
  /** 진행 바의 「실명 가리기」 스위치 */
  hideNames: boolean
  children: ReactNode
}) {
  const { present } = usePresent()
  const value = useMemo<Names>(() => {
    const nick = new Map<string, string>()
    for (const u of users) if (u.nickname) nick.set(u.uid, u.nickname)
    for (const e of enrollments) if (e.nickname && !nick.has(e.uid)) nick.set(e.uid, e.nickname)
    const real = new Map(roster.filter((r) => r.rosterName?.trim()).map((r) => [r.uid, r.rosterName.trim()]))
    const masked = present || hideNames
    const nicknameOf = (uid: string) => nick.get(uid) ?? '이름 없음'
    /* 발표 모드에서는 실명을 읽지 않는다 — 스위치와 무관하게. 프로젝터에 실명이 나가면 안 된다 (작업 S). */
    const nameOf = (uid: string) => (masked ? nicknameOf(uid) : (real.get(uid) ?? nicknameOf(uid)))
    return { nameOf, nicknameOf, masked }
  }, [users, enrollments, roster, hideNames, present])
  return <NamesCtx.Provider value={value}>{children}</NamesCtx.Provider>
}

export function useNames(): Names {
  return useContext(NamesCtx)
}

/** 마지막 제출 버전. 제출 전(초안만)은 null. */
export function latestOf(doc: ResponseDoc | undefined | null) {
  if (!doc || !doc.versions || doc.versions.length === 0) return null
  return doc.versions[doc.versions.length - 1]
}

export function payloadOf(doc: ResponseDoc | undefined | null): Record<string, unknown> {
  return (latestOf(doc)?.payload ?? {}) as Record<string, unknown>
}

export function submitted(doc: ResponseDoc | undefined | null): boolean {
  return (doc?.latestV ?? 0) > 0
}

/**
 * 덮개 화면. 다른 경로로 가지 않는다 — 수업 중이기 때문이다 (R.3).
 * Esc 와 「닫기」로 닫는다. 열리면 제목으로 초점이 간다.
 */
export function Overlay({
  title,
  onClose,
  wide = false,
  children,
}: {
  title: string
  onClose: () => void
  wide?: boolean
  children: ReactNode
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflowY: 'auto' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="console-overlay-title"
        className="rounded-md"
        style={{ background: '#fff', width: '100%', maxWidth: wide ? 1180 : 860, padding: 24, boxShadow: '0 12px 48px rgba(0,0,0,0.25)' }}
      >
        <div className="flex items-center gap-md" style={{ marginBottom: 16 }}>
          <h2 id="console-overlay-title" ref={headingRef} tabIndex={-1} className="text-card-title" style={{ margin: 0, flex: 1, outline: 'none' }}>
            {title}
          </h2>
          <button type="button" className="btn-secondary" onClick={onClose} aria-label="닫기">
            닫기 (Esc)
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

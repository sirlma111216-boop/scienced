import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { AppUser, Enrollment, ResponseDoc, RosterEntry } from '@/lib/types'

/**
 * 진행 콘솔의 공용 부품 (7차).
 *
 *   NamesProvider / useNames  — 학생 이름. 기본은 강사가 적은 이름(rosterName), 없으면 닉네임.
 *                               「실명 가리기」가 켜지면 닉네임만 (작업 S). 수업 화면을 띄울 때 켠다.
 *   Overlay                   — 화면을 떠나지 않고 위에 덮는 판 (모둠 · 뽑기 · 개인 화면 · 크게 띄우기)
 *   latestOf / payloadOf      — 응답 문서에서 마지막 버전을 꺼낸다
 */

interface Names {
  /** 화면에 적을 이름 */
  nameOf: (uid: string) => string
  /** 닉네임만 */
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
  const value = useMemo<Names>(() => {
    const nick = new Map<string, string>()
    for (const u of users) if (u.nickname) nick.set(u.uid, u.nickname)
    for (const e of enrollments) if (e.nickname && !nick.has(e.uid)) nick.set(e.uid, e.nickname)
    const real = new Map(roster.filter((r) => r.rosterName?.trim()).map((r) => [r.uid, r.rosterName.trim()]))
    const masked = hideNames
    const nicknameOf = (uid: string) => nick.get(uid) ?? '이름 없음'
    /* 가리기가 켜지면 실명을 읽지 않는다. 프로젝터에 실명이 나가면 안 된다 (작업 S). */
    const nameOf = (uid: string) => (masked ? nicknameOf(uid) : (real.get(uid) ?? nicknameOf(uid)))
    return { nameOf, nicknameOf, masked }
  }, [users, enrollments, roster, hideNames])
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
  /*
   * 닫기는 늘 최신 것을 부르되 **의존 목록에는 넣지 않는다** (2026-09-22).
   * onClose 는 부모가 그릴 때마다 새로 만들어지는 함수라, 의존 목록에 두면 부모가 다시 그릴 때마다
   * 이 효과가 다시 돌아 제목으로 포커스를 끌어온다. 그러면 열어 둔 선택 목록(질문 고르개)이 그 자리에서 닫힌다.
   * 포커스를 옮기는 것은 덮개가 열릴 때 한 번이면 된다.
   */
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    headingRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [])
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

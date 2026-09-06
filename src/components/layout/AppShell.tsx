import { Link, NavLink, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import { Badge, Button, usePresent } from '@/components/ui'

/**
 * 상단바 + 단계 네비게이션 + 발표 모드 토글.
 *
 * 발표 모드는 별도 경로가 아니라 상단바 토글이다.
 * 저장 모드(실시간 공유 / 로컬 저장)를 항상 보여 준다. 강의 중에 어느 쪽인지 몰라서
 * 학생 화면이 안 보인다고 오해하는 일을 막는다.
 */

export interface StepNavItem {
  id: string
  label: string
  minutes: number
  done?: boolean
  /** 강사가 지금 보고 있는 단계 */
  instructorHere?: boolean
}

export function AppShell({
  children,
  steps,
  activeStepId,
  onSelectStep,
  title,
}: {
  children: ReactNode
  steps?: StepNavItem[]
  activeStepId?: string
  onSelectStep?: (id: string) => void
  title?: string
}) {
  const { user, mode, isInstructor, signOut } = useAuth()
  const { present, toggle } = usePresent()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <a href="#main" className="skip-link">
        본문으로 건너뛰기
      </a>

      <header
        className="sticky top-0 z-10 bg-canvas no-print"
        style={{ boxShadow: 'inset 0 -1px 0 #e6e6e6' }}
      >
        <div className="shell flex items-center gap-md" style={{ minHeight: 56 }}>
          <Link to="/" className="btn-tertiary" style={{ paddingLeft: 0 }}>
            <span style={{ fontWeight: 540 }}>Science Lesson Studio</span>
          </Link>

          {title ? (
            <span className="caption hidden md:inline" style={{ opacity: 0.6 }}>
              {title}
            </span>
          ) : null}

          <div className="flex-1" />

          <Badge>{mode === 'realtime' ? '실시간 공유' : '로컬 저장'}</Badge>

          <button
            type="button"
            className="tab"
            data-selected={present}
            aria-pressed={present}
            onClick={toggle}
          >
            발표 모드
          </button>

          {isInstructor ? (
            <Button variant="secondary" onClick={() => navigate('/instructor')}>
              강사
            </Button>
          ) : null}

          {user ? (
            <>
              <span className="text-body-sm hidden md:inline">{user.nickname || '이름 없음'}</span>
              <Button variant="tertiary" onClick={() => void signOut()}>
                나가기
              </Button>
            </>
          ) : null}
        </div>

        {steps && steps.length > 0 ? (
          <nav aria-label="수업 단계" className="shell" style={{ paddingBottom: 8 }}>
            <ol className="flex gap-xs scroll-x" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {steps.map((s, i) => {
                const selected = s.id === activeStepId
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="tab"
                      data-selected={selected}
                      aria-current={selected ? 'step' : undefined}
                      onClick={() => onSelectStep?.(s.id)}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <span className="font-mono text-caption" style={{ marginRight: 6 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {s.label}
                      <span className="font-mono text-caption" style={{ marginLeft: 6, opacity: 0.7 }}>
                        {s.minutes}분
                      </span>
                      {/* 상태를 색만으로 구분하지 않는다 */}
                      {s.done ? <span aria-label="제출함"> ✓</span> : null}
                      {s.instructorHere ? <span aria-label="강사 위치"> ●</span> : null}
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>
        ) : null}
      </header>

      <main id="main" className="flex-1 shell" style={{ paddingTop: 32, paddingBottom: 96 }}>
        {children}
      </main>

      <footer className="no-print" style={{ boxShadow: 'inset 0 1px 0 #f1f1f1' }}>
        <div
          className="shell flex flex-wrap items-center gap-md"
          style={{ paddingTop: 32, paddingBottom: 32 }}
        >
          <span className="caption">경희대학교 · 과학교육론 · 과학교과교수법</span>
          <span className="flex-1" />
          <NavLink to="/portfolio" className="caption">
            포트폴리오
          </NavLink>
          <NavLink to="/concept-map" className="caption">
            개념 지도
          </NavLink>
          <a
            className="caption"
            href="https://labbitory.com"
            target="_blank"
            rel="noreferrer noopener"
          >
            labbitory.com
          </a>
        </div>
      </footer>
    </div>
  )
}

/**
 * 강사가 단계를 옮겼을 때 뜨는 안내.
 * 학생 화면을 강제로 이동시키지 않는다. 안내와 이동 버튼만 띄운다.
 */
export function InstructorMovedBanner({
  label,
  onGo,
  onDismiss,
}: {
  label: string
  onGo: () => void
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      className="rounded-md bg-lilac text-ink flex flex-wrap items-center gap-md no-print"
      style={{ padding: '12px 16px', marginBottom: 24 }}
    >
      <span className="text-body-sm">강사가 「{label}」(으)로 이동했습니다.</span>
      <span className="flex-1" />
      <Button variant="secondary" onClick={onGo}>
        따라가기
      </Button>
      <Button variant="tertiary" onClick={onDismiss}>
        여기 남기
      </Button>
    </div>
  )
}

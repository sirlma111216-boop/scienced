import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useRef, useState, type ReactNode } from 'react'
import { buildShortName, sessionLengthShort } from '@/content/classes'
import { classSessionLength } from '@/lib/tiers'
import { useAuth } from '@/lib/auth'
import { Badge, Button, usePresent } from '@/components/ui'

/**
 * 상단바 + 단계 네비게이션 + 발표 모드 토글.
 *
 * 발표 모드는 별도 경로가 아니라 상단바 토글이다.
 * 로컬 저장으로 떨어졌을 때만 알린다. 정상일 때는 띄우지 않는다 —
 * 늘 맞는 말은 정보가 아니라 잡음이다.
 */

export interface StepNavItem {
  id: string
  label: string
  /** 알약에 실제로 그려지는 짧은 이름 (SHORT_TITLE_MAX 자 이하) */
  shortLabel: string
  done?: boolean
  /** 강사가 지금 보고 있는 단계 */
  instructorHere?: boolean
}

/**
 * 단계 알약 줄.
 *
 * tablist 로 만든다. 화살표 키로 단계를 옮길 수 있어야 하고,
 * 스크린 리더가 "3 / 5"를 읽어 줘야 한다. nav + 링크로는 그 둘이 안 된다.
 *
 * 선택된 알약만 tabIndex 0 을 갖는다(roving tabindex). 그래야 Tab 키 한 번에
 * 단계 줄을 지나갈 수 있다. 다섯 번 눌러야 본문에 닿으면 아무도 키보드를 쓰지 않는다.
 */
function StepTabs({
  steps,
  activeStepId,
  onSelectStep,
}: {
  steps: StepNavItem[]
  activeStepId?: string
  onSelectStep?: (id: string) => void
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const activeIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === activeStepId),
  )

  function move(to: number) {
    const next = steps[(to + steps.length) % steps.length]
    if (!next) return
    onSelectStep?.(next.id)
    refs.current.get(next.id)?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        return move(activeIndex + 1)
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        return move(activeIndex - 1)
      case 'Home':
        e.preventDefault()
        return move(0)
      case 'End':
        e.preventDefault()
        return move(steps.length - 1)
    }
  }

  return (
    <ol
      role="tablist"
      aria-label="수업 단계"
      aria-orientation="horizontal"
      className="step-tabs"
      onKeyDown={onKeyDown}
    >
      {steps.map((s, i) => {
        const selected = s.id === activeStepId
        return (
          <li key={s.id} role="presentation">
            <button
              type="button"
              role="tab"
              id={`step-tab-${s.id}`}
              aria-selected={selected}
              aria-controls={`step-panel-${s.id}`}
              tabIndex={selected ? 0 : -1}
              ref={(el) => {
                if (el) refs.current.set(s.id, el)
                else refs.current.delete(s.id)
              }}
              className="tab-step"
              onClick={() => onSelectStep?.(s.id)}
              /* 알약에는 짧은 이름만 들어간다. 전체 이름은 여기서 읽힌다. */
              aria-label={`${i + 1}단계 ${s.label}${s.done ? ' · 제출함' : ''}${
                s.instructorHere ? ' · 강사가 보고 있음' : ''
              }`}
              title={s.label}
            >
              {/* 소요 시간은 넣지 않는다. 진행 속도는 강의자가 그 자리에서 정한다 (3차 D). */}
              <span className="step-meta" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
                {/* 상태를 색만으로 구분하지 않는다 */}
                {s.done ? ' ✓' : ''}
                {s.instructorHere ? ' ●' : ''}
              </span>
              <span className="step-name step-name-short" aria-hidden="true">
                {s.shortLabel}
              </span>
              <span className="step-name step-name-full" aria-hidden="true">
                {s.label}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
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
  const { user, mode, isInstructor, signOut, currentClass, classes, myClassIds, selectClass } =
    useAuth()
  const { present, toggle } = usePresent()
  const navigate = useNavigate()
  const [switching, setSwitching] = useState(false)

  // 강사는 모든 클래스를, 학생은 자기가 등록한 클래스만 전환할 수 있다.
  const switchable = isInstructor ? classes : classes.filter((c) => myClassIds.includes(c.id))

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <a href="#main" className="skip-link">
        본문으로 건너뛰기
      </a>

      {/*
        상단바는 md 부터만 화면에 붙는다.
        375px 에서는 상단바 두 줄 + 단계 두 줄이 화면 높이의 4분의 1을 넘게 먹는다.
        늘 보이는 대신 볼 것을 가리는 머리글은 도움이 안 된다.
        좁은 화면에서는 스크롤에 따라 올라가고, 단계 이동은 본문 아래의 이전/다음이 맡는다.
      */}
      <header
        className="md:sticky md:top-0 z-10 bg-canvas no-print"
        style={{ boxShadow: 'inset 0 -1px 0 #e6e6e6' }}
      >
        {/*
          좁은 화면에서는 줄을 바꾼다.
          한 줄로 두면 375px 에서 「강사」·「나가기」가 화면 밖으로 나가고,
          그 두 버튼 때문에 페이지 전체에 가로 스크롤이 생긴다.
          단계 줄을 아무리 잘 접어도 상단바 하나가 그것을 되돌린다.
        */}
        <div
          className="shell flex flex-wrap items-center gap-xs md:gap-md"
          style={{ minHeight: 56, paddingTop: 6, paddingBottom: 6 }}
        >
          <Link to="/" className="btn-tertiary" style={{ paddingLeft: 0 }}>
            {/* 좁은 화면에서는 활자를 줄인다. 20px 로 두면 이름만으로 한 줄이 찬다. */}
            <span className="text-body-sm md:text-link" style={{ fontWeight: 540 }}>
              Science Lesson Studio
            </span>
          </Link>

          {/* 지금 어느 학기를 보고 있는지 항상 보인다. 여러 클래스면 눌러서 전환한다. */}
          {currentClass ? (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="tab"
                aria-haspopup="listbox"
                aria-expanded={switching}
                onClick={() => setSwitching((s) => !s)}
                style={{ fontSize: 13, minHeight: 36, padding: '4px 12px', whiteSpace: 'nowrap' }}
              >
                {buildShortName(currentClass)}
                {/* 어느 판으로 도는 클래스인지 강사가 늘 보여야 한다 (3차 E) */}
                {' · '}
                {sessionLengthShort(classSessionLength(currentClass))}
                {currentClass.status === 'archived' ? ' · 보관' : ''}
                <span aria-hidden> ▾</span>
              </button>
              {switching ? (
                <ul
                  role="listbox"
                  aria-label="클래스 전환"
                  className="bg-canvas rounded-md"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    minWidth: 280,
                    listStyle: 'none',
                    padding: 6,
                    margin: 0,
                    zIndex: 40,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.06), inset 0 0 0 1px #e6e6e6',
                  }}
                >
                  {switchable.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={c.id === currentClass.id}
                        className="btn-tertiary"
                        style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }}
                        onClick={() => {
                          void selectClass(c.id)
                          setSwitching(false)
                        }}
                      >
                        {c.id === currentClass.id ? '● ' : '○ '}
                        {c.displayName}
                      </button>
                    </li>
                  ))}
                  {/*
                    ★ 수업 등록으로 가는 길.
                      예전에는 처음 들어온 사람에게만 등록 화면이 열렸다.
                      클래스에서 내보내진 사람이 다시 들어와도 등록할 방법이 없었고,
                      다른 학기를 추가로 듣는 길도 없었다. 늘 여기서 갈 수 있게 둔다.
                  */}
                  <li style={{ marginTop: 4, paddingTop: 4, boxShadow: 'inset 0 1px 0 #e6e6e6' }}>
                    <Link
                      to="/class"
                      className="btn-tertiary"
                      style={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        textDecoration: 'none',
                      }}
                      onClick={() => setSwitching(false)}
                    >
                      + 수업 고르기 · 등록하기
                    </Link>
                  </li>
                </ul>
              ) : null}
            </div>
          ) : null}

          {title ? (
            <span className="caption hidden md:inline" style={{ opacity: 0.6 }}>
              {title}
            </span>
          ) : null}

          <div className="flex-1" />

          {/*
            정상일 때는 아무것도 띄우지 않는다. 「실시간 공유」는 늘 맞는 말이라 정보가 없다.
            로컬 저장으로 떨어졌을 때만 알린다 — 그때는 학생끼리 공유가 되지 않으므로
            강의 중에 그것을 모르면 화면이 왜 비었는지 알 길이 없다.
          */}
          {mode === 'local' ? <Badge>로컬 저장</Badge> : null}

          {/* 발표 모드는 화면을 띄워 놓고 쓰는 기능이다. 손전화 폭에서는 자리만 차지한다. */}
          <button
            type="button"
            className="tab hidden md:inline-flex"
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
          <div className="shell no-print" style={{ paddingBottom: 8 }}>
            <StepTabs steps={steps} activeStepId={activeStepId} onSelectStep={onSelectStep} />
          </div>
        ) : null}
      </header>

      <main id="main" className="flex-1 shell" style={{ paddingTop: 32, paddingBottom: 96 }}>
        {steps && steps.length > 0 && activeStepId ? (
          /* 선택된 단계의 화면만 그린다. tablist 의 짝이 되는 tabpanel 이다. */
          <div
            role="tabpanel"
            id={`step-panel-${activeStepId}`}
            aria-labelledby={`step-tab-${activeStepId}`}
          >
            {children}
          </div>
        ) : (
          children
        )}
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
          <NavLink to="/curriculum" className="caption">
            교육과정
          </NavLink>
          <NavLink to="/microteaching" className="caption">
            마이크로티칭
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

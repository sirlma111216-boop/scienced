import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react'

/**
 * 화면 기본 요소.
 *
 * DESIGN.md 를 따른다. 버튼은 전부 알약, 아이콘 버튼은 전부 원, 색 블록이 그림자를 대신한다.
 * 여기 없는 색·간격·반경은 쓰지 않는다.
 */

/* ─────────────────────────── 발표 모드 ─────────────────────────── */

interface PresentState {
  present: boolean
  toggle: () => void
}
const PresentCtx = createContext<PresentState>({ present: false, toggle: () => {} })

export function PresentProvider({ children }: { children: ReactNode }) {
  const [present, setPresent] = useState(false)

  useEffect(() => {
    // 글자를 1.35배로 키운다. 학생 화면에는 진행 팁과 토론 타이머가 뜨지 않는다.
    document.documentElement.style.setProperty('--present-scale', present ? '1.35' : '1')
    return () => document.documentElement.style.setProperty('--present-scale', '1')
  }, [present])

  const value = useMemo(() => ({ present, toggle: () => setPresent((p) => !p) }), [present])
  return <PresentCtx.Provider value={value}>{children}</PresentCtx.Provider>
}

export function usePresent() {
  return useContext(PresentCtx)
}

/* ─────────────────────────── 버튼 ─────────────────────────── */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'promo'
}

export function Button({ variant = 'primary', className = '', ...rest }: BtnProps) {
  const cls =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'secondary'
        ? 'btn-secondary'
        : variant === 'promo'
          ? 'btn-promo'
          : 'btn-tertiary'
  return <button type="button" className={`${cls} ${className}`} {...rest} />
}

export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} className={`btn-icon ${className}`} {...rest}>
      {children}
    </button>
  )
}

/* ─────────────────────────── 색 블록 ─────────────────────────── */

export type BlockTone = 'lime' | 'lilac' | 'cream' | 'pink' | 'mint' | 'coral' | 'navy'

const TONE_CLASS: Record<BlockTone, string> = {
  lime: 'bg-lime text-ink',
  lilac: 'bg-lilac text-ink',
  cream: 'bg-cream text-ink',
  pink: 'bg-pink text-ink',
  mint: 'bg-mint text-ink',
  coral: 'bg-coral text-ink',
  navy: 'bg-navy text-inverse-ink',
}

/**
 * 시그니처 색 블록.
 * 한 화면에 두 개를 나란히 두지 않는다. 사이에는 흰 바탕이 온다.
 */
export function ColorBlock({
  tone,
  children,
  className = '',
  as: Tag = 'section',
}: {
  tone: BlockTone
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'aside'
}) {
  return <Tag className={`block ${TONE_CLASS[tone]} ${className}`}>{children}</Tag>
}

/* ─────────────────────────── 텍스트 ─────────────────────────── */

export function Eyebrow({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <p className={`eyebrow ${className}`} style={style}>
      {children}
    </p>
  )
}

export function Caption({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <p className={`caption ${className}`} style={style}>
      {children}
    </p>
  )
}

/**
 * 상태 뱃지. 색만으로 구분하지 않는다 — 글자와 테두리를 함께 쓴다.
 */
export function Badge({
  children,
  solid = false,
  className = '',
}: {
  children: ReactNode
  solid?: boolean
  className?: string
}) {
  return <span className={`badge ${solid ? 'badge-solid' : ''} ${className}`}>{children}</span>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

/* ─────────────────────────── 입력 ─────────────────────────── */

export function Field({
  label,
  help,
  error,
  children,
  required,
}: {
  label: string
  help?: string
  error?: string | null
  children: (id: string, describedBy: string | undefined) => ReactNode
  required?: boolean
}) {
  const id = useId()
  const helpId = help ? `${id}-help` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [helpId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={id} className="text-body-sm" style={{ fontWeight: 480 }}>
        {label}
        {required ? (
          <span className="font-mono text-caption ml-xs align-middle">필수</span>
        ) : null}
      </label>
      {help ? (
        <p id={helpId} className="text-body-sm" style={{ opacity: 0.72 }}>
          {help}
        </p>
      ) : null}
      {children(id, describedBy)}
      {error ? (
        <p id={errId} role="alert" className="text-body-sm" style={{ fontWeight: 480 }}>
          ⚠ {error}
        </p>
      ) : null}
    </div>
  )
}

/** 여러 사람이 같은 화면을 보는 자리에서 쓰는 안내. */
export function Notice({
  tone = 'lime',
  children,
}: {
  tone?: BlockTone
  children: ReactNode
}) {
  return (
    <div className={`rounded-md ${TONE_CLASS[tone]}`} style={{ padding: '16px 24px' }}>
      {children}
    </div>
  )
}

/** 가로로 넘치는 표·그림을 감싼다. 본문이 가로로 밀리지 않게. */
export function ScrollX({ children }: { children: ReactNode }) {
  return <div className="scroll-x">{children}</div>
}

/** 화면 읽기 프로그램에만 읽히는 글. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0 0 0 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {children}
    </span>
  )
}

/** prefers-reduced-motion 을 존중한다. 추첨 애니메이션도 여기서 갈린다. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduced
}

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui'

/**
 * 게임 무대 「크게 보기」 (강의자 지시 2026-09-22 — 교육론 수업에서 구슬 레이스 화면이 작아 불편했다).
 *
 *   · 무대(iframe 을 감싼 요소)를 브라우저 전체 화면으로 키운다 — Fullscreen API. 우리 요소를 키우는 것이라
 *     활동 앱 쪽 허락(allowfullscreen)이 없어도 된다. Esc 나 「작게 보기」로 돌아온다.
 *   · 전체 화면을 못 쓰는 브라우저(iOS Safari 등)에서는 화면을 덮는 고정 판(position: fixed)으로 같은 효과를 낸다.
 *   · 이것은 수업 조작(단추 다섯)이 아니라 보기 조작이다 — verify:teach 가 「크게 보기」만 예외로 안다.
 *   · 무대 안의 iframe 은 다시 만들지 않는다 — 키우고 줄이는 동안 경기가 이어진다.
 */
export function StageZoom({ children, label = '게임 화면' }: { children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [big, setBig] = useState(false)
  /* Fullscreen API 가 없거나 거절돼 고정 판으로 키웠는가 */
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        setBig(false)
        setFallback(false)
      }
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  /* 고정 판일 때는 Esc 로 돌아온다 (전체 화면은 브라우저가 Esc 를 처리한다) */
  useEffect(() => {
    if (!fallback) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBig(false)
        setFallback(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fallback])

  const toggle = useCallback(async () => {
    const el = ref.current
    if (!el) return
    if (big) {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen()
        } catch (err) {
          console.warn('[크게 보기] 전체 화면을 끝내지 못했다:', err)
        }
      }
      setBig(false)
      setFallback(false)
      return
    }
    if (typeof el.requestFullscreen === 'function') {
      try {
        await el.requestFullscreen()
        setBig(true)
        setFallback(false)
        return
      } catch (err) {
        console.warn('[크게 보기] 전체 화면을 열지 못해 고정 판으로 키운다:', err)
      }
    }
    setBig(true)
    setFallback(true)
  }, [big])

  const cover = big && fallback
  return (
    <div
      ref={ref}
      style={
        cover
          ? { position: 'fixed', inset: 0, zIndex: 1000, background: '#080b14', display: 'flex', flexDirection: 'column' }
          : big
            ? { background: '#080b14', display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }
            : { position: 'relative' }
      }
    >
      <div style={big ? { display: 'flex', justifyContent: 'flex-end', padding: 8 } : { position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
        <Button variant="secondary" onClick={() => void toggle()} aria-label={big ? `${label} 작게 보기` : `${label} 크게 보기`}>
          {big ? '작게 보기' : '크게 보기'}
        </Button>
      </div>
      <div style={big ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : undefined} data-stage-zoom={big ? 'big' : 'small'}>
        {children}
      </div>
    </div>
  )
}

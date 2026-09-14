import { useEffect, useRef } from 'react'
import { LUMI_ORIGIN, embedUrl, type LumiGameResult, type LumiSnapshot } from '@/lib/lumi'

/**
 * 루미 런 iframe — 메시지 다리 하나.
 *
 *   · 부모 리스너를 먼저 등록하고 iframe 을 만든다. lumi:available 을 받으면 그때 준비된 config 로 lumi:mount 를 한 번 보낸다.
 *   · 같은 config 로 다시 mount 하지 않는다 — mount 는 게임을 destroy 하고 다시 만든다. mountKey 가 바뀔 때만 다시 보낸다.
 *   · event.origin === 게임 origin, event.source === iframe.contentWindow 를 확인한다. targetOrigin 은 언제나 게임 origin.
 *   · 화면을 떠나면 lumi:destroy 를 보내고 리스너·iframe 을 치운다. React Strict Mode 의 이중 마운트에도 방·소켓이 두 번 생기지 않는다 —
 *     정리 때 iframe 자체를 지우므로 다시 마운트되면 새 iframe 이 새로 available 을 보낸다.
 */
export function LumiFrame({
  config,
  mountKey,
  height = 640,
  createOnMount = false,
  onAvailable,
  onReady,
  onLobby,
  onStart,
  onResult,
  onError,
}: {
  config: Record<string, unknown>
  /** 이 값이 바뀔 때만 다시 mount 한다 (예: 활동 id + 역할 + 방 코드) */
  mountKey: string
  height?: number
  /** 마운트 직후 방을 만든다 — 강사의 「게임 방 만들기」 클릭에서만 true. 렌더링마다 방을 만들지 않는다 */
  createOnMount?: boolean
  onAvailable?: (info: { version: string; capabilities: string[] }) => void
  onReady?: (s: LumiSnapshot) => void
  /** 로비에서 참가자(접속 상태 포함)가 바뀔 때마다 — 콘솔의 「게임 연결 N명」이 이것으로 산다 */
  onLobby?: (s: LumiSnapshot) => void
  onStart?: (s: LumiSnapshot) => void
  onResult?: (r: LumiGameResult) => void
  /** 게임 서버가 거절한 이유(티켓 만료·방 없음 등) — 화면에 적어 「여는 중」에서 조용히 멈추지 않게 한다 */
  onError?: (message: string) => void
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const configRef = useRef(config)
  configRef.current = config
  const createOnMountRef = useRef(createOnMount)
  createOnMountRef.current = createOnMount
  const handlers = useRef({ onAvailable, onReady, onLobby, onStart, onResult, onError })
  handlers.current = { onAvailable, onReady, onLobby, onStart, onResult, onError }

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let mounted = false
    const post = (m: unknown) => frame.contentWindow?.postMessage(m, LUMI_ORIGIN)
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== LUMI_ORIGIN || e.source !== frame.contentWindow) return
      const m = e.data as { type?: string; value?: unknown; version?: string; capabilities?: string[] }
      if (!m || typeof m.type !== 'string') return
      if (m.type === 'lumi:available') {
        handlers.current.onAvailable?.({ version: String(m.version ?? ''), capabilities: Array.isArray(m.capabilities) ? m.capabilities : [] })
        if (!mounted) {
          mounted = true
          post({ type: 'lumi:mount', config: configRef.current })
          if (createOnMountRef.current) post({ type: 'lumi:create' })
        }
        return
      }
      if (m.type === 'lumi:ready') handlers.current.onReady?.(m.value as LumiSnapshot)
      if (m.type === 'lumi:lobby') handlers.current.onLobby?.(m.value as LumiSnapshot)
      if (m.type === 'lumi:start') handlers.current.onStart?.(m.value as LumiSnapshot)
      if (m.type === 'lumi:result') handlers.current.onResult?.(m.value as LumiGameResult)
      if (m.type === 'lumi:error') handlers.current.onError?.(String(m.value ?? ''))
    }
    window.addEventListener('message', onMessage)
    frame.src = embedUrl()
    return () => {
      window.removeEventListener('message', onMessage)
      try {
        post({ type: 'lumi:destroy' })
      } catch {
        /* 이미 떠난 창 */
      }
      frame.src = 'about:blank'
    }
    // mountKey 가 바뀔 때만 iframe 을 새로 연다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountKey])

  return (
    <iframe
      ref={frameRef}
      title="루미 런"
      allow="fullscreen"
      allowFullScreen
      style={{ width: '100%', height, border: 0, borderRadius: 16, background: '#fffdf7', display: 'block' }}
    />
  )
}

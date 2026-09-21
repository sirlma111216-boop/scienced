import { useEffect, useRef } from 'react'
import { MARBLE_ORIGIN, loadMarbleSdk, type MarbleHandle, type MarbleParticipant, type MarbleResult, type MarbleRule } from '@/lib/marble'

/**
 * 구슬 레이스 무대 — 활동 앱 iframe 하나.
 *
 *   · SDK 를 받아 `createMarbleRace({ mode: 'local' })` 를 만들고 **mount 는 한 번만** 한다.
 *     React Strict Mode 의 이중 마운트에서도 판이 둘 생기지 않게, 정리 때 destroy 하고 다시 만든다.
 *   · `ready` 를 받은 뒤에 맵·규칙·명단을 넣고 부모에게 조종간(MarbleHandle)을 넘긴다. 그 전에는 시작할 수 없다.
 *   · `error` 는 삼키지 않는다 — 부모가 화면에 적는다.
 *   · iframe 은 높이가 0 이면 검은 칸만 보인다. 감싸는 요소에 실제 높이를 준다.
 */
export function MarbleStage({
  mountKey,
  participants,
  mapId,
  rule,
  height = 560,
  onReady,
  onFinished,
  onError,
}: {
  /** 이 값이 바뀔 때만 다시 붙인다 (단계 + 시도 횟수) */
  mountKey: string
  participants: MarbleParticipant[]
  mapId: string
  rule: MarbleRule
  height?: number
  /** 활동 앱이 준비돼 맵·규칙·명단까지 들어간 뒤 — 조종간을 넘긴다 */
  onReady: (race: MarbleHandle) => void
  onFinished: (result: MarbleResult, serverVerified: boolean) => void
  onError: (message: string) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  /* 명단·설정은 최신 것을 쓰되, 바뀌었다고 iframe 을 다시 만들지는 않는다 */
  const latest = useRef({ participants, mapId, rule, onReady, onFinished, onError })
  latest.current = { participants, mapId, rule, onReady, onFinished, onError }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let ready = false
    let race: MarbleHandle | null = null
    const offs: Array<() => void> = []
    /*
     * 활동 앱은 자기 주소와 배포 주소(scienced.labbitory.com)에서만 iframe 으로 열린다 (frame-ancestors).
     * 그 밖의 주소에서는 브라우저가 막고 활동 앱은 아무 말도 하지 못한다 — 검은 칸으로 멈추지 않게 여기서 시간을 잰다.
     */
    const timer = window.setTimeout(() => {
      if (cancelled || ready) return
      latest.current.onError(
        `구슬 레이스가 열리지 않습니다. 이 주소(${window.location.origin})에서는 활동 앱이 iframe 을 허락하지 않을 수 있습니다 — 배포 주소에서 열어 보세요. 브라우저 콘솔의 Content Security Policy 오류를 함께 보면 확실합니다.`,
      )
    }, 8000)

    loadMarbleSdk()
      .then(({ createMarbleRace }) => {
        if (cancelled) return
        race = createMarbleRace({ activityOrigin: MARBLE_ORIGIN, mode: 'local', participants: latest.current.participants, title: '교실 구슬 레이스 — 발표자 뽑기', view: 'teacher', hideJoinUi: true })
        offs.push(
          race.on('ready', () => {
            const r = race
            if (!r || cancelled) return
            ready = true
            window.clearTimeout(timer)
            void (async () => {
              try {
                await r.setConfig({ mapId: latest.current.mapId, rule: latest.current.rule })
                await r.setParticipants(latest.current.participants)
                if (!cancelled) latest.current.onReady(r)
              } catch (err) {
                latest.current.onError(`활동 앱에 맵·명단을 넣지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`)
              }
            })()
          }),
        )
        offs.push(race.on('roundFinished', (p) => latest.current.onFinished(p?.result ?? {}, p?.serverVerified === true)))
        offs.push(race.on('error', (e) => latest.current.onError(`활동 앱 — ${e?.message ?? '알 수 없는 오류'}${e?.code ? ` (${e.code})` : ''}`)))
        race.mount(host)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[구슬 레이스] SDK 를 받지 못했다:', err)
        latest.current.onError(`구슬 레이스를 불러오지 못했습니다 — ${err instanceof Error ? err.message : String(err)}. 인터넷 연결을 확인하고 「게임 시작」을 다시 누르세요.`)
      })

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      for (const off of offs) off()
      race?.destroy()
      race = null
      host.replaceChildren()
    }
  }, [mountKey])

  return <div ref={hostRef} className="rounded-md" style={{ height, minHeight: 320, background: '#080b14', overflow: 'hidden' }} />
}

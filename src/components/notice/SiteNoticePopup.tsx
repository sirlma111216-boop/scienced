import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { activeNotices, noticeStorageKey } from '@/lib/notice'
import { Overlay } from '@/components/teach/names'
import { Caption } from '@/components/ui'

/**
 * 전체 공지 창 (강의자 지시 2026-10-02).
 *
 * 로그인한 사람이면 학생·강사 가리지 않고 본다. [닫기]나 Esc 로 끄면 그 기기에서는 다시 뜨지 않는다.
 * 닫은 기록은 이 브라우저에만 남는다 — 다른 기기에서 로그인하면 기간 안에는 한 번 더 뜬다.
 */
function readDismissed(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(noticeStorageKey(uid))
    const list: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [])
  } catch (err) {
    console.warn('[공지] 닫은 기록을 읽지 못했다 — 공지를 다시 띄운다:', err)
    return new Set()
  }
}

export function SiteNoticePopup() {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!uid) return
    setDismissed(readDismissed(uid))
    setReady(true)
  }, [uid])

  if (!uid || !ready) return null
  const notice = activeNotices(Date.now(), dismissed)[0]
  if (!notice) return null

  function close() {
    if (!uid || !notice) return
    const next = new Set(dismissed).add(notice.id)
    setDismissed(next)
    try {
      localStorage.setItem(noticeStorageKey(uid), JSON.stringify([...next]))
    } catch (err) {
      console.warn('[공지] 닫은 기록을 남기지 못했다 — 새로 고치면 공지가 다시 뜬다:', err)
    }
  }

  return (
    <Overlay title={notice.title} onClose={close}>
      {notice.body.map((line) => (
        <p key={line} className="text-body-lg" style={{ margin: '0 0 12px' }}>
          {line}
        </p>
      ))}
      <Caption>[닫기]를 누르면 이 기기에서는 다시 뜨지 않습니다.</Caption>
    </Overlay>
  )
}

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MT_SCHEDULE, mtDateLabel, mtOpenState } from '@shared/microteaching'
import { useAuth } from '@/lib/auth'
import { courseOf } from '@/lib/lesson-data'
import type { MtSlot } from '@/lib/types'
import { Overlay } from '@/components/teach/names'
import { Button, Caption } from '@/components/ui'

/**
 * 마이크로티칭 신청이 열리면 저절로 뜨는 창 (강의자 지시 2026-10-03).
 *
 * 강사가 정한 때가 되면 학생이 어느 화면에 있든 창이 뜨고 신청 화면으로 가는 단추가 있다.
 * 아직 신청하지 않은 학생에게만 뜬다 — 신청을 마치면 사라진다. [닫기]로 끄면 이 탭에서는 다시 안 뜨지만
 * 다음에 들어오면 또 뜬다. 신청 전에는 그치지 않는 것이 이 창의 일이다.
 * 열린 때가 지났는지는 15초마다 다시 본다 — 화면을 열어 둔 채 그 시각이 와도 뜬다.
 */
const key = (classId: string) => `sls.v1.mt-open.dismissed.${classId}`

export function MicroteachingOpenPopup() {
  const { repo, user, isInstructor, classId, currentClass } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())
  const [slots, setSlots] = useState<MtSlot[] | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const openAt = currentClass?.microteachingOpenAt
  const open = mtOpenState(openAt, now) === 'open'

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    if (!repo || !classId || !open || isInstructor) {
      setSlots(null)
      return
    }
    return repo.watchMtSlots(classId, setSlots)
  }, [repo, classId, open, isInstructor])
  useEffect(() => {
    if (!classId) return
    try {
      setDismissed(sessionStorage.getItem(key(classId)) === '1')
    } catch (err) {
      console.warn('[마이크로티칭] 닫은 기록을 읽지 못했다 — 창을 다시 띄운다:', err)
      setDismissed(false)
    }
  }, [classId])

  if (!user || isInstructor || !classId || !currentClass || !open || dismissed) return null
  if (location.pathname.startsWith('/microteaching/apply')) return null
  if (slots === null || slots.some((s) => s.uid === user.uid)) return null

  const schedule = MT_SCHEDULE[courseOf(currentClass)]
  const first = schedule.days[0].date
  const last = schedule.days[schedule.days.length - 1].date

  const cid = classId
  function close() {
    setDismissed(true)
    try {
      sessionStorage.setItem(key(cid), '1')
    } catch (err) {
      console.warn('[마이크로티칭] 닫은 기록을 남기지 못했다:', err)
    }
  }

  return (
    <Overlay title="마이크로티칭 발표 신청이 열렸습니다" onClose={close}>
      <p className="text-body-lg" style={{ margin: 0 }}>
        {schedule.title} — {mtDateLabel(first)}부터 {mtDateLabel(last)}까지 {schedule.days.length}번, 모두 {schedule.total}자리입니다.
      </p>
      <p className="text-body" style={{ marginTop: 12 }}>
        {schedule.minutes}. 한 사람이 한 자리를 고릅니다. 먼저 고른 사람이 그 자리를 갖습니다.
      </p>
      <div style={{ marginTop: 20 }}>
        <Button onClick={() => navigate('/microteaching/apply')}>신청 화면으로 가기</Button>
      </div>
      <Caption>신청을 마치면 이 창은 더 뜨지 않습니다. [닫기]를 누르면 다음에 들어올 때 다시 뜹니다.</Caption>
    </Overlay>
  )
}

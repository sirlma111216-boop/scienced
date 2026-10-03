import { useCallback, useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { courseOf } from '@/lib/lesson-data'
import type { Enrollment, MtSlot, RosterEntry } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { ClassAdminHeader } from '@/components/instructor/ClassAdmin'
import { ApplyBoard } from '@/components/microteaching/ApplyBoard'

/**
 * 마이크로티칭 발표 신청 (강의자 지시 2026-10-03).
 *
 *   /microteaching/apply                          학생 — 지금 클래스. 강사가 정한 때부터 열린다
 *   /instructor/class/:classId/microteaching     강사 — 클래스 관리의 한 탭. 언제나 보이고, 공개 시각을 정한다
 *
 * 저장과 자리 다툼은 서버 함수(functions/api/microteaching)가 맡는다. 이 화면은 자리 목록을 구독해 그리기만 한다.
 */
export function MicroteachingApply({ admin = false }: { admin?: boolean }) {
  const params = useParams()
  const { repo, user, isInstructor, classId: myClassId, classes } = useAuth()
  const classId = (admin ? params.classId : myClassId) ?? ''
  const cls = classes.find((c) => c.id === classId) ?? null
  const courseId = courseOf(cls)
  const [slots, setSlots] = useState<MtSlot[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!repo || !classId) return
    return repo.watchMtSlots(classId, setSlots)
  }, [repo, classId])
  useEffect(() => {
    if (!repo || !classId || !isInstructor) return
    const a = repo.watchEnrollments(classId, setEnrollments)
    const b = repo.watchRoster(classId, setRoster)
    return () => {
      a()
      b()
    }
  }, [repo, classId, isInstructor])
  /* 여는 때가 지나면 새로 고치지 않아도 열린다 */
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(t)
  }, [])

  const nameOf = useCallback((uid: string) => roster.find((r) => r.uid === uid)?.rosterName ?? '', [roster])

  if (admin && !isInstructor) return <Navigate to="/" replace />
  if (!classId) return <Navigate to={isInstructor ? '/instructor/classes' : '/class'} replace />

  async function run(what: string, fn: () => Promise<{ ok: boolean; message?: string }>) {
    if (!repo) return
    setBusy(true)
    setNote(null)
    try {
      const r = await fn()
      if (!r.ok) {
        console.warn(`[마이크로티칭] ${what} 실패:`, r.message)
        setNote(r.message ?? `${what}하지 못했습니다. 잠시 뒤 다시 누르세요.`)
      }
    } catch (err) {
      console.error(`[마이크로티칭] ${what} 중 오류:`, err)
      setNote(`${what}하지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const board = (
    <ApplyBoard
      courseId={courseId}
      uid={user?.uid ?? ''}
      isInstructor={isInstructor}
      openAt={cls?.microteachingOpenAt}
      now={now}
      slots={slots}
      enrollments={enrollments}
      nameOf={nameOf}
      busy={busy}
      note={note}
      onApply={(slotId) => void run('신청', () => repo!.applyMicroteaching(classId, slotId, user?.uid ?? ''))}
      onCancel={(uid) => void run('취소', () => repo!.cancelMicroteaching(classId, uid))}
      onSetOpenAt={(at) =>
        void run('공개 시각 저장', async () => {
          await repo!.updateClass(classId, { microteachingOpenAt: at })
          return { ok: true }
        })
      }
    />
  )

  if (admin) {
    return (
      <AppShell title="마이크로티칭 신청">
        <ClassAdminHeader classId={classId} cls={cls} here="microteaching" />
        <div style={{ marginTop: 24 }}>{board}</div>
      </AppShell>
    )
  }
  return <AppShell title="마이크로티칭 신청">{board}</AppShell>
}

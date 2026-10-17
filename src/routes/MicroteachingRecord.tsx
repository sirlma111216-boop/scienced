import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { courseOf } from '@/lib/lesson-data'
import type { MtApplication, MtPeerDoc, MtSlot } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { ClassAdminHeader } from '@/components/instructor/ClassAdmin'
import { useRosterNames } from '@/components/instructor/roster-names'
import { InstructorRecord, StudentRecord } from '@/components/microteaching/RecordBoard'

/**
 * 마이크로티칭 기록 (강의자 지시 2026-10-17).
 *
 *   /microteaching/record                        학생 — 내 지도안 · 피드백 · 영상 · 후기 · 동료 의견(익명), 다른 사람 수업에 의견 적기
 *   /instructor/class/:classId/mtrecord          강사 — 클래스 관리의 한 탭. 발표자마다 지도안 · 피드백 · 영상 올리기 · 동료 의견(이름)
 *
 * 쓰기는 전부 서버 함수(functions/api/microteaching/*)가 한다. 이 화면은 자리 · 신청 기록 · 내 동료 의견을 구독해 그린다.
 */
export function MicroteachingRecord({ admin = false }: { admin?: boolean }) {
  const params = useParams()
  const navigate = useNavigate()
  const { repo, user, isInstructor, classId: myClassId, classes } = useAuth()
  const classId = (admin ? params.classId : myClassId) ?? ''
  const cls = classes.find((c) => c.id === classId) ?? null
  const courseId = courseOf(cls)
  const [slots, setSlots] = useState<MtSlot[]>([])
  const [apps, setApps] = useState<Array<MtApplication & { uid: string }>>([])
  const [myPeer, setMyPeer] = useState<MtPeerDoc[]>([])
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!repo || !classId) return
    return repo.watchMtSlots(classId, setSlots)
  }, [repo, classId])
  useEffect(() => {
    if (!repo || !classId || !user) return
    return repo.watchMtApplications(classId, admin ? null : user.uid, setApps, (m) => setNote(m))
  }, [repo, classId, user, admin])
  useEffect(() => {
    if (!repo || !classId || !user || admin) return
    return repo.watchMtPeerMine(classId, user.uid, setMyPeer, (m) => setNote(m))
  }, [repo, classId, user, admin])
  const nameOf = useRosterNames(admin ? classId : '')

  if (admin && !isInstructor) return <Navigate to="/" replace />
  if (!classId) return <Navigate to={isInstructor ? '/instructor/classes' : '/class'} replace />

  if (admin) {
    return (
      <AppShell title="마이크로티칭 기록">
        <ClassAdminHeader classId={classId} cls={cls} here="mtrecord" />
        <div style={{ marginTop: 24 }}>
          <InstructorRecord classId={classId} courseId={courseId} slots={slots} apps={apps} nameOf={nameOf} note={note} />
        </div>
      </AppShell>
    )
  }
  return (
    <AppShell title="마이크로티칭 기록">
      <StudentRecord classId={classId} courseId={courseId} uid={user?.uid ?? ''} slots={slots} app={apps[0] ?? null} myPeer={myPeer} note={note} onGoApply={() => navigate('/microteaching/apply')} />
    </AppShell>
  )
}

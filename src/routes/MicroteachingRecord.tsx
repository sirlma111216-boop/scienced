import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { courseOf } from '@/lib/lesson-data'
import type { MtApplication, MtPeerDoc, MtSlot } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { ClassAdminHeader } from '@/components/instructor/ClassAdmin'
import { useRosterNames } from '@/components/instructor/roster-names'
import { MtBoard } from '@/components/microteaching/RecordBoard'

export function MicroteachingRecord({ admin: adminTab = false, view }: { admin?: boolean; view?: 'mine' | 'feedback' }) {
  const params = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const { repo, user, isInstructor, classId: myClassId, classes } = useAuth()
  /* 강사는 어느 주소로 들어와도 강사 화면 — 학생용 「자리를 신청하지 않았습니다」 · 의견 칸이 강사에게 보이면 안 된다 */
  const admin = adminTab || isInstructor
  const classId = (adminTab ? params.classId : myClassId) ?? ''
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

  if (adminTab && !isInstructor) return <Navigate to="/" replace />
  if (!classId) return <Navigate to={isInstructor ? '/instructor/classes' : '/class'} replace />

  if (isInstructor && view) return <Navigate to="/microteaching" replace />
  if (!admin && !view) {
    const who = search.get('who')
    return <Navigate to={who && who !== user?.uid ? '/microteaching/feedback?' + search.toString() : '/microteaching/mine'} replace />
  }

  const board = (
    <MtBoard
      key={JSON.stringify([classId, user?.uid, view])}
      personal={view === 'mine'}
      classId={classId}
      courseId={courseId}
      uid={user?.uid ?? ''}
      admin={admin}
      slots={slots}
      apps={apps}
      myPeer={myPeer}
      nameOf={nameOf}
      note={note}
      selectedUid={search.get('who')}
      onSelect={(u) => setSearch(u ? { who: u } : {}, { replace: true })}
      onGoApply={() => navigate('/microteaching/apply')}
    />
  )

  if (adminTab) {
    return (
      <AppShell title="마이크로티칭 기록">
        <ClassAdminHeader classId={classId} cls={cls} here="mtrecord" />
        <div style={{ marginTop: 24 }}>{board}</div>
      </AppShell>
    )
  }
  return <AppShell title={admin ? "마이크로티칭" : view === "mine" ? "나의 마이크로티칭" : "마이크로티칭 피드백"}>{board}</AppShell>
}

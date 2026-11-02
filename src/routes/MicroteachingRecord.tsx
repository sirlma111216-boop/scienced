import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { courseOf } from '@/lib/lesson-data'
import type { MtApplication, MtPeerDoc, MtSlot } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { ClassAdminHeader } from '@/components/instructor/ClassAdmin'
import { useRosterNames } from '@/components/instructor/roster-names'
import { MtBoard } from '@/components/microteaching/RecordBoard'

/**
 * 마이크로티칭 (강의자 지시 2026-10-17 · 2026-11-02 — 한 화면으로).
 *
 *   /microteaching                               아래 메뉴 「마이크로티칭」. 학생은 일정표(이름 · [수업지도안]) + 누른 사람에 따라 동료 의견 칸 또는 내 기록.
 *                                                강사가 이 주소로 들어오면 지금 고른 클래스의 강사 화면이다 — 학생 분기를 보이지 않는다 (강의자 지적 2026-11-02)
 *   /instructor/class/:classId/mtrecord          강사 — 클래스 관리의 한 탭. 같은 일정표 + 영상 올리기 · 피드백
 *
 * 누구를 눌렀는지는 주소의 ?who= 에 둔다 — 새로 고쳐도 그 사람이 열려 있다.
 * 쓰기는 전부 서버 함수(functions/api/microteaching/*)가 한다. 이 화면은 자리 · 신청 기록 · 내 동료 의견을 구독해 그린다.
 */
export function MicroteachingRecord({ admin: adminTab = false }: { admin?: boolean }) {
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

  const board = (
    <MtBoard
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
  return <AppShell title="마이크로티칭">{board}</AppShell>
}

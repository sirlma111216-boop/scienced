import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import type { Enrollment } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { ClassAdminHeader } from '@/components/instructor/ClassAdmin'
import { NewClassForm } from '@/components/instructor/NewClassForm'
import { Badge, Button, Caption, Card, Notice } from '@/components/ui'

/**
 * 강사 — 클래스 설정 (강의자 지시 2026-09-21).
 *
 * 학기에 한 번 쓰는 것만 있다: 수강 등록 · 참여 코드 · 보관 · 지우기 · 새 클래스.
 * 강사 홈에서 이 단추들을 빼고 여기로 모았다 — 홈은 차시 목록이어야 한다.
 */
export function InstructorClassSettings() {
  const { classId: classIdParam } = useParams()
  const classId = classIdParam ?? ''
  const navigate = useNavigate()
  const { repo, isInstructor, classes } = useAuth()
  const cls = classes.find((c) => c.id === classId) ?? null
  const [count, setCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!repo || !classId) return
    return repo.watchEnrollments(classId, (list: Enrollment[]) => setCount(list.filter((e) => e.status === 'active').length))
  }, [repo, classId])

  if (!isInstructor) return <Navigate to="/" replace />
  if (!classId) return <Navigate to="/instructor/classes" replace />

  const archived = cls?.status === 'archived'

  async function run(what: string, fn: () => Promise<void>) {
    setBusy(true)
    setNote(null)
    try {
      await fn()
    } catch (err) {
      console.error(`[클래스 설정] ${what} 하지 못했다:`, err)
      setNote(`${what} 하지 못했습니다 — ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell title="클래스 설정">
      <ClassAdminHeader classId={classId} cls={cls} here="settings" />

      {note ? (
        <p role="alert" className="text-body-sm" style={{ margin: '16px 0 0', fontWeight: 480 }}>
          ⚠ {note}
        </p>
      ) : null}

      <div style={{ marginTop: 24 }}>
        <Card>
          <h2 className="text-card-title" style={{ margin: 0 }}>
            수강 등록
          </h2>
          <div className="flex items-center gap-xs" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            {cls?.enrollmentOpen ? <Badge solid>등록 열림</Badge> : <Badge>등록 마감</Badge>}
            <Caption>참여 코드 {cls?.joinCode ?? '—'} · 수강생 {count}명</Caption>
          </div>
          <p className="text-body-sm" style={{ margin: '12px 0 0' }}>
            등록을 마감하면 새 학생이 이 클래스에 들어오지 못한다. 이미 등록한 학생은 그대로다.
          </p>
          <div className="flex gap-xs" style={{ marginTop: 12 }}>
            <Button variant="secondary" disabled={busy || archived || !cls} onClick={() => void run('등록 상태를 바꾸지', async () => repo?.updateClass(classId, { enrollmentOpen: !cls?.enrollmentOpen }))}>
              {cls?.enrollmentOpen ? '수강 등록 마감' : '등록 다시 열기'}
            </Button>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 24 }}>
        <Card>
          <h2 className="text-card-title" style={{ margin: 0 }}>
            보관
          </h2>
          <p className="text-body-sm" style={{ margin: '12px 0 0' }}>
            보관하면 읽기 전용이 된다. 학생도 강사도 새로 쓸 수 없고 지난 기록은 그대로 남는다. 학기가 끝나면 지우지 말고 보관한다.
          </p>
          <div className="flex gap-xs" style={{ marginTop: 12 }}>
            {archived ? (
              <Button variant="secondary" disabled={busy} onClick={() => void run('보관을 풀지', async () => repo?.updateClass(classId, { status: 'active' }))}>
                보관 해제
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={busy || !cls}
                onClick={() => {
                  if (!confirm('이 클래스를 보관합니다.\n\n보관하면 읽기 전용이 됩니다. 학생도 강사도 새 글을 쓸 수 없고,\n지난 기록은 그대로 볼 수 있습니다.\n\n계속할까요?')) return
                  void run('보관하지', async () => repo?.updateClass(classId, { status: 'archived' }))
                }}
              >
                보관
              </Button>
            )}
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 24 }}>
        <Card>
          <h2 className="text-card-title" style={{ margin: 0 }}>
            지우기
          </h2>
          <Notice tone="pink">
            <p className="text-body-sm" style={{ margin: 0 }}>
              지우면 이 클래스의 수강 등록 · 응답 · 의견 · 실명 명단 · 모둠 기록이 함께 사라진다. 되돌릴 수 없다. 기록을 남기려면 보관을 쓴다.
            </p>
          </Notice>
          <div className="flex gap-xs" style={{ marginTop: 12 }}>
            <Button
              variant="tertiary"
              disabled={busy || !cls}
              onClick={() => {
                const ok = confirm(`이 클래스를 지웁니다.\n\n${cls?.displayName ?? classId}\n\n` + (count > 0 ? `수강생 ${count}명의 응답·의견·실명 명단이 함께 지워집니다.\n` : '') + '되돌릴 수 없습니다.\n\n기록을 남기려면 「보관」을 쓰세요.')
                if (!ok) return
                void run('지우지', async () => {
                  await repo?.deleteClass(classId)
                  navigate('/instructor/classes')
                })
              }}
            >
              {busy ? '지우는 중…' : '이 클래스 지우기'}
            </Button>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 40 }} className="no-print">
        <h2 className="text-card-title" style={{ margin: '0 0 12px' }}>
          새 클래스
        </h2>
        {creating ? (
          <NewClassForm
            onCreated={(id) => {
              setCreating(false)
              navigate(`/instructor/class/${id}/settings`)
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <Button variant="tertiary" onClick={() => setCreating(true)}>
            + 새 클래스 만들기
          </Button>
        )}
      </div>
    </AppShell>
  )
}

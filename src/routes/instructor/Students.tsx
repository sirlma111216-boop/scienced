import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import type { AppUser, Participation } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, Card, Notice, ScrollX } from '@/components/ui'

/**
 * 수강생 관리.
 *
 * CSV(학번,이름) 업로드 → 서버가 Identity Toolkit 으로 계정을 만든다.
 * 초기 비밀번호는 학번이고, 학생은 첫 로그인 때 비밀번호와 닉네임을 정한다.
 *
 * 계정 생성·초기화는 전부 서버에서 한다. 이 화면은 요청만 보낸다.
 */
export function InstructorStudents() {
  const { repo, isInstructor, classId } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  const [participation, setParticipation] = useState<Participation[]>([])
  const [csv, setCsv] = useState('')
  const [log, setLog] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!repo) return
    const a = repo.watchUsers(setUsers)
    const b = classId ? repo.watchParticipation(classId, setParticipation) : () => {}
    return () => {
      a()
      b()
    }
    // classId 가 빠져 있었다. 클래스를 바꿔도 다시 구독하지 않아
    // 이전 학기의 참여 기록이 화면에 남았다. eslint 가 잡았다.
  }, [repo, classId])

  if (!isInstructor) return <Navigate to="/" replace />

  const students = users.filter((u) => u.role === 'student')

  const parsed = csv
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [studentId, name] = line.split(',').map((s) => s?.trim() ?? '')
      return { studentId, name }
    })
    .filter((r) => /^\d{4,}$/.test(r.studentId))

  async function importStudents() {
    setBusy(true)
    setLog(null)
    try {
      const res = await fetch('/api/admin/students/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ students: parsed }),
      })
      const data = (await res.json()) as { ok: boolean; message?: string; created?: number }
      setLog(
        data.ok
          ? `${data.created ?? 0}개 계정을 만들었습니다. 초기 비밀번호는 학번입니다.`
          : data.message || '가져오지 못했습니다.',
      )
    } catch {
      setLog('서버에 닿지 못했습니다. 로컬 저장 모드에서는 계정을 만들 수 없습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword(studentId: string) {
    if (!confirm(`${studentId} 의 비밀번호를 학번으로 되돌립니다. 계속할까요?`)) return
    try {
      const res = await fetch('/api/admin/students/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      const data = (await res.json()) as { ok: boolean; message?: string }
      setLog(data.ok ? '초기 비밀번호는 학번입니다.' : data.message || '초기화하지 못했습니다.')
    } catch {
      setLog('서버에 닿지 못했습니다.')
    }
  }

  return (
    <AppShell title="수강생 관리">
      <p className="eyebrow">강사</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        수강생
      </h1>

      <div style={{ marginTop: 32 }}>
        <Notice tone="cream">
          <p className="text-body-sm">
            화면에 보이는 이름은 학생이 정한 닉네임입니다. 실명은 이 화면에서만 보입니다.
            개인정보는 최소로 모으고, 학기 종료 후 정해진 기간이 지나면 삭제합니다.
          </p>
        </Notice>
      </div>

      <Card>
        <h2 className="text-card-title" style={{ margin: '0 0 12px' }}>
          CSV 가져오기
        </h2>
        <Caption>한 줄에 하나씩 · 학번,이름</Caption>
        <textarea
          className="field"
          rows={6}
          value={csv}
          placeholder={'2024123456,홍길동\n2024123457,김민수'}
          aria-label="학번과 이름 목록"
          onChange={(e) => setCsv(e.target.value)}
          style={{ marginTop: 8, resize: 'vertical' }}
        />
        <div className="flex items-center gap-md" style={{ marginTop: 12 }}>
          <Button disabled={busy || parsed.length === 0} onClick={() => void importStudents()}>
            {busy ? '만드는 중…' : `${parsed.length}명 계정 만들기`}
          </Button>
          <Caption>초기 비밀번호는 학번입니다.</Caption>
        </div>
        {log ? (
          <p role="status" className="text-body-sm" style={{ marginTop: 12, fontWeight: 480 }}>
            {log}
          </p>
        ) : null}
      </Card>

      <div style={{ marginTop: 32 }}>
        <Card>
          <div className="flex items-center gap-md" style={{ marginBottom: 12 }}>
            <h2 className="text-card-title" style={{ margin: 0 }}>
              명단
            </h2>
            <Badge>{students.length}명</Badge>
          </div>
          <ScrollX>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 680 }}>
              <thead>
                <tr>
                  {['학번', '닉네임', '실명', '발표 횟수', '글', '댓글', ''].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="caption"
                      style={{ textAlign: 'left', padding: '8px 16px 8px 0' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const p = participation.find((x) => x.uid === s.uid)
                  return (
                    <tr key={s.uid} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                      <td className="font-mono text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {s.studentId ?? '—'}
                      </td>
                      <td className="text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {s.nickname || '미설정'}
                      </td>
                      <td className="text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {s.displayName ?? '—'}
                      </td>
                      <td className="font-mono text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {p?.presentCount ?? 0}
                      </td>
                      <td className="font-mono text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {p?.postCount ?? 0}
                      </td>
                      <td className="font-mono text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {p?.commentCount ?? 0}
                      </td>
                      <td style={{ padding: '10px 0' }}>
                        <Button
                          variant="tertiary"
                          onClick={() => void resetPassword(s.studentId ?? '')}
                        >
                          비밀번호 초기화
                        </Button>
                      </td>
                    </tr>
                  )
                })}
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-body-sm" style={{ padding: 16, opacity: 0.6 }}>
                      아직 계정이 없습니다. 위에서 CSV 로 가져오세요.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </ScrollX>
          <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.72 }}>
            발표 횟수는 순위가 아니라 다음 추첨의 가중치에 쓰입니다. 적게 발표한 사람이 더 잘
            뽑힙니다.
          </p>
        </Card>
      </div>
    </AppShell>
  )
}

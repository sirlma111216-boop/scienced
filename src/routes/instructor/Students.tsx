import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { apiPost } from '@/lib/api'
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
  const { repo, isInstructor, classId, classes } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  const [participation, setParticipation] = useState<Participation[]>([])
  const [csv, setCsv] = useState('')
  const [log, setLog] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /* 학번으로 진단·되살리기·등록시키기 — 명단(users 문서)에 없는 계정도 다룬다 */
  const [repairId, setRepairId] = useState('')
  const [repairLog, setRepairLog] = useState<string | null>(null)
  const [repairBusy, setRepairBusy] = useState(false)
  const [enrollTo, setEnrollTo] = useState('')

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
      const data = await apiPost<{
        ok: boolean
        message?: string
        created?: number
        linked?: number
        failed?: number
        failures?: string[]
      }>('/api/admin/students/import', { students: parsed })

      if (!data.ok) {
        setLog(data.message || '가져오지 못했습니다.')
        return
      }

      /*
       * 서버는 줄마다 실패 이유를 돌려준다. 그것을 버리면 안 된다.
       * 「0개 계정을 만들었습니다」만 보이면 무엇이 잘못됐는지 알 길이 없다 —
       * 실제로 그 화면 앞에서 한참 막혔다. 이유는 서버가 이미 말하고 있었다.
       */
      const created = data.created ?? 0
      const linked = data.linked ?? 0
      const failed = data.failed ?? 0
      const lines: string[] = []
      if (created > 0) lines.push(`${created}명 계정을 새로 만들었습니다. 초기 비밀번호는 학번입니다.`)
      // 이미 있던 계정은 실패가 아니다. 명단만 맞춘 것이다.
      if (linked > 0) lines.push(`${linked}명은 이미 계정이 있어 명단만 맞췄습니다.`)
      if (created === 0 && linked === 0) lines.push('계정이 하나도 만들어지지 않았습니다.')
      if (failed > 0) {
        lines.push(`실패 ${failed}건:`)
        for (const f of data.failures ?? []) lines.push(`  · ${f}`)
      }
      setLog(lines.join('\n'))
    } finally {
      setBusy(false)
    }
  }

  async function repairStudent(mode: 'diagnose' | 'repair' | 'enroll') {
    const studentId = repairId.trim()
    if (!/^\d{4,}$/.test(studentId)) {
      setRepairLog('학번을 숫자로 적어 주세요.')
      return
    }
    const repair = mode === 'repair'
    if (repair && !confirm(`${studentId} 계정을 되살립니다 — users 문서를 채우고 비밀번호를 학번으로 되돌립니다. 응답은 건드리지 않습니다. 계속할까요?`)) return
    if (mode === 'enroll' && !enrollTo) {
      setRepairLog('등록시킬 클래스를 고르세요.')
      return
    }
    setRepairBusy(true)
    try {
      const data = await apiPost<{ ok: boolean; found?: boolean; report?: string; actions?: string[]; message?: string }>('/api/admin/students/repair', {
        studentId,
        repair,
        enrollClassId: mode === 'enroll' ? enrollTo : undefined,
      })
      const parts = [data.report ?? '', ...(data.actions ?? []).map((a) => `✓ ${a}`), data.message ?? ''].filter(Boolean)
      setRepairLog(parts.join('\n') || (data.ok ? '완료' : '실패'))
    } catch (err) {
      setRepairLog(`진단하지 못했습니다 — ${(err as Error).message}`)
    } finally {
      setRepairBusy(false)
    }
  }

  async function resetPassword(studentId: string) {
    if (!confirm(`${studentId} 의 비밀번호를 학번으로 되돌립니다. 계속할까요?`)) return
    const data = await apiPost('/api/admin/students/reset-password', { studentId })
    setLog(data.ok ? '초기 비밀번호는 학번입니다.' : data.message || '초기화하지 못했습니다.')
  }

  return (
    <AppShell title="계정 만들기">
      <p className="eyebrow">강사</p>
      {/*
        이 화면은 계정을 만드는 곳이다. 클래스별 명단은 따로 있다.
        둘 다 「수강생」이라 어느 쪽에 무엇이 있는지 찾지 못하는 일이 있었다.
      */}
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        수강생 계정 만들기
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
          <p
            role="status"
            className="text-body-sm"
            style={{ marginTop: 12, fontWeight: 480, whiteSpace: 'pre-line' }}
          >
            {log}
          </p>
        ) : null}
      </Card>

      {/*
        학번으로 진단·되살리기.
        아래 명단은 users 문서로 만든다 — 문서가 없거나 반쪽인 계정은 명단에 없어 「비밀번호 초기화」도 못 누른다.
        「계정은 있다는데 로그인도 등록도 안 되는」 학생이 실제로 있었다. 학번만 알면 여기서 본다.
      */}
      <div style={{ marginTop: 32 }}>
        <Card>
          <h2 className="text-card-title" style={{ margin: '0 0 12px' }}>
            학번으로 진단 · 되살리기
          </h2>
          <Caption>명단에 안 보이는 계정도 봅니다 — Auth 계정 · users 문서 · 클래스별 등록 상태</Caption>
          <div className="flex flex-wrap items-center gap-xs" style={{ marginTop: 8 }}>
            <input
              className="field"
              inputMode="numeric"
              placeholder="학번"
              aria-label="진단할 학번"
              value={repairId}
              onChange={(e) => setRepairId(e.target.value)}
              style={{ width: 180 }}
            />
            <Button variant="secondary" disabled={repairBusy} onClick={() => void repairStudent('diagnose')}>
              {repairBusy ? '보는 중…' : '진단'}
            </Button>
            <Button disabled={repairBusy} onClick={() => void repairStudent('repair')}>
              되살리기 — 문서 채우고 비밀번호 초기화
            </Button>
          </div>
          {/*
            강사가 학생을 클래스에 직접 넣는다.
            규칙상 등록 문서는 학생 본인만, 그것도 「수강 등록 열림」일 때만 만들 수 있어 강사가 넣을 길이 없었다.
            등록이 닫힌 클래스에 늦게 온 학생, 두 수업을 함께 듣는 학생을 여기서 넣는다.
          */}
          <div className="flex flex-wrap items-center gap-xs" style={{ marginTop: 8 }}>
            <select className="field" style={{ width: 260 }} value={enrollTo} onChange={(e) => setEnrollTo(e.target.value)} aria-label="등록시킬 클래스">
              <option value="">등록시킬 클래스 고르기</option>
              {classes
                .filter((c) => c.status === 'active')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
            </select>
            <Button variant="secondary" disabled={repairBusy || !enrollTo} onClick={() => void repairStudent('enroll')}>
              이 클래스에 등록시키기
            </Button>
            <Caption>수강 등록이 닫혀 있어도 넣습니다. 학생은 새로고침하면 그 클래스로 들어갑니다.</Caption>
          </div>
          {repairLog ? (
            <pre className="text-body-sm" role="status" style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
              {repairLog}
            </pre>
          ) : null}
        </Card>
      </div>

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

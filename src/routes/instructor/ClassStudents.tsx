import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { LESSONS } from '@/content/lessons'
import { apiPost } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Enrollment, ResponseDoc, RosterEntry } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, Card, ColorBlock, Notice, ScrollX } from '@/components/ui'

/**
 * 수강생 명단.
 *
 * 이름(실명)은 강사가 직접 적는다. 학생이 스스로 넣는 값이 아니다.
 * 이 이름은 `classes/{cid}/roster/{uid}` 에만 있고 규칙에서 강사만 읽을 수 있다.
 *
 * ★ 왜 별도 컬렉션인가
 *   Firestore 보안 규칙은 필드 단위 읽기 제어를 하지 못한다.
 *   enrollments 문서에 rosterName 을 넣고 화면에서만 가리면
 *   학생 브라우저로 문서 전체가 그대로 내려간다. 이 구조를 합치지 마라.
 *
 * 의견 광장·발표자 뽑기·분포·발표 모드 등 학생이 볼 수 있는 모든 곳에는 닉네임만 나온다.
 */

type SortKey = 'studentId' | 'name' | 'unsubmitted'

export function InstructorClassStudents() {
  const { classId } = useParams()
  const { repo, isInstructor, classes, selectClass } = useAuth()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [submitted, setSubmitted] = useState<Record<string, number>>({})
  const [sort, setSort] = useState<SortKey>('studentId')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const cls = classes.find((c) => c.id === classId) ?? null
  const readOnly = cls?.status === 'archived'
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeNote, setRemoveNote] = useState<string | null>(null)

  /*
   * 이 클래스에서만 내보낸다. 계정은 남는다.
   *
   * 등록 문서가 사라지면 보안 규칙이 곧바로 막으므로 그 학기 자료에 더는 닿지 못한다.
   * 이 클래스에 남긴 응답·의견 글·모둠 자리도 함께 치운다 —
   * 등록만 지우면 의견 광장에 그 사람 글이 이름을 달고 남는다.
   */
  async function remove(uid: string, who: string) {
    const ok = confirm(
      `${who} 님을 이 클래스에서 내보냅니다.

` +
        `· 이 클래스의 응답·의견 글·모둠 자리·실명이 지워집니다
` +
        `· 계정 자체는 지워지지 않습니다. 다른 학기 수강도 그대로입니다
` +
        `· 되돌릴 수 없습니다. 기록을 남기려면 「수강 종료」를 쓰세요`,
    )
    if (!ok || !repo) return
    setRemoving(uid)
    setRemoveNote(null)
    const t0 = Date.now()
    try {
      await repo.removeEnrollment(classId!, uid)
      setRemoveNote(`${who} 님을 내보냈습니다. (${Math.round((Date.now() - t0) / 100) / 10}초)`)
    } catch (err) {
      // 삼키지 않는다. 화면에는 다음에 할 일을, 콘솔에는 이유를 남긴다.
      console.error('[내보내기] 실패:', err)
      setRemoveNote('내보내지 못했습니다. 잠시 뒤 다시 눌러 보세요.')
    } finally {
      setRemoving(null)
    }
  }

  useEffect(() => {
    if (classId) void selectClass(classId)
  }, [classId, selectClass])

  useEffect(() => {
    if (!repo || !classId) return
    const a = repo.watchEnrollments(classId, setEnrollments)
    const b = repo.watchRoster(classId, setRoster)
    return () => {
      a()
      b()
    }
  }, [repo, classId])

  /** 제출 현황 — 공개된 차시의 단계 수 대비 몇 개를 냈는가 */
  useEffect(() => {
    if (!repo || !classId) return
    const unsubs: Array<() => void> = []
    const tally: Record<string, Set<string>> = {}
    for (const l of LESSONS) {
      for (const s of l.steps) {
        unsubs.push(
          repo.watchAllResponses(classId, l.id, s.id, (docs: ResponseDoc[]) => {
            for (const d of docs) {
              if ((d.versions?.length ?? 0) === 0) continue
              tally[d.uid] = tally[d.uid] ?? new Set()
              tally[d.uid].add(`${l.id}/${s.id}`)
            }
            setSubmitted(
              Object.fromEntries(Object.entries(tally).map(([uid, set]) => [uid, set.size])),
            )
          }),
        )
      }
    }
    return () => unsubs.forEach((u) => u())
  }, [repo, classId])

  const nameOf = useCallback(
    (uid: string) => roster.find((r) => r.uid === uid)?.rosterName ?? '',
    [roster],
  )

  const rows = useMemo(() => {
    const list = enrollments.filter((e) => e.status === 'active')
    const withName = list.map((e) => ({ e, name: nameOf(e.uid), count: submitted[e.uid] ?? 0 }))
    switch (sort) {
      case 'name':
        return withName.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      case 'unsubmitted':
        return withName.sort((a, b) => a.count - b.count)
      default:
        return withName.sort((a, b) =>
          (a.e.studentId ?? '').localeCompare(b.e.studentId ?? '', 'ko'),
        )
    }
  }, [enrollments, nameOf, submitted, sort])

  const missingNames = rows.filter((r) => !r.name.trim()).length

  async function saveName(uid: string) {
    if (!repo || !classId) return
    const v = drafts[uid]
    if (v === undefined) return
    await repo.setRosterEntry(classId, uid, { rosterName: v.trim() })
    setDrafts((d) => {
      const next = { ...d }
      delete next[uid]
      return next
    })
  }

  /**
   * 붙여넣기 입력.
   * `학번⇥이름` 여러 줄을 받아 학번을 맞춰 한 번에 채운다.
   * 명단이 엑셀에 있을 때 한 번에 끝난다.
   */
  async function applyPaste() {
    if (!repo || !classId) return
    const lines = pasteText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    let matched = 0
    const unmatched: string[] = []
    for (const line of lines) {
      const [sid, ...rest] = line.split(/[\t,]/).map((s) => s.trim())
      const name = rest.join(' ').trim()
      if (!sid || !name) continue
      const target = enrollments.find((e) => e.studentId === sid)
      if (!target) {
        unmatched.push(sid)
        continue
      }
      await repo.setRosterEntry(classId, target.uid, { rosterName: name })
      matched++
    }
    setMessage(
      `${matched}명 이름을 채웠습니다.` +
        (unmatched.length > 0
          ? ` 명단에 없는 학번 ${unmatched.length}개는 건너뛰었습니다: ${unmatched.slice(0, 5).join(', ')}${unmatched.length > 5 ? '…' : ''}`
          : ''),
    )
    setPasteText('')
    setPasteOpen(false)
  }

  async function resetPassword(studentId: string | null) {
    if (!studentId) return
    if (!confirm(`${studentId} 의 비밀번호를 학번으로 되돌립니다. 계속할까요?`)) return
    const data = await apiPost('/api/admin/students/reset-password', { studentId })
    setMessage(data.ok ? '초기 비밀번호는 학번입니다.' : data.message || '초기화하지 못했습니다.')
  }

  if (!isInstructor) return <Navigate to="/" replace />
  if (!classId) return <Navigate to="/instructor/classes" replace />

  return (
    <AppShell title="수강생 명단">
      <p className="eyebrow">강사</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        수강생
      </h1>
      <p className="text-body-lg" style={{ marginTop: 12 }}>
        {cls?.displayName ?? classId}
      </p>

      <div style={{ marginTop: 24 }}>
        <Notice tone="cream">
          <p className="text-body-sm" style={{ margin: 0 }}>
            <strong>이 이름은 강사 화면에만 보입니다.</strong> 의견 광장, 발표자 뽑기, 분포, 발표
            모드 등 학생이 볼 수 있는 곳에는 닉네임만 나갑니다. 실명은 학생 브라우저로 내려가지
            않습니다.
          </p>
        </Notice>
      </div>

      {readOnly ? (
        <div style={{ marginTop: 16 }}>
          <Notice tone="pink">
            <p className="text-body-sm" style={{ margin: 0 }}>
              보관된 클래스입니다. 읽기만 됩니다.
            </p>
          </Notice>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-xs no-print" style={{ marginTop: 32 }}>
        <Badge>{rows.length}명</Badge>
        {missingNames > 0 ? <Badge solid>이름 없음 {missingNames}명</Badge> : null}
        <span className="flex-1" />
        {(
          [
            ['studentId', '학번순'],
            ['name', '이름순'],
            ['unsubmitted', '미제출자 먼저'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className="tab"
            data-selected={sort === k}
            aria-pressed={sort === k}
            onClick={() => setSort(k)}
            style={{ fontSize: 14, minHeight: 40, padding: '6px 14px' }}
          >
            {label}
          </button>
        ))}
        <Button variant="secondary" disabled={readOnly} onClick={() => setPasteOpen((p) => !p)}>
          이름 붙여넣기
        </Button>
      </div>

      {pasteOpen ? (
        <div style={{ marginTop: 16 }}>
          <Card>
            <Caption>엑셀에서 「학번 이름」 두 열을 복사해 그대로 붙여 넣으세요</Caption>
            <textarea
              className="field"
              rows={6}
              value={pasteText}
              placeholder={'2024123456\t홍길동\n2024123457\t김민수'}
              aria-label="학번과 이름 붙여넣기"
              onChange={(e) => setPasteText(e.target.value)}
              style={{ marginTop: 8, resize: 'vertical', fontFamily: 'JetBrains Mono, monospace' }}
            />
            <div className="flex items-center gap-md" style={{ marginTop: 12 }}>
              <Button disabled={!pasteText.trim()} onClick={() => void applyPaste()}>
                학번을 맞춰 채우기
              </Button>
              <Caption>탭 또는 쉼표로 나뉜 두 열을 읽습니다</Caption>
            </div>
          </Card>
        </div>
      ) : null}

      {message ? (
        <p role="status" className="text-body-sm" style={{ marginTop: 16, fontWeight: 480 }}>
          {message}
        </p>
      ) : null}

      {removeNote ? (
        <p role="status" className="text-body-sm" style={{ marginTop: 16, fontWeight: 480 }}>
          {removeNote}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div style={{ marginTop: 48 }}>
          <ColorBlock tone="cream">
            <p className="text-subhead" style={{ margin: 0 }}>
              아직 등록한 수강생이 없습니다. 학생이 로그인해 이 클래스를 고르면 여기에 나타납니다.
              {cls?.requireJoinCode ? ` 참여 코드는 ${cls.joinCode} 입니다.` : ''}
            </p>
          </ColorBlock>
        </div>
      ) : (
        <ScrollX>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 940, marginTop: 24 }}>
            <thead>
              <tr>
                {['학번', '이름', '닉네임', '모둠', '등록일', '최근 접속', '제출', '관리'].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className="caption"
                      style={{ textAlign: 'left', padding: '8px 16px 8px 0' }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, name, count }) => {
                const draft = drafts[e.uid]
                const empty = !name.trim() && !draft?.trim()
                return (
                  <tr key={e.uid} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                    <td className="font-mono text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                      {e.studentId ?? '—'}
                    </td>
                    <td style={{ padding: '10px 16px 10px 0' }}>
                      {/* 셀을 눌러 바로 고치고, 포커스가 빠지면 저장한다 */}
                      <input
                        className="field"
                        value={draft ?? name}
                        disabled={readOnly}
                        aria-label={`${e.studentId ?? e.uid} 의 이름`}
                        placeholder={empty ? '이름을 적어 주세요' : ''}
                        onChange={(ev) =>
                          setDrafts((d) => ({ ...d, [e.uid]: ev.target.value }))
                        }
                        onBlur={() => void saveName(e.uid)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur()
                        }}
                        style={{
                          minHeight: 40,
                          padding: '6px 10px',
                          width: 140,
                          // 색만이 아니라 테두리 굵기로도 표시한다
                          boxShadow: empty
                            ? 'inset 0 0 0 2px #000'
                            : 'inset 0 0 0 1px #e6e6e6',
                        }}
                      />
                      {empty ? (
                        <span className="font-mono text-caption" style={{ display: 'block' }}>
                          미입력
                        </span>
                      ) : null}
                    </td>
                    <td className="text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                      {e.nickname || '미설정'}
                    </td>
                    <td className="text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                      {e.groupId ?? '—'}
                    </td>
                    <td className="text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                      {new Date(e.joinedAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                      {e.lastSeenAt
                        ? new Date(e.lastSeenAt).toLocaleDateString('ko-KR')
                        : '—'}
                    </td>
                    <td className="font-mono text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                      {count}
                    </td>
                    <td style={{ padding: '10px 0' }}>
                      <div className="flex flex-wrap gap-xxs">
                        <Button
                          variant="tertiary"
                          disabled={readOnly}
                          onClick={() => void resetPassword(e.studentId)}
                        >
                          비밀번호 초기화
                        </Button>
                        <Button
                          variant="tertiary"
                          disabled={readOnly}
                          onClick={() => {
                            const g = prompt('모둠 이름', e.groupId ?? '')
                            if (g === null) return
                            void repo?.updateEnrollment(classId, e.uid, {
                              groupId: g.trim() || null,
                            })
                          }}
                        >
                          모둠
                        </Button>
                        <Button
                          variant="tertiary"
                          disabled={readOnly}
                          onClick={() => {
                            if (!confirm('이 학생의 수강을 종료합니다. 명단에서 내려가고 기록은 남습니다.')) return
                            void repo?.updateEnrollment(classId, e.uid, { status: 'ended' })
                          }}
                        >
                          수강 종료
                        </Button>
                        {/*
                          내보내기 — 계정은 그대로 두고 이 클래스에서만 뺀다.
                          시험용으로 만든 계정을 치우거나 잘못 등록한 사람을 뺄 때 쓴다.
                          무엇이 사라지는지 확인 문구에 그대로 적는다. 되돌릴 수 없다.
                        */}
                        <Button
                          variant="tertiary"
                          disabled={readOnly || removing === e.uid}
                          onClick={() => void remove(e.uid, nameOf(e.uid) || e.nickname)}
                        >
                          {removing === e.uid ? '내보내는 중…' : '내보내기'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollX>
      )}

      <p className="text-body-sm" style={{ marginTop: 24, opacity: 0.72 }}>
        제출 수는 순위가 아닙니다. 아직 손대지 않은 단계를 찾는 데 씁니다.
      </p>
    </AppShell>
  )
}

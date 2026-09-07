import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, Card, ColorBlock, Notice } from '@/components/ui'

/**
 * 클래스 선택.
 *
 * 로그인 → 비밀번호 재설정 → 닉네임 설정 다음에 온다.
 * 클래스를 고르기 전에는 다른 화면에 갈 수 없다 (App.tsx 의 Guard).
 *
 * 목록에는 모집 중인 클래스만 보인다. 이미 등록한 클래스는 위에 따로 모은다.
 */
export function ClassSelect() {
  const { user, loading, classes, myClassIds, selectClass, enrollIn, isInstructor } = useAuth()
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mine = useMemo(
    () => classes.filter((c) => myClassIds.includes(c.id)),
    [classes, myClassIds],
  )
  const open = useMemo(
    () =>
      classes.filter(
        (c) => !myClassIds.includes(c.id) && c.status === 'active' && c.enrollmentOpen,
      ),
    [classes, myClassIds],
  )

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.mustResetPassword) return <Navigate to="/reset-password" replace />

  async function join(classId: string) {
    setBusy(classId)
    setError(null)
    try {
      await enrollIn(classId, codes[classId])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <AppShell title="클래스 선택">
      <p className="eyebrow">시작하기</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        어느 수업으로 들어갈까요
      </h1>
      <p className="text-subhead" style={{ marginTop: 16, maxWidth: 700 }}>
        수업은 학기마다 따로 열립니다. 고른 클래스 안에서만 응답과 의견이 오갑니다.
      </p>

      {error ? (
        <p role="alert" className="text-body" style={{ marginTop: 24, fontWeight: 480 }}>
          ⚠ {error}
        </p>
      ) : null}

      {mine.length > 0 ? (
        <section style={{ marginTop: 48 }}>
          <div className="flex items-baseline gap-md" style={{ marginBottom: 16 }}>
            <h2 className="text-card-title" style={{ margin: 0 }}>
              내 클래스
            </h2>
            <Caption>{mine.length}개</Caption>
          </div>
          <div className="flex flex-col gap-md">
            {mine.map((c) => (
              <Card key={c.id}>
                <div className="flex flex-wrap items-center gap-md">
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <p className="text-body" style={{ margin: 0, fontWeight: 480 }}>
                      {c.displayName}
                    </p>
                    {c.status === 'archived' ? (
                      <Caption>보관된 학기 · 읽기 전용</Caption>
                    ) : null}
                  </div>
                  <Button onClick={() => void selectClass(c.id)}>들어가기</Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ marginTop: 48 }}>
        <div className="flex items-baseline gap-md" style={{ marginBottom: 16 }}>
          <h2 className="text-card-title" style={{ margin: 0 }}>
            수강 등록할 수 있는 클래스
          </h2>
          <Caption>{open.length}개</Caption>
        </div>

        {open.length === 0 ? (
          <ColorBlock tone="cream">
            <p className="text-subhead" style={{ margin: 0 }}>
              {mine.length > 0
                ? '더 등록할 수 있는 클래스가 없습니다.'
                : '지금 등록할 수 있는 클래스가 없습니다. 강사에게 문의해 주세요.'}
            </p>
          </ColorBlock>
        ) : (
          <div className="flex flex-col gap-md">
            {open.map((c) => (
              <Card key={c.id}>
                <div className="flex flex-wrap items-center gap-md">
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <p className="text-body" style={{ margin: 0, fontWeight: 480 }}>
                      {c.displayName}
                    </p>
                    {c.requireJoinCode ? (
                      <Caption>참여 코드가 필요합니다</Caption>
                    ) : (
                      <Caption>코드 없이 등록할 수 있습니다</Caption>
                    )}
                  </div>

                  {c.requireJoinCode ? (
                    <div className="flex flex-col gap-xs">
                      <label htmlFor={`code-${c.id}`} className="caption">
                        참여 코드
                      </label>
                      <input
                        id={`code-${c.id}`}
                        className="field"
                        value={codes[c.id] ?? ''}
                        maxLength={6}
                        style={{ width: 140, textTransform: 'uppercase' }}
                        onChange={(e) =>
                          setCodes((m) => ({ ...m, [c.id]: e.target.value.toUpperCase() }))
                        }
                      />
                    </div>
                  ) : null}

                  <Button disabled={busy === c.id} onClick={() => void join(c.id)}>
                    {busy === c.id ? '등록 중…' : '수강 등록'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {isInstructor ? (
        <div style={{ marginTop: 48 }}>
          <Notice tone="lilac">
            <p className="text-body-sm" style={{ margin: 0 }}>
              강사 계정입니다. <Badge>강사</Badge> 클래스를 만들거나 관리하려면 상단바의{' '}
              <strong>강사</strong> 버튼을 쓰세요.
            </p>
          </Notice>
        </div>
      ) : null}
    </AppShell>
  )
}

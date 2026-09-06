import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Button, Caption, Notice } from '@/components/ui'

/**
 * 비밀번호 재설정 + 닉네임 정하기.
 *
 * mustResetPassword 인 동안에는 이 화면 말고 다른 화면이 열리지 않는다.
 * 최초 로그인도 같은 흐름을 쓴다. 첫 로그인 때 닉네임도 함께 정한다.
 */
export function ResetPassword() {
  const { user, completeReset, loading } = useAuth()
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!user.mustResetPassword) return <Navigate to="/" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (pw1 !== pw2) {
      setError('두 비밀번호가 다릅니다.')
      return
    }
    setBusy(true)
    try {
      await completeReset(pw1, nickname)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <main className="shell" style={{ paddingTop: 96, paddingBottom: 96, maxWidth: 560 }}>
        <p className="eyebrow">첫 로그인</p>
        <h1 className="text-display-lg" style={{ margin: '16px 0 0' }}>
          비밀번호와 닉네임을 정합니다
        </h1>

        <div style={{ marginTop: 24 }}>
          <Notice tone="lilac">
            <p className="text-body-sm">
              화면에 보이는 이름은 여기서 정한 <strong>닉네임</strong>입니다. 실명은 강사만 볼 수
              있고, 의견 광장과 분포에는 닉네임만 나갑니다.
            </p>
          </Notice>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-lg" style={{ marginTop: 32 }}>
          <div className="flex flex-col gap-xs">
            <label htmlFor="nick" className="text-body-sm" style={{ fontWeight: 480 }}>
              닉네임
            </label>
            <input
              id="nick"
              className="field"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <Caption>학기 내내 이 이름으로 보입니다.</Caption>
          </div>

          <div className="flex flex-col gap-xs">
            <label htmlFor="np1" className="text-body-sm" style={{ fontWeight: 480 }}>
              새 비밀번호
            </label>
            <input
              id="np1"
              className="field"
              type="password"
              autoComplete="new-password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
            />
            <Caption>8자 이상, 학번과 달라야 합니다.</Caption>
          </div>

          <div className="flex flex-col gap-xs">
            <label htmlFor="np2" className="text-body-sm" style={{ fontWeight: 480 }}>
              새 비밀번호 확인
            </label>
            <input
              id="np2"
              className="field"
              type="password"
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
            />
          </div>

          {error ? (
            <p role="alert" className="text-body-sm" style={{ fontWeight: 480 }}>
              ⚠ {error}
            </p>
          ) : null}

          <div>
            <Button type="submit" disabled={busy}>
              {busy ? '저장 중…' : '저장하고 시작하기'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}

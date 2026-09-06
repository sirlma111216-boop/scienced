import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { isFirebaseConfigured } from '@/lib/firebase'
import { Button, Caption, ColorBlock, Notice } from '@/components/ui'

/**
 * 로그인.
 *
 * 학생 화면에는 학번 입력란만 보인다. 이메일 형식은 노출하지 않는다.
 * 강사 로그인과 수강생 로그인을 탭으로 나눈다.
 *
 * Firebase 설정이 없으면 로컬 저장 모드 입장만 보인다.
 */
export function Login() {
  const { user, signInStudent, signInInstructor, signInLocal, loading } = useAuth()
  const [tab, setTab] = useState<'student' | 'instructor'>('student')
  const [studentId, setStudentId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const configured = isFirebaseConfigured()

  if (loading) return null
  if (user) return <Navigate to={user.mustResetPassword ? '/reset-password' : '/'} replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (!configured) {
        await signInLocal(nickname, tab === 'instructor')
      } else if (tab === 'student') {
        await signInStudent(studentId, password)
      } else {
        await signInInstructor(email, password)
      }
    } catch (err) {
      const code = (err as { code?: string })?.code ?? ''
      setError(
        code.includes('invalid-credential') || code.includes('wrong-password')
          ? '학번 또는 비밀번호가 맞지 않습니다. 처음 로그인이라면 비밀번호는 학번입니다.'
          : code.includes('too-many-requests')
            ? '시도가 너무 많았습니다. 잠시 뒤 다시 해 주세요.'
            : (err as Error).message || '로그인하지 못했습니다.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <main className="shell flex-1" style={{ paddingTop: 96, paddingBottom: 96, maxWidth: 760 }}>
        <p className="eyebrow">경희대학교 · 과학교육론 · 과학교과교수법</p>
        <h1 className="text-display-lg" style={{ margin: '16px 0 0' }}>
          Science Lesson Studio
        </h1>
        <p className="text-subhead" style={{ marginTop: 16 }}>
          한 학기 동안 같은 수업 주제를 발전시키며 자기 생각을 제출하고, 동료와 비교하고, 수정하고,
          그 변화를 남기는 곳입니다.
        </p>

        {!configured ? (
          <div style={{ marginTop: 32 }}>
            <Notice tone="cream">
              <p className="text-body-sm">
                <strong>로컬 저장 모드</strong> — 서버 설정이 없어 이 브라우저 안에서만 동작합니다.
                개인 작성·자동 저장·인쇄는 그대로 되고, 실시간 공유만 “내 것”만 보입니다.
              </p>
            </Notice>
          </div>
        ) : null}

        <div className="flex gap-xs no-print" style={{ marginTop: 32 }}>
          <button
            type="button"
            className="tab"
            data-selected={tab === 'student'}
            aria-selected={tab === 'student'}
            role="tab"
            onClick={() => setTab('student')}
          >
            수강생 로그인
          </button>
          <button
            type="button"
            className="tab"
            data-selected={tab === 'instructor'}
            aria-selected={tab === 'instructor'}
            role="tab"
            onClick={() => setTab('instructor')}
          >
            강사 로그인
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-lg" style={{ marginTop: 24, maxWidth: 420 }}>
          {!configured ? (
            <div className="flex flex-col gap-xs">
              <label htmlFor="nickname" className="text-body-sm" style={{ fontWeight: 480 }}>
                화면에 보일 닉네임
              </label>
              <input
                id="nickname"
                className="field"
                value={nickname}
                autoComplete="nickname"
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
          ) : tab === 'student' ? (
            <>
              <div className="flex flex-col gap-xs">
                <label htmlFor="studentId" className="text-body-sm" style={{ fontWeight: 480 }}>
                  학번
                </label>
                <input
                  id="studentId"
                  className="field"
                  inputMode="numeric"
                  autoComplete="username"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-xs">
                <label htmlFor="password" className="text-body-sm" style={{ fontWeight: 480 }}>
                  비밀번호
                </label>
                <input
                  id="password"
                  className="field"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Caption>처음 로그인할 때는 학번이 비밀번호입니다.</Caption>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-xs">
                <label htmlFor="email" className="text-body-sm" style={{ fontWeight: 480 }}>
                  이메일
                </label>
                <input
                  id="email"
                  className="field"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-xs">
                <label htmlFor="ipw" className="text-body-sm" style={{ fontWeight: 480 }}>
                  비밀번호
                </label>
                <input
                  id="ipw"
                  className="field"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </>
          )}

          {error ? (
            <p role="alert" className="text-body-sm" style={{ fontWeight: 480 }}>
              ⚠ {error}
            </p>
          ) : null}

          <div>
            <Button type="submit" disabled={busy}>
              {busy ? '들어가는 중…' : '들어가기'}
            </Button>
          </div>
        </form>
      </main>

      <ColorBlock tone="lime" className="no-print" as="aside">
        <p className="eyebrow">이 앱이 하는 일</p>
        <p className="text-subhead" style={{ marginTop: 12, maxWidth: 640 }}>
          최초 답을 지우지 않습니다. 모든 응답은 버전으로 쌓입니다. 정답 속도가 아니라 설명의 질,
          증거 사용, 근거 있는 수정을 봅니다. 학생 순위를 만들지 않습니다.
        </p>
      </ColorBlock>
    </div>
  )
}

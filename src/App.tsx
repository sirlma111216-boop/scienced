import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { PresentProvider } from '@/components/ui'
import { Login } from '@/routes/Login'
import { ResetPassword } from '@/routes/ResetPassword'
import { Home } from '@/routes/Home'
import { Lesson } from '@/routes/Lesson'
import { Portfolio } from '@/routes/Portfolio'
import { ConceptMap } from '@/routes/ConceptMap'
import { Microteaching } from '@/routes/Microteaching'
import { InstructorDashboard } from '@/routes/instructor/Dashboard'
import { InstructorLessons } from '@/routes/instructor/Lessons'
import { InstructorLive } from '@/routes/instructor/Live'
import { InstructorStudents } from '@/routes/instructor/Students'

/**
 * 라우트 보호 (지시서 4.5).
 *  - 비로그인 → /login
 *  - mustResetPassword → /reset-password 외 전부 차단
 *  - 학생이 /instructor/* → 403 안내
 *  - 미공개 차시 내용은 전송하지 않는다 (차시 화면과 Firestore 규칙 양쪽에서)
 */
function Guard({ children, instructorOnly }: { children: React.ReactNode; instructorOnly?: boolean }) {
  const { user, loading, isInstructor } = useAuth()
  const loc = useLocation()

  if (loading) {
    return (
      <div className="shell" style={{ paddingTop: 96 }}>
        <p className="text-body">불러오는 중…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (user.mustResetPassword && loc.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" replace />
  }
  if (instructorOnly && !isInstructor) {
    return (
      <div className="shell" style={{ paddingTop: 96, maxWidth: 640 }}>
        <p className="eyebrow">403</p>
        <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
          강사 화면입니다
        </h1>
        <p className="text-body-lg" style={{ marginTop: 16 }}>
          이 화면은 강사 계정만 열 수 있습니다.
        </p>
      </div>
    )
  }
  return <>{children}</>
}

export function App() {
  return (
    <AuthProvider>
      <PresentProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/"
            element={
              <Guard>
                <Home />
              </Guard>
            }
          />
          <Route
            path="/lesson/:id"
            element={
              <Guard>
                <Lesson />
              </Guard>
            }
          />
          <Route
            path="/portfolio"
            element={
              <Guard>
                <Portfolio />
              </Guard>
            }
          />
          <Route
            path="/concept-map"
            element={
              <Guard>
                <ConceptMap />
              </Guard>
            }
          />
          <Route
            path="/microteaching"
            element={
              <Guard>
                <Microteaching />
              </Guard>
            }
          />

          <Route
            path="/instructor"
            element={
              <Guard instructorOnly>
                <InstructorDashboard />
              </Guard>
            }
          />
          <Route
            path="/instructor/lessons"
            element={
              <Guard instructorOnly>
                <InstructorLessons />
              </Guard>
            }
          />
          <Route
            path="/instructor/lesson/:id/live"
            element={
              <Guard instructorOnly>
                <InstructorLive />
              </Guard>
            }
          />
          <Route
            path="/instructor/students"
            element={
              <Guard instructorOnly>
                <InstructorStudents />
              </Guard>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PresentProvider>
    </AuthProvider>
  )
}

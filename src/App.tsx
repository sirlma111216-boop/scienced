import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, needsSetup, useAuth } from '@/lib/auth'
import { Login } from '@/routes/Login'
import { ResetPassword } from '@/routes/ResetPassword'
import { Home } from '@/routes/Home'
import { Lesson } from '@/routes/Lesson'
import { Teach } from '@/routes/Teach'
import { Portfolio } from '@/routes/Portfolio'
import { ConceptMap } from '@/routes/ConceptMap'
import { Microteaching } from '@/routes/Microteaching'
import { Curriculum } from '@/routes/Curriculum'
import { ClassSelect } from '@/routes/ClassSelect'
import { InstructorStudents } from '@/routes/instructor/Students'
import { InstructorAnalytics } from '@/routes/instructor/Analytics'
import { InstructorAiReview } from '@/routes/instructor/AiReview'
import { InstructorClasses } from '@/routes/instructor/Classes'
import { InstructorClassStudents } from '@/routes/instructor/ClassStudents'
import { InstructorClassGroups } from '@/routes/instructor/ClassGroups'

/**
 * 라우트 보호.
 *  - 비로그인 → /login
 *  - mustResetPassword → /reset-password 외 전부 차단
 *  - 학생이 /instructor/* · /teach/* → 403 안내
 *  - 미공개 차시 내용은 전송하지 않는다 (차시 화면이 공개 여부를 본 뒤에만 import() · Firestore 규칙)
 *
 * 8차: 강사 홈은 클래스 목록이다. 클래스 → 차시 목록 → 수업 화면(/teach/:classId/:lessonId).
 * 옛 /instructor/lessons · /instructor/lesson/:id/live · 대시보드는 없다.
 */
function Guard({
  children,
  instructorOnly,
  /** 클래스 없이도 열리는 화면 (클래스 선택·클래스 관리) */
  classOptional,
}: {
  children: React.ReactNode
  instructorOnly?: boolean
  classOptional?: boolean
}) {
  const { user, loading, isInstructor, classId } = useAuth()
  const loc = useLocation()

  if (loading) {
    return (
      <div className="shell" style={{ paddingTop: 96 }}>
        <p className="text-body">불러오는 중…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  /* 닉네임이 없으면 무조건 여기로 보낸다. 깃발이 아니라 상태를 본다 (needsSetup). */
  if (needsSetup(user) && loc.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" replace />
  }
  if (!classOptional && !classId) return <Navigate to="/class" replace />
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
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/class"
            element={
              <Guard classOptional>
                <ClassSelect />
              </Guard>
            }
          />

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
            path="/curriculum"
            element={
              <Guard>
                <Curriculum />
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

          {/* 강사 — 수업 화면 하나 */}
          <Route
            path="/teach/:classId/:lessonId"
            element={
              <Guard instructorOnly classOptional>
                <Teach />
              </Guard>
            }
          />

          <Route
            path="/instructor/classes"
            element={
              <Guard instructorOnly classOptional>
                <InstructorClasses />
              </Guard>
            }
          />
          <Route
            path="/instructor/class/:classId/groups"
            element={
              <Guard instructorOnly classOptional>
                <InstructorClassGroups />
              </Guard>
            }
          />
          <Route
            path="/instructor/class/:classId/students"
            element={
              <Guard instructorOnly classOptional>
                <InstructorClassStudents />
              </Guard>
            }
          />
          <Route path="/instructor" element={<Navigate to="/instructor/classes" replace />} />
          <Route path="/instructor/lessons" element={<Navigate to="/instructor/classes" replace />} />
          <Route path="/instructor/lesson/:id/live" element={<Navigate to="/instructor/classes" replace />} />
          <Route
            path="/instructor/students"
            element={
              <Guard instructorOnly>
                <InstructorStudents />
              </Guard>
            }
          />
          <Route
            path="/instructor/analytics"
            element={
              <Guard instructorOnly>
                <InstructorAnalytics />
              </Guard>
            }
          />
          <Route
            path="/instructor/ai-review"
            element={
              <Guard instructorOnly>
                <InstructorAiReview />
              </Guard>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </AuthProvider>
  )
}

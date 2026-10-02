import { Suspense, lazy, type ComponentType } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AuthProvider, needsSetup, useAuth } from '@/lib/auth'
import { Login } from '@/routes/Login'
import { ResetPassword } from '@/routes/ResetPassword'
import { Home } from '@/routes/Home'
import { Lesson } from '@/routes/Lesson'
import { ClassSelect } from '@/routes/ClassSelect'
import { SiteNoticePopup } from '@/components/notice/SiteNoticePopup'

/**
 * 열 때 받는 화면 (2026-10-02).
 *
 * 학생이 처음 여는 화면(로그인 · 홈 · 차시 · 클래스 고르기)만 첫 번들에 둔다. 강사 화면과 가끔 여는 화면은
 * 그 경로에 들어설 때 내려받는다 — 학생 기기가 강사 화면의 코드까지 먼저 받을 이유가 없다.
 * 받지 못하면(새 버전이 올라와 옛 파일이 없어졌거나 네트워크가 끊김) 이유를 콘솔에 남기고 다음에 할 일을 화면에 적는다.
 */
function LoadFailed() {
  return (
    <div className="shell" style={{ paddingTop: 96, maxWidth: 640 }}>
      <p className="text-subhead" style={{ margin: 0 }}>
        화면을 불러오지 못했습니다.
      </p>
      <p className="text-body" style={{ marginTop: 12 }}>
        새 버전이 올라왔거나 네트워크가 끊겼을 수 있습니다. 화면을 새로 고치세요.
      </p>
    </div>
  )
}

function Loading() {
  return (
    <div className="shell" style={{ paddingTop: 96 }}>
      <p className="text-body">불러오는 중…</p>
    </div>
  )
}

function lazyRoute(name: string, load: () => Promise<ComponentType>) {
  return lazy(() =>
    load()
      .then((component) => ({ default: component }))
      .catch((err) => {
        console.error(`[화면] ${name} 화면을 불러오지 못했다:`, err)
        return { default: LoadFailed }
      }),
  )
}

const Teach = lazyRoute('수업 화면', () => import('@/routes/Teach').then((m) => m.Teach))
const Portfolio = lazyRoute('포트폴리오', () => import('@/routes/Portfolio').then((m) => m.Portfolio))
const ConceptMap = lazyRoute('개념 지도', () => import('@/routes/ConceptMap').then((m) => m.ConceptMap))
const Microteaching = lazyRoute('마이크로티칭', () => import('@/routes/Microteaching').then((m) => m.Microteaching))
const Curriculum = lazyRoute('교육과정 맵', () => import('@/routes/Curriculum').then((m) => m.Curriculum))
const InstructorStudents = lazyRoute('수강생 관리', () => import('@/routes/instructor/Students').then((m) => m.InstructorStudents))
const InstructorAnalytics = lazyRoute('분석', () => import('@/routes/instructor/Analytics').then((m) => m.InstructorAnalytics))
const InstructorAiReview = lazyRoute('AI 검토', () => import('@/routes/instructor/AiReview').then((m) => m.InstructorAiReview))
const InstructorClasses = lazyRoute('강사 홈', () => import('@/routes/instructor/Classes').then((m) => m.InstructorClasses))
const InstructorClassStudents = lazyRoute('클래스 명단', () => import('@/routes/instructor/ClassStudents').then((m) => m.InstructorClassStudents))
const InstructorClassGroups = lazyRoute('클래스 모둠', () => import('@/routes/instructor/ClassGroups').then((m) => m.InstructorClassGroups))
const InstructorClassSettings = lazyRoute('클래스 설정', () => import('@/routes/instructor/ClassSettings').then((m) => m.InstructorClassSettings))

/**
 * 라우트 보호.
 *  - 비로그인 → /login
 *  - mustResetPassword → /reset-password 외 전부 차단
 *  - 학생이 /instructor/* · /teach/* → 403 안내
 *  - 로그인을 마친 화면에는 전체 공지 창(SiteNoticePopup)이 함께 붙는다 — 기간 안이고 아직 닫지 않은 사람에게만 뜬다
 *  - 미공개 차시 내용은 전송하지 않는다 (차시 화면이 공개 여부를 본 뒤에만 import() · Firestore 규칙)
 *
 * 강사 홈(/instructor/classes)은 지금 클래스의 차시 목록이다 — 거기서 바로 수업 화면(/teach/:classId/:lessonId)으로 간다.
 * 수업이 아닌 일(명단 · 모둠 · 설정)은 /instructor/class/:classId/* 탭 셋에 모여 있다 (강의자 지시 2026-09-21).
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
    return <Loading />
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
  /* 전체 공지 — 로그인을 마친 화면이면 어디서든 뜬다 (강의자 지시 2026-10-02) */
  return (
    <>
      {children}
      <SiteNoticePopup />
    </>
  )
}

/** /instructor/class/:classId — 관리의 첫 탭(수강생 명단)으로 */
function ClassAdminRedirect() {
  const { classId } = useParams()
  return <Navigate to={classId ? `/instructor/class/${classId}/students` : '/instructor/classes'} replace />
}

export function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Loading />}>
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
          <Route
            path="/instructor/class/:classId/settings"
            element={
              <Guard instructorOnly classOptional>
                <InstructorClassSettings />
              </Guard>
            }
          />
          <Route path="/instructor/class/:classId" element={<ClassAdminRedirect />} />
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
      </Suspense>
    </AuthProvider>
  )
}

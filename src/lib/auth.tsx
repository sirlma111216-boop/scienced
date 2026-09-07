import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updatePassword,
  type User as FbUser,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { getFirebaseAuth, getDb, studentIdToEmail } from './firebase'
import { createFirestoreRepo } from './repo-firestore'
import { createLocalRepo } from './repo-local'
import { getRepo, setRepo, type Repo } from './repo'
import type { AppUser, ClassDoc, Enrollment, StorageMode } from './types'

/**
 * 인증과 현재 클래스.
 *
 * 학생은 학번 + 비밀번호로 들어온다. 학번은 존재하지 않는 도메인의 이메일로 매핑된다.
 * 메일 발송 기능은 쓰지 않는다.
 *
 * 로그인 다음에 클래스를 고른다. 클래스를 고르기 전에는 다른 화면에 갈 수 없다.
 * 여러 학기를 수강하면 클래스가 쌓이므로 상단바에서 전환할 수 있다.
 *
 * Firebase 설정이 없으면 로컬 저장 모드로 간다.
 */

interface AuthState {
  loading: boolean
  mode: StorageMode
  user: AppUser | null
  repo: Repo | null
  /** 강사 여부는 instructors/{uid} 문서 존재로만 판정한다. 클라이언트 boolean 을 믿지 않는다. */
  isInstructor: boolean

  /** 지금 보고 있는 클래스 id. 고르기 전에는 null. */
  classId: string | null
  /** 지금 보고 있는 클래스 문서 */
  currentClass: ClassDoc | null
  /** 전체 클래스 (강사는 전부, 학생은 모집 중인 것과 자기가 등록한 것) */
  classes: ClassDoc[]
  /** 내가 등록한 클래스 id */
  myClassIds: string[]
  selectClass: (classId: string) => Promise<void>
  enrollIn: (classId: string, joinCode?: string) => Promise<void>

  signInStudent: (studentId: string, password: string) => Promise<void>
  signInInstructor: (email: string, password: string) => Promise<void>
  signInLocal: (nickname: string, asInstructor: boolean) => Promise<void>
  signOut: () => Promise<void>
  completeReset: (newPassword: string, nickname: string) => Promise<void>
  setNickname: (nickname: string) => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

const LOCAL_USER_KEY = 'sls.v1.localUser'

function readLocalUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY)
    return raw ? (JSON.parse(raw) as AppUser) : null
  } catch {
    return null
  }
}

function writeLocalUser(u: AppUser | null) {
  try {
    if (u) localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(u))
    else localStorage.removeItem(LOCAL_USER_KEY)
  } catch {
    /* 저장이 막혀도 이번 세션은 동작한다 */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AppUser | null>(null)
  const [isInstructor, setIsInstructor] = useState(false)
  const [mode, setMode] = useState<StorageMode>('local')
  const [classes, setClasses] = useState<ClassDoc[]>([])
  const [classId, setClassId] = useState<string | null>(null)
  const [myEnrollments, setMyEnrollments] = useState<Record<string, Enrollment>>({})
  const repoRef = useRef<Repo | null>(null)

  // 저장소를 한 번만 고른다.
  if (!repoRef.current) {
    const db = getDb()
    repoRef.current = db ? createFirestoreRepo(db) : createLocalRepo()
    setRepo(repoRef.current)
  }
  const repo = repoRef.current

  useEffect(() => {
    setMode(repo.mode)
  }, [repo.mode])

  /*
   * ★ 로그인한 uid 가 바뀌면 다시 구독한다.
   *
   * classes 컬렉션은 보안 규칙이 signedIn() 을 요구한다.
   * 로그인 전에 구독하면 첫 스냅숏이 permission-denied 로 끝나는데,
   * onSnapshot 은 오류가 나면 리스너를 떼어 버리고 다시 붙지 않는다.
   * 의존성이 [repo] 뿐이면 그 뒤에 로그인해도 목록이 영영 비어 있다.
   *
   * 그래서 학생은 로그인 직후 「등록할 수 있는 클래스 0개」를 봤다.
   * 강사가 못 본 것은 이미 로그인된 상태로 새로고침했기 때문이다 —
   * 그때는 첫 스냅숏이 성공한다. 첫 수업 날 아무도 등록하지 못할 자리였다.
   */
  useEffect(() => {
    return repo.watchClasses(setClasses)
  }, [repo, user?.uid])

  /** 내가 어느 클래스에 등록되어 있는지 확인한다. */
  useEffect(() => {
    if (!user) {
      setMyEnrollments({})
      return
    }
    let cancelled = false
    void (async () => {
      const found: Record<string, Enrollment> = {}
      for (const c of classes) {
        const e = await repo.getEnrollment(c.id, user.uid)
        if (e) found[c.id] = e
      }
      if (!cancelled) setMyEnrollments(found)
    })()
    return () => {
      cancelled = true
    }
  }, [repo, user, classes])

  /** 로그인한 uid 로 users/{uid} 와 instructors/{uid} 를 확인한다. */
  const loadProfile = useCallback(
    async (fb: FbUser) => {
      const existing = await repo.getUser(fb.uid)
      const db = getDb()
      let instructor = false
      if (db) {
        try {
          // 강사 판정의 유일한 근거: instructors/{uid} 문서가 있는가.
          // 클라이언트 boolean 을 믿지 않는다. 이 컬렉션은 규칙에서 쓰기가 막혀 있다.
          const snap = await getDoc(doc(db, 'instructors', fb.uid))
          instructor = snap.exists()
        } catch {
          instructor = false
        }
      }
      const profile: AppUser = existing ?? {
        uid: fb.uid,
        role: instructor ? 'instructor' : 'student',
        studentId: fb.email ? fb.email.split('@')[0] : null,
        displayName: null,
        nickname: '',
        // 처음 들어온 계정은 비밀번호와 닉네임을 정하고 시작한다.
        mustResetPassword: true,
        groupId: null,
        lastClassId: null,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      }
      const next: AppUser = {
        ...profile,
        role: instructor ? 'instructor' : profile.role,
        lastLoginAt: Date.now(),
      }
      await repo.upsertUser(next)
      setIsInstructor(instructor)
      setUser(next)
      if (next.lastClassId) setClassId(next.lastClassId)
    },
    [repo],
  )

  useEffect(() => {
    const auth = getFirebaseAuth()
    if (!auth) {
      // 로컬 저장 모드
      const local = readLocalUser()
      setUser(local)
      setIsInstructor(local?.role === 'instructor')
      if (local?.lastClassId) setClassId(local.lastClassId)
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, async (fb) => {
      if (!fb) {
        setUser(null)
        setIsInstructor(false)
        setClassId(null)
        setLoading(false)
        return
      }
      await loadProfile(fb)
      setLoading(false)
    })
  }, [loadProfile])

  const persistLastClass = useCallback(
    async (cid: string) => {
      if (!user) return
      const next = { ...user, lastClassId: cid }
      await repo.upsertUser(next)
      if (!getFirebaseAuth()) writeLocalUser(next)
      setUser(next)
    },
    [repo, user],
  )

  const selectClass = useCallback(
    async (cid: string) => {
      setClassId(cid)
      await persistLastClass(cid)
    },
    [persistLastClass],
  )

  const enrollIn = useCallback(
    async (cid: string, joinCode?: string) => {
      if (!user) throw new Error('로그인이 필요합니다.')
      const target = classes.find((c) => c.id === cid)
      if (!target) throw new Error('그 클래스를 찾을 수 없습니다.')
      if (target.status !== 'active') throw new Error('보관된 클래스에는 등록할 수 없습니다.')
      if (!target.enrollmentOpen) throw new Error('수강 등록이 마감된 클래스입니다.')
      if (target.requireJoinCode) {
        const given = (joinCode ?? '').trim().toUpperCase()
        if (given !== target.joinCode) throw new Error('참여 코드가 맞지 않습니다.')
      }
      await repo.enroll(cid, {
        uid: user.uid,
        studentId: user.studentId,
        nickname: user.nickname,
        groupId: null,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        status: 'active',
      })
      setMyEnrollments((m) => ({
        ...m,
        [cid]: {
          uid: user.uid,
          studentId: user.studentId,
          nickname: user.nickname,
          groupId: null,
          joinedAt: Date.now(),
          lastSeenAt: Date.now(),
          status: 'active',
        },
      }))
      await selectClass(cid)
    },
    [repo, user, classes, selectClass],
  )

  const signInStudent = useCallback(async (studentId: string, password: string) => {
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('로컬 저장 모드에서는 학번 로그인을 쓸 수 없습니다.')
    await signInWithEmailAndPassword(auth, studentIdToEmail(studentId), password)
  }, [])

  const signInInstructor = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('로컬 저장 모드에서는 강사 로그인을 쓸 수 없습니다.')
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const signInLocal = useCallback(
    async (nickname: string, asInstructor: boolean) => {
      const u: AppUser = {
        uid: `local-${asInstructor ? 'instructor' : 'student'}`,
        role: asInstructor ? 'instructor' : 'student',
        studentId: null,
        displayName: null,
        nickname: nickname.trim() || '이름 없음',
        mustResetPassword: false,
        groupId: null,
        lastClassId: null,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      }
      writeLocalUser(u)
      await repo.upsertUser(u)
      setUser(u)
      setIsInstructor(asInstructor)
    },
    [repo],
  )

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth()
    if (auth) await fbSignOut(auth)
    else writeLocalUser(null)
    setUser(null)
    setIsInstructor(false)
    setClassId(null)
  }, [])

  const completeReset = useCallback(
    async (newPassword: string, nickname: string) => {
      const auth = getFirebaseAuth()
      if (!user) throw new Error('로그인이 필요합니다.')
      if (newPassword.length < 8) throw new Error('새 비밀번호는 8자 이상이어야 합니다.')
      if (user.studentId && newPassword === user.studentId) {
        throw new Error('새 비밀번호는 학번과 달라야 합니다.')
      }
      if (!nickname.trim()) throw new Error('닉네임을 정해 주세요.')
      if (auth?.currentUser) await updatePassword(auth.currentUser, newPassword)
      const next: AppUser = { ...user, mustResetPassword: false, nickname: nickname.trim() }
      await repo.upsertUser(next)
      if (!auth) writeLocalUser(next)
      setUser(next)
    },
    [repo, user],
  )

  const setNickname = useCallback(
    async (nickname: string) => {
      if (!user) return
      const next = { ...user, nickname: nickname.trim() }
      await repo.upsertUser(next)
      if (!getFirebaseAuth()) writeLocalUser(next)
      setUser(next)
      // 등록된 클래스의 표시 이름도 함께 바꾼다.
      for (const cid of Object.keys(myEnrollments)) {
        await repo.updateEnrollment(cid, user.uid, { nickname: next.nickname })
      }
    },
    [repo, user, myEnrollments],
  )

  const myClassIds = useMemo(() => Object.keys(myEnrollments), [myEnrollments])
  const currentClass = useMemo(
    () => classes.find((c) => c.id === classId) ?? null,
    [classes, classId],
  )

  const value = useMemo<AuthState>(
    () => ({
      loading,
      mode,
      user,
      repo,
      isInstructor,
      classId,
      currentClass,
      classes,
      myClassIds,
      selectClass,
      enrollIn,
      signInStudent,
      signInInstructor,
      signInLocal,
      signOut,
      completeReset,
      setNickname,
    }),
    [
      loading,
      mode,
      user,
      repo,
      isInstructor,
      classId,
      currentClass,
      classes,
      myClassIds,
      selectClass,
      enrollIn,
      signInStudent,
      signInInstructor,
      signInLocal,
      signOut,
      completeReset,
      setNickname,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('AuthProvider 안에서만 쓸 수 있습니다.')
  return v
}

/** 컴포넌트에서 저장소를 바로 쓸 때. */
export function useRepo(): Repo {
  return getRepo()
}

/**
 * 클래스가 정해진 화면에서만 쓴다.
 * 클래스가 없으면 던진다 — 라우트 가드가 그 전에 막아야 한다는 뜻이다.
 */
export function useClassId(): string {
  const { classId } = useAuth()
  if (!classId) throw new Error('클래스를 먼저 골라야 합니다.')
  return classId
}

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
import type { AppUser, StorageMode } from './types'

/**
 * 인증.
 *
 * 학생은 학번 + 비밀번호로 들어온다. 학번은 존재하지 않는 도메인의 이메일로 매핑된다.
 * 메일 발송 기능은 쓰지 않는다.
 *
 * Firebase 설정이 없으면 로컬 저장 모드로 간다. 이때는 서버 계정 없이
 * 이 브라우저 안에서만 유효한 신원을 쓴다. 강의 당일 설정이 어긋나도 수업이 멈추지 않게 하기 위해서다.
 */

interface AuthState {
  loading: boolean
  mode: StorageMode
  user: AppUser | null
  repo: Repo | null
  /** 강사 여부는 instructors/{uid} 문서 존재로만 판정한다. 클라이언트 boolean 을 믿지 않는다. */
  isInstructor: boolean
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
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, async (fb) => {
      if (!fb) {
        setUser(null)
        setIsInstructor(false)
        setLoading(false)
        return
      }
      await loadProfile(fb)
      setLoading(false)
    })
  }, [loadProfile])

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
    },
    [repo, user],
  )

  const value = useMemo<AuthState>(
    () => ({
      loading,
      mode,
      user,
      repo,
      isInstructor,
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

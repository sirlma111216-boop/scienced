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

/**
 * 아직 시작할 준비가 안 된 계정인가.
 *
 * ★ 라우트 보호(App.tsx)와 설정 화면(ResetPassword.tsx)이 **같은 판정**을 써야 한다.
 *   서로 다른 조건을 보면 한쪽이 보내고 다른 쪽이 되돌려 무한히 오간다.
 *   실제로 그럴 뻔했다 — 관문은 닉네임을 보는데 화면은 깃발을 보고 있었다.
 *
 * 깃발이 아니라 상태를 본다. 닉네임이 비어 있으면 아직 준비가 안 된 것이다.
 */
/**
 * users 규칙이 학생의 수정을 허용하는 필드.
 *
 * firestore.rules 의 changedKeys().hasOnly([...]) 와 반드시 같아야 한다.
 * 여기에 없는 필드를 하나라도 함께 보내면 규칙이 문서 전체를 거절한다.
 * 「Missing or insufficient permissions.」 는 그때 나온다.
 */
const STUDENT_WRITABLE = [
  'nickname',
  'lastLoginAt',
  'mustResetPassword',
  'groupId',
  'lastClassId',
] as const

/**
 * 저장할 것만 골라 낸다.
 *
 * user 객체는 화면용이라 role·studentId·createdAt 까지 다 들어 있다.
 * 그것을 통째로 보내면 바뀌지 않은 값도 diff 에 잡혀 규칙이 막는다.
 * 강사는 규칙에서 전부 쓸 수 있으므로 그대로 보낸다.
 */
function writableUser(user: AppUser, instructor: boolean): AppUser {
  if (instructor) return user
  const out: Record<string, unknown> = { uid: user.uid }
  for (const key of STUDENT_WRITABLE) out[key] = user[key]
  return out as unknown as AppUser
}

export function needsSetup(user: AppUser | null): boolean {
  if (!user) return false
  return user.mustResetPassword || !user.nickname?.trim()
}

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
      /*
       * 기본값 위에 있는 값만 덮는다.
       *
       * existing ?? 기본값 으로 두면, 필드가 빠진 반쪽 문서가 그대로 통과한다.
       * 실제로 그런 문서가 만들어졌고 두 가지가 터졌다 —
       * mustResetPassword 가 없어 닉네임 정하는 화면을 건너뛰었고,
       * nickname 이 없어 수강 등록이 undefined 를 저장하려다 막혔다.
       *
       * Firestore 는 undefined 를 담지 않으므로, 빠진 필드는 키 자체가 없다.
       * 그래서 펼치기(spread)로 덮으면 없는 것만 기본값이 남는다.
       */
      const profile: AppUser = {
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
        ...(existing ?? {}),
      }
      const next: AppUser = {
        ...profile,
        role: instructor ? 'instructor' : profile.role,
        lastLoginAt: Date.now(),
      }
      /*
       * ★ 규칙이 학생에게 허용하는 필드만 보낸다.
       *
       *   users 규칙은 학생의 수정을 changedKeys().hasOnly([...]) 로 좁혀 놓았다.
       *   화면용으로 채운 값을 전부 보내면 role·studentId·createdAt 이 바뀐 것으로 잡혀
       *   규칙이 거절하고, 그 예외가 로그인 로딩을 영영 끝나지 않게 만든다.
       *   실제로 「불러오는 중…」이 끝나지 않았다.
       *
       *   화면에서 쓰는 값(next)은 다 채우되, 저장은 허용된 것만 한다.
       *   강사는 규칙에서 전부 쓸 수 있으므로 그대로 보낸다.
       */
      try {
        await repo.upsertUser(writableUser(next, instructor))
      } catch (err) {
        /*
         * 저장이 막혀도 로그인은 진행한다.
         * 여기서 던지면 아래 setLoading(false) 가 실행되지 않아 화면이 멈춘다.
         */
        console.warn('[auth] 프로필 저장 실패:', err)
      }

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
      /*
       * ★ 어떤 이유로든 로딩은 끝나야 한다.
       *   loadProfile 이 던지면 setLoading(false) 를 못 만나고 「불러오는 중…」에서 멈춘다.
       *   화면이 멈추는 것보다 덜 채워진 채로 들어가는 편이 낫다.
       */
      try {
        await loadProfile(fb)
      } catch (err) {
        console.warn('[auth] 프로필을 불러오지 못했습니다:', err)
      } finally {
        setLoading(false)
      }
    })
  }, [loadProfile])

  const persistLastClass = useCallback(
    async (cid: string) => {
      if (!user) return
      const next = { ...user, lastClassId: cid }
      await repo.upsertUser(writableUser(next, isInstructor))
      if (!getFirebaseAuth()) writeLocalUser(next)
      setUser(next)
    },
    [repo, user, isInstructor],
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
      /*
       * Firestore 는 undefined 를 저장하지 못한다. setDoc 이 통째로 거부한다.
       * users/{uid} 문서가 없는 계정(콘솔에서 손으로 만들었거나 명단 저장이 실패한 경우)은
       * nickname·studentId 가 undefined 라, 그대로 넣으면 수강 등록이 통째로 막혔다.
       * 없는 값은 빈 문자열과 null 로 못박는다 — 등록이 이런 이유로 막히면 안 된다.
       */
      await repo.enroll(cid, {
        uid: user.uid,
        studentId: user.studentId ?? null,
        nickname: user.nickname ?? '',
        groupId: null,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        status: 'active',
      })
      setMyEnrollments((m) => ({
        ...m,
        [cid]: {
          uid: user.uid,
          studentId: user.studentId ?? null,
          nickname: user.nickname ?? '',
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
      if (user.mustResetPassword) {
        if (newPassword.length < 8) throw new Error('새 비밀번호는 8자 이상이어야 합니다.')
        if (user.studentId && newPassword === user.studentId) {
          throw new Error('새 비밀번호는 학번과 달라야 합니다.')
        }
      }
      if (!nickname.trim()) throw new Error('닉네임을 정해 주세요.')

      /*
       * 비밀번호를 바꿔야 하는 계정만 바꾼다.
       * 닉네임만 비어 있는 계정에게 비밀번호까지 새로 정하라고 할 이유가 없다.
       *
       * updatePassword 는 로그인한 지 오래되면 requires-recent-login 으로 거절한다.
       * 그대로 두면 영어 원문이 화면에 뜨고, 학생은 무엇을 해야 할지 알 수 없다.
       */
      if (user.mustResetPassword && auth?.currentUser) {
        try {
          await updatePassword(auth.currentUser, newPassword)
        } catch (err) {
          const code = (err as { code?: string })?.code ?? ''
          if (code.includes('requires-recent-login')) {
            throw new Error(
              '로그인한 지 오래되어 비밀번호를 바꿀 수 없습니다. 나갔다가 다시 로그인해 주세요.',
            )
          }
          if (code.includes('weak-password')) {
            throw new Error('비밀번호가 너무 단순합니다. 다른 것으로 정해 주세요.')
          }
          throw err
        }
      }

      const next: AppUser = { ...user, mustResetPassword: false, nickname: nickname.trim() }
      await repo.upsertUser(writableUser(next, isInstructor))
      if (!auth) writeLocalUser(next)
      setUser(next)
    },
    [repo, user, isInstructor],
  )

  const setNickname = useCallback(
    async (nickname: string) => {
      if (!user) return
      const next = { ...user, nickname: nickname.trim() }
      await repo.upsertUser(writableUser(next, isInstructor))
      if (!getFirebaseAuth()) writeLocalUser(next)
      setUser(next)
      // 등록된 클래스의 표시 이름도 함께 바꾼다.
      for (const cid of Object.keys(myEnrollments)) {
        await repo.updateEnrollment(cid, user.uid, { nickname: next.nickname })
      }
    },
    [repo, user, myEnrollments, isInstructor],
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

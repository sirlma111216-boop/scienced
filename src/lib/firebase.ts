import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

/**
 * Firebase 초기화.
 *
 * 설정값이 하나라도 비면 초기화하지 않고 null 을 돌려준다. 그러면 앱은 로컬 저장 모드로 간다.
 * 여기 들어가는 값은 전부 클라이언트에 공개되어도 되는 것들이다. 보안은 firestore.rules 가 한다.
 * 서비스 계정·API 키 같은 서버 전용 값은 절대 VITE_ 접두사로 두지 않는다.
 */

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const STUDENT_EMAIL_DOMAIN =
  import.meta.env.VITE_STUDENT_EMAIL_DOMAIN || 'students.slstudio.local'

/** 학번 2024123456 → 2024123456@students.slstudio.local */
export function studentIdToEmail(studentId: string): string {
  return `${studentId.trim()}@${STUDENT_EMAIL_DOMAIN}`
}

/** 화면에는 학번 입력란만 보인다. 이메일 형식은 노출하지 않는다. */
export function emailToStudentId(email: string): string {
  return email.split('@')[0]
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let attempted = false

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId && config.authDomain)
}

function ensure() {
  if (attempted) return
  attempted = true
  if (!isFirebaseConfigured()) return
  try {
    app = initializeApp(config as Required<typeof config>)
    auth = getAuth(app)
    db = getFirestore(app)
  } catch (err) {
    // 설정이 잘못되어도 앱은 뜬다. 로컬 저장 모드로 간다.
    console.warn('[firebase] 초기화 실패 — 로컬 저장 모드로 진행합니다.', err)
    app = null
    auth = null
    db = null
  }
}

export function getFirebaseAuth(): Auth | null {
  ensure()
  return auth
}

export function getDb(): Firestore | null {
  ensure()
  return db
}

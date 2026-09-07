/**
 * 서버 함수 호출.
 *
 * ★ 이 파일을 거치지 않고 fetch('/api/...') 를 직접 부르지 마라.
 *
 *   서버 함수는 전부 Authorization 헤더의 Firebase ID 토큰으로 호출자를 확인한다
 *   (functions/api/_lib/auth.ts 의 verifyIdToken).
 *   헤더가 없으면 「로그인이 필요합니다」로 돌아오는데, 그 응답이 200 + JSON 이라
 *   화면에서는 그냥 안내 문구로만 보인다. 오류처럼 보이지 않는다.
 *
 *   실제로 그렇게 여섯 군데가 전부 죽어 있었다 — AI 도우미, 응답 유형 묶기,
 *   계정 일괄 생성, 비밀번호 초기화, 서버 시드. 사다리는 폴백이 있어 더 오래 숨었다.
 *   그래서 토큰 붙이는 일을 여기 한 곳에 모은다. verify:api 가 우회를 막는다.
 */
import { getFirebaseAuth } from './firebase'

/** 로컬 저장 모드에서는 Firebase 가 없다. 그때는 토큰도 없다. */
async function idToken(): Promise<string | null> {
  const auth = getFirebaseAuth()
  if (!auth?.currentUser) return null
  try {
    return await auth.currentUser.getIdToken()
  } catch {
    return null
  }
}

/** 서버 함수의 공통 응답. 실패해도 5xx 가 아니라 200 + ok:false 로 온다. */
export interface ApiResult {
  ok: boolean
  message?: string
}

/**
 * POST /api/… 한 번.
 * 서버에 닿지 못하면 던지지 않고 ok:false 로 돌려준다 — 수업 중에 화면이 멈추면 안 된다.
 */
export async function apiPost<T extends ApiResult>(
  path: string,
  body: unknown,
): Promise<T & ApiResult> {
  const token = await idToken()
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    return (await res.json()) as T & ApiResult
  } catch {
    return {
      ok: false,
      message: '서버에 닿지 못했습니다. 로컬 저장 모드에서는 이 기능을 쓸 수 없습니다.',
    } as T & ApiResult
  }
}

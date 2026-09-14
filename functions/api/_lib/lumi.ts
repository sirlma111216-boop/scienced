/**
 * 루미 런 연동 — 티켓 서명과 결과 서명 확인 (7차 이후 · 발표자 선정 게임).
 *
 * 게임 서버(gamerun/server/lesson-ticket.ts)와 같은 형식이다.
 *   티켓   base64url(JSON) + '.' + base64url(HMAC-SHA256(secret, base64url(JSON)))
 *   결과   x-lumi-signature: sha256=<hex HMAC-SHA256(secret, 본문 그대로)>
 * 비밀은 LUMI_SHARED_SECRET 하나 — Cloudflare 와 Render 양쪽에 같은 값을 둔다.
 */
export const LUMI_ISSUER = 'scienced'
export const LUMI_AUDIENCE = 'lumi-run'
export const LUMI_NAME_MAX = 18
/**
 * 티켓 유효기간 — 한 수업 시간. 재접속(새로고침·연결 끊김)도 같은 티켓으로 하므로 경기 도중 만료되면 안 된다.
 * 티켓은 활동 실행 하나에만 묶여 있어, 유효기간 안이라도 다른 활동·다른 수업에는 쓰지 못한다.
 */
export const LUMI_TICKET_TTL_SEC = 120 * 60

export interface LumiTicketPayload {
  iss: string
  aud: string
  cid: string
  lid: string
  act: string
  sub: string
  name: string
  role: 'teacher' | 'student'
  iat: number
  exp: number
}

const enc = new TextEncoder()
function b64url(bytes: ArrayBuffer | Uint8Array | string): string {
  const u8 = typeof bytes === 'string' ? enc.encode(bytes) : bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let bin = ''
  for (const b of u8) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function hmac(secret: string, data: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', key, enc.encode(data))
}
function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function signLumiTicket(payload: Omit<LumiTicketPayload, 'iss' | 'aud'>, secret: string): Promise<string> {
  const body = b64url(JSON.stringify({ iss: LUMI_ISSUER, aud: LUMI_AUDIENCE, ...payload }))
  return `${body}.${b64url(await hmac(secret, body))}`
}

/** 결과 webhook 의 서명을 본문 그대로에 대해 확인한다. 길이가 같은지 먼저 보고 한 글자씩 비교한다. */
export async function verifyLumiSignature(body: string, header: string | null, secret: string): Promise<boolean> {
  if (!secret || !header) return false
  const expected = `sha256=${hex(await hmac(secret, body))}`
  if (expected.length !== header.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i)
  return diff === 0
}

/**
 * 서비스 계정으로 Firestore REST 에 쓰기 위한 주소와 헤더.
 *
 * FIRESTORE_EMULATOR_HOST 가 있으면(에뮬레이터 검사 `npm run test:lumi`) 에뮬레이터로 보내고 토큰은 `owner` 다.
 * 운영에서는 이 변수가 없다 — 서비스 계정 토큰만 쓴다. 검사가 함수 본문을 그대로 부르게 하려고 여기서만 갈라진다.
 */
export async function firestoreRest(env: { FIREBASE_PROJECT_ID?: string; GCP_SERVICE_ACCOUNT?: string; FIRESTORE_EMULATOR_HOST?: string }): Promise<{ docs: string; commit: string; headers: Record<string, string> } | { error: string }> {
  const project = env.FIREBASE_PROJECT_ID
  if (!project) return { error: 'FIREBASE_PROJECT_ID 가 없습니다.' }
  const emu = env.FIRESTORE_EMULATOR_HOST
  const root = emu ? `http://${emu}/v1/projects/${project}/databases/(default)/documents` : `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`
  let token = 'owner'
  if (!emu) {
    const { getAccessToken, parseServiceAccount } = await import('../../../shared/ai-core')
    const sa = parseServiceAccount(env.GCP_SERVICE_ACCOUNT)
    if (!sa) return { error: '서비스 계정이 설정되지 않았습니다.' }
    try {
      token = await getAccessToken(sa, 'https://www.googleapis.com/auth/cloud-platform')
    } catch (err) {
      return { error: `토큰 실패: ${(err as Error).message}` }
    }
  }
  return { docs: root, commit: `${root}:commit`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } }
}

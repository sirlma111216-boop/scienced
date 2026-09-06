/**
 * Firebase ID 토큰 검증.
 *
 * firebase-admin 을 설치하지 않는다. Node 전용이라 Workers 에서 동작하지 않는다.
 * Google 공개키(securetoken@system.gserviceaccount.com JWK)를 캐시해 WebCrypto 로 직접 검증한다.
 */

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

interface Jwk {
  kid: string
  n: string
  e: string
  kty: string
  alg: string
}

let cache: { keys: Map<string, CryptoKey>; at: number } | null = null
const CACHE_MS = 60 * 60 * 1000

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function getKeys(): Promise<Map<string, CryptoKey>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.keys
  const res = await fetch(JWKS_URL)
  const data = (await res.json()) as { keys: Jwk[] }
  const keys = new Map<string, CryptoKey>()
  for (const jwk of data.keys ?? []) {
    try {
      const key = await crypto.subtle.importKey(
        'jwk',
        { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      )
      keys.set(jwk.kid, key)
    } catch {
      /* 이 키만 건너뛴다 */
    }
  }
  cache = { keys, at: Date.now() }
  return keys
}

export interface VerifiedToken {
  uid: string
  email: string | null
}

/** 실패하면 null. 예외를 던지지 않는다 — 5xx 로 새어 나가면 엣지가 본문을 덮어쓴다. */
export async function verifyIdToken(
  authHeader: string | null,
  projectId: string | undefined,
): Promise<VerifiedToken | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0]))) as {
      kid?: string
      alg?: string
    }
    if (header.alg !== 'RS256' || !header.kid) return null

    const keys = await getKeys()
    const key = keys.get(header.kid)
    if (!key) return null

    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    )
    if (!ok) return null

    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1]))) as {
      aud?: string
      iss?: string
      sub?: string
      exp?: number
      email?: string
    }
    const now = Math.floor(Date.now() / 1000)
    if (!claims.sub) return null
    if (claims.exp && claims.exp < now) return null
    if (projectId) {
      if (claims.aud !== projectId) return null
      if (claims.iss !== `https://securetoken.google.com/${projectId}`) return null
    }
    return { uid: claims.sub, email: claims.email ?? null }
  } catch {
    return null
  }
}

/**
 * 모든 응답은 오류여도 HTTP 200 + JSON.
 * 5xx 를 던지면 Cloudflare 엣지가 본문을 평문 `error code: 502` 로 덮어써
 * 진짜 원인이 화면에서도 로그에서도 보이지 않는다.
 */
export function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export function fail(message: string): Response {
  return json({ ok: false, message })
}

/** 분당 호출 한도. 아주 단순한 메모리 카운터. */
const hits = new Map<string, number[]>()

export function rateLimited(key: string, perMin: number): boolean {
  const now = Date.now()
  const window = now - 60_000
  const list = (hits.get(key) ?? []).filter((t) => t > window)
  if (list.length >= perMin) {
    hits.set(key, list)
    return true
  }
  list.push(now)
  hits.set(key, list)
  return false
}

/**
 * AI 프록시 핵심 로직.
 *
 * Pages Function 은 껍데기만 담당하고 실제 판단은 전부 여기 있다.
 *
 * 실전에서 얻은 세 가지 (지시서 2.3):
 *
 * ① Cloudflare 엣지에서 AI Studio 를 쓰지 않는다. Vertex AI 를 쓴다.
 *    generativelanguage.googleapis.com 은 아웃바운드가 미지원 지역(홍콩 등)을 경유하면
 *    400 FAILED_PRECONDITION "User location is not supported" 를 간헐적으로 뱉는다.
 *    재시도나 결제로 해결되지 않는다. aiplatform.googleapis.com(Vertex AI)은
 *    요청/응답 형식이 같고 호출자 위치 검사가 없다.
 *
 * ② AI 응답은 실패해도 HTTP 200 + JSON 으로 돌려준다.
 *    함수가 5xx 를 던지면 Cloudflare 엣지가 본문을 평문 `error code: 502` 로 덮어써
 *    진짜 원인이 화면에서도 로그에서도 보이지 않는다.
 *
 * ③ 모델명을 하드코딩하지 않는다. GEN_AI_MODEL 환경 변수로 바꾼다.
 *
 * 그리고 이 앱의 규칙 (지시서 14절):
 *  · 허용 taskId 를 서버 화이트리스트로 고정한다. 목록에 없으면 거부.
 *  · 클라이언트가 프롬프트 원문을 보내지 못한다. 템플릿은 여기 있다.
 *  · 학생 이름·학번·닉네임을 프롬프트에 넣지 않는다.
 *  · AI 가 점수를 매기지 않는다.
 */

export const DEFAULT_MODEL = 'gemini-2.5-flash-lite'
export const DEFAULT_LOCATION = 'us-central1'

export interface Env {
  /** Vertex AI + Identity Toolkit 공용 서비스 계정 JSON */
  GCP_SERVICE_ACCOUNT?: string
  GEN_AI_MODEL?: string
  GEN_AI_LOCATION?: string
  AI_RATE_PER_MIN?: string
  FIREBASE_PROJECT_ID?: string
}

export interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}

/* ─────────────────────────── 인증 ─────────────────────────── */

function b64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const bin = atob(body)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

/**
 * 서비스 계정 → RS256 JWT (WebCrypto) → OAuth2 액세스 토큰.
 *
 * 이 코드를 비밀번호 초기화용 Identity Toolkit 호출에도 그대로 재사용한다.
 * firebase-admin 패키지는 Node 전용이라 Workers 에서 동작하지 않으므로 설치하지 않는다.
 */
export async function getAccessToken(sa: ServiceAccount, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  )
  const signingInput = `${header}.${claim}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key.replace(/\\n/g, '\n')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  )
  const jwt = `${signingInput}.${b64url(sig)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = (await res.json()) as { access_token?: string; error_description?: string }
  if (!data.access_token) {
    throw new Error(`OAuth2 토큰을 받지 못했습니다: ${data.error_description ?? '알 수 없음'}`)
  }
  return data.access_token
}

export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null
  try {
    const sa = JSON.parse(raw) as ServiceAccount
    if (!sa.client_email || !sa.private_key) return null
    return sa
  } catch {
    return null
  }
}

/* ─────────────────────────── 프롬프트 템플릿 ─────────────────────────── */

/**
 * 허용된 작업만. 목록에 없으면 거부한다.
 * 클라이언트는 taskId 와 inputs 만 보낸다. 프롬프트 원문을 보낼 수 없다.
 */
export const TASKS = {
  'recall-probe': {
    label: '되묻기',
    system:
      '너는 예비 과학교사의 수업 설계를 돕는 조교다. 정답을 주지 않고, 판정하지 않고, 점수를 매기지 않는다. ' +
      '아래 네 줄 형식으로만 답한다.\n' +
      'GOOD: 학생이 쓴 것 중 근거로 쓸 만한 대목 한 가지\n' +
      'THINK: 아직 드러나지 않은 지점 한 가지\n' +
      'SUGGEST: 지금 바로 할 수 있는 수정 행동 한 가지\n' +
      'ASK: 물음표로 끝나는 한 문장. 답을 주지 말고 되묻기만 한다.',
    build: (i: Record<string, string>) =>
      `단계: ${i.context ?? '(없음)'}\n학습자가 쓴 이유:\n${i.reason ?? '(없음)'}`,
    maxInput: 2000,
  },
  'cluster-responses': {
    label: '응답 유형 묶기',
    system:
      '너는 교사가 학생 응답을 해석하도록 돕는 조교다. 정답률을 계산하지 않고 점수를 매기지 않는다. ' +
      '응답을 3~5개 유형으로 묶고 각 묶음에 이름과 대표 문장을 붙인다. ' +
      '이것은 제안일 뿐이며 교사가 합치고 나누고 이름을 바꿀 수 있다고 마지막 줄에 적는다.\n' +
      'GOOD / THINK / SUGGEST / ASK 네 줄 형식을 지킨다.',
    build: (i: Record<string, string>) =>
      `문항: ${i.question ?? '(없음)'}\n익명 응답 묶음:\n${i.responses ?? '(없음)'}`,
    maxInput: 8000,
  },
  'exit-self-check': {
    label: '자기 점검 기준',
    system:
      '너는 학습자가 스스로 점검하도록 기준만 제시하는 조교다. ' +
      '학습자의 문장을 평가하지도, 고쳐 쓰지도, 점수를 매기지도 않는다. ' +
      "'이것이 학습의 증거인가'를 판단할 기준 세 개를 제시한다.\n" +
      'GOOD / THINK / SUGGEST / ASK 네 줄 형식을 지킨다.',
    build: (i: Record<string, string>) => `단계: ${i.context ?? '(없음)'}`,
    maxInput: 1000,
  },
  'ai-audit-source': {
    label: '주장 단위로 쪼개기',
    system:
      '너는 주어진 글을 검증 가능한 주장 단위로 나누기만 하는 조교다. ' +
      '각 주장이 참인지 거짓인지 판정하지 않는다. 어떤 자료가 있어야 판단할 수 있는지만 적는다.\n' +
      'GOOD / THINK / SUGGEST / ASK 네 줄 형식을 지킨다.',
    build: (i: Record<string, string>) => `검토할 글:\n${i.text ?? '(없음)'}`,
    maxInput: 4000,
  },
  'rubric-language-check': {
    label: '모호한 표현 찾기',
    system:
      '너는 루브릭 기술어에서 사람마다 다르게 읽힐 구절을 찾아 표시하는 조교다. ' +
      '점수를 매기지 않는다. 대안 문구는 예시로만 제시하고 교사가 고른다.\n' +
      'GOOD / THINK / SUGGEST / ASK 네 줄 형식을 지킨다.',
    build: (i: Record<string, string>) => `루브릭 기술어:\n${i.rubric ?? '(없음)'}`,
    maxInput: 4000,
  },
} as const

export type TaskId = keyof typeof TASKS

/** 개인정보로 보이는 문자열을 프롬프트에 넣지 않는다. */
export function scrubPersonalInfo(text: string): string {
  return text
    // 학번처럼 보이는 8자리 이상 숫자
    .replace(/\b\d{8,}\b/g, '[번호]')
    // 이메일
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[메일]')
    // 전화번호
    .replace(/\b01[016-9][-. ]?\d{3,4}[-. ]?\d{4}\b/g, '[전화]')
}

/* ─────────────────────────── Vertex AI 호출 ─────────────────────────── */

export interface AiResponse {
  ok: boolean
  message?: string
  text?: string
  model?: string
}

export async function generate(
  env: Env,
  taskId: string,
  inputs: Record<string, string>,
): Promise<AiResponse> {
  // 화이트리스트. 목록에 없으면 거부한다.
  if (!(taskId in TASKS)) {
    return { ok: false, message: `허용되지 않은 작업입니다: ${taskId}` }
  }
  const task = TASKS[taskId as TaskId]

  const sa = parseServiceAccount(env.GCP_SERVICE_ACCOUNT)
  if (!sa) {
    return {
      ok: false,
      message: 'AI 설정이 없습니다. 이 활동은 AI 없이도 그대로 진행됩니다.',
    }
  }

  const model = env.GEN_AI_MODEL || DEFAULT_MODEL
  const location = env.GEN_AI_LOCATION || DEFAULT_LOCATION
  const project = sa.project_id || env.FIREBASE_PROJECT_ID

  // 입력에서 개인정보를 지우고 길이를 자른다.
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(inputs ?? {})) {
    clean[k] = scrubPersonalInfo(String(v ?? '')).slice(0, task.maxInput)
  }

  try {
    const token = await getAccessToken(sa, 'https://www.googleapis.com/auth/cloud-platform')

    // AI Studio 가 아니라 Vertex AI. 호출자 위치 검사가 없다.
    const url =
      `https://${location}-aiplatform.googleapis.com/v1/projects/${project}` +
      `/locations/${location}/publishers/google/models/${model}:generateContent`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: task.system }] },
        contents: [{ role: 'user', parts: [{ text: task.build(clean) }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
      }),
    })

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      error?: { message?: string }
    }

    if (data.error) {
      return { ok: false, message: `모델 호출 실패: ${data.error.message ?? '알 수 없음'}` }
    }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text.trim()) {
      return { ok: false, message: '모델이 빈 응답을 돌려주었습니다.' }
    }
    return { ok: true, text, model }
  } catch (err) {
    return { ok: false, message: `AI 호출 중 오류: ${(err as Error).message}` }
  }
}

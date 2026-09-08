/**
 * npm run check:ai
 *
 * AI 도움이 실제로 도는지 한 번 호출해 확인한다.
 *
 * ── 왜 필요한가 ──
 * AI 기능은 코드가 멀쩡해도 코드 밖에서 막힌다. 실제로 겪은 순서가 이랬다.
 *   ① Vertex AI API 가 꺼져 있었다        → 403 API has not been used in project
 *   ② 결제 계정이 없었다                   → 호출 자체가 안 된다 (무료 등급이 없다)
 *   ③ 서비스 계정에 Vertex AI 사용자 역할이 없었다 → 403 permission
 *   ④ 그 지역에 그 모델이 없었다            → 404
 * 검증기 13종은 이 중 아무것도 잡지 못한다. 소스는 멀쩡하기 때문이다.
 *
 * ★ 이 검사는 돈이 든다. 한 번만 부른다.
 *   앱이 쓰는 그 코드(shared/ai-core.ts)를 그대로 부른다 —
 *   검사용으로 다시 쓴 코드를 검사하면 아무것도 보장하지 않는다.
 *
 * 실행:  npm run check:ai
 */
import { readFile } from 'node:fs/promises'

/** .env 에서 한 값만 꺼낸다. 따옴표로 감싼 여러 줄 값도 읽는다. */
async function readEnvValue(name) {
  let raw = ''
  try {
    raw = await readFile('.env', 'utf8')
  } catch {
    return null
  }
  /*
   * String.raw 를 쓴다. 보통 템플릿 문자열에서는 \r \n 이 진짜 줄바꿈 문자가 되고
   * \S 는 그냥 S 가 되어, 값에 S 만 나와도 거기서 끊긴다.
   * \s 를 쓰지 않는 이유는 따로 있다 — 그것은 줄바꿈까지 먹어 다음 줄을 값으로 가져온다.
   */
  const m = raw.match(new RegExp(String.raw`^${name}[^\S\r\n]*=[^\S\r\n]*(.*)$`, 'm'))
  if (!m) return null
  let v = m[1].trim()
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
    v = v.slice(1, -1)
  }
  return v
}

const sa = await readEnvValue('GCP_SERVICE_ACCOUNT')
if (!sa) {
  console.log('')
  console.log('  .env 의 GCP_SERVICE_ACCOUNT 가 비어 있어 건너뜁니다.')
  console.log('  키를 Cloudflare 의 런타임 Secret 에만 두는 것이 맞습니다.')
  console.log('  그러면 이 검사로는 확인할 수 없고, 배포된 화면에서 눌러 봐야 합니다.')
  console.log('')
  process.exit(0)
}

const { generate } = await import('../shared/ai-core.ts')

const env = {
  GCP_SERVICE_ACCOUNT: sa,
  GEN_AI_MODEL: (await readEnvValue('GEN_AI_MODEL')) || undefined,
  GEN_AI_LOCATION: (await readEnvValue('GEN_AI_LOCATION')) || undefined,
  FIREBASE_PROJECT_ID: (await readEnvValue('FIREBASE_PROJECT_ID')) || undefined,
}

console.log('\n  모델   ', env.GEN_AI_MODEL || '(기본값)')
console.log('  지역   ', env.GEN_AI_LOCATION || '(기본값)')
console.log('  한 번만 부릅니다. 이 호출은 요금이 붙습니다.\n')

const t0 = Date.now()
const res = await generate(env, 'recall-probe', {
  context: '드라이아이스를 따뜻한 물에 넣자 하얀 것이 올라왔다',
  answer: '연기가 신기했다',
})
const ms = Date.now() - t0

if (res.ok) {
  console.log(`  ✓ AI 호출 성공 (${ms}ms · ${res.model})`)
  console.log(`    돌려준 말: ${String(res.text).replace(/\s+/g, ' ').slice(0, 90)}…\n`)
  process.exit(0)
}

console.error(`  ✗ AI 호출 실패 (${ms}ms)`)
console.error(`    ${res.message}\n`)

/* 자주 나오는 원인은 여기서 바로 다음에 할 일을 알려 준다. */
const m = String(res.message)
if (/has not been used in project|is disabled/.test(m)) {
  console.error('    → Vertex AI API 가 꺼져 있습니다. 구글 클라우드 콘솔에서 켜 주세요.')
} else if (/billing|BILLING/i.test(m)) {
  console.error('    → 프로젝트에 결제 계정이 없습니다. Vertex AI 는 무료 등급이 없습니다.')
} else if (/permission|PERMISSION_DENIED/i.test(m)) {
  console.error('    → 서비스 계정에 「Vertex AI 사용자」 역할이 없습니다.')
} else if (/not found|NOT_FOUND|404/i.test(m)) {
  console.error('    → 그 지역에 그 모델이 없습니다. GEN_AI_MODEL·GEN_AI_LOCATION 을 확인하세요.')
} else if (/quota|RESOURCE_EXHAUSTED|429/i.test(m)) {
  console.error('    → 할당량입니다. 잠시 뒤 다시 부르거나 한도를 올려 주세요.')
}
process.exit(1)

/**
 * npm run verify:api
 *
 * 서버 함수를 부를 때 인증 토큰을 빠뜨리지 않았는가.
 *
 * functions/api/* 는 전부 Authorization 헤더의 Firebase ID 토큰으로 호출자를 확인한다.
 * 헤더가 없으면 「로그인이 필요합니다」가 오는데, 그 응답은 5xx 가 아니라 200 + JSON 이라
 * 화면에서는 그냥 안내 문구로 보인다. 오류처럼 보이지 않는다.
 *
 * 실제로 여섯 군데가 전부 그렇게 죽어 있었다 —
 * AI 도우미 · 응답 유형 묶기 · 계정 일괄 생성 · 비밀번호 초기화 · 서버 시드.
 * 사다리는 폴백이 있어 더 오래 숨었고, 「계정 만들기」를 눌러 보고서야 드러났다.
 *
 * 그래서 규칙은 하나다 — 서버 호출은 src/lib/api.ts 의 apiPost 만 쓴다.
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report, walk } from './_report.mjs'

/** 윈도우 경로의 역슬래시를 통일한다. */
const SEP = String.fromCharCode(92)
const norm = (p) => p.split(SEP).join('/')

const files = await walk('src', ['.ts', '.tsx'])

/* ── ① 화면 코드가 /api 를 직접 부르지 않는다 ── */
{
  let direct = 0
  for (const file of files) {
    if (norm(file).endsWith('src/lib/api.ts')) continue // 여기가 유일한 통로다
    const code = await readFile(file, 'utf8')
    for (const m of code.matchAll(/fetch\(\s*[`'"]\/api\//g)) {
      const line = code.slice(0, m.index).split('\n').length
      fail(
        '직접 호출',
        `${norm(file)}:${line} 이 fetch('/api/…') 를 직접 부른다 — apiPost 를 쓰면 토큰이 붙는다`,
      )
      direct++
    }
  }
  if (direct === 0) {
    pass('직접 호출', `${files.length}개 파일 어디서도 fetch('/api/…') 를 직접 부르지 않는다`)
  }
}

/* ── ② 통로가 실제로 토큰을 붙이는가 ── */
{
  const api = await readFile('src/lib/api.ts', 'utf8')
  const needs = [
    ['getIdToken', 'Firebase ID 토큰을 가져오지 않는다'],
    ['authorization', 'Authorization 헤더를 붙이지 않는다'],
    ['Bearer ', 'Bearer 형식이 아니다 — 서버가 Bearer 접두사를 요구한다'],
  ]
  let broken = 0
  for (const [needle, why] of needs) {
    if (!api.includes(needle)) {
      fail('토큰', `src/lib/api.ts 가 ${why}`)
      broken++
    }
  }
  if (broken === 0) pass('토큰', 'apiPost 가 Firebase ID 토큰을 Bearer 로 붙인다')
}

/* ── ③ 서버 쪽은 전부 호출자를 확인하는가 ── */
{
  const fns = (await walk('functions/api', ['.ts'])).filter((f) => !norm(f).includes('/_lib/'))
  let open = 0
  for (const file of fns) {
    const code = await readFile(file, 'utf8')
    if (!code.includes('verifyIdToken')) {
      fail('열린 서버 함수', `${norm(file)} 이 호출자를 확인하지 않는다`)
      open++
    }
  }
  if (open === 0) {
    pass('열린 서버 함수', `서버 함수 ${fns.length}개가 모두 verifyIdToken 으로 호출자를 확인한다`)
  }
}

report('verify:api')

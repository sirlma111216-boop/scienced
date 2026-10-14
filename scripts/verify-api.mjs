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
    /* 사람이 부르는 함수는 ID 토큰으로, 서버끼리(게임 서버 → 결과 webhook)는 공유 비밀 서명으로 확인한다 */
    const signed = code.includes('verifyLumiSignature')
    /* 교과서 — 길 파일은 _lib/textbook 의 처리기에 넘기기만 한다. 그 처리기가 토큰(강사·로그인) 또는 서명된 주소로 확인한다 (아래 ④) */
    const delegated = /from '\.\.\/_lib\/textbook'/.test(code) && /=> handle[A-Z]\w*\(ctx\.env, ctx\.request\)/.test(code)
    if (!code.includes('verifyIdToken') && !signed && !delegated) {
      fail('열린 서버 함수', `${norm(file)} 이 호출자를 확인하지 않는다`)
      open++
    }
  }
  if (open === 0) {
    pass('열린 서버 함수', `서버 함수 ${fns.length}개가 모두 ID 토큰(사람) 또는 서명(서버끼리)으로 호출자를 확인한다`)
  }
}

/* ── ④ 교과서 처리기가 실제로 호출자를 확인하는가 (2026-10-14) ── */
{
  const lib = await readFile('functions/api/_lib/textbook.ts', 'utf8')
  const fnBody = (name) => {
    const at = lib.indexOf(`export async function ${name}(`)
    if (at < 0) return ''
    const next = lib.indexOf('\nexport ', at + 10)
    return lib.slice(at, next < 0 ? undefined : next)
  }
  let bad = 0
  for (const name of ['handleConfig', 'handleSave', 'handlePublish', 'handleReorder', 'handleDelete', 'handleUpload']) {
    if (!/await instructorOnly\(env, request\)/.test(fnBody(name))) {
      fail('교과서 강사 확인', `${name} 이 강사를 확인하지 않는다`)
      bad++
    }
  }
  if (!/await caller\(env, request\)/.test(fnBody('handleReadUrl'))) {
    fail('교과서 로그인 확인', 'handleReadUrl 이 로그인을 확인하지 않는다')
    bad++
  }
  if (!/sameText\(want, sig\)/.test(fnBody('handleFile')) || !/now > exp/.test(fnBody('handleFile'))) {
    fail('교과서 서명 주소', 'handleFile 이 서명과 만료를 확인하지 않는다')
    bad++
  }
  if (!/verifyIdToken\(/.test(lib) || !/isInstructorUid\(/.test(lib)) {
    fail('교과서 강사 확인', '_lib/textbook 이 ID 토큰 · instructors 문서로 판정하지 않는다')
    bad++
  }
  if (bad === 0) pass('교과서', '관리 처리기 6개는 강사를, 읽기 주소는 로그인을, 파일은 서명·만료를 확인한다')
}

report('verify:api')

/**
 * npm run verify:wording
 *
 * 이 앱의 뿌리인 「거꾸로 설계 연수실」은 하루짜리 연수용이었다.
 * 그 앱의 말은 하루를 전제한다 — 퇴실표, 참가자, 담벼락, 150분.
 * 여기는 같은 서른 명이 열여덟 주를 함께 가는 학기 강의다. 그 말들이 남아 있으면
 * 학생은 매주 「퇴실」하고 매주 「참가」하게 된다.
 *
 * 그래서 두 가지를 본다.
 *   ① 하루짜리 연수의 말이 화면 문구에 남아 있지 않은가
 *   ② 이름을 바꾼 단계가 어느 한 군데서 옛 이름으로 남지 않았는가
 *
 * ②는 문자열 검색으로 끝내지 않는다. 실제 단계 목록과 타임라인을 맞춰 본다.
 * 열여덟 차시 중 한 곳만 놓쳐도 그 차시의 타임라인 링크가 죽는데,
 * 화면을 열어 보기 전에는 아무도 모른다.
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report, walk } from './_report.mjs'
import { allLessons, where } from './_courses.mjs'

/**
 * 다른 뜻으로 쓸 일이 없는 말. 화면 문구에 있으면 무조건 연수용 잔재다.
 */
const BANNED_ANYWHERE = [
  '퇴실표',
  '퇴실',
  '워크숍',
  '워크샵',
  '연수생',
  '참가자님',
  '참가자 여러분',
  '담벼락',
]

/**
 * 다른 뜻으로도 쓰이는 말. 예를 들어 「참가자」는 12강의 연구 사례
 * (“참가자 20명 중 16명이 …”)에서 정당하게 쓰인다.
 * 그래서 화면에 이름표로 붙는 자리에서만 막는다.
 */
const BANNED_AS_LABEL = ['참가자', '교시', '세션', '연수']
const LABEL_KEYS = ['label', 'title', 'button', 'blurb', 'lead', 'help', 'placeholder', 'prompt', 'askLine']

/** 이름을 바꾼 뒤 남아 있으면 안 되는 옛 id. */
const RETIRED_IDS = ['step-exit', 'exit-self-check']

/**
 * 옛 id 를 일부러 남겨 둔 곳.
 *   · 마이그레이션 스크립트는 옛 자료를 새 id 로 옮기려고 옛 id 를 알아야 한다.
 *   · AI 프록시는 배포 순간에 이미 열려 있던 화면이 보내는 옛 id 를 받아 준다.
 */
const RETIRED_ID_ALLOWED = [
  'scripts/migrate-to-classes.mjs',
  'functions/api/ai/generate.ts',
  'scripts/verify-wording.mjs', // 무엇을 금지하는지 적어야 하는 파일
]

/** 주석은 화면에 나가지 않는다. 규칙을 설명하려면 금지어를 적어야 하므로 지우고 본다. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const norm = (p) => p.replace(/\\/g, '/')

/* ── ① 하루짜리 연수의 말 ── */

const files = [
  ...(await walk('src', ['.ts', '.tsx'])),
  ...(await walk('shared', ['.ts'])),
  ...(await walk('functions', ['.ts'])),
]

let bannedHits = 0

for (const file of files) {
  const code = stripComments(await readFile(file, 'utf8'))

  for (const word of BANNED_ANYWHERE) {
    const at = code.indexOf(word)
    if (at === -1) continue
    const around = code.slice(Math.max(0, at - 30), at + 30).replace(/\s+/g, ' ')
    fail('연수용 어휘', `${norm(file)} 에 「${word}」 — …${around}…`)
    bannedHits++
  }

  // 이름표 자리에 붙은 말만 본다: label: '…참가자…'
  for (const word of BANNED_AS_LABEL) {
    const re = new RegExp(`\\b(${LABEL_KEYS.join('|')})\\s*:\\s*['"\`][^'"\`]*${word}`, 'g')
    for (const m of code.matchAll(re)) {
      fail('연수용 어휘', `${norm(file)} 의 ${m[1]} 문구에 「${word}」 — ${m[0].slice(0, 60)}`)
      bannedHits++
    }
  }
}

if (bannedHits === 0) {
  pass(
    '연수용 어휘',
    `${files.length}개 파일에 하루짜리 연수의 말 ${BANNED_ANYWHERE.length + BANNED_AS_LABEL.length}종이 없다`,
  )
}

/* ── ② 옛 id 가 남지 않았는가 ── */

let retiredHits = 0
const allFiles = [...files, ...(await walk('scripts', ['.mjs'])), 'firestore.rules']

for (const file of allFiles) {
  if (RETIRED_ID_ALLOWED.includes(norm(file))) continue
  let code
  try {
    code = await readFile(file, 'utf8')
  } catch {
    continue
  }
  for (const id of RETIRED_IDS) {
    if (code.includes(id)) {
      fail('옛 id', `${norm(file)} 에 「${id}」 가 남아 있다`)
      retiredHits++
    }
  }
}

if (retiredHits === 0) {
  pass('옛 id', `${RETIRED_IDS.join(' · ')} 가 코드에 없다 (마이그레이션·구버전 수신부만 예외)`)
}

/* ── ⑤ 화면에 「○분」을 쓰지 않는다 (3차 D) ── */

/*
 * 진행 시간은 강의자가 그 자리에서 판단한다. 화면에 5분·10분이 박혀 있으면
 * 그것이 계획이 아니라 약속처럼 읽힌다 — 50분 반과 1시간 반이 같은 화면을 보는데도 그렇다.
 * durationMinutes 데이터는 그대로 둔다. 화면에만 나가지 않는다.
 *
 * 단, 교재 내용 안의 시간은 다르다. 「45분 수업」·「8~10분 마이크로티칭」은
 * 예비교사가 설계할 중등 수업의 길이이지 이 앱의 진행 시간이 아니다.
 * 그런 줄에는 바로 위나 같은 줄에 `wording-ok: 이유` 를 적는다.
 */
/*
 * 「분」이 시간 단위일 때만 잡는다.
 * 「수업 시간의 3분할」처럼 뒤에 다른 글자가 붙어 낱말이 되는 경우는 시간이 아니다.
 * 조사(5분으로 · 20분간)는 그대로 잡혀야 하므로 한글 전체를 배제할 수는 없다.
 */
const MINUTES_RE = /\d+\s*분(?![할석포류기리명명수자모단야위담열화산업])/

/** 주석 자리를 공백으로 바꿔 줄 번호와 길이를 유지한다. 주석은 화면에 나가지 않는다. */
function blankComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
}

let minuteHits = 0
let exempted = 0

for (const file of files) {
  const raw = await readFile(file, 'utf8')
  const rawLines = raw.split('\n')
  const codeLines = blankComments(raw).split('\n')

  for (let i = 0; i < codeLines.length; i++) {
    if (!MINUTES_RE.test(codeLines[i])) continue
    // 같은 줄이나 바로 윗줄의 면제 표시를 인정한다
    const waiver = /wording-ok:\s*\S/.test(rawLines[i]) || /wording-ok:\s*\S/.test(rawLines[i - 1] ?? '')
    if (waiver) {
      exempted++
      continue
    }
    fail(
      '화면의 분 표시',
      `${norm(file)}:${i + 1} 「${codeLines[i].match(MINUTES_RE)[0]}」 — ${rawLines[i].trim().slice(0, 70)}`,
    )
    minuteHits++
  }
}

if (minuteHits === 0) {
  pass(
    '화면의 분 표시',
    `화면 문구에 「○분」이 없다 (교재 내용으로 인정한 ${exempted}곳은 wording-ok 로 남겼다)`,
  )
}

/*
 * ── 8차 A.2 · 9절 — 새 골격 차시의 글 규칙 ──
 * 비유 · 구호 · 다짐 · 감탄 · 장식 기호 · 붙인 이름 · 교재 냄새 · 앞 차시 번호 · 어미 · 문장 길이.
 * 규칙 본문은 scripts/_wording-rules.mjs 에 있다. layout 이 있는(8차 골격) 차시에만 실패로 걸리고,
 * 옛 차시는 개수만 알린다 — F·G 에서 통째로 다시 쓰기 때문이다.
 */
{
  const { checkText, studentStrings } = await import('./_wording-rules.mjs')
  let hits = 0
  let checked = 0
  for (const lesson of await allLessons()) {
    checked += 1
    for (const [at, text, theory] of studentStrings(lesson)) {
      for (const problem of checkText(text, { theory, lessonOrder: lesson.order })) {
        hits += 1
        if (hits <= 60) fail('8차 글 규칙', `${where(lesson)} ${at} — ${problem}`)
      }
    }
  }
  if (hits > 60) fail('8차 글 규칙', `… 그리고 ${hits - 60}곳 더`)
  if (hits === 0) pass('8차 글 규칙', `${checked}개 차시에 비유·구호·다짐·감탄·장식 기호·교재 냄새·금지 어미·60자 초과 문장·5문장 문단이 없다`)
}

report('verify:wording')

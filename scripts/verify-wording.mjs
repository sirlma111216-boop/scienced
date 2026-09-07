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
import { LESSONS } from '../src/content/lessons/index.ts'
import { WRAPUP_LABEL } from '../src/content/types.ts'

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

/* ── ③ 마지막 단계가 열여덟 차시 모두에서 같은 이름인가 ── */

for (const l of LESSONS) {
  const last = l.steps[l.steps.length - 1]
  if (last.id !== 'step-wrapup') {
    fail('마무리 단계', `${l.id}강의 마지막 단계 id 가 step-wrapup 이 아니라 ${last.id} 다`)
  }
  if (last.title !== WRAPUP_LABEL) {
    fail('마무리 단계', `${l.id}강의 마지막 단계 이름이 「${WRAPUP_LABEL}」가 아니라 「${last.title}」다`)
  }
  if (!l.flowSummary.includes(WRAPUP_LABEL)) {
    fail('마무리 단계', `${l.id}강의 흐름 요약에 「${WRAPUP_LABEL}」가 없다 — ${l.flowSummary}`)
  }
}
pass('마무리 단계', `18개 차시의 마지막 단계가 모두 step-wrapup · 「${WRAPUP_LABEL}」다`)

/* ── ④ 타임라인이 가리키는 단계가 실제로 있는가 ── */

let danglingLinks = 0
for (const l of LESSONS) {
  const stepIds = new Set(l.steps.map((s) => s.id))
  for (const item of l.timeline) {
    if (!stepIds.has(item.stepId)) {
      fail('타임라인 링크', `${l.id}강 타임라인의 「${item.label}」가 없는 단계 ${item.stepId} 를 가리킨다`)
      danglingLinks++
    }
  }
  const lastItem = l.timeline[l.timeline.length - 1]
  if (lastItem.label !== WRAPUP_LABEL) {
    fail('타임라인 링크', `${l.id}강 타임라인의 마지막 이름이 「${lastItem.label}」다`)
    danglingLinks++
  }
}
if (danglingLinks === 0) {
  pass('타임라인 링크', '모든 차시의 타임라인이 실제로 있는 단계를 가리킨다 — 이름을 바꾸다 만 곳이 없다')
}

report('verify:wording')

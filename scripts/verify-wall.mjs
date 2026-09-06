/**
 * npm run verify:wall
 *
 * 의견 광장이 각 차시 2개 이상 단계에 붙어 있는지, 인기순 정렬 코드가 없는지.
 *
 * 컨텍스트 19.7이 "좋아요 중심 인기 평가"를 금지한다. 같은 30명이 18주를 함께 가는
 * 강의에서 인기 순위는 굳는다. 14강이 다루는 참여 형평성과도 정면으로 부딪힌다.
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report, walk } from './_report.mjs'

const { LESSONS } = await import('../src/content/lessons/index.ts')
const { REACTIONS, WALL_SORTS } = await import('../src/content/reactions.ts')

// 1. 차시마다 두 단계 이상
for (const l of LESSONS) {
  const wallSteps = l.steps.filter((s) => s.wall?.enabled)
  if (wallSteps.length < 2) {
    fail('배치', `${l.id}강 의견 광장이 ${wallSteps.length}개 단계에만 있다 (2개 이상 필요)`)
  }
  for (const s of wallSteps) {
    if (!s.wall.prompt || s.wall.prompt.trim().length < 5) {
      fail('안내 문구', `${l.id}강 ${s.id} 의견 광장에 안내 문구가 없다`)
    }
    // 본인이 제출하기 전에는 열리지 않아야 한다 (컨텍스트 15.2)
    if (!s.wall.opensAfterSubmit) {
      fail('제출 후 공개', `${l.id}강 ${s.id} 의견 광장이 제출 전에 열린다`)
    }
  }
}
pass('배치', '모든 차시에서 의견 광장이 두 단계 이상에 붙어 있고, 제출 후에만 열린다')

// 2. 반응 4종, 좋아요 없음
if (REACTIONS.length !== 4) fail('반응 종류', `반응이 ${REACTIONS.length}종이다 (4종)`)
const LIKE_WORDS = ['like', 'heart', 'love', '좋아요', '하트', '공감']
for (const r of REACTIONS) {
  if (LIKE_WORDS.some((w) => r.key.toLowerCase().includes(w) || r.label.includes(w))) {
    fail('좋아요 금지', `반응 「${r.label}」 이 좋아요 계열이다`)
  }
  // 색만으로 구분하지 않도록 글자 표식이 있어야 한다
  if (!r.mark) fail('색만으로 구분 금지', `반응 「${r.label}」 에 글자 표식이 없다`)
}
pass('반응 4종', '좋아요 없이 결론·근거 요청·이견·변화 네 가지, 각각 글자 표식을 가진다')

// 3. 인기순 정렬이 없는가
const SORT_KEYS = WALL_SORTS.map((s) => s.key)
const POPULAR = ['popular', 'top', 'best', 'mostliked', 'hot', 'trending']
for (const k of SORT_KEYS) {
  if (POPULAR.includes(k.toLowerCase())) fail('인기순 금지', `정렬 옵션에 ${k} 가 있다`)
}
// 기본값이 '아직 반응이 없는 글 먼저' 인가
if (SORT_KEYS[0] !== 'unanswered') {
  fail('정렬 기본값', `기본 정렬이 ${SORT_KEYS[0]} 다 (unanswered 여야 한다)`)
}
pass('정렬', `인기순 없음, 기본값은 「${WALL_SORTS[0].label}」`)

// 4. 소스에 인기순 정렬 코드가 없는가
//    주석은 지우고 본다. 이 규칙을 설명하려면 금지된 말을 인용해야 하기 때문이다.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const files = [...(await walk('src', ['.ts', '.tsx']))]
const CODE_SMELLS = [
  /sort[\s\S]{0,40}(likes|reactions\.length|popularity)/i,
  /reactionCount[\s\S]{0,20}desc/i,
  /인기순/,
  /베스트\s*글/,
]
for (const file of files) {
  const code = stripComments(await readFile(file, 'utf8'))
  for (const re of CODE_SMELLS) {
    const m = code.match(re)
    if (m) {
      const at = code.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, ' ')
      fail('인기순 코드', `${file} 에 인기순 정렬로 보이는 코드가 있다: …${at}…`)
    }
  }
}
pass('인기순 코드', '소스에 반응 수로 정렬하는 코드가 없다')

// 5. 댓글 문장 틀과 길이
const { COMMENT_STARTERS, COMMENT_MAX } = await import('../src/content/reactions.ts')
if (COMMENT_STARTERS.length < 3) fail('문장 틀', `댓글 문장 틀이 ${COMMENT_STARTERS.length}개다 (3개)`)
if (COMMENT_MAX < 200) fail('댓글 길이', `댓글이 ${COMMENT_MAX}자 제한이다 (200자)`)
pass('댓글', `문장 틀 ${COMMENT_STARTERS.length}개, ${COMMENT_MAX}자까지`)

report('verify:wall')

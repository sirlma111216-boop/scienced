/**
 * npm run verify:games
 *
 * 18개 게임이 모두 등록되어 있고 mode 값이 서로 다른지, 1강이 ladder 모드인지.
 * 그리고 정답·오답을 기준으로 뽑는 규칙이 들어오지 않았는지.
 */
import { fail, pass, report } from './_report.mjs'

const { GAMES } = await import('../src/content/games.ts')
const { LESSONS } = await import('../src/content/lessons/index.ts')
const { LESSON_IDS } = await import('../src/content/types.ts')

// 1. 차시마다 하나씩, 18개
if (GAMES.length !== 18) fail('게임 수', `18개가 아니라 ${GAMES.length}개다`)
for (const id of LESSON_IDS) {
  const found = GAMES.filter((g) => g.lessonId === id)
  if (found.length !== 1) fail('차시별 1개', `${id}강 게임이 ${found.length}개다`)
}
pass('게임 수', '18개 차시에 게임이 하나씩 등록되어 있다')

// 2. mode 가 서로 다른가
const modes = GAMES.map((g) => g.mode)
const dupModes = modes.filter((m, i) => modes.indexOf(m) !== i)
if (dupModes.length > 0) fail('mode 중복', `${[...new Set(dupModes)].join(', ')} 가 중복된다`)
pass('mode 고유성', `18종 mode 가 모두 다르다`)

// 3. 1강은 ladder — 기존 검증된 구현을 그대로 쓴다
const g01 = GAMES.find((g) => g.lessonId === '01')
if (!g01 || g01.mode !== 'ladder') {
  fail('1강 사다리', `1강 mode 가 ${g01?.mode} 다 (ladder 여야 한다)`)
}
if (g01 && g01.winnerCount !== 2) {
  fail('1강 발표자 수', `1강 발표자가 ${g01.winnerCount}명이다 (기존 동작대로 2명)`)
}
pass('1강 사다리', '1강은 ladder 모드, 발표자 2명 — 기존 구현 그대로')

// 4. id 가 고유하고 차시 접두사가 맞는가
const ids = new Set()
for (const g of GAMES) {
  if (ids.has(g.id)) fail('게임 id', `${g.id} 가 중복된다`)
  ids.add(g.id)
  if (!g.id.startsWith(`${g.lessonId}-`)) {
    fail('게임 id', `${g.id} 가 ${g.lessonId}강 접두사로 시작하지 않는다`)
  }
}
pass('게임 id', '모든 id 가 고유하고 차시 접두사를 따른다')

// 5. 필수 문구가 채워졌는가
for (const g of GAMES) {
  for (const f of ['tab', 'lead', 'hint', 'choiceField', 'reasonField', 'askLine', 'presenterAsk']) {
    if (!g[f] || String(g[f]).trim().length < 2) {
      fail('게임 문구', `${g.id} 의 ${f} 가 비었다`)
    }
  }
  if (g.winnerCount < 1) fail('게임 설정', `${g.id} 의 winnerCount 가 ${g.winnerCount} 다`)
  if (!['all', 'byResponseType', 'splitOpinion'].includes(g.candidateRule)) {
    fail('후보 규칙', `${g.id} 의 candidateRule 이 ${g.candidateRule} 다`)
  }
}
pass('게임 문구', '탭 이름·안내·힌트·발표 요청 문구가 모두 채워져 있다')

// 6. 정답을 기준으로 뽑는 규칙이 없는가 (지시서 10.1 · 16절 10번)
const FORBIDDEN_RULES = ['correct', 'wrong', 'incorrect', 'score', 'rank', '정답', '오답']
for (const g of GAMES) {
  if (FORBIDDEN_RULES.some((r) => g.candidateRule.toLowerCase().includes(r))) {
    fail('정답 기준 금지', `${g.id} 의 후보 규칙이 정답 여부를 쓴다`)
  }
}
pass('정답 기준 금지', '어떤 게임도 정답·오답으로 발표자를 지목하지 않는다')

// 7. 발표 횟수 가중치가 기본으로 켜져 있는가
const offCount = GAMES.filter((g) => !g.weightByFewPresentations).length
if (offCount > 0) {
  fail('참여 형평성', `${offCount}개 게임에서 발표 횟수 가중치가 꺼져 있다 (기본 켬)`)
}
// 14강은 가중치를 화면에 공개해야 한다 — 그것이 그날의 학습 내용이다
const g14 = GAMES.find((g) => g.lessonId === '14')
if (!g14?.revealWeights) {
  fail('14강 가중치 공개', '14강은 가중치를 화면에 드러내야 한다 (지시서 10.2)')
}
pass('참여 형평성', '가중치가 전부 켜져 있고, 14강은 그 가중치를 공개한다')

// 8. 차시 단계가 실제로 그 게임을 가리키는가
for (const l of LESSONS) {
  const pickerSteps = l.steps.filter((s) => s.picker?.enabled)
  if (pickerSteps.length !== 1) {
    fail('게임 배치', `${l.id}강에 게임이 붙은 단계가 ${pickerSteps.length}개다 (1개여야 한다)`)
    continue
  }
  const gid = pickerSteps[0].picker.gameId
  if (!GAMES.some((g) => g.id === gid)) {
    fail('게임 배치', `${l.id}강이 등록되지 않은 게임 ${gid} 를 가리킨다`)
  }
}
pass('게임 배치', '차시마다 정확히 한 단계에 등록된 게임이 붙어 있다')

report('verify:games')

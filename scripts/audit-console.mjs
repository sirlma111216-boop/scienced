/**
 * npm run audit:console
 *
 * 7차 지시서 작업 Q — 학생 화면의 블록과 진행 콘솔의 조작부를 대조한다.
 *
 *   학생 화면이 그리는 것(교재의 블록 정의)을 차시·단계별로 늘어놓고, 블록 종류마다
 *   Q.2 등록표가 요구하는 조작부를 콘솔이 지금 그리는지 적는다. 판정은 유지 / 삭제 / 추가.
 *
 *   결과는 docs/7차-콘솔-대조표.md 로 쓴다. 강의자가 확인한 뒤에야 콘솔을 고친다.
 *
 * ★ 2026-09-14 R-2 이후 콘솔은 등록표(src/lib/console-registry.ts)에서 그린다. 그래서 「지금 콘솔」 열은
 *   등록표를 그대로 읽는다 — 손으로 적은 옛 표(대조 시점의 Live.tsx)는 git 기록에 있다.
 *   verify:console 이 양방향으로 검사한다.
 */
import { writeFileSync } from 'node:fs'

const { LESSONS } = await import('../src/content/lessons/index.ts')
const { buildLessonView } = await import('../src/lib/tiers.ts')
const { DEFAULT_FORMATION_LESSONS } = await import('../src/content/group-games.ts')
const { CONTROLS, CONTROL_LABEL } = await import('../src/lib/console-registry.ts')

/* ── Q.2 등록표: 블록 종류 → 콘솔에 있어야 할 조작부 ── */
export const REGISTRY = {
  'stimulus·afterReveal': ['자료 공개 / 되돌리기'],
  stimulus: [],
  input: ['제출 현황', '응답 목록', '유형 묶기', '재응답 요청'],
  choice: ['제출 현황', '분포', '선택지별 명단', '재응답 요청'],
  sorter: ['개인·모둠별 배분 나란히 보기'],
  canvas: ['썸네일 격자', '크게 보기'],
  module: ['제출 현황', '응답 목록'],
  opinionWall: ['고정', '숨김', '유형 묶기', '갈린 글 표시'],
  ladder: ['후보 확인', '제외', '실행', '재추첨', '수동 지정'],
  groupGame: ['실행', '미리보기', '재배정', '수동 이동', '확정', '동석 기록'],
  groupBuild: ['개인·모둠별 배분 나란히 보기'],
  concepts: [],
  gateOpen: ['열기 / 닫기'],
  deferred: ['「수업 후 이어서」 제출 현황'],
}

/* ── 지금 콘솔 — 등록표(console-registry)에서 그대로 ── */
const KIND_OF = {
  'stimulus·afterReveal': 'stimulusReveal',
  stimulus: 'stimulus',
  input: 'input',
  choice: 'choice',
  sorter: 'sorter',
  canvas: 'canvas',
  module: 'module',
  opinionWall: 'opinionWall',
  ladder: 'ladder',
  groupGame: 'groupGame',
  groupBuild: 'groupBuild',
  concepts: 'concepts',
  gateOpen: 'gateOpen',
  deferred: 'deferred',
}
const LABEL_ALIAS = {
  '자료 공개 / 되돌리기': '자료 공개 / 되돌리기',
  '선택지별 명단': '선택지별 명단',
  '개인·모둠별 배분 나란히 보기': '개인·모둠별 나란히 보기',
  '썸네일 격자': '썸네일 격자',
  '크게 보기': '썸네일 격자',
  '후보 확인': '발표자 뽑기', '제외': '발표자 뽑기', '실행': '발표자 뽑기', '재추첨': '발표자 뽑기', '수동 지정': '발표자 뽑기',
  '미리보기': '모둠 나누기', '재배정': '모둠 나누기', '수동 이동': '모둠 나누기', '확정': '모둠 나누기', '동석 기록': '모둠 나누기',
}
const CONSOLE_NOW = Object.fromEntries(
  Object.entries(KIND_OF).map(([k, kind]) => [k, (CONTROLS[kind] ?? []).map((c) => CONTROL_LABEL[c])]),
)
/* 등록표의 이름과 Q.2 표의 이름이 다른 것은 별칭으로 맞춘다 (ladder·groupGame 은 조작부 하나가 여러 동작을 품는다) */
const has = (have, need) => have.some((h) => h.startsWith(need) || h === LABEL_ALIAS[need] || (need === '실행' && kindHasControl(have, need)))
function kindHasControl(have, need) {
  return have.includes('발표자 뽑기') || have.includes('모둠 나누기')
}

/* 콘솔에만 있고 학생 블록에 대응하지 않는 것 */
const CONSOLE_ONLY = [
  ['강사 대본 (MustSay · instructorScript)', '삭제함', 'R.5 — 2026-09-14 콘솔·학생 화면에서 뺐다. 필드는 남는다'],
  ['「분포를 보고 할 수 있는 것」 읽기 목록 (teacherNextMoves)', '바꿈', 'R.1 분기 단추(설명 추가 / 짝 토론 / 재응답 요청) — 누르면 학생 화면에 안내 카드'],
  ['「이 화면에 없는 것」 남색 블록', '삭제함', '조작부가 아니다'],
  ['「고쳐 쓴 답」 별도 목록', '흡수', 'R.2 개인 화면(v1·v2 나란히)'],
  ['타이머 (시작·해제)', '유지', '진행 바. 기본값은 비워 둔다 (3차 D.3)'],
  ['제출률 80% 안내문', '유지', '명단 열'],
]

const fieldKind = (f) => {
  if (f.kind === 'text' || f.kind === 'longtext') return 'input'
  if (f.kind === 'choice' || f.kind === 'multi' || f.kind === 'rank') return 'choice'
  if (f.kind === 'allocation' || f.kind === 'quadrant') return 'sorter'
  return 'input'
}
const moduleKind = (m) => (m === 'nodeCanvas' ? 'canvas' : m === 'cardSorter' ? 'sorter' : 'module')

function verdict(kind, extra = '') {
  const need = REGISTRY[kind] ?? []
  const have = CONSOLE_NOW[kind] ?? []
  const missing = need.filter((n) => !has(have, n))
  if (need.length === 0) return { need: '없음', have: have.join(' · ') || '없음', verdict: '유지' }
  return {
    need: need.join(' · '),
    have: have.join(' · ') || '없음',
    verdict: missing.length === 0 ? '유지' : `추가 — ${missing.join(' · ')}${extra}`,
  }
}

const rows = []
const formation = DEFAULT_FORMATION_LESSONS
for (const l of LESSONS) {
  const short = buildLessonView(l, 'short')
  for (const s of l.steps) {
    const push = (block, kind, gate, extra = '') => {
      const v = verdict(kind, extra)
      rows.push([l.id, `${s.order} ${s.shortTitle}`, block, kind, gate || '—', v.need, v.have, v.verdict])
    }
    if (s.order === 1 && formation.includes(l.id)) push('모둠 나누기 게임', 'groupGame', '—')
    for (const m of s.material ?? []) {
      const g = m.gate?.type ?? ''
      push(`자료 「${m.title}」`, g === 'afterReveal' ? 'stimulus·afterReveal' : 'stimulus', g)
    }
    if (s.conceptIds?.length) push(`개념 카드 ${s.conceptIds.length}장`, 'concepts', '—')
    if (s.moduleComponent) push(`전용 모듈 ${s.moduleComponent}`, moduleKind(s.moduleComponent), '—')
    for (const f of s.fields) {
      const g = f.gate?.type ?? ''
      const kind = fieldKind(f)
      const extra = kind === 'choice' && s.fields.filter((x) => fieldKind(x) === 'choice').indexOf(f) > 0 ? ' (두 번째 선택형 칸은 분포도 없다)' : ''
      push(`칸 「${f.label}」 (${f.kind})`, kind, g, extra)
      if (g === 'afterInstructorOpen') push(`  └ 여는 조건 ${f.gate.of}`, 'gateOpen', g)
    }
    if (s.groupBuild) push('즉석 모둠 (groupBuild)', 'groupBuild', '—')
    if (s.wall?.enabled) push('의견 광장', 'opinionWall', '—')
    if (s.picker?.enabled) push(`발표자 뽑기 (${s.picker.gameId})`, 'ladder', '—')
  }
  /* 50분 판에서 내려간 블록 */
  const deferredSteps = short.deferredSteps.map((v) => v.step.shortTitle)
  const deferredParts = short.steps.filter((v) => v.deferredFields.length + v.deferredConcepts.length + v.deferredMaterial.length > 0).map((v) => v.step.shortTitle)
  const all = [...deferredSteps, ...deferredParts]
  if (all.length > 0) {
    const v = verdict('deferred')
    rows.push([l.id, '50분 판', `「수업 후 이어서」 ${all.join(' · ')}`, 'deferred', '—', v.need, v.have, v.verdict])
  }
}

/* ── 요약 ── */
const byVerdict = { 유지: 0, 추가: 0 }
for (const r of rows) byVerdict[r[7].startsWith('추가') ? '추가' : '유지'] += 1
const missingByKind = {}
for (const r of rows) {
  if (!r[7].startsWith('추가')) continue
  missingByKind[r[3]] = (missingByKind[r[3]] ?? 0) + 1
}

const md = []
md.push('# 7차 — 진행 콘솔 대조표 (작업 Q.1)')
md.push('')
md.push(
  `\`npm run audit:console\` 이 만든다. 「콘솔에 있음?」 열은 등록표(\`src/lib/console-registry.ts\`)를 읽는다 — 콘솔은 그 등록표에서 그려지므로 이 표가 곧 콘솔이다. 처음 대조(2026-09-14, 유지 116 · 추가 318 — 옛 Live.tsx 기준)는 git 기록 \`04f3cf5\` 에 있다.`,
)
md.push('')
md.push('## 요약')
md.push('')
md.push(`- 학생 블록 ${rows.length}개 — 유지 ${byVerdict.유지} · 추가 ${byVerdict.추가}`)
md.push(`- 추가가 필요한 블록 종류: ${Object.entries(missingByKind).map(([k, n]) => `${k} ${n}곳`).join(' · ')}`)
md.push('')
md.push('### 콘솔에만 있는 것 (학생 블록에 대응하지 않음)')
md.push('')
md.push('| 콘솔 조작부 | 판정 | 근거 |')
md.push('|---|---|---|')
for (const [a, b, c] of CONSOLE_ONLY) md.push(`| ${a} | **${b}** | ${c} |`)
md.push('')
md.push('### 블록 종류별 — 등록표(Q.2)와 지금 콘솔')
md.push('')
md.push('| 블록 종류 | 등록표가 요구하는 조작부 | 지금 콘솔 | 빠진 것 |')
md.push('|---|---|---|---|')
for (const k of Object.keys(REGISTRY)) {
  const v = verdict(k)
  md.push(`| \`${k}\` | ${v.need} | ${v.have} | ${v.verdict.startsWith('추가') ? v.verdict.replace('추가 — ', '') : '—'} |`)
}
md.push('')
md.push('등록표에 없는 블록 종류: 이론 배경(제어할 것 없음) · 개념 카드(조작부 없음). 학생 화면의 `slider` 확신도는 3차에서 없앴다 — 대응 행이 없다.')
md.push('')
md.push('## 차시별 대조표')
md.push('')
md.push('| 차시 | 단계 | 학생 화면 블록 | 블록 종류 | gate | 필요한 조작부 | 콘솔에 있음? | 판정 |')
md.push('|---|---|---|---|---|---|---|---|')
for (const r of rows) md.push(`| ${r.join(' | ')} |`)
md.push('')
writeFileSync('docs/7차-콘솔-대조표.md', md.join('\n') + '\n')
console.log(`대조표: 블록 ${rows.length}개 — 유지 ${byVerdict.유지} · 추가 ${byVerdict.추가} → docs/7차-콘솔-대조표.md`)

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
 * ★ 이 스크립트는 「지금 콘솔이 무엇을 그리는가」를 소스에서 읽지 않는다 — 아래 CONSOLE_NOW 에
 *   손으로 적었다(2026-09-14 Live.tsx 기준). 콘솔을 등록표에서 그리도록 바꾸면(R-2) 이 표는
 *   등록표 자체가 되고, verify:console 이 양방향으로 검사한다.
 */
import { writeFileSync } from 'node:fs'

const { LESSONS } = await import('../src/content/lessons/index.ts')
const { buildLessonView } = await import('../src/lib/tiers.ts')
const { DEFAULT_FORMATION_LESSONS } = await import('../src/content/group-games.ts')

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

/* ── 지금 콘솔(Live.tsx, 2026-09-14)이 그리는 조작부 ── */
const CONSOLE_NOW = {
  'stimulus·afterReveal': ['자료 공개 / 되돌리기'],
  stimulus: [],
  input: ['제출 현황', '응답 목록', '유형 묶기(aiTasks 에 cluster-responses 가 있는 단계만)'],
  choice: ['제출 현황', '분포(단계의 첫 선택형 칸만)'],
  sorter: [],
  canvas: [],
  module: ['제출 현황', '응답 목록'],
  opinionWall: ['고정', '숨김', '갈린 글 표시'],
  ladder: ['후보 확인', '제외', '실행', '재추첨', '수동 지정', '비상 추첨', '시드·가중치·발표 횟수'],
  groupGame: ['실행', '미리보기', '재배정', '수동 이동', '확정', '고정 규칙', '지각 합류', '모둠 수'],
  groupBuild: [],
  concepts: [],
  gateOpen: ['열기 / 닫기'],
  deferred: [],
}

/* 콘솔에만 있고 학생 블록에 대응하지 않는 것 */
const CONSOLE_ONLY = [
  ['강사 대본 (MustSay · instructorScript)', '삭제', 'R.5 — 강의자가 내용을 보고 직접 진행한다'],
  ['「분포를 보고 할 수 있는 것」 읽기 목록 (teacherNextMoves)', '변경', 'R.1 분기 단추(설명 추가 / 짝 토론 / 재응답 요청)로 — 누르면 학생 화면에 안내 카드'],
  ['「이 화면에 없는 것」 남색 블록', '삭제', '조작부가 아니다. 자리만 차지한다'],
  ['「고쳐 쓴 답」 별도 목록', '유지', 'R.2 개인 화면(v1·v2 나란히)으로 흡수한다'],
  ['타이머 (시작·해제)', '유지', '학생 화면에 남은 시간이 뜬다. 기본값은 비워 둔다 (3차 D.3)'],
  ['제출률 80% 안내문', '유지', '명단 열로 옮긴다'],
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
  const missing = need.filter((n) => !have.some((h) => h.startsWith(n)))
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
md.push(`\`npm run audit:console\` 이 만든다. 기준: 2026-09-14 \`src/routes/instructor/Live.tsx\`. 강의자가 확인하기 전에는 아무것도 지우지 않는다.`)
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

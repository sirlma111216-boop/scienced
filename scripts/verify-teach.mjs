/**
 * npm run verify:teach (8차 7절 · audit:console 대체)
 *
 *   · 등록표(teach-registry) — 블록 종류마다 조작부가 정해져 있고 LessonBody 가 종류를 다 그린다
 *   · 조작부는 블록 옆 — 강사 화면(Teach.tsx)이 LessonBody 를 쓰고, 학생 화면(Lesson.tsx)도 같은 LessonBody 를 쓴다
 *   · 수업 중 단추 다섯 이외 없음 — 단계 열기 · 자료 공개 · 모둠 나누기 · 게임 시작 · 응답 펼치기 (발표 모드는 강의자 지시로 뺐다)
 *       (응답 펼치기는 「응답 n/N ▸」 「올라온 글 n ▸」 「모둠별 ▸」 접기 요소다. 학생만 누르는 [참가]·명단 서랍은 예외로 둔다)
 *   · 실명 가리기가 켜지면 rosterName 을 읽지 않는다 · 발표 모드가 어디에도 없다
 *   · /instructor/lesson/:id/live · /instructor/lessons 경로가 없다 (되돌리기 Navigate 만)
 *   · 학생 경로에 강사 전용 요소(PlanPreviewBar · TierBadge · 강사 이동 배너)가 없다
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fail, pass, report, walk } from './_report.mjs'

const { CONTROLS, TEACH_BUTTONS } = await import('../src/lib/teach-registry.ts')

const read = (p) => readFile(p, 'utf8')
const norm = (p) => p.replace(/\\/g, '/')

/* ── 등록표 ↔ 본문 ── */
{
  const body = await read('src/components/lesson/LessonBody.tsx')
  const kinds = Object.keys(CONTROLS)
  for (const k of kinds) if (!new RegExp(`case '${k}'`).test(body)) fail('등록표', `LessonBody 가 블록 종류 ${k} 를 그리지 않는다`)
  const drawn = [...body.matchAll(/case '([a-zA-Z]+)'/g)].map((m) => m[1])
  for (const k of drawn) if (!kinds.includes(k)) fail('등록표', `LessonBody 가 등록표에 없는 블록 종류 ${k} 를 그린다`)
  const teacherOnly = kinds.filter((k) => CONTROLS[k].length > 0)
  for (const k of teacherOnly) {
    const seg = body.slice(body.indexOf(`case '${k}'`), body.indexOf(`case '${k}'`) + 900)
    if (!/teacher/.test(seg)) fail('조작부', `블록 ${k} 는 조작부가 있어야 하는데 LessonBody 의 그 자리에 teacher 분기가 없다`)
  }
  pass('등록표', `블록 ${kinds.length}종이 등록표와 LessonBody 에서 같고, 조작부가 있는 ${teacherOnly.length}종은 블록 옆에서 teacher 분기로 그려진다`)

  const teach = await read('src/routes/Teach.tsx')
  const lesson = await read('src/routes/Lesson.tsx')
  if (!/<LessonBody/.test(teach) || !/<LessonBody/.test(lesson)) fail('같은 부품', '강사 화면과 학생 화면이 같은 LessonBody 를 쓰지 않는다')
  else pass('같은 부품', '강사 화면(/teach)과 학생 화면(/lesson)이 같은 LessonBody 를 그린다')
  if (!/teacher=\{/.test(teach)) fail('같은 부품', 'Teach.tsx 가 LessonBody 에 teacher 를 주지 않는다')
  if (/teacher=\{/.test(lesson)) fail('같은 부품', '학생 화면이 LessonBody 에 teacher 를 준다')
}

/* ── 단추 다섯 ── */

/**
 * JSX 에서 <Button>·<button> 의 글자를 뽑는다.
 * 여는 태그는 중괄호 깊이를 세며 「>」 를 찾는다 — 속성 안의 => 와 style={{…}} 때문에 정규식으로는 안 된다.
 * 아이 요소 안의 {식} 은 그 안의 따옴표 문자열만 후보로 본다 (busy ? '여는 중…' : '게임 시작').
 * 아이에 다른 태그(<span>)가 있으면 알약·서랍 같은 복합 단추다 — 글자 부분만 본다.
 */
function buttonLabels(src) {
  const out = []
  const re = /<(Button|button)\b/g
  let m
  while ((m = re.exec(src))) {
    let k = m.index + m[0].length
    let depth = 0
    let quote = null
    for (; k < src.length; k++) {
      const ch = src[k]
      if (quote) {
        if (ch === quote) quote = null
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') quote = ch
      else if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '>' && depth === 0 && src[k - 1] !== '=') break
    }
    if (src[k - 1] === '/') continue
    /* 단계 알약(role="tab")은 이동이지 수업 중 조작이 아니다 */
    if (/role="tab"/.test(src.slice(m.index, k))) continue
    const close = src.indexOf(`</${m[1]}>`, k)
    if (close < 0) continue
    const inner = src.slice(k + 1, close)
    /* 아이를 글자와 {식} 으로 가른다 */
    let text = ''
    const exprs = []
    let d = 0
    let cur = ''
    for (const ch of inner) {
      if (ch === '{') {
        if (d === 0) {
          text += ' '
          cur = ''
        } else cur += ch
        d++
      } else if (ch === '}') {
        d--
        if (d === 0) exprs.push(cur)
        else cur += ch
      } else if (d > 0) cur += ch
      else text += ch
    }
    const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    const strings = exprs.flatMap((e) => [...e.matchAll(/'([^']+)'/g)].map((x) => x[1]))
    out.push({ plain, strings })
  }
  return out
}

{
  const ALLOWED = new Set([...TEACH_BUTTONS, '참가', '명단'])
  const FILES = ['src/routes/Teach.tsx', 'src/components/lesson/LessonBody.tsx', 'src/components/games/GameShell.tsx', 'src/components/games/LegacyLadder.tsx', 'src/components/lumi/LumiTeacher.tsx']
  const found = new Map()
  let bad = 0
  for (const f of FILES) {
    for (const { plain, strings } of buttonLabels(await read(f))) {
      const labels = plain ? [plain] : strings
      for (const raw of labels) {
        const label = raw.replace(/[…]/g, '').trim()
        if (!label || /중$/.test(label) || /^\d/.test(label)) continue
        const key = [...ALLOWED].find((a) => label === a || label.startsWith(a)) ?? null
        if (!key) {
          bad += 1
          fail('단추 다섯', `${f} 에 「${label}」 — 수업 화면의 단추는 ${TEACH_BUTTONS.join(' · ')} 뿐이다`)
        } else found.set(key, (found.get(key) ?? 0) + 1)
      }
    }
  }
  for (const b of TEACH_BUTTONS) if (b !== '응답 펼치기' && !found.has(b)) fail('단추 다섯', `「${b}」 단추가 수업 화면 어디에도 없다`)
  if (bad === 0) pass('단추 다섯', `수업 화면의 단추는 ${TEACH_BUTTONS.join(' · ')} 이다 (학생 [참가] · 명단 서랍만 예외)`)
  const summaries = (await read('src/components/lesson/LessonBody.tsx')).match(/<summary[^>]*>[\s\S]*?<\/summary>/g) ?? []
  const collapsed = summaries.filter((x) => /▸/.test(x)).length
  if (collapsed < 4) fail('응답 펼치기', `접힌 응답(「… ▸」)이 ${collapsed}개다 — 잠깐 확인 · 응답 · 올라온 글 · 모둠별 넷이 접혀 있어야 한다`)
  else pass('응답 펼치기', '잠깐 확인 · 응답 · 올라온 글 · 모둠별이 접혀 있다가 누르면 펼쳐진다 (「응답 펼치기」는 이 접기 요소다)')
}

/* ── 잠깐 확인 — 학생은 풀고, 강사 화면은 정답을 접어 둔다 (강의자 지시 2026-09-18) ── */
{
  const body = await read('src/components/lesson/LessonBody.tsx')
  const seg = body.slice(body.indexOf('function TeacherCheck'), body.indexOf('/* ─', body.indexOf('function TeacherCheck')))
  const summaryAt = seg.indexOf('<summary')
  const answerAt = seg.indexOf('check.answer')
  if (!/<StudentConceptCards/.test(body)) fail('잠깐 확인', 'LessonBody 가 학생에게 개념 카드의 확인 문항을 그리지 않는다')
  else if (summaryAt < 0 || answerAt < 0 || answerAt < summaryAt) fail('잠깐 확인', '강사 화면의 정답이 접기(<summary>) 앞에 나온다 — 띄운 화면에 정답이 먼저 보인다')
  else pass('잠깐 확인', '학생 화면에는 푸는 칸이, 강사 화면에는 물음 · 보기와 접힌 정답 · 분포가 있다')
  const card = await read('src/components/concept/ConceptCheck.tsx')
  if (/<textarea|reason|이유/.test(card.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))) fail('잠깐 확인', 'ConceptCheck.tsx 에 이유 칸이 있다 — 강의자 지시로 이유 칸은 뺐다')
}

/* ── 실명 가리기 · 발표 모드 없음 ── */
{
  const names = await read('src/components/teach/names.tsx')
  if (!/masked = hideNames/.test(names) || !/masked \? nicknameOf/.test(names)) fail('실명 가리기', 'NamesProvider 가 실명 가리기에서 닉네임만 쓰지 않는다 — 프로젝터에 실명이 나간다')
  else pass('실명 가리기', '실명 가리기가 켜지면 nameOf 가 닉네임만 돌려준다')
  const teach = await read('src/routes/Teach.tsx')
  if (!/실명 가리기/.test(teach)) fail('실명 가리기', 'Teach.tsx 에 실명 가리기 스위치가 없다')
  if (/rosterName/.test(teach)) fail('실명 가리기', 'Teach.tsx 가 rosterName 을 직접 읽는다 — NamesProvider 를 거쳐야 한다')
  const files = await walk('src', ['.ts', '.tsx'])
  for (const f of files) {
    const src = await read(f)
    if (/\/instructor\/lesson\/[^'"`]*\/live|instructor\/lessons["'`]/.test(src) && !/Navigate to="\/instructor\/classes"/.test(src)) {
      fail('/live 경로', `${norm(f)} 가 옛 진행 콘솔·차시 목록 경로를 가리킨다`)
    }
    if (/PlanPreviewBar|TierBadge|InstructorMovedBanner/.test(src)) fail('학생 화면', `${norm(f)} 에 강사 전용 요소(PlanPreviewBar · TierBadge · 강사 이동 배너)가 남아 있다`)
    const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    if (/발표 모드|usePresent|PresentProvider|present-scale/.test(code)) fail('발표 모드 없음', `${norm(f)} 에 발표 모드가 남아 있다 — 강의자 지시로 뺐다`)
    if (/minutes\s*\}\s*분/.test(code)) fail('단계 시간', `${norm(f)} 가 단계 시간(○분)을 화면에 그린다 — 진행 속도는 강의자가 정한다`)
  }
  for (const gone of ['src/routes/instructor/Live.tsx', 'src/routes/instructor/Lessons.tsx', 'src/routes/instructor/Dashboard.tsx', 'src/lib/console-registry.ts']) {
    if (existsSync(gone)) fail('/live 경로', `${gone} 이 아직 있다`)
  }
  pass('/live 경로', '옛 진행 콘솔 · 차시 목록 · 대시보드가 없고 학생 화면에 강사 전용 요소가 없다')
}

/* ── 강사는 학생과 같은 화면을 본다 (강의자 지시 2026-09-22) ── */
{
  const teach = await read('src/routes/Teach.tsx')
  const lesson = await read('src/routes/Lesson.tsx')
  const body = await read('src/components/lesson/LessonBody.tsx')
  let bad = 0
  /* 블록은 LessonBody 에만 있다 — 경로 파일이 블록 부품을 따로 그리면 두 화면이 갈라진다 (오늘의 질문이 그렇게 학생 화면에만 있었다) */
  const PARTS = ['FormationQuestionView', 'StimulusView', 'ResponseCollector', 'StudentConceptCards', 'ConceptCheckView', 'GameShell', 'ShareBar', 'GroupStep', 'TaskCard', 'StepPrompt', 'FieldRenderer']
  for (const [name, src] of [['Teach.tsx', teach], ['Lesson.tsx', lesson]]) {
    const hit = PARTS.filter((p) => new RegExp(`<${p}\\b`).test(src))
    if (hit.length > 0) {
      bad += 1
      fail('같은 화면', `${name} 이 블록 부품(${hit.join(' · ')})을 LessonBody 밖에서 그린다 — 강사와 학생이 다른 것을 보게 된다`)
    }
    if (!/<LessonHeader/.test(src) || !/<LessonBody/.test(src)) {
      bad += 1
      fail('같은 화면', `${name} 이 차시 머리(LessonHeader)와 본문(LessonBody)을 같은 부품으로 그리지 않는다`)
    }
  }
  /* 강사 분기는 학생이 지금 보는 것을 먼저 그린다 — 잠김 카드 · 칸 · 질문 · 잠깐 확인 */
  const seg = (kind) => {
    const at = body.indexOf(`case '${kind}'`)
    if (at < 0) return ''
    const next = body.indexOf("\n          case '", at + 10)
    return body.slice(at, next < 0 ? undefined : next)
  }
  const rules = [
    ['field', /LockedCard/, '쓰는 칸의 강사 분기가 학생의 잠김 카드를 그리지 않는다 — 단계를 열기 전 학생이 무엇을 보는지 강사가 모른다'],
    ['field', /FieldRenderer/, '쓰는 칸의 강사 분기가 학생의 칸(FieldRenderer)을 그리지 않는다 — 접힌 응답만 보인다'],
    ['stimulusReveal', /LockedCard/, '자료 공개의 강사 분기가 공개 전 학생의 잠김 카드를 그리지 않는다'],
    ['question', /<FormationQuestionView/, '오늘의 질문 블록이 강사 화면에서 학생과 같은 부품(FormationQuestionView)을 쓰지 않는다'],
    ['question', /모둠 나누기/, '[모둠 나누기]가 오늘의 질문 블록 옆에 없다'],
  ]
  for (const [kind, re, msg] of rules) {
    if (!re.test(seg(kind))) {
      bad += 1
      fail('같은 화면', msg)
    }
  }
  const check = body.slice(body.indexOf('function TeacherCheck'), body.indexOf('/* ─', body.indexOf('function TeacherCheck')))
  if (!/<ConceptCheckView[^>]*\bpreview\b/.test(check)) {
    bad += 1
    fail('같은 화면', '잠깐 확인의 강사 분기가 학생이 보는 문항(ConceptCheckView preview)을 그리지 않는다')
  }
  if (bad === 0) pass('같은 화면', '강사 화면은 블록마다 학생이 보는 것 → 단추 → 접힌 답 순서이고, 블록 부품은 LessonBody 에만 있다 (경로 파일 둘은 머리와 본문만 그린다)')
}

report('verify:teach')

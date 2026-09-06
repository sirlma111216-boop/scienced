/**
 * npm run verify:modules
 *
 * 2~4단계에서 붙인 것들이 실제로 연결되어 있는지 본다.
 *
 *  · 지시서 12절이 지정한 차시에 핵심 모듈이 붙어 있는가
 *  · ModuleHost 가 그 모듈을 실제로 그리는가
 *  · AI 결과가 교사 검토를 거치지 않고 저장되는 경로가 없는가 (4단계 선행 조건)
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report, walk } from './_report.mjs'

const { LESSONS } = await import('../src/content/lessons/index.ts')

/** 지시서 12절 표에서 전용 화면이 필요한 차시 */
const EXPECTED = {
  '06': 'curriculumMap',
  '08': 'dataStudio',
  '09': 'nodeCanvas',
  '11': 'cardSorter',
  '12': 'nodeCanvas',
  '16': 'rubricStudio',
  '17': 'aiAuditBoard',
  '18': 'videoAnnotator',
}

for (const [lessonId, expected] of Object.entries(EXPECTED)) {
  const lesson = LESSONS.find((l) => l.id === lessonId)
  if (!lesson) {
    fail('모듈 배치', `${lessonId}강이 없다`)
    continue
  }
  const step = lesson.steps.find((s) => s.moduleComponent)
  if (!step) {
    fail('모듈 배치', `${lessonId}강에 전용 모듈이 붙은 단계가 없다 (기대 ${expected})`)
    continue
  }
  if (step.moduleComponent !== expected) {
    fail('모듈 배치', `${lessonId}강 모듈이 ${step.moduleComponent} 다 (기대 ${expected})`)
  }
}
pass('모듈 배치', `${Object.keys(EXPECTED).length}개 차시에 지정된 전용 화면이 붙어 있다`)

// ModuleHost 가 실제로 그리는가
{
  const host = await readFile('src/components/activity/ModuleHost.tsx', 'utf8')
  const used = new Set(
    LESSONS.flatMap((l) => l.steps.map((s) => s.moduleComponent)).filter(Boolean),
  )
  for (const kind of used) {
    if (!new RegExp(`case '${kind}'`).test(host)) {
      fail('모듈 연결', `ModuleHost 에 ${kind} 분기가 없다`)
    }
  }
  pass('모듈 연결', `쓰이는 모듈 ${used.size}종이 모두 ModuleHost 에서 처리된다`)
}

// 응답 수집기가 모듈 값을 같은 버전에 담는가
{
  const rc = await readFile('src/components/response/ResponseCollector.tsx', 'utf8')
  if (!/MODULE_KEY/.test(rc) || !/renderModule/.test(rc)) {
    fail('모듈 저장', '모듈 값이 응답 버전에 함께 저장되지 않는다')
  }
  pass('모듈 저장', '모듈 결과가 같은 응답 버전에 쌓여 v1→v2 비교가 된다')
}

/* ── 4단계 선행 조건: AI 검토 관문 ── */
{
  const repo = await readFile('src/lib/repo.ts', 'utf8')
  for (const fn of ['addAiProposal', 'watchAiProposals', 'reviewAiProposal']) {
    if (!repo.includes(fn)) fail('AI 검토 관문', `repo 에 ${fn} 이 없다`)
  }

  const local = await readFile('src/lib/repo-local.ts', 'utf8')
  const fs = await readFile('src/lib/repo-firestore.ts', 'utf8')
  for (const [name, src] of [['로컬', local], ['Firestore', fs]]) {
    if (!/status:\s*'pending'/.test(src)) {
      fail('AI 검토 관문', `${name} 구현이 제안을 pending 으로 강제하지 않는다`)
    }
  }

  // 원문은 덮어쓰지 않아야 한다
  if (!/original 은/.test(local) && !/original/.test(local)) {
    fail('AI 검토 관문', '로컬 구현이 original 을 보존한다는 근거가 없다')
  }

  const rules = await readFile('firestore.rules', 'utf8')
  if (!/aiProposals/.test(rules)) {
    fail('AI 검토 관문', 'firestore.rules 에 aiProposals 규칙이 없다')
  }
  if (!/request\.resource\.data\.status == 'pending'/.test(rules)) {
    fail('AI 검토 관문', '규칙이 제안 생성 시 pending 을 강제하지 않는다')
  }
  if (!/request\.resource\.data\.original == resource\.data\.original/.test(rules)) {
    fail('AI 검토 관문', '규칙이 AI 원문 변경을 막지 않는다')
  }
  pass('AI 검토 관문', '제안은 pending 으로만 들어오고, 원문은 규칙에서 잠겨 있다')
}

/**
 * AI 결과가 검토를 건너뛰고 학생에게 가는 경로가 없는가.
 *
 * 지켜야 할 것은 "cluster-responses 라는 낱말이 없다"가 아니다.
 * 타입 선언과 차시 데이터에는 당연히 그 이름이 있다.
 * 진짜 불변식은 이것이다 —
 *   AI 엔드포인트를 호출해 분류 결과를 받는 파일은 반드시 addAiProposal 로 넘긴다.
 */
{
  const files = await walk('src', ['.ts', '.tsx'])
  let callers = 0
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    // 실제로 이 taskId 를 보내는 곳만 본다. 이름만 언급한 타입·데이터 파일은 제외한다.
    if (!/taskId:\s*'cluster-responses'/.test(text)) continue
    callers++
    if (!/addAiProposal/.test(text)) {
      fail(
        'AI 검토 관문',
        `${file} 이 AI 분류를 호출하면서 addAiProposal 로 넘기지 않는다 — 검토대를 우회한다`,
      )
    }
  }
  if (callers === 0) {
    fail('AI 검토 관문', 'AI 분류를 호출하는 곳을 찾지 못했다 — 검사가 무의미해졌다')
  }
  pass('AI 검토 관문', `AI 분류를 보내는 ${callers}곳 모두 결과를 제안으로 넘긴다`)

  // 학생용 패널은 타입에서 분류 작업을 아예 받지 못해야 한다.
  const panel = await readFile('src/components/ai/AiAssistPanel.tsx', 'utf8')
  if (!/Exclude<AiTaskId, 'cluster-responses'>/.test(panel)) {
    fail('AI 검토 관문', '학생용 AI 패널이 교사용 분류 작업을 타입에서 막고 있지 않다')
  }
  pass('AI 검토 관문', '학생용 패널은 교사용 분류를 타입에서 받지 못한다')
}

report('verify:modules')

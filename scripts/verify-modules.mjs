/**
 * npm run verify:modules — 8차부터는 AI 교사 검토 관문만 본다.
 *
 * 전용 화면 모듈(dataStudio · nodeCanvas …)은 8차 골격에서 없앴다. 활동은 다섯 단이다.
 * 남는 불변식: AI 결과가 교사 검토를 거치지 않고 학생에게 가는 경로가 없다 (4단계 선행 조건).
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report, walk } from './_report.mjs'

{
  const repo = await readFile('src/lib/repo.ts', 'utf8')
  for (const fn of ['addAiProposal', 'watchAiProposals', 'reviewAiProposal']) if (!repo.includes(fn)) fail('AI 검토 관문', `repo 에 ${fn} 이 없다`)
  const local = await readFile('src/lib/repo-local.ts', 'utf8')
  const fs = await readFile('src/lib/repo-firestore.ts', 'utf8')
  for (const [name, src] of [['로컬', local], ['Firestore', fs]]) {
    if (!/status:\s*'pending'/.test(src)) fail('AI 검토 관문', `${name} 구현이 제안을 pending 으로 강제하지 않는다`)
  }
  const rules = await readFile('firestore.rules', 'utf8')
  if (!/aiProposals/.test(rules)) fail('AI 검토 관문', 'firestore.rules 에 aiProposals 규칙이 없다')
  if (!/request\.resource\.data\.status == 'pending'/.test(rules)) fail('AI 검토 관문', '규칙이 제안 생성 시 pending 을 강제하지 않는다')
  if (!/request\.resource\.data\.original == resource\.data\.original/.test(rules)) fail('AI 검토 관문', '규칙이 AI 원문 변경을 막지 않는다')
  pass('AI 검토 관문', '제안은 pending 으로만 들어오고, 원문은 규칙에서 잠겨 있다')
}

{
  const files = await walk('src', ['.ts', '.tsx'])
  let callers = 0
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    if (!/taskId:\s*'cluster-responses'/.test(text)) continue
    callers++
    if (!/addAiProposal/.test(text)) fail('AI 검토 관문', `${file} 이 AI 분류를 호출하면서 addAiProposal 로 넘기지 않는다 — 검토대를 우회한다`)
  }
  if (callers === 0) fail('AI 검토 관문', 'AI 분류를 호출하는 곳을 찾지 못했다 — 검사가 무의미해졌다')
  pass('AI 검토 관문', `AI 분류를 보내는 ${callers}곳 모두 결과를 제안으로 넘긴다`)
  const review = await readFile('src/routes/instructor/AiReview.tsx', 'utf8')
  if (!/AiClusterPanel/.test(review)) fail('AI 검토 관문', '응답 유형 묶기가 검토대 화면 안에 없다 — 8차 A 결정')
  const panel = await readFile('src/components/ai/AiAssistPanel.tsx', 'utf8')
  if (!/Exclude<AiTaskId, 'cluster-responses'>/.test(panel)) fail('AI 검토 관문', '학생용 AI 패널이 교사용 분류 작업을 타입에서 막고 있지 않다')
  pass('AI 검토 관문', '학생용 패널은 교사용 분류를 타입에서 받지 못하고, 분류 요청은 검토대 안에 있다')
}

report('verify:modules')

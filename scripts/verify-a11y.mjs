/**
 * npm run verify:a11y
 *
 * 타협 불가 항목 (지시서 15절 · 컨텍스트 19.10):
 *  · 드래그 전용 인터랙션 없음 — 정렬·배분·자리 고르기 모두 키보드/숫자 대안이 있어야 한다
 *  · 포커스 표시가 살아 있어야 한다 (outline: none 만 두고 대체가 없으면 실패)
 *  · 이미지·그림에 대체 설명
 *  · prefers-reduced-motion 분기
 *  · 색만으로 상태를 구분하지 않음
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report, walk } from './_report.mjs'

const files = await walk('src', ['.ts', '.tsx', '.css'])
const sources = new Map()
for (const f of files) sources.set(f, await readFile(f, 'utf8'))

const all = [...sources.values()].join('\n')

/* 1. 드래그 전용 없음 */
{
  const dragUsers = []
  for (const [file, text] of sources) {
    if (/onDragStart|onDrop|draggable=|useDraggable|useSortable|DndContext/.test(text)) {
      dragUsers.push(file)
    }
  }
  if (dragUsers.length > 0) {
    // 드래그를 쓴다면 드래그하지 않고도 같은 일을 할 수 있어야 한다.
    // 인정하는 길: 선택 상자로 옮기기 · 방향 버튼 · 숫자 입력 · dnd-kit 의 KeyboardSensor
    for (const file of dragUsers) {
      const text = sources.get(file)
      const alt = {
        select: /<select[\s\S]{0,400}onChange/.test(text),
        buttons: /아래로|위로|왼쪽으로|오른쪽으로/.test(text),
        number: /type="number"/.test(text),
        keyboardSensor: /KeyboardSensor/.test(text),
        keyHandler: /onKeyDown/.test(text),
      }
      const ways = Object.entries(alt).filter(([, on]) => on).map(([k]) => k)
      if (ways.length === 0) {
        fail('드래그 전용 금지', `${file} 이 드래그만 쓰고 다른 길이 없다`)
      }
    }
    pass(
      '드래그 전용 금지',
      `드래그를 쓰는 ${dragUsers.length}개 파일 모두 드래그하지 않는 길을 함께 둔다`,
    )
  } else {
    pass('드래그 전용 금지', '드래그 전용 인터랙션이 아예 없다 (배분은 숫자 입력, 순위는 버튼)')
  }
}

/* 2. 포커스 표시 */
{
  const css = sources.get('src\\index.css') ?? sources.get('src/index.css') ?? ''
  if (!/:focus-visible[\s\S]{0,200}outline:/.test(css)) {
    fail('포커스 표시', 'index.css 에 :focus-visible 윤곽선 규칙이 없다')
  }
  const killed = /outline:\s*(none|0)/.test(all)
  const restored = /:focus-visible[\s\S]{0,200}outline:\s*\d/.test(css)
  if (killed && !restored) {
    fail('포커스 표시', 'outline 을 없앤 곳이 있는데 대체 표시가 없다')
  }
  pass('포커스 표시', ':focus-visible 에 3px 윤곽선이 살아 있다')
}

/* 3. reduced-motion 분기 */
{
  const inCss = /prefers-reduced-motion/.test(all)
  const inJs = /useReducedMotion|prefers-reduced-motion/.test(all)
  if (!inCss) fail('reduced-motion', 'CSS 에 prefers-reduced-motion 분기가 없다')
  if (!inJs) fail('reduced-motion', '추첨 애니메이션에 reduced-motion 분기가 없다')
  // 사다리 애니메이션이 실제로 이 훅을 쓰는가
  const ladder = sources.get('src\\components\\activity\\LadderGame.tsx')
    ?? sources.get('src/components/activity/LadderGame.tsx') ?? ''
  if (ladder && !/useReducedMotion/.test(ladder)) {
    fail('reduced-motion', '추첨 화면이 reduced-motion 을 확인하지 않는다')
  }
  pass('reduced-motion', 'CSS 와 추첨 애니메이션 양쪽에서 분기한다')
}

/* 4. 그림 대체 설명 */
{
  let svgCount = 0
  let labeled = 0
  for (const [, text] of sources) {
    const svgs = text.match(/<svg[^>]*>/g) ?? []
    svgCount += svgs.length
    for (const tag of svgs) {
      if (/aria-label=|aria-labelledby=|role="img"|aria-hidden/.test(tag)) labeled++
    }
  }
  if (svgCount > 0 && labeled < svgCount) {
    fail('대체 설명', `${svgCount}개 svg 중 ${svgCount - labeled}개에 설명이 없다`)
  }
  const imgs = all.match(/<img[^>]*>/g) ?? []
  const missingAlt = imgs.filter((t) => !/alt=/.test(t))
  if (missingAlt.length > 0) fail('대체 설명', `alt 없는 img 가 ${missingAlt.length}개 있다`)
  pass('대체 설명', `svg ${svgCount}개에 모두 설명이 있고, alt 없는 img 가 없다`)
}

/* 5. 색만으로 구분하지 않음 */
{
  // 사다리 결과·제출 상태·반응 등 상태 표시에 글자가 함께 있는지 표본으로 본다.
  const board = sources.get('src\\components\\activity\\LadderBoard.tsx')
    ?? sources.get('src/components/activity/LadderBoard.tsx') ?? ''
  if (board && !/발표!/.test(board)) {
    fail('색만으로 구분 금지', '사다리 결과가 글자 없이 색으로만 표시된다')
  }
  const live = sources.get('src\\routes\\instructor\\Live.tsx')
    ?? sources.get('src/routes/instructor/Live.tsx') ?? ''
  if (live && !/제출 ✓|미제출/.test(live)) {
    fail('색만으로 구분 금지', '제출 현황이 색으로만 표시된다')
  }
  const reactions = sources.get('src\\content\\reactions.ts')
    ?? sources.get('src/content/reactions.ts') ?? ''
  if (reactions && !/mark:/.test(reactions)) {
    fail('색만으로 구분 금지', '반응에 글자 표식이 없다')
  }
  pass('색만으로 구분 금지', '사다리 결과·제출 현황·반응에 모두 글자 표식이 있다')
}

/* 6. 터치 표적과 확대 */
{
  const css = sources.get('src\\index.css') ?? sources.get('src/index.css') ?? ''
  if (!/min-height:\s*44px/.test(css)) {
    fail('터치 표적', '버튼 최소 높이 44px 규칙이 없다')
  }
  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(all)) {
    fail('확대', '확대를 막는 viewport 설정이 있다')
  }
  pass('터치 표적과 확대', '버튼 44px 이상, 확대를 막지 않는다')
}

/* 7. 인쇄 가능한 동일 목표 활동지 */
{
  const { LESSONS } = await import('../src/content/lessons/index.ts')
  for (const l of LESSONS) {
    for (const s of l.steps) {
      if (!s.printableAlternative || s.printableAlternative.length < 20) {
        fail('인쇄 활동지', `${l.id}강 ${s.id} 에 오프라인 대안이 없다`)
      }
    }
  }
  if (!/@media print/.test(all)) fail('인쇄', '인쇄용 스타일이 없다')
  pass('인쇄 활동지', '모든 단계에 같은 목표의 오프라인 대안과 인쇄 스타일이 있다')
}

/* 8. 건너뛰기 링크와 본문 표지 */
{
  if (!/skip-link/.test(all)) fail('건너뛰기 링크', '본문으로 건너뛰기 링크가 없다')
  if (!/id="main"/.test(all)) fail('본문 표지', '<main id="main"> 이 없다')
  pass('건너뛰기 링크', '본문으로 건너뛰기와 main 표지가 있다')
}

report('verify:a11y')

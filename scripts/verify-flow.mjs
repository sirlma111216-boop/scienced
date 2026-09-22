/**
 * npm run verify:flow (8차 11절 신설)
 *
 *   · 과목별 골격 — method 5단계(활동 1 · 활동 2) · edu80 6단계 · edu40 4단계 (steps.ts 의 STEP_IDS 그대로)
 *   · 학생 쓰기 칸 수 — 교수법 4 · 80분 4 · 40분 3
 *   · 활동 다섯 단 — 상황 · 과제 · 칸 1~2 · 광장 안내 · 모둠 데이터 · 게임 (순서는 stepBlocks 가 고정)
 *   · 교수법 활동 1 은 공유까지다 — 모둠·게임이 없고, 활동 2 에는 둘 다 있다 (강의자 지시 2026-09-22)
 *   · 도입에 광장 없음 · 도입은 선택 하나 또는 한 줄
 *   · 정리 문항 꼴 — 「근거가 된 개념」 + 「없었다면」
 *   · 차시 머리 — 제목 · 중심 질문(물음표) · 학습목표 셋(「~다」, 「이해한다」「안다」 금지)
 *   · 개념 카드 수 — 교수법 3~4 · 80분 각 부 3~4 · 40분 2~3
 *   · 모둠 데이터 형식과 칸 종류가 맞는다
 */
import { fail, pass, report } from './_report.mjs'
import { activitiesOf, activityLabel, isLight, loadCourses, where } from './_courses.mjs'

const { STEP_IDS, buildSteps, writingSlots } = await import('../src/content/steps.ts')
const { formatMatchesField } = await import('../src/lib/group-math.ts')
const { stepBlocks } = await import('../src/lib/teach-registry.ts')

const CARD_RANGE = { method: [3, 4], edu80: [3, 4], edu40: [2, 3] }
const ORDER = ['task', 'stimulus', 'field', 'wall', 'group', 'game']

let lessons = 0
for (const course of await loadCourses()) {
  for (const l of course.lessons) {
    lessons += 1
    const at = where(l)

    /* 골격 */
    if (!STEP_IDS[l.layout]) {
      fail('골격', `${at} 의 layout 「${l.layout}」 은 method · edu80 · edu40 중 하나가 아니다`)
      continue
    }
    if (course.courseId === 'method' && l.layout !== 'method') fail('골격', `${at} 은 교수법인데 layout 이 ${l.layout} 다`)
    if (course.courseId === 'edu' && l.id !== '01' && l.layout === 'method') fail('골격', `${at} 은 교육론인데 layout 이 method 다 (1강만 같다)`)
    const steps = buildSteps(l)
    const ids = steps.map((s) => s.id).join(',')
    if (ids !== STEP_IDS[l.layout].join(',')) fail('골격', `${at} 단계가 [${ids}] 다 — ${l.layout} 은 [${STEP_IDS[l.layout].join(',')}]`)
    if (l.layout === 'edu80' && (!l.concepts2?.length || !l.activity2)) fail('골격', `${at} 은 80분인데 concepts2·activity2 가 없다`)
    if (l.layout !== 'edu80' && (l.concepts2 || l.activity2)) fail('골격', `${at} 은 80분이 아닌데 concepts2·activity2 가 있다`)
    if (l.layout === 'method' && !l.activity1) fail('골격', `${at} 은 교수법인데 활동 1(activity1)이 없다 — 개념 다음에 활동 1, 그다음 활동 2 (강의자 지시 2026-09-22)`)
    if (l.layout !== 'method' && l.activity1) fail('골격', `${at} 은 교수법이 아닌데 activity1 이 있다`)

    /* 쓰기 칸 수 */
    const slots = writingSlots(l)
    const want = l.layout === 'edu40' ? 3 : 4
    if (slots !== want) fail('쓰기 칸', `${at} 학생이 쓰는 단계가 ${slots}개다 — ${want}개여야 한다 (원칙 1 · 교수법은 활동이 둘)`)

    /* 차시 머리 */
    if (!/\?$/.test(l.centralQuestion.trim())) fail('중심 질문', `${at} 중심 질문이 물음표로 끝나지 않는다`)
    if (l.objectives.length !== 3) fail('학습목표', `${at} 학습목표가 ${l.objectives.length}개다 (3개)`)
    for (const o of l.objectives) {
      if (!/다\.?$/.test(o.trim())) fail('학습목표', `${at} 「${o.slice(0, 30)}」 이 「~다」로 끝나지 않는다`)
      if (/이해한다|안다\.?$|알게 된다/.test(o)) fail('학습목표', `${at} 「${o.slice(0, 30)}」 — 「이해한다」「안다」는 쓰지 않는다`)
    }

    /* 도입 */
    if (!l.intro.stimulus?.body?.trim()) fail('도입', `${at} 도입에 자료가 없다`)
    if (l.intro.kind === 'choice' && (l.intro.options?.length ?? 0) < 3) fail('도입', `${at} 도입 선택지가 ${l.intro.options?.length ?? 0}개다 (3개 이상)`)
    if (l.intro.kind === 'line' && l.intro.options?.length) fail('도입', `${at} 도입이 한 줄인데 선택지가 있다`)
    const intro = steps.find((s) => s.kind === 'intro')
    if (intro?.activity) fail('도입', `${at} 도입에 활동(광장)이 붙어 있다 — 도입에는 벽이 없다`)

    /* 개념 카드 수 */
    const [lo, hi] = CARD_RANGE[l.layout]
    const parts = l.layout === 'edu80' ? [l.concepts, l.concepts2 ?? []] : [l.concepts]
    parts.forEach((cs, i) => {
      if (cs.length < lo || cs.length > hi) fail('카드 수', `${at} 개념${parts.length > 1 ? ` ${i + 1}부` : ''} 카드가 ${cs.length}장이다 (${lo}~${hi})`)
    })

    /* 활동 다섯 단 */
    for (const [i, a] of activitiesOf(l).entries()) {
      const tag = `${at} ${activityLabel(l, i)}`
      const light = isLight(a)
      if (l.layout === 'method' && i === 0 && !light) fail('활동 1', `${tag} 에 모둠·게임이 있다 — 교수법 활동 1 은 질문 · 쓰기 · 공유까지다`)
      if (!(l.layout === 'method' && i === 0) && light) fail('활동 ④ 모둠', `${tag} 에 모둠·게임이 없다 — 활동 1 이 아닌 활동에는 둘 다 있어야 한다`)
      if (!a.situation?.body?.trim()) fail('활동 ① 과제', `${tag} 에 상황이 없다`)
      if (!a.task?.trim()) fail('활동 ① 과제', `${tag} 에 과제문이 없다`)
      if (a.task && a.task.split(/(?<=[.。])\s+/).filter(Boolean).length > 2) fail('활동 ① 과제', `${tag} 과제문이 세 문장 이상이다 — 명령형 한 문장`)
      if (a.fields.length < 1 || a.fields.length > 2) fail('활동 ② 쓰기', `${tag} 칸이 ${a.fields.length}개다 (1~2)`)
      if (!a.share?.prompt?.trim()) fail('활동 ③ 공유', `${tag} 에 광장 안내가 없다`)
      if (light) continue
      if (!a.group?.format) fail('활동 ④ 모둠', `${tag} 에 모둠 데이터 형식이 없다`)
      const gf = a.fields.find((f) => f.key === a.group?.fieldKey)
      if (!gf) fail('활동 ④ 모둠', `${tag} 모둠 데이터가 가리키는 칸 「${a.group?.fieldKey}」 이 활동 칸에 없다`)
      else if (!formatMatchesField(a.group.format, gf)) fail('활동 ④ 모둠', `${tag} 형식 ${a.group.format} 과 칸 종류 ${gf.kind} 가 맞지 않는다`)
      if (a.group?.format === 'vote' && !a.fields.some((f) => f.key === a.group.reasonKey)) fail('활동 ④ 모둠', `${tag} vote 형식인데 이유 칸(reasonKey)이 없다`)
      if ((a.group?.format === 'sentence' || a.group?.format === 'vote') && !a.group.repPrompt) fail('활동 ④ 모둠', `${tag} ${a.group.format} 형식인데 대표에게 하는 말(repPrompt)이 없다`)
      if (!a.game) fail('활동 ⑤ 게임', `${tag} 에 게임이 없다`)
      for (const f of a.fields) if (f.required !== true) fail('활동 ② 쓰기', `${tag} 칸 「${f.label}」 이 required 가 아니다 — 한 번만 쓰되 비워 둘 수 없다`)
    }

    /* 블록 순서 — 등록표가 정한 순서와 같아야 한다 */
    for (const s of steps.filter((x) => x.kind === 'activity')) {
      const kinds = stepBlocks(s, l).map((b) => (b.kind === 'stimulusReveal' ? 'stimulus' : b.kind)).filter((k) => ORDER.includes(k))
      const seq = kinds.filter((k, i) => kinds[i - 1] !== k)
      /* 활동 1(교수법)은 모둠·게임 블록이 없다 — 있는 것끼리 순서가 같아야 한다 */
      const want = s.activity && isLight(s.activity) ? ORDER.filter((k) => k !== 'group' && k !== 'game') : ORDER
      if (seq.join(',') !== want.join(',')) fail('활동 순서', `${at} ${s.id} 블록이 [${seq.join(' → ')}] 다 — ${want.join(' → ')}`)
    }

    /* 정리 문항 꼴 */
    const w = l.wrapup?.prompt ?? ''
    if (!/근거가 된 개념/.test(w) || !/없었다면/.test(w)) fail('정리 문항', `${at} 정리 문항이 「내 결정의 근거가 된 개념은 … 없었다면 …」 꼴이 아니다`)
    if (/다짐|소감|한 줄 요약/.test(w)) fail('정리 문항', `${at} 정리 문항이 다짐·소감·요약을 묻는다`)
  }
}

if (lessons === 0) fail('골격', '차시가 하나도 없다')
pass('골격', `${lessons}개 차시가 과목별 골격(교수법 5 / 80분 6 / 40분 4 단계)과 쓰기 칸 수(4 / 4 / 3)를 지킨다`)
pass('활동 다섯 단', '모든 활동이 상황 · 과제 · 칸 1~2 · 광장을 갖추고, 활동 1(교수법)을 뺀 모든 활동에 모둠 데이터 · 게임이 그 순서로 있다')
pass('정리 문항', '모든 정리 문항이 「근거가 된 개념 … 없었다면」 꼴이다')
report('verify:flow')

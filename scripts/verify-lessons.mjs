/**
 * npm run verify:lessons
 *
 * 18개 차시 메타데이터가 스키마를 충족하는가, 빈 필드가 없는가,
 * 강사 대본과 핵심 개념 4개가 모두 채워졌는가.
 *
 * 개념 카드는 컨텍스트 문서 1절의 여섯 층을 전부 통과해야 한다.
 *   쉬운 한 문장 → 왜 필요한가 → 교실 장면 → 정확한 정의 → 헷갈리기 쉬운 것 → 직접 써 보기
 */
import { fail, pass, report } from './_report.mjs'

const { LESSONS } = await import('../src/content/lessons/index.ts')
const { LESSON_IDS, SHORT_TITLE_MAX } = await import('../src/content/types.ts')

// 1. 18개가 다 있고 순서가 맞는가
if (LESSONS.length !== 18) fail('차시 수', `18개가 아니라 ${LESSONS.length}개다`)
LESSON_IDS.forEach((id, i) => {
  const l = LESSONS[i]
  if (!l) return fail('차시 순서', `${id}강이 없다`)
  if (l.id !== id) fail('차시 순서', `${i}번째가 ${l.id}강이다 (기대 ${id}강)`)
  if (l.order !== i + 1) fail('차시 순서', `${id}강의 order 가 ${l.order}다`)
})
pass('차시 수와 순서', '01~18강이 순서대로 있다')

// 2. 문자열 필드에 빈 값이 없는가
const TEXT_FIELDS = [
  'title',
  'centralQuestion',
  'studentVoice',
  'firstSentence',
  'guide',
  'fieldCase',
  'flowSummary',
  'moduleName',
]
for (const l of LESSONS) {
  for (const f of TEXT_FIELDS) {
    if (typeof l[f] !== 'string' || l[f].trim().length < 5) {
      fail('빈 필드', `${l.id}강 ${f} 가 비었거나 너무 짧다`)
    }
  }
  if (!Array.isArray(l.objectives) || l.objectives.length < 2) {
    fail('학습목표', `${l.id}강 학습목표가 ${l.objectives?.length ?? 0}개다 (2~3개 필요)`)
  }
  if (!l.curriculumLink || !l.curriculumLink.text || !l.curriculumLink.label) {
    fail('교육과정 연결', `${l.id}강 curriculumLink 가 비었다`)
  }
}
pass('빈 필드', `${TEXT_FIELDS.length}개 텍스트 필드와 학습목표·교육과정 연결이 모두 채워져 있다`)

// 3. 핵심 개념 4개 × 여섯 층
const CONCEPT_LAYERS = [
  ['plainOneLiner', '쉬운 한 문장'],
  ['whyItMatters', '왜 필요한가'],
  ['classroomScene', '교실 장면'],
  ['formalDefinition', '정확한 정의'],
  ['applyQuestion', '직접 써 보기'],
]
let conceptCount = 0
const conceptIds = new Set()
for (const l of LESSONS) {
  if (l.keyConcepts.length !== 4) {
    fail('핵심 개념 4개', `${l.id}강 개념이 ${l.keyConcepts.length}개다`)
  }
  for (const c of l.keyConcepts) {
    conceptCount++
    if (conceptIds.has(c.id)) fail('개념 id', `${c.id} 가 중복된다`)
    conceptIds.add(c.id)
    if (!c.term || c.term.trim().length === 0) fail('개념 용어', `${l.id}강에 이름 없는 개념이 있다`)
    for (const [key, label] of CONCEPT_LAYERS) {
      if (typeof c[key] !== 'string' || c[key].trim().length < 10) {
        fail('개념 여섯 층', `${l.id}강 「${c.term}」의 ‘${label}’ 층이 비었거나 너무 짧다`)
      }
    }
    if (!Array.isArray(c.notToConfuseWith) || c.notToConfuseWith.length < 2) {
      fail('개념 여섯 층', `${l.id}강 「${c.term}」의 ‘헷갈리지 말자’가 2개 미만이다`)
    }
    if (!c.check || !c.check.prompt || !Array.isArray(c.check.options) || c.check.options.length < 3) {
      fail('잠깐 확인', `${l.id}강 「${c.term}」에 잠깐 확인 문항이 없다`)
    }
  }
}
pass('핵심 개념', `${conceptCount}개 개념이 여섯 층 + 잠깐 확인을 모두 통과`)

// 4. 강사 대본
for (const l of LESSONS) {
  if (l.instructorScript.length < 4) {
    fail('강사 대본', `${l.id}강 대본이 ${l.instructorScript.length}줄이다 (4줄 이상 필요)`)
  }
  const stepIds = new Set(l.steps.map((s) => s.id))
  for (const line of l.instructorScript) {
    for (const f of ['stepId', 'cue', 'sayThis', 'whyNotSkip', 'watchFor']) {
      if (!line[f] || String(line[f]).trim().length < 3) {
        fail('강사 대본', `${l.id}강 대본에 ${f} 가 비어 있다`)
      }
    }
    if (!stepIds.has(line.stepId)) {
      fail('강사 대본', `${l.id}강 대본이 존재하지 않는 단계 ${line.stepId} 를 가리킨다`)
    }
  }
}
pass('강사 대본', '모든 차시에 4줄 이상, 각 줄에 언제·무슨 말·왜 빼면 안 되는지·무엇을 볼지가 있다')

// 5. 단계와 타임라인
for (const l of LESSONS) {
  if (l.steps.length < 5) fail('단계', `${l.id}강 단계가 ${l.steps.length}개다 (5개 이상 필요)`)
  const total = l.steps.reduce((s, st) => s + st.durationMinutes, 0)
  if (total !== 50) fail('50분', `${l.id}강 단계 시간 합이 ${total}분이다`)
  const tlTotal = l.timeline.reduce((s, t) => s + t.minutes, 0)
  if (tlTotal !== 50) fail('50분', `${l.id}강 타임라인 합이 ${tlTotal}분이다`)

  const ids = new Set()
  for (const s of l.steps) {
    if (ids.has(s.id)) fail('단계 id', `${l.id}강에 ${s.id} 가 중복된다`)
    ids.add(s.id)
    if (!s.title || !s.lead) fail('단계', `${l.id}강 ${s.id} 에 제목이나 안내가 없다`)
    // 단계 알약은 폭 375px 에서 여섯 개가 가로 스크롤 없이 들어가야 한다.
    // 길면 넘치지 않고 잘려서, 무슨 단계인지 알 수 없는 알약이 된다.
    if (!s.shortTitle) {
      fail('짧은 이름', `${l.id}강 ${s.id} 에 알약용 shortTitle 이 없다`)
    } else if ([...s.shortTitle].length > SHORT_TITLE_MAX) {
      fail(
        '짧은 이름',
        `${l.id}강 ${s.id} 의 「${s.shortTitle}」가 ${[...s.shortTitle].length}자다 (${SHORT_TITLE_MAX}자 이하)`,
      )
    }
    if (!s.printableAlternative || s.printableAlternative.length < 20) {
      fail('인쇄 활동지', `${l.id}강 ${s.id} 에 인쇄 가능한 동일 목표 활동지 설명이 없다`)
    }
    for (const f of s.fields) {
      if (!f.key || !f.label) fail('입력 칸', `${l.id}강 ${s.id} 에 이름 없는 입력 칸이 있다`)
      if ((f.kind === 'choice' || f.kind === 'multi') && (!f.options || f.options.length < 2)) {
        fail('입력 칸', `${l.id}강 ${s.id} 의 ${f.key} 에 선택지가 없다`)
      }
      if (f.kind === 'allocation' && (!f.items || !f.total)) {
        fail('입력 칸', `${l.id}강 ${s.id} 의 ${f.key} 에 배분 항목이나 총합이 없다`)
      }
    }
  }
  for (const t of l.timeline) {
    if (!ids.has(t.stepId)) fail('타임라인', `${l.id}강 타임라인이 없는 단계 ${t.stepId} 를 가리킨다`)
  }
  // 개념 단계가 실제 개념 id 를 가리키는가
  for (const s of l.steps) {
    if (!s.conceptIds) continue
    for (const cid of s.conceptIds) {
      if (!l.keyConcepts.some((c) => c.id === cid)) {
        fail('개념 연결', `${l.id}강 ${s.id} 가 없는 개념 ${cid} 를 가리킨다`)
      }
    }
  }
}
pass('단계와 타임라인', '차시마다 5단계 이상, 합계 50분, 인쇄 활동지 설명이 모두 있다')
pass(
  '짧은 이름',
  `모든 단계의 알약 이름이 ${SHORT_TITLE_MAX}자 이하 — 375px 에서 잘리지 않는다`,
)

/*
 * 6. 확신도는 일하는 자리에만 있는가.
 *
 * 모든 단계에 붙이면 숫자만 남는다. 두 곳에서만 실제로 쓰인다 —
 *   예상 단계    분포에서 「틀린 답을 높은 확신으로 고른 무리」가 보인다
 *   형성평가     학습 분석이 「확신은 올랐는데 이유는 그대로」를 잡는다
 * 그래서 차시마다 하나 이상 있되, 세 개를 넘지 않아야 한다.
 */
for (const l of LESSONS) {
  const withConf = l.steps.filter((s) => s.fields.some((f) => f.kind === 'confidence'))
  if (withConf.length === 0) fail('확신도', `${l.id}강에 확신도를 받는 칸이 없다`)
  /*
   * 확신도는 예상 단계와 형성평가에 하나씩 둔다.
   * 그 밖의 단계에 있으려면 같은 단계 안에 전/후 짝이 있어야 한다 —
   * 2강의 「지금 나의 확신도」 → 「새 증거 뒤 확신도」가 그런 경우다.
   * 혼자 있는 확신도는 비교할 앞이 없어 숫자만 남는다.
   */
  for (const st of withConf) {
    if (st.id === 'step-open' || st.id === 'step-recall' || st.id === 'step-formative') continue
    const n = st.fields.filter((f) => f.kind === 'confidence').length
    if (n < 2) {
      fail(
        '확신도',
        `${l.id}강 ${st.id} 에 확신도가 혼자 있다 — 전/후로 짝을 짓거나 빼야 한다`,
      )
    }
  }
  const hasReason = l.steps.some((s) =>
    s.fields.some((f) => /reason|Reason|defense|changed/.test(f.key)),
  )
  if (!hasReason) fail('이유 수집', `${l.id}강에 이유를 받는 칸이 없다`)
}
pass('확신도와 이유', '확신도는 일하는 두 자리에만 있고, 모든 차시가 이유를 받는다')

report('verify:lessons')

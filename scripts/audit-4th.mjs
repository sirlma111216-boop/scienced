/**
 * 4차 지시서 G.1 전수 점검표.
 *
 * 18차시 모든 단계·블록을 실제 콘텐츠에서 읽어 다섯 기준으로 판정한다.
 * 눈대중이 아니라 앱이 쓰는 그 데이터를 그대로 불러 훑는다.
 *
 * 실행:  node --import ./scripts/_loader.mjs scripts/audit-4th.mjs
 * 결과:  콘솔 요약 + audit-4th.json (표를 그리는 쪽이 읽는다)
 */
import { writeFile } from 'node:fs/promises'

const { LESSONS } = await import('../src/content/lessons/index.ts')

/* ── G.2 다섯 기준의 표현 목록 ── */

const K1 = ['받습니다', '공개됩니다', '제시됩니다', '주어집니다', '나눠 줍니다', '보여 줍니다', '배부합니다']
const K2 = ['이 기사가', '이 자료에서', '위 그림의', '아래 표를 보고', '이 학생의 답안', '방금 본',
  '이 대본', '이 보고서', '이 응답', '아래 자료', '위 자료', '이 사례에서', '이 계획서']
const K3 = ['한 뒤', '토론 뒤', '새 증거 뒤', '제출 후', '2차', '다시 ', '재응답', '뒤 확신도', '듣고 나서']
const K4 = ['빈 그릇', '나침반', '렌즈', '다리를 놓', '작은 과학자', '씨앗', '근육', '뼈대',
  '여행', '항해', '지도처럼', '마치', '처럼 생각하면']
const K5 = ['그림', '사진', '영상', '도식', '화살표', '삽화', '이미지']

const has = (text, list) => list.filter((k) => text.includes(k))

/* ── 한 단계에서 학생이 보는 글을 모은다 ── */

function stepText(step) {
  const parts = [step.title, step.lead]
  for (const f of step.fields) {
    parts.push(f.label, f.help ?? '', f.placeholder ?? '', ...(f.sentenceStarters ?? []))
    for (const it of f.items ?? []) parts.push(it.label, it.note ?? '')
    for (const q of f.quadrants ?? []) parts.push(q.label)
    for (const o of f.options ?? []) parts.push(o)
  }
  for (const m of step.material ?? []) parts.push(m.title, m.body)
  if (step.wall?.enabled) parts.push(step.wall.prompt)
  return parts.filter(Boolean).join('\n')
}

/** 안내 문구만 (자료 본문은 뺀다 — 자료 안의 단어는 자료가 있다는 뜻이므로) */
function guideText(step) {
  const parts = [step.title, step.lead]
  for (const f of step.fields) {
    parts.push(f.label, f.help ?? '', f.placeholder ?? '', ...(f.sentenceStarters ?? []))
  }
  if (step.wall?.enabled) parts.push(step.wall.prompt)
  return parts.filter(Boolean).join('\n')
}

/** 이론을 설명하는 글 — 비유 검사의 대상 */
function theoryText(lesson) {
  const parts = [lesson.firstSentence, lesson.guide, lesson.fieldCase, lesson.flowSummary,
    ...lesson.objectives]
  for (const c of lesson.keyConcepts) {
    parts.push(c.plainOneLiner, c.whyItMatters, c.classroomScene, c.formalDefinition,
      c.applyQuestion, ...(c.notToConfuseWith ?? []), ...(c.mustKnow ?? []))
    for (const d of c.deepDive ?? []) parts.push(d.title, d.body)
  }
  return parts.filter(Boolean).join('\n')
}

const rows = []
const lessonRows = []

for (const lesson of LESSONS) {
  /* 기준 4 — 차시 단위 이론 설명의 비유 */
  const theory = theoryText(lesson)
  const theoryMetaphors = has(theory, K4)
  const conceptFigures = has(
    lesson.keyConcepts.map((c) => [c.plainOneLiner, c.classroomScene, c.formalDefinition,
      ...(c.mustKnow ?? []), ...(c.deepDive ?? []).map((d) => d.body)].join('\n')).join('\n'),
    K5,
  )
  lessonRows.push({
    lessonId: lesson.id,
    title: lesson.title,
    published: lesson.published,
    theoryMetaphors,
    conceptFigures,
    conceptCount: lesson.keyConcepts.length,
  })

  for (const step of lesson.steps) {
    const guide = guideText(step)
    const all = stepText(step)
    const materials = step.material ?? []
    const hasStimulus = materials.length > 0
    const stimulusKinds = materials.map((m) => m.kind)

    const c1 = has(guide, K1)
    const c2 = has(guide, K2)
    const c3 = has(guide, K3)
    const c4 = has(guide, K4)
    const c5 = has(all, K5)

    const verdicts = []
    if (c1.length && !hasStimulus) verdicts.push('①자료없음')
    if (c2.length && !hasStimulus) verdicts.push('②가리킬것없음')
    if (c3.length) verdicts.push('③잠금없음')       // 스키마에 gate 자체가 없다
    if (c4.length) verdicts.push('④설명없는비유')
    if (c5.length) verdicts.push('⑤그림명세없음')   // imageSpec 개념이 아직 없다

    rows.push({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      stepId: step.id,
      stepTitle: step.title,
      type: step.type,
      lead: step.lead,
      fieldCount: step.fields.length,
      fieldLabels: step.fields.map((f) => f.label),
      hasStimulus,
      stimulusKinds,
      materialTitles: materials.map((m) => m.title),
      hits: { c1, c2, c3, c4, c5 },
      verdicts,
      ok: verdicts.length === 0,
      hasWall: Boolean(step.wall?.enabled),
      hasPicker: Boolean(step.picker?.enabled),
      moduleComponent: step.moduleComponent ?? null,
      groupBuild: Boolean(step.groupBuild),
    })
  }
}

await writeFile('audit-4th.json', JSON.stringify({ rows, lessonRows }, null, 2), 'utf8')

/* ── 콘솔 요약 ── */
const bad = rows.filter((r) => !r.ok)
console.log(`\n단계 ${rows.length}개 중 고쳐야 함 ${bad.length}개\n`)
const tally = {}
for (const r of rows) for (const v of r.verdicts) tally[v] = (tally[v] ?? 0) + 1
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(16)} ${v}개 단계`)
}
console.log(`\n이론 설명에 비유가 든 차시: ${lessonRows.filter((l) => l.theoryMetaphors.length).length}개`)
console.log(`자료(material)가 하나도 없는 단계: ${rows.filter((r) => !r.hasStimulus).length}개 / ${rows.length}\n`)

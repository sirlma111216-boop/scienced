/**
 * npm run audit:draft (8차 10.1 · 11절 신설)
 *
 * docs/검토/<과목>-<nn>.md 가 시드다. 문서에 적힌 문장이 코드에 없으면 실패한다.
 *   중심 질문 · 학습목표 셋 · 도입 질문과 선택지 · 카드 이름과 기준 3줄 · 잠깐 확인(물음 · 보기 넷 · 정답) · 과제문 · 정리 문항 · 네 검사
 * 그리고 반대로 — 코드에 있는 차시에 문서가 없어도 실패한다 (문서 없이 코드를 쓰지 않는다).
 */
import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fail, pass, report } from './_report.mjs'
import { activitiesOf, conceptsOf, loadCourses, where } from './_courses.mjs'
import { MARKS, docNameOf, norm, parseDoc } from './_draft-doc.mjs'

const DIR = 'docs/검토'
const KEY = { 정답: 'answer', 갈림: 'split', 이해: 'understand', 상황: 'situation' }
const files = existsSync(DIR) ? (await readdir(DIR)).filter((f) => /^(method|edu)-\d{2}\.md$/.test(f)) : []
let docs = 0
let bad = 0

for (const c of await loadCourses()) {
  for (const l of c.lessons) {
    /* 교육론 1강은 교수법 1강과 같다 (강의자 답 4) — 같은 문서를 대조한다 */
    const name = docNameOf(c.courseId, l.id)
    const at = where(l)
    if (!files.includes(name)) {
      fail('검토 문서', `${at} 의 검토 문서 ${DIR}/${name} 이 없다 — 문서가 먼저다 (10.1)`)
      bad += 1
      continue
    }
    docs += 1
    const d = parseDoc(await readFile(`${DIR}/${name}`, 'utf8'))
    const miss = (what, text) => {
      bad += 1
      fail('문서 ↔ 코드', `${at} ${what} — 문서의 「${String(text).slice(0, 40)}」 이 코드에 없다`)
    }
    if (d.centralQuestion && d.centralQuestion !== norm(l.centralQuestion)) miss('중심 질문', d.centralQuestion)
    if (d.objectives.length !== 3) fail('문서 형식', `${at} 문서의 학습목표가 ${d.objectives.length}개다`)
    d.objectives.forEach((o, i) => {
      if (norm(l.objectives[i]) !== o) miss(`학습목표 ${i + 1}`, o)
    })
    if (d.introPrompt && d.introPrompt !== norm(l.intro.prompt)) miss('도입 질문', d.introPrompt)
    if (d.options.length && d.options.join('|') !== (l.intro.options ?? []).map(norm).join('|')) miss('도입 선택지', d.options.join(' / '))
    const cards = conceptsOf(l)
    if (d.cards.length !== cards.length) fail('문서 형식', `${at} 문서의 카드가 ${d.cards.length}장, 코드는 ${cards.length}장`)
    d.cards.forEach((dc, i) => {
      const k = cards[i]
      if (!k) return
      if (norm(k.name) !== dc.name) miss(`카드 ${i + 1} 이름`, dc.name)
      dc.points.forEach((p, j) => {
        if (norm(k.keyPoints[j]) !== p) miss(`카드 ${i + 1} 기준 ${j + 1}`, p)
      })
      if (dc.check && !k.check) miss(`카드 ${i + 1} 잠깐 확인`, dc.check.prompt)
      if (!dc.check && k.check) {
        bad += 1
        fail('문서 ↔ 코드', `${at} 카드 ${i + 1} 의 잠깐 확인이 코드에만 있다 — 문서가 먼저다`)
      }
      if (dc.check && k.check) {
        if (norm(k.check.prompt) !== dc.check.prompt) miss(`카드 ${i + 1} 확인 물음`, dc.check.prompt)
        for (let j = 0; j < 4; j++) if (norm(k.check.options?.[j]) !== (dc.check.options[j] ?? '')) miss(`카드 ${i + 1} 확인 보기 ${MARKS[j]}`, dc.check.options[j] ?? '(없음)')
        if (k.check.answer !== dc.check.answer) miss(`카드 ${i + 1} 확인 정답`, dc.check.answer === null ? '(없음)' : MARKS[dc.check.answer])
      }
    })
    const acts = activitiesOf(l)
    d.task.forEach((t, i) => {
      if (norm(acts[i]?.task) !== t) miss(`활동${i ? ' 2' : ''} 과제`, t)
    })
    for (const [label, key] of Object.entries(KEY)) {
      ;(d.checks[label] ?? []).forEach((v, i) => {
        if (norm(acts[i]?.checks?.[key]) !== v) miss(`활동${i ? ' 2' : ''} ${label} 검사`, v)
      })
      if (!(d.checks[label] ?? []).length) fail('문서 형식', `${at} 문서에 ${label} 검사가 없다`)
    }
    if (d.wrapup[0] && d.wrapup[0] !== norm(l.wrapup.prompt)) miss('정리 문항', d.wrapup[0])
    if (!/## 이렇게 정했다/.test(await readFile(`${DIR}/${name}`, 'utf8'))) fail('문서 형식', `${at} 문서에 「이렇게 정했다」 절이 없다`)
  }
}

for (const f of files) {
  const [courseId, id] = f.replace('.md', '').split('-')
  const c = (await loadCourses()).find((x) => x.courseId === courseId)
  if (!c?.lessons.some((l) => l.id === id)) console.log(`  · 문서만 있고 코드가 아직 없는 차시: ${f}`)
}

if (bad === 0) pass('문서 ↔ 코드', `검토 문서 ${docs}장의 중심 질문 · 학습목표 · 도입 · 카드 기준 · 잠깐 확인 · 과제 · 네 검사 · 정리 문항이 코드와 같다`)
report('audit:draft')

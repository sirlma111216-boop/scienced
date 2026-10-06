/**
 * node --import ./scripts/_loader.mjs scripts/_scan-intro-terms.mjs
 * 도입(자료·물음·보기)이 그 차시에서 아직 가르치지 않은 개념 이름을 쓰는 자리를 찾는다 — 점검용.
 */
import { loadCourses } from './_courses.mjs'

const JARGON = ['5E', 'POE', 'CER', 'SSI', 'NOS', 'STEAM', 'ZPD', '근접발달', '비계', '선개념', '오개념', '인지갈등', '동화', '조절', '메타인지', '형성평가', '수행평가', '루브릭', '성취기준', '핵심 아이디어', '역방향', '실천', '모형 기반', '논증', '반증', '탐구 기능', '구성주의', '유의미']
for (const c of await loadCourses()) {
  for (const l of c.lessons) {
    const intro = l.intro
    const text = [intro.stimulus?.title, intro.stimulus?.body, intro.prompt, ...(intro.options ?? [])].filter(Boolean).join(' / ')
    const names = l.concepts.map((k) => k.name)
    const hits = new Set()
    for (const n of names) for (const part of n.split(/[ ·과와]/).filter((p) => p.length >= 2)) if (text.includes(part)) hits.add(`카드:${n}(${part})`)
    for (const j of JARGON) if (text.includes(j)) hits.add(`낱말:${j}`)
    if (hits.size) console.log(`${c.courseId} ${l.id} ${l.published ? '공개' : '미공개'} | ${[...hits].join(', ')}\n    물음: ${intro.prompt}`)
  }
}

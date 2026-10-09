/**
 * node --import ./scripts/_loader.mjs scripts/_scan-rhetoric.mjs [과목-nn]
 * 개념 카드에서 비유·수사·만든 말로 보이는 표현을 센다 — 점검용 (강의자 지적 2026-10-06).
 */
import { loadCourses } from './_courses.mjs'
const PAT = [/자리[다가를이는]/, /이름만/, /덮어/, /제구실/, /계보/, /접[어을는]/, /핵심은/, /뿐이다/, /갈[라린]/, /남는다/, /무너/, /흘러/, /쪼개/, /사고가 바뀌/, /사고에서/, /기능을 하(?!나)/, /제 기능/, /축소판/, /구조다/, /틀이다/, /국면/, /가 아니라 [^ ]+ 순서/, /증거가 됐다/, /드러난다/]
const only = process.argv[2]
let total = 0, hit = 0
for (const c of await loadCourses()) for (const l of c.lessons) {
  if (only && `${c.courseId}-${l.id}` !== only) continue
  for (const k of [...l.concepts, ...(l.concepts2 ?? [])]) {
    total++
    const f = { what: k.what, why: k.why, inClass: k.inClass, kp: (k.keyPoints ?? []).join(' / '), conf: k.confusedWith ?? '' }
    const found = []
    for (const [n, t] of Object.entries(f)) for (const p of PAT) { const m = p.exec(t); if (m) found.push(`${n}:${t.slice(Math.max(0, m.index - 15), m.index + 15)}`) }
    if (found.length) { hit++; console.log(`${c.courseId}-${l.id} ${k.id} ${k.name}\n   ${found.join('\n   ')}`) }
  }
}
console.log(`\n카드 ${total} 장 중 ${hit} 장에 걸림`)

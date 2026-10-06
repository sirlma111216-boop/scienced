/**
 * node scripts/_rewrite-cards.mjs <패치.mjs>
 *
 * 카드의 필드를 통째로 바꾼다 — 코드(src/content/courses/<과목>/lesson<nn>.ts)와 검토 문서 양쪽.
 * 패치 꼴: export default [{ lesson: 'method-10', cards: { 'c10-5e': { name, what, why, confusedWith, keyPoints: {0: '...'} , terms: [[term, plain]] } }, pairs: [[옛, 새]] }]
 *   · 옛 글은 코드에서 읽어 둘 다에서 같은 글자로 바꾼다 (문서가 시드라 한쪽만 고치면 audit:draft 가 잡는다).
 *   · terms 는 코드에는 「무엇」 바로 뒤에, 문서에는 「왜」 줄 앞에 「용어」 줄로 넣는다. 이미 있으면 바꾼다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const patches = (await import(pathToFileURL(resolve(process.argv[2])).href)).default
const norm = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const q = (s) => {
  if (s.includes("'")) throw new Error('작은따옴표: ' + s.slice(0, 40))
  return s
}

for (const p of patches) {
  const [course, nn] = p.lesson.split('-')
  const CODE = `src/content/courses/${course}/lesson${nn}.ts`
  const DOC = `docs/검토/${p.lesson}.md`
  let code = norm(CODE)
  let doc = norm(DOC)
  const both = (a, b) => {
    if (a === b) return
    if (!code.includes(a) && !doc.includes(a)) throw new Error(`${p.lesson} 어디에도 없다: ${a.slice(0, 60)}`)
    if (code.includes(a)) code = code.split(a).join(b)
    else console.log(`  · ${p.lesson} 코드에는 없다: ${a.slice(0, 50)}`)
    if (doc.includes(a)) doc = doc.split(a).join(b)
    else console.log(`  · ${p.lesson} 문서에는 없다: ${a.slice(0, 50)}`)
  }
  for (const [id, f] of Object.entries(p.cards ?? {})) {
    if (code.indexOf(`id: '${id}'`) < 0) throw new Error(`카드 없음 ${id}`)
    /* 앞에서 바꾼 글의 길이만큼 자리가 밀리므로 매번 다시 잰다 */
    const seg = () => {
      const at = code.indexOf(`id: '${id}'`)
      const next = code.indexOf('\n    },\n    {', at)
      const end = next > 0 ? next : code.indexOf('\n  ],', at)
      return code.slice(at, end)
    }
    const field = (k) => {
      const m = new RegExp(`\\n\\s+${k}: '([^'\\n]*)'`).exec(seg())
      return m ? m[1] : null
    }
    for (const k of ['name', 'what', 'why', 'inClass', 'confusedWith']) {
      if (f[k] === undefined) continue
      const old = field(k)
      if (old === null) throw new Error(`${id} ${k} 없음`)
      both(old, q(f[k]))
    }
    if (f.keyPoints) {
      const m = /keyPoints: \[\n([\s\S]*?)\n\s*\],/.exec(seg())
      const lines = [...m[1].matchAll(/'([^'\n]*)'/g)].map((x) => x[1])
      for (const [i, v] of Object.entries(f.keyPoints)) both(lines[Number(i)], q(v))
    }
    if (f.terms) {
      const whatAt = code.indexOf('what: ', code.indexOf(`id: '${id}'`))
      const lineEnd = code.indexOf('\n', whatAt)
      const indent = code.slice(code.lastIndexOf('\n', whatAt) + 1, whatAt)
      const block = `\n${indent}terms: [\n` + f.terms.map(([t, pl]) => `${indent}  { term: '${q(t)}', plain: '${q(pl)}' },`).join('\n') + `\n${indent}],`
      const old = /^\n\s+terms: \[\n[\s\S]*?\n\s+\],/.exec(code.slice(lineEnd))
      code = code.slice(0, lineEnd) + block + code.slice(lineEnd + (old ? old[0].length : 0))
      /* 문서 — 이 카드의 「왜」 줄 앞 */
      const name = f.name ?? field('name')
      const h = doc.indexOf(`─ ${name}\n`)
      if (h < 0) throw new Error(`문서에 카드 ${name} 없음`)
      const why = doc.indexOf('\n왜        ', h)
      let start = doc.indexOf('\n용어      ', h)
      const lines = f.terms.map(([t, pl], i) => `${i === 0 ? '용어      ' : '          '}${t} — ${pl}`).join('\n')
      if (start > 0 && start < why) doc = doc.slice(0, start) + '\n' + lines + doc.slice(why)
      else doc = doc.slice(0, why) + '\n' + lines + doc.slice(why)
    }
  }
  /* pairs 는 코드 조각(따옴표 포함)을 그대로 바꿀 수 있다 */
  for (const [a, b] of p.pairs ?? []) both(a, b)
  writeFileSync(CODE, code)
  writeFileSync(DOC, doc)
  console.log(`${p.lesson} 고침`)
}

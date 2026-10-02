/**
 * node scripts/_apply-content-patch.mjs <패치 파일.mjs>
 *
 * 차시 내용의 문장을 코드(src/content/courses/<과목>/lesson<nn>.ts)와 검토 문서(docs/검토/<과목>-<nn>.md)에서 함께 고친다.
 * 문서가 시드라 한쪽만 고치면 audit:draft 가 어긋남을 잡는다 — 그래서 같은 치환을 양쪽에 건다.
 *
 * 패치 파일은 `export default [{ lesson: 'method-08', inClass: { 'c08-question': '새 글' }, pairs: [['옛 문장', '새 문장']] }]` 꼴이다.
 *   · inClass — 카드 id 로 그 카드의 「교실에서」를 통째로 바꾼다 (옛 글은 코드에서 읽는다)
 *   · append  — 카드 id 로 그 카드의 「교실에서」 끝에 문장을 덧붙인다
 *   · pairs   — 글자 그대로 찾아 바꾼다. 코드에 없으면 멈춘다. 문서에 없으면 알리고 지나간다
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const patchFile = process.argv[2]
if (!patchFile) throw new Error('패치 파일을 적는다')
const patches = (await import(pathToFileURL(resolve(patchFile)).href)).default

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
let changed = 0
let docMiss = 0

for (const p of patches) {
  const [course, nn] = p.lesson.split('-')
  const codePath = `src/content/courses/${course}/lesson${nn}.ts`
  const docPath = `docs/검토/${p.lesson}.md`
  let code = read(codePath)
  let doc = existsSync(docPath) ? read(docPath) : null
  /* 「교실에서」를 먼저 바꾼다 — 낱말 치환(pairs)이 먼저 돌면 코드에서 읽은 옛 글과 어긋난다 */
  const pairs = []

  for (const [cardId, next] of Object.entries(p.inClass ?? {})) {
    if (next.includes("'")) throw new Error(`${p.lesson} ${cardId}: 새 글에 작은따옴표가 있다`)
    const at = code.indexOf(`id: '${cardId}'`)
    if (at < 0) throw new Error(`${p.lesson}: 카드 ${cardId} 가 없다`)
    const m = /inClass: '([^'\n]*)'/.exec(code.slice(at))
    if (!m) throw new Error(`${p.lesson} ${cardId}: inClass 를 찾지 못했다`)
    pairs.push([m[1], next])
  }
  /* append — 카드의 「교실에서」 끝에 문장을 덧붙인다. 이미 붙어 있으면 지나간다 */
  for (const [cardId, tail] of Object.entries(p.append ?? {})) {
    if (tail.includes("'")) throw new Error(`${p.lesson} ${cardId}: 덧붙일 글에 작은따옴표가 있다`)
    const at = code.indexOf(`id: '${cardId}'`)
    if (at < 0) throw new Error(`${p.lesson}: 카드 ${cardId} 가 없다`)
    const m = /inClass: '([^'\n]*)'/.exec(code.slice(at))
    if (!m) throw new Error(`${p.lesson} ${cardId}: inClass 를 찾지 못했다`)
    if (!m[1].endsWith(tail)) pairs.push([m[1], m[1] + tail])
  }
  pairs.push(...(p.pairs ?? []))

  for (const [a, b] of pairs) {
    if (a === b) continue
    const n = code.split(a).length - 1
    if (n === 0) {
      /* 이미 바뀐 자리는 지나간다 — 중간에 멈춘 패치를 다시 돌릴 수 있게 */
      if (code.includes(b)) continue
      throw new Error(`${p.lesson} 코드에 없다: ${a.slice(0, 60)}`)
    }
    code = code.split(a).join(b)
    changed += n
    if (doc !== null) {
      if (doc.includes(a)) doc = doc.split(a).join(b)
      else {
        docMiss += 1
        console.log(`  · ${p.lesson} 문서에는 없다: ${a.slice(0, 50)}`)
      }
    }
  }
  writeFileSync(codePath, code)
  if (doc !== null) writeFileSync(docPath, doc)
}
console.log(`고친 자리 ${changed}곳 · 문서에 없던 문장 ${docMiss}개`)

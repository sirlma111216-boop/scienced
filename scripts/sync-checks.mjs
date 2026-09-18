/**
 * npm run sync:checks [-- method-03 edu-07 …]
 *
 * 검토 문서의 잠깐 확인(「확인」 블록)을 차시 코드의 `check` 로 옮긴다 — 문서가 먼저다 (10.1).
 * 카드는 문서의 순서와 코드의 순서로 짝짓고, 이름이 다르면 멈춘다.
 * 코드에 이미 check 가 있으면 문서 것으로 바꾼다. 문서에 확인이 없는 카드는 건드리지 않는다.
 * 교육론 1강은 교수법 1강의 카드를 그대로 쓰므로 따로 고치지 않는다.
 *
 * 옮긴 뒤에는 audit:draft 가 문서와 코드를 다시 대조하고, verify:concepts 가 문항의 꼴을 센다.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { conceptsOf, loadCourses, where } from './_courses.mjs'
import { docNameOf, norm, parseDoc } from './_draft-doc.mjs'

const only = new Set(process.argv.slice(2))
const DIR = 'docs/검토'

/** 작은따옴표 문자열 */
const q = (t) => `'${String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** open 자리의 여는 괄호에 짝이 맞는 닫는 괄호 자리. 문자열 안의 괄호는 세지 않는다 */
function closeOf(src, open) {
  const pair = { '[': ']', '{': '}', '(': ')' }
  const stack = [pair[src[open]]]
  let quote = null
  for (let k = open + 1; k < src.length; k++) {
    const ch = src[k]
    if (quote) {
      if (ch === '\\') k += 1
      else if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch
    else if (pair[ch]) stack.push(pair[ch])
    else if (ch === stack[stack.length - 1]) {
      stack.pop()
      if (stack.length === 0) return k
    }
  }
  throw new Error('괄호 짝이 없다')
}

function block(check, indent) {
  const i1 = indent
  const i2 = indent + '  '
  const i3 = indent + '    '
  return [
    `${i1}check: {`,
    `${i2}prompt: ${q(check.prompt)},`,
    `${i2}options: [`,
    ...check.options.map((o) => `${i3}${q(o)},`),
    `${i2}],`,
    `${i2}answer: ${check.answer},`,
    `${i1}},`,
  ].join('\n')
}

let changed = 0
let cards = 0
for (const c of await loadCourses()) {
  for (const l of c.lessons) {
    if (c.courseId === 'edu' && l.id === '01') continue
    const key = `${c.courseId}-${l.id}`
    if (only.size && !only.has(key)) continue
    const doc = parseDoc(await readFile(`${DIR}/${docNameOf(c.courseId, l.id)}`, 'utf8'))
    const codeCards = conceptsOf(l)
    const path = `src/content/courses/${c.courseId}/lesson${l.id}.ts`
    let src = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n')
    const before = src
    doc.cards.forEach((dc, i) => {
      if (!dc.check) return
      const k = codeCards[i]
      if (!k || norm(k.name) !== dc.name) throw new Error(`${where(l)} 카드 ${i + 1} — 문서 「${dc.name}」 와 코드 「${k?.name ?? '없음'}」 이 다르다`)
      const ck = dc.check
      if (ck.options.length !== 4 || ck.options.some((o) => !o) || ck.answer === null || ck.answer < 0) throw new Error(`${where(l)} 카드 ${i + 1} 「${dc.name}」 — 확인 블록에 보기 넷과 정답이 모두 있어야 한다`)
      const idAt = src.search(new RegExp(`(^|[\\s{,])id: '${k.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'm'))
      if (idAt < 0) throw new Error(`${path} 에서 카드 id ${k.id} 를 찾지 못했다`)
      const kpAt = src.indexOf('keyPoints: [', idAt)
      if (kpAt < 0) throw new Error(`${path} 카드 ${k.id} 에 keyPoints 가 없다`)
      const lineStart = src.lastIndexOf('\n', kpAt) + 1
      const indent = src.slice(lineStart, kpAt)
      const kpClose = closeOf(src, kpAt + 'keyPoints: '.length)
      let insertAt = src.indexOf('\n', kpClose) + 1
      /* 이미 있는 check 는 걷어낸다 */
      const rest = src.slice(insertAt)
      const m = rest.match(/^[ \t]*check: \{/)
      if (m) {
        const open = insertAt + m[0].length - 1
        const close = closeOf(src, open)
        const end = src.indexOf('\n', close) + 1
        src = src.slice(0, insertAt) + src.slice(end)
      }
      src = src.slice(0, insertAt) + block(ck, indent) + '\n' + src.slice(insertAt)
      cards += 1
    })
    if (src !== before) {
      await writeFile(path, src)
      changed += 1
      console.log(`  · ${where(l)} — ${path}`)
    }
  }
}
console.log(`sync:checks — 확인 ${cards}개, 파일 ${changed}개를 문서대로 맞췄다`)

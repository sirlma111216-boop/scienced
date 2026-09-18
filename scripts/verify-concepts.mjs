/**
 * npm run verify:concepts (8차 11절 · verify:lessons 대체)
 *
 * 개념 카드 (4.4):
 *   · what 3~4문장 · why 2~3문장 · inClass 3~4문장 — 문단 하나씩
 *   · keyPoints 정확히 3줄. 한 줄은 완전한 문장(「~다」)이고 판단 기준의 꼴이다:
 *       「~이 아니라 ~다」 「~이면 ~다」 「~를 보면 ~를 알 수 있다」 중 하나
 *   · 명사 나열 금지 — 「A: B, C, D」 꼴이나 「다」로 끝나지 않는 줄
 *   · 세 줄이 서로 다른 말 · 카드 id 는 앱 전체에서 고유
 *   · 카드 수는 verify:flow 가 본다
 *
 * 잠깐 확인 (강의자 지시 2026-09-18 — 4지선다는 두고 이유 칸만 뺀다):
 *   · 카드마다 하나. 물음은 물음표로 끝나고, 정의를 되묻거나(「뜻으로 옳은 것은」) 부정으로 묻지 않는다
 *   · 보기 넷은 서로 다르고 길이가 비슷하다 — 가장 긴 것이 가장 짧은 것의 2배를 넘지 않는다
 *   · 정답 보기가 오답 평균보다 25% 넘게 길지 않다. 과목 전체에서 정답이 가장 긴 보기인 문항은 30% 이하
 *   · 정답 자리는 과목 전체에서 자리마다 15~35%, 한 차시 안에서 모두 같지 않다
 *   · 물음과 보기가 카드 문장을 그대로 옮기지 않는다(16자 이상 연속) — 기준을 장면에 써야 풀린다
 *   · 카드 이름이 정답 보기에만 들어 있지 않다 — 이름 맞히기가 되지 않게
 */
import { fail, pass, report } from './_report.mjs'
import { conceptsOf, loadCourses, where } from './_courses.mjs'

const { sentences } = await import('./_wording-rules.mjs')

const FORMS = [
  { name: '이 아니라 ~다', re: /(이|가|는|은)? ?아니라|아니다/ },
  { name: '이면 ~다', re: /(으면|면)\s/ },
  { name: '를 보면 ~를 알 수 있다', re: /보면|알 수 있/ },
]

const RANGE = { what: [3, 4], why: [2, 3], inClass: [3, 4] }

/** 글자 수 — 빈칸을 뺀다 */
const len = (t) => String(t ?? '').replace(/\s/g, '').length
/** 베끼기 비교용 — 빈칸·문장부호·꺾쇠를 뗀다 */
const flat = (t) => String(t ?? '').replace(/[\s.,·「」『』"'()?!:~—–-]/g, '')
function copied(text, source, n) {
  const t = flat(text)
  for (let i = 0; i + n <= t.length; i++) if (source.includes(t.slice(i, i + n))) return t.slice(i, i + n)
  return null
}
const DEFINITION_ASK = /(뜻|정의|의미|설명)(으로|로)\s*(가장\s*)?(옳은|알맞은|맞는|적절한|바른)/
const NEGATIVE_ASK = /(옳지 않은|알맞지 않은|적절하지 않은|맞지 않는|바르지 않은|틀린 것|아닌 것은)/
const LAZY_OPTION = /(모두 옳다|모두 맞다|모두 틀리다|정답 없음|정답이 없다|위의 것|보기 모두|둘 다 맞다)/

/** 한 문항의 어긋난 곳 */
function checkIssues(c) {
  const k = c.check
  const out = []
  if (!k) return ['잠깐 확인이 없다 — 카드마다 4지선다 하나']
  const prompt = String(k.prompt ?? '').trim()
  if (!prompt) out.push('물음이 비었다')
  if (prompt && !/\?$/.test(prompt)) out.push('물음이 물음표로 끝나지 않는다')
  if ([...prompt].length > 140) out.push(`물음이 ${[...prompt].length}자다 — 140자 이하`)
  if (DEFINITION_ASK.test(prompt)) out.push('정의를 되묻는다 — 장면을 주고 기준으로 판단하게 묻는다')
  if (NEGATIVE_ASK.test(prompt)) out.push('부정으로 묻는다 — 「가장 ~한 것은?」 꼴로 묻는다')
  const opts = Array.isArray(k.options) ? k.options.map((o) => String(o ?? '').trim()) : []
  if (opts.length !== 4) {
    out.push(`보기가 ${opts.length}개다 — 넷`)
    return out
  }
  if (opts.some((o) => !o)) out.push('빈 보기가 있다')
  if (new Set(opts.map(flat)).size !== 4) out.push('같은 보기가 있다')
  for (const o of opts) {
    if (LAZY_OPTION.test(o)) out.push(`보기 「${o.slice(0, 20)}」 — 「모두 옳다」 꼴은 쓰지 않는다`)
    if (/^[①②③④]|^[1-4][.)]\s/.test(o)) out.push(`보기 「${o.slice(0, 20)}」 — 번호는 화면이 붙인다`)
  }
  if (!Number.isInteger(k.answer) || k.answer < 0 || k.answer > 3) {
    out.push(`정답 자리 ${k.answer} — 0~3`)
    return out
  }
  const L = opts.map(len)
  const max = Math.max(...L)
  const min = Math.min(...L)
  if (min > 0 && max / min > 2) out.push(`보기 길이가 ${min}~${max}자 — 가장 긴 것이 가장 짧은 것의 2배를 넘는다`)
  const others = L.filter((_, i) => i !== k.answer)
  const mean = others.reduce((a, b) => a + b, 0) / others.length
  if (L[k.answer] > mean * 1.25) out.push(`정답이 ${L[k.answer]}자, 오답 평균 ${mean.toFixed(1)}자 — 긴 보기가 답이 되는 버릇`)
  const source = flat([c.what, c.why, c.inClass, ...(c.keyPoints ?? []), c.confusedWith].join(''))
  const pc = copied(prompt, source, 20)
  if (pc) out.push(`물음이 카드 문장을 옮겼다 「${pc}」`)
  opts.forEach((o, i) => {
    const oc = copied(o, source, 16)
    if (oc) out.push(`보기 ${i + 1} 이 카드 문장을 옮겼다 「${oc}」 — 문장을 알아보는 문항이 된다`)
  })
  const name = flat(c.name)
  if (name.length >= 2) {
    const has = opts.map((o) => flat(o).includes(name))
    if (has[k.answer] && has.filter(Boolean).length === 1) out.push(`카드 이름 「${c.name}」 이 정답 보기에만 있다 — 이름으로 답이 보인다`)
  }
  return out
}
let checks = 0
const summary = []
const ids = new Map()
let cards = 0
let bad = 0

for (const course of await loadCourses()) {
  const stat = { n: 0, pos: [0, 0, 0, 0], longest: 0, shortest: 0 }
  for (const l of course.lessons) {
    const lessonPos = []
    for (const c of conceptsOf(l)) {
      cards += 1
      const at = `${where(l)} 「${c.name}」`
      const prev = ids.get(c.id)
      /* 교육론 1강은 교수법 1강과 같은 카드다 (강의자 답 4) */
      if (prev && !(prev.lessonId === '01' && l.id === '01')) {
        fail('카드 id', `${at} 의 id ${c.id} 가 ${prev.at} 와 겹친다`)
        bad += 1
      }
      if (!prev) ids.set(c.id, { at, lessonId: l.id })
      if (!c.name?.trim()) fail('카드 이름', `${at} 에 이름이 없다`)

      for (const [k, [lo, hi]] of Object.entries(RANGE)) {
        const text = String(c[k] ?? '')
        if (!text.trim()) {
          fail('문단', `${at} 의 ${k} 가 비었다`)
          bad += 1
          continue
        }
        if (text.includes('\n')) fail('문단', `${at} 의 ${k} 가 여러 문단이다 — 하나여야 한다`)
        const n = sentences(text).length
        if (n < lo || n > hi) {
          fail('문단', `${at} 의 ${k} 가 ${n}문장이다 (${lo}~${hi})`)
          bad += 1
        }
      }
      /* 정의 → 예: what 의 첫 문장이 「예를 들면」으로 시작하면 예가 먼저 온 것이다 */
      if (/^(예를 들면|예를 들어|가령)/.test(String(c.what ?? '').trim())) {
        fail('정의 먼저', `${at} 의 what 이 예로 시작한다 — 정의를 먼저 쓴다 (9절)`)
      }

      const kp = c.keyPoints ?? []
      if (kp.length !== 3) {
        fail('기준 3줄', `${at} 의 keyPoints 가 ${kp.length}줄이다 (3줄)`)
        bad += 1
      }
      const seen = new Set()
      for (const line of kp) {
        const t = String(line).trim()
        if (!/다\.?$/.test(t)) {
          fail('기준 문장', `${at} 「${t.slice(0, 32)}」 — 「~다」로 끝나는 완전한 문장이어야 한다`)
          bad += 1
        }
        if (/^[^.]{1,20}:\s*[^,]+(,\s*[^,]+){2,}/.test(t) || (t.split(/[,·]/).length >= 4 && !/다\.?$/.test(t))) {
          fail('명사 나열', `${at} 「${t.slice(0, 32)}」 — 명사 나열은 기준이 아니다`)
          bad += 1
        }
        if (!FORMS.some((f) => f.re.test(t))) {
          fail('기준 꼴', `${at} 「${t.slice(0, 40)}」 — 「이 아니라」「이면」「를 보면」 중 하나의 꼴이어야 한다`)
          bad += 1
        }
        const key = t.replace(/[\s「」.,·]/g, '').slice(0, 24)
        if (seen.has(key)) {
          fail('기준 중복', `${at} 의 기준 두 줄이 같은 말이다`)
          bad += 1
        }
        seen.add(key)
      }
      if (c.more && (!c.more.title?.trim() || !c.more.body?.trim())) fail('더 읽기', `${at} 의 more 에 제목이나 본문이 없다`)

      /* 잠깐 확인 — 교육론 1강은 교수법 1강과 같은 문항이다. 과목 통계에는 둘 다 넣는다 */
      for (const issue of checkIssues(c)) {
        fail('잠깐 확인', `${at} ${issue}`)
        bad += 1
      }
      if (c.check && Array.isArray(c.check.options) && c.check.options.length === 4 && Number.isInteger(c.check.answer)) {
        checks += 1
        const L = c.check.options.map(len)
        const a = c.check.answer
        stat.pos[a] += 1
        stat.n += 1
        if (L.every((x, i) => i === a || x < L[a])) stat.longest += 1
        if (L.every((x, i) => i === a || x > L[a])) stat.shortest += 1
        lessonPos.push(a)
      }
    }
    if (lessonPos.length >= 3 && new Set(lessonPos).size === 1) {
      fail('정답 자리', `${where(l)} 의 잠깐 확인 정답이 모두 ${lessonPos[0] + 1}번이다`)
      bad += 1
    }
  }
  if (stat.n >= 12) {
    stat.pos.forEach((n, i) => {
      const r = n / stat.n
      if (r < 0.15 || r > 0.35) {
        fail('정답 자리', `${course.title} — 정답이 ${i + 1}번인 문항이 ${n}/${stat.n} (${Math.round(r * 100)}%). 자리마다 15~35%`)
        bad += 1
      }
    })
    if (stat.longest / stat.n > 0.3) {
      fail('긴 정답', `${course.title} — 정답이 가장 긴 보기인 문항이 ${stat.longest}/${stat.n}. 30% 이하`)
      bad += 1
    }
    if (stat.shortest / stat.n > 0.35) {
      fail('짧은 정답', `${course.title} — 정답이 가장 짧은 보기인 문항이 ${stat.shortest}/${stat.n}. 35% 이하`)
      bad += 1
    }
  }
  if (stat.n) summary.push(`${course.title} ${stat.n}문항 · 정답 자리 ${stat.pos.join('/')} · 정답이 가장 긴 보기 ${stat.longest} · 가장 짧은 보기 ${stat.shortest}`)
}

if (cards === 0) fail('개념 카드', '카드가 하나도 없다')
if (bad === 0) {
  pass('개념 카드', `${cards}장이 문단 셋 · 기준 3줄 · 판단 기준의 꼴 · 명사 나열 없음을 지킨다`)
  pass('카드 id', '카드 id 가 앱 전체에서 고유하다')
  pass('잠깐 확인', `카드 ${checks}장마다 4지선다 하나 — ${summary.join(' | ')}`)
}
report('verify:concepts')

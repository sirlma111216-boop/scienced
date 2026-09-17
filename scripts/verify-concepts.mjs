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
const ids = new Map()
let cards = 0
let bad = 0

for (const course of await loadCourses()) {
  for (const l of course.lessons) {
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
    }
  }
}

if (cards === 0) fail('개념 카드', '카드가 하나도 없다')
if (bad === 0) {
  pass('개념 카드', `${cards}장이 문단 셋 · 기준 3줄 · 판단 기준의 꼴 · 명사 나열 없음을 지킨다`)
  pass('카드 id', '카드 id 가 앱 전체에서 고유하다')
}
report('verify:concepts')

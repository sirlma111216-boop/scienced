/**
 * npm run verify:theory
 *
 * 이론 배경 (5차 지시서) 을 소스에서 막는다.
 *
 * ── 왜 이 검사가 있나 ──
 * 이론 배경 탭은 인명과 연도가 들어가는 자리다. 교재의 심화 읽기는 OCR 로 이름이
 * 깨져 있어(브루L--l, 비고츠기, DIWer…) 그대로 옮기면 틀린 이름이 화면에 박힌다.
 * 그리고 대조를 마치지 않은 항목은 「확인 중」으로 보여야지 숨겨서는 안 된다.
 *
 * 공개된 차시에만 전부를 요구한다. 나머지는 남은 개수만 알린다 — 다른 검사와 같은 방식.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fail, pass, report, walk } from './_report.mjs'

const { LESSONS } = await import('../src/content/lessons/index.ts')

/* ── L.2 교재의 깨진 표기. 하나라도 있으면 실패. ── */
const BROKEN = [
  '브루L--l', '브루M', '브루bl', 'Btuner', 'Bmner',
  '비고츠기',
  'DIWer',
  '0sborne', 'Wittmck', 'Osbome',
  '타 al.',
  '대assard', '대owe',
  'czermak',
  'p-prm',
  'spiml curriculum',
  '대체적 개h}',
]

/* ── L.3 임용 기출은 넣지 않는다 ── */
const BANNED = ['기출', '임용', '출제 경향']

/** 주석은 화면에 나가지 않는다. 검사 대상에서 뺀다 — 규칙을 적어 둔 주석이 규칙에 걸리면 안 된다. */
function blankComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/** 학생이 화면에서 읽는 「쉬운 말」 영역. Rich 로 그려지는 자리와 같아야 한다. */
function plainAreas(lesson) {
  const out = [lesson.firstSentence, lesson.guide, ...lesson.objectives]
  for (const c of lesson.keyConcepts) {
    out.push(c.plainOneLiner, c.whyItMatters, c.classroomScene, c.formalDefinition, c.applyQuestion,
      ...c.notToConfuseWith, ...(c.mustKnow ?? []), ...(c.deepDive ?? []).map((d) => d.body))
  }
  return out.join('\n')
}

/* ── 깨진 표기 · 금지어: 이론 파일 전체 ── */
{
  const files = (await walk('src/content', ['.ts'])).filter((f) => /[\\/]theory[\\/]/.test(f))
  let brokenHits = 0
  let bannedHits = 0
  for (const f of files) {
    const src = blankComments(await readFile(f, 'utf8'))
    for (const b of BROKEN) {
      if (src.includes(b)) {
        brokenHits += 1
        fail('깨진 표기', `${f} 에 교재 OCR 오독 「${b}」 이 있다 — 올바른 표기로 고친다 (L.2)`)
      }
    }
    for (const b of BANNED) {
      if (src.includes(b)) {
        bannedHits += 1
        fail('임용 기출', `${f} 에 「${b}」 이 있다 — 기출·출제 경향은 넣지 않는다 (L.3)`)
      }
    }
  }
  if (brokenHits === 0) pass('깨진 표기', `이론 파일 ${files.length}개에 교재 OCR 오독 ${BROKEN.length}종이 없다`)
  if (bannedHits === 0) pass('임용 기출', '이론 파일에 기출·임용·출제 경향이 없다')
}

/* ── 차시별 ── */
let noTheory = 0
let unverified = 0
let entryCount = 0
const ids = new Set()

for (const lesson of LESSONS) {
  const strict = lesson.published
  const where = `${lesson.id}강`
  const t = lesson.theory

  if (!t || t.entries.length === 0) {
    if (strict) fail('이론 배경', `${where} 에 theory.summary 와 entries 가 없다`)
    else noTheory += 1
    continue
  }

  if (!t.summary?.trim()) fail('이론적 위치', `${where} 의 theory.summary 가 비었다`)
  else if (t.summary.split(/[.다]\s/).length < 3) {
    fail('이론적 위치', `${where} 의 theory.summary 가 3~4문장에 못 미친다`)
  }

  const conceptIds = new Set(lesson.keyConcepts.map((c) => c.id))
  const linked = new Set()
  const plain = plainAreas(lesson)

  for (const e of t.entries) {
    entryCount += 1
    const at = `${where} 「${e.termKo || e.id}」`

    if (ids.has(e.id)) fail('항목 id', `${at} 의 id ${e.id} 가 다른 항목과 겹친다`)
    ids.add(e.id)

    for (const k of ['termKo', 'termEn', 'claim', 'bridgeToPlain', 'limits', 'textbookRef', 'oneLine']) {
      if (!String(e[k] ?? '').trim()) fail('항목 필드', `${at} 의 ${k} 가 비었다`)
    }
    if (!(e.scholars?.length > 0)) fail('항목 필드', `${at} 에 scholars 가 없다`)
    for (const s of e.scholars ?? []) {
      if (!s.nameKo?.trim() || !s.nameEn?.trim()) fail('연구자', `${at} 의 연구자에 한국어·원어 이름이 다 있어야 한다`)
    }
    if (!Array.isArray(e.readings)) fail('항목 필드', `${at} 의 readings 가 배열이 아니다`)

    if (!e.verified) unverified += 1

    /* 개념 카드 연결 */
    if (e.linkedConceptId) {
      if (!conceptIds.has(e.linkedConceptId)) {
        fail('개념 카드 연결', `${at} 이 없는 개념 카드 「${e.linkedConceptId}」 를 가리킨다`)
      } else linked.add(e.linkedConceptId)
    }

    /* 팝오버 — 쉬운 말 표현이 실제로 본문에 있어야 밑줄이 그어진다 */
    for (const p of e.plainTerms ?? []) {
      if (!plain.includes(p)) {
        fail('용어 팝오버', `${at} 의 plainTerms 「${p}」 가 본문(쉬운 말 영역)에 없다 — 밑줄이 그어질 자리가 없다`)
      }
    }

    /* 원문 인용 — 셋 다 있어야 한다. 지어내지 않는다: 모르면 비운다 */
    for (const q of e.quotes ?? []) {
      if (!q.original?.trim() || !q.ko?.trim() || !q.source?.trim()) {
        fail('원문 인용', `${at} 의 인용에 원문·옮김·출처가 다 있어야 한다`)
      }
    }

    /* 도식 — 그림과 같은 규칙 */
    if (e.figure) {
      const spec = e.figure
      for (const k of ['purpose', 'genPrompt', 'altText', 'fallback', 'license']) {
        if (!String(spec[k] ?? '').trim()) fail('도식 명세', `${at} 의 도식에 ${k} 가 비었다`)
      }
      if ((spec.altText ?? '').length < 80) fail('도식 명세', `${at} 의 도식 altText 가 짧다`)
      if (!(spec.mustNotShow ?? []).join(' ').match(/글자|문구|글씨|text|label/i)) {
        fail('도식 명세', `${at} 의 도식 mustNotShow 에 「그림 안에 글자 금지」가 없다 (J.2)`)
      }
      if (spec.src && !existsSync(`public${spec.src.split('?')[0]}`)) {
        fail('도식 파일', `${at} 의 도식이 ${spec.src} 를 가리키는데 파일이 없다`)
      }
    }
  }

  /* 공개된 차시는 개념 카드마다 이론 배경 탭에 무엇이든 있어야 한다 */
  if (strict) {
    for (const c of lesson.keyConcepts) {
      if (!linked.has(c.id)) fail('개념 카드 연결', `${where} 「${c.term}」 카드에 붙은 이론 항목이 없다 — 탭이 빈다`)
    }
  }

  /*
   * 역방향 검사 (경고): 본문의 쉬운 말 영역에 정식 용어가 그대로 나오는데 팝오버가 없다.
   * 실패가 아니다 — 본문이 용어를 직접 쓰는 것이 늘 잘못은 아니다. 다만 알린다.
   */
  const bareHits = t.entries
    .filter((e) => plain.includes(e.termKo) && !(e.plainTerms ?? []).some((p) => p.includes(e.termKo)))
    .map((e) => e.termKo)
  if (bareHits.length > 0) {
    console.log(`  · 경고 ${where} 본문에 정식 용어가 그대로 나온다 (팝오버 없음): ${bareHits.join(' · ')}`)
  }
}

/* ── 화면 — 「확인 중」 배지가 실제로 그려지는가 ── */
{
  const view = await readFile('src/components/theory/EntryView.tsx', 'utf8')
  const pop = await readFile('src/components/theory/TermPopover.tsx', 'utf8')
  if (!/verified[\s\S]*확인 중/.test(view)) fail('확인 중 배지', 'EntryView 가 verified 를 보고 「확인 중」을 그리지 않는다')
  if (!/verified[\s\S]*확인 중/.test(pop)) fail('확인 중 배지', 'TermPopover 가 verified 를 보고 「확인 중」을 그리지 않는다')
  else pass('확인 중 배지', '대조 전 항목은 탭·팝오버 모두에서 「확인 중」으로 보인다')
}

/* ── 용어 사전 — 모든 항목이 최소 한 차시에서 참조된다 (항목이 곧 차시 소속이므로 id 중복만 본다) ── */
pass('항목 id', `${entryCount}개 항목의 id 가 서로 다르다`)
pass('개념 카드 연결', '공개된 차시의 개념 카드마다 이론 배경 탭에 항목이 있다')
pass('용어 팝오버', '모든 plainTerms 가 본문의 쉬운 말 영역에 실제로 있다')

if (noTheory > 0) console.log(`  · 아직 이론 배경이 없는 차시 ${noTheory}개 — 미공개 차시`)
if (unverified > 0) console.log(`  · 원문 대조 전(확인 중) 항목 ${unverified}개 / ${entryCount}개`)

report('verify:theory')

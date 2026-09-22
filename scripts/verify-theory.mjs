/**
 * npm run verify:theory (5차 L · 8차에서는 정리 끝 「더 읽기」)
 *
 *   · 교재 OCR 오독 표기 · 임용 기출 금지 — 이론 파일 전체
 *   · 항목 필드 · 연구자 이름 · 원문 인용 셋 다 · 도식 명세
 *   · linkedConceptId 가 그 차시 개념 카드 id 와 같다 · plainTerms 가 본문(쉬운 말 영역)에 있다
 *   · 공개된 차시는 개념 카드마다 이론 항목이 있다 · 「확인 중」 배지가 그려진다
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fail, pass, report, walk } from './_report.mjs'
import { conceptsOf, loadCourses, where } from './_courses.mjs'

const BROKEN = ['브루L--l', '브루M', '브루bl', 'Btuner', 'Bmner', '비고츠기', 'DIWer', '0sborne', 'Wittmck', 'Osbome', '타 al.', '대assard', '대owe', 'czermak', 'p-prm', 'spiml curriculum', '대체적 개h}']
const BANNED = ['기출', '임용', '출제 경향']

function blankComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/** 학생이 화면에서 읽는 「쉬운 말」 영역 — Rich 로 그려지는 자리 */
function plainAreas(lesson) {
  const out = [...lesson.objectives, lesson.intro.prompt, lesson.wrapup.prompt]
  for (const c of conceptsOf(lesson)) out.push(c.what, c.why, c.inClass, ...c.keyPoints, c.confusedWith ?? '', c.more?.body ?? '')
  for (const a of [lesson.activity1, lesson.activity, lesson.activity2].filter(Boolean)) out.push(a.task, a.share.prompt, a.group?.prompt ?? '')
  return out.join('\n')
}

{
  const files = (await walk('src/content', ['.ts'])).filter((f) => /[\\/]theory[\\/]/.test(f))
  let hits = 0
  for (const f of files) {
    const src = blankComments(await readFile(f, 'utf8'))
    for (const b of BROKEN) if (src.includes(b)) (hits += 1, fail('깨진 표기', `${f} 에 교재 OCR 오독 「${b}」 이 있다`))
    for (const b of BANNED) if (src.includes(b)) (hits += 1, fail('임용 기출', `${f} 에 「${b}」 이 있다`))
  }
  if (hits === 0) pass('깨진 표기', `이론 파일 ${files.length}개에 OCR 오독 ${BROKEN.length}종 · 기출 낱말이 없다`)
}

let noTheory = 0
let unverified = 0
let entryCount = 0
const ids = new Map()

for (const course of await loadCourses()) {
  for (const lesson of course.lessons) {
    const strict = lesson.published
    const at = where(lesson)
    const t = lesson.theory
    if (!t || t.entries.length === 0) {
      if (strict) fail('이론 배경', `${at} 에 theory 가 없다 — 공개 차시는 「더 읽기」가 있어야 한다`)
      else noTheory += 1
      continue
    }
    if (!t.summary?.trim()) fail('이론적 위치', `${at} 의 theory.summary 가 비었다`)
    const conceptIds = new Set(conceptsOf(lesson).map((c) => c.id))
    const linked = new Set()
    const plain = plainAreas(lesson)
    for (const e of t.entries) {
      entryCount += 1
      const here = `${at} 「${e.termKo || e.id}」`
      /* 교육론 1강은 교수법 1강과 같은 항목을 쓴다 — 같은 파일이므로 겹침이 아니다 */
      const prev = ids.get(e.id)
      if (prev && !(lesson.id === '01' && prev.lessonId === '01')) fail('항목 id', `${here} 의 id ${e.id} 가 ${prev.at} 와 겹친다`)
      ids.set(e.id, { at, lessonId: lesson.id })
      for (const k of ['termKo', 'termEn', 'claim', 'bridgeToPlain', 'limits', 'textbookRef', 'oneLine']) if (!String(e[k] ?? '').trim()) fail('항목 필드', `${here} 의 ${k} 가 비었다`)
      if (!(e.scholars?.length > 0)) fail('항목 필드', `${here} 에 scholars 가 없다`)
      for (const s of e.scholars ?? []) if (!s.nameKo?.trim() || !s.nameEn?.trim()) fail('연구자', `${here} 의 연구자에 한국어·원어 이름이 다 있어야 한다`)
      if (!e.verified) unverified += 1
      if (e.linkedConceptId) {
        if (!conceptIds.has(e.linkedConceptId)) fail('개념 카드 연결', `${here} 이 없는 개념 카드 「${e.linkedConceptId}」 를 가리킨다`)
        else linked.add(e.linkedConceptId)
      }
      for (const p of e.plainTerms ?? []) if (!plain.includes(p)) fail('용어 팝오버', `${here} 의 plainTerms 「${p}」 가 본문에 없다 — 밑줄이 그어질 자리가 없다`)
      for (const q of e.quotes ?? []) if (!q.original?.trim() || !q.ko?.trim() || !q.source?.trim()) fail('원문 인용', `${here} 의 인용에 원문·옮김·출처가 다 있어야 한다`)
      if (e.figure) {
        const spec = e.figure
        for (const k of ['purpose', 'genPrompt', 'altText', 'fallback', 'license']) if (!String(spec[k] ?? '').trim()) fail('도식 명세', `${here} 의 도식에 ${k} 가 비었다`)
        if (!(spec.mustNotShow ?? []).join(' ').match(/글자|문구|글씨|text|label/i)) fail('도식 명세', `${here} 의 도식 mustNotShow 에 「그림 안에 글자 금지」가 없다`)
        if (spec.src && !existsSync(`public${spec.src.split('?')[0]}`)) fail('도식 파일', `${here} 의 도식이 ${spec.src} 를 가리키는데 파일이 없다`)
      }
    }
    if (strict) for (const c of conceptsOf(lesson)) if (!linked.has(c.id)) fail('개념 카드 연결', `${at} 「${c.name}」 카드에 붙은 이론 항목이 없다`)
  }
}

{
  const view = await readFile('src/components/theory/EntryView.tsx', 'utf8')
  const pop = await readFile('src/components/theory/TermPopover.tsx', 'utf8')
  if (!/verified[\s\S]*확인 중/.test(view) || !/verified[\s\S]*확인 중/.test(pop)) fail('확인 중 배지', '대조 전 항목이 「확인 중」으로 보이지 않는다')
  else pass('확인 중 배지', '대조 전 항목은 탭·팝오버 모두에서 「확인 중」으로 보인다')
  const body = await readFile('src/components/lesson/LessonBody.tsx', 'utf8')
  if (!/case 'more'/.test(body) || !/TheoryPage/.test(body)) fail('더 읽기', '정리 단계 끝의 「더 읽기」가 이론 배경을 그리지 않는다')
  else pass('더 읽기', '이론 배경은 정리 단계 끝 「더 읽기」에서 접혀 있다가 펼쳐진다')
}

pass('항목', `${entryCount}개 항목의 필드·연구자·인용·카드 연결·팝오버가 맞다`)
if (noTheory > 0) console.log(`  · 아직 이론 배경이 없는 차시 ${noTheory}개 — 미공개 차시`)
if (unverified > 0) console.log(`  · 원문 대조 전(확인 중) 항목 ${unverified}개 / ${entryCount}개`)
report('verify:theory')

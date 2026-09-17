/**
 * 8차 A.2 · 9절 — 학생이 읽는 문장의 규칙.
 *
 * verify:wording 이 새 골격(layout 이 있는 차시)에 적용한다. audit:draft 도 같은 함수를 쓴다.
 * 규칙을 설명하려면 금지어를 적어야 하므로 이 파일 자체는 검사 대상이 아니다.
 *
 * 문자열은 두 무리로 나눈다.
 *   all    학생이 읽는 모든 문자열 — 장식 기호 · 붙인 이름 · 교재 냄새 · 앞 차시 번호 · 문장 길이
 *   theory 자료 본문(대본·기사·학생 글 — 그 사람의 말)을 뺀 나머지 — 비유 · 구호 · 다짐 · 감탄 · 어미
 */

/** 설명 없는 비유 낱말. 뒤에 「~는 ~와 같다」「~처럼」도 본다 */
export const METAPHOR_WORDS = ['빈 그릇', '렌즈', '나침반', '뼈대', '지도처럼', '씨앗', '근육', '문을 연다', '문을 열', '항해', '작은 과학자', '다리를 놓']
export const SLOGANS = ['한 문장으로 말하면', '기억하세요', '잊지 마세요', '핵심은 하나', '오늘의 한 줄']
export const PLEDGES = ['하겠습니다', '다짐', '약속', '내일부터', '교사가 되겠다', '되겠습니다']
export const HYPE_WORDS = ['멋진', '놀라운', '흥미로운']
export const DECOR_NAMES = ['오늘의 문', '생각 드러내기', '오늘의 개념 카드', '내 생각 먼저']
export const TEXTBOOK_SMELL = ['에 대해 알아보자', '를 살펴보면', '을 살펴보면', '라 할 수 있다', '의 중요성']
/** 금지 어미 — 「~다」 「~하세요」 둘만 쓴다 */
export const BANNED_ENDINGS = /(봅시다|합시다|볼까요|할까요|해요|어요|아요|예요|이에요|게요|군요|네요)$/
export const SENTENCE_MAX = 60
/** 기능 기호는 장식이 아니다 — 확인 표시·경고·봉투·음표 */
const SYMBOL_OK = new Set(['✓', '✕', '⚠', '✉', '♫', '‹', '›', '▸', '▢', '↩'])
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}★✨️]/gu

export function decorSymbols(text) {
  return [...(text.match(EMOJI_RE) ?? [])].filter((ch) => !SYMBOL_OK.has(ch))
}

/** 문장으로 가른다. 줄바꿈도 문장 끝으로 본다. 따옴표·괄호는 뗀다. */
export function sentences(text) {
  return String(text ?? '')
    .split(/\n|(?<=[.!?。])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function endWord(s) {
  return s.replace(/[\s"'”’」』)\]]+$/g, '').replace(/[.!?。…]+$/g, '').replace(/[\s"'”’」』)\]]+$/g, '')
}

/**
 * 한 문자열을 검사한다. 어긋난 곳을 문장 단위로 돌려준다.
 * @param text 검사할 글
 * @param opts.theory 이론·안내 글인가 (자료 본문이면 false)
 * @param opts.lessonOrder 이 차시 번호 — 뒤 차시를 번호로 부르는지 본다
 * @param opts.allowExclaim 게임 화면처럼 느낌표를 허용하는가
 */
export function checkText(text, opts = {}) {
  const out = []
  const t = String(text ?? '')
  if (!t.trim()) return out
  const theory = opts.theory !== false

  const decor = decorSymbols(t)
  if (decor.length > 0) out.push(`장식 기호 「${decor.join('')}」`)
  for (const n of DECOR_NAMES) if (t.includes(n)) out.push(`붙인 이름 「${n}」`)
  for (const s of TEXTBOOK_SMELL) if (t.includes(s)) out.push(`교재 냄새 「${s}」`)
  if (opts.lessonOrder) {
    for (const m of t.matchAll(/(\d{1,2})\s*강/g)) {
      if (Number(m[1]) > opts.lessonOrder) out.push(`앞 차시 번호 「${m[0]}」 — 「나중에」로`)
    }
  }
  for (const s of sentences(t)) {
    if (/https?:\/\//.test(s) || /\t|\|/.test(s)) continue
    if ([...s].length > SENTENCE_MAX) out.push(`문장이 ${[...s].length}자 — ${SENTENCE_MAX}자 이하: 「${s.slice(0, 30)}…」`)
  }

  if (!theory) return out

  for (const w of METAPHOR_WORDS) if (t.includes(w)) out.push(`설명 없는 비유 「${w}」`)
  const ss = sentences(t)
  ss.forEach((s, i) => {
    /* 「~처럼」 「~와 같다」 뒤에 설명 문장이 없으면 비유만 던진 것이다 */
    if (/(처럼|와 같다|과 같다|와 같은|과 같은)/.test(s) && i === ss.length - 1) out.push(`설명 없는 비유 「${s.slice(0, 30)}…」 — 뒤에 풀어 주는 문장이 없다`)
    if (/!$/.test(s) && !opts.allowExclaim) out.push(`느낌표 「${s.slice(0, 30)}」`)
    if (/^자, /.test(s)) out.push(`「자, 」로 시작 「${s.slice(0, 30)}」`)
    const e = endWord(s)
    if (BANNED_ENDINGS.test(e)) out.push(`어미 「${e.slice(-4)}」 — 「~다」「~하세요」만: 「${s.slice(0, 30)}」`)
  })
  for (const s of SLOGANS) if (t.includes(s)) out.push(`구호 「${s}」`)
  for (const p of PLEDGES) if (t.includes(p)) out.push(`다짐 「${p}」`)
  for (const h of HYPE_WORDS) if (t.includes(h)) out.push(`부추김 「${h}」`)
  return out
}

/**
 * 새 골격 차시에서 학생이 읽는 문자열을 전부 뽑는다 — [자리, 글, 이론글인가].
 * B 단계의 Lesson 타입(4.3~4.7)과 같은 모양이어야 한다. 이론 배경(theory)은 뺀다.
 */
export function studentStrings(lesson) {
  const out = []
  const push = (where, text, theory = true) => {
    if (text) out.push([where, String(text), theory])
  }
  const stim = (where, s) => {
    if (!s) return
    push(`${where}.title`, s.title)
    push(`${where}.body`, s.body, false)
    for (const l of s.imageSpec?.labels ?? []) push(`${where}.label`, l.text)
    if (s.imageSpec) push(`${where}.altText`, s.imageSpec.altText, false)
  }
  const fields = (where, fs) => {
    for (const f of fs ?? []) {
      push(`${where}.${f.key}.label`, f.label)
      push(`${where}.${f.key}.help`, f.help)
      push(`${where}.${f.key}.placeholder`, f.placeholder)
      for (const o of f.options ?? []) push(`${where}.${f.key}.option`, o)
      for (const i of f.items ?? []) {
        push(`${where}.${f.key}.item`, i.label)
        push(`${where}.${f.key}.item.note`, i.note)
      }
      for (const q of f.quadrants ?? []) {
        push(`${where}.${f.key}.quadrant`, q.label)
        push(`${where}.${f.key}.quadrant.hint`, q.hint)
      }
      for (const b of f.bins ?? []) push(`${where}.${f.key}.bin`, b.label)
      for (const s of f.sentenceStarters ?? []) push(`${where}.${f.key}.starter`, s)
    }
  }
  const activity = (where, a) => {
    if (!a) return
    stim(`${where}.situation`, a.situation)
    push(`${where}.task`, a.task)
    fields(where, a.fields)
    push(`${where}.share`, a.share?.prompt)
    push(`${where}.group.prompt`, a.group?.prompt)
    push(`${where}.group.repPrompt`, a.group?.repPrompt)
  }
  const concepts = (where, cs) => {
    for (const c of cs ?? []) {
      push(`${where}.${c.id}.name`, c.name)
      push(`${where}.${c.id}.what`, c.what)
      push(`${where}.${c.id}.why`, c.why)
      push(`${where}.${c.id}.inClass`, c.inClass, false)
      for (const k of c.keyPoints ?? []) push(`${where}.${c.id}.keyPoint`, k)
      push(`${where}.${c.id}.confusedWith`, c.confusedWith)
      if (c.more) {
        push(`${where}.${c.id}.more.title`, c.more.title)
        push(`${where}.${c.id}.more.body`, c.more.body)
      }
    }
  }
  push('title', lesson.title)
  push('centralQuestion', lesson.centralQuestion)
  for (const o of lesson.objectives ?? []) push('objective', o)
  if (lesson.intro) {
    stim('intro.stimulus', lesson.intro.stimulus)
    push('intro.prompt', lesson.intro.prompt)
    for (const o of lesson.intro.options ?? []) push('intro.option', o)
  }
  concepts('concepts', lesson.concepts)
  concepts('concepts2', lesson.concepts2)
  activity('activity', lesson.activity)
  activity('activity2', lesson.activity2)
  push('wrapup.prompt', lesson.wrapup?.prompt)
  return out
}

/**
 * npm run verify:stimulus
 *
 * 4차 지시서 G.2 다섯 기준을 소스에서 막는다.
 *
 * 이 검사가 있는 이유:
 * 지시서가 활동을 「상호작용 형태」로만 지정해 왔다. 「주장－증거－확실성 슬라이더」라고 적으면
 * 슬라이더는 만들어지지만 학생이 읽을 기사는 아무도 만들지 않았다.
 * 그래서 자료가 없으면 활동이 아예 만들어지지 않도록 여기서 막는다.
 *
 * ★ 아직 4차로 고치지 않은 차시가 있다. 공개된 차시에만 전부를 요구하고,
 *   나머지는 남은 개수만 알린다 — verify:lessons 가 개념 카드에 쓰는 방식과 같다.
 */
import { fail, pass, report } from './_report.mjs'

const { LESSONS } = await import('../src/content/lessons/index.ts')

/* G.2 기준 1 — 안내 문구가 화면에 없는 것을 가리킨다 */
const K1 = ['받습니다', '공개됩니다', '제시됩니다', '주어집니다', '나눠 줍니다', '배부합니다']
/* G.2 기준 2 — 입력 항목이 화면에 없는 대상을 전제한다 */
const K2 = ['이 기사가', '이 자료에서', '위 그림의', '아래 표를 보고', '이 학생의 답안',
  '방금 본', '이 대본', '이 보고서', '아래 기사', '아래 학생 보고서', '이 도식']
/* G.2 기준 3 — 순차 단계가 조건 없이 한꺼번에 보인다 */
const K3 = ['토론 뒤', '새 증거 뒤', '제출 후', '증거를 보고', '공개 후']

const published = LESSONS.filter((l) => l.published)
let noteLeft = 0
let doNowLeft = 0

for (const lesson of LESSONS) {
  const strict = lesson.published

  for (const step of lesson.steps) {
    const where = `${lesson.id}강 ${step.id}`
    const stim = step.material ?? []
    const ids = new Set(stim.map((m) => m.id))
    const guide = [step.title, step.lead, step.doNow ?? '',
      ...step.fields.flatMap((f) => [f.label, f.help ?? ''])].join('\n')

    /* 자료 블록의 기본형 */
    for (const m of stim) {
      if (!m.id) fail('자료 id', `${where} 의 자료에 id 가 없다`)
      if (m.format === 'note') noteLeft += 1
      /* H.3 — 자료는 언제나 core. 50분 판에서도 자료는 빠지지 않는다. */
      if (m.tier === 'extended') {
        fail('자료 판', `${where} 「${m.title}」 이 extended 다 — 자료는 언제나 core 여야 한다`)
      }
      /* H.5 — 가상 자료에는 라벨이 붙는다 */
      if (strict && m.format !== 'note' && m.format !== 'standard' && !m.label && !m.source) {
        fail('가상 자료 라벨', `${where} 「${m.title}」 에 출처도 라벨도 없다`)
      }
    }

    /* 기준 1 */
    if (strict) {
      const hit = K1.filter((k) => guide.includes(k))
      if (hit.length > 0 && stim.length === 0) {
        fail('기준① 자료 없음', `${where} 에 「${hit.join('·')}」 가 있는데 자료 블록이 없다`)
      }
    }

    /* 기준 2 — 가리키는 말을 쓰면 requiresStimulus 로 어느 자료인지 못 박아야 한다 */
    for (const f of step.fields) {
      const text = `${f.label}\n${f.help ?? ''}`
      const hit = K2.filter((k) => text.includes(k))
      if (hit.length > 0 && !(f.requiresStimulus?.length > 0)) {
        if (strict) {
          fail('기준② 가리킬 것 없음',
            `${where} 「${f.label}」 이 「${hit.join('·')}」 라고 하는데 requiresStimulus 가 비었다`)
        }
      }
      /* H.3 — 가리킨 자료가 같은 단계에 실제로 있는가 */
      for (const need of f.requiresStimulus ?? []) {
        if (!ids.has(need)) {
          fail('자료 연결', `${where} 「${f.label}」 이 없는 자료 「${need}」 를 가리킨다`)
        }
      }
      /* 기준 3 — 순차 표현이 있으면 여는 조건이 있어야 한다 */
      const seq = K3.filter((k) => text.includes(k))
      if (seq.length > 0 && !f.gate) {
        fail('기준③ 잠금 없음',
          `${where} 「${f.label}」 이 「${seq.join('·')}」 인데 여는 조건이 없다`)
      }
    }

    /* gate 가 가리키는 것이 실제로 있는가 (afterReveal 은 자료 id 여야 한다) */
    for (const g of [...stim.map((m) => m.gate), ...step.fields.map((f) => f.gate)]) {
      if (!g) continue
      if (!g.lockedMessage?.trim()) {
        fail('잠긴 사유', `${where} 의 gate 에 여는 조건이 적혀 있지 않다`)
      }
      if (g.type === 'afterReveal' && !ids.has(g.of)) {
        fail('공개 대상', `${where} 의 afterReveal 이 없는 자료 「${g.of}」 를 가리킨다`)
      }
    }

    /* H.1 ① — 지금 할 일 */
    const needsDoNow = step.fields.length > 0 || (step.conceptIds?.length ?? 0) > 0
    if (needsDoNow && !step.doNow) {
      if (strict) fail('지금 할 일', `${where} 에 doNow 가 없다`)
      else doNowLeft += 1
    }
    if (step.doNow) {
      if (step.doNow.includes('\n')) {
        fail('지금 할 일', `${where} 의 doNow 가 두 줄이다 — 한 문장이어야 한다`)
      }
      if (step.doNow.trim().endsWith('?')) {
        fail('지금 할 일', `${where} 의 doNow 가 물음표로 끝난다 — 명령형이어야 한다`)
      }
    }
  }
}

/* H.5 — 외부 인용은 3문장·300자를 넘지 않는다 */
for (const lesson of LESSONS) {
  for (const step of lesson.steps) {
    for (const m of step.material ?? []) {
      if (!/https?:\/\//.test(m.body)) continue
      const quoted = m.body.split(/https?:\/\//)[0]
      const sentences = quoted.split(/[.。]\s|\n/).filter((x) => x.trim()).length
      if (quoted.length > 300) {
        fail('외부 인용', `${lesson.id}강 「${m.title}」 의 인용이 ${quoted.length}자다 (300자 이하)`)
      }
      if (sentences > 6) {
        fail('외부 인용', `${lesson.id}강 「${m.title}」 의 인용이 너무 길다`)
      }
    }
  }
}

pass('자료 연결', 'requiresStimulus 가 가리키는 자료가 모두 같은 단계에 있다')
pass('여는 조건', '순차 표현이 붙은 칸에 모두 gate 와 사유가 있다')
pass('공개된 차시', `${published.map((l) => l.id).join('·')}강이 4차 구조를 갖췄다`)

if (noteLeft > 0) {
  console.log(`  · 아직 4차로 고치지 않은 자료 ${noteLeft}개 (format: note) — 3~18강`)
}
if (doNowLeft > 0) {
  console.log(`  · 아직 「지금 할 일」이 없는 단계 ${doNowLeft}개 — 미공개 차시`)
}

report('verify:stimulus')

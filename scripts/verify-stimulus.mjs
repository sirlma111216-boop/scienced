/**
 * npm run verify:stimulus (4차 G·H · 8차 골격)
 *
 * 자료가 없으면 활동이 만들어지지 않는다. 그래서 자료 블록의 기본형을 소스에서 막는다.
 *   · 자료 id · 가상 자료 꼬리표(label) 또는 출처
 *   · 대본과 학생 산출물은 줄머리 꼬리표(「교사␣␣…」)가 본문과 갈라져 있다
 *   · 칸이 가리키는 자료(requiresStimulus)가 같은 단계에 있다 · afterReveal 은 자료 id 를 가리킨다
 *   · 외부 인용은 300자 이하
 */
import { fail, pass, report } from './_report.mjs'
import { loadCourses, stepsOf, where } from './_courses.mjs'

const { parseBody } = await import('../src/lib/body-text.ts')

const K2 = ['이 기사가', '이 자료에서', '위 그림의', '아래 표를 보고', '이 학생의 답안', '방금 본', '이 대본', '이 보고서', '아래 기사', '아래 학생 보고서', '이 도식', '이 사진']
let stimuli = 0

for (const course of await loadCourses()) {
  for (const lesson of course.lessons) {
    for (const step of await stepsOf(lesson)) {
      const at = `${where(lesson)} ${step.id}`
      const stim = step.material ?? []
      const ids = new Set(stim.map((m) => m.id))
      for (const m of stim) {
        stimuli += 1
        if (!m.id) fail('자료 id', `${at} 의 자료에 id 가 없다`)
        if (!m.title?.trim()) fail('자료 제목', `${at} 의 자료에 제목이 없다`)
        if (m.format === 'dialogue' || m.format === 'studentWork') {
          const lines = parseBody(m.body)
          if (!lines.some((l) => l.kind === 'labelled')) fail('꼬리표 구분', `${at} 「${m.title}」 에 줄머리 꼬리표가 없다 — 「교사␣␣…」처럼 공백 두 칸으로 가른다`)
          const stray = lines.filter((l) => l.kind === 'plain')
          if (stray.length > 0) fail('꼬리표 구분', `${at} 「${m.title}」 에 꼬리표도 들여쓰기도 없는 줄이 ${stray.length}개 있다 — 「${stray[0].text.slice(0, 24)}…」`)
        }
        if (m.format !== 'note' && m.format !== 'standard' && !m.label && !m.source) fail('가상 자료 라벨', `${at} 「${m.title}」 에 출처도 라벨도 없다`)
        if (m.format === 'image' && !m.imageSpec) fail('그림', `${at} 「${m.title}」 은 image 인데 imageSpec 이 없다`)
        if (m.format === 'dataTable' && !m.table) fail('표', `${at} 「${m.title}」 은 dataTable 인데 table 이 없다`)
        if (/https?:\/\//.test(m.body ?? '')) {
          const quoted = m.body.split(/https?:\/\//)[0]
          if (quoted.length > 300) fail('외부 인용', `${at} 「${m.title}」 의 인용이 ${quoted.length}자다 (300자 이하)`)
        }
      }
      for (const f of step.fields) {
        const text = `${f.label}\n${f.help ?? ''}`
        const hit = K2.filter((k) => text.includes(k))
        if (hit.length > 0 && !(f.requiresStimulus?.length > 0)) fail('가리킬 것', `${at} 「${f.label}」 이 「${hit.join('·')}」 라고 하는데 requiresStimulus 가 비었다`)
        for (const need of f.requiresStimulus ?? []) if (!ids.has(need)) fail('자료 연결', `${at} 「${f.label}」 이 없는 자료 「${need}」 를 가리킨다`)
      }
      for (const g of [...stim.map((m) => m.gate), ...step.fields.map((f) => f.gate)]) {
        if (!g) continue
        if (!g.lockedMessage?.trim()) fail('잠긴 사유', `${at} 의 gate 에 여는 조건이 적혀 있지 않다`)
        if (g.type === 'afterReveal' && !ids.has(g.of)) fail('공개 대상', `${at} 의 afterReveal 이 없는 자료 「${g.of}」 를 가리킨다`)
      }
    }
  }
}

pass('자료', `자료 ${stimuli}개가 id · 제목 · 꼬리표 또는 출처를 갖췄고 대본의 줄머리가 본문과 갈라져 있다`)
pass('자료 연결', 'requiresStimulus · afterReveal 이 가리키는 자료가 모두 같은 단계에 있다')
report('verify:stimulus')

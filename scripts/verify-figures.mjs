/**
 * npm run verify:figures
 *
 * 4차 지시서 J — 그림 제작 명세.
 *
 * 「그림을 보자」라고만 적으면 만들 수 없고, 만들어도 무엇을 그려야 맞는지 알 수 없다.
 * 그래서 format: 'image' 블록은 imageSpec 없이 저장할 수 없다.
 *
 * 두 가지를 특히 본다.
 *   ① 그림 안에 한국어 글자가 들어가지 않는가 (J.2 ①)
 *      — 라벨이 있는데 genPrompt 에 no text / no labels 가 없으면 그림에 글자가 박힌다.
 *   ② 정답이 그림에 미리 보이지 않는가 (J.2 ②)
 *      — mustNotShow 가 비면 발자국 도식에 「두 사람이 만났다」가 그려질 수 있다.
 */
import { fail, pass, report } from './_report.mjs'

const { LESSONS } = await import('../src/content/lessons/index.ts')

const REQUIRED = ['purpose', 'genPrompt', 'altText', 'fallback', 'license']
const REQUIRED_LISTS = ['mustShow', 'mustNotShow']

let count = 0
let drawn = 0

for (const lesson of LESSONS) {
  for (const step of lesson.steps) {
    for (const m of step.material ?? []) {
      if (m.format !== 'image') {
        if (m.imageSpec) {
          fail('명세 위치', `${lesson.id}강 「${m.title}」 은 image 가 아닌데 imageSpec 이 있다`)
        }
        continue
      }
      count += 1
      const where = `${lesson.id}강 「${m.title}」`
      const spec = m.imageSpec
      if (!spec) {
        fail('제작 명세', `${where} 에 imageSpec 이 없다 — 그림은 명세 없이 만들 수 없다`)
        continue
      }

      for (const key of REQUIRED) {
        if (!String(spec[key] ?? '').trim()) fail('제작 명세', `${where} 의 ${key} 가 비었다`)
      }
      for (const key of REQUIRED_LISTS) {
        if (!(spec[key]?.length > 0)) fail('제작 명세', `${where} 의 ${key} 가 비었다`)
      }

      /* ① 그림 안에 글자를 넣지 않는다 */
      if (spec.labels?.length > 0) {
        const p = String(spec.genPrompt ?? '').toLowerCase()
        if (!p.includes('no text') || !p.includes('no labels')) {
          fail('그림 속 글자',
            `${where} 는 라벨이 있는데 genPrompt 에 no text / no labels 가 없다 — 그림에 글자가 박힌다`)
        }
        for (const l of spec.labels) {
          if (!l.text?.trim() || !l.position?.trim()) {
            fail('라벨', `${where} 의 라벨에 글이나 위치가 없다`)
          }
        }
      }

      /* 대체 설명은 그림을 대신할 만큼이어야 한다 */
      if (String(spec.altText ?? '').length < 40) {
        fail('대체 설명', `${where} 의 altText 가 너무 짧다 — 보지 않고 같은 판단이 되어야 한다`)
      }

      /* 모형 그림은 실제와 다른 점을 밝힌다 */
      if (/모형|모델/.test(m.title) && !spec.differsFromReality) {
        fail('모형 그림', `${where} 는 모형인데 differsFromReality 가 없다`)
      }

      if (spec.figureId) drawn += 1
    }
  }
}

if (count === 0) {
  pass('그림', '아직 그림 블록이 없다')
} else {
  pass('그림 제작 명세', `그림 ${count}장 모두 명세·프롬프트·대체 설명·대안을 갖췄다`)
  pass('그림 속 글자', '라벨이 있는 그림은 모두 글자 없이 생성하도록 적혀 있다')
  console.log(`  · 앱이 SVG 로 직접 그리는 그림 ${drawn}장 / ${count}장`)
}

report('verify:figures')

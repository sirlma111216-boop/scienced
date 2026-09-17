/**
 * npm run verify:figures (4차 J · 8차 골격)
 *
 * format: 'image' 블록은 imageSpec 없이 저장할 수 없다. 그림 안에 한국어 글자를 넣지 않는다.
 * src 가 가리키는 파일은 실제로 있어야 한다. 파일이 아직 없는 것은 실패가 아니다 — 그림은 강의자가 만든다.
 */
import { existsSync } from 'node:fs'
import { fail, pass, report } from './_report.mjs'
import { loadCourses, stepsOf, where } from './_courses.mjs'

const REQUIRED = ['purpose', 'genPrompt', 'altText', 'fallback', 'license']
const REQUIRED_LISTS = ['mustShow', 'mustNotShow']

let count = 0
let drawn = 0
const pending = []

for (const course of await loadCourses()) {
  for (const lesson of course.lessons) {
    for (const step of await stepsOf(lesson)) {
      for (const m of step.material ?? []) {
        const at = `${where(lesson)} 「${m.title}」`
        if (m.format !== 'image') {
          if (m.imageSpec) fail('명세 위치', `${at} 은 image 가 아닌데 imageSpec 이 있다`)
          continue
        }
        count += 1
        const spec = m.imageSpec
        if (!spec) {
          fail('제작 명세', `${at} 에 imageSpec 이 없다 — 그림은 명세 없이 만들 수 없다`)
          continue
        }
        for (const key of REQUIRED) if (!String(spec[key] ?? '').trim()) fail('제작 명세', `${at} 의 ${key} 가 비었다`)
        for (const key of REQUIRED_LISTS) if (!(spec[key]?.length > 0)) fail('제작 명세', `${at} 의 ${key} 가 비었다`)
        if (spec.labels?.length > 0) {
          const p = String(spec.genPrompt ?? '').toLowerCase()
          if (!p.includes('no text') || !p.includes('no labels')) fail('그림 속 글자', `${at} 는 라벨이 있는데 genPrompt 에 no text / no labels 가 없다`)
          for (const l of spec.labels) if (!l.text?.trim() || !l.position?.trim()) fail('라벨', `${at} 의 라벨에 글이나 위치가 없다`)
        }
        if (String(spec.altText ?? '').length < 40) fail('대체 설명', `${at} 의 altText 가 너무 짧다`)
        if (/모형|모델/.test(m.title) && !spec.differsFromReality) fail('모형 그림', `${at} 는 모형인데 differsFromReality 가 없다`)
        if (spec.src) {
          drawn += 1
          const onDisk = `public${String(spec.src).split('?')[0]}`
          if (!existsSync(onDisk)) fail('그림 파일', `${at} 가 ${spec.src} 를 가리키는데 ${onDisk} 가 없다`)
        } else if (lesson.published) pending.push(at)
      }
    }
  }
}

if (count === 0) pass('그림', '아직 그림 블록이 없다')
else {
  pass('그림 제작 명세', `그림 ${count}장 모두 명세·프롬프트·대체 설명·대안을 갖췄다`)
  pass('그림 파일', 'src 가 가리키는 파일이 모두 public 아래에 실제로 있다')
  console.log(`  · 파일이 들어온 그림 ${drawn}장 / ${count}장`)
  for (const p of pending) console.log(`  · 파일 기다리는 중: ${p}`)
}
report('verify:figures')

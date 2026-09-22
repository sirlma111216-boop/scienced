/**
 * npm run audit:activity (8차 11절 신설)
 *
 * 활동마다:
 *   · 네 검사(정답 · 갈림 · 이해 · 상황)가 코드 주석과 checks 필드 양쪽에 있고 서로 같다
 *   · 선택형이면 선택지 3개 이상
 *   · 상황 자료가 있고 200~400자 · 「수업용으로 만든 가상 자료」 꼬리표 또는 출처
 *   · 과제문은 명령형 한 문장 — 물음표로 끝나지 않는다
 *   · 칸마다 안내(help) 한 줄 — 화면의 과제 블록이 「무엇을 쓰나」로 그대로 보인다
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report } from './_report.mjs'
import { activitiesOf, activityLabel, loadCourses, where } from './_courses.mjs'

const KEYS = [
  ['answer', '정답'],
  ['split', '갈림'],
  ['understand', '이해'],
  ['situation', '상황'],
]

let activities = 0
let bad = 0

for (const course of await loadCourses()) {
  for (const l of course.lessons) {
    const file = `src/content/courses/${course.courseId}/lesson${l.id}.ts`
    let src = ''
    try {
      src = await readFile(file, 'utf8')
    } catch {
      fail('차시 파일', `${where(l)} 의 파일 ${file} 이 없다`)
      bad += 1
      continue
    }
    /* 교육론 1강처럼 다른 과목의 파일을 그대로 내보내면 그 파일의 주석을 본다 */
    const re = src.match(/from '\.\.\/(method|edu)\/(lesson\d{2})'/)
    if (re) src += '\n' + (await readFile(`src/content/courses/${re[1]}/${re[2]}.ts`, 'utf8'))
    const comments = [...src.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => m[0]).join('\n')

    for (const [i, a] of activitiesOf(l).entries()) {
      activities += 1
      const at = `${where(l)} ${activityLabel(l, i)}`

      for (const [key, label] of KEYS) {
        const v = String(a.checks?.[key] ?? '').trim()
        if (!v) {
          fail('네 검사', `${at} 의 ${label} 검사가 비었다`)
          bad += 1
          continue
        }
        if (!comments.includes(`${label}:`)) {
          fail('네 검사 주석', `${at} — 코드 주석에 「${label}:」 가 없다 (4.5)`)
          bad += 1
        } else if (!comments.includes(v.slice(0, 40))) {
          fail('네 검사 주석', `${at} — 주석의 ${label} 검사가 checks.${key} 와 다르다`)
          bad += 1
        }
      }

      /* 상황 */
      const body = String(a.situation?.body ?? '')
      const len = [...body.replace(/\s+/g, ' ')].length
      if (len < 200 || len > 400) {
        fail('상황 길이', `${at} 상황이 ${len}자다 (200~400자)`)
        bad += 1
      }
      if (!a.situation?.label && !a.situation?.source) {
        fail('상황 꼬리표', `${at} 상황에 「수업용으로 만든 가상 자료」 꼬리표도 출처도 없다`)
        bad += 1
      }
      if (a.situation?.label && a.situation.label !== '수업용으로 만든 가상 자료') {
        fail('상황 꼬리표', `${at} 꼬리표가 「${a.situation.label}」 이다 — 「수업용으로 만든 가상 자료」 그대로 (9절)`)
      }

      /* 과제문 */
      if (/\?\s*$/.test(a.task ?? '')) {
        fail('과제문', `${at} 과제문이 물음표로 끝난다 — 명령형 한 문장`)
        bad += 1
      }
      if (!/(하세요|쓰세요|고르세요|정하세요|나누세요|적으세요|놓으세요|매기세요|배분하세요)\.?$/.test((a.task ?? '').trim())) {
        fail('과제문', `${at} 과제문이 명령형(「~하세요」)으로 끝나지 않는다: 「${(a.task ?? '').slice(-20)}」`)
        bad += 1
      }

      /* 칸마다 안내 한 줄 — 과제 블록이 이 줄을 「무엇을 쓰나」에 그대로 보인다 (강의자 지시 2026-09-21) */
      for (const f of a.fields) {
        /* 어미·문장 길이는 verify:wording 이 본다. 여기서는 있는지와 한 줄인지만 본다 */
        const help = String(f.help ?? '').trim()
        if (!help) {
          fail('칸 안내', `${at} 「${f.label}」 에 안내(help)가 없다 — 무엇을 보고 무엇을 쓰는지 한 줄로 적는다`)
          bad += 1
        } else if ([...help].length > 90) {
          fail('칸 안내', `${at} 「${f.label}」 의 안내가 ${[...help].length}자다 — 90자 이하 한 줄`)
          bad += 1
        }
      }

      /* 선택형 */
      for (const f of a.fields) {
        if ((f.kind === 'choice' || f.kind === 'multi') && (f.options?.length ?? 0) < 3) {
          fail('선택지', `${at} 「${f.label}」 선택지가 ${f.options?.length ?? 0}개다 (3개 이상)`)
          bad += 1
        }
        if ((f.kind === 'allocation' || f.kind === 'rank' || f.kind === 'sort') && (f.items?.length ?? 0) < 4) {
          fail('카드 수', `${at} 「${f.label}」 항목이 ${f.items?.length ?? 0}개다 (4개 이상)`)
          bad += 1
        }
        if (f.kind === 'sort' && (f.bins?.length ?? 0) !== 2) fail('분류 통', `${at} 「${f.label}」 통이 ${f.bins?.length ?? 0}개다 (2개)`)
      }
    }
  }
}

if (activities === 0) fail('활동', '활동이 하나도 없다')
if (bad === 0) pass('활동', `${activities}개 활동이 네 검사 · 상황 200~400자 · 명령형 과제 · 칸마다 안내 한 줄 · 선택지 3개 이상을 갖췄다`)
report('audit:activity')

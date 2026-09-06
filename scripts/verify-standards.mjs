/**
 * npm run verify:standards
 *
 * 원문 대조를 마치지 않은 성취기준에 「대표 예시」 라벨이 있는지.
 *
 * 컨텍스트 10절: 교재에는 재확인이 필요한 표현이 있고, 성취기준 코드는
 * 2015 자료를 재활용하면서 코드만 바꾸는 오류가 흔하다.
 * 그래서 verified: false 인 항목은 화면에 반드시 「대표 예시」로 표시한다.
 */
import { fail, pass, report } from './_report.mjs'

const { LESSONS } = await import('../src/content/lessons/index.ts')

let unverified = 0
for (const l of LESSONS) {
  const link = l.curriculumLink
  if (!link) {
    fail('교육과정 연결', `${l.id}강에 curriculumLink 가 없다`)
    continue
  }
  if (typeof link.verified !== 'boolean') {
    fail('검증 표시', `${l.id}강 curriculumLink.verified 가 boolean 이 아니다`)
  }
  if (!link.verified) {
    unverified++
    if (link.label !== '대표 예시') {
      fail(
        '대표 예시 라벨',
        `${l.id}강은 원문 대조 전인데 라벨이 「${link.label}」 이다 (「대표 예시」여야 한다)`,
      )
    }
  }
}
pass('대표 예시 라벨', `원문 대조 전인 ${unverified}개 차시가 모두 「대표 예시」로 표시된다`)

// 성취기준 코드 형식을 흉내 낸 문자열이 검증 없이 들어 있지 않은지
// (예: [9과01-01] 같은 코드는 원문 대조 후에만 쓴다)
const CODE_PATTERN = /\[\s*\d{1,2}\s*과\s*\d{2}\s*-\s*\d{2}\s*\]/
for (const l of LESSONS) {
  const blob = JSON.stringify(l)
  if (CODE_PATTERN.test(blob) && !l.curriculumLink.verified) {
    fail(
      '미검증 성취기준 코드',
      `${l.id}강에 성취기준 코드가 있는데 verified 가 false 다 — 원문 대조 후에만 코드를 쓴다`,
    )
  }
}
pass('성취기준 코드', '원문 대조를 마치지 않은 차시에 성취기준 코드를 넣지 않았다')

report('verify:standards')

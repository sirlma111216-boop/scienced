/**
 * npm run verify:content
 *
 * 통합교재의 두 가지가 화면 문구로 새어 들어오지 않았는지 확인한다.
 *
 * ① OCR 오독 문자열
 *    교재의 87%를 차지하는 '심화 읽기'는 원본 도서 스캔 OCR 원문이며 교정되지 않았다.
 *    문단의 41%에 오독이 남아 있다. 심화 읽기는 첨부 참고자료로만 다루고
 *    화면 텍스트로 복사하지 않는다.
 *
 * ② 자동 생성 틀 문구
 *    "○○이(가) 학생의 설명과 교사의 선택을 어떻게 바꾸는가?" 72회,
 *    "○○: 정의를 외우기보다 …" 72회, 18개 장 동일한 '수업으로 가져가기'.
 *    화면 문구는 컨텍스트 문서 9절·22~23절을 근거로 차시마다 새로 쓴다.
 */
import { readFile } from 'node:fs/promises'
import { fail, pass, report, walk } from './_report.mjs'

/**
 * 교재에서 실제로 확인된 OCR 오독. 하나라도 화면 문구에 있으면 원문 복사를 의심한다.
 *
 * 짧은 한글 오독은 정상 낱말의 일부로 흔히 나타나므로 경계 조건을 함께 건다.
 * 예를 들어 교재의 「히는」(→하는)은 맞히는·막히는·좁히는 같은 정상 낱말에도 들어 있어
 * 그대로 찾으면 오탐만 나온다. 그래서 앞 글자가 ㅎ 계열 어간이 아닌 경우만 잡는다.
 */
const OCR_ARTIFACTS = [
  { re: /(?<![맞막좁넓밝익식답눕뽑잡묻])히는/, label: '히는 (→하는)' },
  { re: /(?<![제표게고예명전개통]|다시 )시용/, label: '시용 (→사용)' },
  { re: /결괴(?![가-힣])/, label: '결괴 (→결과)' },
  { re: /비고츠기/, label: '비고츠기 (→비고츠키)' },
  { re: /브루L--l/, label: '브루L--l (→브루너)' },
  { re: /대assard/, label: '대assard' },
  { re: /spiml curriculum/i, label: 'spiml curriculum (→spiral)' },
  { re: /s=1\/2gt2/, label: 's=1/2gt2' },
  { re: /학셍|힉생|괴학|수엽|교시가(?![-가-힣])/, label: '학셍·힉생·괴학·수엽·교시가' },
]

/** 교재의 자동 생성 틀. 화면에 나가는 문구로 쓰면 안 된다. */
const TEMPLATE_PHRASES = [
  '학생의 설명과 교사의 선택을 어떻게 바꾸는가',
  '정의를 외우기보다 이 개념이',
  '읽으면서 계속 물을 질문',
  '자신의 전공 영역에서',
  '동료 피드백 뒤 수정한 부분에는 주석을 달고',
  '이 장에서 연결할 핵심',
]

/**
 * 주석을 지운 뒤 검사한다.
 * 주석은 화면에 나가지 않고, 이 규칙을 설명하려면 금지 문구를 인용해야 하기 때문이다.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const files = [
  ...(await walk('src', ['.ts', '.tsx'])),
  ...(await walk('shared', ['.ts'])),
  ...(await walk('functions', ['.ts'])),
]

let ocrHits = 0
let templateHits = 0

for (const file of files) {
  const code = stripComments(await readFile(file, 'utf8'))
  for (const { re, label } of OCR_ARTIFACTS) {
    const m = code.match(re)
    if (m) {
      const at = code.slice(Math.max(0, m.index - 25), m.index + 25).replace(/\s+/g, ' ')
      fail('OCR 오독', `${file} 에 「${label}」 — …${at}… (교재 심화 읽기 원문으로 보인다)`)
      ocrHits++
    }
  }
  for (const phrase of TEMPLATE_PHRASES) {
    if (code.includes(phrase)) {
      fail('반복 템플릿', `${file} 에 교재의 자동 생성 문구 「${phrase}」 가 있다`)
      templateHits++
    }
  }
}

if (ocrHits === 0) {
  pass('OCR 오독', `${files.length}개 소스 파일에 교재 스캔 오독 ${OCR_ARTIFACTS.length}종이 없다`)
}
if (templateHits === 0) {
  pass('반복 템플릿', `72회 반복 문구를 포함한 ${TEMPLATE_PHRASES.length}종이 화면 문구에 없다`)
}

/*
 * 차시마다 새로 쓴다 — 문장 단위 대조 (8차 11절).
 * 두 차시(과목 불문)에 같은 문장이 있으면 실패한다. 교육론 1강은 교수법 1강과 같으므로 그 짝은 예외.
 * 12자 미만의 짧은 문장(「그렇다.」)은 세지 않는다. 교재 원문은 저장소에 없어 대조하지 못한다 — OCR 오독·반복 템플릿으로 막는다.
 */
{
  const { allLessons, where } = await import('./_courses.mjs')
  const { sentences, studentStrings } = await import('./_wording-rules.mjs')
  const norm = (x) => x.replace(/[\s「」『』"'“”‘’.,·—-]/g, '')
  const bank = new Map()
  const dupes = []
  for (const l of await allLessons()) {
    for (const [, text, theory] of studentStrings(l)) {
      if (!theory) continue
      for (const s of sentences(text)) {
        const key = norm(s)
        if (key.length < 12) continue
        const prev = bank.get(key)
        if (prev && prev.lessonKey !== `${l.courseId}:${l.id}` && !(prev.lessonId === '01' && l.id === '01')) {
          dupes.push(`${prev.at} ↔ ${where(l)} 「${s.slice(0, 40)}」`)
        }
        if (!prev) bank.set(key, { at: where(l), lessonId: l.id, lessonKey: `${l.courseId}:${l.id}` })
      }
    }
  }
  for (const d of dupes.slice(0, 40)) fail('문장 중복', d)
  if (dupes.length === 0) pass('문장 중복', `${bank.size}개 문장이 차시 사이에서 겹치지 않는다 (교육론 1강 = 교수법 1강 제외)`)
}

report('verify:content')

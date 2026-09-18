/**
 * 검토 문서(docs/검토/<과목>-<nn>.md) 읽기 — audit:draft 와 sync:checks 가 같은 함수를 쓴다.
 *
 * 카드의 잠깐 확인은 카드 끝에 이렇게 쓴다:
 *
 *   확인      물음?
 *             ① 보기
 *             ② 보기
 *             ③ 보기
 *             ④ 보기
 *             정답 ③
 */

export const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()

export const MARKS = ['①', '②', '③', '④']

export function parseDoc(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const doc = { objectives: [], options: [], cards: [], checks: {}, task: [], wrapup: [] }
  let section = ''
  let card = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    /* 줄머리 꼬리표(과제 · 문항 · 질문 · 선택지)는 첫 칸에서 시작한다. 들여쓴 줄은 자료 본문(「과제  가열 그래프…」)이다 */
    const head = !/^\s/.test(raw)
    let m
    if ((m = line.match(/^## (도입|개념|활동|정리|이렇게 정했다)/))) {
      section = m[1]
      card = null
      continue
    }
    if ((m = line.match(/^### 카드 \d+ ─ (.+)$/))) {
      card = { name: norm(m[1]), points: [], check: null }
      doc.cards.push(card)
      continue
    }
    if (section === '개념' && card && (m = line.match(/^확인\s+(.+)$/))) card.check = { prompt: norm(m[1]), options: [], answer: null }
    else if (section === '개념' && card?.check && (m = line.match(/^([①②③④])\s+(.+)$/))) card.check.options[MARKS.indexOf(m[1])] = norm(m[2])
    else if (section === '개념' && card?.check && (m = line.match(/^정답\s+([①②③④])$/))) card.check.answer = MARKS.indexOf(m[1])
    else if ((m = line.match(/^중심 질문\s+(.+)$/))) doc.centralQuestion = norm(m[1])
    else if ((m = line.match(/^학습목표\s+1\s+(.+)$/))) doc.objectives.push(norm(m[1]))
    else if (section === '' && (m = line.match(/^([23])\s+(.+)$/))) doc.objectives.push(norm(m[2]))
    else if (head && section === '도입' && (m = line.match(/^질문\s+(.+)$/))) doc.introPrompt = norm(m[1])
    else if (head && section === '도입' && (m = line.match(/^선택지\s+(.+)$/))) doc.options = m[1].split('/').map(norm)
    else if (section === '개념' && card && (m = line.match(/^(?:기준\s+)?([123])\s+(.+)$/))) card.points.push(norm(m[2]))
    else if (head && section === '활동' && (m = line.match(/^과제\s+(.+)$/))) doc.task.push(norm(m[1]))
    else if (section === '활동' && (m = line.match(/^(?:검사\s+)?(정답|갈림|이해|상황):\s*(.+)$/))) doc.checks[m[1]] = [...(doc.checks[m[1]] ?? []), norm(m[2])]
    else if (head && section === '정리' && (m = line.match(/^문항\s+(.+)$/))) doc.wrapup.push(norm(m[1]))
  }
  return doc
}

/** 문서 이름 — 교육론 1강은 교수법 1강과 같다 (강의자 답 4) */
export function docNameOf(courseId, lessonId) {
  return courseId === 'edu' && lessonId === '01' ? 'method-01.md' : `${courseId}-${lessonId}.md`
}

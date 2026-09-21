/**
 * 받침에 맞는 조사 — 화면이 자료 제목을 문장에 끼워 넣을 때 쓴다.
 * 「보고서」를 · 「물방울」을 · 「메모」를. 한글이 아니면 기본형을 준다.
 */
function hasFinalConsonant(word: string): boolean | null {
  /* 제목이 괄호·따옴표로 끝나는 일이 많다 — 뒤에서부터 첫 한글 음절을 찾는다 */
  const chars = [...word.trim()]
  for (let i = chars.length - 1; i >= 0; i--) {
    const code = chars[i].charCodeAt(0)
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0
  }
  return null
}

/** 을 / 를 */
export function objectParticle(word: string): string {
  const has = hasFinalConsonant(word)
  return has === null ? '를' : has ? '을' : '를'
}

/** 은 / 는 */
export function topicParticle(word: string): string {
  const has = hasFinalConsonant(word)
  return has === null ? '는' : has ? '은' : '는'
}

/**
 * 자료 본문의 줄 구조.
 *
 * 화면과 검사가 같은 판정을 써야 한다. 그래서 JSX 없는 순수 함수로 따로 둔다 —
 * 검사 스크립트는 .tsx 를 불러오지 못한다.
 */

export type BodyLine =
  /** 꼬리표가 붙은 줄 — 화자 이름, 「제목」·「방법」 따위 */
  | { kind: 'labelled'; label: string; text: string }
  /** 앞 줄에서 이어지는 줄 (공백으로 들여쓴 줄) */
  | { kind: 'cont'; text: string }
  /** (1분) (관찰) 같은 지문 */
  | { kind: 'aside'; text: string }
  | { kind: 'plain'; text: string }
  | { kind: 'gap' }

/**
 * 자료 본문을 줄 단위로 가른다.
 *
 * 규칙은 교재가 이미 쓰고 있던 모양 그대로다.
 *   「교사␣␣자, 다들 앞으로 보세요」  — 공백 두 칸 이상이 꼬리표와 본문을 가른다
 *   「␣␣␣␣␣␣두 화분에 물을…」        — 공백으로 시작하면 앞 줄에서 이어지는 줄
 *   「(1분)」                          — 괄호만 있는 줄은 지문
 *
 * 꼬리표는 15자를 넘지 않는다. 그보다 길면 본문에 우연히 낀 두 칸 공백이다.
 */
export function parseBody(body: string): BodyLine[] {
  const out: BodyLine[] = []
  for (const raw of body.split('\n')) {
    if (!raw.trim()) {
      out.push({ kind: 'gap' })
      continue
    }
    if (/^\s*\([^)]*\)\s*$/.test(raw)) {
      out.push({ kind: 'aside', text: raw.trim() })
      continue
    }
    if (/^\s/.test(raw)) {
      out.push({ kind: 'cont', text: raw.trim() })
      continue
    }
    const m = raw.match(/^(\S.{0,14}?)\s{2,}(\S.*)$/)
    if (m) {
      out.push({ kind: 'labelled', label: m[1], text: m[2] })
      continue
    }
    out.push({ kind: 'plain', text: raw })
  }
  // 끝에 남은 빈 줄은 버린다
  while (out.length > 0 && out[out.length - 1].kind === 'gap') out.pop()
  return out
}

/** 파싱한 줄에 꼬리표가 하나라도 있는가. verify 와 화면이 같은 판정을 쓴다. */
export function hasLabels(body: string): boolean {
  return parseBody(body).some((l) => l.kind === 'labelled')
}

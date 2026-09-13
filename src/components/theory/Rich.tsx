import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { TheoryEntry } from '@/content/types'
import { TermPopover } from './TermPopover'
import { useTheory } from './TheoryContext'

/**
 * 본문 글 한 덩어리 — **강조**와 용어 밑줄을 함께 그린다.
 *
 * withEmphasis 는 굵게만 했다. 5차부터는 본문의 쉬운 말 가운데 정식 용어가 있는 곳에
 * 점선 밑줄이 붙어야 한다(K.3). 두 처리를 한 자리에서 한다 — 굵은 글 안의 용어도 밑줄이 붙는다.
 *
 * 같은 말이 한 글에 여러 번 나오면 첫 번째에만 밑줄을 긋는다.
 * 문단마다 다섯 번 밑줄이 그어지면 읽는 사람은 밑줄을 그냥 무시하게 된다.
 */

interface TermHit {
  plain: string
  entry: TheoryEntry
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 항목마다 적어 둔 쉬운 말 표현을 한 목록으로. 긴 표현이 먼저 맞아야 「대안적 개념」이 「개념」에 잡히지 않는다. */
function buildIndex(entries: TheoryEntry[]): { hits: TermHit[]; re: RegExp | null } {
  const hits: TermHit[] = []
  for (const e of entries) for (const p of e.plainTerms ?? []) if (p.trim()) hits.push({ plain: p, entry: e })
  hits.sort((a, b) => b.plain.length - a.plain.length)
  if (hits.length === 0) return { hits, re: null }
  return { hits, re: new RegExp(`(${hits.map((h) => escapeRe(h.plain)).join('|')})`, 'g') }
}

export function Rich({ text }: { text: string }) {
  const { entries } = useTheory()
  const index = useMemo(() => buildIndex(entries), [entries])
  const seen = new Set<string>()

  function terms(part: string, keyBase: string): ReactNode[] {
    if (!index.re) return [part]
    const out: ReactNode[] = []
    const pieces = part.split(index.re)
    pieces.forEach((piece, i) => {
      if (i % 2 === 0) {
        if (piece) out.push(<span key={`${keyBase}-${i}`}>{piece}</span>)
        return
      }
      const hit = index.hits.find((h) => h.plain === piece)
      if (!hit || seen.has(hit.entry.id)) {
        out.push(<span key={`${keyBase}-${i}`}>{piece}</span>)
        return
      }
      seen.add(hit.entry.id)
      out.push(<TermPopover key={`${keyBase}-${i}`} plain={piece} entry={hit.entry} />)
    })
    return out
  }

  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} style={{ fontWeight: 700 }}>
            {terms(part, `b${i}`)}
          </strong>
        ) : (
          <span key={i}>{terms(part, `t${i}`)}</span>
        ),
      )}
    </>
  )
}

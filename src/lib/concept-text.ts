/** Keep numbered teaching steps separate from surrounding explanatory prose. */
export type ConceptTextBlock = { kind: 'paragraph'; text: string } | { kind: 'list'; start: number; items: string[] }

export function conceptTextBlocks(text: string): ConceptTextBlock[] {
  const blocks: ConceptTextBlock[] = []
  for (const paragraph of text.split(/\n\s*\n/).filter(Boolean)) {
    const sentences = paragraph.trim().split(/(?<=[.!?。])\s+|\s+(?=[①-⑳])/)
    let prose: string[] = []
    const flush = () => {
      if (prose.length) blocks.push({ kind: 'paragraph', text: prose.join(' ') })
      prose = []
    }
    for (const sentence of sentences) {
      const match = /^([①-⑳])\s*(.*)$/.exec(sentence)
      if (match) {
        flush()
        const number = match[1].charCodeAt(0) - '①'.charCodeAt(0) + 1
        const previous = blocks[blocks.length - 1]
        if (previous?.kind === 'list' && previous.start + previous.items.length === number) previous.items.push(match[2])
        else blocks.push({ kind: 'list', start: number, items: [match[2]] })
      } else prose.push(sentence)
    }
    flush()
  }
  return blocks
}

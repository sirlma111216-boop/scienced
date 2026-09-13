import { useEffect } from 'react'
import type { Lesson } from '@/content/types'
import { Button, Caption, ColorBlock, Notice } from '@/components/ui'
import { EntryView } from './EntryView'

/**
 * 차시 「이론 배경」 화면 (5차 K.2).
 *
 * 단계가 아니다. 번호가 없고, 잠기지 않고, 강사가 열어 주지 않아도 학생이 언제든 본다.
 * 50분 판에서도 그대로 남는다 — 강의 흐름 안의 활동이 아니라 참조 자료다.
 *
 * 맨 위에 이 차시의 이론적 위치 서너 문장, 그 아래 이론 항목들.
 * 인쇄와 내려받기 단추를 둔다. 학생이 이 화면을 들고 다른 교재를 읽을 수 있어야 한다.
 */
export function TheoryPage({
  lesson,
  focusEntryId,
  isInstructor,
}: {
  lesson: Lesson
  /** 팝오버에서 「자세히 보기」로 들어왔을 때 그 항목으로 내려간다 */
  focusEntryId?: string | null
  isInstructor: boolean
}) {
  const theory = lesson.theory

  useEffect(() => {
    if (!focusEntryId) return
    const el = document.getElementById(`theory-${focusEntryId}`)
    el?.scrollIntoView({ block: 'start' })
    /* 스크린 리더가 어디로 왔는지 알도록 초점을 옮긴다 */
    el?.setAttribute('tabindex', '-1')
    ;(el as HTMLElement | null)?.focus()
  }, [focusEntryId])

  if (!theory || theory.entries.length === 0) {
    return (
      <section>
        <p className="eyebrow">이론 배경</p>
        <h2 className="text-headline" style={{ margin: '8px 0 16px' }}>
          {lesson.id}강 {lesson.title}
        </h2>
        <Notice tone="cream">
          <p className="text-body-sm" style={{ margin: 0 }}>
            이 차시의 이론 배경은 아직 정리 중입니다.
          </p>
        </Notice>
      </section>
    )
  }

  const unverified = theory.entries.filter((e) => !e.verified).length

  function download() {
    const lines: string[] = [`# ${lesson.id}강 ${lesson.title} — 이론 배경`, '', theory!.summary, '']
    for (const e of theory!.entries) {
      lines.push(`## ${e.termKo} (${e.termEn})${e.verified ? '' : '  [확인 중]'}`)
      lines.push(
        e.scholars.map((s) => `${s.nameKo} (${s.nameEn}${s.year ? `, ${s.year}` : ''})`).join(' · '),
      )
      lines.push('', '**무엇을 주장하는가**', e.claim, '', '**본문과의 연결**', e.bridgeToPlain, '',
        '**한계와 비판**', e.limits, '')
      for (const q of e.quotes ?? []) lines.push(`> ${q.ko}`, `> ${q.original}`, `> — ${q.source}`, '')
      lines.push(`교재 · ${e.textbookRef}`)
      for (const r of e.readings) lines.push(`- ${r.title}${r.url ? ` ${r.url}` : ''}`)
      lines.push('')
    }
    const blob = new Blob([lines.join('\n').replace(/\*\*/g, '')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${lesson.id}강-이론배경.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section>
      <div className="flex items-start gap-md" style={{ flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px' }}>
          <p className="eyebrow">이론 배경 · 참조 자료</p>
          <h2 className="text-headline" style={{ margin: '8px 0 0' }}>
            {lesson.id}강 {lesson.title}
          </h2>
        </div>
        <div className="flex gap-xs no-print">
          <Button variant="secondary" onClick={() => window.print()}>
            인쇄
          </Button>
          <Button variant="secondary" onClick={download}>
            내려받기
          </Button>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <ColorBlock tone="cream">
          <Caption>이 차시의 이론적 위치</Caption>
          <p className="text-body-lg" style={{ margin: '8px 0 0', whiteSpace: 'pre-line' }}>
            {theory.summary}
          </p>
        </ColorBlock>
      </div>

      {unverified > 0 ? (
        <p className="text-body-sm" style={{ marginTop: 16, opacity: 0.75 }}>
          「확인 중」 {unverified}개 — 인명·연도·원어 표기를 원문과 대조하기 전입니다. 그대로 보이되
          미확인임을 알립니다.
        </p>
      ) : null}

      <ol
        className="flex flex-col"
        style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', gap: 32 }}
      >
        {theory.entries.map((e) => (
          <li key={e.id} className="card">
            <EntryView entry={e} isInstructor={isInstructor} />
          </li>
        ))}
      </ol>
    </section>
  )
}

import { useEffect, useId, useRef, useState } from 'react'
import type { TheoryEntry } from '@/content/types'
import { useTheory } from './TheoryContext'

/**
 * 용어 팝오버 (5차 K.3).
 *
 * 본문의 쉬운 말에 점선 밑줄. 누르면 세 줄짜리 카드 —
 *   쉬운 말 → 정식 용어 (원어)
 *   연구자, 연도
 *   [이론 배경에서 자세히 보기]
 *
 * 세 줄을 넘기지 않는다. 자세한 것은 이론 배경으로 보낸다.
 * 마우스를 올려야만 뜨게 만들지 않는다 — 단추다. Enter 로 열고 Escape 로 닫는다.
 * 닫으면 초점이 단추로 돌아온다. 돌아오지 않으면 키보드 사용자는 자기가 어디 있는지 잃는다.
 */
export function TermPopover({ plain, entry }: { plain: string; entry: TheoryEntry }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLSpanElement>(null)
  const id = useId()
  const { openEntry } = useTheory()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        btn.current?.focus()
      }
    }
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (box.current?.contains(t) || btn.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  const who = entry.scholars
    .map((s) => `${s.nameKo}${s.year ? `, ${s.year}` : ''}`)
    .join(' · ')

  return (
    <span style={{ position: 'relative', display: 'inline' }}>
      <button
        ref={btn}
        type="button"
        className="term"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        title={`${entry.termKo} — 정식 용어 보기`}
        onClick={() => setOpen((o) => !o)}
      >
        {plain}
      </button>
      {/*
        본문의 <p> 안에서 열린다. <div>·<p> 를 넣으면 HTML 중첩 규칙에 어긋나 콘솔에 경고가 난다 —
        그래서 전부 span 이고 display 로 줄을 만든다.
      */}
      {open ? (
        <span
          ref={box}
          id={id}
          role="dialog"
          aria-label={`${plain}의 정식 용어`}
          className="term-pop"
        >
          <span className="text-body-sm" style={{ display: 'block', margin: 0 }}>
            <span style={{ opacity: 0.7 }}>{plain}</span>
            <span aria-hidden="true"> → </span>
            <strong>{entry.termKo}</strong>{' '}
            <span className="font-mono" style={{ fontSize: 12, opacity: 0.8 }}>
              ({entry.termEn})
            </span>
            {!entry.verified ? (
              <span className="caption" style={{ marginLeft: 6 }}>
                확인 중
              </span>
            ) : null}
          </span>
          <span className="text-body-sm" style={{ display: 'block', margin: '4px 0 0', opacity: 0.85 }}>
            {who}
          </span>
          {openEntry ? (
            <button
              type="button"
              className="btn-tertiary"
              style={{ marginTop: 6, fontSize: 13, minHeight: 30, padding: '2px 8px' }}
              onClick={() => {
                setOpen(false)
                openEntry(entry.id)
              }}
            >
              이론 배경에서 자세히 보기 →
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}

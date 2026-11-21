import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import './curriculum.css'

type Section = { id: string; group: string; title: string; start: number; end: number }
type Page = { page: number; text: string }
type Data = { source: string; sections: Section[]; pages: Page[] }
const PDF = '/curriculum/science-2022.pdf'
const compact = (s: string) => s.replace(/\s/g, '').toLocaleLowerCase()
const pageLabel = (p: number) => p > 6 ? `본문 ${p - 6}쪽 · PDF ${p}쪽` : `PDF ${p}쪽`

export function Curriculum() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [sectionId, setSectionId] = useState('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(9)
  const [limit, setLimit] = useState(12)
  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    fetch('/curriculum/science-2022.json', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('load'); return r.json() as Promise<Data> })
      .then(setData).catch(e => { if (e.name !== 'AbortError') setError(true) })
    return () => controller.abort()
  }, [retry])
  const selected = data?.sections.find(s => s.id === sectionId)
  const results = useMemo(() => {
    if (!data) return []
    const q = compact(query)
    return data.pages.filter(p => (!selected || (p.page >= selected.start && p.page <= selected.end)) && (!q || compact(p.text).includes(q)) && p.text.trim())
  }, [data, selected, query])
  const current = data?.pages.find(p => p.page === page)
  const currentSection = data?.sections.find(s => page >= s.start && page <= s.end)
  function choose(id: string) {
    setSectionId(id); setLimit(12)
    const section = data?.sections.find(s => s.id === id)
    if (section) setPage(section.start)
  }
  return <AppShell title="2022 개정 과학과 교육과정">
    <p className="eyebrow">교육과정 원문 자료실</p>
    <h1 className="text-display-lg">2022 개정 과학과 교육과정</h1>
    <p className="text-subhead">과목을 고르거나 성취기준 코드·단어를 검색해 원문을 확인하세요.</p>
    <p>{data?.source ?? '교육부 고시 제2022-33호 [별책 9] 과학과 교육과정'} · 제공된 PDF 전체 292쪽</p>
    <p className="text-body-sm">성격 및 목표, 내용 체계와 성취기준, 교수·학습 및 평가 내용을 원문 그대로 제공합니다.</p>
    <div className="curriculum-actions">
      <a href={PDF} target="_blank" rel="noreferrer">전체 원문 새 창에서 열기 ↗</a>
      <a href={PDF} download="2022 개정 과학과 교육과정.pdf">PDF 내려받기</a>
    </div>
    {error ? <p role="alert">교육과정 검색 자료를 불러오지 못했습니다. <button onClick={() => setRetry(n => n + 1)}>다시 불러오기</button> 또는 위의 PDF 원문을 열어 주세요.</p> : !data ? <p role="status">교육과정 자료를 불러오는 중입니다.</p> : <>
      <section className="curriculum-search" aria-label="교육과정 찾기">
        <label>과목 범위
          <select value={sectionId} onChange={e => choose(e.target.value)}>
            <option value="all">전체 과목</option>
            {[...new Set(data.sections.map(s => s.group))].map(group => <optgroup key={group} label={group}>
              {data.sections.filter(s => s.group === group).map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </optgroup>)}
          </select>
        </label>
        <label>성취기준 코드 또는 검색어
          <input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(12) }} placeholder="예: 9과, 광합성, 가치·태도" />
        </label>
        <p className="text-body-sm">띄어쓰기가 달라도 검색됩니다. 초등학교·중학교는 ‘과학’을 선택하세요. 표의 행과 열은 아래 PDF에서 확인할 수 있습니다.</p>
      </section>
      <div className="curriculum-browser">
        <section aria-label="원문 페이지 목록">
          <h2 className="text-card-title">{query.trim() ? '검색 결과' : '페이지 목록'}</h2>
          <p role="status">{selected?.title ?? '전체 과목'} · {results.length}쪽</p>
          {!results.length && <p>검색 결과가 없습니다. 검색어를 줄이거나 전체 과목에서 다시 찾아보세요.</p>}
          <ul className="curriculum-results">
            {results.slice(0, limit).map(p => {
              const owner = data.sections.find(s => p.page >= s.start && p.page <= s.end)
              const lines = p.text.split('\n').filter(Boolean)
              const hit = query.trim() ? lines.findIndex(line => compact(line).includes(compact(query))) : 0
              const snippet = lines.slice(Math.max(0, hit - 1), Math.max(0, hit - 1) + 5).join(' ')
              return <li key={p.page}><button className="curriculum-result" aria-pressed={page === p.page} onClick={() => setPage(p.page)}>
                <strong>{owner?.title ?? '표지·차례'}</strong><span>{pageLabel(p.page)}</span>
                <span className="curriculum-snippet">{snippet.slice(0, 190)}</span>
              </button></li>
            })}
          </ul>
          {results.length > limit && <button onClick={() => setLimit(n => n + 12)}>다음 12개 더 보기</button>}
        </section>
        <section className="curriculum-reader" aria-label="선택한 교육과정 원문">
          <h2 className="text-card-title">{currentSection?.title ?? '표지·차례'}</h2>
          <div className="curriculum-actions">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>이전 쪽</button>
            <span aria-live="polite">{pageLabel(page)}</span>
            <button disabled={page >= data.pages.length} onClick={() => setPage(p => p + 1)}>다음 쪽</button>
            <a href={`${PDF}#page=${page}`} target="_blank" rel="noreferrer">이 쪽 새 창에서 열기 ↗</a>
          </div>
          <a href={`${PDF}#page=${page}`} target="_blank" rel="noreferrer" aria-label={`PDF ${page}쪽 원문을 새 창에서 확대하기`}>
            <img className="curriculum-page-image" key={page} src={`/curriculum/pages/${page}.webp`} alt={`2022 개정 과학과 교육과정 ${pageLabel(page)}. 아래에서 같은 쪽의 글을 읽을 수 있습니다.`} />
          </a>
          <details open>
            <summary>이 쪽의 글 읽기</summary>
            <p className="text-caption">PDF에서 추출한 글입니다. 표의 배치와 기호는 위의 원문을 함께 확인하세요.</p>
            <div className="curriculum-page-text">{current?.text.trim() || '이 쪽에는 추출할 글이 없습니다. PDF에서 확인하세요.'}</div>
          </details>
        </section>
      </div>
    </>}
  </AppShell>
}

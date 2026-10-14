import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fileSizeText, gradeLongLabel, textbookTree, unitOf, type TextbookDoc } from '@shared/textbook'
import { useAuth } from '@/lib/auth'
import { textbookReadUrl } from '@/lib/textbook'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, Card, Notice } from '@/components/ui'

/**
 * 교과서 보기 — 학생 · 강사 (강의자 지시 2026-10-14).
 *
 * 학년 → 단원 → 소단원 나무로 들어가 소단원을 고르면 그 PDF 가 이 화면에 열린다.
 *   · 공개된 소단원만 보인다 — 목차 구독이 `published == true` 로만 읽고, 규칙이 그 밖을 막는다.
 *   · PDF 는 서버가 준 30분짜리 서명 주소로 연다(/api/textbook/read-url). 주소는 소단원 id 가 정하므로
 *     강사가 PDF 를 바꿔도 이 화면의 주소(?id=…)는 그대로다.
 *   · 강사가 이 화면을 열면 학생과 같은 것(공개된 것)만 보인다. 비공개 미리보기는 관리 화면에 있다.
 */
export function Textbook() {
  const { repo } = useAuth()
  const [params, setParams] = useSearchParams()
  const [list, setList] = useState<TextbookDoc[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const openId = params.get('id')
  const [view, setView] = useState<{ id: string; url: string } | null>(null)
  const [viewError, setViewError] = useState<string | null>(null)

  useEffect(() => {
    if (!repo) return
    return repo.watchTextbooks(
      { publishedOnly: true },
      (l) => {
        setList(l)
        setLoaded(true)
      },
      (m) => {
        setError(m)
        setLoaded(true)
      },
    )
  }, [repo])

  useEffect(() => {
    if (!openId) {
      setView(null)
      return
    }
    let gone = false
    setViewError(null)
    void textbookReadUrl(openId).then((r) => {
      if (gone) return
      if (!r.ok || !r.url) {
        setView(null)
        setViewError(r.message ?? '교재를 열지 못했습니다.')
        return
      }
      setView({ id: openId, url: r.url })
    })
    return () => {
      gone = true
    }
  }, [openId])

  const tree = textbookTree(list)
  const current = list.find((d) => d.id === openId) ?? null
  const open = (id: string | null) => setParams(id ? { id } : {}, { replace: false })

  return (
    <AppShell title="교과서">
      <p className="eyebrow">교과서 보기</p>
      <h1 className="text-display-lg" style={{ margin: '8px 0 0' }}>
        중학교 과학 교과서
      </h1>
      <p className="text-body" style={{ marginTop: 12, maxWidth: 720 }}>
        학년과 단원을 펼쳐 소단원을 누르면 그 부분의 교과서가 열립니다. 1·2학년은 2022 개정, 3학년은 2015 개정 교육과정 교과서입니다.
      </p>

      {error ? (
        <div style={{ marginTop: 16 }}>
          <Notice tone="cream">
            <p className="text-body-sm" style={{ margin: 0 }}>
              {error}
            </p>
          </Notice>
        </div>
      ) : null}

      {openId ? (
        <section aria-labelledby="tb-view-title" style={{ marginTop: 24 }}>
          <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
            <Button variant="tertiary" onClick={() => open(null)}>
              ← 목차로
            </Button>
            {current ? (
              <Caption>
                {gradeLongLabel(current.grade)} › {unitOf(current.unitId)?.title}
              </Caption>
            ) : null}
          </div>
          <h2 id="tb-view-title" className="text-headline" style={{ margin: '8px 0 0' }}>
            {current?.title ?? '교과서'}
          </h2>
          {current?.description ? (
            <p className="text-body" style={{ margin: '8px 0 0' }}>
              {current.description}
            </p>
          ) : null}
          {viewError ? (
            <p role="alert" className="text-body" style={{ marginTop: 16, fontWeight: 480 }}>
              ⚠ {viewError}
            </p>
          ) : !view ? (
            <p role="status" className="text-body-sm" style={{ marginTop: 16 }}>
              교과서를 여는 중입니다.
            </p>
          ) : (
            <div style={{ marginTop: 16 }}>
              <iframe title={current?.title ?? '교과서'} src={view.url} style={{ width: '100%', height: 'min(85vh, 1100px)', border: '1px solid #e5e5e5', borderRadius: 12 }} />
              <Caption>
                화면이 비어 보이면{' '}
                <a href={view.url} target="_blank" rel="noopener noreferrer" className="text-link">
                  새 창으로 열기
                </a>
                {/* wording-ok: 읽기 주소의 유효 시간 — 앱의 단계 시간이 아니다 */}
                를 누르세요. 열린 주소는 30분 동안 쓸 수 있습니다.
              </Caption>
            </div>
          )}
        </section>
      ) : !loaded ? (
        <p role="status" className="text-body-sm" style={{ marginTop: 24 }}>
          목차를 불러오는 중입니다.
        </p>
      ) : list.length === 0 && !error ? (
        <div style={{ marginTop: 24 }}>
          <Card>
            <p className="text-body" style={{ margin: 0 }}>
              아직 올라온 교과서가 없습니다.
            </p>
          </Card>
        </div>
      ) : (
        <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
          {tree.map(({ grade, units }) => {
            const count = units.reduce((n, u) => n + u.items.length, 0)
            return (
              <details key={grade} className="card" open={count > 0 && tree.filter((t) => t.units.some((u) => u.items.length)).length === 1}>
                <summary className="text-card-title" style={{ cursor: 'pointer' }}>
                  {gradeLongLabel(grade)} <Badge>{count}</Badge>
                </summary>
                {count === 0 ? (
                  <p className="text-body-sm" style={{ margin: '12px 0 0', opacity: 0.7 }}>
                    아직 올라온 소단원이 없습니다.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    {units
                      .filter((u) => u.items.length > 0)
                      .map(({ unit, items }) => (
                        <details key={unit.id} style={{ borderLeft: '3px solid #e5e5e5', paddingLeft: 12 }}>
                          <summary className="text-body" style={{ cursor: 'pointer', fontWeight: 480 }}>
                            {unit.title} <Caption>· {items.length}</Caption>
                          </summary>
                          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 6 }}>
                            {items.map((d) => (
                              <li key={d.id}>
                                <button type="button" className="text-link" onClick={() => open(d.id)}>
                                  {d.title}
                                </button>
                                <Caption>
                                  {d.description ? `${d.description} · ` : ''}PDF {fileSizeText(d.fileSize)}
                                </Caption>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ))}
                  </div>
                )}
              </details>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}

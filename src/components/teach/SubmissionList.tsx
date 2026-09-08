import { useMemo, useState } from 'react'
import type { FieldDef } from '@/content/types'
import type { AppUser, ResponseDoc } from '@/lib/types'
import { Badge, Caption, Card } from '@/components/ui'

/**
 * 지금 들어온 답 — 강사 화면.
 *
 * ── 왜 필요했나 ──
 * 콘솔에서 학생이 쓴 글을 읽을 방법이 사실상 없었다.
 * 「우리 반의 답」은 선택형 칸이 있는 단계에서만 나오고, 그것도 개수와 익명 이유 세 개뿐이다.
 * 1강으로 치면 다섯 단계 중 3단계에만 나왔다 — 나머지 네 단계에서는
 * 누가 제출했는지만 알 수 있고 무엇을 썼는지는 알 길이 없었다.
 * 수업 중에 「지금 뭐라고 쓰고 있나」를 보는 것이 이 콘솔의 첫 번째 쓸모다.
 *
 * 순위를 만들지 않는다. 최근에 낸 사람이 위에 올 뿐이다.
 */

/** 칸 하나의 값을 사람이 읽는 글로 바꾼다. */
function show(field: FieldDef, raw: unknown): string {
  if (raw == null) return ''
  if (field.kind === 'multi') {
    return Array.isArray(raw) ? raw.filter(Boolean).join(', ') : ''
  }
  if (field.kind === 'allocation') {
    const alloc = (raw ?? {}) as Record<string, number>
    /* 여덟 칸을 다 늘어놓으면 읽히지 않는다. 많이 준 셋만 보인다. */
    return (field.items ?? [])
      .map((it) => ({ label: it.label, n: Number(alloc[it.id]) || 0 }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 3)
      .map((x) => `${x.label} ${x.n}`)
      .join(' · ')
  }
  if (field.kind === 'quadrant') {
    const q = (raw ?? {}) as Record<string, string>
    return (field.quadrants ?? [])
      .map((x) => `${x.label}: ${(q[x.id] ?? '').trim() || '—'}`)
      .join('  |  ')
  }
  if (Array.isArray(raw)) return raw.filter(Boolean).join(', ')
  return String(raw)
}

function when(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  return `${Math.floor(diff / 3600)}시간 전`
}

export function SubmissionList({
  fields,
  docs,
  users,
}: {
  fields: FieldDef[]
  docs: ResponseDoc[]
  users: AppUser[]
}) {
  const [open, setOpen] = useState(true)

  const nameOf = useMemo(() => {
    const map = new Map(users.map((u) => [u.uid, u.nickname || '이름 없음']))
    return (uid: string) => map.get(uid) ?? '이름 없음'
  }, [users])

  const rows = useMemo(() => {
    return docs
      .filter((d) => (d.versions?.length ?? 0) > 0)
      .map((d) => {
        const latest = d.versions[d.versions.length - 1]
        return {
          uid: d.uid,
          v: d.versions.length,
          at: latest.createdAt ?? d.submittedAt ?? 0,
          payload: latest.payload ?? {},
          changedReason: latest.changedReason ?? null,
        }
      })
      /* 순위가 아니다. 최근에 낸 것이 위에 온다. */
      .sort((a, b) => b.at - a.at)
  }, [docs])

  if (fields.length === 0) return null

  return (
    <div style={{ marginTop: 32 }}>
      <Card>
        <div className="flex items-center gap-md" style={{ flexWrap: 'wrap' }}>
          <h2 className="text-card-title" style={{ margin: 0 }}>
            지금 들어온 답
          </h2>
          <Badge>{rows.length}명</Badge>
          <button
            type="button"
            className="btn-tertiary"
            style={{ fontSize: 13, minHeight: 32, marginLeft: 'auto' }}
            aria-expanded={open}
            onClick={() => setOpen((x) => !x)}
          >
            {open ? '접기' : '펼치기'}
          </button>
        </div>
        <Caption>순위가 아닙니다. 최근에 낸 답이 위에 옵니다.</Caption>

        {rows.length === 0 ? (
          <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.66 }}>
            아직 제출한 사람이 없습니다.
          </p>
        ) : open ? (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '12px 0 0',
              /* 스무 명이 넘으면 이 상자 안에서만 스크롤한다 */
              maxHeight: 520,
              overflowY: 'auto',
            }}
          >
            {rows.map((r) => (
              <li
                key={r.uid}
                className="rounded-md"
                style={{ padding: '12px 14px', marginBottom: 8, boxShadow: 'inset 0 0 0 1px #e6e6e6' }}
              >
                <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
                  <span className="text-body-sm" style={{ fontWeight: 480 }}>
                    {nameOf(r.uid)}
                  </span>
                  <Caption>{when(r.at)}</Caption>
                  {r.v > 1 ? <Badge>v{r.v}</Badge> : null}
                </div>

                <dl style={{ margin: '6px 0 0' }}>
                  {fields.map((f) => {
                    const text = show(f, r.payload[f.key])
                    if (!text.trim()) return null
                    return (
                      <div key={f.key} style={{ marginTop: 6 }}>
                        <dt className="caption">{f.label}</dt>
                        <dd
                          className="text-body-sm"
                          style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap' }}
                        >
                          {text}
                        </dd>
                      </div>
                    )
                  })}
                </dl>

                {r.changedReason ? (
                  <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.78 }}>
                    <span className="caption">바꾼 이유</span> {r.changedReason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  )
}

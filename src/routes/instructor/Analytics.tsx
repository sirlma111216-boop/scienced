import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LESSONS } from '@/content/lessons'
import { REACTIONS } from '@/content/reactions'
import { useAuth } from '@/lib/auth'
import type { AppUser, Participation, Post, ResponseDoc } from '@/lib/types'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Caption, Card, ColorBlock, Notice, ScrollX } from '@/components/ui'

/**
 * 익명 학습 분석.
 *
 * 컨텍스트 19.11 이 정한 것을 그대로 따른다.
 *  · 체류 시간과 클릭 수를 학습으로 간주하지 않는다. 여기에 아예 없다.
 *  · 학생을 비교해 순위를 만들지 않는다. 이름이 나오지 않는다.
 *  · 지표는 교수자가 다음 수업을 정하고 학생이 자기 변화를 보는 데 쓴다.
 *
 * 대리 지표의 한계를 화면에 함께 적는다.
 * 이유 문장의 길이는 증거의 질이 아니다. 짧고 정확한 이유가 길고 헐거운 이유보다 낫다.
 * 그래서 길이는 "읽어 볼 응답을 고르는 실마리"로만 쓰고, 판단은 사람이 한다.
 */

interface Row {
  lessonId: string
  stepId: string
  stepTitle: string
  docs: ResponseDoc[]
  posts: Post[]
}

function reasonOf(payload: Record<string, unknown> | undefined): string {
  if (!payload) return ''
  for (const [k, v] of Object.entries(payload)) {
    if (/reason|이유|defense|changed/i.test(k) && typeof v === 'string') return v
  }
  return ''
}

export function InstructorAnalytics() {
  const { repo, isInstructor, classId } = useAuth()
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [users, setUsers] = useState<AppUser[]>([])
  const [participation, setParticipation] = useState<Participation[]>([])

  useEffect(() => {
    if (!repo || !classId) return
    const a = repo.watchUsers(setUsers)
    const b = repo.watchParticipation(classId, setParticipation)
    return () => {
      a()
      b()
    }
  }, [repo, classId])

  useEffect(() => {
    if (!repo || !classId) return
    const unsubs: Array<() => void> = []
    for (const l of LESSONS) {
      for (const s of l.steps) {
        const key = `${l.id}/${s.id}`
        unsubs.push(
          repo.watchAllResponses(classId, l.id, s.id, (docs: ResponseDoc[]) =>
            setRows((prev) => ({
              ...prev,
              [key]: {
                lessonId: l.id,
                stepId: s.id,
                stepTitle: `${l.id}강 ${s.title}`,
                docs,
                posts: prev[key]?.posts ?? [],
              },
            })),
          ),
        )
        if (s.wall?.enabled) {
          unsubs.push(
            repo.watchPosts(classId, l.id, s.id, (posts: Post[]) =>
              setRows((prev) => ({
                ...prev,
                [key]: {
                  lessonId: l.id,
                  stepId: s.id,
                  stepTitle: `${l.id}강 ${s.title}`,
                  docs: prev[key]?.docs ?? [],
                  posts,
                },
              })),
            ),
          )
        }
      }
    }
    return () => unsubs.forEach((u) => u())
  }, [repo, classId])

  const all = useMemo(() => Object.values(rows).filter((r) => r.docs.length > 0), [rows])

  const stats = useMemo(() => {
    let submitted = 0
    let revised = 0
    let revisedWithReason = 0
    let confidenceUp = 0
    let confidenceDown = 0
    let confidenceUpNoReasonChange = 0
    let highConfThinReason = 0
    let lowConfThickReason = 0

    for (const r of all) {
      for (const d of r.docs) {
        const vs = d.versions ?? []
        if (vs.length === 0) continue
        submitted++
        const first = vs[0]
        const last = vs[vs.length - 1]

        if (vs.length > 1) {
          revised++
          const hasReason = vs.slice(1).some((v) => (v.changedReason ?? '').trim().length >= 5)
          if (hasReason) revisedWithReason++

          if (first.confidence != null && last.confidence != null) {
            if (last.confidence > first.confidence) {
              confidenceUp++
              // 확신은 올랐는데 이유가 거의 그대로면 되물을 자리다.
              if (reasonOf(first.payload).trim() === reasonOf(last.payload).trim()) {
                confidenceUpNoReasonChange++
              }
            } else if (last.confidence < first.confidence) {
              confidenceDown++
            }
          }
        }

        const reason = reasonOf(last.payload).trim()
        if (last.confidence != null) {
          if (last.confidence >= 4 && reason.length < 20) highConfThinReason++
          if (last.confidence <= 2 && reason.length >= 60) lowConfThickReason++
        }
      }
    }

    const posts = all.flatMap((r) => r.posts)
    const split = posts.filter(
      (p) => (p.reactions?.agreed ?? []).length > 0 && (p.reactions?.disagree ?? []).length > 0,
    ).length
    const unanswered = posts.filter(
      (p) => Object.values(p.reactions ?? {}).every((u) => u.length === 0),
    ).length
    const revisedPosts = posts.filter((p) => p.latestV > 1).length

    return {
      submitted,
      revised,
      revisedWithReason,
      confidenceUp,
      confidenceDown,
      confidenceUpNoReasonChange,
      highConfThinReason,
      lowConfThickReason,
      posts: posts.length,
      split,
      unanswered,
      revisedPosts,
    }
  }, [all])

  /** 기여 유형 분포 — 발언 횟수가 아니라 유형을 센다 (14강) */
  const contributions = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of participation) {
      for (const [k, n] of Object.entries(p.contributionTypes ?? {})) {
        map[k] = (map[k] ?? 0) + n
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [participation])

  if (!isInstructor) return <Navigate to="/" replace />

  const students = users.filter((u) => u.role === 'student').length
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—')

  return (
    <AppShell title="학습 분석">
      <p className="eyebrow">강사</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        익명 학습 분석
      </h1>

      <div style={{ marginTop: 24 }}>
        <Notice tone="lime">
          <p className="text-body-sm" style={{ margin: 0 }}>
            <strong>여기에 없는 것</strong> — 체류 시간, 클릭 수, 학생 순위, 정답률 랭킹, 개인 점수
            비교. 이 화면의 숫자는 다음 수업을 정하는 데 쓰고, 학생 개인을 평가하는 데 쓰지
            않습니다. 이름은 나오지 않습니다.
          </p>
        </Notice>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginTop: 32,
        }}
      >
        {[
          { k: '수강생', v: String(students), n: '계정 수' },
          { k: '제출된 응답', v: String(stats.submitted), n: '단계 × 사람' },
          {
            k: '고쳐 쓴 응답',
            v: pct(stats.revised, stats.submitted),
            n: `${stats.revised}건`,
          },
          {
            k: '근거를 적고 고친 응답',
            v: pct(stats.revisedWithReason, stats.revised),
            n: `고친 것 중 ${stats.revisedWithReason}건`,
          },
        ].map((s) => (
          <div key={s.k} className="tile">
            <Caption>{s.k}</Caption>
            <p className="text-display-lg font-mono" style={{ margin: '8px 0 0', fontSize: 40 }}>
              {s.v}
            </p>
            <Caption style={{ marginTop: 4 }}>{s.n}</Caption>
          </div>
        ))}
      </div>

      {/* 확신도 — 근거 있는 변화인가 */}
      <div style={{ marginTop: 48 }}>
        <Card>
          <h2 className="text-card-title" style={{ margin: '0 0 4px' }}>
            확신도의 변화
          </h2>
          <Caption>확신도가 움직였다는 사실보다, 그 변화에 근거가 있었는지가 중요합니다.</Caption>
          <ScrollX>
            <table style={{ borderCollapse: 'collapse', marginTop: 16, minWidth: 520 }}>
              <tbody>
                {[
                  { k: '확신이 올라간 응답', v: stats.confidenceUp, note: '' },
                  {
                    k: '확신이 내려간 응답',
                    v: stats.confidenceDown,
                    note: '반론을 받아들인 결과일 수 있습니다. 실패가 아닙니다.',
                  },
                  {
                    k: '확신은 올랐는데 이유는 그대로',
                    v: stats.confidenceUpNoReasonChange,
                    note: '되물을 자리입니다. 무엇이 확신을 높였는지 물어보세요.',
                  },
                  {
                    k: '높은 확신 + 얇은 이유',
                    v: stats.highConfThinReason,
                    note: '컨텍스트 19.9가 말한 “높은 확신의 오개념” 후보입니다.',
                  },
                  {
                    k: '낮은 확신 + 두꺼운 이유',
                    v: stats.lowConfThickReason,
                    note: '설명은 잘 하는데 스스로 못 믿는 경우입니다. 확인해 주면 좋습니다.',
                  },
                ].map((r) => (
                  <tr key={r.k} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                    <th
                      scope="row"
                      className="text-body-sm"
                      style={{ textAlign: 'left', padding: '12px 24px 12px 0', fontWeight: 400 }}
                    >
                      {r.k}
                      {r.note ? (
                        <span style={{ display: 'block', opacity: 0.66, marginTop: 4 }}>
                          {r.note}
                        </span>
                      ) : null}
                    </th>
                    <td
                      className="font-mono text-body-lg"
                      style={{ padding: '12px 0', verticalAlign: 'top', fontWeight: 480 }}
                    >
                      {r.v}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        </Card>
      </div>

      {/* 의견 광장 */}
      <div style={{ marginTop: 32 }}>
        <Card>
          <h2 className="text-card-title" style={{ margin: '0 0 4px' }}>
            의견 광장
          </h2>
          <Caption>인기 순위를 만들지 않습니다. 갈린 글과 아직 아무도 읽지 않은 글을 봅니다.</Caption>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginTop: 16,
            }}
          >
            {[
              { k: '올라온 글', v: stats.posts },
              { k: '반응이 갈린 글', v: stats.split, n: '다음 추첨의 후보 풀' },
              { k: '아직 반응 없는 글', v: stats.unanswered, n: '기본 정렬에서 맨 앞에 옵니다' },
              { k: '고쳐 쓴 글', v: stats.revisedPosts, n: '이전 버전도 남아 있습니다' },
            ].map((s) => (
              <div key={s.k}>
                <Caption>{s.k}</Caption>
                <p className="text-headline font-mono" style={{ margin: '4px 0 0' }}>
                  {s.v}
                </p>
                {s.n ? <Caption style={{ marginTop: 2 }}>{s.n}</Caption> : null}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-xs" style={{ marginTop: 16 }}>
            {REACTIONS.map((r) => {
              const n = Object.values(rows)
                .flatMap((x) => x.posts)
                .reduce((s, p) => s + (p.reactions?.[r.key] ?? []).length, 0)
              return (
                <Badge key={r.key}>
                  <span className="font-mono" aria-hidden style={{ marginRight: 4 }}>
                    {r.mark}
                  </span>
                  {r.label} {n}
                </Badge>
              )
            })}
          </div>
        </Card>
      </div>

      {/* 기여 유형 */}
      <div style={{ marginTop: 32 }}>
        <Card>
          <h2 className="text-card-title" style={{ margin: '0 0 4px' }}>
            기여 유형
          </h2>
          <Caption>발언 횟수를 세지 않습니다. 어떤 종류의 기여가 오갔는지를 봅니다.</Caption>
          {contributions.length === 0 ? (
            <p className="text-body-sm" style={{ marginTop: 12, opacity: 0.6 }}>
              아직 기록이 없습니다. 14강 활동 이후에 쌓입니다.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
              {contributions.map(([k, n]) => {
                const max = contributions[0][1] || 1
                return (
                  <li key={k} className="flex items-center gap-sm" style={{ marginBottom: 8 }}>
                    <span className="text-body-sm" style={{ minWidth: 120 }}>
                      {k}
                    </span>
                    <span
                      aria-hidden
                      style={{
                        display: 'inline-block',
                        height: 10,
                        width: `${Math.max(4, (n / max) * 220)}px`,
                        background: '#000',
                        borderRadius: 9999,
                      }}
                    />
                    <span className="font-mono text-body-sm">{n}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* 단계별 — 어디를 다시 다룰 것인가 */}
      <div style={{ marginTop: 32 }}>
        <Card>
          <h2 className="text-card-title" style={{ margin: '0 0 4px' }}>
            다시 다룰 후보 단계
          </h2>
          <Caption>
            고쳐 쓴 사람이 적고 확신은 높은 단계가 위에 옵니다. 순위가 아니라 읽어 볼 순서입니다.
          </Caption>
          <ScrollX>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560, marginTop: 16 }}>
              <thead>
                <tr>
                  {['단계', '제출', '고쳐 씀', '평균 확신도'].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="caption"
                      style={{ textAlign: 'left', padding: '8px 16px 8px 0' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {all
                  .map((r) => {
                    const withV = r.docs.filter((d) => (d.versions?.length ?? 0) > 0)
                    const rev = withV.filter((d) => d.versions.length > 1).length
                    const confs = withV
                      .map((d) => d.versions[d.versions.length - 1].confidence)
                      .filter((c): c is number => c != null)
                    const avg = confs.length
                      ? confs.reduce((a, b) => a + b, 0) / confs.length
                      : null
                    return { r, n: withV.length, rev, avg }
                  })
                  .filter((x) => x.n > 0)
                  .sort((a, b) => {
                    const ra = a.n > 0 ? a.rev / a.n : 1
                    const rb = b.n > 0 ? b.rev / b.n : 1
                    return ra - rb || (b.avg ?? 0) - (a.avg ?? 0)
                  })
                  .slice(0, 12)
                  .map((x) => (
                    <tr key={`${x.r.lessonId}/${x.r.stepId}`} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                      <td className="text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {x.r.stepTitle}
                      </td>
                      <td className="font-mono text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {x.n}
                      </td>
                      <td className="font-mono text-body-sm" style={{ padding: '10px 16px 10px 0' }}>
                        {x.rev}
                      </td>
                      <td className="font-mono text-body-sm" style={{ padding: '10px 0' }}>
                        {x.avg != null ? `${x.avg.toFixed(1)} / 5` : '—'}
                      </td>
                    </tr>
                  ))}
                {all.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-body-sm" style={{ padding: 16, opacity: 0.6 }}>
                      아직 제출된 응답이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </ScrollX>
        </Card>
      </div>

      <div style={{ marginTop: 96 }}>
        <ColorBlock tone="navy">
          <p className="eyebrow">이 숫자들의 한계</p>
          <p className="text-subhead" style={{ marginTop: 12, maxWidth: 720 }}>
            여기 있는 것은 전부 대리 지표입니다. “고쳐 썼다”가 “잘 고쳤다”는 아니고, 이유가 길다고
            증거가 좋은 것도 아닙니다. 짧고 정확한 이유가 길고 헐거운 이유보다 낫습니다. 이 화면은
            어떤 응답을 직접 읽어 볼지 고르는 데 쓰고, 판정은 읽고 나서 사람이 합니다.
          </p>
        </ColorBlock>
      </div>
    </AppShell>
  )
}

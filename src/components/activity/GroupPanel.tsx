import { useEffect, useMemo, useState } from 'react'
import type { GroupBuildConfig, LessonId, Step } from '@/content/types'
import { useAuth } from '@/lib/auth'
import type { GroupShare } from '@/lib/types'
import { Badge, Button, Caption, Notice, ScrollX } from '@/components/ui'

/**
 * 즉석 모둠.
 *
 * 강사가 명단을 짜지 않는다. 옆에 앉은 사람끼리 "우리가 몇 모둠" 하고 정해
 * 같은 번호를 고르면 그것이 모둠이다. 고르는 순간 같은 번호를 고른 사람들의
 * 평균 배분과 각자가 쓴 문장이 한자리에 모이고, 그것을 보고 협의한다.
 *
 * 이 화면은 본인이 제출을 마친 뒤에만 열린다 (규칙에서도 막는다).
 * 남의 배분을 먼저 보고 자기 것을 정하면 갈림이 사라지는데,
 * 그 갈림을 보는 것이 이 활동의 전부다.
 *
 * 모둠 합의 문장은 대표 한 사람이 올린다. 올라간 문장은 의견 광장의 글이 되어
 * 「N모둠」으로 뜨고, 다른 모둠이 댓글을 단다.
 */

/** 번호는 문자열로 다룬다. 저장된 groupId 와 화면 표시가 어긋나지 않게. */
function groupNumbers(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String(i + 1))
}

function average(list: GroupShare[], itemId: string): number {
  if (list.length === 0) return 0
  const sum = list.reduce((s, g) => s + (Number(g.allocation?.[itemId]) || 0), 0)
  return Math.round(sum / list.length)
}

export function GroupPanel({
  classId,
  lessonId,
  step,
  config,
  myValues,
  assigned = null,
  roundLessonId = null,
}: {
  classId: string
  lessonId: LessonId
  step: Step
  config: GroupBuildConfig
  /** 내가 방금 제출한 값. 모둠에 들어갈 때 이것을 함께 올린다. */
  myValues: Record<string, unknown> | null
  /**
   * 6차 모둠 나누기로 이미 정해진 내 모둠. 있으면 번호를 고르지 않는다 —
   * 이 차시 시작에 나눈 모둠이 그대로 경매 모둠이다. 이름도 그 모둠 이름을 쓴다.
   */
  assigned?: { id: string; name: string } | null
  /**
   * 이 차시가 쓰는 모둠 회차가 나눠진 차시 (1·3·5·7·9·11강). 있으면 번호 고르기를 그리지 않는다 —
   * 그 모둠이 다음 차시까지 그대로 이어지기 때문이다. 나에게 자리가 없어도 「모둠을 만드세요」라고 하지 않는다.
   */
  roundLessonId?: string | null
}) {
  const roundExists = roundLessonId !== null
  const { user, repo, isInstructor } = useAuth()
  const [shares, setShares] = useState<GroupShare[]>([])
  const [agreed, setAgreed] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [postedAt, setPostedAt] = useState<number | null>(null)

  const uid = user?.uid ?? null

  useEffect(() => {
    if (!repo) return
    return repo.watchGroupShares(classId, lessonId, step.id, setShares)
  }, [repo, classId, lessonId, step.id])

  /* 배분 칸이 없는 활동(2강)은 평균 표를 그리지 않는다 — 모둠원의 글만 모인다 */
  const hasAllocation = Boolean(config.allocationKey)
  const items = useMemo(
    () => (config.allocationKey ? step.fields.find((f) => f.key === config.allocationKey)?.items ?? [] : []),
    [step.fields, config.allocationKey],
  )

  const mine = shares.find((s) => s.uid === uid) ?? null
  const myGroup = mine?.groupId ?? null
  const members = useMemo(
    () => (myGroup ? shares.filter((s) => s.groupId === myGroup) : []),
    [shares, myGroup],
  )

  /** 번호별 인원. 아직 아무도 없는 번호도 보여 줘야 고를 수 있다. */
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of shares) map[s.groupId] = (map[s.groupId] ?? 0) + 1
    return map
  }, [shares])

  const myAlloc = (config.allocationKey ? (myValues?.[config.allocationKey] ?? {}) : {}) as Record<string, number>
  const myOpinion = String(myValues?.[config.opinionKey] ?? '').trim()
  const myHeadline = config.headlineKey
    ? String(myValues?.[config.headlineKey] ?? '').trim()
    : (config.headlineLines ?? [])
        .map(({ key, label }) => {
          const v = String(myValues?.[key] ?? '').trim()
          return v ? `${label} · ${v}` : ''
        })
        .filter(Boolean)
        .join('\n')
  const myExtra = useMemo(() => {
    const out: Record<string, string> = {}
    for (const k of config.extraKeys ?? []) {
      const v = String(myValues?.[k] ?? '').trim()
      if (v) out[k] = v
    }
    return out
  }, [config.extraKeys, myValues])
  const extraLabel = (k: string) => step.fields.find((f) => f.key === k)?.label ?? k

  /*
   * 내 자리를 최신 답과 맞춘다.
   *   · 정해진 모둠이 있으면 제출한 뒤 저절로 그 자리에 들어간다. 번호를 다시 고르게 하지 않는다.
   *   · 이미 자리에 있으면, 새 버전(v2·v3…)이나 나중에 열린 칸의 글이 바뀔 때마다 자리의 글도 바꾼다.
   *     ★ 예전에는 처음 들어갈 때 한 번만 올려서, 새 증거를 보고 고쳐 낸 답이 모둠 화면에 전혀 반영되지 않았다.
   */
  useEffect(() => {
    if (!repo || !uid || !myOpinion) return
    const targetGroup = mine?.groupId ?? assigned?.id ?? null
    if (!targetGroup) return
    const same =
      mine &&
      mine.groupId === targetGroup &&
      mine.opinion === myOpinion &&
      (mine.headline ?? '') === myHeadline &&
      JSON.stringify(mine.extra ?? {}) === JSON.stringify(myExtra) &&
      JSON.stringify(mine.allocation ?? {}) === JSON.stringify(myAlloc)
    if (same) return
    void repo
      .setGroupShare(classId, lessonId, step.id, {
        uid,
        nickname: user?.nickname || '이름 없음',
        groupId: targetGroup,
        allocation: myAlloc,
        opinion: myOpinion,
        headline: myHeadline,
        extra: myExtra,
        updatedAt: Date.now(),
      })
      .catch((e) => console.error('[모둠] 자리의 글을 맞추지 못했다:', e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assigned?.id, myOpinion, myHeadline, myExtra, myAlloc, mine?.groupId, mine?.opinion, mine?.headline, mine?.extra, repo, uid])

  async function join(groupId: string) {
    if (!repo || !uid) return
    setError(null)
    if (!myOpinion) {
      setError(hasAllocation ? '먼저 위에서 배분과 이유를 제출해 주세요. 모둠에는 그 두 가지를 가지고 들어갑니다.' : '먼저 위의 칸을 제출해 주세요. 모둠에는 그 글을 가지고 들어갑니다.')
      return
    }
    try {
      await repo.setGroupShare(classId, lessonId, step.id, {
        uid,
        nickname: user?.nickname || '이름 없음',
        groupId,
        allocation: myAlloc,
        opinion: myOpinion,
        headline: myHeadline,
        extra: myExtra,
        updatedAt: Date.now(),
      })
    } catch (e) {
      // 삼키지 않는다. 화면에는 다음에 할 일을, 콘솔에는 이유를 남긴다.
      console.error('[모둠] 들어가지 못했다:', e)
      setError('모둠에 들어가지 못했습니다. 잠시 뒤 다시 눌러 보세요.')
    }
  }

  async function leave() {
    if (!repo || !uid) return
    try {
      await repo.clearGroupShare(classId, lessonId, step.id, uid)
    } catch (e) {
      console.error('[모둠] 나가지 못했다:', e)
      setError('모둠에서 나가지 못했습니다. 잠시 뒤 다시 눌러 보세요.')
    }
  }

  async function postAgreed() {
    if (!repo || !uid || !myGroup) return
    if (!agreed.trim()) {
      setError('모둠이 합의한 문장을 한 줄 적어 주세요.')
      return
    }
    setError(null)
    setPosting(true)
    try {
      await repo.upsertPost(classId, lessonId, step.id, {
        uid,
        nickname: user?.nickname || '이름 없음',
        groupId: myGroup,
        content: agreed.trim(),
      })
      setAgreed('')
      setPostedAt(Date.now())
    } catch (e) {
      console.error('[모둠] 합의 문장을 올리지 못했다:', e)
      setError('올리지 못했습니다. 잠시 뒤 다시 눌러 보세요.')
    } finally {
      setPosting(false)
    }
  }

  return (
    <section aria-labelledby="group-build-heading" className="card">
      {/*
        이 차시 시작에 모둠을 나눴으면(6차) 「모둠을 만드세요」라고 하지 않는다.
        이미 있는 모둠에 저절로 들어가므로, 그 모둠이 무엇이고 무엇이 보이는지만 적는다.
      */}
      {assigned ? (
        <>
          <Caption>우리 모둠</Caption>
          <h3 id="group-build-heading" className="text-card-title" style={{ margin: '8px 0 0' }}>
            <Badge solid>{assigned.id}모둠</Badge> {assigned.name}
          </h3>
          <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.78 }}>
            {roundLessonId && roundLessonId !== lessonId ? `${Number(roundLessonId)}강에서 나눈 모둠을 그대로 씁니다.` : '이 차시 시작에 나눈 모둠입니다.'} 제출하면 저절로 이 모둠에 들어가고,
            {hasAllocation ? ' 모둠의 평균과 각자가 쓴 문장이 아래에 모입니다.' : ' 각자가 쓴 글이 아래에 모입니다.'}
          </p>
        </>
      ) : roundExists ? (
        <>
          {/* 모둠은 나눠졌는데 이 계정은 그 안에 없다 — 강사 미리보기이거나, 결석해서 자리가 없는 학생이다 */}
          <Caption>우리 모둠</Caption>
          <h3 id="group-build-heading" className="text-card-title" style={{ margin: '8px 0 0' }}>
            {Number(roundLessonId)}강에서 나눈 모둠을 그대로 씁니다
          </h3>
          <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.78 }}>
            {isInstructor
              ? '학생은 제출하면 저절로 자기 모둠에 들어갑니다. 강사 계정에는 모둠이 없어 여기까지만 보입니다.'
              : '이 계정은 그 모둠에 자리가 없습니다. 강사에게 말하면 넣어 줍니다 — 넣어 주면 제출한 글이 그 모둠에 모입니다.'}
          </p>
        </>
      ) : (
        <>
          <Caption>모둠 만들기</Caption>
          <h3 id="group-build-heading" className="text-card-title" style={{ margin: '8px 0 0' }}>
            옆에 앉은 사람과 모둠을 만드세요
          </h3>
          <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.78 }}>
            서너 명끼리 「우리는 몇 모둠」이라고 정한 다음, <strong>같은 번호</strong>를 고릅니다.
            고르는 순간 우리 모둠의 평균과 각자가 쓴 문장이 아래에 모입니다.
          </p>
        </>
      )}

      {/* 번호 고르기 — 정해진 모둠이 있으면(이 차시든 앞 차시든) 고르지 않는다 */}
      {assigned || roundExists ? null : (
      <div style={{ marginTop: 16 }}>
        <p className="text-body-sm" style={{ fontWeight: 480, marginBottom: 8 }}>
          우리 모둠 번호
        </p>
        <ul
          className="flex flex-wrap gap-xs"
          style={{ listStyle: 'none', padding: 0, margin: 0 }}
        >
          {groupNumbers(config.groupCount).map((n) => {
            const on = myGroup === n
            return (
              <li key={n}>
                <button
                  type="button"
                  className="tab"
                  data-selected={on}
                  aria-pressed={on}
                  onClick={() => void join(n)}
                  style={{ minHeight: 44, minWidth: 64, padding: '4px 14px' }}
                >
                  {n}모둠
                  {/* 인원을 숫자로 적는다. 색만으로 「누가 있는 번호」를 구분하지 않는다. */}
                  <span className="font-mono text-caption" style={{ marginLeft: 6 }}>
                    {counts[n] ?? 0}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {myGroup ? (
          <div style={{ marginTop: 12 }}>
            <Button variant="secondary" onClick={() => void leave()}>
              모둠에서 나가기
            </Button>
          </div>
        ) : null}
      </div>
      )}

      {error ? (
        <p role="alert" className="text-body-sm" style={{ fontWeight: 480, marginTop: 12 }}>
          ⚠ {error}
        </p>
      ) : null}

      {!myGroup ? (
        roundExists && !assigned ? null : (
        <p className="text-body-sm" style={{ marginTop: 16, opacity: 0.66 }}>
          {assigned
            ? hasAllocation ? '제출하면 모둠원의 배분이 보입니다.' : '제출하면 모둠원의 글이 보입니다.'
            : hasAllocation ? '번호를 고르기 전에는 모둠원의 배분이 보이지 않습니다.' : '번호를 고르기 전에는 모둠원의 글이 보이지 않습니다.'}
        </p>
        )
      ) : (
        <>
          {/* 우리 모둠 평균 */}
          <div style={{ marginTop: 32 }}>
            <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
              <Badge solid>{myGroup}모둠</Badge>
              <span className="text-body-sm" style={{ fontWeight: 480 }}>
                {assigned ? `제출한 모둠원 ${members.length}명` : `지금 ${members.length}명`}
              </span>
            </div>
            <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.72 }}>
              {hasAllocation
                ? assigned ? '모둠원이 제출할 때마다 평균이 바로 다시 계산됩니다.' : '같은 번호를 고른 사람이 늘면 평균이 바로 다시 계산됩니다.'
                : '모둠원이 제출할 때마다 아래에 글이 더해집니다.'}
            </p>

            {hasAllocation ? (
            <ScrollX>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <caption className="caption" style={{ textAlign: 'left', padding: '12px 0 8px' }}>
                  모둠 평균과 내 배분을 나란히 놓았습니다. 차이가 큰 줄이 오늘 이야기할 자리입니다.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 0' }}>
                      요소
                    </th>
                    <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 0' }}>
                      모둠 평균
                    </th>
                    <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 0' }}>
                      내 점수
                    </th>
                    <th scope="col" className="caption" style={{ textAlign: 'left', padding: '8px 0' }}>
                      차이
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const avg = average(members, it.id)
                    const my = Number(myAlloc[it.id]) || 0
                    const diff = my - avg
                    return (
                      <tr key={it.id} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                        <th
                          scope="row"
                          style={{ textAlign: 'left', padding: '10px 12px 10px 0', fontWeight: 400 }}
                        >
                          <span className="text-body">{it.label}</span>
                        </th>
                        <td style={{ padding: '10px 12px 10px 0', minWidth: 160 }}>
                          <span className="flex items-center gap-xs">
                            <span
                              aria-hidden
                              style={{
                                display: 'inline-block',
                                height: 10,
                                width: `${Math.max(2, avg * 2)}px`,
                                background: '#000',
                                borderRadius: 999,
                              }}
                            />
                            <span className="font-mono text-body-sm">{avg}</span>
                          </span>
                        </td>
                        <td className="font-mono text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                          {my}
                        </td>
                        <td className="font-mono text-body-sm" style={{ padding: '10px 0' }}>
                          {/* 부호를 글자로 적는다. 색으로만 크고 작음을 말하지 않는다. */}
                          {diff === 0 ? '같음' : diff > 0 ? `+${diff}` : String(diff)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollX>
            ) : null}
          </div>

          {/* 모둠원의 문장 */}
          <div style={{ marginTop: 32 }}>
            <Caption>{config.membersLabel ?? '모둠원이 쓴 이유'}</Caption>
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
              {members.map((m) => (
                <li
                  key={m.uid}
                  className="rounded-md"
                  style={{
                    padding: '12px 14px',
                    marginBottom: 8,
                    boxShadow: `inset 0 0 0 ${m.uid === uid ? 2 : 1}px ${m.uid === uid ? '#000' : '#e6e6e6'}`,
                  }}
                >
                  <span className="text-body-sm" style={{ fontWeight: 480 }}>
                    {m.nickname}
                    {m.uid === uid ? <span className="font-mono text-caption ml-xs">나</span> : null}
                  </span>
                  {m.headline ? (
                    <p className="text-body" style={{ margin: '4px 0 0', fontWeight: 480, whiteSpace: 'pre-line' }}>
                      {m.headline}
                    </p>
                  ) : null}
                  <p className="text-body" style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>
                    {m.opinion}
                  </p>
                  {Object.entries(m.extra ?? {}).map(([k, v]) => (
                    <div key={k} style={{ marginTop: 8 }}>
                      <span className="caption">{extraLabel(k)}</span>
                      <p className="text-body" style={{ margin: '2px 0 0', whiteSpace: 'pre-line' }}>
                        {v}
                      </p>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </div>

          {/* 합의 문장 올리기 */}
          <div style={{ marginTop: 32 }}>
            <label
              htmlFor="group-agreed"
              className="text-body-sm"
              style={{ fontWeight: 480, display: 'block' }}
            >
              {config.agreedLabel}
            </label>
            <p className="text-body-sm" style={{ margin: '4px 0 8px', opacity: 0.72 }}>
              {config.agreedHelp}
            </p>
            <textarea
              id="group-agreed"
              className="field"
              rows={3}
              value={agreed}
              onChange={(e) => {
                setAgreed(e.target.value)
                setError(null)
              }}
            />
            {config.agreedStarters.length > 0 ? (
              <div className="flex flex-wrap items-center gap-xs no-print" style={{ marginTop: 8 }}>
                <span className="caption">문장 틀</span>
                {config.agreedStarters.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="tab"
                    style={{ minHeight: 44 }}
                    onClick={() => setAgreed((v) => (v ? v : t))}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-md" style={{ marginTop: 12 }}>
              <Button disabled={posting} onClick={() => void postAgreed()}>
                {posting ? '올리는 중…' : `${myGroup}모둠 이름으로 올리기`}
              </Button>
              <span className="text-body-sm" style={{ opacity: 0.66 }}>
                모둠에서 한 사람만 올립니다.
              </span>
            </div>

            {postedAt ? (
              <div style={{ marginTop: 12 }}>
                <Notice tone="mint">
                  <p className="text-body-sm" style={{ margin: 0 }}>
                    올렸습니다. 아래 <strong>의견 광장</strong>에 「{myGroup}모둠」으로 떠 있습니다.
                    다른 모둠 문장에 댓글을 달아 주세요.
                  </p>
                </Notice>
              </div>
            ) : null}
          </div>

          {/* 모둠별 비교 — 어디에서 갈리는지가 이 활동의 목적이다. 배분이 있는 활동에서만. */}
          {hasAllocation ? (
          <div style={{ marginTop: 32 }}>
            <Caption>모둠별 1순위</Caption>
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
              {groupNumbers(config.groupCount)
                .filter((n) => (counts[n] ?? 0) > 0)
                .map((n) => {
                  const list = shares.filter((s) => s.groupId === n)
                  const top = items
                    .map((it) => ({ label: it.label, avg: average(list, it.id) }))
                    .sort((a, b) => b.avg - a.avg)[0]
                  return (
                    <li
                      key={n}
                      className="flex items-center gap-xs"
                      style={{ padding: '8px 0', boxShadow: 'inset 0 -1px 0 #f1f1f1', flexWrap: 'wrap' }}
                    >
                      <Badge>{n}모둠</Badge>
                      <span className="text-body-sm">{list.length}명</span>
                      <span className="text-body-sm" style={{ fontWeight: 480 }}>
                        {top ? `${top.label} ${top.avg}점` : '아직 없음'}
                      </span>
                    </li>
                  )
                })}
            </ul>
          </div>
          ) : null}
        </>
      )}
    </section>
  )
}

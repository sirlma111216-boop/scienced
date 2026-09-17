import type { FieldDef, GroupData } from '@/content/types'
import type { GroupShare, GroupValue } from '@/lib/types'
import { allocationAverage, rankSum, sortTally, voteCounts, type MemberValue } from '@/lib/group-math'
import { Badge, Caption } from '@/components/ui'

/**
 * 모둠 하나의 값을 그린다 — 학생의 「우리 모둠」과 강사의 「모둠별 나란히」가 같은 부품을 쓴다 (8차 4.6).
 *
 *   allocation 막대 · rank 순위표 · vote 분포 + 대표 이유 · sentence 문장 · sort 갈린 카드 강조
 */
export function GroupCell({
  group,
  field,
  shares,
  value,
  nameOf,
  big = false,
}: {
  group: GroupData
  field: FieldDef
  shares: GroupShare[]
  value: GroupValue | null
  nameOf: (uid: string) => string
  big?: boolean
}) {
  const members: MemberValue[] = shares.map((s) => ({ uid: s.uid, nickname: nameOf(s.uid), value: s.value, reason: s.reason }))
  const textCls = big ? 'text-body-lg' : 'text-body-sm'

  if (members.length === 0 && !value) {
    return (
      <p className="text-body-sm" style={{ opacity: 0.6, margin: 0 }}>
        아직 낸 사람이 없습니다.
      </p>
    )
  }

  switch (group.format) {
    case 'allocation': {
      const rows = allocationAverage(field, members)
      const max = Math.max(1, ...rows.map((r) => r.avg))
      return (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-xs" style={{ marginBottom: 6 }}>
              <span className={textCls} style={{ flex: '0 0 40%' }}>
                {r.label}
              </span>
              <span aria-hidden style={{ flex: 1, height: 12, background: '#f1f1f1', borderRadius: 999, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${(r.avg / max) * 100}%`, background: '#111' }} />
              </span>
              <span className="font-mono text-body-sm" style={{ width: 40, textAlign: 'right' }}>
                {r.avg}
              </span>
            </li>
          ))}
          <li>
            <Caption>{members.length}명 평균</Caption>
          </li>
        </ul>
      )
    }
    case 'rank': {
      const rows = rankSum(field, members)
      return (
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          {rows.map((r) => (
            <li key={r.id} className={textCls} style={{ marginBottom: 4, fontWeight: r.place === 1 ? 600 : 400 }}>
              {r.label} <span className="font-mono text-caption">합 {r.sum}</span>
            </li>
          ))}
          <Caption>{members.length}명 순위 합산 — 작을수록 앞</Caption>
        </ol>
      )
    }
    case 'vote': {
      const rows = voteCounts(field, members)
      const max = Math.max(1, ...rows.map((r) => r.count))
      const rep = value && typeof value.value === 'string' ? members.find((m) => m.uid === value.value) : null
      return (
        <div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {rows.map((r) => (
              <li key={r.option} className="flex items-center gap-xs" style={{ marginBottom: 6 }}>
                <span className={textCls} style={{ flex: '0 0 50%' }}>
                  {r.option}
                </span>
                <span aria-hidden style={{ flex: 1, height: 12, background: '#f1f1f1', borderRadius: 999, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(r.count / max) * 100}%`, background: '#111' }} />
                </span>
                <span className="font-mono text-body-sm" style={{ width: 32, textAlign: 'right' }}>
                  {r.count}
                </span>
              </li>
            ))}
          </ul>
          {rep ? (
            <p className={textCls} style={{ margin: '8px 0 0' }}>
              <Badge solid>대표 이유</Badge> {rep.reason ?? ''}
              <span className="caption" style={{ marginLeft: 6 }}>
                {rep.nickname}
              </span>
            </p>
          ) : (
            <Caption>대표가 이유 하나를 아직 고르지 않았다</Caption>
          )}
        </div>
      )
    }
    case 'sentence': {
      const sentence = value && typeof value.value === 'string' ? value.value : ''
      return sentence ? (
        <p className={big ? 'text-headline' : 'text-body'} style={{ margin: 0, whiteSpace: 'pre-line' }}>
          {sentence}
        </p>
      ) : (
        <Caption>{members.length}명이 썼다 — 모둠 문장은 아직</Caption>
      )
    }
    case 'sort': {
      const rows = sortTally(field, members)
      const bins = field.bins ?? []
      return (
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: big ? 18 : 14 }}>
          <thead>
            <tr>
              <th scope="col" className="caption" style={{ textAlign: 'left', padding: '4px 8px 4px 0' }}>
                카드
              </th>
              {bins.map((b) => (
                <th key={b.id} scope="col" className="caption" style={{ textAlign: 'left', padding: '4px 8px 4px 0' }}>
                  {b.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1', background: r.split ? '#f4ecd6' : undefined }}>
                <td style={{ padding: '4px 8px 4px 0' }}>
                  {r.label}
                  {r.split ? <Badge>갈림</Badge> : null}
                </td>
                {bins.map((b) => (
                  <td key={b.id} className="font-mono" style={{ padding: '4px 8px 4px 0' }}>
                    {r.counts[b.id] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
  }
}

/** 강사 — 모둠별 나란히 (7.1 「모둠별 ▸」) */
export function GroupBoard({
  group,
  field,
  groups,
  shares,
  values,
  nameOf,
  big = false,
}: {
  group: GroupData
  field: FieldDef
  groups: Array<{ id: string; name: string }>
  shares: GroupShare[]
  values: GroupValue[]
  nameOf: (uid: string) => string
  big?: boolean
}) {
  if (groups.length === 0) {
    return (
      <p className="text-body-sm" style={{ opacity: 0.7, margin: 0 }}>
        아직 나눈 모둠이 없습니다. 도입 단계의 「모둠 나누기」로 나눕니다.
      </p>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${big ? 320 : 240}px, 1fr))`, gap: 16 }}>
      {groups.map((g) => (
        <section key={g.id} className="rounded-md" style={{ padding: 12, boxShadow: 'inset 0 0 0 1px #e6e6e6' }}>
          <div className="flex items-center gap-xs" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
            <Badge solid>{g.name}</Badge>
            <Caption>{shares.filter((s) => s.groupId === g.id).length}명</Caption>
          </div>
          <GroupCell group={group} field={field} shares={shares.filter((s) => s.groupId === g.id)} value={values.find((v) => v.groupId === g.id) ?? null} nameOf={nameOf} big={big} />
        </section>
      ))}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import type { FieldDef, GroupData, LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import type { GroupShare, GroupValue } from '@/lib/types'
import { Badge, Button, Caption, Notice } from '@/components/ui'
import { GroupCell } from './GroupBoard'

/**
 * 학생 — 활동의 ④ 모둠 단 (8차 4.6).
 *
 * 「토의하세요」로 끝내지 않는다. 각자 낸 것이 모둠 하나의 값으로 모인다.
 *   · 제출하면 내 값이 저절로 모둠에 들어간다 (GroupShare). 번호를 고르는 즉석 모둠은 없다 — 모둠은 5절에서 정해져 있다.
 *   · sentence: 각자 쓴 것을 읽고 대표가 한 문장을 올린다.
 *   · vote: 모둠 분포를 보고 대표가 이유 하나를 고른다.
 *   · allocation · rank · sort: 값이 저절로 계산된다. 대표가 할 일은 없다.
 * 쓰는 칸은 늘지 않는다 — 대표의 문장·선택은 모둠 값이지 개인 응답이 아니다.
 */
export function GroupStep({
  classId,
  lessonId,
  stepId,
  group,
  field,
  myValues,
  myGroup,
}: {
  classId: string
  lessonId: LessonId
  stepId: string
  group: GroupData
  field: FieldDef
  /** 내가 제출한 활동 응답 */
  myValues: Record<string, unknown> | null
  myGroup: { id: string; name: string; memberUids: string[] } | null
}) {
  const { repo, user } = useAuth()
  const [shares, setShares] = useState<GroupShare[]>([])
  const [values, setValues] = useState<GroupValue[]>([])
  const [sentence, setSentence] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const uid = user?.uid ?? null

  useEffect(() => {
    if (!repo) return
    const a = repo.watchGroupShares(classId, lessonId, stepId, setShares)
    const b = repo.watchGroupValues(classId, lessonId, stepId, setValues)
    return () => {
      a()
      b()
    }
  }, [repo, classId, lessonId, stepId])

  const myValue = myValues?.[group.fieldKey]
  const myReason = group.reasonKey ? String(myValues?.[group.reasonKey] ?? '') : ''
  const mine = shares.find((s) => s.uid === uid) ?? null

  /* 내 값을 모둠에 넣는다 — 제출할 때마다 맞춘다 */
  useEffect(() => {
    if (!repo || !uid || !myGroup || myValue === undefined || myValue === null) return
    const same = mine && mine.groupId === myGroup.id && JSON.stringify(mine.value) === JSON.stringify(myValue) && (mine.reason ?? '') === myReason
    if (same) return
    repo
      .setGroupShare(classId, lessonId, stepId, { uid, nickname: user?.nickname || '이름 없음', groupId: myGroup.id, value: myValue, reason: myReason, updatedAt: Date.now() })
      .catch((e) => console.error('[모둠] 내 값을 넣지 못했다:', e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, uid, myGroup?.id, JSON.stringify(myValue), myReason, mine?.groupId, JSON.stringify(mine?.value), mine?.reason])

  const members = useMemo(() => (myGroup ? shares.filter((s) => s.groupId === myGroup.id) : []), [shares, myGroup])
  const groupValue = myGroup ? (values.find((v) => v.groupId === myGroup.id) ?? null) : null
  const nameOf = (id: string) => shares.find((s) => s.uid === id)?.nickname ?? '이름 없음'

  async function setValue(value: unknown) {
    if (!repo || !uid || !myGroup) return
    setBusy(true)
    setError(null)
    try {
      await repo.setGroupValue(classId, lessonId, stepId, { groupId: myGroup.id, format: group.format, value, byUid: uid, updatedAt: Date.now() })
    } catch (e) {
      console.error('[모둠] 모둠 값을 올리지 못했다:', e)
      setError('올리지 못했습니다. 잠시 뒤 다시 누르세요.')
    } finally {
      setBusy(false)
    }
  }

  if (!myGroup) {
    return (
      <Notice tone="cream">
        <p className="text-body-sm" style={{ margin: 0 }}>
          아직 모둠이 없습니다. 강사가 모둠을 나누면 여기에 우리 모둠의 값이 모입니다.
        </p>
      </Notice>
    )
  }

  return (
    <section className="card" aria-labelledby="group-step-title">
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge solid>{myGroup.name}</Badge>
        <h3 id="group-step-title" className="text-card-title" style={{ margin: 0 }}>
          우리 모둠
        </h3>
        <Caption>{members.length} / {myGroup.memberUids.length}명 냈다</Caption>
      </div>
      <p className="text-body" style={{ margin: '8px 0 0' }}>
        {group.prompt}
      </p>

      {/* 모둠원이 낸 것 — sentence·vote 는 각자의 글을 읽는다 */}
      {group.format === 'sentence' || group.format === 'vote' ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
          {members.map((m) => (
            <li key={m.uid} className="rounded-md" style={{ padding: '10px 12px', marginBottom: 6, boxShadow: `inset 0 0 0 ${m.uid === uid ? 2 : 1}px ${m.uid === uid ? '#000' : '#e6e6e6'}` }}>
              <span className="text-body-sm" style={{ fontWeight: 480 }}>
                {m.nickname}
                {m.uid === uid ? <span className="caption" style={{ marginLeft: 6 }}>나</span> : null}
              </span>
              <p className="text-body" style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>
                {group.format === 'vote' ? `${String(m.value ?? '')} — ${m.reason ?? ''}` : String(m.value ?? '')}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <GroupCell group={group} field={field} shares={members} value={groupValue} nameOf={nameOf} />
      </div>

      {/* 대표가 할 일 */}
      {group.format === 'sentence' ? (
        <div style={{ marginTop: 16 }}>
          <label htmlFor="group-sentence" className="text-body-sm" style={{ fontWeight: 480, display: 'block' }}>
            {group.repPrompt ?? '모둠의 한 문장'}
          </label>
          <textarea id="group-sentence" className="field" rows={2} value={sentence} onChange={(e) => setSentence(e.target.value)} style={{ marginTop: 6 }} />
          <div className="flex items-center gap-md" style={{ marginTop: 8 }}>
            <Button disabled={busy || !sentence.trim()} onClick={() => void setValue(sentence.trim())}>
              모둠 문장 올리기
            </Button>
            <Caption>모둠에서 한 사람이 올립니다. 다시 올리면 바뀝니다.</Caption>
          </div>
        </div>
      ) : null}
      {group.format === 'vote' ? (
        <div style={{ marginTop: 16 }}>
          <p className="text-body-sm" style={{ margin: 0, fontWeight: 480 }}>
            {group.repPrompt ?? '모둠을 대표할 이유 하나를 고르세요'}
          </p>
          <ul className="flex flex-wrap gap-xs" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
            {members
              .filter((m) => (m.reason ?? '').trim())
              .map((m) => (
                <li key={m.uid}>
                  <Button variant={groupValue?.value === m.uid ? 'primary' : 'secondary'} disabled={busy} onClick={() => void setValue(m.uid)}>
                    {m.nickname}의 이유
                  </Button>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-body-sm" style={{ fontWeight: 480, marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </section>
  )
}

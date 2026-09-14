import { useEffect, useState } from 'react'
import type { GameDef, LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { activeLumi, fetchTicket, lumiConfigured, lumiMode, serverWsUrl, storageKey } from '@/lib/lumi'
import type { SessionState } from '@/lib/types'
import { Badge, Caption, ColorBlock, Notice } from '@/components/ui'
import { LumiFrame } from './LumiFrame'

/**
 * 학생 — 루미 런 참가 화면 (3·4강).
 *
 * 학생 계정에는 학생 참가 화면과 자기 게임 화면만 보인다. 방 만들기·규칙 변경·강제 종료·재경기는 없다.
 *   · 방이 없으면 「선생님이 게임을 준비하고 있어요」.
 *   · 강사가 방을 만들면 세션 구독으로 방 코드가 오고, 이 계정의 티켓을 받아 한 번만 저절로 참가한다.
 *     닉네임·코드를 다시 입력하지 않는다 — 티켓에 든 이름이 캐릭터 위와 결과에 그대로 쓰인다.
 *   · 결과는 서버가 확인해 세션에 적은 것만 그린다. 내가 뽑혔는지 눈에 띄게.
 */
export function LumiStudent({
  classId,
  lessonId,
  game,
  session,
  nicknames,
}: {
  classId: string
  lessonId: LessonId
  game: GameDef
  session: SessionState | null
  nicknames: Record<string, string>
}) {
  const { user } = useAuth()
  const lumi = activeLumi(session?.lumi)
  const [ticket, setTicket] = useState<{ act: string; ticket: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  /* 방이 열리면 이 활동의 티켓을 받는다 — 활동이 바뀌면 새 티켓. 지난 계정·지난 활동의 자격은 쓰지 않는다. */
  useEffect(() => {
    if (!lumi?.roomCode || !user) return
    if (ticket?.act === lumi.activityInstanceId) return
    let cancelled = false
    setError(null)
    fetchTicket(classId, lessonId, lumi.activityInstanceId)
      .then((t) => {
        if (!cancelled) setTicket({ act: lumi.activityInstanceId, ticket: t.ticket })
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message)
      })
    return () => {
      cancelled = true
    }
  }, [lumi?.roomCode, lumi?.activityInstanceId, user, classId, lessonId, ticket?.act])

  const result = lumi?.result ?? null
  const me = user?.uid ?? ''
  const selected = result?.selectedIds ?? []
  const iAmSelected = selected.includes(me)

  return (
    <section aria-labelledby="lumi-title" style={{ marginBottom: 40 }}>
      <ColorBlock tone="lime">
        <p className="eyebrow">{game.tab}</p>
        <h2 id="lumi-title" className="text-headline" style={{ margin: '12px 0 0' }}>
          {result ? (iAmSelected ? '이번 발표자는 나예요' : '이번 발표자가 정해졌어요') : game.lead.split('\n')[0]}
        </h2>
        <p className="text-body-sm" style={{ marginTop: 8, opacity: 0.85 }}>
          {lumiMode(game) === 'race' ? '먼저 도착한 사람이 이번 발표자입니다.' : '뒤처진 사람이 이번 발표자입니다.'} {game.hint}
        </p>

        {/* 결과 — 서버가 확인한 것 */}
        {result ? (
          <div className="card" style={{ marginTop: 16 }} aria-live="polite">
            <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
              <Caption>이번 발표자</Caption>
              <Badge>
                {result.requestedCount}명 목표{result.selectedCount !== result.requestedCount ? ` · 실제 ${result.selectedCount}명` : ''}
              </Badge>
            </div>
            {selected.length === 0 ? (
              <p className="text-body-sm" style={{ margin: '8px 0 0' }}>
                이번 경기에서는 선정된 사람이 없습니다. 선생님이 다시 진행합니다.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-xs" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                {selected.map((id) => (
                  <li key={id}>
                    <span className="badge" style={id === me ? { background: '#000', color: '#fff', boxShadow: 'none', fontSize: 15 } : { fontSize: 15 }}>
                      {result.selectedNames[id] ?? nicknames[id] ?? '이름 없음'}
                      {id === me ? ' (나)' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.75 }}>
              {result.selectionReason}
            </p>
            <p className="text-body-sm" style={{ margin: '8px 0 0' }}>
              {game.askLine}
            </p>
          </div>
        ) : null}

        {/* 게임 — 학생 진입만 */}
        {!lumiConfigured() ? (
          <Notice tone="cream">
            <p className="text-body-sm" style={{ margin: 0 }}>
              게임이 아직 연결되지 않았습니다. 선생님이 다른 방법으로 발표자를 정합니다.
            </p>
          </Notice>
        ) : !lumi || !lumi.roomCode ? (
          <div className="card" style={{ marginTop: 16 }} role="status">
            <p className="text-body" style={{ margin: 0 }}>
              선생님이 게임을 준비하고 있어요. 방이 열리면 저절로 들어갑니다.
            </p>
            <Caption>휴대폰은 가로로 돌려 주세요. 이 화면을 열어 둔 채 기다리면 됩니다.</Caption>
          </div>
        ) : error ? (
          <Notice tone="cream">
            <p className="text-body-sm" style={{ margin: 0 }}>
              게임에 들어가지 못했습니다 — {error}. 화면을 새로고침해 보세요.
            </p>
          </Notice>
        ) : ticket && user ? (
          <div style={{ marginTop: 16 }}>
            <LumiFrame
              mountKey={`${lumi.activityInstanceId}:student:${user.uid}`}
              height={620}
              config={{
                title: '게임으로 발표자 선정',
                description: '함께 달리고 이번 발표자를 만나요.',
                entryRole: 'student',
                participant: { id: user.uid, name: (nicknames[user.uid] ?? user.nickname ?? '학생').slice(0, 18) },
                activityId: lumi.activityInstanceId,
                storageKey: storageKey(lumi.activityInstanceId, user.uid, 'student'),
                roomCode: lumi.roomCode,
                autoJoin: true,
                integrationTicket: ticket.ticket,
                rules: { mode: lumiMode(game), count: lumi.requestedCount, text: '이번 발표자' },
                serverUrl: serverWsUrl(),
              }}
            />
            <Caption style={{ marginTop: 6 }}>← → 이동 · 스페이스 점프. 휴대폰은 가로로 돌리고 아래 버튼을 두 손가락으로 누릅니다.</Caption>
          </div>
        ) : (
          <p className="text-body-sm" style={{ marginTop: 16 }} role="status">
            수업 인증을 받는 중…
          </p>
        )}
      </ColorBlock>
    </section>
  )
}

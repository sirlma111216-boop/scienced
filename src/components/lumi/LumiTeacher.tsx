import { useEffect, useMemo, useState } from 'react'
import type { GameDef, LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { LUMI_MAX_PLAYERS, activeLumi, fetchTicket, lumiConfigured, lumiCount, lumiMap, newActivityInstanceId, serverWsUrl, storageKey, teacherRules, type LumiGameResult, type LumiSnapshot } from '@/lib/lumi'
import type { Enrollment, LumiActivity, SessionState } from '@/lib/types'
import { Badge, Button, Caption, Notice } from '@/components/ui'
import { useNames } from '@/components/console/shared'
import { LumiFrame } from './LumiFrame'

/**
 * 강사 — 루미 런으로 발표자 선정 (3·4강).
 *
 * 강사 계정에는 교사 방 만들기와 교사용 운영 화면만 보인다. 학생 참가 탭이나 자기 자신을 학생으로 넣는 화면은 없다.
 *   ★ 발표할 등수(game.lumi.ranks)는 여기 어디에도 적지 않는다. 게임 서버가 결과에 적어 보낸 selectionReason 으로만 드러난다.
 *     강사가 하는 일은 둘 — 다 들어왔는지 보고, 「다 함께 시작」을 누른다. 발표자 수 칸·규칙 칸은 없다.
 *   ① 「게임 방 만들기」 — 활동 실행 id 를 만들고 티켓을 받아 iframe 을 연다. 방은 그 클릭으로 게임이 만든다.
 *   ② 게임이 로비에 들어가면(lumi:ready) 방 코드를 세션(sessions/{lid}.lumi)에 적는다 → 학생 화면이 저절로 들어간다.
 *   ③ 대상 학생 N명 / 게임 연결 M명 / 미참가 를 따로 센다. 30명을 넘으면 알린다.
 *   ④ 경기가 끝나면 브라우저의 lumi:result 는 「확인 중」으로만 보이고, 서버 함수가 확인해 세션에 적은 결과만 발표자로 그린다.
 *   ⑤ 재경기는 같은 방에서 새 경기 id 로. 방이 사라졌으면(서버 재시작) 옛 방을 lost 로 두고 새 방을 만든다.
 */
export function LumiTeacher({
  classId,
  lessonId,
  stepId,
  game,
  session,
  students,
}: {
  classId: string
  lessonId: LessonId
  stepId: string
  game: GameDef
  session: SessionState | null
  students: Enrollment[]
}) {
  const { repo, user } = useAuth()
  const { nameOf } = useNames()
  const lumi = activeLumi(session?.lumi)
  const [ticket, setTicket] = useState<{ act: string; ticket: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<LumiSnapshot | null>(null)
  const [pendingResult, setPendingResult] = useState<LumiGameResult | null>(null)
  const [gameVersion, setGameVersion] = useState<{ version: string; capabilities: string[] } | null>(null)

  const studentUids = useMemo(() => students.map((s) => s.uid), [students])
  const connected = useMemo(() => (snapshot?.players ?? []).filter((p) => p.connected).map((p) => p.id), [snapshot])
  const connectedStudents = connected.filter((id) => studentUids.includes(id))
  const missing = studentUids.filter((id) => !connected.includes(id))

  /* 현재 활동의 티켓 — 활동이 바뀌면 새로 받는다 */
  useEffect(() => {
    if (!lumi || !user) return
    if (ticket?.act === lumi.activityInstanceId) return
    let cancelled = false
    fetchTicket(classId, lessonId, lumi.activityInstanceId)
      .then((t) => {
        if (!cancelled) setTicket({ act: lumi.activityInstanceId, ticket: t.ticket })
      })
      .catch((err) => setNote(`수업 인증을 받지 못했습니다 — ${(err as Error).message}`))
    return () => {
      cancelled = true
    }
  }, [lumi, user, classId, lessonId, ticket?.act])

  async function openRoom() {
    if (!repo || !user) return
    setBusy(true)
    setNote(null)
    try {
      const act = newActivityInstanceId(classId, lessonId)
      const t = await fetchTicket(classId, lessonId, act)
      if (t.role !== 'teacher') throw new Error('강사 계정이 아닙니다.')
      const next: LumiActivity = {
        activityInstanceId: act,
        gameId: game.id,
        stepId,
        roomCode: null,
        status: 'open',
        requestedCount: lumiCount(game),
        round: (session?.lumi?.round ?? 0) + 1,
        createdBy: user.uid,
        createdAt: Date.now(),
        lastMatchId: null,
        resultAt: null,
        result: null,
      }
      await repo.setSession(classId, lessonId, { lumi: next })
      setTicket({ act, ticket: t.ticket })
      setSnapshot(null)
      setPendingResult(null)
    } catch (err) {
      setNote(`방을 열지 못했습니다 — ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function markLost() {
    if (!repo || !lumi) return
    await repo.setSession(classId, lessonId, { lumi: { ...lumi, status: 'lost' } })
    setSnapshot(null)
  }

  const confirmed = lumi?.result && (!pendingResult || lumi.result.matchId === pendingResult.matchId) ? lumi.result : null
  /* 방 코드는 열쇠에 넣지 않는다 — 코드가 적히는 순간 게임을 다시 만들면 안 된다. 새로고침이면 코드와 함께 다시 잇는다. */
  const mountKey = lumi && ticket?.act === lumi.activityInstanceId ? `${lumi.activityInstanceId}:teacher` : ''

  if (!lumiConfigured()) {
    return (
      <Notice tone="cream">
        <p className="text-body-sm" style={{ margin: 0 }}>
          게임 주소(VITE_LUMI_ORIGIN)가 아직 설정되지 않았습니다. Render 에 배포한 루미 런 주소를 넣고 다시 배포하면 여기서 방을 만들 수 있습니다.
        </p>
      </Notice>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge>{game.tab}</Badge>
        <Badge>제한 시간 {game.lumi?.timeLimit ?? 60}초</Badge>
        {lumi ? <Badge solid>{lumi.status === 'open' ? (lumi.roomCode ? `방 ${lumi.roomCode}` : '방 만드는 중') : '결과 확정'}</Badge> : <Badge>아직 방 없음</Badge>}
        {gameVersion ? <Caption>게임 v{gameVersion.version}{!gameVersion.capabilities.includes('lesson-entry') ? ' · ⚠ 연동 기능 없음(옛 배포)' : !gameVersion.capabilities.includes('ranks-mode') ? ' · ⚠ 옛 배포 — 등수 방식·제한 시간이 없어 방을 못 만듭니다. 게임을 다시 배포하세요' : ''}</Caption> : null}
      </div>
      <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.8 }}>
        몇 등이 발표자가 될지는 결과 때 알려드립니다. 학생은 「참가」를 누르면 자기 계정·닉네임으로 들어옵니다. 다 들어왔으면 아래 게임 화면의 「다 함께 시작」을 누르세요 — 3초 뒤 출발하고, 모두 들어오거나 제한 시간이 되면 끝납니다.
      </p>

      {/* 대상 · 연결 · 미참가 — 서로 다른 상태다 */}
      <div className="flex flex-wrap items-center gap-xs" style={{ marginTop: 12 }}>
        <Badge>대상 학생 {studentUids.length}명</Badge>
        <Badge solid>게임 연결 {connectedStudents.length}명</Badge>
        <Badge>미참가 {missing.length}명</Badge>
        {studentUids.length > LUMI_MAX_PLAYERS ? <Caption>⚠ 게임은 한 방에 {LUMI_MAX_PLAYERS}명까지입니다. {studentUids.length - LUMI_MAX_PLAYERS}명은 들어오지 못합니다 — 두 번에 나눠 진행하세요.</Caption> : null}
      </div>
      {missing.length > 0 && missing.length <= 40 ? (
        <p className="text-body-sm" style={{ margin: '6px 0 0', opacity: 0.7 }}>
          미참가 · {missing.map((u) => nameOf(u)).join(', ')}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-xs" style={{ marginTop: 12 }}>
        {lumi?.status === 'open' ? (
          <Button variant="secondary" onClick={() => void markLost()} disabled={busy}>
            방을 잃었어요 — 닫기
          </Button>
        ) : null}
        <Button onClick={() => void openRoom()} disabled={busy || (lumi?.status === 'open' && Boolean(lumi.roomCode))}>
          {busy ? '여는 중…' : lumi ? '새 방 만들기' : '게임 방 만들기'}
        </Button>
        {note ? <span className="text-body-sm" role="status">{note}</span> : null}
      </div>

      {/* 결과 — 서버가 확인한 것만 발표자다 */}
      {pendingResult && !confirmed ? (
        <Notice tone="cream">
          <p className="text-body-sm" style={{ margin: 0 }} role="status">
            경기가 끝났습니다. 발표자 결과를 확인하는 중입니다 — 게임 서버가 서명한 결과가 도착하면 여기에 뜹니다.
          </p>
        </Notice>
      ) : null}
      {confirmed ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
            <Caption>이번 발표자</Caption>
            <Badge solid>{confirmed.selectedCount === 0 ? '선정 없음' : `${confirmed.selectedCount}명`}</Badge>
            <Badge>{confirmed.endReason === 'teacher' ? '교사가 종료' : confirmed.endReason === 'timeout' ? '시간 종료' : '정상 종료'}</Badge>
          </div>
          {confirmed.selectedIds.length === 0 ? (
            <p className="text-body-sm" style={{ margin: '8px 0 0' }}>
              선정된 사람이 없습니다 — 완주가 부족했거나 강제 종료했습니다. 재경기를 하거나 다른 방법으로 뽑으세요. 빈 결과를 임의로 채우지 않습니다.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-xs" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
              {confirmed.selectedIds.map((id) => (
                <li key={id}>
                  <span className="badge" style={{ background: '#000', color: '#fff', boxShadow: 'none', fontSize: 15 }}>
                    {nameOf(id)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.75 }}>
            {confirmed.selectionReason} · {confirmed.tieHandling}
          </p>
          <Caption>발표 횟수에 반영됐고, 학생 화면에도 같은 발표자와 같은 이유가 뜹니다. 재경기는 아래 게임 화면의 「같은 방에서 재경기」로 — 새 경기 id 로 저장됩니다.</Caption>
        </div>
      ) : null}

      {/* 게임 화면 — 교사 진입만 */}
      {lumi && mountKey ? (
        <div style={{ marginTop: 16 }}>
          <LumiFrame
            mountKey={mountKey}
            height={640}
            config={{
              title: '게임으로 발표자 선정',
              description: '함께 달리고 이번 발표자를 만나요.',
              entryRole: 'teacher',
              activityId: lumi.activityInstanceId,
              storageKey: storageKey(lumi.activityInstanceId, user?.uid ?? 'teacher', 'teacher'),
              roomCode: lumi.roomCode ?? undefined,
              integrationTicket: ticket?.ticket,
              map: lumiMap(game),
              rules: teacherRules(game),
              serverUrl: serverWsUrl(),
              joinBaseUrl: `${window.location.origin}/lesson/${lessonId}`,
            }}
            createOnMount={!lumi.roomCode}
            onAvailable={(info) => setGameVersion(info)}
            onReady={(s) => {
              setSnapshot(s)
              /* 로비에 들어갔다 — 방 코드를 세션에 적어 학생이 들어오게 한다 (한 번만) */
              if (repo && lumi && s.code && lumi.roomCode !== s.code) {
                void repo.setSession(classId, lessonId, { lumi: { ...lumi, roomCode: s.code, status: 'open' } })
              }
            }}
            onLobby={(s) => setSnapshot(s)}
            onStart={(s) => setSnapshot(s)}
            onResult={(r) => setPendingResult(r)}
            onError={(m) => {
              console.warn('[lumi]', m)
              setNote(`게임 서버 — ${m}`)
            }}
          />
          {!lumi.roomCode ? <Caption style={{ marginTop: 6 }}>방을 여는 중입니다. 코드가 뜨면 학생 화면이 저절로 들어옵니다.</Caption> : null}
        </div>
      ) : null}
    </div>
  )
}

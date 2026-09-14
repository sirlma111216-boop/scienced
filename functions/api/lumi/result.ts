import type { Env } from '../../../shared/ai-core'
import { firestoreRest, verifyLumiSignature } from '../_lib/lumi'

/**
 * POST /api/lumi/result — 게임 서버가 확정한 결과를 서명해서 보낸다 (webhook).
 *
 * 브라우저가 보낸 lumi:result 는 화면용일 뿐이다. 발표자는 여기로 온 결과로만 확정한다.
 *   1 x-lumi-signature 를 본문 그대로에 대해 확인한다 (LUMI_SHARED_SECRET).
 *   2 봉투의 활동 id 가 그 차시 세션(sessions/{lid}.lumi)이 가리키는 현재 활동과 같아야 한다 —
 *     단독 방이나 지난 활동의 결과로 발표자를 바꾸지 못한다.
 *   3 (activityInstanceId, matchId) 로 멱등 — lumiResults 문서를 「없을 때만」 만든다. 두 번 오면 한 번만 저장.
 *   4 저장: lumiResults 문서(전체 결과) · sessions.lumi.result(화면 공유) · sessions.ladders[gameId](기존 발표자
 *     구조: winnerUids) · picks 기록 · 선정자의 participation.presentCount +1.
 *
 * 응답: 영구 거절(서명 불일치·활동 불일치)은 200 + ok:false 로 — 게임 서버가 재시도하지 않게.
 *       일시 오류(Firestore 실패)는 500 — 게임 서버가 5·20·60초 뒤 다시 보낸다.
 */
interface Envelope {
  type: 'lumi.result'
  sentAt: string
  room: { code: string; activityId: string; cid: string; lid: string }
  result: {
    gameVersion: string
    moduleVersion: string
    resultVersion: string
    matchId: string
    activityId: string
    map: number
    rules: { mode: string; duration: number; lives: number; count: number; text: string }
    players: Array<{ id: string; name: string; status: string; rank: number | null; finishTime: number | null; progress: number; connected: boolean; bot: boolean }>
    selectedIds: string[]
    selectionReason: string
    tieHandling: string
    endReason: 'normal' | 'timeout' | 'teacher'
    endedAt: string
  }
}
type Value = { stringValue?: string; integerValue?: string; booleanValue?: boolean; nullValue?: null; arrayValue?: { values?: Value[] }; mapValue?: { fields?: Record<string, Value> } }
const S = (v: string): Value => ({ stringValue: v })
const I = (v: number): Value => ({ integerValue: String(Math.round(v)) })
const B = (v: boolean): Value => ({ booleanValue: v })
const A = (vs: Value[]): Value => ({ arrayValue: { values: vs } })
const M = (f: Record<string, Value>): Value => ({ mapValue: { fields: f } })
const str = (f: Record<string, Value> | undefined, k: string) => f?.[k]?.stringValue

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })
}

export const onRequestPost: PagesFunction<Env & { LUMI_SHARED_SECRET?: string; FIRESTORE_EMULATOR_HOST?: string }> = async (ctx) => {
  const secret = ctx.env.LUMI_SHARED_SECRET
  const project = ctx.env.FIREBASE_PROJECT_ID
  if (!secret || !project) return ok({ ok: false, message: 'LUMI_SHARED_SECRET / FIREBASE_PROJECT_ID 가 없습니다.' }, 500)
  const raw = await ctx.request.text()
  if (!(await verifyLumiSignature(raw, ctx.request.headers.get('x-lumi-signature'), secret))) {
    return ok({ ok: false, message: '서명이 맞지 않습니다.' })
  }
  let env: Envelope
  try {
    env = JSON.parse(raw) as Envelope
  } catch {
    return ok({ ok: false, message: '본문이 JSON 이 아닙니다.' })
  }
  if (env?.type !== 'lumi.result' || !env.room?.cid || !env.room?.lid || !env.result?.matchId) return ok({ ok: false, message: '봉투 형식이 아닙니다.' })
  const { cid, lid } = env.room
  const r = env.result
  const act = env.room.activityId
  if (r.activityId !== act) return ok({ ok: false, message: '결과의 활동 id 가 방의 활동 id 와 다릅니다.' })
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(cid) || !/^\d{2}$/.test(lid) || !/^[A-Za-z0-9_:.-]{1,120}$/.test(act) || !/^[A-Za-z0-9-]{1,80}$/.test(r.matchId)) return ok({ ok: false, message: 'id 형식이 아닙니다.' })

  const rest = await firestoreRest(ctx.env)
  if ('error' in rest) return ok({ ok: false, message: rest.error }, 500)
  const fs = rest.docs
  const h = rest.headers

  /* ② 이 차시의 현재 활동인가 */
  const sessRes = await fetch(`${fs}/classes/${cid}/sessions/${lid}`, { headers: h })
  if (sessRes.status >= 500) return ok({ ok: false, message: '세션을 읽지 못했습니다.' }, 500)
  const sess = sessRes.ok ? ((await sessRes.json()) as { fields?: Record<string, Value> }).fields ?? {} : {}
  const lumi = sess.lumi?.mapValue?.fields
  if (!lumi || str(lumi, 'activityInstanceId') !== act) {
    return ok({ ok: false, message: '이 차시의 현재 활동이 아닙니다 — 발표자를 바꾸지 않습니다.' })
  }
  const gameId = str(lumi, 'gameId') ?? `${lid}-lumi`
  const stepId = str(lumi, 'stepId') ?? 'step-formative'
  /* 요청 인원은 게임이 확정한 규칙의 count — 교사가 게임 안에서 바꿨을 수 있다 */
  const requested = Number(r.rules.count)

  /* ③ 멱등 — 없을 때만 만든다 */
  const resultId = `${act}__${r.matchId}`.replace(/[^A-Za-z0-9_:.-]/g, '_')
  const resultDoc = {
    fields: {
      id: S(resultId),
      classId: S(cid),
      lessonId: S(lid),
      stepId: S(stepId),
      gameId: S(gameId),
      activityInstanceId: S(act),
      roomCode: S(env.room.code),
      matchId: S(r.matchId),
      selectedIds: A(r.selectedIds.map(S)),
      selectedNames: M(Object.fromEntries(r.players.filter((p) => r.selectedIds.includes(p.id)).map((p) => [p.id, S(p.name)]))),
      requestedCount: I(requested),
      selectedCount: I(r.selectedIds.length),
      rules: M({ mode: S(r.rules.mode), duration: I(r.rules.duration), lives: I(r.rules.lives), count: I(r.rules.count), text: S(r.rules.text ?? '') }),
      map: I(r.map),
      players: A(r.players.map((p) => M({ id: S(p.id), name: S(p.name), status: S(p.status), rank: p.rank === null ? { nullValue: null } : I(p.rank), progress: I(p.progress), connected: B(p.connected) }))),
      selectionReason: S(r.selectionReason),
      tieHandling: S(r.tieHandling),
      endReason: S(r.endReason),
      endedAt: S(r.endedAt),
      gameVersion: S(r.gameVersion),
      receivedAt: I(Date.now()),
    },
  }
  const create = await fetch(`${fs}/classes/${cid}/lumiResults/${encodeURIComponent(resultId)}?currentDocument.exists=false`, { method: 'PATCH', headers: h, body: JSON.stringify(resultDoc) })
  if (create.status === 409 || create.status === 400) {
    /* 이미 받은 결과 — 한 번만 저장한다 */
    const already = await fetch(`${fs}/classes/${cid}/lumiResults/${encodeURIComponent(resultId)}`, { headers: h })
    if (already.ok) return ok({ ok: true, duplicate: true })
  }
  if (!create.ok) return ok({ ok: false, message: `결과 저장 실패 ${create.status}` }, 500)

  /* ④ 세션 — 화면 공유용 요약과 기존 발표자 구조 */
  const now = Date.now()
  const winners = r.selectedIds.filter((id) => !id.startsWith('host'))
  const summary = M({
    matchId: S(r.matchId),
    selectedIds: A(winners.map(S)),
    selectedNames: M(Object.fromEntries(r.players.filter((p) => winners.includes(p.id)).map((p) => [p.id, S(p.name)]))),
    requestedCount: I(requested),
    selectedCount: I(winners.length),
    mode: S(r.rules.mode),
    selectionReason: S(r.selectionReason),
    tieHandling: S(r.tieHandling),
    endReason: S(r.endReason),
    endedAt: S(r.endedAt),
    playerCount: I(r.players.filter((p) => p.status !== 'spectator').length),
  })
  const ladder = M({
    gameId: S(gameId),
    phase: S('done'),
    round: I(Number(lumi.round?.integerValue ?? 1)),
    seed: S(r.matchId),
    columns: I(Math.max(2, r.players.length)),
    seats: M({}),
    presentSlots: A([]),
    winnerUids: A(winners.map(S)),
    excludedUids: A([]),
    emergency: B(r.endReason === 'teacher'),
    runAt: I(now),
  })
  const mask = [`lumi.result`, `lumi.status`, `lumi.lastMatchId`, `lumi.resultAt`, `ladders.\`${gameId}\``, 'updatedAt'].map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&')
  const sessPatch = await fetch(`${fs}/classes/${cid}/sessions/${lid}?${mask}`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({
      fields: {
        lumi: M({ result: summary, status: S('ended'), lastMatchId: S(r.matchId), resultAt: I(now) }),
        ladders: M({ [gameId]: ladder }),
        updatedAt: I(now),
      },
    }),
  })
  if (!sessPatch.ok) return ok({ ok: false, message: `세션 갱신 실패 ${sessPatch.status} ${await sessPatch.text()}` }, 500)

  /* picks 기록 + 발표 횟수 — 발표자는 이미 세션에 적혔으므로 여기 실패는 500 으로 되돌리지 않고(재전송이 발표자를 두 번 세지 않게) 응답에 남긴다 */
  const warnings: string[] = []
  const pickId = `${gameId}-lumi-${r.matchId.slice(0, 8)}`
  const pick = await fetch(`${fs}/classes/${cid}/picks/${encodeURIComponent(pickId)}`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({
      fields: {
        id: S(pickId),
        lessonId: S(lid),
        stepId: S(stepId),
        gameId: S(gameId),
        candidateUids: A(r.players.filter((p) => p.status !== 'spectator').map((p) => S(p.id))),
        excludedUids: A([]),
        weights: M({}),
        winnerUids: A(winners.map(S)),
        seed: S(`lumi:${r.matchId}`),
        runBy: S('lumi-run'),
        runAt: I(now),
        redrawOf: { nullValue: null },
      },
    }),
  })
  if (!pick.ok) warnings.push(`picks 기록 실패 ${pick.status}`)
  if (winners.length > 0) {
    const writes = winners.flatMap((uid) => {
      const name = `projects/${project}/databases/(default)/documents/classes/${cid}/participation/${uid}`
      return [
        { update: { name, fields: { uid: S(uid) } }, updateMask: { fieldPaths: ['uid'] } },
        { transform: { document: name, fieldTransforms: [{ fieldPath: 'presentCount', increment: { integerValue: '1' } }] } },
      ]
    })
    const part = await fetch(rest.commit, { method: 'POST', headers: h, body: JSON.stringify({ writes }) })
    if (!part.ok) warnings.push(`발표 횟수 갱신 실패 ${part.status}`)
  }
  if (warnings.length) console.warn('[lumi/result]', resultId, warnings.join(' · '))
  return ok({ ok: true, saved: resultId, winners: winners.length, warnings })
}

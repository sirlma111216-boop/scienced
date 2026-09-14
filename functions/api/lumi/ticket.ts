import type { Env } from '../../../shared/ai-core'
import { fail, isInstructorUid, json, verifyIdToken } from '../_lib/auth'
import { LUMI_NAME_MAX, LUMI_TICKET_TTL_SEC, signLumiTicket } from '../_lib/lumi'

/**
 * POST /api/lumi/ticket  { classId, lessonId, activityInstanceId }
 *
 * 루미 런(발표자 선정 게임)에 들어가기 위한 짧은 유효기간의 증명을 발급한다.
 *   · 강사 — instructors/{uid} 문서로 판정. 역할 teacher. 방을 만들거나 진행 중인 방에 교사로 다시 잇는다.
 *   · 학생 — 그 클래스의 active 등록이 있어야 한다. 이름은 등록 문서의 닉네임. 역할 student.
 *            학생 티켓은 sessions/{lessonId}.lumi 가 가리키는 현재 활동(activityInstanceId)에만 발급한다 —
 *            강의 앱이 공유하지 않은 방·지난 활동에는 못 들어간다.
 * 게임 서버는 이 티켓의 서명·활동·역할만 믿고 브라우저가 보낸 id·이름은 무시한다.
 *
 * 비밀 LUMI_SHARED_SECRET 은 Cloudflare 와 Render 에 같은 값으로 둔다.
 */
type Fields = Record<string, { stringValue?: string; mapValue?: { fields?: Fields } }>

export const onRequestPost: PagesFunction<Env & { LUMI_SHARED_SECRET?: string }> = async (ctx) => {
  const authHeader = ctx.request.headers.get('authorization')
  const project = ctx.env.FIREBASE_PROJECT_ID
  const caller = await verifyIdToken(authHeader, project)
  if (!caller) return fail('로그인이 필요합니다.')
  const secret = ctx.env.LUMI_SHARED_SECRET
  if (!secret) return fail('LUMI_SHARED_SECRET 이 설정되지 않았습니다 — 게임 연동을 아직 켤 수 없습니다.')
  if (!project) return fail('FIREBASE_PROJECT_ID 가 설정되지 않았습니다.')

  let body: { classId?: string; lessonId?: string; activityInstanceId?: string }
  try {
    body = (await ctx.request.json()) as typeof body
  } catch {
    return fail('요청 형식이 올바르지 않습니다.')
  }
  const cid = String(body.classId ?? '').trim()
  const lid = String(body.lessonId ?? '').trim()
  const act = String(body.activityInstanceId ?? '').trim()
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(cid) || !/^\d{2}$/.test(lid) || !/^[A-Za-z0-9_:.-]{1,120}$/.test(act)) return fail('클래스·차시·활동 id 형식이 아닙니다.')

  const fs = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`
  const h: Record<string, string> = authHeader ? { authorization: authHeader } : {}
  const teacher = await isInstructorUid(project, caller.uid, authHeader)
  let name = ''
  if (!teacher) {
    /* 학생 — 이 클래스의 active 등록. 자기 등록 문서는 본인이 읽는다. */
    const e = await fetch(`${fs}/classes/${cid}/enrollments/${caller.uid}`, { headers: h })
    if (!e.ok) return fail('이 클래스에 등록되어 있지 않습니다.')
    const ef = ((await e.json()) as { fields?: Fields }).fields ?? {}
    if (ef.status?.stringValue !== 'active') return fail('이 클래스의 수강이 끝났습니다.')
    name = ef.nickname?.stringValue ?? ''
    /* 강의 앱이 공유한 현재 활동에만 */
    const s = await fetch(`${fs}/classes/${cid}/sessions/${lid}`, { headers: h })
    const sf = s.ok ? (((await s.json()) as { fields?: Fields }).fields ?? {}) : {}
    const lumi = sf.lumi?.mapValue?.fields ?? {}
    if (lumi.activityInstanceId?.stringValue !== act) return fail('선생님이 아직 게임을 열지 않았거나, 지난 활동입니다. 화면을 새로고침해 주세요.')
  } else {
    name = '교사'
  }
  const now = Math.floor(Date.now() / 1000)
  const ticket = await signLumiTicket(
    { cid, lid, act, sub: caller.uid, name: name.trim().slice(0, LUMI_NAME_MAX), role: teacher ? 'teacher' : 'student', iat: now, exp: now + LUMI_TICKET_TTL_SEC },
    secret,
  )
  return json({ ok: true, ticket, role: teacher ? 'teacher' : 'student', expiresAt: (now + LUMI_TICKET_TTL_SEC) * 1000 })
}

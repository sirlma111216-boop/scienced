import type { GameDef, LessonId } from '@/content/types'
import { apiPost } from './api'
import { getRepo } from './repo'
import type { LumiActivity } from './types'

/**
 * 루미 런 연동 — 화면 쪽 도움 함수.
 *
 * 게임은 Render 에 따로 배포돼 있고(저장소 sirlma111216-boop/gamerun), 강의 앱은 iframe 으로 붙인다.
 *   iframe URL   {origin}/embed.html?parentOrigin={이 앱의 origin}
 *   게임 → 부모   lumi:available · lumi:ready · lumi:lobby(참가자 변동) · lumi:start · lumi:end · lumi:result · lumi:error(서버가 거절한 이유)
 *   부모 → 게임   lumi:mount(config) · lumi:start · lumi:stop · lumi:restart · lumi:destroy
 * 부모는 event.origin 과 event.source 를 확인하고, postMessage 의 targetOrigin 에 '*' 를 쓰지 않는다.
 *
 * 게임 주소는 Render 에 배포한 실제 주소다(강의자가 2026-09-15 에 준 것). 다른 곳으로 옮기면 VITE_LUMI_ORIGIN 으로 바꾼다.
 * 빌드 변수가 비어 있어도 이 주소로 붙는다 — Pages 대시보드에 변수를 더 넣지 않아도 되게.
 */
export const LUMI_DEFAULT_ORIGIN = 'https://gamerun-mlhh.onrender.com'
export const LUMI_ORIGIN = (String(import.meta.env.VITE_LUMI_ORIGIN ?? '').trim() || LUMI_DEFAULT_ORIGIN).replace(/\/+$/, '')
export const lumiConfigured = () => /^https?:\/\//.test(LUMI_ORIGIN)
export const LUMI_MAX_PLAYERS = 30

export function isLumiGame(game: GameDef | null | undefined): boolean {
  return Boolean(game && game.mode.startsWith('lumi-'))
}
/** 강사가 방을 만들 때 게임에 넘기는 규칙 — 등수(ranks)가 든다. 학생 쪽은 studentRules 로 등수 없이. */
export function teacherRules(game: GameDef) {
  const l = game.lumi ?? { map: 1, ranks: [1], timeLimit: 60, course: 30 }
  return { mode: 'ranks' as const, ranks: l.ranks, timeLimit: l.timeLimit, duration: l.course, lives: 0, count: l.ranks.length, text: '이번 발표자' }
}
/** 학생 브라우저에는 등수를 보내지 않는다 — 규칙은 서버 스냅숏이 준다 */
export function studentRules(game: GameDef) {
  const { ranks: _ranks, ...rest } = teacherRules(game)
  return rest
}
export function lumiMap(game: GameDef): number {
  return game.lumi?.map ?? 1
}
export function lumiCount(game: GameDef): number {
  return game.lumi?.ranks.length ?? game.winnerCount
}

export function embedUrl(): string {
  return `${LUMI_ORIGIN}/embed.html?parentOrigin=${encodeURIComponent(window.location.origin)}`
}
export function serverWsUrl(): string {
  return `${LUMI_ORIGIN.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')}/ws`
}

/** 활동 실행 id — 같은 차시를 두 번 실행해도 구분한다 */
export function newActivityInstanceId(classId: string, lessonId: LessonId): string {
  return `${classId}:${lessonId}:${Date.now().toString(36)}`
}

/** 저장 열쇠 — 수업·활동 실행·계정·역할까지 넣어 다른 계정의 참가 자격을 쓰지 못하게 한다 */
export function storageKey(act: string, uid: string, role: 'teacher' | 'student'): string {
  return `${act}:${uid}:${role}`
}

export async function fetchTicket(classId: string, lessonId: LessonId, activityInstanceId: string): Promise<{ ticket: string; role: 'teacher' | 'student'; expiresAt: number }> {
  const data = await apiPost<{ ok: boolean; ticket?: string; role?: 'teacher' | 'student'; expiresAt?: number; message?: string }>('/api/lumi/ticket', { classId, lessonId, activityInstanceId })
  if (data.ok && data.ticket && data.role) return { ticket: data.ticket, role: data.role, expiresAt: data.expiresAt ?? Date.now() + 10 * 60 * 1000 }
  /*
   * 로컬 저장 모드(Firebase 설정 없음)에는 서버 함수가 없다. 그때만 브라우저에서 개발용 비밀로 티켓을 만든다 —
   * 같은 컴퓨터의 게임 서버를 LESSON_SHARED_SECRET=local-dev 로 띄우면 연동 흐름 전체를 로컬에서 돌려 볼 수 있다.
   * 운영(Firebase 설정 있음)에서는 이 길이 아예 없다. 티켓은 서버 함수만 발급한다.
   */
  if (getRepo().mode === 'local' && /서버에 닿지 못했습니다/.test(data.message ?? '')) return devTicket(classId, lessonId, activityInstanceId)
  throw new Error(data.message || '수업 인증을 받지 못했습니다.')
}

async function devTicket(classId: string, lessonId: LessonId, activityInstanceId: string) {
  const raw = localStorage.getItem('sls.v1.localUser')
  const user = raw ? (JSON.parse(raw) as { uid: string; role: string; nickname: string }) : null
  if (!user) throw new Error('로그인이 필요합니다.')
  const role: 'teacher' | 'student' = user.role === 'instructor' ? 'teacher' : 'student'
  const now = Math.floor(Date.now() / 1000)
  const payload = { iss: 'scienced', aud: 'lumi-run', cid: classId, lid: lessonId, act: activityInstanceId, sub: user.uid, name: (user.nickname || '학생').slice(0, 18), role, iat: now, exp: now + 7200 }
  const enc = new TextEncoder()
  const b64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const body = b64(enc.encode(JSON.stringify(payload)))
  const key = await crypto.subtle.importKey('raw', enc.encode('local-dev'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body))))
  return { ticket: `${body}.${sig}`, role, expiresAt: (now + 7200) * 1000 }
}

/** 게임이 보내는 스냅숏·결과 — 필요한 만큼만 본다 */
export interface LumiSnapshot {
  code: string
  phase: 'lobby' | 'countdown' | 'running' | 'results'
  matchId: string
  activityId: string
  players: Array<{ id: string; name: string; connected: boolean; status: string }>
  hostConnected: boolean
}
export interface LumiGameResult {
  matchId: string
  activityId: string
  selectedIds: string[]
  players: Array<{ id: string; name: string; rank: number | null; status: string }>
  selectionReason: string
  tieHandling: string
  endReason: 'normal' | 'timeout' | 'teacher'
  endedAt: string
  rules: { mode: string; count: number }
}

export function activeLumi(lumi: LumiActivity | null | undefined): LumiActivity | null {
  return lumi && lumi.status !== 'lost' ? lumi : null
}

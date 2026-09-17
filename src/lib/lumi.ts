import type { CourseId, LessonId } from '@/content/types'
import { apiPost } from './api'
import { getRepo } from './repo'
import type { LumiActivity } from './types'

/**
 * 루미 런 연동 — 화면 쪽 도움 함수.
 *
 * 게임은 Render 에 따로 배포돼 있고(저장소 sirlma111216-boop/gamerun), 강의 앱은 iframe 으로 붙인다.
 *   iframe URL   {origin}/embed.html?parentOrigin={이 앱의 origin}
 *   게임 → 부모   lumi:available · lumi:ready · lumi:lobby · lumi:start · lumi:end · lumi:result · lumi:error
 *   부모 → 게임   lumi:mount(config) · lumi:start · lumi:stop · lumi:restart · lumi:destroy
 *
 * ★ 발표 등수는 번들에 없다 (8차 부록 ②). 강사가 티켓을 받을 때 서버가 규칙을 함께 준다.
 *   학생 config 에는 등수가 없고, 게임 서버 스냅숏도 결과 전에는 ranks 를 뺀다.
 */
export const LUMI_DEFAULT_ORIGIN = 'https://gamerun-mlhh.onrender.com'
export const LUMI_ORIGIN = (String(import.meta.env.VITE_LUMI_ORIGIN ?? '').trim() || LUMI_DEFAULT_ORIGIN).replace(/\/+$/, '')
export const lumiConfigured = () => /^https?:\/\//.test(LUMI_ORIGIN)
export const LUMI_MAX_PLAYERS = 30
export const LUMI_TIME_LIMIT = 60

export interface LumiTeacherRules {
  mode: 'ranks'
  ranks: number[]
  timeLimit: number
  duration: number
  lives: number
  count: number
  text: string
}

/** 학생에게 보내는 규칙 — 등수 없이. 실제 규칙은 서버 스냅숏이 준다 */
export function studentRules(timeLimit = LUMI_TIME_LIMIT) {
  return { mode: 'ranks' as const, timeLimit, duration: 30, lives: 0, text: '이번 발표자' }
}

export function embedUrl(): string {
  return `${LUMI_ORIGIN}/embed.html?parentOrigin=${encodeURIComponent(window.location.origin)}`
}
export function serverWsUrl(): string {
  return `${LUMI_ORIGIN.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')}/ws`
}

export function newActivityInstanceId(classId: string, lessonId: LessonId): string {
  return `${classId}:${lessonId}:${Date.now().toString(36)}`
}

export function storageKey(act: string, uid: string, role: 'teacher' | 'student'): string {
  return `${act}:${uid}:${role}`
}

export interface LumiTicket {
  ticket: string
  role: 'teacher' | 'student'
  expiresAt: number
  /** 강사에게만 온다 */
  rules?: LumiTeacherRules
  map?: number
  timeLimit?: number
}

export async function fetchTicket(classId: string, lessonId: LessonId, activityInstanceId: string, courseId: CourseId): Promise<LumiTicket> {
  const data = await apiPost<{ ok: boolean; ticket?: string; role?: 'teacher' | 'student'; expiresAt?: number; rules?: LumiTeacherRules; map?: number; timeLimit?: number; message?: string }>('/api/lumi/ticket', {
    classId,
    lessonId,
    activityInstanceId,
    courseId,
  })
  if (data.ok && data.ticket && data.role) {
    return { ticket: data.ticket, role: data.role, expiresAt: data.expiresAt ?? Date.now() + 10 * 60 * 1000, rules: data.rules, map: data.map, timeLimit: data.timeLimit }
  }
  /* 로컬 저장 모드(서버 없음)에서만 브라우저가 개발용 비밀로 티켓을 만든다 */
  if (getRepo().mode === 'local' && /서버에 닿지 못했습니다/.test(data.message ?? '')) return devTicket(classId, lessonId, activityInstanceId)
  throw new Error(data.message || '수업 인증을 받지 못했습니다.')
}

async function devTicket(classId: string, lessonId: LessonId, activityInstanceId: string): Promise<LumiTicket> {
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
  /* 로컬에서는 등수를 1등 하나로 — 진짜 등수는 서버에만 있다 */
  const rules: LumiTeacherRules | undefined = role === 'teacher' ? { mode: 'ranks', ranks: [1], timeLimit: LUMI_TIME_LIMIT, duration: 30, lives: 0, count: 1, text: '이번 발표자' } : undefined
  return { ticket: `${body}.${sig}`, role, expiresAt: (now + 7200) * 1000, rules, map: 1, timeLimit: LUMI_TIME_LIMIT }
}

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

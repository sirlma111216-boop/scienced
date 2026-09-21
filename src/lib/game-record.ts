import type { LessonId } from '@/content/types'
import { weightFromPresentCount } from './ladder'
import type { Repo } from './repo'
import type { GameResult, GameState } from './types'

/**
 * 발표자 결과를 적는 자리 하나 (8차 6절).
 *
 * 게임이 무엇이든 결과는 같은 세 곳에 적는다 — 새 구조를 만들면 기존 화면과 통계가 못 본다.
 *   ① 세션의 게임 상태(`sessions/{lid}.games[stepId]`) — 학생·강사 화면이 같은 결과를 본다
 *   ② 뽑기 기록(`picks`) — 후보 · 가중치 · 씨앗 · 재추첨 사슬
 *   ③ 개인 누적(`participation.presentCount`) — 다음 뽑기의 가중치
 *
 * 라이브러리 게임(GameShell)과 구슬 레이스(MarbleTeacher)가 이 함수를 함께 쓴다.
 */
export async function finalizeGame(
  repo: Repo,
  a: {
    classId: string
    lessonId: LessonId
    stepId: string
    gameId: string
    /** 확정할 판 */
    base: GameState
    winnerUids: string[]
    reason: string
    candidateUids: string[]
    /** uid → 지금까지의 발표 횟수 */
    presentCount: Record<string, number>
    runBy: string
    /** 「반응 속도 게임입니다」처럼 결과에 함께 적을 단서 */
    fairness?: string
    manual?: boolean
  },
): Promise<void> {
  const result: GameResult = {
    winnerUids: a.winnerUids,
    reason: a.reason,
    candidateUids: a.candidateUids,
    seed: a.base.seed,
    fairness: a.fairness,
    manual: a.manual,
    at: Date.now(),
  }
  /* undefined 필드를 지운다 — Firestore 가 받지 않는다 */
  const clean = JSON.parse(JSON.stringify(result)) as GameResult
  await repo.setGame(a.classId, a.lessonId, a.stepId, { ...a.base, phase: 'done', result: clean, updatedAt: Date.now() })
  await repo.recordPick(a.classId, {
    id: `${a.gameId}-r${a.base.round}-${Date.now().toString(36)}`,
    lessonId: a.lessonId,
    stepId: a.stepId,
    gameId: a.gameId,
    candidateUids: clean.candidateUids,
    excludedUids: [],
    weights: Object.fromEntries(clean.candidateUids.map((u) => [u, weightFromPresentCount(a.presentCount[u] ?? 0)])),
    winnerUids: a.winnerUids,
    seed: a.base.seed,
    runBy: a.runBy,
    runAt: Date.now(),
    redrawOf: a.base.round > 1 ? `${a.gameId}-r${a.base.round - 1}` : null,
  })
  for (const w of a.winnerUids) await repo.bumpParticipation(a.classId, w, { presentCount: (a.presentCount[w] ?? 0) + 1, lastPresentedLessonId: a.lessonId })
}

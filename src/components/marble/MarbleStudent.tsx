import type { LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { marbleSetup } from '@/lib/marble'
import type { GameState, SessionState } from '@/lib/types'
import { Badge, Caption } from '@/components/ui'
import { GameResultCard } from '@/components/games/GameResultCard'

/**
 * 학생 — 구슬 레이스는 강사 화면 하나에서 돈다. 학생은 참가 단추도, 입력도 없다.
 * 여기서는 무엇으로 뽑는지와 결과만 본다 (결과는 강사 화면이 세션에 적은 그것 그대로다).
 */
export function MarbleStudent({ stepId, options, session, nicknames }: { lessonId: LessonId; stepId: string; options?: Record<string, unknown> | null; session: SessionState | null; nicknames: Record<string, string> }) {
  const { user } = useAuth()
  const state: GameState | null = session?.games?.[stepId] ?? null
  const { mapName, pick } = marbleSetup(options)
  const result = state?.result ?? null
  const nameOf = (u: string) => nicknames[u] ?? '이름 없음'

  return (
    <div>
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Badge solid>교실 구슬 레이스</Badge>
        {state ? <Badge>{state.phase === 'running' ? '진행 중' : state.phase === 'done' ? '끝' : '곧 시작'}</Badge> : <Badge>준비 중</Badge>}
      </div>
      <p className="text-body" style={{ margin: '8px 0 0' }}>
        {result ? '구슬이 멈췄다. 이번 발표자는 아래와 같다.' : '모두의 구슬이 앞 화면에서 함께 달린다. 앞을 보세요.'}
      </p>
      {result ? <GameResultCard result={result} nameOf={nameOf} uid={user?.uid} /> : <Caption>{`${mapName} 같은 길을 굴러 내려간다. ${pick.label}이 발표자가 된다 — 자세한 것은 앞 화면에 있다.`}</Caption>}
    </div>
  )
}

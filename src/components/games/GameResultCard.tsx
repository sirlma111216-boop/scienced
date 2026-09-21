import type { GameResult } from '@/lib/types'
import { Badge, Caption } from '@/components/ui'

/**
 * 발표자 결과 카드 — 학생 화면과 강사 화면이 같은 것을 본다 (8차 6.1).
 * 라이브러리 게임과 구슬 레이스가 함께 쓴다. 결과의 이유와 후보 수·씨앗을 그대로 남긴다.
 */
export function GameResultCard({ result, nameOf, uid }: { result: GameResult; nameOf: (uid: string) => string; uid?: string }) {
  return (
    <div className="card" style={{ marginTop: 12 }} aria-live="polite">
      <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
        <Caption>이번 발표자</Caption>
        {result.manual ? <Badge>강사 지정</Badge> : null}
        {result.fairness ? <Badge>{result.fairness}</Badge> : null}
      </div>
      {result.winnerUids.length === 0 ? (
        <p className="text-body" style={{ margin: '8px 0 0' }}>
          뽑힌 사람이 없다 — {result.reason}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-xs" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
          {result.winnerUids.map((w) => (
            <li key={w}>
              <span className="badge" style={w === uid ? { background: '#000', color: '#fff', boxShadow: 'none', fontSize: 15 } : { fontSize: 15 }}>
                {nameOf(w)}
                {w === uid ? ' (나)' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-body-sm" style={{ margin: '8px 0 0', opacity: 0.8 }}>
        {result.reason}
      </p>
      <Caption>
        후보 {result.candidateUids.length}명 · 씨앗 {result.seed}
      </Caption>
    </div>
  )
}

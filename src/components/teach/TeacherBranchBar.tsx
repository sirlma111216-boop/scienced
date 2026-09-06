import { useState } from 'react'
import { Badge, Button, Caption, Card } from '@/components/ui'

/**
 * 교사 분기 버튼.
 *
 * 응답 분포를 본 뒤 다음 행동을 고른다. 고른 뒤 근거를 적어야 기록된다.
 * 분기가 하나뿐이면 형성평가가 아니다 — 응답을 모으고 계획대로 가는 것과 같기 때문이다.
 */
export function TeacherBranchBar({
  branches,
  onPush,
}: {
  branches: string[]
  /** 학생 화면에 안내를 밀어 넣는다 */
  onPush: (branch: string, note: string) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const [note, setNote] = useState('')

  return (
    <Card>
      <div className="flex items-center gap-md" style={{ marginBottom: 12 }}>
        <h3 className="text-card-title" style={{ margin: 0 }}>
          다음 수를 두어라
        </h3>
        <Badge>{branches.length}개 준비됨</Badge>
      </div>
      <Caption>고르지 않는 것도 선택입니다. 다만 근거가 있어야 합니다.</Caption>

      <div className="flex flex-col gap-xs" style={{ marginTop: 16 }}>
        {branches.map((b) => (
          <button
            key={b}
            type="button"
            className="tab"
            data-selected={picked === b}
            aria-pressed={picked === b}
            onClick={() => setPicked(b)}
            style={{ textAlign: 'left', justifyContent: 'flex-start' }}
          >
            {b}
          </button>
        ))}
      </div>

      {picked ? (
        <div className="flex flex-col gap-xs" style={{ marginTop: 16 }}>
          <label htmlFor="branch-note" className="text-body-sm" style={{ fontWeight: 480 }}>
            이 수를 고른 근거 — 어느 응답 유형의 어떤 이유 때문인가
          </label>
          <textarea
            id="branch-note"
            className="field"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-xs">
            <Button
              disabled={!note.trim()}
              onClick={() => {
                onPush(picked, note.trim())
                setPicked(null)
                setNote('')
              }}
            >
              학생 화면에 안내 띄우기
            </Button>
            <Button variant="tertiary" onClick={() => setPicked(null)}>
              취소
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  )
}

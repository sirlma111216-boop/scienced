import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Button, Caption, Card, ColorBlock, Notice, ScrollX } from '@/components/ui'

/**
 * 마이크로티칭 코치.
 *
 * 관찰 코드 E·P·R·W·F·A·C 로 시간순 기록을 남긴다.
 * "좋았다/아쉬웠다" 대신 관찰한 교사 행동과 학생 반응을 적는다.
 * 의도를 추측하지 않고 시간·발화·산출물 증거를 인용한다.
 */

const CODES = [
  { key: 'E', label: '학생 생각을 끌어낸 발문과 실제 응답' },
  { key: 'P', label: '학생 발화를 다시 말하거나 서로 연결한 장면' },
  { key: 'R', label: '이유·증거·표상을 요구한 장면' },
  { key: 'W', label: '기다림 시간과 생각할 기회를 준 장면' },
  { key: 'F', label: '형성평가 증거 때문에 수업 행동이 바뀐 장면' },
  { key: 'A', label: '접근성·역할·발언 기회의 장벽 또는 지원' },
  { key: 'C', label: '과학적 정확성·모형의 한계·불확실성 처리' },
] as const

interface Note {
  id: string
  at: string
  code: string
  evidence: string
}

const STORAGE = 'sls.v1.microteaching'

/** 인상평을 거른다. 이 말들이 들어 있고 증거가 없으면 저장을 막는다. */
const IMPRESSION_WORDS = ['좋았', '아쉬웠', '잘했', '멋있', '재미있었', '훌륭']

export function Microteaching() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [at, setAt] = useState('')
  const [code, setCode] = useState<string>('E')
  const [evidence, setEvidence] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState('')
  const [diff, setDiff] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE}.${user?.uid ?? 'anon'}`)
      if (raw) {
        const p = JSON.parse(raw) as { notes: Note[]; plan: string; diff: string }
        setNotes(p.notes ?? [])
        setPlan(p.plan ?? '')
        setDiff(p.diff ?? '')
      }
    } catch {
      /* 무시 */
    }
  }, [user?.uid])

  function persist(next: Partial<{ notes: Note[]; plan: string; diff: string }>) {
    const data = { notes, plan, diff, ...next }
    if (next.notes) setNotes(next.notes)
    if (next.plan !== undefined) setPlan(next.plan)
    if (next.diff !== undefined) setDiff(next.diff)
    try {
      localStorage.setItem(`${STORAGE}.${user?.uid ?? 'anon'}`, JSON.stringify(data))
    } catch {
      /* 무시 */
    }
  }

  function add() {
    if (!at.trim()) {
      setError('시각을 적어 주세요. 예: 03:20')
      return
    }
    if (evidence.trim().length < 10) {
      setError('무엇을 보았는지 구체적으로 적어 주세요.')
      return
    }
    const hasImpression = IMPRESSION_WORDS.some((w) => evidence.includes(w))
    const hasEvidence = /\d|"|“|학생|말했|응답|썼|그렸|초|명/.test(evidence)
    if (hasImpression && !hasEvidence) {
      setError(
        '인상평만으로는 저장되지 않습니다. 시간·발화·산출물 증거를 함께 적어 주세요. ' +
          '예: “질문 뒤 대기시간이 1초여서 세 학생의 생각만 드러났다”',
      )
      return
    }
    setError(null)
    persist({
      notes: [...notes, { id: Date.now().toString(36), at: at.trim(), code, evidence: evidence.trim() }],
    })
    setAt('')
    setEvidence('')
  }

  return (
    <AppShell title="마이크로티칭">
      <p className="eyebrow">중간고사 이후</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        마이크로티칭 코치
      </h1>
      <p className="text-subhead" style={{ marginTop: 16, maxWidth: 760 }}>
        완성된 한 번의 시연보다, 증거를 보고 다시 가르친 경험이 PCK를 만듭니다.
      </p>

      <div style={{ marginTop: 32 }}>
        <Notice tone="cream">
          <p className="text-body-sm">
            영상은 본인과 참여자의 동의, 접근 권한, 보관 기간, 삭제 시점을 정한 뒤에만 올립니다.
            공개 포트폴리오에는 얼굴·이름·민감 정보를 넣지 않습니다.
          </p>
        </Notice>
      </div>

      <Card>
        <h2 className="text-card-title" style={{ margin: '0 0 12px' }}>
          관찰 기록
        </h2>
        <Caption>시각 + 코드 + 증거. “좋았다/아쉬웠다”는 쓰지 않습니다.</Caption>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(100px, 140px) minmax(160px, 220px) 1fr',
            gap: 12,
            marginTop: 16,
          }}
        >
          <div className="flex flex-col gap-xs">
            <label htmlFor="mt-at" className="text-body-sm" style={{ fontWeight: 480 }}>
              시각
            </label>
            <input
              id="mt-at"
              className="field"
              value={at}
              placeholder="03:20"
              onChange={(e) => setAt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor="mt-code" className="text-body-sm" style={{ fontWeight: 480 }}>
              코드
            </label>
            <select
              id="mt-code"
              className="field"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            >
              {CODES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.key} — {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor="mt-ev" className="text-body-sm" style={{ fontWeight: 480 }}>
              증거
            </label>
            <input
              id="mt-ev"
              className="field"
              value={evidence}
              placeholder="질문 뒤 대기시간이 1초여서 세 학생의 생각만 드러났다"
              onChange={(e) => setEvidence(e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-body-sm" style={{ fontWeight: 480, marginTop: 12 }}>
            ⚠ {error}
          </p>
        ) : null}

        <div className="flex items-center gap-md" style={{ marginTop: 16 }}>
          <Button onClick={add}>기록 추가</Button>
          <Badge>{notes.length}개</Badge>
        </div>

        {notes.length > 0 ? (
          <ScrollX>
            <table style={{ borderCollapse: 'collapse', minWidth: 600, marginTop: 16, width: '100%' }}>
              <thead>
                <tr>
                  {['시각', '코드', '증거', ''].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="caption"
                      style={{ textAlign: 'left', padding: '8px 12px 8px 0' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notes.map((n) => (
                  <tr key={n.id} style={{ boxShadow: 'inset 0 -1px 0 #f1f1f1' }}>
                    <td className="font-mono text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                      {n.at}
                    </td>
                    <td style={{ padding: '10px 12px 10px 0' }}>
                      <Badge>{n.code}</Badge>
                    </td>
                    <td className="text-body-sm" style={{ padding: '10px 12px 10px 0' }}>
                      {n.evidence}
                    </td>
                    <td style={{ padding: '10px 0' }}>
                      <Button
                        variant="tertiary"
                        onClick={() => persist({ notes: notes.filter((x) => x.id !== n.id) })}
                      >
                        지우기
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        ) : null}
      </Card>

      <div style={{ marginTop: 32 }}>
        <Card>
          <h2 className="text-card-title" style={{ margin: '0 0 12px' }}>
            재수업 계획과 전후 비교
          </h2>
          <Caption>한 번에 다 고치지 않습니다. 학습에 가장 큰 영향을 줄 한두 가지부터.</Caption>
          <div className="flex flex-col gap-lg" style={{ marginTop: 16 }}>
            <div className="flex flex-col gap-xs">
              <label htmlFor="mt-plan" className="text-body-sm" style={{ fontWeight: 480 }}>
                재수업에서 바꿀 한두 가지와 그 근거
              </label>
              <textarea
                id="mt-plan"
                className="field"
                rows={3}
                value={plan}
                onChange={(e) => persist({ plan: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="flex flex-col gap-xs">
              <label htmlFor="mt-diff" className="text-body-sm" style={{ fontWeight: 480 }}>
                수정 전후 학생 반응의 차이
              </label>
              <textarea
                id="mt-diff"
                className="field"
                rows={3}
                value={diff}
                placeholder="수정 전에는 ___였고, 수정 후에는 ___였다. 근거는 ___이다"
                onChange={(e) => persist({ diff: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 96 }}>
        <ColorBlock tone="coral">
          <p className="eyebrow">여섯 차례 초점</p>
          <ol className="text-body" style={{ marginTop: 16, paddingLeft: 20, maxWidth: 640 }}>
            <li>학생 생각 드러내기</li>
            <li>탐구 자료에서 패턴 찾게 하기</li>
            <li>모형·표상 번역 지도</li>
            <li>증거 기반 논증 촉진</li>
            <li>형성평가에 따라 즉시 대응하기</li>
            <li>통합 수업과 재수업</li>
          </ol>
        </ColorBlock>
      </div>
    </AppShell>
  )
}

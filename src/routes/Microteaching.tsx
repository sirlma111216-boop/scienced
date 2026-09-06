import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import {
  VideoAnnotator,
  type Annotation,
} from '@/components/microteaching/VideoAnnotator'
import { Button, Caption, Card, ColorBlock, Notice } from '@/components/ui'

/**
 * 마이크로티칭 코치.
 *
 * 관찰 코드 E·P·R·W·F·A·C 로 시간순 기록을 남기고, 1차 수업과 재수업을 나란히 놓는다.
 * 완성된 한 번의 시연보다 증거를 보고 다시 가르친 경험이 PCK를 만든다.
 *
 * 영상은 서버로 올라가지 않는다. 저장되는 것은 주석뿐이다 (VideoAnnotator 참고).
 */

const STORAGE = 'sls.v1.microteaching'

interface Stored {
  annotations: Annotation[]
  plan: string
  diff: string
  reflection: string
}

const EMPTY: Stored = { annotations: [], plan: '', diff: '', reflection: '' }

export function Microteaching() {
  const { user } = useAuth()
  const [data, setData] = useState<Stored>(EMPTY)
  const [phase, setPhase] = useState<'before' | 'after'>('before')

  const key = `${STORAGE}.${user?.uid ?? 'anon'}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) setData({ ...EMPTY, ...(JSON.parse(raw) as Stored) })
    } catch {
      /* 저장소가 막혀도 화면은 동작한다 */
    }
  }, [key])

  function patch(next: Partial<Stored>) {
    const merged = { ...data, ...next }
    setData(merged)
    try {
      localStorage.setItem(key, JSON.stringify(merged))
    } catch {
      /* 무시 */
    }
  }

  function download() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `microteaching-${user?.nickname || 'me'}.json`
    a.click()
    URL.revokeObjectURL(url)
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
          <p className="text-body-sm" style={{ margin: 0 }}>
            영상은 본인과 참여자의 동의, 접근 권한, 보관 기간, 삭제 시점을 정한 뒤에만 씁니다.
            공개 포트폴리오에는 얼굴·이름·민감 정보를 넣지 않습니다.
          </p>
        </Notice>
      </div>

      <div style={{ marginTop: 32 }}>
        <VideoAnnotator
          annotations={data.annotations}
          onChange={(a) => patch({ annotations: a })}
          phase={phase}
          onPhaseChange={setPhase}
        />
      </div>

      <div style={{ marginTop: 32 }}>
        <Card>
          <h2 className="text-card-title" style={{ margin: '0 0 12px' }}>
            재수업 계획과 성찰
          </h2>
          <Caption>한 번에 다 고치지 않습니다. 학습에 가장 큰 영향을 줄 한두 가지부터.</Caption>
          <div className="flex flex-col gap-lg" style={{ marginTop: 16 }}>
            {[
              {
                key: 'plan' as const,
                label: '재수업에서 바꿀 한두 가지와 그 근거',
                ph: '관찰 기록의 어느 줄을 근거로 삼았는지 함께 적습니다',
                rows: 3,
              },
              {
                key: 'diff' as const,
                label: '수정 전후 학생 반응의 차이',
                ph: '수정 전에는 ___였고, 수정 후에는 ___였다. 근거는 ___이다',
                rows: 3,
              },
              {
                key: 'reflection' as const,
                label: '계획한 것(pPCK)과 실제 일어난 것(ePCK)의 차이',
                ph: '‘느낀 점’이 아니라 목표·전략·증거·오류 원인·다음 행동을 적습니다',
                rows: 4,
              },
            ].map((f) => (
              <div key={f.key} className="flex flex-col gap-xs">
                <label htmlFor={`mt-${f.key}`} className="text-body-sm" style={{ fontWeight: 480 }}>
                  {f.label}
                </label>
                <textarea
                  id={`mt-${f.key}`}
                  className="field"
                  rows={f.rows}
                  value={data[f.key]}
                  placeholder={f.ph}
                  onChange={(e) => patch({ [f.key]: e.target.value })}
                  style={{ resize: 'vertical' }}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-xs no-print" style={{ marginTop: 16 }}>
            <Button variant="secondary" onClick={() => window.print()}>
              인쇄
            </Button>
            <Button variant="secondary" onClick={download}>
              내 기록 내려받기
            </Button>
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
          <p className="text-body-sm" style={{ marginTop: 24, maxWidth: 640 }}>
            피드백 문장 규칙 — “좋았다/아쉬웠다” 대신 관찰한 교사 행동과 학생 반응을 말합니다.
            의도를 추측하지 않고 시간·발화·산출물 증거를 인용합니다. 한 가지 수정이 학생 사고에
            미칠 예상 효과를 말하고, 마지막에 수업자의 수정 우선순위와 이유를 묻습니다.
          </p>
        </ColorBlock>
      </div>
    </AppShell>
  )
}

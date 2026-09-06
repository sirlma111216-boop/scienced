import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { CurriculumMap, type CurriculumMapValue } from '@/components/activity/CurriculumMap'
import { ColorBlock, Notice } from '@/components/ui'

/**
 * 교육과정 메타데이터 검색 (독립 화면).
 *
 * 6강 수업 중에도 쓰지만, 한 학기 내내 포트폴리오를 만들면서 다시 찾아오는 도구다.
 * 그래서 차시 밖에서도 열 수 있게 따로 둔다.
 */

const STORAGE = 'sls.v1.curriculum'

export function Curriculum() {
  const { user } = useAuth()
  const [value, setValue] = useState<CurriculumMapValue | null>(null)
  const key = `${STORAGE}.${user?.uid ?? 'anon'}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) setValue(JSON.parse(raw) as CurriculumMapValue)
    } catch {
      /* 저장소가 막혀도 검색은 된다 */
    }
  }, [key])

  function save(v: CurriculumMapValue) {
    setValue(v)
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* 무시 */
    }
  }

  return (
    <AppShell title="교육과정">
      <p className="eyebrow">한 학기 도구</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        교육과정 찾기
      </h1>
      <p className="text-subhead" style={{ marginTop: 16, maxWidth: 760 }}>
        학교급·영역·교육과정 판으로 성취기준을 찾고, 선수·후속 개념과 세 범주를 함께 봅니다.
      </p>

      <div style={{ marginTop: 24 }}>
        <Notice tone="cream">
          <p className="text-body-sm" style={{ margin: 0 }}>
            2026년 현재 학교에는 2022 개정 적용 학년과 이전 교육과정 적용 학년이 함께 있습니다.
            <strong> 단원 이름이 같아도 같은 교육과정이 아닙니다.</strong> 자료를 볼 때 발행 연도와
            적용 학년을 먼저 확인하세요.
          </p>
        </Notice>
      </div>

      <div style={{ marginTop: 32 }}>
        <CurriculumMap value={value} onChange={save} />
      </div>

      <div style={{ marginTop: 96 }}>
        <ColorBlock tone="lime">
          <p className="eyebrow">아직 원문 대조 전입니다</p>
          <p className="text-subhead" style={{ marginTop: 12, maxWidth: 720 }}>
            여기 실린 성취기준 문장은 전부 「대표 예시」입니다. NCIC 원문과 대조를 마친 항목만
            성취기준 코드가 붙습니다. 실제 수업 설계에 쓸 때는 반드시 원문을 확인하세요.
          </p>
        </ColorBlock>
      </div>
    </AppShell>
  )
}

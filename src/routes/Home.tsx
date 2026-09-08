import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LESSONS } from '@/content/lessons'
import type { LessonId } from '@/content/types'
import { useAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { Badge, Caption, ColorBlock } from '@/components/ui'

/**
 * 학기 홈.
 *
 * 공개된 차시만 보인다. 미공개 차시는 개수도 제목도 나가지 않는다.
 * 프론트에서 거르기만 하는 것이 아니라 Firestore 규칙에서도 막는다.
 */
export function Home() {
  const { user, repo, isInstructor, classId } = useAuth()
  const [published, setPublished] = useState<LessonId[]>([])

  useEffect(() => {
    if (!repo || !classId) return
    return repo.watchLessonState(classId, setPublished)
  }, [repo, classId])

  // 미공개 차시는 목록에서 통째로 뺀다. 강사에게만 전체가 보인다.
  const visible = isInstructor ? LESSONS : LESSONS.filter((l) => published.includes(l.id))

  return (
    <AppShell>
      <p className="eyebrow">한 학기</p>
      <h1 className="text-display-lg" style={{ margin: '12px 0 0' }}>
        {user?.nickname ? `${user.nickname} 님의 강의실` : '강의실'}
      </h1>
      <p className="text-subhead" style={{ marginTop: 16, maxWidth: 760 }}>
        오늘 적는 답은 지워지지 않습니다. 생각이 바뀌면 새 버전으로 쌓이고, 마지막 시간에 처음
        답과 나란히 놓고 비교합니다.
      </p>

      <section style={{ marginTop: 48 }}>
        <div className="flex items-baseline gap-md" style={{ marginBottom: 16 }}>
          <h2 className="text-card-title" style={{ margin: 0 }}>
            열린 차시
          </h2>
          <Caption>{visible.length}개</Caption>
        </div>

        {visible.length === 0 ? (
          <ColorBlock tone="cream">
            <p className="text-subhead" style={{ margin: 0 }}>
              아직 열린 차시가 없습니다. 강사가 열면 여기에 나타납니다.
            </p>
          </ColorBlock>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 16,
              /* 한 줄의 칸을 모두 같은 높이로 늘린다 — 제목 길이가 달라도 상자는 같다 */
              gridAutoRows: '1fr',
            }}
          >
            {visible.map((l) => {
              const open = published.includes(l.id)
              return (
                <li key={l.id} style={{ display: 'grid' }}>
                  <Link
                    to={`/lesson/${l.id}`}
                    className="tile"
                    style={{
                      /*
                       * 칸을 세로 flex 로 두고 마지막 줄(모듈 이름)을 바닥에 붙인다.
                       * 제목이 한 줄인 차시와 두 줄인 차시의 상자 높이가 달라 보이던 것을 막는다.
                       */
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <div className="flex items-center gap-xs" style={{ marginBottom: 8 }}>
                      <span className="font-mono text-caption">{l.id}강</span>
                      {!open ? <Badge>미공개</Badge> : null}
                    </div>
                    <p className="text-card-title" style={{ margin: 0 }}>
                      {l.title}
                    </p>
                    <p className="text-body-sm" style={{ marginTop: 8, opacity: 0.78 }}>
                      {l.centralQuestion}
                    </p>
                    {/* 소요 시간은 붙이지 않는다 (3차 D). */}
                    <p className="caption" style={{ marginTop: 'auto', paddingTop: 12, opacity: 0.6 }}>
                      {l.moduleName}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div style={{ marginTop: 96 }}>
        <ColorBlock tone="lilac">
          <p className="eyebrow">한 학기 산출물</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 24,
              marginTop: 24,
            }}
          >
            <Link to="/portfolio" style={{ color: 'inherit' }}>
              <p className="text-headline" style={{ margin: 0 }}>
                수업설계 포트폴리오
              </p>
              <p className="text-body-sm" style={{ marginTop: 8 }}>
                초안 – 피드백 – 수정본 – 성찰을 한 묶음으로
              </p>
            </Link>
            <Link to="/concept-map" style={{ color: 'inherit' }}>
              <p className="text-headline" style={{ margin: 0 }}>
                개념 연결 지도
              </p>
              <p className="text-body-sm" style={{ marginTop: 8 }}>
                선행개념 – 목표 – 모형 – 담화 – 평가 – PCK
              </p>
            </Link>
            <Link to="/curriculum" style={{ color: 'inherit' }}>
              <p className="text-headline" style={{ margin: 0 }}>
                교육과정 찾기
              </p>
              <p className="text-body-sm" style={{ marginTop: 8 }}>
                성취기준 · 핵심 아이디어 · 선수와 후속 개념
              </p>
            </Link>
            <Link to="/microteaching" style={{ color: 'inherit' }}>
              <p className="text-headline" style={{ margin: 0 }}>
                마이크로티칭
              </p>
              <p className="text-body-sm" style={{ marginTop: 8 }}>
                관찰 코드 E·P·R·W·F·A·C 와 재수업 기록
              </p>
            </Link>
          </div>
        </ColorBlock>
      </div>
    </AppShell>
  )
}

import { Link, NavLink } from 'react-router-dom'
import type { ClassDoc } from '@/lib/types'
import { Badge, Caption } from '@/components/ui'

/**
 * 클래스 관리의 머리 — 강사 화면에서 수업이 아닌 일은 전부 여기 탭 셋 안에 있다 (강의자 지시 2026-09-21).
 *
 * 강사 홈은 차시 목록 하나다. 명단·모둠·등록 마감·보관·지우기가 홈에서 수업 열기와 같은 크기로 놓여 있어
 * 「뭘 먼저 눌러야 하나」가 됐다. 학기에 한 번 쓰는 것은 한 자리에 모으고, 홈에는 매주 쓰는 것만 둔다.
 */
export const CLASS_ADMIN_TABS = [
  { to: 'students', label: '수강생 명단' },
  { to: 'groups', label: '모둠' },
  { to: 'settings', label: '클래스 설정' },
] as const

export function ClassAdminHeader({ classId, cls, here }: { classId: string; cls: ClassDoc | null; here: (typeof CLASS_ADMIN_TABS)[number]['to'] }) {
  return (
    <div className="no-print">
      <Link to="/instructor/classes" className="btn-tertiary" style={{ paddingLeft: 0 }}>
        ← 수업으로
      </Link>
      <h1 className="text-display-lg" style={{ margin: '8px 0 0' }}>
        클래스 관리
      </h1>
      <div className="flex items-center gap-xs" style={{ marginTop: 10, flexWrap: 'wrap' }}>
        <span className="text-body-lg">{cls?.displayName ?? classId}</span>
        {cls?.status === 'archived' ? <Badge>보관됨 · 읽기 전용</Badge> : cls?.enrollmentOpen ? <Badge solid>등록 열림</Badge> : <Badge>등록 마감</Badge>}
        {cls ? <Caption>코드 {cls.joinCode}</Caption> : null}
      </div>
      <nav aria-label="클래스 관리" className="flex gap-xxs" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        {CLASS_ADMIN_TABS.map((t) => (
          <NavLink key={t.to} to={`/instructor/class/${classId}/${t.to}`} className="tab" aria-current={t.to === here ? 'page' : undefined} style={t.to === here ? { background: '#000', color: '#fff' } : undefined}>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

import { NavLink } from 'react-router-dom'

const links = [
  { to: '/portfolio', label: '포트폴리오', tone: 'study' },
  { to: '/concept-map', label: '개념 지도', tone: 'study' },
  { to: '/curriculum', label: '교육과정', tone: 'study' },
  { to: '/textbook', label: '교과서', tone: 'study' },
  { to: '/microteaching', label: '마이크로티칭', tone: 'teaching' },
  { to: '/microteaching/apply', label: '발표 신청', tone: 'teaching' },
  { to: '/microteaching/record', label: '발표 기록', tone: 'teaching' },
] as const

export function FooterNav() {
  return (
    <nav aria-labelledby="footer-menu-title">
      <h2 id="footer-menu-title" className="footer-menu-title">주요 메뉴</h2>
      <ul className="footer-menu-list">
        {links.map(({ to, label, tone }) => (
          <li key={to}>
            <NavLink to={to} end className="footer-menu-link" data-tone={tone}>
              {({ isActive }) => (
                <>
                  <span>{label}</span>
                  <span className="footer-menu-status" aria-hidden="true">
                    {isActive ? '현재 페이지' : '이동 →'}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

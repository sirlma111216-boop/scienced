import { NavLink } from 'react-router-dom'

import { useAuth } from '@/lib/auth'

export function FooterNav() {
  const { isInstructor, user } = useAuth()
  const links = [
  { to: '/curriculum', label: '교육과정', tone: 'study' },
  { to: '/textbook', label: '교과서', tone: 'study' },
  ...(isInstructor || !user ? [{ to: '/microteaching', label: '마이크로티칭', tone: 'teaching' }] : [
    { to: '/microteaching/mine', label: '나의 마이크로티칭', tone: 'teaching' },
    { to: '/microteaching/feedback', label: '마이크로티칭 피드백', tone: 'teaching' },
  ]),
  { to: '/microteaching/apply', label: '발표 신청', tone: 'teaching' },
]
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

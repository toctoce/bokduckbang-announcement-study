import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { BrandLink } from '../../BrandLink'
import { useAdminAuth } from './useAdminAuth'
import styles from './AdminLayout.module.css'

export function AdminLayout() {
  const { logout, session } = useAdminAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [error, setError] = useState<string | null>(null)

  function handleLogout() {
    void signOut()
  }

  async function signOut() {
    setError(null)
    try {
      await logout()
      navigate('/admin/login', { replace: true })
    } catch (requestError) {
      if (requestError instanceof Error) {
        setError(requestError.message)
      }
      if (!(requestError instanceof Error)) {
        setError('로그아웃 요청을 처리하지 못했습니다.')
      }
    }
  }

  return (
    <div className={`admin-layout ${styles.layout}`}><a className="admin-skip" href="#admin-main">본문으로 건너뛰기</a>
      <header className={`admin-header ${styles.header}`}>
        <div className="admin-brand">
          <BrandLink />
          <span className="admin-brand-context">관리자 작업 공간</span>
        </div>
        <div className="admin-header-account">
          <span>{session?.loginIdentifier}</span>
          <button onClick={handleLogout} type="button">로그아웃</button>
        </div>
      </header>
      {error ? <p className="form-error admin-layout-error">{error}</p> : null}
      <nav className={`admin-navigation ${styles.navigation}`} aria-label="관리자 메뉴">
        <div className={styles.intro}><strong>데이터 관리</strong><p>정보를 확인하고<br />공식 근거로 보완하세요.</p></div>
        <div className="admin-nav-group"><span>검토 작업</span>
          <NavLink to="/admin/complexes">단지 관리</NavLink>
          <NavLink to="/admin/announcements">공고 관리</NavLink>
          <NavLink to="/admin/complex-coverage">단지 누락 대조</NavLink>
        </div>
        <details className={styles.tools} open={['/admin/ingest', '/admin/sources', '/admin/failures', '/admin/locations'].some(path => pathname.startsWith(path))}><summary>수집·운영 도구</summary><div className="admin-nav-group"><span>수집 운영</span>
          <NavLink to="/admin/ingest">수집·정제</NavLink>
          <NavLink to="/admin/ingest-v2">수집·정제 v2</NavLink>
          <NavLink to="/admin/sources">원천 데이터</NavLink>
          <NavLink to="/admin/failures">실패·검토 항목</NavLink>
          <NavLink to="/admin/locations">주소 데이터</NavLink>
        </div></details>
        <div className="admin-nav-group"><span>알림 운영</span>
          <NavLink to="/admin/notification-cancellations">알림 취소 요청</NavLink>
        </div>
        <div className="admin-nav-group"><span>회원 운영</span>
          <NavLink to="/admin/users">회원 관리</NavLink>
        </div>
        <div className="admin-nav-group"><span>고객 의견</span>
          <NavLink to="/admin/feedback">사용자 의견</NavLink>
        </div>
      </nav>
      <main className={`admin-content ${styles.content}`} id="admin-main">
        <Outlet />
      </main>
    </div>
  )
}

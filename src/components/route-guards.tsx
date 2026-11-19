import { Navigate, Outlet, useLocation } from 'react-router'

import { useMe } from '@/api/me'
import { ForbiddenPage } from '@/pages/status-pages'

/** 로그인 필요 구간. 로그인 안 했으면 로그인 화면으로 보내고, 돌아올 경로를 state.from에 남긴다 */
export function RequireLogin() {
  const me = useMe()
  const location = useLocation()
  if (me.data === null) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** 관리자 구간. 화면만 가리고, 최종 권한 확인은 백엔드가 한다 */
export function RequireAdmin() {
  const me = useMe()
  return me.data?.role === 'ADMIN' ? <Outlet /> : <ForbiddenPage />
}

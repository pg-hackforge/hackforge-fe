import { Link, NavLink, Outlet } from 'react-router'

import type { UserResponse } from '@/api/generated/types.gen'
import { useMe } from '@/api/me'
import { Logo } from '@/components/logo'
import { ModeToggle } from '@/components/mode-toggle'
import { buttonVariants } from '@/components/ui/button'
import { UserMenu } from '@/components/user-menu'
import { cn } from '@/lib/utils'
import { BackendDownPage } from '@/pages/status-pages'

const MENU = [
  { to: '/', label: '홈', end: true },
  { to: '/problems', label: '문제' },
  { to: '/records', label: '내 기록' },
]

/** 모든 화면의 틀: 상단 줄, 계정 안내 띠, 본문. 내 계정을 아직 모르면 본문을 그리지 않는다 */
export function AppLayout() {
  const me = useMe()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b bg-card px-4 sm:gap-6 sm:px-6">
        <Link to="/" aria-label="Hackforge 홈" className="rounded-md">
          <Logo compact />
        </Link>
        {me.data && <MainMenu me={me.data} />}
        <div className="ml-auto flex items-center gap-2">
          {me.data ? (
            <UserMenu me={me.data} />
          ) : me.data === null ? (
            <>
              <ModeToggle />
              <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                로그인
              </Link>
              <Link to="/signup" className={buttonVariants({ size: 'sm' })}>
                가입 신청
              </Link>
            </>
          ) : null}
        </div>
      </header>
      {me.data && <AccountBanner status={me.data.status} />}
      <main className="flex flex-1 flex-col">
        {me.isError ? <BackendDownPage /> : me.isPending ? null : <Outlet />}
      </main>
    </div>
  )
}

function MainMenu({ me }: { me: UserResponse }) {
  const items = me.role === 'ADMIN' ? [...MENU, { to: '/admin', label: '관리' }] : MENU
  return (
    <nav aria-label="주 메뉴" className="flex items-center gap-0.5 text-sm sm:gap-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={'end' in item}
          className={({ isActive }) =>
            cn(
              'rounded-md px-2 py-1 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground sm:px-2.5',
              isActive && 'bg-muted text-foreground',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** 승인 대기·거절 계정 안내. 실습 시작만 막히고 문제 목록은 볼 수 있다(openapi.yaml) */
function AccountBanner({ status }: { status: UserResponse['status'] }) {
  if (status === 'APPROVED') return null
  return (
    <div role="status" className="border-b bg-muted px-4 py-2 text-center text-sm sm:px-6">
      {status === 'PENDING'
        ? '승인 대기 중입니다. 관리자가 승인하면 실습을 시작할 수 있습니다. 문제는 지금도 볼 수 있습니다.'
        : '가입이 거절되었습니다. 실습을 시작할 수 없습니다. 문의는 관리자에게 해 주세요.'}
    </div>
  )
}

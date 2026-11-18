import { useMe } from '@/api/me'
import { Logo } from '@/components/logo'
import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'

const ROLE = { LEARNER: '학습자', AUTHOR: '출제자', ADMIN: '관리자' } as const
const STATUS = { PENDING: '승인 대기', APPROVED: '승인됨', REJECTED: '거절됨' } as const

/** 개발 백엔드에 붙었는지 보여 준다(GET /api/me). 앱 틀 작업에서 상단바 사용자 메뉴로 옮긴다 */
function SessionStatus() {
  const me = useMe()
  if (me.isPending)
    return <p className="text-subtle-foreground">개발 백엔드를 확인하고 있습니다…</p>
  if (me.isError)
    return (
      <div className="space-y-1">
        <p className="text-fail">
          백엔드에 연결할 수 없습니다. 개발 백엔드(127.0.0.1:8080)가 켜져 있는지 확인해 주세요.
        </p>
        <p className="text-muted-foreground">
          백엔드 없이 화면만 보려면 <code className="font-mono">npm run dev:mock</code>으로
          실행하세요.
        </p>
      </div>
    )
  if (me.data === null) return <p className="text-muted-foreground">로그인하지 않은 상태입니다.</p>
  return (
    <p className="text-foreground">
      {me.data.nickname}님 · {ROLE[me.data.role]} · {STATUS[me.data.status]}
    </p>
  )
}

/** 시작 화면. 확정 색(흑연과 불씨)과 로고, 백엔드 연결 상태를 확인한다. 앱 틀(레이아웃, 라우팅)은 fe 초기 구성 작업 5에서 만든다 */
export default function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between border-b bg-card px-4 sm:px-6">
        <Logo />
        <ModeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-md space-y-6 text-center">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              공격하고, 고치고, 검증한다
            </h1>
            <p className="text-pretty text-muted-foreground">
              웹 보안 공격·방어 실습 플랫폼 Hackforge의 화면을 준비하고 있습니다.
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button>가입 신청</Button>
            <Button variant="outline">로그인</Button>
          </div>
          <div className="flex justify-center gap-2 text-xs font-semibold">
            <span className="rounded-md border border-pass px-2 py-0.5 text-pass">PASS</span>
            <span className="rounded-md bg-fail px-2 py-0.5 text-fail-foreground">FAIL</span>
          </div>
          <div className="text-sm">
            <SessionStatus />
          </div>
        </div>
      </main>
    </div>
  )
}

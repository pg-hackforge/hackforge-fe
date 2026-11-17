import { Logo } from '@/components/logo'
import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'

/** 시작 화면. 확정 색(흑연과 불씨)과 로고를 라이트·다크에서 확인한다. 앱 틀(레이아웃, 라우팅)은 fe 초기 구성 작업 5에서 만든다 */
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
        </div>
      </main>
    </div>
  )
}

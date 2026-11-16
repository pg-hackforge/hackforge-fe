import { ModeToggle } from '@/components/mode-toggle'

/** 시작 화면. 앱 틀(레이아웃, 라우팅)은 fe 초기 구성 작업 5에서 만든다 */
export default function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4 sm:px-6">
        <span className="text-sm font-semibold">Hackforge</span>
        <ModeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            공격하고, 고치고, 검증한다
          </h1>
          <p className="text-pretty text-muted-foreground">
            웹 보안 공격·방어 실습 플랫폼 Hackforge의 화면을 준비하고 있습니다.
          </p>
        </div>
      </main>
    </div>
  )
}

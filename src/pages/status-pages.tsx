import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Button, buttonVariants } from '@/components/ui/button'

/** 본문 가운데 큰 숫자(또는 표시)와 제목, 설명, 버튼 */
function StatusPage(props: {
  mark: string
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md space-y-4 text-center">
        <p className="font-mono text-sm font-semibold tracking-widest text-primary">{props.mark}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{props.title}</h1>
        <div className="text-pretty text-muted-foreground">{props.children}</div>
        {props.action && <div className="pt-2">{props.action}</div>}
      </div>
    </div>
  )
}

const homeButton = (
  <Link to="/" className={buttonVariants({ variant: 'outline' })}>
    홈으로
  </Link>
)

export function NotFoundPage() {
  return (
    <StatusPage mark="404" title="페이지를 찾을 수 없습니다" action={homeButton}>
      주소가 바뀌었거나 없는 페이지입니다.
    </StatusPage>
  )
}

export function ForbiddenPage() {
  return (
    <StatusPage mark="403" title="접근 권한이 없습니다" action={homeButton}>
      이 화면은 관리자만 볼 수 있습니다.
    </StatusPage>
  )
}

export function BackendDownPage() {
  return (
    <StatusPage
      mark="연결 실패"
      title="백엔드에 연결할 수 없습니다"
      action={<Button onClick={() => window.location.reload()}>다시 시도</Button>}
    >
      <p>서버가 꺼져 있거나 네트워크에 문제가 있습니다. 잠시 뒤 다시 시도해 주세요.</p>
      {import.meta.env.DEV && (
        <p className="mt-3 text-sm">
          개발 중이면 개발 백엔드(127.0.0.1:8080)가 켜져 있는지 확인하거나,{' '}
          <code className="font-mono whitespace-nowrap">npm run dev:mock</code>으로 백엔드 없이
          실행하세요.
        </p>
      )}
    </StatusPage>
  )
}

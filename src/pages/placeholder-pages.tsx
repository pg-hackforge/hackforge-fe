import { Link } from 'react-router'

import { useMe } from '@/api/me'
import { buttonVariants } from '@/components/ui/button'
import { HomePage } from '@/pages/home-page'

/** 아직 만들지 않은 화면의 자리. 각 화면은 기능별 이슈에서 채운다 */
function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{note}</p>
    </div>
  )
}

/** `/`: 로그인 전에는 소개 화면, 로그인 후에는 홈 */
export function IndexPage() {
  const me = useMe()
  return me.data ? <HomePage me={me.data} /> : <LandingPage />
}

function LandingPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md space-y-6 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            공격하고, 고치고, 검증한다
          </h1>
          <p className="text-pretty text-muted-foreground">
            웹 보안 공격과 방어를 직접 해 보는 실습 플랫폼이에요. 소개 화면은 따로 만들어요.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Link to="/signup" className={buttonVariants()}>
            회원가입
          </Link>
          <Link to="/login" className={buttonVariants({ variant: 'outline' })}>
            로그인
          </Link>
        </div>
      </div>
    </div>
  )
}

/** `/labs/:id` 실습 화면 자리(hackforge-docs specs/lab-ui 작업 5에서 만듦) */
export const LabPage = () => <Placeholder title="실습" note="실습 화면은 다음 작업에서 만들어요." />

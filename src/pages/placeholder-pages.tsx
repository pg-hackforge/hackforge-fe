import { Link } from 'react-router'

import { useMe } from '@/api/me'
import { buttonVariants } from '@/components/ui/button'

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
  return me.data ? <HomePage nickname={me.data.nickname} /> : <LandingPage />
}

function HomePage({ nickname }: { nickname: string }) {
  return (
    <Placeholder
      title={`안녕하세요, ${nickname}님`}
      note="홈 화면은 문제 목록 이슈에서 만들어요."
    />
  )
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

export const LoginPage = () => (
  <Placeholder title="로그인" note="로그인 화면은 계정 화면 이슈에서 만들어요." />
)
export const SignupPage = () => (
  <Placeholder title="회원가입" note="회원가입 화면은 계정 화면 이슈에서 만들어요." />
)
export const ProblemsPage = () => (
  <Placeholder title="문제" note="문제 목록은 문제 목록 이슈에서 만들어요." />
)
export const RecordsPage = () => (
  <Placeholder title="내 기록" note="내 기록은 실습 기록 이슈에서 만들어요." />
)
export const AccountPage = () => (
  <Placeholder title="내 정보" note="내 정보 보기와 비밀번호 변경은 계정 화면 이슈에서 만들어요." />
)
export const AdminPage = () => (
  <Placeholder title="회원 관리" note="가입 승인과 권한 변경은 계정 화면 이슈에서 만들어요." />
)

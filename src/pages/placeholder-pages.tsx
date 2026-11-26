import { useMe } from '@/api/me'
import { HomePage } from '@/pages/home-page'
import { LandingPage } from '@/pages/landing-page'

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

/** `/labs/:id` 실습 화면 자리(hackforge-docs specs/lab-ui 작업 5에서 만듦) */
export const LabPage = () => <Placeholder title="실습" note="실습 화면은 다음 작업에서 만들어요." />

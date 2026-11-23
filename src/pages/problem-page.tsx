import { Dialog } from '@base-ui/react/dialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, ClockIcon, Maximize2Icon, XIcon } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'

import { ApiError } from '@/api/errors'
import {
  getChallengeOptions,
  getCurrentLabQueryKey,
} from '@/api/generated/@tanstack/react-query.gen'
import { useCurrentLab } from '@/api/labs'
import { startLab } from '@/api/generated/sdk.gen'
import { useMe } from '@/api/me'
import { FormAlert } from '@/components/form'
import { Markdown } from '@/components/markdown'
import { Button, buttonVariants } from '@/components/ui/button'
import { NotFoundPage } from '@/pages/status-pages'
import { Difficulty, MyStatus } from '@/pages/problems-page'
import { cn } from '@/lib/utils'

/** 실습 시작이 거절된 이유 */
function startErrorText(error: Error) {
  if (!(error instanceof ApiError)) return error.message
  if (error.code === 'LAB_CAPACITY_FULL')
    return '지금은 실습 자리가 모두 찼어요. 잠시 뒤 다시 시도해 주세요.'
  if (error.code === 'ACCOUNT_NOT_APPROVED') return '가입이 승인되면 실습을 시작할 수 있어요.'
  if (error.code === 'LAB_ALREADY_ACTIVE')
    return '이미 진행 중인 실습이 있어요. 그 실습을 끝내면 새로 시작할 수 있어요.'
  return error.message
}

/** `/problems/:id` 문제 상세와 실습 시작(ADR 027). 시작하면 `/labs/:id`로 간다 */
export function ProblemPage() {
  const id = Number(useParams().id)
  const challenge = useQuery({
    ...getChallengeOptions({ path: { id } }),
    enabled: Number.isInteger(id),
  })
  const currentLab = useCurrentLab().data

  if (
    !Number.isInteger(id) ||
    (challenge.error instanceof ApiError && challenge.error.code === 'CHALLENGE_NOT_FOUND')
  )
    return <NotFoundPage />
  const c = challenge.data

  return (
    <div className="mx-auto w-full max-w-310 px-4 pt-8 pb-14 sm:px-6">
      <Link
        to="/problems"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        문제 목록
      </Link>
      {challenge.isError && (
        <FormAlert tone="error">문제를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</FormAlert>
      )}
      {c && (
        <div className="mt-4 grid grid-cols-[1fr_320px] items-start gap-8">
          <article className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[13px] text-muted-foreground">
              No.{c.id}
              {c.isNew && (
                <span className="rounded border border-foreground/70 px-1 font-sans text-[10px] leading-3.5 font-bold text-foreground">
                  NEW
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{c.title}</h1>
            <p className="mt-2 max-w-160 text-muted-foreground">{c.summary}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-b pb-5 text-sm">
              <span className="rounded-md border px-2 py-0.5 text-xs">{c.category.name}</span>
              <Difficulty value={c.difficulty} />
              <span className="flex items-center gap-1.5">
                <ClockIcon className="size-4 text-muted-foreground" aria-hidden />
                예상 {c.estimatedMinutes}분
              </span>
              <MyStatus value={c.myStatus} active={currentLab?.challengeId === c.id} />
            </div>
            <Markdown className="mt-6 max-w-160">{c.description}</Markdown>
          </article>
          <aside className="sticky top-20 rounded-xl border bg-card p-5">
            <StartPanel challengeId={c.id} />
          </aside>
        </div>
      )}
    </div>
  )
}

/**
 * 문제 목록 오른쪽에서 열리는 상세 패널(시안 `main/07-problem-detail`).
 * 목록을 떠나지 않고 보고 시작하며, [크게 보기]는 상세 페이지로 간다
 */
export function ProblemDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const challenge = useQuery(getChallengeOptions({ path: { id } }))
  const currentLab = useCurrentLab().data
  const c = challenge.data
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-x-0 top-12 bottom-0 z-30 bg-terminal/20 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-terminal/50" />
        <Dialog.Popup className="fixed top-12 right-0 bottom-0 z-30 flex w-[min(480px,100vw)] flex-col border-l bg-card shadow-[-20px_0_40px_-30px_rgba(0,0,0,.4)] transition-transform outline-none data-ending-style:translate-x-6 data-starting-style:translate-x-6">
          <div className="flex items-center gap-1 px-6 pt-5">
            <span className="font-mono text-[13px] text-muted-foreground">No.{id}</span>
            <Link
              to={`/problems/${id}`}
              className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Maximize2Icon className="size-3.5" aria-hidden />
              크게 보기
            </Link>
            <Dialog.Close
              aria-label="닫기"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            {challenge.isError && (
              <FormAlert tone="error">
                문제를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.
              </FormAlert>
            )}
            {c && (
              <>
                <Dialog.Title className="mt-1 text-[22px] font-semibold tracking-tight">
                  {c.title}
                  {c.isNew && (
                    <span className="ml-2 inline-block rounded border border-foreground/70 px-1 align-middle text-[10px] leading-3.5 font-bold">
                      NEW
                    </span>
                  )}
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                  {c.summary}
                </Dialog.Description>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-4 text-sm">
                  <span className="rounded-md border px-2 py-0.5 text-xs">{c.category.name}</span>
                  <Difficulty value={c.difficulty} />
                  <span className="flex items-center gap-1.5">
                    <ClockIcon className="size-4 text-muted-foreground" aria-hidden />
                    예상 {c.estimatedMinutes}분
                  </span>
                  <MyStatus value={c.myStatus} active={currentLab?.challengeId === c.id} />
                </div>
                <Markdown className="mt-5 text-sm">{c.description}</Markdown>
              </>
            )}
          </div>
          {c && (
            <div className="border-t px-6 py-4">
              <StartPanel challengeId={c.id} />
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** 실습 시작 안내와 버튼. 진행 중인 실습이 있으면 그쪽으로 안내한다 */
function StartPanel({ challengeId }: { challengeId: number }) {
  const approved = useMe().data?.status === 'APPROVED'
  const currentLab = useCurrentLab().data
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const start = useMutation({
    mutationFn: async () => (await startLab({ body: { challengeId }, throwOnError: true })).data,
    onSuccess: (lab) => navigate(`/labs/${lab.id}`),
    // 진행 중 세션이 있다고 하면 그 세션을 다시 읽어 안내에 쓴다
    onError: () => queryClient.invalidateQueries({ queryKey: getCurrentLabQueryKey() }),
  })
  const error = start.error ? startErrorText(start.error) : undefined
  if (currentLab?.challengeId === challengeId)
    return (
      <>
        <p className="font-semibold">이 문제를 실습 중이에요</p>
        <p className="mt-1 text-sm text-muted-foreground">하던 실습으로 돌아가요.</p>
        <Link to={`/labs/${currentLab.id}`} className={cn(buttonVariants(), 'mt-4 w-full')}>
          실습으로 돌아가기
        </Link>
      </>
    )
  if (currentLab)
    return (
      <>
        <p className="font-semibold">다른 실습이 진행 중이에요</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentLab.challengeTitle} 실습을 끝내면 이 문제를 시작할 수 있어요. 실습은 한 번에
          하나만 해요.
        </p>
        <Link
          to={`/labs/${currentLab.id}`}
          className={cn(buttonVariants({ variant: 'outline' }), 'mt-4 w-full')}
        >
          진행 중인 실습으로
        </Link>
      </>
    )
  return (
    <>
      <p className="font-semibold">전용 실습 환경을 만들어요</p>
      <p className="mt-1 text-sm text-muted-foreground">
        준비에 1분 정도 걸려요. 30분 동안 아무 입력이 없으면 자동으로 끝나요.
      </p>
      {error && <FormAlert tone="error">{error}</FormAlert>}
      {!approved && <FormAlert tone="info">가입이 승인되면 실습을 시작할 수 있어요.</FormAlert>}
      <Button
        className="mt-4 w-full"
        disabled={!approved || start.isPending}
        onClick={() => start.mutate()}
      >
        {start.isPending ? '시작하는 중…' : '실습 시작'}
      </Button>
    </>
  )
}

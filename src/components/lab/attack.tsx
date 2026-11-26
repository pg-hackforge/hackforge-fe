import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LoaderCircleIcon, LockIcon, XIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { ApiError } from '@/api/errors'
import { listLabHintsQueryKey } from '@/api/generated/@tanstack/react-query.gen'
import { revealAttackHint, revealDefenseHint, skipAttack } from '@/api/generated/sdk.gen'
import { useHints } from '@/api/labs'
import type {
  LabSessionResponse,
  LabStage,
  VerificationResponse,
  VerificationStatus,
  VerificationType,
} from '@/api/generated/types.gen'
import { ActionButton, CancelButton, Dialog, DialogText } from '@/components/dialog'
import { FormAlert } from '@/components/form'
import { useAutoDismiss } from '@/components/lab/auto-dismiss'
import { Markdown } from '@/components/markdown'
import { Button } from '@/components/ui/button'
import { clockTime, hintTitle } from '@/lib/lab'
import { cn } from '@/lib/utils'

/** 작업 영역의 패널 한 면 */
export function Panel({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn('h-full overflow-auto rounded-xl border bg-card', className)}>
      {children}
    </div>
  )
}

/** 판정 표시(DESIGN.md: PASS는 초록 테두리, FAIL은 빨강 채움) */
export function Verdict({ status, className }: { status: VerificationStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center rounded-md px-2 font-mono text-[12px] font-bold',
        status === 'RUNNING' && 'font-sans font-semibold',
        status === 'PASS' && 'border border-pass text-pass',
        status === 'FAIL' && 'bg-fail text-fail-foreground',
        status === 'ERROR' && 'border text-muted-foreground',
        status === 'RUNNING' && 'border border-dashed text-muted-foreground',
        className,
      )}
    >
      {status === 'RUNNING' ? '검증 중' : status}
    </span>
  )
}

/** 상단 줄의 주 버튼 [공격 검증 요청]·[방어 검증 요청]. Ctrl+Enter로도 누른다(터미널 안에서는 셸 입력이라 제외) */
export function VerifyButton({
  type,
  busy,
  onClick,
}: {
  type: VerificationType
  busy: boolean
  onClick: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey && event.key === 'Enter') || busy) return
      if (event.target instanceof Element && event.target.closest('.xterm')) return
      event.preventDefault()
      onClick()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClick])
  return (
    <Button size="sm" disabled={busy} onClick={onClick} className="gap-2">
      {busy ? (
        <>
          <Spinner />
          검증 중…
        </>
      ) : (
        <>
          {type === 'ATTACK' ? '공격 검증 요청' : '방어 검증 요청'}
          <kbd className="rounded bg-primary-foreground/15 px-1.5 font-mono text-[10.5px] font-medium">
            Ctrl ↵
          </kbd>
        </>
      )}
    </Button>
  )
}

/** 실행 중 표시. 움직임 줄이기를 켠 사용자에게는 느리게 돈다 */
export function Spinner() {
  return (
    <LoaderCircleIcon
      className="size-4 animate-spin motion-reduce:[animation-duration:3s]"
      aria-hidden
    />
  )
}

/** 검증 요청이 거절된 이유 */
function verifyErrorText(error: Error) {
  if (error instanceof ApiError && error.code === 'LAB_JOB_RUNNING')
    return '다른 검증이나 작업이 실행 중이에요. 끝난 뒤 다시 요청해 주세요.'
  return '검증 결과를 받지 못했어요. 기록에서 결과를 확인하거나 다시 요청해 주세요.'
}

/** 작업 영역 위의 결과 안내 띠. 10초 뒤 저절로 닫히고, 결과는 기록에서 다시 본다 */
export function VerifyNotice({
  result,
  error,
  onOpenRecords,
  onDismiss,
}: {
  result: VerificationResponse | null
  error: Error | null
  onOpenRecords: () => void
  onDismiss: () => void
}) {
  const autoDismiss = useAutoDismiss(result ?? error, onDismiss)
  if (!result && !error) return null
  let text: ReactNode
  const defense = result?.type === 'DEFENSE'
  if (!result) text = verifyErrorText(error!)
  else if (result.status === 'PASS')
    // 공격 검증 버튼은 공격 단계에만 있어서 PASS면 방어 단계로 넘어간다
    text = defense
      ? '방어에 성공했어요. 공격은 막히고 정상 기능은 그대로예요.'
      : '공격에 성공했어요. 이제 방어 단계예요. 코드를 고쳐 같은 공격을 막아요.'
  else if (result.status === 'FAIL')
    text = defense ? '아직 통과하지 못했어요.' : '아직 공격이 확인되지 않았어요.'
  else text = '플랫폼 문제로 검증을 실행하지 못했어요. 잠시 뒤 다시 요청해 주세요.'
  return (
    <div
      role="status"
      {...autoDismiss}
      className={cn(
        'mb-3 flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm',
        result?.status === 'PASS' && 'border-pass/50',
        result?.status === 'FAIL' && 'border-fail/50',
      )}
    >
      {result && <Verdict status={result.status} />}
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{text}</b>
        {result?.message && <span className="ml-2 text-muted-foreground">{result.message}</span>}
      </span>
      <Button variant="outline" size="sm" onClick={onOpenRecords}>
        기록 보기
      </Button>
      <button
        type="button"
        aria-label="안내 닫기"
        onClick={onDismiss}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <XIcon className="size-4" aria-hidden />
      </button>
    </div>
  )
}

/**
 * 힌트(ADR 023, ADR 024). 지금 단계의 힌트를 1 → 2 → 3 순서로 하나씩 연다. 연 힌트는 단계가 바뀌어도 계속 보인다.
 * 공격 단계에서는 맨 아래 [공격 건너뛰기]로 언제든 방어 단계로 넘어간다
 */
export function HintsPanel({ lab }: { lab: LabSessionResponse }) {
  const queryClient = useQueryClient()
  const hints = useHints(lab.id, true)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const reveal = useMutation({
    mutationFn: async () => {
      const request = lab.stage === 'ATTACK' ? revealAttackHint : revealDefenseHint
      return (await request({ path: { id: lab.id }, throwOnError: true })).data
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: listLabHintsQueryKey({ path: { id: lab.id } }),
      })
      void queryClient.invalidateQueries({ queryKey: ['lab', lab.id] })
    },
  })
  const skip = useMutation({
    mutationFn: async () => (await skipAttack({ path: { id: lab.id }, throwOnError: true })).data,
    onSuccess: (data) => queryClient.setQueryData(['lab', lab.id], data),
    onSettled: () => setConfirmSkip(false),
  })

  const data = hints.data
  const attackStage = lab.stage === 'ATTACK'
  // 방어 단계에서는 연 공격 힌트만 보이고, 방어 힌트를 연다
  const groups: [LabStage, number][] = data
    ? attackStage
      ? [['ATTACK', data.attackTotal]]
      : [
          ['ATTACK', data.hints.filter((h) => h.stage === 'ATTACK').length],
          ['DEFENSE', data.defenseTotal],
        ]
    : []
  return (
    <Panel className="px-8 py-7">
      <div className="mx-auto max-w-160">
        <h1 className="text-xl font-semibold tracking-tight">힌트</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          순서대로 하나씩 열려요. 연 시각은 기록에 남아요.
        </p>
        {hints.isError && (
          <FormAlert tone="error">힌트를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</FormAlert>
        )}
        {groups.map(([stage, total]) => {
          if (total === 0) return null
          const revealed = data!.hints.filter((h) => h.stage === stage)
          return (
            <section key={stage} className="mt-6">
              {!attackStage && (
                <h2 className="mb-2 text-[13px] font-semibold text-muted-foreground">
                  {stage === 'ATTACK' ? '공격 힌트' : '방어 힌트'}
                </h2>
              )}
              <ol className="space-y-2.5">
                {Array.from({ length: total }, (_, i) => i + 1).map((position) => {
                  const hint = revealed.find((h) => h.position === position)
                  if (hint)
                    return (
                      <li key={position} className="rounded-xl border px-4.5 py-3.5">
                        <p className="flex items-baseline justify-between text-[13px] font-semibold">
                          {hintTitle(stage, position)}
                          <span className="font-mono text-xs font-normal text-muted-foreground">
                            {clockTime(hint.revealedAt)}
                          </span>
                        </p>
                        <Markdown className="mt-1.5 text-sm">{hint.content}</Markdown>
                      </li>
                    )
                  const next = stage === lab.stage && position === revealed.length + 1
                  return (
                    <li
                      key={position}
                      className="flex items-center justify-between gap-3 rounded-xl border border-dashed px-4.5 py-3 text-[13px] text-muted-foreground"
                    >
                      <span className="flex items-center gap-2">
                        <LockIcon className="size-3.5" aria-hidden />
                        {hintTitle(stage, position)}
                      </span>
                      {next && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={reveal.isPending}
                          onClick={() => reveal.mutate()}
                        >
                          힌트 {position} 보기
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}
        {reveal.error && (
          <FormAlert tone="error">힌트를 열지 못했어요. 잠시 뒤 다시 시도해 주세요.</FormAlert>
        )}
        {attackStage ? (
          <div className="mt-8 flex items-center justify-between gap-4 border-t pt-5">
            <p className="text-[13px] text-muted-foreground">
              공격이 잘 안 되면 건너뛰고 방어부터 해도 돼요. 건너뛴 사실은 기록에 남아요.
            </p>
            <Button variant="outline" size="sm" onClick={() => setConfirmSkip(true)}>
              공격 건너뛰기
            </Button>
          </div>
        ) : (
          lab.attackSkipped && (
            <p className="mt-8 border-t pt-5 text-[13px] text-muted-foreground">
              공격을 건너뛰고 방어 단계로 왔어요.
            </p>
          )
        )}
        {skip.error && (
          <FormAlert tone="error">건너뛰지 못했어요. 잠시 뒤 다시 시도해 주세요.</FormAlert>
        )}
      </div>
      <Dialog
        open={confirmSkip}
        onClose={() => setConfirmSkip(false)}
        title="공격을 건너뛸까요?"
        actions={
          <>
            <CancelButton />
            <ActionButton disabled={skip.isPending} onClick={() => skip.mutate()}>
              건너뛰기
            </ActionButton>
          </>
        }
      >
        <DialogText>
          방어 단계로 넘어가고 공격 단계로 돌아오지 않아요. 공격 힌트도 더 열 수 없어요.
        </DialogText>
      </Dialog>
    </Panel>
  )
}

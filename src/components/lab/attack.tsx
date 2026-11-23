import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LoaderCircleIcon, LockIcon, XIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { ApiError } from '@/api/errors'
import { listLabHintsQueryKey } from '@/api/generated/@tanstack/react-query.gen'
import { revealAttackHint, skipAttack } from '@/api/generated/sdk.gen'
import { useHints } from '@/api/labs'
import type {
  LabSessionResponse,
  VerificationResponse,
  VerificationStatus,
} from '@/api/generated/types.gen'
import { ActionButton, CancelButton, Dialog, DialogText } from '@/components/dialog'
import { FormAlert } from '@/components/form'
import { Markdown } from '@/components/markdown'
import { Button } from '@/components/ui/button'
import { clockTime, hintTitle, labRecords } from '@/lib/lab'
import { cn } from '@/lib/utils'

/** 작업 영역의 패널 한 면 */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
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

/** 상단 줄의 [공격 검증 요청]. Ctrl+Enter로도 누른다(터미널 안에서는 셸 입력이라 제외) */
export function VerifyButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
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
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
          검증 중…
        </>
      ) : (
        <>
          공격 검증 요청
          <kbd className="rounded bg-primary-foreground/15 px-1.5 font-mono text-[10.5px] font-medium">
            Ctrl ↵
          </kbd>
        </>
      )}
    </Button>
  )
}

/** 검증 요청이 거절된 이유 */
function verifyErrorText(error: Error) {
  if (error instanceof ApiError && error.code === 'LAB_JOB_RUNNING')
    return '다른 검증이나 작업이 실행 중이에요. 끝난 뒤 다시 요청해 주세요.'
  return '검증 결과를 받지 못했어요. 기록에서 결과를 확인하거나 다시 요청해 주세요.'
}

/** 작업 영역 위의 결과 안내 띠. 닫을 때까지 남는다 */
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
  if (!result && !error) return null
  let text: ReactNode
  if (!result) text = verifyErrorText(error!)
  else if (result.status === 'PASS')
    // 요청 버튼은 공격 단계에만 있어서 PASS면 방어 단계로 넘어간다
    text = '공격에 성공했어요. 이제 방어 단계예요. 코드를 고쳐 같은 공격을 막아요.'
  else if (result.status === 'FAIL') text = '아직 공격이 확인되지 않았어요.'
  else text = '플랫폼 문제로 검증을 실행하지 못했어요. 잠시 뒤 다시 요청해 주세요.'
  return (
    <div
      role="status"
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
 * 힌트(ADR 023). 공격 힌트는 공격 단계에서 1 → 2 → 3 순서로 하나씩 연다. 연 힌트는 단계가 바뀌어도 계속 보인다.
 * 맨 아래 [공격 건너뛰기]로 언제든 방어 단계로 넘어간다
 */
export function HintsPanel({ lab }: { lab: LabSessionResponse }) {
  const queryClient = useQueryClient()
  const hints = useHints(lab.id, true)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: listLabHintsQueryKey({ path: { id: lab.id } }) })
    void queryClient.invalidateQueries({ queryKey: ['lab', lab.id] })
  }
  const reveal = useMutation({
    mutationFn: async () =>
      (await revealAttackHint({ path: { id: lab.id }, throwOnError: true })).data,
    onSettled: refresh,
  })
  const skip = useMutation({
    mutationFn: async () => (await skipAttack({ path: { id: lab.id }, throwOnError: true })).data,
    onSuccess: (data) => queryClient.setQueryData(['lab', lab.id], data),
    onSettled: () => setConfirmSkip(false),
  })

  const data = hints.data
  const attack = data?.hints.filter((h) => h.stage === 'ATTACK') ?? []
  const defense = data?.hints.filter((h) => h.stage === 'DEFENSE') ?? []
  const attackStage = lab.stage === 'ATTACK'
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
        {data && (
          <ol className="mt-6 space-y-2.5">
            {Array.from({ length: data.attackTotal }, (_, i) => i + 1).map((position) => {
              const hint = attack.find((h) => h.position === position)
              if (hint)
                return (
                  <li key={position} className="rounded-xl border px-4.5 py-3.5">
                    <p className="flex items-baseline justify-between text-[13px] font-semibold">
                      {hintTitle('ATTACK', position)}
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {clockTime(hint.revealedAt)}
                      </span>
                    </p>
                    <Markdown className="mt-1.5 text-sm">{hint.content}</Markdown>
                  </li>
                )
              const next = attackStage && position === attack.length + 1
              return (
                <li
                  key={position}
                  className="flex items-center justify-between gap-3 rounded-xl border border-dashed px-4.5 py-3 text-[13px] text-muted-foreground"
                >
                  <span className="flex items-center gap-2">
                    <LockIcon className="size-3.5" aria-hidden />
                    {hintTitle('ATTACK', position)}
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
            {defense.map((hint) => (
              <li key={`d${hint.position}`} className="rounded-xl border px-4.5 py-3.5">
                <p className="flex items-baseline justify-between text-[13px] font-semibold">
                  {hintTitle('DEFENSE', hint.position)}
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {clockTime(hint.revealedAt)}
                  </span>
                </p>
                <Markdown className="mt-1.5 text-sm">{hint.content}</Markdown>
              </li>
            ))}
          </ol>
        )}
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

/** 기록(확정 캡처 `lab-records`): 맨 위에 마지막 검증 결과, 아래에 이 실습의 기록 */
export function RecordsPanel({
  verifications,
  labId,
}: {
  verifications?: VerificationResponse[]
  labId: number
}) {
  const hints = useHints(labId, true).data
  const latest = verifications?.[0]
  const records = labRecords(verifications ?? [], hints?.hints ?? [])
  return (
    <Panel className="px-8 py-7">
      <div className="mx-auto max-w-200">
        {latest ? (
          <div className="flex items-center gap-3">
            <Verdict status={latest.status} className="h-7 px-2.5 text-[13px]" />
            <h1 className="text-xl font-semibold tracking-tight">
              {records.find((r) => r.key === `v${latest.id}`)?.title}
            </h1>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {clockTime(latest.startedAt)}
            </span>
          </div>
        ) : (
          <h1 className="text-xl font-semibold tracking-tight">기록</h1>
        )}
        {latest?.message && <p className="mt-2 text-sm">{latest.message}</p>}
        <h2 className="mt-8 border-b pb-2 text-[13px] font-semibold text-muted-foreground">
          이 실습의 기록
        </h2>
        {records.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            아직 기록이 없어요. 공격 대상에서 공격한 뒤 [공격 검증 요청]을 눌러요.
          </p>
        ) : (
          <ul>
            {records.map((record) => (
              <li
                key={record.key}
                className="grid grid-cols-[56px_1fr_auto] items-start gap-3 border-b py-3"
              >
                <span className="pt-0.5 font-mono text-[13px] text-muted-foreground">
                  {clockTime(record.at)}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{record.title}</span>
                  {record.detail && (
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">
                      {record.detail}
                    </span>
                  )}
                </span>
                {record.status && record.status !== 'RUNNING' && <Verdict status={record.status} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheckIcon, CircleXIcon, LockIcon } from 'lucide-react'
import { useState } from 'react'

import { getSolutionOptions, getSolutionQueryKey } from '@/api/generated/@tanstack/react-query.gen'
import { openSolution } from '@/api/generated/sdk.gen'
import type { LabSessionResponse, VerificationResponse } from '@/api/generated/types.gen'
import { ActionButton, CancelButton, Dialog, DialogText } from '@/components/dialog'
import { FormAlert } from '@/components/form'
import { Markdown } from '@/components/markdown'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * 방어 검증 하나의 결과(ADR 025, 확정 캡처 `lab-records`): 기존 공격이 막혔는지, 정상 기능이 동작하는지.
 * 아직 통하는 공격(보안 테스트의 마지막 줄)은 바로 보이지 않게 접어 두고 학습자가 펼쳐 본다
 */
export function DefenseResult({ verification }: { verification: VerificationResponse }) {
  const { securityPassed, functionalPassed, securityMessage, functionalMessage } = verification
  if (securityPassed === null || functionalPassed === null) return null
  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <ResultCard
          title="기존 공격 차단"
          passed={securityPassed}
          text={securityPassed ? '공격이 모두 막혔어요' : '아직 통하는 공격이 있어요'}
        />
        <ResultCard
          title="정상 기능"
          passed={functionalPassed}
          text={functionalPassed ? '정상 기능이 동작해요' : '동작하지 않는 기능이 있어요'}
          detail={functionalMessage}
        />
      </div>
      {!securityPassed && securityMessage && (
        <details className="mt-3 rounded-xl border border-dashed px-4 py-3 text-[13px]">
          <summary className="cursor-pointer font-medium">통한 공격 보기</summary>
          <p className="mt-2 text-muted-foreground">
            먼저 방어 힌트를 보고 스스로 찾아봐도 좋아요. 검증에서 아직 통한 공격이에요.
          </p>
          <code className="mt-2 block rounded-lg bg-muted px-3 py-2 font-mono text-[12.5px] break-all">
            {securityMessage}
          </code>
        </details>
      )}
    </>
  )
}

function ResultCard({
  title,
  passed,
  text,
  detail,
}: {
  title: string
  passed: boolean
  text: string
  detail?: string | null
}) {
  const Icon = passed ? CircleCheckIcon : CircleXIcon
  return (
    <div className={cn('rounded-xl border px-4 py-3.5', !passed && 'border-fail/40')}>
      <p className="text-[13px] font-semibold text-muted-foreground">{title}</p>
      <p
        className={cn(
          'mt-2 flex items-center gap-1.5 text-sm font-semibold',
          passed ? 'text-pass' : 'text-fail',
        )}
      >
        <Icon className="size-4" aria-hidden />
        {text}
      </p>
      {detail && <p className="mt-1 text-[13px] text-muted-foreground">{detail}</p>}
    </div>
  )
}

/**
 * 해답(ADR 025). 방어 검증 FAIL이 최대 시도 횟수만큼 쌓이면 열 수 있다. 연 뒤에 통과하면 "해답 확인 후 PASS"로 남아서
 * 열기 전에 확인 창을 거친다. 한 번 연 해답은 계속 보인다
 */
export function SolutionSection({
  lab,
  verifications,
}: {
  lab: LabSessionResponse
  verifications?: VerificationResponse[]
}) {
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const solutionKey = getSolutionQueryKey({ path: { id: lab.id } })
  const solution = useQuery({
    ...getSolutionOptions({ path: { id: lab.id } }),
    enabled: !!lab.solutionViewedAt,
  })
  const open = useMutation({
    mutationFn: async () => (await openSolution({ path: { id: lab.id }, throwOnError: true })).data,
    onSuccess: (data) => {
      queryClient.setQueryData(solutionKey, data)
      void queryClient.invalidateQueries({ queryKey: ['lab', lab.id] })
    },
    onSettled: () => setConfirm(false),
  })
  const fails =
    verifications?.filter((v) => v.type === 'DEFENSE' && v.status === 'FAIL').length ?? 0
  const content = solution.data?.content ?? open.data?.content

  if (lab.solutionViewedAt || content)
    return (
      <section className="mt-10">
        <h2 className="border-b pb-2 text-[13px] font-semibold text-muted-foreground">해답</h2>
        {solution.isError && (
          <FormAlert tone="error">해답을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</FormAlert>
        )}
        {content && <Markdown className="mt-4 text-sm">{content}</Markdown>}
      </section>
    )
  if (lab.stage !== 'DEFENSE') return null
  return (
    <div className="mt-10 flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
      <LockIcon className="size-4 shrink-0" aria-hidden />
      <p className="flex-1">
        {lab.solutionAvailable
          ? `방어 검증을 ${lab.maxDefenseAttempts}번 통과하지 못해 해답을 볼 수 있어요.`
          : `방어 검증을 ${lab.maxDefenseAttempts}번 통과하지 못하면 해답을 볼 수 있어요(지금 ${fails}번).`}{' '}
        해답을 본 뒤 통과하면 결과는 &lsquo;해답 확인 후 PASS&rsquo;로 남아요.
      </p>
      {lab.solutionAvailable && (
        <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
          해답 보기
        </Button>
      )}
      {open.error && <span className="text-fail">해답을 열지 못했어요.</span>}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="해답을 볼까요?"
        actions={
          <>
            <CancelButton />
            <ActionButton disabled={open.isPending} onClick={() => open.mutate()}>
              해답 보기
            </ActionButton>
          </>
        }
      >
        <DialogText>
          공격 방법과 고치는 방법이 나와요. 본 뒤에 방어 검증을 통과하면 기록에 &lsquo;해답 확인
          후&rsquo;로 남아요.
        </DialogText>
      </Dialog>
    </div>
  )
}

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { terminateLab } from '@/api/generated/sdk.gen'
import { ActionButton, CancelButton, Dialog, DialogText } from '@/components/dialog'

export type TerminateTarget = { id: number; name: string; challengeTitle: string }

/**
 * 강제 종료 확인 창(ADR 026). 실패하면 창을 닫고 부른 화면이 안내를 보여 준다.
 * 끝나면 세션 목록과 그 세션을 다시 불러온다
 */
export function TerminateDialog({
  target,
  onClose,
  onError,
}: {
  target: TerminateTarget | null
  onClose: () => void
  onError: (message: string) => void
}) {
  const queryClient = useQueryClient()
  const terminate = useMutation({
    mutationFn: async (id: number) =>
      (await terminateLab({ path: { id }, throwOnError: true })).data,
    onSuccess: onClose,
    onError: (e: Error) => {
      onClose()
      onError(`실습을 종료하지 못했어요. ${e.message}`)
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        predicate: ({ queryKey: [key] }) =>
          key === 'lab' || (key as { _id?: string } | undefined)?._id === 'listAdminLabs',
      }),
  })
  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title={`${target?.name} 님의 실습을 종료할까요?`}
      actions={
        <>
          <CancelButton />
          <ActionButton
            danger
            disabled={terminate.isPending}
            onClick={() => target && terminate.mutate(target.id)}
          >
            강제 종료
          </ActionButton>
        </>
      }
    >
      <DialogText>
        "{target?.challengeTitle}" 실습 환경이 삭제돼요. 학습자 화면에는 관리자가 실습을 종료했다고
        안내돼요. 되돌릴 수 없어요.
      </DialogText>
    </Dialog>
  )
}

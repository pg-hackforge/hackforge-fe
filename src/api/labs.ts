import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import {
  getCurrentLabQueryKey,
  listLabHintsOptions,
  listVerificationsOptions,
  listVerificationsQueryKey,
} from './generated/@tanstack/react-query.gen'
import {
  getCurrentLab,
  getLab,
  getVerification,
  requestAttackVerification,
} from './generated/sdk.gen'
import type { LabSessionResponse, VerificationResponse } from './generated/types.gen'
import { labPollInterval } from '@/lib/lab'

/** 진행 중인 내 실습. 없으면(204) 빈 객체가 아니라 null */
export const currentLabQuery = () =>
  queryOptions({
    queryKey: getCurrentLabQueryKey(),
    queryFn: async (): Promise<LabSessionResponse | null> => {
      // 204의 본문은 client에 따라 undefined나 빈 객체로 온다
      const { data } = await getCurrentLab({ throwOnError: true })
      return data && 'id' in data ? data : null
    },
  })

export const useCurrentLab = () => useQuery(currentLabQuery())

/** 세션 하나. 상태에 따라 다시 조회한다(준비·종료 중 2.5초, 실습 중 10초, 끝나면 멈춤) */
export const useLab = (id: number) =>
  useQuery({
    queryKey: ['lab', id],
    queryFn: async () => (await getLab({ path: { id }, throwOnError: true })).data,
    refetchInterval: (query) => labPollInterval(query.state.data?.status),
    enabled: Number.isInteger(id),
  })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 이 세션의 검증 기록. 실행 중인 검증이 남아 있으면(새로고침 등) 끝날 때까지 다시 조회한다 */
export function useVerifications(labId: number, enabled: boolean, watching: boolean) {
  return useQuery({
    ...listVerificationsOptions({ path: { id: labId } }),
    enabled,
    refetchInterval: (query) =>
      !watching && query.state.data?.some((v) => v.status === 'RUNNING') ? 1_000 : false,
  })
}

export const useHints = (labId: number, enabled: boolean) =>
  useQuery({ ...listLabHintsOptions({ path: { id: labId } }), enabled })

/**
 * 공격 검증 요청(ADR 023). 접수(RUNNING)되면 1초 간격으로 검증 하나를 조회해 결과를 기다린다.
 * 끝나면 결과를 안내 띠로 보여 주고, PASS로 단계가 바뀌었을 수 있으니 세션을 다시 읽는다
 */
export function useAttackVerification(labId: number) {
  const queryClient = useQueryClient()
  const [result, setResult] = useState<VerificationResponse | null>(null)
  const listKey = listVerificationsQueryKey({ path: { id: labId } })
  const mutation = useMutation({
    mutationFn: async () => {
      setResult(null)
      let verification = (
        await requestAttackVerification({ path: { id: labId }, throwOnError: true })
      ).data
      queryClient.setQueryData<VerificationResponse[]>(listKey, (old) => [
        verification,
        ...(old ?? []),
      ])
      while (verification.status === 'RUNNING') {
        await sleep(1_000)
        verification = (
          await getVerification({
            path: { id: labId, verificationId: verification.id },
            throwOnError: true,
          })
        ).data
      }
      return verification
    },
    onSuccess: setResult,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listKey })
      void queryClient.invalidateQueries({ queryKey: ['lab', labId] })
    },
  })
  return {
    start: () => mutation.mutate(),
    pending: mutation.isPending,
    result,
    error: mutation.error,
    dismiss: () => {
      setResult(null)
      mutation.reset()
    },
  }
}

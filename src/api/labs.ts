import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import {
  getCurrentLabQueryKey,
  listLabFilesQueryKey,
  listLabHintsOptions,
  listRedeploysOptions,
  listRedeploysQueryKey,
  listVerificationsOptions,
  listVerificationsQueryKey,
} from './generated/@tanstack/react-query.gen'
import {
  getCurrentLab,
  getLab,
  getRedeploy,
  getVerification,
  requestAttackVerification,
  requestRedeploy,
  resetLab,
} from './generated/sdk.gen'
import type {
  LabSessionResponse,
  RedeployResponse,
  ResetLabRequest,
  VerificationResponse,
} from './generated/types.gen'
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
    // 종료 뒤 정리 중(TERMINATING)이면 새 실습을 아직 못 시작한다. 정리가 끝나는 것을 보려고 다시 읽는다
    refetchInterval: (query) => (query.state.data?.status === 'TERMINATING' ? 2_500 : false),
  })

/** 정리 중이 아니라 실제로 하고 있는 실습. 문제의 "진행 중" 표시와 "실습으로 돌아가기"에 쓴다 */
export const isLive = (lab?: LabSessionResponse | null): lab is LabSessionResponse =>
  !!lab && lab.status !== 'TERMINATING'

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

/** 재배포·서비스 초기화 기록. 실행 중인 기록이 남아 있으면(새로고침 등) 끝날 때까지 다시 조회한다 */
export function useRedeploys(labId: number, enabled: boolean, watching: boolean) {
  return useQuery({
    ...listRedeploysOptions({ path: { id: labId } }),
    enabled,
    refetchInterval: (query) =>
      !watching && query.state.data?.some((r) => r.status === 'RUNNING') ? 1_000 : false,
  })
}

/**
 * 재배포와 초기화(ADR 024). 재배포와 서비스 초기화는 접수(RUNNING) 뒤 1초 간격으로 기록 하나를 조회해
 * 빌드 로그와 결과를 받는다. 실습 환경 다시 만들기는 세션이 준비 단계로 돌아가므로 기다리지 않는다.
 * 시작 전에 `beforeStart`(편집기의 저장 안 된 내용 저장)를 기다린다
 */
export function useRedeploy(labId: number, beforeStart?: () => Promise<void>) {
  const queryClient = useQueryClient()
  const [result, setResult] = useState<RedeployResponse | null>(null)
  const listKey = listRedeploysQueryKey({ path: { id: labId } })
  const mutation = useMutation({
    mutationFn: async (reset?: ResetLabRequest) => {
      setResult(null)
      await beforeStart?.()
      let redeploy: RedeployResponse | null
      if (reset) {
        const data = (await resetLab({ path: { id: labId }, body: reset, throwOnError: true })).data
        queryClient.setQueryData(['lab', labId], data.session)
        redeploy = data.redeploy
      } else {
        redeploy = (await requestRedeploy({ path: { id: labId }, throwOnError: true })).data
      }
      if (!redeploy) return null
      const started = redeploy
      queryClient.setQueryData<RedeployResponse[]>(listKey, (old) => [started, ...(old ?? [])])
      while (redeploy.status === 'RUNNING') {
        await sleep(1_000)
        redeploy = (
          await getRedeploy({
            path: { id: labId, redeployId: redeploy.id },
            throwOnError: true,
          })
        ).data
      }
      return redeploy
    },
    onSuccess: setResult,
    onSettled: (_data, _error, reset) => {
      void queryClient.invalidateQueries({ queryKey: listKey })
      void queryClient.invalidateQueries({ queryKey: ['lab', labId] })
      // 초기화는 코드를 원본으로 되돌린다
      if (reset) {
        void queryClient.invalidateQueries({
          queryKey: listLabFilesQueryKey({ path: { id: labId } }),
        })
        void queryClient.invalidateQueries({
          predicate: (query) => (query.queryKey[0] as { _id?: string })._id === 'getLabFile',
        })
      }
    },
  })
  return {
    redeploy: () => mutation.mutate(undefined),
    reset: (request: ResetLabRequest) => mutation.mutate(request),
    pending: mutation.isPending,
    /** 지금 실행 중인 것이 초기화인지 */
    resetting: mutation.isPending && !!mutation.variables,
    result,
    error: mutation.error,
    dismiss: () => {
      setResult(null)
      mutation.reset()
    },
  }
}

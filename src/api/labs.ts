import { queryOptions, useQuery } from '@tanstack/react-query'

import { getCurrentLabQueryKey } from './generated/@tanstack/react-query.gen'
import { getCurrentLab, getLab } from './generated/sdk.gen'
import type { LabSessionResponse } from './generated/types.gen'
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

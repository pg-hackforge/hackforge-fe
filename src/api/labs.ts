import { queryOptions, useQuery } from '@tanstack/react-query'

import { getCurrentLabQueryKey } from './generated/@tanstack/react-query.gen'
import { getCurrentLab } from './generated/sdk.gen'
import type { LabSessionResponse } from './generated/types.gen'

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

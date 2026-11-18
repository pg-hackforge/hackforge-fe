import { queryOptions, useQuery } from '@tanstack/react-query'

import type { Client } from './generated/client'
import { client as defaultClient } from './generated/client.gen'
import { getMe } from './generated/sdk.gen'
import type { UserResponse } from './generated/types.gen'

export const meQueryKey = ['me'] as const

/** 내 계정. 로그인하지 않았으면(401) 오류가 아니라 null */
export async function fetchMe(client: Client = defaultClient): Promise<UserResponse | null> {
  const { data, error, response } = await getMe({ client })
  if (response?.status === 401) return null
  if (error) throw error
  return data ?? null
}

export const meQuery = () =>
  queryOptions({
    queryKey: meQueryKey,
    queryFn: () => fetchMe(),
    retry: false,
  })

/** 화면에서 로그인 상태를 읽는다. data가 null이면 로그아웃 상태 */
export const useMe = () => useQuery(meQuery())

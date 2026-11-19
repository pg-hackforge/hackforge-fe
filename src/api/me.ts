import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { createClient, type Client } from './generated/client'
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

/**
 * 세션이 아직 살아 있는지 확인한다. 공통 처리(401이면 로그아웃 상태로)를 붙이지 않은 client로 물어서,
 * 확인만 하고 화면은 바꾸지 않는다
 */
export const hasSession = async () =>
  (await fetchMe(createClient(defaultClient.getConfig()))) !== null

/**
 * 세션이 끝났을 때(로그아웃, 비밀번호 변경 중 잠김) 화면을 옮긴 뒤 내 계정과 받아 둔 데이터를 지운다.
 * 이동은 기본으로 transition이라 늦게 그려져서, 계정을 지우는 갱신이 먼저 그려지면
 * 로그인 필요 화면이 로그인 화면으로 보낸다. 그래서 이동을 먼저 바로 그린다
 */
export function useEndSession() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return async (to: string, state?: unknown) => {
    await navigate(to, { flushSync: true, state })
    queryClient.setQueryData(meQueryKey, null)
    // 다른 사람 데이터가 남지 않게 내 계정 말고는 모두 지운다
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meQueryKey[0] })
  }
}

import { QueryClient } from '@tanstack/react-query'

import { configureApiClient } from './client'
import { client } from './generated/client.gen'
import { meQueryKey } from './me'

export const queryClient = new QueryClient()

// 어느 요청이든 401을 받으면 로그아웃 상태로(내 계정 = null)
configureApiClient(client, {
  onUnauthorized: () => queryClient.setQueryData(meQueryKey, null),
})

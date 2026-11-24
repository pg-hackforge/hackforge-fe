import { useQuery } from '@tanstack/react-query'

import { client } from './generated/client.gen'
import type { MyActivity } from '@/lib/analysis'

// 시안: 백엔드 spec(ADR 030 예정)이 생기면 생성 SDK의 getMyActivityOptions로 바꾼다
export const useMyActivity = () =>
  useQuery({
    queryKey: ['me', 'activity'],
    queryFn: async () => {
      const { data, error } = await client.get<{ 200: MyActivity }>({ url: '/api/me/activity' })
      if (error) throw error
      return data
    },
  })

import { useQuery } from '@tanstack/react-query'

import { listChallengesOptions } from './generated/@tanstack/react-query.gen'
import type { Finding } from '@/lib/analysis'

/**
 * 보완할 분류의 추천 문제: 끝내지 못한 문제부터, 없으면 시작 전 문제 중 쉬운 것(ADR 030). finding이 없으면 묻지 않는다.
 * 지금 진행 중인 실습의 문제(excludeId)는 이미 하고 있으니 뺀다
 */
export function useRecommendedProblem(finding: Finding | undefined, excludeId?: number) {
  const list = useQuery({
    ...listChallengesOptions({
      query: {
        category: finding ? [finding.stat.key] : [],
        myStatus: ['UNFINISHED', 'NOT_STARTED'],
        sort: 'DIFFICULTY',
      },
    }),
    enabled: !!finding,
  })
  const items = list.data?.items.filter((c) => c.id !== excludeId) ?? []
  return items.find((c) => c.myStatus === 'UNFINISHED') ?? items[0]
}

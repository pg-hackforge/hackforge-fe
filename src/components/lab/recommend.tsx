import { ChevronRightIcon } from 'lucide-react'
import { Link } from 'react-router'

import type { ChallengeResponse } from '@/api/generated/types.gen'
import { SIDE_LABEL, type Finding } from '@/lib/analysis'
import { DIFFICULTY_LABEL } from '@/lib/problems'

/** 추천 이유 한 줄과 문제 링크(분석 탭, 홈) */
export function RecommendedProblem({
  finding,
  challenge,
}: {
  finding: Finding
  challenge: ChallengeResponse
}) {
  return (
    <>
      <p className="mt-1 text-xs text-muted-foreground">
        {finding.stat.name} {SIDE_LABEL[finding.side]} 연습
      </p>
      <Link
        to={`/problems/${challenge.id}`}
        className="-mx-2 mt-3 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{challenge.title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {DIFFICULTY_LABEL[challenge.difficulty]} · 예상 {challenge.estimatedMinutes}분
            {challenge.myStatus === 'UNFINISHED' && ' · 끝내지 못한 문제'}
          </span>
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </>
  )
}

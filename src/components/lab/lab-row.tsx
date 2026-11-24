import { useState } from 'react'
import { Link } from 'react-router'

import type { LabSessionResponse } from '@/api/generated/types.gen'
import { clockTime, labResult, labSummary } from '@/lib/lab'
import { cn } from '@/lib/utils'

/** 세션 한 줄(홈의 최근 기록, 내 실습 기록): 시작 시각, 문제와 진행, 결과. 누르면 그 세션의 기록 */
export function LabRow({ lab }: { lab: LabSessionResponse }) {
  const date = new Date(lab.createdAt)
  // 진행 중 세션의 "N분째"는 화면을 연 시각 기준이면 충분하다
  const [now] = useState(Date.now)
  return (
    <li className="border-b last:border-b-0">
      <Link
        to={`/records/${lab.id}`}
        className="-mx-2.5 grid grid-cols-[92px_1fr_auto] items-center gap-3 rounded-md px-2.5 py-3 hover:bg-muted/50"
      >
        <span className="font-mono text-[13px] text-muted-foreground tabular-nums">
          {`${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`}{' '}
          {clockTime(lab.createdAt)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{lab.challengeTitle}</span>
          <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
            {labSummary(lab, now)}
          </span>
        </span>
        <ResultChip lab={lab} />
      </Link>
    </li>
  )
}

/** 세션 결과 표시: 진행 중, 완료, 끝내지 못함과 이유 */
export function ResultChip({ lab }: { lab: LabSessionResponse }) {
  const result = labResult(lab)
  return (
    <span
      className={cn(
        'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
        result.tone === 'pass' && 'border border-pass text-pass',
        result.tone === 'active' && 'bg-primary text-primary-foreground',
        result.tone === 'muted' && 'border text-muted-foreground',
      )}
    >
      {result.label}
    </span>
  )
}

import { useQuery } from '@tanstack/react-query'
import { ChevronRightIcon } from 'lucide-react'
import { Link, NavLink } from 'react-router'

import { getMyActivityOptions } from '@/api/generated/@tanstack/react-query.gen'
import { ActivityGrid } from '@/components/lab/activity'
import { categoryStats, formatMinutes, SIDE_LABEL, strengths, weaknesses } from '@/lib/analysis'
import { cn } from '@/lib/utils'

/** 내 기록 제목과 탭(실습 기록, 분석) */
export function RecordsHeader() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    cn(
      '-mb-px border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors',
      isActive
        ? 'border-primary text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground',
    )
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">내 기록</h1>
      <nav aria-label="내 기록" className="mt-5 flex gap-6 border-b">
        <NavLink to="/records" end className={tab}>
          실습 기록
        </NavLink>
        <NavLink to="/records/analysis" className={tab}>
          분석
        </NavLink>
      </nav>
    </header>
  )
}

/** 실습 기록 탭 오른쪽: 숫자 요약과 최근 18주 활동, 분석의 핵심 한 줄 */
export function SummaryPanel() {
  const activity = useQuery(getMyActivityOptions()).data
  if (!activity) return <aside className="hidden lg:block" />
  const completed = activity.challenges.filter((c) => c.result !== 'UNFINISHED').length
  // 보완할 점이 있으면 그것, 없으면 강점
  const stats = categoryStats(activity)
  const weak = weaknesses(stats)[0]
  const strong = strengths(stats)[0]
  const highlight = weak
    ? { label: '보완할 점', finding: weak }
    : strong && { label: '강점', finding: strong }
  return (
    <aside
      aria-label="내 실습 요약"
      className="rounded-xl border bg-card p-5 lg:sticky lg:top-[72px]"
    >
      <dl className="grid grid-cols-3 gap-3">
        {(
          [
            ['실습', `${activity.sessions}번`],
            ['완료한 문제', `${completed}개`],
            ['실습 시간', formatMinutes(activity.totalMinutes).replace(/ \d+분$/, '')],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <h2 className="mt-5 mb-2 text-xs font-medium text-muted-foreground">최근 18주</h2>
      <ActivityGrid days={activity.days} weeks={18} cell={14} />
      {/* 분석 탭과 겹치지 않게, 분석의 핵심 한 줄을 보여 주고 거기로 보낸다 */}
      {highlight && (
        <div className="mt-4 border-t pt-2">
          <Link
            to="/records/analysis"
            className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
          >
            <span className="shrink-0 text-xs text-muted-foreground">{highlight.label}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {highlight.finding.stat.name} {SIDE_LABEL[highlight.finding.side]}
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </div>
      )}
    </aside>
  )
}

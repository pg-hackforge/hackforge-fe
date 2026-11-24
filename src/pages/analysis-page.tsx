import { useQuery } from '@tanstack/react-query'
import { CircleHelpIcon } from 'lucide-react'
import { Link } from 'react-router'

import { getMyActivityOptions } from '@/api/generated/@tanstack/react-query.gen'
import { useRecommendedProblem } from '@/api/recommend'
import { FormAlert } from '@/components/form'
import { ActivityGrid } from '@/components/lab/activity'
import { RecommendedProblem } from '@/components/lab/recommend'
import { RecordsHeader } from '@/components/lab/records-header'
import { buttonVariants } from '@/components/ui/button'
import {
  categoryStats,
  formatMinutes,
  rankScore,
  SIDE_LABEL,
  MIN_FOR_JUDGMENT,
  strengths,
  weaknesses,
  type CategoryStat,
  type Finding,
} from '@/lib/analysis'
import { cn } from '@/lib/utils'

/** `/records/analysis` 내 분석: 분류별 공격·방어, 강점과 보완점, 추천 문제, 최근 1년 활동 */
export function AnalysisPage() {
  const activity = useQuery(getMyActivityOptions())
  const data = activity.data
  const stats = data ? categoryStats(data) : []
  const tried = stats.filter((s) => s.tried > 0)
  const completed = data?.challenges.filter((c) => c.result !== 'UNFINISHED') ?? []
  const selfSolved = completed.filter((c) => c.result === 'COMPLETED').length
  const weak = weaknesses(stats)

  return (
    <div className="mx-auto w-full max-w-310 px-4 pt-10 pb-14 sm:px-6">
      <RecordsHeader />
      {activity.isError && (
        <FormAlert tone="error">분석을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</FormAlert>
      )}
      {data && (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-4">
            <Stat
              label="완료한 문제"
              value={`${completed.length}`}
              unit={`/ ${data.totalChallenges}`}
            >
              <div className="mt-2.5 h-1 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(completed.length / data.totalChallenges) * 100}%` }}
                />
              </div>
            </Stat>
            <Stat
              label="해답 없이 완료"
              value={`${completed.length ? Math.round((selfSolved / completed.length) * 100) : 0}%`}
              unit={`${selfSolved}개`}
            />
            <Stat label="시도한 분류" value={`${tried.length}`} unit={`/ ${stats.length}`} />
            <Stat
              label="실습"
              value={`${data.sessions}번`}
              unit={formatMinutes(data.totalMinutes)}
            />
          </dl>

          {data.challenges.length === 0 ? (
            // 결과가 난 실습이 없으면 분류 막대가 모두 비어 뜻이 없다. 시작할 곳을 알려 준다
            <div className="mt-5 rounded-xl border border-dashed px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                아직 분석할 실습이 없어요. 실습을 하나 끝내면 분류별 공격·방어를 보여 드려요.
              </p>
              <Link
                to="/problems"
                className={buttonVariants({ variant: 'outline', className: 'mt-4' })}
              >
                문제 보기
              </Link>
            </div>
          ) : (
            <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <CategoryChart stats={stats} />
              <div className="grid gap-5">
                <Findings
                  title="강점"
                  empty="아직 강점을 말하기엔 기록이 적어요."
                  findings={strengths(stats)}
                  tone="strong"
                />
                <Findings
                  title="보완할 점"
                  empty="뚜렷하게 약한 분류가 없어요."
                  findings={weak}
                  tone="weak"
                />
                {weak[0] && <NextProblem finding={weak[0]} />}
              </div>
            </div>
          )}

          <section className="mt-5 rounded-xl border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">최근 1년 활동</h2>
            <div className="overflow-x-auto">
              <ActivityGrid days={data.days} weeks={53} cell={17} />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  unit,
  children,
}: {
  label: string
  value: string
  unit?: string
  children?: React.ReactNode
}) {
  return (
    <div className="bg-card px-5 py-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {unit && <span className="ml-1.5 text-sm text-muted-foreground tabular-nums">{unit}</span>}
        {children}
      </dd>
    </div>
  )
}

const percent = (score: number | null) => Math.round((score ?? 0) * 100)

const ROW = 'grid grid-cols-[minmax(0,1fr)_132px_minmax(0,1fr)_52px] items-center gap-3'

/**
 * 분류마다 가운데 이름, 왼쪽으로 공격, 오른쪽으로 방어 막대. 많이 해 보고 잘한 분류가 위(rankScore),
 * 안 해 본 분류는 빈 막대로 아래에. 시도한 문제가 적거나 없으면 흐리게
 */
function CategoryChart({ stats }: { stats: CategoryStat[] }) {
  const rows = stats.toSorted((a, b) => rankScore(b) - rankScore(a))
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-semibold">분류별 공격·방어</h2>
        <details className="group relative ml-auto">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <CircleHelpIcon className="size-3.5" aria-hidden />
            어떻게 계산하나요
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border bg-popover p-4 text-xs leading-relaxed text-popover-foreground shadow-md">
            <p>그 분류에서 시도한 문제마다 점수를 매기고, 어려운 문제일수록 더 쳐서 평균해요.</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>공격: 힌트 없이 성공하면 100, 힌트 하나에 20씩 깎여요. 건너뛰면 0</li>
              <li>
                방어: 해답 없이 통과하면 100, 검증을 한 번 더 할 때 10, 힌트 하나에 15씩 깎여요.
                해답을 본 뒤 통과는 30
              </li>
              <li>많이 해 보고 잘한 분류가 위에 와요. 한두 문제만 잘한 분류는 그보다 아래예요</li>
              <li>시도한 문제가 {MIN_FOR_JUDGMENT}개보다 적거나 없는 분류는 흐리게 보여요</li>
            </ul>
          </div>
        </details>
      </div>
      {/* 열 이름: 막대가 무엇인지 표 머리처럼 */}
      <div
        aria-hidden
        className={cn(ROW, 'mt-4 border-b pb-2 text-[11px] font-medium text-muted-foreground')}
      >
        <span className="flex items-center justify-end gap-1.5 pr-9">
          <span className="size-2 rounded-[2px] bg-chart-1" />
          공격 점수
        </span>
        <span className="text-center">분류</span>
        <span className="flex items-center gap-1.5 pl-9">
          <span className="size-2 rounded-[2px] bg-chart-4" />
          방어 점수
        </span>
        <span className="text-right">시도/전체</span>
      </div>
      <ul className="mt-2 grid gap-0.5">
        {rows.map((stat) => {
          const faint = stat.tried < MIN_FOR_JUDGMENT
          return (
            <li key={stat.key}>
              <Link
                to={`/problems?category=${stat.key}`}
                aria-label={
                  stat.tried
                    ? `${stat.name}: 공격 ${percent(stat.attack)}, 방어 ${percent(stat.defense)}, ${stat.total}문제 중 ${stat.tried}문제 시도`
                    : `${stat.name}: 아직 안 해 봄, ${stat.total}문제`
                }
                title={
                  stat.tried === 0
                    ? '아직 안 해 본 분류예요'
                    : faint
                      ? '시도한 문제가 적어 아직 판단하기 어려워요'
                      : undefined
                }
                className={cn(
                  ROW,
                  '-mx-2 rounded-md px-2 py-1.5 hover:bg-muted/50',
                  faint && 'opacity-45',
                )}
              >
                <Bar value={stat.attack} side="left" />
                <span className="truncate text-center text-[13px] font-medium">{stat.name}</span>
                <Bar value={stat.defense} side="right" />
                <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                  {stat.tried}/{stat.total}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** 막대 하나. 바탕(100까지)을 옅게 깔아 길이를 비교하기 쉽게, 시도하지 않았으면 바탕만 */
function Bar({ value, side }: { value: number | null; side: 'left' | 'right' }) {
  return (
    <span className={cn('flex items-center gap-2', side === 'left' && 'flex-row-reverse')}>
      <span
        className={cn(
          'flex h-3.5 flex-1 bg-muted/70',
          side === 'left' ? 'justify-end rounded-l-[3px]' : 'rounded-r-[3px]',
        )}
      >
        {value !== null && (
          <span
            className={cn(
              'h-full',
              side === 'left' ? 'rounded-l-[3px] bg-chart-1' : 'rounded-r-[3px] bg-chart-4',
            )}
            style={{ width: `${percent(value)}%` }}
          />
        )}
      </span>
      <span className="w-7 shrink-0 text-center font-mono text-[11px] text-muted-foreground tabular-nums">
        {value === null ? '–' : percent(value)}
      </span>
    </span>
  )
}

function Findings({
  title,
  empty,
  findings,
  tone,
}: {
  title: string
  empty: string
  findings: Finding[]
  tone: 'strong' | 'weak'
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {findings.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {findings.map((f) => (
            <li key={f.stat.key}>
              <p className="flex items-center gap-2 text-sm font-medium">
                {f.stat.name}
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                    f.side === 'ATTACK' && 'bg-chart-1/15 text-chart-1',
                    f.side === 'DEFENSE' && 'bg-chart-4/15 text-chart-4',
                    f.side === 'BOTH' && tone === 'strong' && 'bg-pass/15 text-pass',
                    f.side === 'BOTH' && tone === 'weak' && 'border text-muted-foreground',
                  )}
                >
                  {SIDE_LABEL[f.side]}
                </span>
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{f.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function NextProblem({ finding }: { finding: Finding }) {
  const challenge = useRecommendedProblem(finding)
  if (!challenge) return null
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">추천 문제</h2>
      <RecommendedProblem finding={finding} challenge={challenge} />
    </section>
  )
}

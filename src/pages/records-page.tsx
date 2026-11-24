import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { ApiError } from '@/api/errors'
import {
  listLabEventsOptions,
  listLabsOptions,
  listRedeploysOptions,
  listVerificationsOptions,
} from '@/api/generated/@tanstack/react-query.gen'
import type { LabSessionResponse, VerificationResponse } from '@/api/generated/types.gen'
import { useHints, useLab } from '@/api/labs'
import { FormAlert } from '@/components/form'
import { Verdict } from '@/components/lab/attack'
import { DefenseResult, SolutionSection } from '@/components/lab/defense'
import { LabRow, ResultChip } from '@/components/lab/lab-row'
import { Pagination } from '@/components/pagination'
import { buttonVariants } from '@/components/ui/button'
import {
  clockTime,
  labDuration,
  labResult,
  recordSections,
  sessionRecords,
  type LabRecord,
} from '@/lib/lab'
import { cn } from '@/lib/utils'
import { NotFoundPage } from '@/pages/status-pages'

/** `/records` 내 실습 기록(ADR 026, ADR 027): 내 세션을 최근 시작 순으로. 페이지는 주소에 둔다 */
export function RecordsPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const list = useQuery({
    ...listLabsOptions({ query: { page } }),
    placeholderData: keepPreviousData,
  })
  const data = list.data
  return (
    <div className="mx-auto w-full max-w-200 px-4 pt-10 pb-14 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">내 기록</h1>
      <p className="mt-1 text-sm text-muted-foreground tabular-nums">
        {data ? `실습 ${data.totalItems}번` : ' '}
      </p>
      {list.isError ? (
        <FormAlert tone="error">
          실습 기록을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.
        </FormAlert>
      ) : data?.items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">아직 실습 기록이 없어요.</p>
          <Link
            to="/problems"
            className={buttonVariants({ variant: 'outline', className: 'mt-4' })}
          >
            문제 보기
          </Link>
        </div>
      ) : (
        data && (
          <>
            <div
              className={cn(
                'mt-6 rounded-xl border bg-card px-5 pb-1',
                list.isPlaceholderData && 'opacity-60',
              )}
            >
              {byDay(data.items).map(([day, labs]) => (
                <section key={day}>
                  <h2 className="border-b pt-4 pb-2 text-[13px] font-semibold text-muted-foreground">
                    {day}
                  </h2>
                  <ul aria-label={day}>
                    {labs.map((lab) => (
                      <LabRow key={lab.id} lab={lab} time="clock" />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            {data.totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={data.totalPages}
                totalItems={data.totalItems}
                size={data.size}
                onPage={(p) => setParams({ page: String(p) })}
              />
            )}
          </>
        )
      )}
    </div>
  )
}

/** 시작한 날로 묶는다: 오늘, 어제, 그 전은 "11월 22일 (토)", 올해가 아니면 연도도 */
function byDay(labs: LabSessionResponse[]): [string, LabSessionResponse[]][] {
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const groups = new Map<string, LabSessionResponse[]>()
  for (const lab of labs) {
    const d = new Date(lab.createdAt)
    const day = same(d, today)
      ? '오늘'
      : same(d, yesterday)
        ? '어제'
        : d.toLocaleDateString('ko-KR', {
            year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short',
          })
    groups.set(day, [...(groups.get(day) ?? []), lab])
  }
  return [...groups]
}

/**
 * `/records/:id` 세션 하나의 기록: 시작부터 종료까지 상태 변경과 검증·힌트·재배포를 오래된 순으로,
 * 방어 검증은 펼쳐서 결과를 보고, 해답을 열었던 세션이면 그 해답을 다시 본다(ADR 026)
 */
export function RecordPage() {
  const id = Number(useParams().id)
  const lab = useLab(id)
  const enabled = !!lab.data
  const query = { path: { id } }
  const events = useQuery({ ...listLabEventsOptions(query), enabled })
  const verifications = useQuery({ ...listVerificationsOptions(query), enabled })
  const redeploys = useQuery({ ...listRedeploysOptions(query), enabled })
  const hints = useHints(id, enabled)

  if (
    !Number.isInteger(id) ||
    (lab.error instanceof ApiError && lab.error.code === 'LAB_NOT_FOUND')
  )
    return <NotFoundPage />
  const l = lab.data
  const failed = [lab, events, verifications, redeploys, hints].some((q) => q.isError)
  const loaded = events.data && verifications.data && redeploys.data && hints.data

  return (
    <div className="mx-auto w-full max-w-200 px-4 pt-8 pb-14 sm:px-6">
      <Link
        to="/records"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />내 기록
      </Link>
      {failed && (
        <FormAlert tone="error">기록을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</FormAlert>
      )}
      {l && (
        <>
          <Header
            lab={l}
            stats={
              loaded
                ? {
                    attack: verifications.data.filter((v) => v.type === 'ATTACK').length,
                    defense: verifications.data.filter((v) => v.type === 'DEFENSE').length,
                    hints: hints.data.hints.length,
                    redeploys: redeploys.data.length,
                  }
                : undefined
            }
          />
          <h2 className="mt-8 border-b pb-2 text-[13px] font-semibold text-muted-foreground">
            이 실습의 기록
          </h2>
          {loaded && (
            <Timeline
              records={sessionRecords(
                l,
                events.data,
                verifications.data,
                hints.data.hints,
                redeploys.data,
              )}
              verifications={verifications.data}
              attackSkipped={l.attackSkipped}
            />
          )}
          {/* 해답은 이 세션에서 연 적이 있을 때만 다시 본다. 처음 여는 것은 실습 화면에서 */}
          {l.solutionViewedAt && <SolutionSection lab={l} />}
        </>
      )}
    </div>
  )
}

function Header({
  lab,
  stats,
}: {
  lab: LabSessionResponse
  stats?: { attack: number; defense: number; hints: number; redeploys: number }
}) {
  const live = labResult(lab).tone === 'active'
  const [now] = useState(Date.now)
  const start = new Date(lab.createdAt)
  const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  const items: [string, string][] = stats
    ? [
        [live ? '지금까지' : '걸린 시간', labDuration(lab, now)],
        ['공격 검증', lab.attackSkipped && stats.attack === 0 ? '건너뜀' : `${stats.attack}번`],
        ['방어 검증', `${stats.defense}번`],
        ['힌트', `${stats.hints}개`],
        ['재배포·초기화', `${stats.redeploys}번`],
      ]
    : []
  return (
    <header className="mt-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{lab.challengeTitle}</h1>
            <ResultChip lab={lab} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground tabular-nums">
            {date} {clockTime(lab.createdAt)} 시작
            {lab.status === 'FAILED' && ' · 실습 환경을 만들지 못했어요'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2 sm:mt-1">
          {live && (
            <Link to={`/labs/${lab.id}`} className={buttonVariants({ size: 'sm' })}>
              실습으로 돌아가기
            </Link>
          )}
          <Link
            to={`/problems/${lab.challengeId}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            문제 보기
          </Link>
        </div>
      </div>
      {/* 이 실습이 어땠는지 숫자로 먼저 본다. 환경을 만들지 못한 세션은 셀 것이 없다 */}
      {lab.status !== 'FAILED' && (
        <dl className="mt-6 grid min-h-[74px] grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-5">
          {items.map(([label, value]) => (
            <div key={label} className="bg-card px-4 py-3 last:col-span-2 sm:last:col-span-1">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  )
}

const STAGE_NAME = { ATTACK: '공격 단계', DEFENSE: '방어 단계' } as const

function Timeline({
  records,
  verifications,
  attackSkipped,
}: {
  records: LabRecord[]
  verifications: VerificationResponse[]
  attackSkipped: boolean
}) {
  if (records.length === 0)
    return <p className="py-6 text-sm text-muted-foreground">아직 기록이 없어요.</p>
  return (
    // 시각 열(44px)과 간격(12px) 뒤 점 열(20px)의 가운데를 지나는 세로선 하나
    <ol
      aria-label="이 실습의 기록"
      className="relative pt-2 before:absolute before:inset-y-5 before:left-[65.5px] before:w-px before:bg-border"
    >
      {recordSections(records, attackSkipped).map((section, i) => (
        <li key={i}>
          {section.stage && (
            <h3 className="grid grid-cols-[44px_20px_1fr] gap-x-3 pt-5 pb-1 text-xs font-semibold text-muted-foreground">
              <span className="col-start-3">
                {STAGE_NAME[section.stage]}
                {section.skipped && ' · 건너뜀'}
              </span>
            </h3>
          )}
          <ol>
            {section.records.map((record) => (
              <TimelineItem
                key={record.key}
                record={record}
                verification={verifications.find((v) => `v${v.id}` === record.key)}
              />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  )
}

function TimelineItem({
  record,
  verification,
}: {
  record: LabRecord
  verification?: VerificationResponse
}) {
  const row = <RecordRow record={record} />
  // 방어 검증은 펼쳐서 기존 공격 차단·정상 기능 결과를 본다
  if (verification?.type === 'DEFENSE' && verification.securityPassed !== null)
    return (
      <li>
        <details className="group">
          <summary className="-mx-2.5 flex cursor-pointer list-none items-start rounded-md px-2.5 hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
            {row}
            <ChevronRightIcon
              className="mt-3.5 ml-2 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none"
              aria-hidden
            />
          </summary>
          <div className="pb-4 pl-[88px]">
            <DefenseResult verification={verification} />
          </div>
        </details>
      </li>
    )
  return (
    // 펼치는 줄의 화살표 자리를 비워 판정 표시를 같은 열에 맞춘다
    <li className="-mx-2.5 flex items-start px-2.5">
      {row}
      <span className="ml-2 size-4 shrink-0" />
    </li>
  )
}

/** 점: 검증은 판정 색, 시작·완료·종료는 굵은 점, 나머지(힌트, 재배포, 준비, 해답)는 작은 빈 점 */
function dotClass(record: LabRecord) {
  if (record.key === 'completed') return 'size-3 bg-pass'
  if (record.key === 'failed') return 'size-3 bg-fail'
  if (record.status === 'PASS') return 'size-2.5 bg-pass'
  if (record.status === 'FAIL') return 'size-2.5 bg-fail'
  if (record.status) return 'size-2.5 border-2 border-muted-foreground bg-background'
  if (record.milestone) return 'size-3 bg-foreground'
  return 'size-2 border-2 border-muted-foreground/60 bg-background'
}

function RecordRow({ record }: { record: LabRecord }) {
  const strong = record.milestone || record.status !== undefined
  return (
    <div className="grid flex-1 grid-cols-[44px_20px_1fr_auto] items-start gap-x-3 py-2.5">
      <span className="pt-0.5 font-mono text-[13px] text-muted-foreground">
        {clockTime(record.at)}
      </span>
      <span className="flex h-6 items-center justify-center">
        <span className={cn('relative rounded-full', dotClass(record))} />
      </span>
      <span className="min-w-0 pt-0.5">
        <span
          data-slot="record-title"
          className={cn('block text-sm', strong ? 'font-semibold' : 'text-foreground/80')}
        >
          {record.title}
        </span>
        {record.detail && (
          <span className="mt-0.5 block text-[13px] text-muted-foreground">{record.detail}</span>
        )}
      </span>
      {record.status && record.status !== 'RUNNING' && <Verdict status={record.status} />}
    </div>
  )
}

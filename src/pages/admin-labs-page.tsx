import { Tabs } from '@base-ui/react/tabs'
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { listAdminLabsOptions } from '@/api/generated/@tanstack/react-query.gen'
import type { AdminLabFilter, AdminLabSessionResponse } from '@/api/generated/types.gen'
import { AdminHeader } from '@/components/admin/admin-header'
import { SmallButton } from '@/components/admin/small-button'
import { TerminateDialog, type TerminateTarget } from '@/components/admin/terminate-dialog'
import { FormAlert } from '@/components/form'
import { Pagination } from '@/components/pagination'
import { adminProgress, adminStatus, adminTime, canTerminate } from '@/lib/admin'
import { cn } from '@/lib/utils'

const FILTERS: [AdminLabFilter, string][] = [
  ['ACTIVE', '진행 중'],
  ['ALL', '전체'],
]

const EMPTY: Record<AdminLabFilter, [string, string]> = {
  ACTIVE: ['진행 중인 실습이 없어요', '학습자가 실습을 시작하면 여기에 보여요.'],
  ALL: ['아직 실습 기록이 없어요', '학습자가 실습을 시작하면 여기에 남아요.'],
}

/** 진행 중 목록은 자동 종료 시각과 상태가 바뀌니 다시 불러온다 */
const REFRESH_MS = 10_000

/**
 * `/admin/labs` 실습 세션(ADR 026): 진행 중 기본과 전체, 최근 시작 순, 페이지는 주소에.
 * 줄마다 학습자, 문제, 상태, 진행, 시간과 강제 종료. 문제를 누르면 그 세션의 기록
 */
export function AdminLabsPage() {
  const [params, setParams] = useSearchParams()
  const filter: AdminLabFilter = params.get('status') === 'ALL' ? 'ALL' : 'ACTIVE'
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const [target, setTarget] = useState<TerminateTarget | null>(null)
  const [error, setError] = useState<string>()

  // 탭마다 수를 보여 주려고 두 목록의 첫 쪽을 함께 묻는다
  const counts = useQueries({
    queries: FILTERS.map(([status]) => ({
      ...listAdminLabsOptions({ query: { status } }),
      refetchInterval: REFRESH_MS,
    })),
  })
  const list = useQuery({
    ...listAdminLabsOptions({ query: { status: filter, page } }),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  })
  const data = list.data

  return (
    <div className="mx-auto w-full max-w-332 px-4 pt-10 pb-14 sm:px-11">
      <AdminHeader />
      <p className="mt-4 text-sm text-muted-foreground">
        학습자의 실습을 보고, 필요하면 강제로 종료해요.
      </p>
      {error && <FormAlert tone="error">{error}</FormAlert>}
      <Tabs.Root
        value={filter}
        onValueChange={(value) =>
          setParams(value === 'ALL' ? { status: 'ALL' } : {}, { replace: true })
        }
      >
        <Tabs.List className="mt-5.5 flex gap-1 border-b">
          {FILTERS.map(([status, label], i) => (
            <Tabs.Tab
              key={status}
              value={status}
              className="group -mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.25 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-active:border-primary data-active:font-semibold data-active:text-foreground"
            >
              {label}
              <span className="rounded-md bg-muted px-1.5 text-xs leading-4.5 font-semibold text-muted-foreground tabular-nums group-data-active:bg-primary group-data-active:text-primary-foreground">
                {counts[i].data?.totalItems ?? ''}
              </span>
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {FILTERS.map(([status]) => (
          <Tabs.Panel key={status} value={status} className="outline-none">
            {status !== filter ? null : list.isError ? (
              <FormAlert tone="error">
                실습 세션을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.
              </FormAlert>
            ) : !data ? null : data.items.length === 0 ? (
              <div className="py-14 text-center text-sm text-muted-foreground">
                <p className="mb-1 font-semibold text-foreground">{EMPTY[status][0]}</p>
                {EMPTY[status][1]}
              </div>
            ) : (
              <>
                <SessionTable
                  sessions={data.items}
                  dim={list.isPlaceholderData}
                  now={list.dataUpdatedAt}
                  onTerminate={(s) =>
                    setTarget({
                      id: s.session.id,
                      name: s.userName,
                      challengeTitle: s.session.challengeTitle,
                    })
                  }
                />
                {data.totalPages > 1 && (
                  <Pagination
                    page={page}
                    totalPages={data.totalPages}
                    totalItems={data.totalItems}
                    size={data.size}
                    onPage={(p) =>
                      setParams({ ...(filter === 'ALL' && { status: 'ALL' }), page: String(p) })
                    }
                  />
                )}
              </>
            )}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
      <TerminateDialog
        target={target}
        onClose={() => setTarget(null)}
        onError={(message) => setError(message)}
      />
    </div>
  )
}

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const TONE = {
  active: 'bg-primary text-primary-foreground',
  prep: 'border border-primary/50 text-primary',
  muted: 'border text-muted-foreground',
  fail: 'border border-fail/50 text-fail',
}

/** 남은 시간은 목록을 받은 시각(now) 기준이라 다시 불러올 때마다(10초) 새로 센다 */
function SessionTable({
  sessions,
  dim,
  now,
  onTerminate,
}: {
  sessions: AdminLabSessionResponse[]
  dim: boolean
  now: number
  onTerminate: (session: AdminLabSessionResponse) => void
}) {
  return (
    <div className={cn('relative overflow-x-auto', dim && 'opacity-60')}>
      <table className="mt-1 w-full min-w-220 border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b text-left text-xs text-subtle-foreground">
            <th className="px-3 pt-3 pb-2 font-medium">시작</th>
            <th className="px-3 pt-3 pb-2 font-medium">학습자</th>
            <th className="px-3 pt-3 pb-2 font-medium">문제</th>
            <th className="px-3 pt-3 pb-2 font-medium">상태</th>
            <th className="px-3 pt-3 pb-2 font-medium">진행</th>
            <th className="px-3 pt-3 pb-2 font-medium">시간</th>
            <th className="px-3 pt-3 pb-2">
              <span className="sr-only">동작</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const lab = s.session
            const status = adminStatus(lab)
            return (
              <tr key={lab.id} className="border-b align-top">
                <td className="px-3 py-3.25 whitespace-nowrap text-muted-foreground tabular-nums">
                  {dateFormat.format(new Date(lab.createdAt))}
                </td>
                <td className="px-3 py-3.25">
                  <span className="font-semibold">{s.userName}</span>
                  <span className="ml-1.5 text-muted-foreground">{s.userNickname}</span>
                  <div className="mt-0.5 text-[12.5px] text-muted-foreground">{s.userEmail}</div>
                </td>
                <td className="max-w-70 px-3 py-3.25">
                  <Link
                    to={`/admin/labs/${lab.id}`}
                    state={{ learner: s }}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {lab.challengeTitle}
                  </Link>
                  <div className="mt-0.5 font-mono text-[12px] text-subtle-foreground">
                    #{lab.id}
                  </div>
                </td>
                <td className="px-3 py-3.25 whitespace-nowrap">
                  <span
                    className={cn('rounded-md px-2 py-0.5 text-xs font-medium', TONE[status.tone])}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="px-3 py-3.25 text-muted-foreground">
                  {adminProgress(lab) === '완료' ? (
                    <span className="font-medium text-pass">완료</span>
                  ) : (
                    adminProgress(lab)
                  )}
                </td>
                <td className="px-3 py-3.25 whitespace-nowrap text-muted-foreground tabular-nums">
                  {adminTime(lab, now)}
                </td>
                <td className="px-3 py-3.25 text-right whitespace-nowrap">
                  {canTerminate(lab) && (
                    <SmallButton danger onClick={() => onTerminate(s)}>
                      강제 종료
                    </SmallButton>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

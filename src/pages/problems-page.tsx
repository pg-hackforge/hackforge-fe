import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { listChallengesOptions } from '@/api/generated/@tanstack/react-query.gen'
import { useCurrentLab } from '@/api/labs'
import type {
  ChallengeFacetsResponse,
  ChallengeMyStatus,
  ChallengeResponse,
  ChallengeSort,
} from '@/api/generated/types.gen'
import { FormAlert } from '@/components/form'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  DIFFICULTY_DOTS,
  DIFFICULTY_LABEL,
  MY_STATUS_LABEL,
  pageItems,
  readProblemQuery,
  SORT_LABEL,
  toApiQuery,
  writeProblemQuery,
  type ProblemQuery,
} from '@/lib/problems'
import { cn } from '@/lib/utils'

/** 필터를 모두 뺀 조건. 정렬은 그대로 둔다 */
const NO_FILTERS = {
  q: '',
  categories: [],
  difficulties: [],
  myStatuses: [],
} satisfies Partial<ProblemQuery>

/** 분류 목록에서 처음에 보이는 수 */
const CATEGORY_PREVIEW = 8

/** `/problems` 문제 목록(DESIGN.md "메인", 캡처 `design/screens/main-problems-*`). 조건은 주소에 둔다 */
export function ProblemsPage() {
  const [params, setParams] = useSearchParams()
  const query = readProblemQuery(params)
  const list = useQuery({
    ...listChallengesOptions({ query: toApiQuery(query) }),
    placeholderData: keepPreviousData,
  })
  const currentLab = useCurrentLab().data

  // 조건을 바꾸면 1쪽부터. 검색어 입력처럼 잦은 변경은 기록을 쌓지 않는다
  const update = (change: Partial<ProblemQuery>, replace = false) =>
    setParams(writeProblemQuery({ ...query, page: 1, ...change }), { replace })

  const data = list.data
  return (
    <div className="mx-auto w-full max-w-310 px-4 pt-10 pb-14 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">문제</h1>
      <p className="mt-1 text-sm text-muted-foreground tabular-nums">
        {data ? `${data.totalItems}개` : ' '}
      </p>
      <div className="mt-6 grid grid-cols-[232px_1fr] items-start gap-5">
        <Filters facets={data?.facets} query={query} onChange={update} />
        <div className="min-w-0">
          <div className="flex gap-2.5">
            <SearchBox value={query.q} onChange={(q) => update({ q }, true)} />
            <SortMenu
              sort={query.sort}
              reverse={query.reverse}
              onChange={(sort, reverse) => update({ sort, reverse })}
            />
          </div>
          <AppliedFilters
            query={query}
            categoryNames={new Map(data?.facets.categories.map((c) => [c.key, c.name]))}
            onChange={update}
          />
          {list.isError ? (
            <FormAlert tone="error">
              문제 목록을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.
            </FormAlert>
          ) : data && data.items.length === 0 ? (
            <Empty onClear={() => update(NO_FILTERS)} />
          ) : (
            <ProblemTable
              items={data?.items}
              activeChallengeId={currentLab?.challengeId}
              dim={list.isPlaceholderData}
            />
          )}
          {data && data.totalPages > 0 && (
            <Pagination
              page={query.page}
              totalPages={data.totalPages}
              totalItems={data.totalItems}
              size={data.size}
              onPage={(page) => setParams(writeProblemQuery({ ...query, page }))}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function Filters({
  facets,
  query,
  onChange,
}: {
  facets?: ChallengeFacetsResponse
  query: ProblemQuery
  onChange: (change: Partial<ProblemQuery>) => void
}) {
  const [allCategories, setAllCategories] = useState(false)
  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  const categories = facets?.categories ?? []
  const shown = allCategories
    ? categories
    : categories.filter((c, i) => i < CATEGORY_PREVIEW || query.categories.includes(c.key))

  return (
    <aside className="rounded-xl border bg-card px-4 py-4.5 text-sm">
      <FilterGroup title="분류">
        {shown.map((c) => (
          <FilterOption
            key={c.key}
            label={c.name}
            count={c.count}
            checked={query.categories.includes(c.key)}
            onChange={() => onChange({ categories: toggle(query.categories, c.key) })}
          />
        ))}
        {!allCategories && categories.length > shown.length && (
          <button
            type="button"
            className="mt-1 px-1 py-1 text-[13px] text-muted-foreground hover:text-foreground"
            onClick={() => setAllCategories(true)}
          >
            분류 {categories.length - shown.length}개 더 보기
          </button>
        )}
      </FilterGroup>
      <FilterGroup title="난이도">
        {facets?.difficulties.map((d) => (
          <FilterOption
            key={d.difficulty}
            label={DIFFICULTY_LABEL[d.difficulty]}
            count={d.count}
            checked={query.difficulties.includes(d.difficulty)}
            onChange={() => onChange({ difficulties: toggle(query.difficulties, d.difficulty) })}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="내 상태">
        {facets?.myStatuses.map((s) => (
          <FilterOption
            key={s.myStatus}
            label={MY_STATUS_LABEL[s.myStatus]}
            count={s.count}
            checked={query.myStatuses.includes(s.myStatus)}
            onChange={() => onChange({ myStatuses: toggle(query.myStatuses, s.myStatus) })}
          />
        ))}
      </FilterGroup>
    </aside>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="not-first:mt-5">
      <legend className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">{title}</legend>
      <div className="flex flex-col">{children}</div>
    </fieldset>
  )
}

function FilterOption({
  label,
  count,
  checked,
  onChange,
}: {
  label: string
  count: number
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.25 hover:bg-muted/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-3.75 rounded accent-primary"
      />
      <span className={cn('flex-1', checked && 'font-medium')}>{label}</span>
      <span className="font-mono text-xs text-muted-foreground tabular-nums">{count}</span>
    </label>
  )
}

/** 입력 뒤 0.3초 쉬면 검색한다. `/`를 누르면 검색 칸으로 간다(입력 중이 아닐 때) */
function SearchBox({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const [text, setText] = useState(value)
  // 주소의 검색어가 밖에서 바뀌면(조건 모두 지우기, 뒤로 가기) 입력 칸도 따라간다
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    setText(value)
  }
  const input = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const type = (next: string) => {
    setText(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(next), 300)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key !== '/' || target.closest('input, textarea, [contenteditable]')) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <label className="flex h-10 flex-1 items-center gap-2.5 rounded-lg border bg-card px-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
      <SearchIcon className="size-4 text-muted-foreground" aria-hidden />
      <input
        ref={input}
        type="search"
        value={text}
        onChange={(e) => type(e.target.value)}
        placeholder="제목, 요약, 분류로 검색"
        aria-label="문제 검색"
        maxLength={100}
        className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <kbd className="rounded border px-1.5 font-mono text-[11px] text-muted-foreground">/</kbd>
    </label>
  )
}

/** 정렬 드롭다운(hackforge-docs ADR 028). 기준마다 기본 방향과 반대 방향 */
const SORT_OPTIONS = (Object.keys(SORT_LABEL) as ChallengeSort[]).flatMap((sort) =>
  [false, true].map((reverse) => ({ sort, reverse, value: `${sort}:${reverse}` })),
)

function SortMenu({
  sort,
  reverse,
  onChange,
}: {
  sort: ChallengeSort
  reverse: boolean
  onChange: (sort: ChallengeSort, reverse: boolean) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`정렬: ${SORT_LABEL[sort][reverse ? 1 : 0]}`}
        className="flex h-10 w-36 items-center justify-between gap-2 rounded-lg border bg-card px-3.5 text-sm font-medium hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {SORT_LABEL[sort][reverse ? 1 : 0]}
        <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuRadioGroup
          value={`${sort}:${reverse}`}
          onValueChange={(value) => {
            const option = SORT_OPTIONS.find((o) => o.value === value)!
            onChange(option.sort, option.reverse)
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value} closeOnClick>
              {SORT_LABEL[o.sort][o.reverse ? 1 : 0]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const COLUMNS = 'grid-cols-[72px_1fr_150px_92px_56px_116px_20px]'

function ProblemTable({
  items,
  activeChallengeId,
  dim,
}: {
  items?: ChallengeResponse[]
  activeChallengeId?: number
  dim: boolean
}) {
  return (
    <div
      className={cn(
        'mt-3 overflow-hidden rounded-xl border bg-card transition-opacity',
        dim && 'opacity-60',
      )}
    >
      <div
        role="row"
        className={cn(
          'grid items-center gap-3 border-b px-4.5 py-2.5 text-xs font-medium text-muted-foreground',
          COLUMNS,
        )}
      >
        <span>번호</span>
        <span>문제</span>
        <span>분류</span>
        <span>난이도</span>
        <span>예상</span>
        <span>내 상태</span>
        <span />
      </div>
      <ul>
        {items?.map((c) => (
          <li key={c.id} className="border-b last:border-b-0">
            <Link
              to={`/problems/${c.id}`}
              className={cn(
                'grid items-center gap-3 px-4.5 py-2.75 outline-none hover:bg-muted/50 focus-visible:bg-muted/60',
                COLUMNS,
              )}
            >
              <span className="font-mono text-[13px] text-muted-foreground tabular-nums">
                No.{c.id}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="truncate">{c.title}</span>
                  {c.isNew && (
                    <span className="shrink-0 rounded border border-foreground/70 px-1 text-[10px] leading-3.5 font-bold tracking-wide">
                      NEW
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                  {c.summary}
                </span>
              </span>
              <span>
                <span className="inline-block max-w-full truncate rounded-md border px-2 py-0.5 text-xs">
                  {c.category.name}
                </span>
              </span>
              <Difficulty value={c.difficulty} />
              <span className="text-sm tabular-nums">{c.estimatedMinutes}분</span>
              <MyStatus value={c.myStatus} active={c.id === activeChallengeId} />
              <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Difficulty({ value }: { value: ChallengeResponse['difficulty'] }) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn(
              'size-1.5 rounded-full',
              n <= DIFFICULTY_DOTS[value] ? 'bg-foreground' : 'bg-muted-foreground/40',
            )}
          />
        ))}
      </span>
      {DIFFICULTY_LABEL[value]}
    </span>
  )
}

/** 진행 중 실습의 문제는 내 상태 대신 "진행 중" */
export function MyStatus({
  value,
  active = false,
}: {
  value: ChallengeMyStatus
  active?: boolean
}) {
  if (active)
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
        <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
        진행 중
      </span>
    )
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 text-sm',
        value === 'COMPLETED' ? 'font-medium text-foreground' : 'text-muted-foreground',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full',
          value === 'COMPLETED' && 'bg-pass',
          value === 'UNFINISHED' &&
            'border border-muted-foreground bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]',
          value === 'NOT_STARTED' && 'border border-muted-foreground',
        )}
      />
      {MY_STATUS_LABEL[value]}
    </span>
  )
}

/**
 * 고른 필터 칩. 지금 무엇으로 걸렀는지 목록 바로 위에 모아 보여 주고, 칩마다 빼거나 모두 지운다.
 * 조건이 없으면 보이지 않는다. 정렬은 필터가 아니라 넣지 않는다
 */
function AppliedFilters({
  query,
  categoryNames,
  onChange,
}: {
  query: ProblemQuery
  categoryNames: Map<string, string>
  onChange: (change: Partial<ProblemQuery>) => void
}) {
  const without = <T,>(list: T[], value: T) => list.filter((v) => v !== value)
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(query.q.trim()
      ? [{ key: 'q', label: `검색: ${query.q.trim()}`, remove: () => onChange({ q: '' }) }]
      : []),
    ...query.categories.map((c) => ({
      key: `c-${c}`,
      label: categoryNames.get(c) ?? c,
      remove: () => onChange({ categories: without(query.categories, c) }),
    })),
    ...query.difficulties.map((d) => ({
      key: `d-${d}`,
      label: DIFFICULTY_LABEL[d],
      remove: () => onChange({ difficulties: without(query.difficulties, d) }),
    })),
    ...query.myStatuses.map((m) => ({
      key: `m-${m}`,
      label: MY_STATUS_LABEL[m],
      remove: () => onChange({ myStatuses: without(query.myStatuses, m) }),
    })),
  ]
  if (chips.length === 0) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="고른 필터">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          aria-label={`${chip.label} 필터 빼기`}
          className="flex h-7 items-center gap-1 rounded-full border bg-card pr-2 pl-3 text-[13px] hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {chip.label}
          <XIcon className="size-3.5 text-muted-foreground" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(NO_FILTERS)}
        className="ml-1 px-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        모두 지우기
      </button>
    </div>
  )
}

function Empty({ onClear }: { onClear: () => void }) {
  return (
    <div className="mt-3 rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">
      <p className="mb-1 font-semibold text-foreground">조건에 맞는 문제가 없어요</p>
      검색어나 필터를 바꿔 보세요.
      <div className="mt-4">
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/60"
        >
          조건 모두 지우기
        </button>
      </div>
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  totalItems,
  size,
  onPage,
}: {
  page: number
  totalPages: number
  totalItems: number
  size: number
  onPage: (page: number) => void
}) {
  const from = Math.min((page - 1) * size + 1, totalItems)
  const to = Math.min(page * size, totalItems)
  const button =
    'grid size-8 place-items-center rounded-lg text-sm tabular-nums hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-40'
  return (
    <nav aria-label="페이지" className="mt-4 flex items-center justify-between">
      <span className="text-[13px] text-muted-foreground tabular-nums">
        전체 {totalItems}개 중 {from}–{to}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={button}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="이전 페이지"
        >
          <ChevronLeftIcon className="size-4" aria-hidden />
        </button>
        {pageItems(page, totalPages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="w-6 text-center text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={cn(
                button,
                p === page && 'bg-foreground font-semibold text-background hover:bg-foreground',
              )}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className={button}
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="다음 페이지"
        >
          <ChevronRightIcon className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  )
}

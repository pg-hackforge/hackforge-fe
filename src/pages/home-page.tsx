import { useQuery } from '@tanstack/react-query'
import { CheckIcon, ChevronRightIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import {
  getMyProgressOptions,
  listChallengesOptions,
  listLabsOptions,
} from '@/api/generated/@tanstack/react-query.gen'
import type {
  ChallengeResponse,
  LabSessionResponse,
  MyProgressResponse,
  UserResponse,
} from '@/api/generated/types.gen'
import { isLive, useCurrentLab } from '@/api/labs'
import { FormAlert } from '@/components/form'
import { buttonVariants } from '@/components/ui/button'
import { clockTime, formatRemaining, labResult } from '@/lib/lab'
import { cn } from '@/lib/utils'
import { Difficulty } from '@/pages/problems-page'

/** 분류별 진행에서 처음에 보이는 분류 수 */
const CATEGORY_PREVIEW = 7
/** 홈의 문제 목록과 최근 기록에서 보이는 수 */
const PREVIEW = 3

/**
 * `/` 로그인 후 홈(DESIGN.md "메인", 확정 캡처 `main-home`). 지금 할 것만: 진행 중인 실습, 끝내지 못한 문제,
 * 새로 추가된 문제, 내 진행, 최근 기록. 아직 푼 문제가 없거나 승인 전이면 처음 안내(시안 `main/02-home-first`)
 */
export function HomePage({ me }: { me: UserResponse }) {
  const progress = useQuery(getMyProgressOptions())
  const current = useCurrentLab().data
  const live = isLive(current) ? current : undefined
  const approved = me.status === 'APPROVED'
  const first =
    !approved ||
    (progress.data && progress.data.completed === 0 && progress.data.unfinished === 0 && !live)

  return (
    <div className="mx-auto w-full max-w-310 px-4 pt-10 pb-14 sm:px-6">
      {progress.isError && (
        <FormAlert tone="error">홈 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</FormAlert>
      )}
      {progress.data &&
        (first ? (
          <FirstHome nickname={me.nickname} approved={approved} progress={progress.data} />
        ) : (
          <MainHome nickname={me.nickname} progress={progress.data} live={live} />
        ))}
    </div>
  )
}

function MainHome({
  nickname,
  progress,
  live,
}: {
  nickname: string
  progress: MyProgressResponse
  live?: LabSessionResponse
}) {
  const unfinished = useQuery(listChallengesOptions({ query: { myStatus: ['UNFINISHED'] } }))
  const newest = useQuery(listChallengesOptions({ query: { sort: 'NEWEST' } }))
  const labs = useQuery(listLabsOptions())
  const fresh = newest.data?.items.filter((c) => c.isNew) ?? []
  // 진행 중인 실습의 문제는 위의 띠에 있으니 끝내지 못한 문제에서 뺀다
  const pending = unfinished.data?.items.filter((c) => c.id !== live?.challengeId) ?? []

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">안녕하세요, {nickname}님</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            문제를 골라 공격하고, 고쳐서 막았는지 검증해요.
          </p>
        </div>
        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <span>
            완료 <b className="font-semibold text-foreground tabular-nums">{progress.completed}</b>
          </span>
          <span>
            끝내지 못함{' '}
            <b className="font-semibold text-foreground tabular-nums">{progress.unfinished}</b>
          </span>
          <span>
            전체 문제{' '}
            <b className="font-semibold text-foreground tabular-nums">{progress.totalChallenges}</b>
          </span>
          <Link to="/problems" className={buttonVariants({ size: 'sm' })}>
            전체 문제 보기
          </Link>
        </div>
      </div>

      {live && <CurrentLab lab={live} />}

      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {pending.length > 0 && (
            <ProblemSection
              title="끝내지 못한 문제"
              note={`시작했지만 아직 통과하지 못한 문제 ${progress.unfinished}개`}
              more="/problems?myStatus=UNFINISHED"
              items={pending}
            />
          )}
          {fresh.length > 0 && (
            <ProblemSection
              title="새로 추가된 문제"
              note={`최근 2주 · ${fresh.length}개`}
              more="/problems"
              items={fresh}
            />
          )}
          <Card title="최근 기록" more={['/records', '전체 보기']}>
            {labs.data?.items.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">아직 실습 기록이 없어요.</p>
            ) : (
              <ul>
                {labs.data?.items.slice(0, PREVIEW + 2).map((lab) => (
                  <RecentLab key={lab.id} lab={lab} />
                ))}
              </ul>
            )}
          </Card>
        </div>
        <ProgressCard progress={progress} />
      </div>
    </>
  )
}

/** 진행 중인 실습 띠: 문제, 단계, 자동 종료까지 남은 시간, [실습으로 돌아가기] */
function CurrentLab({ lab }: { lab: LabSessionResponse }) {
  const now = useNow()
  const ready = lab.status === 'READY'
  const left = lab.idleDeadline ? Date.parse(lab.idleDeadline) - now : null
  const step = lab.completedAt ? 3 : lab.stage === 'ATTACK' ? 0 : lab.defenseAttempts > 0 ? 2 : 1
  return (
    <section
      aria-label="진행 중인 실습"
      className="mt-6 flex flex-wrap items-center justify-between gap-6 rounded-xl border bg-card px-6 py-5"
    >
      <div>
        <p className="text-xs text-muted-foreground">
          진행 중인 실습 · No.{lab.challengeId} · {clockTime(lab.createdAt)} 시작
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{lab.challengeTitle}</h2>
        <ol aria-label="학습 단계" className="mt-3 flex gap-1.5 text-[13px]">
          {['공격', '방어', '방어 검증'].map((name, i) => (
            <li
              key={name}
              aria-current={i === step ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-0.5',
                i === step && 'border-primary bg-primary font-semibold text-primary-foreground',
                i > step && 'text-muted-foreground',
              )}
            >
              {i < step && <CheckIcon className="size-3.5" aria-hidden />}
              {name}
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col items-end gap-3">
        <p className="text-right text-xs text-muted-foreground">
          {ready && left !== null ? (
            <>
              자동 종료까지
              <b className="mt-0.5 block font-mono text-3xl font-semibold text-foreground tabular-nums">
                {formatRemaining(left)}
              </b>
            </>
          ) : (
            '실습 환경을 준비하고 있어요'
          )}
        </p>
        <Link to={`/labs/${lab.id}`} className={buttonVariants()}>
          실습으로 돌아가기
        </Link>
      </div>
    </section>
  )
}

/** 1초마다 지금 시각 */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function Card({
  title,
  note,
  more,
  children,
}: {
  title: string
  note?: string
  /** 오른쪽 위 링크 [주소, 글자] */
  more?: [string, string]
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card px-5 pt-4 pb-2">
      <div className="flex items-baseline justify-between gap-3 border-b pb-3">
        <h2 className="flex items-baseline gap-2 font-semibold">
          {title}
          {note && <span className="text-xs font-normal text-muted-foreground">{note}</span>}
        </h2>
        {more && (
          <Link
            to={more[0]}
            className="flex shrink-0 items-center text-xs text-muted-foreground hover:text-foreground"
          >
            {more[1]}
            <ChevronRightIcon className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function ProblemSection({
  title,
  note,
  more,
  items,
}: {
  title: string
  note: string
  more: string
  items: ChallengeResponse[]
}) {
  return (
    <Card title={title} note={note} more={[more, '모두 보기']}>
      <ul>
        {items.slice(0, PREVIEW).map((c) => (
          <ProblemRow key={c.id} challenge={c} />
        ))}
      </ul>
    </Card>
  )
}

function ProblemRow({ challenge: c }: { challenge: ChallengeResponse }) {
  return (
    <li className="grid grid-cols-[1fr_auto_auto_48px_auto] items-center gap-4 border-b py-3 last:border-b-0">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{c.title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{c.summary}</span>
      </span>
      <span className="rounded-md border px-2 py-0.5 text-xs">{c.category.name}</span>
      <Difficulty value={c.difficulty} />
      <span className="text-sm tabular-nums">{c.estimatedMinutes}분</span>
      <Link
        to={`/problems/${c.id}`}
        aria-label={`${c.title} 보기`}
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        보기
      </Link>
    </li>
  )
}

/** 내 진행: 완료한 문제 수와 분류별 완료(막대는 장식이고 수는 글자로 읽힌다) */
function ProgressCard({ progress }: { progress: MyProgressResponse }) {
  const [all, setAll] = useState(false)
  const categories = progress.categories.filter((c) => c.total > 0)
  const shown = all ? categories : categories.slice(0, CATEGORY_PREVIEW)
  return (
    <Card title="내 진행" more={['/records', '내 기록']}>
      <p className="mt-4 flex items-baseline gap-1.5">
        <b className="text-4xl font-semibold tabular-nums">{progress.completed}</b>
        <span className="text-sm text-muted-foreground">/ {progress.totalChallenges} 완료</span>
      </p>
      <Bar value={progress.completed} total={progress.totalChallenges} className="mt-3 h-1.5" />
      <ul className="mt-5 space-y-2.5 pb-3">
        {shown.map((c) => (
          <li key={c.key} className="grid grid-cols-[1fr_120px_44px] items-center gap-3 text-sm">
            <span className="truncate">{c.name}</span>
            <Bar value={c.completed} total={c.total} className="h-1" />
            <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
              {c.completed}/{c.total}
            </span>
          </li>
        ))}
      </ul>
      {categories.length > CATEGORY_PREVIEW && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="mb-3 text-[13px] text-muted-foreground hover:text-foreground"
        >
          {all ? '접기' : `분류 ${categories.length - CATEGORY_PREVIEW}개 더 보기`}
        </button>
      )}
    </Card>
  )
}

function Bar({ value, total, className }: { value: number; total: number; className?: string }) {
  return (
    <span aria-hidden className={cn('block overflow-hidden rounded-full bg-muted', className)}>
      <span
        className="block h-full rounded-full bg-primary"
        style={{ width: `${total ? (value / total) * 100 : 0}%` }}
      />
    </span>
  )
}

/** 최근 기록 한 줄: 시작 시각, 문제, 결과. 누르면 그 세션의 기록 */
function RecentLab({ lab }: { lab: LabSessionResponse }) {
  const result = labResult(lab)
  const date = new Date(lab.createdAt)
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
          {lab.defenseAttempts > 0 && (
            <span className="mt-0.5 block text-[13px] text-muted-foreground">
              방어 검증 {lab.defenseAttempts}번
            </span>
          )}
        </span>
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-xs font-medium',
            result.tone === 'pass' && 'border border-pass text-pass',
            result.tone === 'active' && 'bg-primary text-primary-foreground',
            result.tone === 'muted' && 'border text-muted-foreground',
          )}
        >
          {result.label}
        </span>
      </Link>
    </li>
  )
}

/** 처음 왔거나 승인 전: 입문 문제와 진행 순서, 분류로 둘러보기 */
function FirstHome({
  nickname,
  approved,
  progress,
}: {
  nickname: string
  approved: boolean
  progress: MyProgressResponse
}) {
  const intro = useQuery(listChallengesOptions({ query: { difficulty: ['INTRO'] } }))
  const categories = progress.categories.filter((c) => c.total > 0)
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        {approved ? `환영해요, ${nickname}님` : `안녕하세요, ${nickname}님`}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {approved ? '아직 푼 문제가 없어요.' : '승인 전에는 문제를 둘러볼 수만 있어요.'}
      </p>

      <section className="mt-6 grid gap-8 rounded-xl border bg-card px-7 py-6 lg:grid-cols-[2fr_3fr]">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">처음이라면 입문 문제부터</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            문제마다 공격 → 방어 → 방어 검증 순서로 진행해요. 막히면 힌트를 하나씩 열 수 있어요.
          </p>
          <ol className="mt-4 flex gap-1.5 text-[13px]">
            {['공격', '방어', '방어 검증'].map((name, i) => (
              <li key={name} className="rounded-full border px-2.5 py-0.5">
                {i + 1} {name}
              </li>
            ))}
          </ol>
        </div>
        <ul className="border-t">
          {intro.data?.items.slice(0, PREVIEW).map((c) => (
            <ProblemRow key={c.id} challenge={c} />
          ))}
        </ul>
      </section>

      <div className="mt-5" />
      <Card
        title="분류로 둘러보기"
        note={`${categories.length}개 분류 · 문제 ${progress.totalChallenges}개`}
        more={['/problems', '전체 문제 보기']}
      >
        <ul className="grid grid-cols-2 gap-2.5 py-4 lg:grid-cols-4">
          {categories.map((c) => (
            <li key={c.key}>
              <Link
                to={`/problems?category=${c.key}`}
                className="block rounded-lg border px-4 py-3 hover:bg-muted/50"
              >
                <span className="block text-sm font-semibold">{c.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">문제 {c.total}개</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckIcon,
  ClockIcon,
  CodeIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HistoryIcon,
  LightbulbIcon,
  LockIcon,
  MonitorIcon,
  RotateCwIcon,
  TerminalIcon,
  type LucideIcon,
} from 'lucide-react'
import { lazy, Suspense, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router'

import { ApiError } from '@/api/errors'
import {
  getChallengeOptions,
  getCurrentLabQueryKey,
} from '@/api/generated/@tanstack/react-query.gen'
import { endLab, recordLabActivity, startLab } from '@/api/generated/sdk.gen'
import type {
  LabHintsResponse,
  LabSessionResponse,
  VerificationResponse,
} from '@/api/generated/types.gen'
import {
  useHints,
  useLab,
  useRedeploy,
  useRedeploys,
  useVerification,
  useVerifications,
} from '@/api/labs'
import { useMe } from '@/api/me'
import { ActionButton, CancelButton, Dialog, DialogText } from '@/components/dialog'
import { FormAlert } from '@/components/form'
import { Logo } from '@/components/logo'
import { Markdown } from '@/components/markdown'
import { HintsPanel, Panel, Verdict, VerifyButton, VerifyNotice } from '@/components/lab/attack'
import { JobButton, RedeployNotice, ResetDialog } from '@/components/lab/jobs'
import { RecordsPanel } from '@/components/lab/records'
import { Button, buttonVariants } from '@/components/ui/button'
import { endNotice, formatRemaining, isEnded, PREP_STEPS } from '@/lib/lab'
import { serverNow, useServerNow } from '@/lib/server-clock'
import { cn } from '@/lib/utils'
import { NotFoundPage } from '@/pages/status-pages'

// xterm은 터미널을 처음 열 때 불러온다
const TerminalPanel = lazy(() =>
  import('@/components/lab/terminal-panel').then((m) => ({ default: m.TerminalPanel })),
)
// Monaco는 코드를 처음 열 때 불러온다(ADR 027)
const CodePanel = lazy(() =>
  import('@/components/lab/code-panel').then((m) => ({ default: m.CodePanel })),
)

type View = 'problem' | 'target' | 'code' | 'terminal' | 'hints' | 'records'

/**
 * `/labs/:id` 실습 화면(DESIGN.md "실습 화면", 확정 캡처 `lab-*`). 상단 줄, 왼쪽 레일, 작업 영역, 하단 상태 막대.
 * 준비 중에는 준비 단계, 끝나면 종료 안내가 작업 영역을 대신한다
 */
export function LabPage() {
  const id = Number(useParams().id)
  const lab = useLab(id)
  const me = useMe().data
  const [view, setView] = useState<View>('target')
  const [terminalOpened, setTerminalOpened] = useState(false)
  const [codeOpened, setCodeOpened] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  // 재배포 전에 편집기의 저장 안 된 내용을 저장한다
  const flushCode = useRef<() => Promise<void>>(async () => {})
  const [confirmEnd, setConfirmEnd] = useState(false)
  // 편집기에서 마지막으로 저장한 시각. 그 뒤로 재배포하지 않았으면 방어 검증 전에 알린다(ADR 025)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [confirmUndeployed, setConfirmUndeployed] = useState(false)
  const queryClient = useQueryClient()
  const end = useMutation({
    mutationFn: async () => (await endLab({ path: { id }, throwOnError: true })).data,
    onSuccess: (data) => {
      queryClient.setQueryData(['lab', id], data)
      void queryClient.invalidateQueries({ queryKey: getCurrentLabQueryKey() })
    },
    onSettled: () => setConfirmEnd(false),
  })
  const ready = lab.data?.status === 'READY'
  const verify = useVerification(id)
  const verifications = useVerifications(id, ready, verify.pending).data
  const hints = useHints(id, ready).data
  const verifying = verify.pending || !!verifications?.some((v) => v.status === 'RUNNING')
  const jobs = useRedeploy(id, () => flushCode.current())
  const redeploys = useRedeploys(id, ready, jobs.pending).data
  const redeploying = jobs.pending || !!redeploys?.some((r) => r.status === 'RUNNING')
  // 세션마다 검증, 재배포, 초기화 중 하나만 실행한다(ADR 024)
  const busy = verifying || redeploying
  // 재배포와 서비스 초기화 모두 지금 코드로 서비스를 다시 띄운다
  const lastDeployAt = redeploys?.[0] ? Date.parse(redeploys[0].startedAt) : null
  const undeployed = lastSavedAt !== null && (lastDeployAt === null || lastSavedAt > lastDeployAt)

  const choose = (next: View) => {
    setView(next)
    if (next === 'terminal') setTerminalOpened(true)
    if (next === 'code') setCodeOpened(true)
  }

  if (
    !Number.isInteger(id) ||
    (lab.error instanceof ApiError && lab.error.code === 'LAB_NOT_FOUND')
  )
    return <NotFoundPage />
  const data = lab.data
  const defense = data?.stage === 'DEFENSE'
  // 처음부터 초기화로 공격 단계가 되면 코드는 다시 잠긴다
  const shown = view === 'code' && !defense ? 'target' : view

  return (
    <div className="flex h-svh min-w-[1280px] flex-col bg-background">
      <TopBar
        lab={data}
        onEnd={() => setConfirmEnd(true)}
        action={
          ready && (
            <>
              {defense && (
                <JobButton
                  busy={busy}
                  running={jobs.pending && !jobs.resetting}
                  onClick={jobs.redeploy}
                >
                  {jobs.pending && !jobs.resetting ? '재배포 중…' : '재배포'}
                </JobButton>
              )}
              <JobButton busy={busy} running={jobs.resetting} onClick={() => setConfirmReset(true)}>
                {jobs.resetting ? '초기화 중…' : '초기화'}
              </JobButton>
              <VerifyButton
                type={defense ? 'DEFENSE' : 'ATTACK'}
                busy={busy}
                onClick={() =>
                  !defense
                    ? verify.start('ATTACK')
                    : undeployed
                      ? setConfirmUndeployed(true)
                      : verify.start('DEFENSE')
                }
              />
            </>
          )
        }
      />
      <div className="flex min-h-0 flex-1">
        <Rail
          view={view}
          lab={data}
          hints={hints}
          records={(verifications?.length ?? 0) + (redeploys?.length ?? 0)}
          onChoose={choose}
        />
        <main className="flex min-w-0 flex-1 flex-col p-3 pl-0">
          {lab.isError && !data ? (
            <FormAlert tone="error">
              실습을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.
            </FormAlert>
          ) : !data ? null : ready ? (
            <>
              <IdleWarning lab={data} />
              <VerifyNotice
                result={verify.result}
                error={verify.error}
                onOpenRecords={() => choose('records')}
                onDismiss={verify.dismiss}
              />
              <RedeployNotice result={jobs.result} error={jobs.error} onDismiss={jobs.dismiss} />
              <div className="relative min-h-0 flex-1">
                {shown === 'problem' && <ProblemPanel challengeId={data.challengeId} />}
                {shown === 'target' && <TargetPanel url={data.targetUrl} />}
                {shown === 'hints' && <HintsPanel lab={data} />}
                {shown === 'records' && (
                  <RecordsPanel lab={data} verifications={verifications} redeploys={redeploys} />
                )}
                {terminalOpened && (
                  <Suspense fallback={null}>
                    <TerminalPanel labId={id} visible={shown === 'terminal'} />
                  </Suspense>
                )}
                {codeOpened && defense && (
                  <Suspense fallback={<Panel className="grid place-items-center" />}>
                    <CodePanel
                      labId={id}
                      visible={shown === 'code'}
                      lastRedeployAt={redeploys?.find((r) => r.kind === 'REDEPLOY')?.startedAt}
                      onFlush={(flush) => (flushCode.current = flush)}
                      onSaved={() => setLastSavedAt(serverNow())}
                    />
                  </Suspense>
                )}
              </div>
            </>
          ) : isEnded(data.status) || (data.status === 'TERMINATING' && data.endReason) ? (
            <EndedView lab={data} />
          ) : (
            <PrepView lab={data} />
          )}
        </main>
      </div>
      <StatusBar lab={data} latest={verifications?.[0]} nickname={me?.nickname} />
      <Dialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="실습을 종료할까요?"
        actions={
          <>
            <CancelButton />
            <ActionButton danger disabled={end.isPending} onClick={() => end.mutate()}>
              실습 종료
            </ActionButton>
          </>
        }
      >
        <DialogText>실습 환경과 그 안에서 고친 코드가 지워져요. 검증 기록은 남아요.</DialogText>
      </Dialog>
      <Dialog
        open={confirmUndeployed}
        onClose={() => setConfirmUndeployed(false)}
        title="재배포하지 않은 변경이 있어요"
        actions={
          <>
            <CancelButton />
            <ActionButton
              onClick={() => {
                setConfirmUndeployed(false)
                verify.start('DEFENSE')
              }}
            >
              그대로 검증하기
            </ActionButton>
          </>
        }
      >
        <DialogText>
          방어 검증은 지금 떠 있는 서비스를 시험해요. 마지막 재배포 뒤에 저장한 코드는 [재배포]를
          해야 서비스에 반영돼요.
        </DialogText>
      </Dialog>
      {data && (
        <ResetDialog
          open={confirmReset}
          stage={data.stage}
          onClose={() => setConfirmReset(false)}
          onReset={jobs.reset}
        />
      )}
    </div>
  )
}

/** 단계 표시: 공격 → 방어 → 방어 검증. 방어 검증을 한 번이라도 하면 방어 검증, 첫 PASS(완료)면 셋 다 끝남 */
function stageIndex(lab: LabSessionResponse) {
  if (lab.completedAt) return 3
  if (lab.stage === 'ATTACK') return 0
  return lab.defenseAttempts > 0 ? 2 : 1
}

function TopBar({
  lab,
  onEnd,
  action,
}: {
  lab?: LabSessionResponse
  onEnd: () => void
  /** 주 버튼(공격 검증 요청 등) */
  action?: ReactNode
}) {
  const live = lab && !isEnded(lab.status) && lab.status !== 'TERMINATING'
  return (
    <header className="flex h-12 shrink-0 items-center gap-5 border-b bg-card px-4">
      <Link to="/" aria-label="Hackforge 홈" className="rounded-md">
        <Logo compact />
      </Link>
      <nav aria-label="주 메뉴" className="flex items-center gap-1 text-sm">
        {[
          ['/problems', '문제'],
          ['/records', '내 기록'],
        ].map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className="rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground"
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {lab && (
        <>
          <span className="h-4 border-l" aria-hidden />
          <span className="truncate text-sm text-muted-foreground">
            {lab.challengeTitle} <span className="font-mono text-xs">No.{lab.challengeId}</span>
          </span>
          <ol aria-label="학습 단계" className="flex items-center gap-1.5 text-[13px]">
            {['공격', '방어', '방어 검증'].map((name, i) => {
              const current = stageIndex(lab)
              return (
                <li key={name} className="flex items-center gap-1.5">
                  {i > 0 && <span className="h-px w-4 bg-border" aria-hidden />}
                  <span
                    aria-current={i === current ? 'step' : undefined}
                    className={cn(
                      'flex items-center gap-1 rounded-full px-2.5 py-0.5',
                      i === current && 'bg-primary font-semibold text-primary-foreground',
                      i < current && 'text-foreground',
                      i > current && 'text-muted-foreground',
                    )}
                  >
                    {i < current && <CheckIcon className="size-3.5" aria-hidden />}
                    {name}
                  </span>
                </li>
              )
            })}
          </ol>
        </>
      )}
      <div className="ml-auto flex items-center gap-2">
        {action}
        {live && (
          <Button variant="ghost" size="sm" onClick={onEnd}>
            실습 종료
          </Button>
        )}
      </div>
    </header>
  )
}

const RAIL: [View, string, LucideIcon][] = [
  ['problem', '문제', FileTextIcon],
  ['target', '공격 대상', MonitorIcon],
  ['code', '코드', CodeIcon],
  ['terminal', '터미널', TerminalIcon],
  ['hints', '힌트', LightbulbIcon],
  ['records', '기록', HistoryIcon],
]

/** 왼쪽 레일. 하나를 고르면 작업 영역 전체가 그 화면이 된다. 공격 단계에서 코드는 잠긴다 */
function Rail({
  view,
  lab,
  hints,
  records,
  onChoose,
}: {
  view: View
  lab?: LabSessionResponse
  hints?: LabHintsResponse
  /** 검증 기록 수 */
  records?: number
  onChoose: (view: View) => void
}) {
  const ready = lab?.status === 'READY'
  return (
    <nav aria-label="실습 화면" className="flex w-18 shrink-0 flex-col items-center gap-1 py-3">
      {RAIL.map(([key, label, Icon]) => {
        const locked = key === 'code' && lab?.stage !== 'DEFENSE'
        // 힌트는 지금 단계에서 연 수와 전체 수, 기록은 검증 수
        const badge =
          key === 'hints' && lab && hints
            ? lab.stage === 'ATTACK'
              ? `${lab.attackHintsRevealed}/${hints.attackTotal}`
              : `${lab.defenseHintsRevealed}/${hints.defenseTotal}`
            : key === 'records' && records
              ? String(records)
              : null
        return (
          <button
            key={key}
            type="button"
            disabled={!ready || locked}
            aria-pressed={view === key}
            title={locked ? '방어 단계에서 열려요' : undefined}
            onClick={() => onChoose(key)}
            className={cn(
              'flex w-15 flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-45',
              ready && view === key && 'border bg-card text-primary shadow-xs',
            )}
          >
            <Icon className="size-4.5" aria-hidden />
            {label}
            {locked && <LockIcon className="size-3" aria-label="잠김" />}
            {badge && (
              <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{badge}</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

function StatusBar({
  lab,
  latest,
  nickname,
}: {
  lab?: LabSessionResponse
  latest?: VerificationResponse
  nickname?: string
}) {
  const now = useServerNow()
  const deadline = lab?.idleDeadline ? Date.parse(lab.idleDeadline) : null
  const stage = lab ? ['공격', '방어', '방어 검증', '실습 완료'][stageIndex(lab)] : ''
  return (
    <footer className="flex h-7.5 shrink-0 items-center gap-4 border-t bg-card px-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden />
        단계 <b className="font-semibold text-foreground">{stage}</b>
      </span>
      {lab && (
        <span className="flex items-center gap-1.5 border-l pl-4">
          마지막 검증{' '}
          {latest ? (
            <Verdict status={latest.status} className="h-4.5 px-1.5 text-[10.5px]" />
          ) : (
            <b className="font-semibold text-foreground">없음</b>
          )}
        </span>
      )}
      <span className="ml-auto flex items-center gap-1.5 tabular-nums">
        {deadline && (
          <>
            자동 종료까지{' '}
            <b className="font-mono font-semibold text-foreground">
              {formatRemaining(deadline - now)}
            </b>
          </>
        )}
      </span>
      {nickname && <span className="border-l pl-4">{nickname}</span>}
    </footer>
  )
}

/** 종료 5분 전부터: 곧 끝난다는 안내와 [계속하기](openapi.yaml idle 종료) */
function IdleWarning({ lab }: { lab: LabSessionResponse }) {
  const now = useServerNow()
  const queryClient = useQueryClient()
  const keep = useMutation({
    mutationFn: async () =>
      (await recordLabActivity({ path: { id: lab.id }, throwOnError: true })).data,
    onSuccess: (data) => queryClient.setQueryData(['lab', lab.id], data),
  })
  if (!lab.idleWarningAt || !lab.idleDeadline || now < Date.parse(lab.idleWarningAt)) return null
  const left = formatRemaining(Date.parse(lab.idleDeadline) - now)
  return (
    <div
      role="alert"
      className="mb-3 flex items-center justify-between gap-4 rounded-xl border border-primary/40 bg-ember-soft px-4 py-3 text-sm"
    >
      <span>
        <ClockIcon className="mr-1.5 inline size-4 text-primary" aria-hidden />
        {lab.completedAt ? '실습을 완료했어요. ' : '입력이 없어서 '}
        <b className="font-mono tabular-nums">{left}</b> 뒤에 실습이 자동으로 끝나요.
      </span>
      <Button size="sm" disabled={keep.isPending} onClick={() => keep.mutate()}>
        계속하기
      </Button>
    </div>
  )
}

function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <Panel className="grid place-items-center text-center text-sm text-muted-foreground">
      <div>
        <p className="mb-1 font-semibold text-foreground">{title}</p>
        {text}
      </div>
    </Panel>
  )
}

function ProblemPanel({ challengeId }: { challengeId: number }) {
  const challenge = useQuery(getChallengeOptions({ path: { id: challengeId } })).data
  return (
    <Panel className="px-8 py-7">
      {challenge && (
        <div className="max-w-160">
          <h1 className="text-xl font-semibold tracking-tight">{challenge.title}</h1>
          <p className="mt-1.5 text-muted-foreground">{challenge.summary}</p>
          <Markdown className="mt-5">{challenge.description}</Markdown>
        </div>
      )}
    </Panel>
  )
}

/**
 * 공격 대상 화면(ADR 022). 공격 대상 포트의 주소를 iframe으로 연다. 문제 서비스의 화면이라 우리 테마를 따르지 않는다.
 * 다른 origin이라 iframe 안의 뒤로 가기는 못 하고, 다시 불러오기와 새 탭 열기만 둔다
 */
function TargetPanel({ url }: { url: LabSessionResponse['targetUrl'] }) {
  const [reload, setReload] = useState(0)
  if (!url) return <ComingSoon title="공격 대상" text="공격 대상 주소를 아직 받지 못했어요." />
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          aria-label="다시 불러오기"
          onClick={() => setReload((n) => n + 1)}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RotateCwIcon className="size-4" aria-hidden />
        </button>
        <span className="flex-1 truncate rounded-md border bg-background px-3 py-1 font-mono text-[12.5px]">
          {/* mock 모드의 공격 대상은 data URL이라 짧게 보인다 */}
          {url.startsWith('data:') ? 'http://localhost:8081/ (mock)' : url}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label="새 탭으로 열기"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ExternalLinkIcon className="size-4" aria-hidden />
        </a>
      </div>
      <iframe key={reload} src={url} title="공격 대상" className="min-h-0 flex-1 bg-white" />
    </div>
  )
}

/** 준비 단계(ADR 021). 단계마다 끝남·진행 중·남음 */
function PrepView({ lab }: { lab: LabSessionResponse }) {
  const now = useServerNow()
  const current = PREP_STEPS.findIndex(([step]) => step === lab.prepStep)
  const elapsed = Math.max(0, Math.floor((now - Date.parse(lab.createdAt)) / 1000))
  const terminating = lab.status === 'TERMINATING'
  return (
    <Panel className="grid place-items-center">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-lg font-semibold">
          {terminating ? '실습 환경을 정리하고 있어요' : '실습 환경을 준비하고 있어요'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          {terminating ? '잠시만 기다려 주세요.' : `보통 1분 정도 걸려요 · ${elapsed}초`}
        </p>
        {lab.retrying && (
          <FormAlert tone="info">처음 만들기에 실패해서 다시 만들고 있어요.</FormAlert>
        )}
        {!terminating && (
          <ol className="mt-5 space-y-2.5 text-left">
            {PREP_STEPS.map(([step, label], i) => (
              <li key={step} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    'grid size-5.5 place-items-center rounded-full border text-[11px] font-semibold',
                    i < current && 'border-pass bg-pass text-white',
                    i === current && 'animate-pulse border-primary text-primary',
                    i > current && 'text-muted-foreground',
                  )}
                  aria-hidden
                >
                  {i < current ? <CheckIcon className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    i > current && 'text-muted-foreground',
                    i === current && 'font-semibold',
                  )}
                >
                  {label}
                </span>
                {i === current && <span className="sr-only">(진행 중)</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  )
}

/** 끝난 실습: 사유와 다음에 할 일. 생성 실패면 다시 시작 */
function EndedView({ lab }: { lab: LabSessionResponse }) {
  const [title, text] = endNotice(lab)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const failed = lab.status === 'FAILED' || !lab.endReason
  const restart = useMutation({
    mutationFn: async () =>
      (await startLab({ body: { challengeId: lab.challengeId }, throwOnError: true })).data,
    onSuccess: (next) => {
      void queryClient.invalidateQueries({ queryKey: getCurrentLabQueryKey() })
      void navigate(`/labs/${next.id}`)
    },
  })
  return (
    <Panel className="grid place-items-center text-center">
      <div className="max-w-md">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
        {restart.error && (
          <FormAlert tone="error">
            {restart.error instanceof ApiError && restart.error.code === 'LAB_CAPACITY_FULL'
              ? '지금은 실습 자리가 모두 찼어요. 잠시 뒤 다시 시도해 주세요.'
              : restart.error.message}
          </FormAlert>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <Link
            to={`/problems/${lab.challengeId}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            문제로 돌아가기
          </Link>
          {failed ? (
            <Button disabled={restart.isPending} onClick={() => restart.mutate()}>
              다시 시작
            </Button>
          ) : (
            <Link to="/problems" className={buttonVariants()}>
              다른 문제 보기
            </Link>
          )}
        </div>
      </div>
    </Panel>
  )
}

import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { ApiError } from '@/api/errors'
import type { LabStage, RedeployResponse, ResetLabRequest } from '@/api/generated/types.gen'
import { ActionButton, CancelButton, Dialog, DialogText } from '@/components/dialog'
import { Spinner, Verdict } from '@/components/lab/attack'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** 상단 줄의 보조 버튼(재배포, 초기화). 실행 중이면 돌아가는 표시 */
export function JobButton({
  busy,
  running,
  onClick,
  children,
}: {
  /** 다른 작업이 실행 중이라 누를 수 없음 */
  busy: boolean
  /** 이 버튼의 작업이 실행 중 */
  running: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={onClick} className="gap-2">
      {running && <Spinner />}
      {children}
    </Button>
  )
}

/** 요청이 거절된 이유 */
function jobErrorText(error: Error) {
  if (error instanceof ApiError && error.code === 'LAB_JOB_RUNNING')
    return '다른 검증이나 작업이 실행 중이에요. 끝난 뒤 다시 요청해 주세요.'
  return '결과를 받지 못했어요. 기록에서 결과를 확인하거나 다시 요청해 주세요.'
}

/** 재배포·서비스 초기화 결과 안내 띠. 빌드 로그가 있으면 [빌드 로그]로 연다 */
export function RedeployNotice({
  result,
  error,
  onDismiss,
}: {
  result: RedeployResponse | null
  error: Error | null
  onDismiss: () => void
}) {
  const [logOpen, setLogOpen] = useState(false)
  if (!result && !error) return null
  const reset = result?.kind === 'RESET'
  let text: string
  if (!result) text = jobErrorText(error!)
  else if (result.status === 'SUCCESS')
    text = reset
      ? '서비스를 처음 상태로 되돌렸어요.'
      : '재배포했어요. 고친 코드로 서비스가 다시 떴어요.'
  else if (reset)
    text = '서비스 초기화에 실패했어요. [초기화]에서 실습 환경 다시 만들기를 해 보세요.'
  else if (result.status === 'FAIL') text = '재배포에 실패했어요. 빌드 로그에서 원인을 확인해요.'
  else text = '플랫폼 문제로 재배포하지 못했어요. 잠시 뒤 다시 요청해 주세요.'
  return (
    <div
      role="status"
      className={cn(
        'mb-3 flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm',
        result?.status === 'SUCCESS' && 'border-pass/50',
        result?.status === 'FAIL' && 'border-fail/50',
      )}
    >
      {(result?.status === 'FAIL' || result?.status === 'ERROR') && (
        <Verdict status={result.status} />
      )}
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{text}</b>
        {result?.message && result.status !== 'SUCCESS' && (
          <span className="ml-2 text-muted-foreground">{result.message}</span>
        )}
      </span>
      {result?.log && (
        <Button variant="outline" size="sm" onClick={() => setLogOpen(true)}>
          빌드 로그
        </Button>
      )}
      <button
        type="button"
        aria-label="안내 닫기"
        onClick={onDismiss}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <XIcon className="size-4" aria-hidden />
      </button>
      {result?.log && (
        <BuildLog
          open={logOpen}
          onClose={() => setLogOpen(false)}
          title={reset ? '서비스 초기화 로그' : '빌드 로그'}
          log={result.log}
        />
      )}
    </div>
  )
}

/** 빌드 로그(끝 64KB). 터미널처럼 어두운 면에 그대로 보여 주고 끝에서 시작한다 */
function BuildLog({
  open,
  onClose,
  title,
  log,
}: {
  open: boolean
  onClose: () => void
  title: string
  log: string
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-terminal/35 dark:bg-terminal/60" />
        <BaseDialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[80vh] w-[min(880px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[14px] border bg-card p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,.45)] outline-none">
          <div className="flex items-center justify-between">
            <BaseDialog.Title className="text-[17px] font-semibold tracking-tight">
              {title}
            </BaseDialog.Title>
            <BaseDialog.Close
              aria-label="닫기"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-4" aria-hidden />
            </BaseDialog.Close>
          </div>
          <pre
            ref={(el) => {
              if (el) el.scrollTop = el.scrollHeight
            }}
            className="mt-4 min-h-0 flex-1 overflow-auto rounded-lg bg-terminal p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-terminal-foreground scheme-dark"
          >
            {log}
          </pre>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}

/**
 * 초기화 확인 창(ADR 024). 서비스 초기화가 기본이고 실습 환경 다시 만들기는 따로 고른다.
 * 방어 단계에서는 지금 단계를 유지할지 처음(공격)부터 할지 고르고, 공격 단계에서는 묻지 않는다
 */
export function ResetDialog({
  open,
  stage,
  onClose,
  onReset,
}: {
  open: boolean
  stage: LabStage
  onClose: () => void
  onReset: (request: ResetLabRequest) => void
}) {
  const [scope, setScope] = useState<ResetLabRequest['scope']>('SERVICES')
  const [keepStage, setKeepStage] = useState(true)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="무엇을 초기화할까요?"
      actions={
        <>
          <CancelButton />
          <ActionButton
            onClick={() => {
              onReset({ scope, keepStage: stage === 'ATTACK' || keepStage })
              onClose()
            }}
          >
            초기화하기
          </ActionButton>
        </>
      }
    >
      <DialogText>고친 코드는 모두 처음 상태로 돌아가요. 검증 기록과 연 힌트는 남아요.</DialogText>
      <fieldset className="mt-4 space-y-2">
        <legend className="sr-only">초기화 범위</legend>
        <Choice
          name="scope"
          checked={scope === 'SERVICES'}
          onChange={() => setScope('SERVICES')}
          title="서비스 초기화"
          text="코드와 서비스 데이터(DB)를 처음 상태로 되돌려요. 20초 정도 걸려요."
        />
        <Choice
          name="scope"
          checked={scope === 'ENVIRONMENT'}
          onChange={() => setScope('ENVIRONMENT')}
          title="실습 환경 다시 만들기"
          text="실습 환경을 새로 만들어요. 1분 정도 걸리고 터미널이 끊겨요. 서비스 초기화로 안 될 때 써요."
        />
      </fieldset>
      {stage === 'DEFENSE' && (
        <fieldset className="mt-4 space-y-2">
          <legend className="mb-2 text-[13px] font-semibold">단계</legend>
          <Choice
            name="stage"
            checked={keepStage}
            onChange={() => setKeepStage(true)}
            title="방어 단계 유지"
          />
          <Choice
            name="stage"
            checked={!keepStage}
            onChange={() => setKeepStage(false)}
            title="처음(공격 단계)부터"
          />
        </fieldset>
      )}
    </Dialog>
  )
}

function Choice({
  name,
  checked,
  onChange,
  title,
  text,
}: {
  name: string
  checked: boolean
  onChange: () => void
  title: string
  text?: string
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13.5px]',
        checked && 'border-primary/60 bg-ember-soft/50',
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-0.5" />
      <span>
        <span className="block font-semibold">{title}</span>
        {text && <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{text}</span>}
      </span>
    </label>
  )
}

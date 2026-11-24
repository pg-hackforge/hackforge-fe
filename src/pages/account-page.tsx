import { useMutation } from '@tanstack/react-query'
import { useId, useState, type FormEvent, type ReactNode } from 'react'

import { ApiError } from '@/api/errors'
import { changeMyPassword } from '@/api/generated/sdk.gen'
import type { ChangePasswordRequest, UserResponse } from '@/api/generated/types.gen'
import { hasSession, useEndSession, useMe } from '@/api/me'
import { Field, FormAlert, PasswordRules, PasswordInput } from '@/components/form'
import { Button } from '@/components/ui/button'
import { ROLE_LABEL, STATUS_LABEL } from '@/lib/account'
import { cn, formText } from '@/lib/utils'
import { LockedAlert, type LoginState } from '@/pages/auth-pages'

/** `/account` 내 정보: 기본 정보 보기와 비밀번호 변경을 640px 한 열로(DESIGN.md "계정 화면") */
export function AccountPage() {
  const me = useMe().data
  if (!me) return null // 로그인 필요 구간 안이라 여기 오면 항상 있다
  return (
    <div className="mx-auto w-full max-w-182 px-4 pt-10 pb-14 sm:px-11">
      <h1 className="text-2xl font-semibold tracking-tight">내 정보</h1>
      <div className="mt-6 flex flex-col gap-4">
        <BasicInfo me={me} />
        <ChangePassword />
      </div>
    </div>
  )
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="rounded-xl border bg-card px-6 py-5.5">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {sub && <p className="mt-1 text-[13px] text-muted-foreground">{sub}</p>}
      {children}
    </section>
  )
}

const STATUS_CHIP: Record<UserResponse['status'], string> = {
  PENDING: 'bg-primary/14 text-primary',
  APPROVED: 'bg-pass/14 text-pass',
  REJECTED: 'bg-fail/14 text-fail',
}

const chip = 'inline-flex rounded-md px-2 py-0.5 text-xs font-medium'

const joinedAt = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' })

/** 보기만 한다. v1에는 이름·닉네임·소속을 바꾸는 API가 없다 */
function BasicInfo({ me }: { me: UserResponse }) {
  const rows: [string, ReactNode][] = [
    ['이메일', me.email],
    ['이름', me.name],
    ['닉네임', me.nickname],
    ['소속', me.affiliation],
    [
      '권한',
      <span className={cn(chip, 'bg-muted text-muted-foreground')}>{ROLE_LABEL[me.role]}</span>,
    ],
    [
      '승인 상태',
      <span className={cn(chip, STATUS_CHIP[me.status])}>{STATUS_LABEL[me.status]}</span>,
    ],
    ['가입일', joinedAt.format(new Date(me.createdAt))],
  ]
  return (
    <Panel title="기본 정보">
      <dl className="mt-4 grid grid-cols-[110px_1fr] gap-x-4 gap-y-2.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 wrap-anywhere">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

const MISMATCH = '현재 비밀번호가 맞지 않아요. 5번 잘못 입력하면 15분 동안 로그인할 수 없어요.'

/** 비밀번호 변경. 성공하면 지금 기기를 뺀 다른 세션이 끝난다(openapi.yaml) */
function ChangePassword() {
  const endSession = useEndSession()
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<'done' | 'locked' | { error: string }>()

  const mutation = useMutation({
    mutationFn: (body: ChangePasswordRequest) => changeMyPassword({ body, throwOnError: true }),
    onError: async (error) => {
      if (!(error instanceof ApiError)) return setNotice({ error: error.message })
      if (error.code === 'CURRENT_PASSWORD_MISMATCH')
        return setFieldErrors({ currentPassword: MISMATCH })
      if (error.code === 'VALIDATION_FAILED' && Object.keys(error.fieldErrors).length > 0)
        return setFieldErrors(error.fieldErrors)
      if (error.code !== 'ACCOUNT_LOCKED') return setNotice({ error: error.message })
      // 이 요청으로 잠기면 백엔드가 내 세션을 모두 지운다. 다른 곳의 로그인 실패로 이미 잠겨 있었으면 세션은 남는다
      if (await hasSession()) return setNotice('locked')
      await endSession('/login', { locked: true } satisfies LoginState)
    },
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(undefined)
    const form = event.currentTarget
    const data = new FormData(form)
    if (formText(data, 'newPasswordConfirm') !== password) {
      setFieldErrors({ newPasswordConfirm: '비밀번호가 일치하지 않아요' })
      return
    }
    mutation.mutate(
      { currentPassword: formText(data, 'currentPassword'), newPassword: password },
      {
        onSuccess: () => {
          form.reset()
          setPassword('')
          setNotice('done')
        },
      },
    )
  }

  // 고친 칸의 오류는 바로 지운다
  const clearError = (event: FormEvent<HTMLFormElement>) => {
    const { name } = event.target as HTMLInputElement
    if (!fieldErrors[name]) return
    setFieldErrors((errors) => {
      const next = { ...errors }
      delete next[name]
      return next
    })
  }

  return (
    <Panel
      title="비밀번호 변경"
      sub="비밀번호를 바꾸면 지금 쓰는 기기를 뺀 모든 기기에서 로그아웃돼요."
    >
      {notice === 'done' ? (
        <FormAlert tone="ok">비밀번호를 바꿨어요. 다른 기기에서는 로그아웃됐어요.</FormAlert>
      ) : notice === 'locked' ? (
        <LockedAlert />
      ) : notice ? (
        <FormAlert tone="error">{notice.error}</FormAlert>
      ) : null}
      <form
        onSubmit={submit}
        onChange={clearError}
        className="mt-4.5 flex max-w-95 flex-col gap-3.5"
      >
        <Field label="현재 비밀번호" error={fieldErrors.currentPassword}>
          {(control) => (
            <PasswordInput
              {...control}
              name="currentPassword"
              autoComplete="current-password"
              required
              maxLength={64}
            />
          )}
        </Field>
        <Field
          label="새 비밀번호"
          error={fieldErrors.newPassword}
          below={<PasswordRules password={password} />}
        >
          {(control) => (
            <PasswordInput
              {...control}
              name="newPassword"
              autoComplete="new-password"
              required
              maxLength={64}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        <Field label="새 비밀번호 확인" error={fieldErrors.newPasswordConfirm}>
          {(control) => (
            <PasswordInput
              {...control}
              name="newPasswordConfirm"
              autoComplete="new-password"
              required
              maxLength={64}
            />
          )}
        </Field>
        <div>
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="mt-1.5 h-10 rounded-[9px] px-4.5 font-semibold"
          >
            비밀번호 변경
          </Button>
        </div>
      </form>
    </Panel>
  )
}

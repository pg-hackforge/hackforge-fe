import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { ApiError } from '@/api/errors'
import { login, signup } from '@/api/generated/sdk.gen'
import type { LoginRequest, SignupRequest, UserResponse } from '@/api/generated/types.gen'
import { meQueryKey } from '@/api/me'
import { Field, FormAlert, PasswordRules } from '@/components/form'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** 로그인 화면으로 넘기는 state. 가입은 됐는데 이어서 하는 로그인이 실패했을 때 */
type LoginState = { from?: string; signedUpEmail?: string } | null

/**
 * 로그인·회원가입 카드(DESIGN.md "계정 화면"). 가로는 가운데, 세로는 가운데보다 살짝 위(위아래 여백 2:3)이고
 * 카드가 화면보다 길면 위에서 시작한다. 위 가장자리에 담금질 색 선
 */
function AuthCard({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 pt-12 pb-14 before:flex-2 before:content-[''] after:flex-3 after:content-['']">
      <div className="relative w-full max-w-110 shrink-0 overflow-hidden rounded-[14px] border bg-card px-6 pt-8 pb-7 sm:px-8">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-0.75 bg-[linear-gradient(90deg,var(--color-spark-1),var(--color-spark-2)_18%,var(--color-spark-3)_30%,var(--color-temper-3)_46%,var(--color-temper-4)_62%,var(--color-temper-5)_78%,var(--color-temper-6)_92%,var(--color-temper-7))]"
        />
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>}
        {children}
      </div>
    </div>
  )
}

/** 폼의 주 버튼. 폭 가득, 칸 사이 간격(14px)과 합쳐 마지막 칸에서 22px 아래 */
function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button
      type="submit"
      disabled={pending}
      className="mt-2 h-10 w-full rounded-[9px] font-semibold"
    >
      {children}
    </Button>
  )
}

function SwitchLink({
  question,
  to,
  children,
}: {
  question: string
  to: string
  children: ReactNode
}) {
  return (
    <p className="mt-4.5 text-center text-sm text-muted-foreground">
      {question}{' '}
      <Link
        to={to}
        className="font-semibold text-foreground underline decoration-input underline-offset-3"
      >
        {children}
      </Link>
    </p>
  )
}

/** 로그인에 성공하면 내 계정을 채운다. 이동은 RequireLoggedOut이 한다(원래 가려던 화면, 없으면 홈) */
function useLogIn() {
  const queryClient = useQueryClient()
  return (user: UserResponse) => queryClient.setQueryData(meQueryKey, user)
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '')

export function LoginPage() {
  const state = useLocation().state as LoginState
  const logIn = useLogIn()
  const mutation = useMutation({
    mutationFn: async (body: LoginRequest) => (await login({ body, throwOnError: true })).data,
    onSuccess: logIn,
  })
  const error = mutation.error
  const code = error instanceof ApiError ? error.code : undefined

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    mutation.mutate({ email: text(form, 'email'), password: text(form, 'password') })
  }

  return (
    <AuthCard title="로그인">
      {code === 'INVALID_CREDENTIALS' ? (
        <FormAlert tone="error">이메일 또는 비밀번호를 다시 확인해 주세요.</FormAlert>
      ) : code === 'ACCOUNT_LOCKED' ? (
        <FormAlert tone="locked" title="로그인이 잠겼어요">
          비밀번호를 5번 잘못 입력해서 15분 동안 로그인할 수 없어요. 잠시 뒤 다시 시도하거나
          관리자에게 임시 비밀번호를 요청해 주세요.
        </FormAlert>
      ) : error ? (
        <FormAlert tone="error">{error.message}</FormAlert>
      ) : state?.signedUpEmail ? (
        <FormAlert tone="info">회원가입이 완료됐어요. 로그인해 주세요.</FormAlert>
      ) : null}
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3.5">
        <Field label="이메일">
          {(control) => (
            <input
              {...control}
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              defaultValue={state?.signedUpEmail}
            />
          )}
        </Field>
        <Field
          label="비밀번호"
          invalid={code === 'INVALID_CREDENTIALS'}
          hint="비밀번호를 잊었다면 관리자에게 임시 비밀번호를 요청해 주세요."
        >
          {(control) => (
            <input
              {...control}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={64}
            />
          )}
        </Field>
        <SubmitButton pending={mutation.isPending}>로그인</SubmitButton>
      </form>
      <SwitchLink question="아직 회원이 아니신가요?" to="/signup">
        회원가입
      </SwitchLink>
    </AuthCard>
  )
}

/** 백엔드 오류를 입력 칸별 문구로. 칸에 붙일 수 없는 오류는 null(폼 전체 안내로) */
function signupFieldErrors(error: unknown): Record<string, string> | null {
  if (!(error instanceof ApiError)) return null
  if (error.code === 'EMAIL_TAKEN') return { email: '이미 가입된 이메일이에요' }
  if (error.code === 'NICKNAME_TAKEN') return { nickname: '이미 사용 중인 닉네임이에요' }
  if (error.code === 'VALIDATION_FAILED' && Object.keys(error.fieldErrors).length > 0)
    return error.fieldErrors
  return null
}

export function SignupPage() {
  const navigate = useNavigate()
  const logIn = useLogIn()
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()

  // 가입 API는 로그인까지 하지 않아서, 같은 이메일·비밀번호로 이어서 로그인한다(ADR 018)
  const mutation = useMutation({
    mutationFn: async (body: SignupRequest) => {
      await signup({ body, throwOnError: true })
      try {
        return (
          await login({ body: { email: body.email, password: body.password }, throwOnError: true })
        ).data
      } catch {
        return null
      }
    },
    onSuccess: (user, body) => {
      if (user) logIn(user)
      else void navigate('/login', { state: { signedUpEmail: body.email } satisfies LoginState })
    },
    onError: (error) => {
      const errors = signupFieldErrors(error)
      if (errors) setFieldErrors(errors)
      else setFormError(error.message)
    },
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(undefined)
    const form = new FormData(event.currentTarget)
    if (text(form, 'passwordConfirm') !== password) {
      setFieldErrors({ passwordConfirm: '비밀번호가 일치하지 않아요' })
      return
    }
    mutation.mutate({
      email: text(form, 'email'),
      password,
      name: text(form, 'name'),
      nickname: text(form, 'nickname'),
      affiliation: text(form, 'affiliation'),
      signupNote: text(form, 'signupNote') || undefined,
      privacyAgreed: true, // 체크하지 않으면 브라우저가 제출을 막는다(required)
    })
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
    <AuthCard title="회원가입" sub="가입 후 관리자가 승인하면 실습을 시작할 수 있어요.">
      {formError && <FormAlert tone="error">{formError}</FormAlert>}
      <form onSubmit={submit} onChange={clearError} className="mt-6 flex flex-col gap-3.5">
        <Field label="이메일" aside="로그인할 때 써요" error={fieldErrors.email}>
          {(control) => (
            <input
              {...control}
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          )}
        </Field>
        <Field
          label="비밀번호"
          error={fieldErrors.password}
          below={<PasswordRules password={password} />}
        >
          {(control) => (
            <input
              {...control}
              name="password"
              type="password"
              autoComplete="new-password"
              required
              maxLength={64}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        <Field label="비밀번호 확인" error={fieldErrors.passwordConfirm}>
          {(control) => (
            <input
              {...control}
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              required
              maxLength={64}
              placeholder="비밀번호를 한 번 더 입력해 주세요"
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="이름" error={fieldErrors.name}>
            {(control) => (
              <input {...control} name="name" autoComplete="name" required maxLength={50} />
            )}
          </Field>
          <Field label="닉네임" error={fieldErrors.nickname}>
            {(control) => (
              <input {...control} name="nickname" autoComplete="nickname" required maxLength={20} />
            )}
          </Field>
        </div>
        <Field label="소속" error={fieldErrors.affiliation}>
          {(control) => (
            <input
              {...control}
              name="affiliation"
              autoComplete="organization"
              required
              maxLength={100}
            />
          )}
        </Field>
        <Field
          label="가입 메모"
          aside="선택"
          error={fieldErrors.signupNote}
          hint="승인할 때 본인 확인에 참고해요."
        >
          {({ className, ...control }) => (
            <textarea
              {...control}
              name="signupNote"
              maxLength={200}
              className={cn(className, 'h-16 resize-none py-2.5')}
            />
          )}
        </Field>
        <Consent error={fieldErrors.privacyAgreed} />
        <SubmitButton pending={mutation.isPending}>가입하기</SubmitButton>
      </form>
      <SwitchLink question="이미 회원이신가요?" to="/login">
        로그인
      </SwitchLink>
    </AuthCard>
  )
}

/** 개인정보 수집·이용 동의(ADR 018). 동의 문구는 약관이라 하십시오체(ADR 019) */
function Consent({ error }: { error?: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="overflow-hidden rounded-[10px] border text-[13px]">
        <div className="flex items-center gap-2.5 px-3 py-2.75">
          <input
            id={id}
            name="privacyAgreed"
            type="checkbox"
            required
            aria-invalid={error ? true : undefined}
            className="size-4 shrink-0 accent-primary"
          />
          <label htmlFor={id} className="font-medium">
            [필수] 개인정보 수집·이용 동의
          </label>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-terms`}
            onClick={() => setOpen(!open)}
            className="ml-auto flex shrink-0 items-center gap-0.5 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {open ? '접기' : '보기'}
            <ChevronDownIcon
              className={cn('size-3.5 transition-transform', open && 'rotate-180')}
            />
          </button>
        </div>
        <ul
          id={`${id}-terms`}
          hidden={!open}
          className="space-y-0.5 border-t bg-muted px-3.5 py-3 text-xs leading-relaxed text-muted-foreground"
        >
          <li>
            <b className="font-semibold text-foreground">수집 항목</b> 이메일, 이름, 닉네임, 소속,
            가입 메모(선택), 비밀번호(복원할 수 없게 바꿔 저장), 실습 기록(실습 시각, 검증 결과)
          </li>
          <li>
            <b className="font-semibold text-foreground">이용 목적</b> 가입 승인을 위한 본인 확인,
            로그인, 실습 환경 제공과 진행 확인
          </li>
          <li>
            <b className="font-semibold text-foreground">보관 기간</b> 탈퇴를 요청하거나 서비스
            운영을 끝내면 지체 없이 파기합니다. 탈퇴는 관리자에게 요청합니다.
          </li>
          <li>동의하지 않을 수 있으며, 동의하지 않으면 가입할 수 없습니다.</li>
        </ul>
      </div>
      {error && <p className="mt-1.5 text-[12.5px] text-fail">{error}</p>}
    </div>
  )
}

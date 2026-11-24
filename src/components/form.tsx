import {
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  DotIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  LockIcon,
} from 'lucide-react'
import { useId, useState, type ComponentProps, type ReactNode } from 'react'

import { passwordRules } from '@/lib/password'
import { cn } from '@/lib/utils'

/** 입력 칸 모양(DESIGN.md "입력 칸과 안내"). 포커스는 불씨 선과 고리, 오류는 FAIL 선 */
export const inputClass =
  'h-10 w-full rounded-[9px] border border-input bg-card px-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-subtle-foreground focus:border-primary focus:ring-3 focus:ring-primary/20 aria-invalid:border-fail dark:bg-background'

type Control = {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
  className: string
}

/**
 * 이름표, 입력 칸, 칸 아래 오류와 도움말을 묶는다. 입력 칸은 children으로 받아 input, textarea 어느 쪽이든 쓴다.
 * 오류와 도움말은 aria-describedby로 칸에 연결해 화면 낭독기가 함께 읽는다.
 */
export function Field({
  label,
  aside,
  error,
  invalid,
  hint,
  below,
  children,
}: {
  label: string
  /** 이름표 오른쪽 끝의 보조 설명(선택, 로그인할 때 써요) */
  aside?: string
  error?: string
  /** 문구 없이 칸만 오류로 표시(폼 전체 안내가 이유를 말할 때) */
  invalid?: boolean
  hint?: ReactNode
  /** 칸 바로 아래에 붙는 내용(비밀번호 규칙) */
  below?: ReactNode
  children: (control: Control) => ReactNode
}) {
  const id = useId()
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ')
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-2 text-[13px]">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {aside && <span className="text-subtle-foreground">{aside}</span>}
      </div>
      {children({
        id,
        'aria-invalid': error || invalid ? true : undefined,
        'aria-describedby': describedBy || undefined,
        className: inputClass,
      })}
      {below}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-fail">
          <CircleAlertIcon className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-normal text-subtle-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

/**
 * 비밀번호 칸과 [보기] 버튼. 누르면 입력한 글자가 보이고 다시 누르면 숨긴다.
 * 이름은 그대로 두고 눌림 상태(aria-pressed)로 지금 보이는지 알린다
 */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={shown ? 'text' : 'password'} className={cn(className, 'pr-10')} />
      <button
        type="button"
        aria-label="비밀번호 보기"
        aria-pressed={shown}
        onClick={() => setShown((value) => !value)}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-[9px] text-subtle-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-primary/20"
      >
        {shown ? (
          <EyeOffIcon className="size-4" aria-hidden />
        ) : (
          <EyeIcon className="size-4" aria-hidden />
        )}
      </button>
    </div>
  )
}

const ALERT_TONES = {
  error: { icon: CircleAlertIcon, box: 'border-fail/40 bg-fail/9', mark: 'text-fail' },
  locked: { icon: LockIcon, box: 'border-fail/40 bg-fail/9', mark: 'text-fail' },
  info: { icon: InfoIcon, box: 'border-primary/35 bg-primary/8', mark: 'text-primary' },
  ok: { icon: CircleCheckIcon, box: 'border-pass/40 bg-pass/9', mark: 'text-pass' },
}

/** 폼 전체 안내 상자. 제목 아래에 둔다. 할 일이 있으면 굵은 제목 한 줄과 설명 */
export function FormAlert({
  tone,
  title,
  children,
}: {
  tone: keyof typeof ALERT_TONES
  title?: string
  children: ReactNode
}) {
  const { icon: Icon, box, mark } = ALERT_TONES[tone]
  return (
    <div
      role={tone === 'error' || tone === 'locked' ? 'alert' : 'status'}
      className={cn(
        'mt-5 flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-[13px] leading-relaxed',
        box,
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', mark)} />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  )
}

/** 비밀번호 칸 아래 규칙 한 줄. 입력하는 동안 맞는 것부터 PASS 체크로 바뀐다 */
export function PasswordRules({ password }: { password: string }) {
  return (
    <ul
      aria-label="비밀번호 규칙"
      className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-subtle-foreground"
    >
      {passwordRules(password).map(({ label, ok }) => (
        <li key={label} data-ok={ok} className="flex items-center gap-1 data-[ok=true]:text-pass">
          {ok ? <CheckIcon className="size-3.5" /> : <DotIcon className="size-3.5" />}
          <span>{label}</span>
          <span className="sr-only">{ok ? '충족' : '미충족'}</span>
        </li>
      ))}
    </ul>
  )
}

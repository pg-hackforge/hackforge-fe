import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/** 관리자 표 줄 오른쪽 끝의 작은 보조 버튼(30px). 승인은 초록, 강제 종료는 FAIL 선과 글자 */
export function SmallButton({
  approve,
  danger,
  className,
  ...props
}: ComponentProps<'button'> & { approve?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'ml-1.5 inline-flex h-7.5 items-center gap-1.25 rounded-lg border border-input bg-card px-2.75 text-[13px] font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-45 disabled:hover:bg-card [&_svg]:size-3.5',
        approve && 'border-pass/55 text-pass',
        danger && 'border-fail/50 text-fail',
        className,
      )}
      {...props}
    />
  )
}

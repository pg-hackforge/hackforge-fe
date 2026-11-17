import { useId } from 'react'

import { cn } from '@/lib/utils'

/** 로고: 모루와 불티(hackforge-docs ADR 016). 모루는 글자색, 불티 하나만 불티 그라데이션 */
export function LogoMark({ className }: { className?: string }) {
  const spark = useId()

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-6 shrink-0', className)}>
      <defs>
        <linearGradient id={spark} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-spark-1)' }} />
          <stop offset="0.45" style={{ stopColor: 'var(--color-spark-2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-spark-3)' }} />
        </linearGradient>
      </defs>
      <path
        fill="currentColor"
        d="M4 20h36c9 0 17 2.5 20 7h-15c-2.5 0-4 1.6-4 3.6V33c0 4 3 6.5 7 8v4H18v-4c4-1.5 7-4 7-8v-2.4c0-2-1.5-3.6-4-3.6H8c-2.4 0-4-1.6-4-3.5Z"
      />
      <path fill="currentColor" d="M14 49h34a2 2 0 0 1 2 2v3H12v-3a2 2 0 0 1 2-2Z" />
      <path
        fill={`url(#${spark})`}
        d="M46 6l1.6 4.4L52 12l-4.4 1.6L46 18l-1.6-4.4L40 12l4.4-1.6Z"
      />
    </svg>
  )
}

/** 로고와 이름 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <LogoMark />
      Hackforge
    </span>
  )
}

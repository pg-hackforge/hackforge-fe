import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { pageItems } from '@/lib/problems'
import { cn } from '@/lib/utils'

/** 목록 아래 페이지 이동: 전체 수와 지금 범위, 이전·번호·다음 */
export function Pagination({
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

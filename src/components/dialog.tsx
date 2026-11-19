import { AlertDialog } from '@base-ui/react/alert-dialog'
import type { ComponentProps, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * 확인 창(DESIGN.md "확인 창"). 가운데 창과 바탕을 어둡게 덮는 막.
 * 바깥을 눌러도 닫히지 않고, Esc와 [취소]로 닫는다. 버튼은 오른쪽 아래 [취소] [실행] 순서
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean
  onClose: () => void
  /** 무엇을 할지 묻는 한 문장. 창의 이름이 된다 */
  title: string
  children?: ReactNode
  actions: ReactNode
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-terminal/35 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-terminal/60" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border bg-card px-5.5 pt-5.5 pb-4.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,.45)] transition-[opacity,scale] outline-none data-ending-style:scale-97 data-ending-style:opacity-0 data-starting-style:scale-97 data-starting-style:opacity-0">
          <AlertDialog.Title className="text-[17px] font-semibold tracking-tight">
            {title}
          </AlertDialog.Title>
          {children}
          <div className="mt-5 flex justify-end gap-2">{actions}</div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

/** 확인 창의 설명 문단 */
export function DialogText({ children }: { children: ReactNode }) {
  return (
    <AlertDialog.Description className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
      {children}
    </AlertDialog.Description>
  )
}

const dialogButton = 'h-9 rounded-[9px] px-3.5 text-[13.5px] font-semibold'

/** [취소]. 누르면 창이 닫힌다 */
export function CancelButton() {
  return (
    <AlertDialog.Close render={<Button variant="outline" className={dialogButton} />}>
      취소
    </AlertDialog.Close>
  )
}

/** [실행]. 사람을 막는 동작(거절)은 danger로 FAIL 채움, 나머지는 불씨 채움 */
export function ActionButton({
  danger,
  className,
  ...props
}: ComponentProps<typeof Button> & { danger?: boolean }) {
  return (
    <Button
      className={cn(
        dialogButton,
        danger && 'bg-fail text-fail-foreground hover:bg-fail/85',
        className,
      )}
      {...props}
    />
  )
}

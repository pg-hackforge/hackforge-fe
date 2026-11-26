import { useEffect, useEffectEvent, useState, type FocusEvent } from 'react'

/**
 * 작업 영역 위 결과 안내 띠를 5초 뒤 저절로 닫는다(결과는 기록에 남는다). 띠에 마우스를 올려 두었거나,
 * 띠 안의 버튼에 초점이 있거나, 띠에서 연 창이 열려 있으면(hold) 닫지 않고 기다린다(WCAG 2.2.1)
 * @param shown 지금 보이는 결과. 바뀌면 5초를 다시 센다
 */
export function useAutoDismiss(shown: unknown, onDismiss: () => void, hold = false, ms = 5_000) {
  // 마우스·초점이 머문 결과. 다음 결과가 오면 자연히 풀린다
  const [hoveredOn, setHoveredOn] = useState<unknown>(null)
  const [focusedOn, setFocusedOn] = useState<unknown>(null)
  const dismiss = useEffectEvent(onDismiss)
  const waiting = hold || hoveredOn === shown || focusedOn === shown
  useEffect(() => {
    if (!shown || waiting) return
    const timer = setTimeout(() => dismiss(), ms)
    return () => clearTimeout(timer)
  }, [shown, waiting, ms])
  return {
    onMouseEnter: () => setHoveredOn(shown),
    onMouseLeave: () => setHoveredOn(null),
    onFocus: () => setFocusedOn(shown),
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocusedOn(null)
    },
  }
}

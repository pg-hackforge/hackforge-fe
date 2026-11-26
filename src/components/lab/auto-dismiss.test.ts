import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAutoDismiss } from './auto-dismiss'

describe('결과 안내 띠 자동 닫힘', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('10초 뒤 닫는다', () => {
    const onDismiss = vi.fn()
    renderHook(() => useAutoDismiss({ status: 'PASS' }, onDismiss))
    act(() => vi.advanceTimersByTime(9_999))
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('마우스를 올려 둔 동안은 기다리고, 내리면 다시 10초를 센다', () => {
    const onDismiss = vi.fn()
    const result = { status: 'FAIL' }
    const { result: handlers } = renderHook(() => useAutoDismiss(result, onDismiss))
    act(() => handlers.current.onMouseEnter())
    act(() => vi.advanceTimersByTime(30_000))
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => handlers.current.onMouseLeave())
    act(() => vi.advanceTimersByTime(10_000))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('띠에서 연 창이 열려 있으면 닫지 않는다', () => {
    const onDismiss = vi.fn()
    renderHook(() => useAutoDismiss({ status: 'FAIL' }, onDismiss, true))
    act(() => vi.advanceTimersByTime(60_000))
    expect(onDismiss).not.toHaveBeenCalled()
  })
})

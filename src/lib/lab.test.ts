import { describe, expect, it } from 'vitest'

import {
  clampFontSize,
  endNotice,
  formatRemaining,
  labPollInterval,
  readFontSize,
  terminalCloseNotice,
  terminalUrl,
} from './lab'

describe('실습 화면 로직', () => {
  it('준비 중에는 자주, 실습 중에는 가끔, 끝나면 조회하지 않음', () => {
    expect(labPollInterval('CREATING')).toBe(2_500)
    expect(labPollInterval('TERMINATING')).toBe(2_500)
    expect(labPollInterval('READY')).toBe(10_000)
    expect(labPollInterval('DELETED')).toBe(false)
    expect(labPollInterval('FAILED')).toBe(false)
  })

  it('남은 시간은 분:초, 음수는 0:00', () => {
    expect(formatRemaining(27 * 60_000 + 40_000)).toBe('27:40')
    expect(formatRemaining(59_001)).toBe('1:00')
    expect(formatRemaining(-5)).toBe('0:00')
  })

  it('종료 사유별 안내. 완료 뒤 입력 없음은 완료로', () => {
    expect(endNotice({ status: 'DELETED', endReason: 'ADMIN', completedAt: null })[0]).toBe(
      '관리자가 실습을 종료했어요',
    )
    expect(
      endNotice({ status: 'DELETED', endReason: 'IDLE', completedAt: '2026-11-22T10:00:00Z' })[0],
    ).toBe('실습을 완료했어요')
    expect(endNotice({ status: 'DELETED', endReason: 'IDLE', completedAt: null })[0]).toBe(
      '입력이 없어 실습이 끝났어요',
    )
    expect(endNotice({ status: 'FAILED', endReason: null, completedAt: null })[0]).toBe(
      '실습 환경을 만들지 못했어요',
    )
  })

  it('터미널 주소와 닫힌 이유', () => {
    expect(terminalUrl(42, { protocol: 'http:', host: 'localhost:5173' })).toBe(
      'ws://localhost:5173/api/labs/42/terminal',
    )
    expect(terminalUrl(42, { protocol: 'https:', host: 'hf.example' })).toBe(
      'wss://hf.example/api/labs/42/terminal',
    )
    expect(terminalCloseNotice(4410).retry).toBe(false)
    expect(terminalCloseNotice(1006)).toEqual({ text: '터미널 연결이 끊겼어요.', retry: true })
  })

  it('글자 크기는 11~20, 저장값이 없거나 이상하면 13', () => {
    expect(clampFontSize(9)).toBe(11)
    expect(clampFontSize(24)).toBe(20)
    expect(readFontSize(null)).toBe(13)
    expect(readFontSize('abc')).toBe(13)
    expect(readFontSize('16')).toBe(16)
    expect(readFontSize('99')).toBe(20)
  })
})

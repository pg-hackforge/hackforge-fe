import { afterEach, describe, expect, it } from 'vitest'

import { resetServerClock, syncServerClock, toServerTime } from './server-clock'

const at = (iso: string) => Date.parse(iso)

describe('서버 시계 보정', () => {
  afterEach(resetServerClock)

  it('기기 시계가 50초 빠르면 서버 시각으로 50초 당긴다', () => {
    // 서버 10:00:00(.5초 무렵)에 보낸 응답을 기기 시계 10:00:50.5에 받음
    syncServerClock('Thu, 26 Nov 2026 10:00:00 GMT', at('2026-11-26T10:00:50.500Z'))
    expect(toServerTime(at('2026-11-26T10:01:50.500Z'))).toBe(at('2026-11-26T10:01:00.500Z'))
  })

  it('1초 안의 흔들림은 무시해서 초가 거꾸로 가지 않는다', () => {
    syncServerClock('Thu, 26 Nov 2026 10:00:00 GMT', at('2026-11-26T10:00:00.900Z'))
    const before = toServerTime(at('2026-11-26T10:00:05.000Z'))
    syncServerClock('Thu, 26 Nov 2026 10:00:01 GMT', at('2026-11-26T10:00:01.100Z'))
    expect(toServerTime(at('2026-11-26T10:00:05.000Z'))).toBe(before)
  })

  it('Date 헤더가 없으면 기기 시계 그대로', () => {
    syncServerClock(null, at('2026-11-26T10:00:00Z'))
    expect(toServerTime(1000)).toBe(1000)
  })
})

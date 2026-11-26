import { useEffect, useState } from 'react'

/**
 * 서버 시계와 이 기기 시계의 차이(ms). 화면은 서버가 준 시각(준비 시작, 자동 종료 등)을 지금 시각과 비교하는데,
 * 기기 시계가 틀리면 경과·남은 시간이 그만큼 어긋난다. API 응답의 Date 헤더로 차이를 재서 보정한다
 */
let offset = 0
let synced = false

/** API 응답을 받을 때마다 부른다. Date 헤더가 없거나 읽을 수 없으면 그대로 둔다 */
export function syncServerClock(dateHeader: string | null, receivedAt = Date.now()) {
  const server = dateHeader ? Date.parse(dateHeader) : NaN
  if (Number.isNaN(server)) return
  // Date 헤더는 초 아래를 버려서 실제 서버 시각보다 평균 0.5초 이르다
  const next = server + 500 - receivedAt
  // 응답마다 1초 안에서 흔들린다. 그대로 따라가면 초가 거꾸로 갈 수 있어 크게 달라졌을 때만 바꾼다
  if (!synced || Math.abs(next - offset) > 1500) {
    offset = next
    synced = true
  }
}

/** 이 기기 시계로 잰 시각을 서버 시계 시각으로 */
export const toServerTime = (clientTime: number) => clientTime + offset

/** 서버 시계로 지금 시각 */
export const serverNow = () => toServerTime(Date.now())

/** 1초마다 서버 시계로 지금 시각 */
export function useServerNow() {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

/** 테스트용: 보정 전 상태로 */
export function resetServerClock() {
  offset = 0
  synced = false
}

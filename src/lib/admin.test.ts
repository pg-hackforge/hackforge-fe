import { describe, expect, it } from 'vitest'

import { adminProgress, adminStatus, adminTime, canTerminate } from './admin'

const NOW = Date.parse('2026-11-25T05:00:00Z')
const lab = {
  status: 'READY' as const,
  prepStep: null,
  stage: 'ATTACK' as const,
  attackSkipped: false,
  defenseAttempts: 0,
  completedAt: null,
  endReason: null,
  createdAt: '2026-11-25T04:40:00Z',
  endedAt: null,
  idleDeadline: '2026-11-25T05:24:00Z',
}

describe('관리자 세션', () => {
  it('상태: 준비 중이면 준비 단계, 실습 중, 종료 중, 종료, 생성 실패', () => {
    expect(adminStatus({ ...lab, status: 'CREATING', prepStep: 'CONTAINER' })).toEqual({
      label: '준비 중 · 컨테이너 시작',
      tone: 'prep',
    })
    expect(adminStatus(lab).label).toBe('실습 중')
    expect(adminStatus({ ...lab, status: 'TERMINATING' }).label).toBe('종료 중')
    expect(adminStatus({ ...lab, status: 'DELETED' }).label).toBe('종료')
    expect(adminStatus({ ...lab, status: 'FAILED' }).tone).toBe('fail')
  })

  it('진행: 완료, 공격 단계, 방어 단계와 건너뜀·방어 검증 수', () => {
    expect(adminProgress(lab)).toBe('공격 단계')
    expect(
      adminProgress({ ...lab, stage: 'DEFENSE', attackSkipped: true, defenseAttempts: 2 }),
    ).toBe('방어 단계 · 공격 건너뜀 · 방어 검증 2번')
    expect(adminProgress({ ...lab, completedAt: '2026-11-25T04:58:00Z' })).toBe('완료')
    expect(adminProgress({ ...lab, status: 'FAILED' })).toBe('')
  })

  it('시간: 자동 종료까지, 준비 중 경과, 종료 시각과 사유', () => {
    expect(adminTime(lab, NOW)).toBe('24분 뒤 자동 종료')
    expect(adminTime({ ...lab, status: 'INITIALIZING' }, NOW)).toBe('시작한 지 20분')
    expect(adminTime({ ...lab, status: 'TERMINATING' }, NOW)).toBe('실습 환경 정리 중')
    const ended = adminTime(
      { ...lab, status: 'DELETED', endReason: 'ADMIN', endedAt: '2026-11-25T04:50:00Z' },
      NOW,
    )
    expect(ended).toMatch(/^\d\d:\d\d 종료 · 관리자 종료$/)
  })

  it('강제 종료는 준비 중이거나 실습 중일 때만', () => {
    expect(canTerminate(lab)).toBe(true)
    expect(canTerminate({ status: 'CREATING' })).toBe(true)
    expect(canTerminate({ status: 'TERMINATING' })).toBe(false)
    expect(canTerminate({ status: 'DELETED' })).toBe(false)
  })
})

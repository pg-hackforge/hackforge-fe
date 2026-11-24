import type { LabSessionResponse } from '@/api/generated/types.gen'
import { clockTime, END_REASON_SHORT, isEnded, labDuration, PREP_STEPS } from '@/lib/lab'

type Lab = Pick<
  LabSessionResponse,
  | 'status'
  | 'prepStep'
  | 'stage'
  | 'attackSkipped'
  | 'defenseAttempts'
  | 'completedAt'
  | 'endReason'
  | 'createdAt'
  | 'endedAt'
  | 'idleDeadline'
>

/** 관리자 세션 목록의 상태(ADR 026). 준비 중이면 지금 준비 단계까지 */
export function adminStatus(lab: Lab): {
  label: string
  tone: 'active' | 'prep' | 'muted' | 'fail'
} {
  switch (lab.status) {
    case 'CREATING':
    case 'INITIALIZING': {
      const step = PREP_STEPS.find(([key]) => key === lab.prepStep)?.[1]
      return { label: step ? `준비 중 · ${step}` : '준비 중', tone: 'prep' }
    }
    case 'READY':
      return { label: '실습 중', tone: 'active' }
    case 'TERMINATING':
      return { label: '종료 중', tone: 'muted' }
    case 'FAILED':
      return { label: '생성 실패', tone: 'fail' }
    default:
      return { label: '종료', tone: 'muted' }
  }
}

/** 어디까지 했나: 완료, 공격 단계, 방어 단계와 방어 검증 수 */
export function adminProgress(lab: Lab): string {
  if (lab.status === 'FAILED') return ''
  if (lab.completedAt) return '완료'
  if (lab.stage === 'ATTACK') return '공격 단계'
  const parts = ['방어 단계']
  if (lab.attackSkipped) parts.push('공격 건너뜀')
  if (lab.defenseAttempts > 0) parts.push(`방어 검증 ${lab.defenseAttempts}번`)
  return parts.join(' · ')
}

/** 실습 시간: 시작부터 지금(끝났으면 종료)까지. 준비 중이거나 실습 중이면 "째" */
export function adminDuration(lab: Lab, now: number): string {
  const time = labDuration(lab, now)
  return canTerminate(lab) ? `${time}째` : time
}

/**
 * 종료: 모든 줄을 시각으로. 끝났으면 종료 시각과 사유, 실습 중이면 자동 종료 예정 시각.
 * 시작한 날과 다른 날이면 날짜도 붙인다
 */
export function adminEnd(lab: Lab): string {
  const at = (iso: string) => {
    const sameDay = new Date(iso).toDateString() === new Date(lab.createdAt).toDateString()
    if (sameDay) return clockTime(iso)
    const d = new Date(iso)
    return `${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}. ${clockTime(iso)}`
  }
  if (lab.status === 'READY' && lab.idleDeadline) return `${at(lab.idleDeadline)} 예정`
  if (lab.status === 'TERMINATING') return '정리 중'
  if (isEnded(lab.status) && lab.endedAt)
    return [at(lab.endedAt), lab.endReason && END_REASON_SHORT[lab.endReason]]
      .filter(Boolean)
      .join(' · ')
  return '–'
}

/** 강제 종료할 수 있는 세션: 종료 전(종료 중 제외) */
export const canTerminate = (lab: Pick<LabSessionResponse, 'status'>) =>
  lab.status === 'CREATING' || lab.status === 'INITIALIZING' || lab.status === 'READY'

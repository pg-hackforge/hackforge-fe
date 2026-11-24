import type { LabSessionResponse } from '@/api/generated/types.gen'
import { clockTime, END_REASON_SHORT, isEnded, PREP_STEPS } from '@/lib/lab'

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

/** 시간 한 줄: 실습 중이면 자동 종료까지, 준비 중이면 시작한 지, 끝났으면 종료 시각과 사유 */
export function adminTime(lab: Lab, now: number): string {
  const minutes = (from: string) => Math.max(0, Math.floor((now - Date.parse(from)) / 60_000))
  if (lab.status === 'READY' && lab.idleDeadline) {
    const left = Math.max(0, Math.ceil((Date.parse(lab.idleDeadline) - now) / 60_000))
    return `${left}분 뒤 자동 종료`
  }
  if (lab.status === 'CREATING' || lab.status === 'INITIALIZING')
    return `시작한 지 ${minutes(lab.createdAt)}분`
  if (lab.status === 'TERMINATING') return '실습 환경 정리 중'
  if (isEnded(lab.status) && lab.endedAt) {
    const reason = lab.endReason ? ` · ${END_REASON_SHORT[lab.endReason]}` : ''
    return `${clockTime(lab.endedAt)} 종료${reason}`
  }
  return ''
}

/** 강제 종료할 수 있는 세션: 종료 전(종료 중 제외) */
export const canTerminate = (lab: Pick<LabSessionResponse, 'status'>) =>
  lab.status === 'CREATING' || lab.status === 'INITIALIZING' || lab.status === 'READY'

import type { UserResponse } from '@/api/generated/types.gen'

/** 권한(role)의 화면 이름(hackforge-docs ADR 019) */
export const ROLE_LABEL: Record<UserResponse['role'], string> = {
  LEARNER: '학습자',
  AUTHOR: '출제자',
  ADMIN: '관리자',
}

/** 승인 상태의 화면 이름(hackforge-docs ADR 019) */
export const STATUS_LABEL: Record<UserResponse['status'], string> = {
  PENDING: '승인 대기',
  APPROVED: '승인 완료',
  REJECTED: '거절',
}

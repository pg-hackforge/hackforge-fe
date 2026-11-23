import type { AdminUserResponse, UserResponse } from '@/api/generated/types.gen'

import type { MockProgress } from './labs'

/** mock 모드의 가짜 응답 상태. 화면 구석 패널에서 고르고 localStorage에 저장한다 */
export const ACCOUNTS = {
  'logged-out': '로그아웃 상태',
  pending: '승인 대기',
  rejected: '거절',
  learner: '학습자',
  admin: '관리자',
} as const

export const LABS = {
  none: '없음',
  CREATING: 'CREATING(생성 중)',
  INITIALIZING: 'INITIALIZING(서비스 불러오는 중)',
  READY: 'READY(실습 가능)',
  defense: 'READY, 방어 단계',
  'idle-warning': 'READY, 곧 자동 종료',
  FAILED: 'FAILED(생성 실패)',
  terminating: '정리 중(종료 직후)',
  'ended-user': '학습자가 종료함',
  'ended-admin': '관리자가 종료함',
  'capacity-full': '정원 초과',
} as const

/** 공격 검증을 요청하면 나올 결과 */
export const VERIFY_RESULTS = {
  PASS: 'PASS(공격 성공)',
  FAIL: 'FAIL(공격 실패)',
  ERROR: 'ERROR(실행 못 함)',
} as const

/** 재배포를 요청하면 나올 결과 */
export const REDEPLOY_RESULTS = {
  SUCCESS: 'SUCCESS(정상)',
  FAIL: 'FAIL(빌드 실패)',
  ERROR: 'ERROR(실행 못 함)',
} as const

/** 파일 저장: 정상이거나, 터미널 등에서 파일이 바뀐 상황(409) */
export const SAVE_RESULTS = {
  OK: '정상',
  CONFLICT: '충돌(다른 곳에서 바뀜)',
} as const

export type Scenario = {
  account: keyof typeof ACCOUNTS
  lab: keyof typeof LABS
  verify?: keyof typeof VERIFY_RESULTS
  redeploy?: keyof typeof REDEPLOY_RESULTS
  save?: keyof typeof SAVE_RESULTS
  /** 실습 중 검증·힌트·건너뛰기로 쌓인 진행. 실습 시나리오를 바꾸면 지운다 */
  progress?: MockProgress
  /** 회원가입 화면으로 가입한 계정. 있으면 승인 대기 계정이 이 계정이 된다 */
  newUser?: UserResponse
  /** 회원 관리에서 바꾼 회원 목록. 없으면 처음 목록 */
  adminUsers?: AdminUserResponse[]
}

const KEY = 'hackforge.mock'
const DEFAULT: Scenario = { account: 'learner', lab: 'none' }

let blockedStorageValue: Scenario | null = null // localStorage가 막힌 브라우저(사생활 보호 창 등)용

export function loadScenario(): Scenario {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return blockedStorageValue ?? DEFAULT
  }
  try {
    const saved = JSON.parse(raw ?? 'null') as Partial<Scenario> | null
    if (saved && saved.account! in ACCOUNTS && saved.lab! in LABS) return saved as Scenario
  } catch {
    // 깨진 값은 기본값으로
  }
  return DEFAULT
}

export function saveScenario(scenario: Scenario) {
  blockedStorageValue = scenario
  try {
    localStorage.setItem(KEY, JSON.stringify(scenario))
  } catch {
    // 막혀 있으면 새로고침 전까지만 유지된다
  }
}

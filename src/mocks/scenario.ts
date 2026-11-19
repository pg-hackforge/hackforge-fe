import type { UserResponse } from '@/api/generated/types.gen'

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
  READY: 'READY(실습 가능)',
  FAILED: 'FAILED(생성 실패)',
  'capacity-full': '정원 초과',
} as const

export type Scenario = {
  account: keyof typeof ACCOUNTS
  lab: keyof typeof LABS
  /** 회원가입 화면으로 가입한 계정. 있으면 승인 대기 계정이 이 계정이 된다 */
  newUser?: UserResponse
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

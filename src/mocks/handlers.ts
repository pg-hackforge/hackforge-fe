import { http, HttpResponse } from 'msw'

import type {
  ChallengeResponse,
  LabSessionResponse,
  Problem,
  UserResponse,
} from '@/api/generated/types.gen'

import { loadScenario, saveScenario, type Scenario } from './scenario'

/** openapi.yaml 응답 형식 그대로의 가짜 응답. 타입이 생성 타입이라 spec이 바뀌면 타입 검사에서 걸린다 */

const USERS: Record<Exclude<Scenario['account'], 'logged-out'>, UserResponse> = {
  pending: user(2, 'newbie', 'LEARNER', 'PENDING'),
  learner: user(3, 'forge_kim', 'LEARNER', 'APPROVED'),
  admin: user(1, 'admin', 'ADMIN', 'APPROVED'),
}

function user(
  id: number,
  nickname: string,
  role: UserResponse['role'],
  status: UserResponse['status'],
): UserResponse {
  return {
    id,
    email: `${nickname}@example.com`,
    name: '김대장',
    nickname,
    affiliation: '보안연구실',
    role,
    status,
    createdAt: '2026-11-01T09:00:00+09:00',
  }
}

const CHALLENGES: ChallengeResponse[] = [
  {
    id: 1,
    slug: 'sqli-login',
    title: '로그인 우회',
    description: '로그인 폼의 SQL Injection을 찾아 공격하고, 코드를 고쳐 막습니다.',
  },
  {
    id: 2,
    slug: 'xss-board',
    title: '게시판 스크립트 삽입',
    description: '게시글에 스크립트를 넣어 실행시키고, 출력 처리를 고쳐 막습니다.',
  },
  {
    id: 3,
    slug: 'idor-orders',
    title: '남의 주문 보기',
    description: '주문 번호를 바꿔 다른 사람의 주문을 보고, 권한 확인을 넣어 막습니다.',
  },
]

const LAB_ID = 42

function lab(status: LabSessionResponse['status']): LabSessionResponse {
  const now = Date.now()
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString()
  const ready = status === 'READY'
  return {
    id: LAB_ID,
    challengeId: 1,
    challengeTitle: CHALLENGES[0].title,
    status,
    endReason: status === 'TERMINATING' ? 'USER' : null,
    createdAt: at(-2),
    readyAt: ready ? at(-1) : null,
    endedAt: null,
    idleDeadline: ready ? at(30) : null,
    idleWarningAt: ready ? at(25) : null,
  }
}

const problem = (status: number, code: Problem['code'], title: string) =>
  HttpResponse.json<Problem>(
    { status, code, title },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )

const unauthenticated = () => problem(401, 'UNAUTHENTICATED', '로그인이 필요합니다')

/** 로그인한 계정. 로그인 안 됨이면 null */
const currentUser = () => {
  const { account } = loadScenario()
  return account === 'logged-out' ? null : USERS[account]
}

export const handlers = [
  http.get('*/api/me', () => {
    const me = currentUser()
    return me ? HttpResponse.json(me) : unauthenticated()
  }),

  // 로그인·로그아웃은 시나리오를 바꿔서, 이후 요청이 그 상태로 응답한다
  http.post('*/api/auth/login', () => {
    const scenario = loadScenario()
    if (scenario.account === 'logged-out') saveScenario({ ...scenario, account: 'learner' })
    return HttpResponse.json(currentUser()!)
  }),
  http.post('*/api/auth/logout', () => {
    saveScenario({ ...loadScenario(), account: 'logged-out' })
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('*/api/challenges', () =>
    currentUser() ? HttpResponse.json(CHALLENGES) : unauthenticated(),
  ),

  http.get('*/api/labs/current', () => {
    if (!currentUser()) return unauthenticated()
    const { lab: state } = loadScenario()
    // 종료된 세션(FAILED 포함)은 진행 중 세션으로 반환하지 않는다
    return state === 'CREATING' || state === 'READY'
      ? HttpResponse.json(lab(state))
      : new HttpResponse(null, { status: 204 })
  }),

  http.post('*/api/labs', () => {
    const me = currentUser()
    if (!me) return unauthenticated()
    if (me.status !== 'APPROVED')
      return problem(403, 'ACCOUNT_NOT_APPROVED', '승인된 계정만 실습할 수 있습니다')
    const { lab: state } = loadScenario()
    if (state === 'capacity-full')
      return problem(503, 'LAB_CAPACITY_FULL', '동시 실습 정원이 찼습니다')
    if (state === 'CREATING' || state === 'READY')
      return problem(409, 'LAB_ALREADY_ACTIVE', '진행 중인 실습이 있습니다')
    return HttpResponse.json(lab('CREATING'), { status: 202 })
  }),

  // 시작한 뒤 조회: FAILED 시나리오는 실패로, 그 밖에는 시나리오 상태(없음이면 준비 완료)로 응답한다
  http.get('*/api/labs/:id', () => {
    if (!currentUser()) return unauthenticated()
    const { lab: state } = loadScenario()
    return HttpResponse.json(lab(state === 'FAILED' || state === 'CREATING' ? state : 'READY'))
  }),

  http.delete('*/api/labs/:id', () => {
    if (!currentUser()) return unauthenticated()
    saveScenario({ ...loadScenario(), lab: 'none' })
    return HttpResponse.json(lab('TERMINATING'), { status: 202 })
  }),

  http.post('*/api/labs/:id/activity', () =>
    currentUser() ? HttpResponse.json(lab('READY')) : unauthenticated(),
  ),
]

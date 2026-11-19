import { http, HttpResponse } from 'msw'

import type {
  ChallengeResponse,
  LabSessionResponse,
  LoginRequest,
  Problem,
  SignupRequest,
  UserResponse,
} from '@/api/generated/types.gen'

import { loadScenario, saveScenario, type Scenario } from './scenario'

/** openapi.yaml 응답 형식 그대로의 가짜 응답. 타입이 생성 타입이라 spec이 바뀌면 타입 검사에서 걸린다 */

const USERS: Record<Exclude<Scenario['account'], 'logged-out'>, UserResponse> = {
  pending: user(2, 'newbie', 'LEARNER', 'PENDING'),
  rejected: user(4, 'denied', 'LEARNER', 'REJECTED'),
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
    description: '로그인 폼의 SQL Injection을 찾아 공격하고, 코드를 고쳐 막아요.',
  },
  {
    id: 2,
    slug: 'xss-board',
    title: '게시판 스크립트 삽입',
    description: '게시글에 스크립트를 넣어 실행시키고, 출력 처리를 고쳐 막아요.',
  },
  {
    id: 3,
    slug: 'idor-orders',
    title: '남의 주문 보기',
    description: '주문 번호를 바꿔 다른 사람의 주문을 보고, 권한 확인을 넣어 막아요.',
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

const unauthenticated = () => problem(401, 'UNAUTHENTICATED', '로그인이 필요해요')

type Account = Exclude<Scenario['account'], 'logged-out'>

/** 시나리오의 계정. 회원가입 화면으로 가입했으면 승인 대기 계정은 그 계정 */
const userOf = (account: Account) =>
  (account === 'pending' && loadScenario().newUser) || USERS[account]

/** 로그인한 계정. 로그인 안 됨이면 null */
const currentUser = () => {
  const { account } = loadScenario()
  return account === 'logged-out' ? null : userOf(account)
}

/** 이메일로 시나리오 계정을 찾는다 */
const accountByEmail = (email: string) =>
  (Object.keys(USERS) as Account[]).find((account) => userOf(account).email === email)

/** 잠긴 계정으로 쓰는 이메일. 로그인하면 429 ACCOUNT_LOCKED */
export const LOCKED_EMAIL = 'locked@example.com'

/** 백엔드 입력 규칙(SignupRequest)과 문구(ValidationMessages.properties) 중 화면 확인에 필요한 것만 */
function signupFieldErrors({ password, nickname }: SignupRequest) {
  const errors: Problem['errors'] = []
  if (!/^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9])[!-~]{8,64}$/.test(password))
    errors.push({
      field: 'password',
      message: '8~64자로 영문, 숫자, 특수문자를 하나 이상씩 넣어 주세요',
    })
  if (!/^[가-힣A-Za-z0-9_]{2,20}$/.test(nickname))
    errors.push({ field: 'nickname', message: '2~20자의 한글, 영문, 숫자, _만 쓸 수 있어요' })
  return errors
}

export const handlers = [
  http.get('*/api/me', () => {
    const me = currentUser()
    return me ? HttpResponse.json(me) : unauthenticated()
  }),

  // 로그인·로그아웃은 시나리오를 바꿔서, 이후 요청이 그 상태로 응답한다.
  // 로그인은 시나리오 계정의 이메일(forge_kim@example.com 등)이면 비밀번호와 상관없이 그 계정으로 된다
  http.post('*/api/auth/login', async ({ request }) => {
    const { email } = (await request.json()) as LoginRequest
    if (email === LOCKED_EMAIL)
      return problem(
        429,
        'ACCOUNT_LOCKED',
        '비밀번호를 여러 번 잘못 입력해서 잠시 로그인할 수 없어요',
      )
    const account = accountByEmail(email)
    if (!account)
      return problem(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호를 다시 확인해 주세요')
    saveScenario({ ...loadScenario(), account })
    return HttpResponse.json(userOf(account))
  }),
  // 가입한 계정은 승인 대기 계정이 된다. 로그인은 하지 않는다(openapi.yaml)
  http.post('*/api/auth/signup', async ({ request }) => {
    const body = (await request.json()) as SignupRequest
    const errors = signupFieldErrors(body)
    if (errors.length > 0)
      return HttpResponse.json<Problem>(
        {
          status: 400,
          code: 'VALIDATION_FAILED',
          title: '입력한 내용을 다시 확인해 주세요',
          errors,
        },
        { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
      )
    if (accountByEmail(body.email) || body.email === LOCKED_EMAIL)
      return problem(409, 'EMAIL_TAKEN', '이미 가입된 이메일이에요')
    if (Object.values(USERS).some((u) => u.nickname === body.nickname))
      return problem(409, 'NICKNAME_TAKEN', '이미 사용 중인 닉네임이에요')
    const newUser: UserResponse = {
      ...user(5, body.nickname, 'LEARNER', 'PENDING'),
      email: body.email,
      name: body.name,
      affiliation: body.affiliation,
      createdAt: new Date().toISOString(),
    }
    saveScenario({ ...loadScenario(), newUser })
    return HttpResponse.json(newUser, { status: 201 })
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
      return problem(403, 'ACCOUNT_NOT_APPROVED', '가입이 승인되면 실습을 시작할 수 있어요')
    const { lab: state } = loadScenario()
    if (state === 'capacity-full')
      return problem(
        503,
        'LAB_CAPACITY_FULL',
        '지금은 실습 자리가 모두 찼어요. 잠시 뒤 다시 시도해 주세요',
      )
    if (state === 'CREATING' || state === 'READY')
      return problem(409, 'LAB_ALREADY_ACTIVE', '이미 진행 중인 실습이 있어요')
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

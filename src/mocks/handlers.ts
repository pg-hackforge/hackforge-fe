import { http, HttpResponse } from 'msw'

import type {
  AdminUserResponse,
  ChangeRoleRequest,
  ChangePasswordRequest,
  LoginRequest,
  Problem,
  ResetLabRequest,
  SaveLabFileRequest,
  SignupRequest,
  UserResponse,
} from '@/api/generated/types.gen'

import { challengeDetail, listChallenges, myProgress } from './challenges'
import {
  ACTIVE_LABS,
  ATTACK_HINTS,
  jobRunning,
  labOf,
  publicRedeploy,
  publicVerification,
  saveProgress,
  settleProgress,
  startAttackVerification,
  startRedeploy,
  terminalHandler,
} from './labs'
import { fileEntries, hashOf, isReadOnly, ORIGINAL_FILES } from './lab-files'
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

/** 내 비밀번호 변경에서 현재 비밀번호로 쓰면 틀림, 잠김이 되는 값 */
export const WRONG_PASSWORD = 'wrong'
export const LOCKING_PASSWORD = 'locked'

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9])[!-~]{8,64}$/
const PASSWORD_MESSAGE = '8~64자로 영문, 숫자, 특수문자를 하나 이상씩 넣어 주세요'

const validationFailed = (errors: NonNullable<Problem['errors']>) =>
  HttpResponse.json<Problem>(
    { status: 400, code: 'VALIDATION_FAILED', title: '입력한 내용을 다시 확인해 주세요', errors },
    { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
  )

/** 백엔드 입력 규칙(SignupRequest)과 문구(ValidationMessages.properties) 중 화면 확인에 필요한 것만 */
function signupFieldErrors({ password, nickname }: SignupRequest) {
  const errors: NonNullable<Problem['errors']> = []
  if (!PASSWORD_RULE.test(password)) errors.push({ field: 'password', message: PASSWORD_MESSAGE })
  if (!/^[가-힣A-Za-z0-9_]{2,20}$/.test(nickname))
    errors.push({ field: 'nickname', message: '2~20자의 한글, 영문, 숫자, _만 쓸 수 있어요' })
  return errors
}

/** 회원 관리 목록의 처음 상태. 관리자(id 1)는 시나리오의 관리자 계정과 같은 사람 */
const ADMIN_USERS: AdminUserResponse[] = [
  member(1, '관리자', 'admin', 'ADMIN', 'APPROVED', '11-01T10:00', '보안연구실'),
  member(3, '김대장', 'forge_kim', 'LEARNER', 'APPROVED', '11-03T13:21'),
  member(6, '정하늘', 'sky_j', 'AUTHOR', 'APPROVED', '11-05T18:09'),
  member(4, '한도윤', 'denied', 'LEARNER', 'REJECTED', '11-10T11:30', '보안 동아리 HackLab'),
  member(
    2,
    '이수민',
    'newbie',
    'LEARNER',
    'PENDING',
    '11-18T14:02',
    undefined,
    '웹보안 3분반 수강생입니다.',
  ),
  member(8, '박준호', 'junho_p', 'LEARNER', 'PENDING', '11-18T16:47', '보안 동아리 HackLab'),
  member(
    7,
    '최예린',
    'yerin',
    'LEARNER',
    'PENDING',
    '11-19T09:15',
    '한빛대학교 컴퓨터공학과',
    '조교 추천으로 가입합니다.',
  ),
]

/** 승인·거절하면 다른 관리자가 먼저 승인해 둔 것처럼 409가 나는 회원(박준호) */
export const RACE_USER_ID = 8

function member(
  id: number,
  name: string,
  nickname: string,
  role: UserResponse['role'],
  status: UserResponse['status'],
  joined: string,
  affiliation = '한빛대학교 정보보호학과',
  signupNote: string | null = null,
): AdminUserResponse {
  return {
    ...user(id, nickname, role, status),
    name,
    affiliation,
    signupNote,
    createdAt: `2026-${joined}:00+09:00`,
  }
}

/** 지금 회원 목록. 회원가입 화면으로 가입한 계정도 승인 대기로 들어온다 */
function adminUsers(): AdminUserResponse[] {
  const { adminUsers: saved, newUser } = loadScenario()
  const users = saved ?? ADMIN_USERS
  return newUser && !users.some((u) => u.id === newUser.id) ? [...users, newUser] : users
}

const saveAdminUsers = (users: AdminUserResponse[]) =>
  saveScenario({ ...loadScenario(), adminUsers: users })

/** 관리자 API 공통: 로그인과 관리자 확인 */
function asAdmin(action: (me: UserResponse) => Response | Promise<Response>) {
  const me = currentUser()
  if (!me) return unauthenticated()
  if (me.role !== 'ADMIN') return problem(403, 'FORBIDDEN', '권한이 없어요')
  return action(me)
}

/** 경로의 id로 대상 회원을 찾는 관리자 API */
const withTarget = (
  params: { id?: string | readonly string[] },
  action: (target: AdminUserResponse, me: UserResponse) => Response | Promise<Response>,
) =>
  asAdmin((me) => {
    const target = adminUsers().find((u) => u.id === Number(params.id))
    if (!target) return problem(404, 'USER_NOT_FOUND', '회원을 찾을 수 없어요')
    return action(target, me)
  })

/** 상태 전이(ADR 011): PENDING → APPROVED·REJECTED, REJECTED → APPROVED */
function transition(target: AdminUserResponse, to: 'APPROVED' | 'REJECTED') {
  const allowed = target.status === 'PENDING' || (target.status === 'REJECTED' && to === 'APPROVED')
  const update = (status: UserResponse['status']) => {
    const updated = { ...target, status }
    saveAdminUsers(adminUsers().map((u) => (u.id === target.id ? updated : u)))
    return updated
  }
  if (target.id === RACE_USER_ID && target.status === 'PENDING') {
    update('APPROVED') // 다른 관리자가 먼저 승인함
    return problem(409, 'INVALID_STATUS_TRANSITION', '이미 처리된 회원이에요')
  }
  if (!allowed) return problem(409, 'INVALID_STATUS_TRANSITION', '이미 처리된 회원이에요')
  return HttpResponse.json(update(to))
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
    if (errors.length > 0) return validationFailed(errors)
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

  // 현재 비밀번호가 wrong이면 틀림, locked이면 이번 요청으로 잠겨 세션이 모두 지워짐(로그아웃 상태로)
  http.put('*/api/me/password', async ({ request }) => {
    if (!currentUser()) return unauthenticated()
    const { currentPassword, newPassword } = (await request.json()) as ChangePasswordRequest
    if (currentPassword === LOCKING_PASSWORD) {
      saveScenario({ ...loadScenario(), account: 'logged-out' })
      return problem(
        429,
        'ACCOUNT_LOCKED',
        '비밀번호를 여러 번 잘못 입력해서 잠시 로그인할 수 없어요',
      )
    }
    if (currentPassword === WRONG_PASSWORD)
      return problem(400, 'CURRENT_PASSWORD_MISMATCH', '현재 비밀번호가 맞지 않아요')
    if (!PASSWORD_RULE.test(newPassword))
      return validationFailed([{ field: 'newPassword', message: PASSWORD_MESSAGE }])
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('*/api/admin/users', ({ request }) =>
    asAdmin(() => {
      const status = new URL(request.url).searchParams.get('status') ?? 'PENDING'
      return HttpResponse.json(adminUsers().filter((u) => u.status === status))
    }),
  ),
  http.post('*/api/admin/users/:id/approve', ({ params }) =>
    withTarget(params, (target) => transition(target, 'APPROVED')),
  ),
  http.post('*/api/admin/users/:id/reject', ({ params }) =>
    withTarget(params, (target) => transition(target, 'REJECTED')),
  ),
  http.put('*/api/admin/users/:id/role', ({ params, request }) =>
    withTarget(params, async (target, me) => {
      if (target.id === me.id)
        return problem(403, 'CANNOT_CHANGE_OWN_ROLE', '내 권한은 바꿀 수 없어요')
      const { role } = (await request.json()) as ChangeRoleRequest
      const updated = { ...target, role }
      saveAdminUsers(adminUsers().map((u) => (u.id === target.id ? updated : u)))
      return HttpResponse.json(updated)
    }),
  ),
  // 실제로는 무작위 값. 화면 확인용으로 고정한다
  http.post('*/api/admin/users/:id/temporary-password', ({ params }) =>
    withTarget(params, () => HttpResponse.json({ temporaryPassword: 'Tq7#mW2pLx9!' })),
  ),

  http.get('*/api/challenges', ({ request }) =>
    currentUser()
      ? HttpResponse.json(listChallenges(new URL(request.url).searchParams))
      : unauthenticated(),
  ),
  http.get('*/api/challenges/:id', ({ params }) => {
    if (!currentUser()) return unauthenticated()
    const detail = challengeDetail(Number(params.id))
    return detail
      ? HttpResponse.json(detail)
      : problem(404, 'CHALLENGE_NOT_FOUND', '문제를 찾을 수 없어요')
  }),
  http.get('*/api/me/progress', () =>
    currentUser() ? HttpResponse.json(myProgress()) : unauthenticated(),
  ),

  http.get('*/api/labs/current', () => {
    if (!currentUser()) return unauthenticated()
    const { lab: state } = loadScenario()
    // 끝난 세션(실패 포함)은 진행 중 세션으로 반환하지 않는다
    return ACTIVE_LABS.includes(state)
      ? HttpResponse.json(labOf(state, settleProgress()))
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
    if (ACTIVE_LABS.includes(state))
      return problem(409, 'LAB_ALREADY_ACTIVE', '이미 진행 중인 실습이 있어요')
    // 시작하면 시나리오는 없음(= 준비 완료로 조회됨). 생성 실패 시나리오는 그대로 둬서 조회하면 실패
    if (state !== 'FAILED') saveScenario({ ...loadScenario(), lab: 'none', progress: undefined })
    return HttpResponse.json(labOf('CREATING'), { status: 202 })
  }),

  // 조회는 시나리오 상태로 응답한다. 없음(시작한 뒤)은 준비 완료
  http.get('*/api/labs/:id', () => {
    if (!currentUser()) return unauthenticated()
    return HttpResponse.json(labOf(loadScenario().lab, settleProgress()))
  }),

  http.delete('*/api/labs/:id', () => {
    if (!currentUser()) return unauthenticated()
    saveScenario({ ...loadScenario(), lab: 'ended-user' })
    return HttpResponse.json({ ...labOf('ended-user'), status: 'TERMINATING' }, { status: 202 })
  }),

  // [계속하기]: 종료 시각이 30분 뒤로 밀린다
  http.post('*/api/labs/:id/activity', () => {
    if (!currentUser()) return unauthenticated()
    const { lab } = loadScenario()
    const state = lab === 'defense' ? lab : 'READY'
    saveScenario({ ...loadScenario(), lab: state })
    return HttpResponse.json(labOf(state, settleProgress()))
  }),

  // 공격 검증: RUNNING으로 접수하고, 조회할 때 시간이 됐으면 mock 패널에서 고른 결과로 끝난다
  http.post('*/api/labs/:id/attack-verifications', () => {
    if (!currentUser()) return unauthenticated()
    const progress = settleProgress()
    if (jobRunning(progress)) return problem(409, 'LAB_JOB_RUNNING', '다른 작업이 실행 중이에요')
    return HttpResponse.json(startAttackVerification(progress), { status: 202 })
  }),
  http.get('*/api/labs/:id/verifications', () => {
    if (!currentUser()) return unauthenticated()
    return HttpResponse.json(settleProgress().verifications.map(publicVerification).reverse())
  }),
  http.get('*/api/labs/:id/verifications/:verificationId', ({ params }) => {
    if (!currentUser()) return unauthenticated()
    const found = settleProgress().verifications.find((v) => v.id === Number(params.verificationId))
    return found
      ? HttpResponse.json(publicVerification(found))
      : problem(404, 'VERIFICATION_NOT_FOUND', '검증을 찾을 수 없어요')
  }),

  http.get('*/api/labs/:id/hints', () => {
    if (!currentUser()) return unauthenticated()
    return HttpResponse.json({ attackTotal: 3, defenseTotal: 3, hints: settleProgress().hints })
  }),
  http.post('*/api/labs/:id/attack-hints', () => {
    if (!currentUser()) return unauthenticated()
    const progress = settleProgress()
    if (progress.stage !== 'ATTACK')
      return problem(409, 'WRONG_LAB_STAGE', '공격 단계에서만 할 수 있어요')
    const position = progress.hints.filter((h) => h.stage === 'ATTACK').length + 1
    if (position > ATTACK_HINTS.length) return problem(409, 'NO_MORE_HINTS', '힌트를 모두 열었어요')
    const hint = {
      stage: 'ATTACK' as const,
      position,
      content: ATTACK_HINTS[position - 1],
      revealedAt: new Date().toISOString(),
    }
    progress.hints.push(hint)
    saveProgress(progress)
    return HttpResponse.json(hint)
  }),
  http.post('*/api/labs/:id/attack-skip', () => {
    if (!currentUser()) return unauthenticated()
    const progress = settleProgress()
    if (progress.stage !== 'ATTACK')
      return problem(409, 'WRONG_LAB_STAGE', '공격 단계에서만 할 수 있어요')
    progress.stage = 'DEFENSE'
    progress.attackSkipped = true
    saveProgress(progress)
    return HttpResponse.json(labOf(loadScenario().lab, progress))
  }),

  // 코드(ADR 024): 방어 단계에서만. 내용은 mock 진행에 경로별로 저장한다
  http.get('*/api/labs/:id/files', () => {
    if (!currentUser()) return unauthenticated()
    const progress = settleProgress()
    if (progress.stage !== 'DEFENSE') return wrongStage()
    return HttpResponse.json(fileEntries(progress.files))
  }),
  http.get('*/api/labs/:id/files/original', ({ request }) => {
    if (!currentUser()) return unauthenticated()
    const path = new URL(request.url).searchParams.get('path') ?? ''
    if (settleProgress().stage !== 'DEFENSE') return wrongStage()
    if (!(path in ORIGINAL_FILES)) return problem(404, 'FILE_NOT_FOUND', '원본에 없는 파일이에요')
    return HttpResponse.json(fileOf(path, ORIGINAL_FILES[path]))
  }),
  http.get('*/api/labs/:id/files/content', ({ request }) => {
    if (!currentUser()) return unauthenticated()
    const path = new URL(request.url).searchParams.get('path') ?? ''
    const progress = settleProgress()
    if (progress.stage !== 'DEFENSE') return wrongStage()
    const entry = fileEntries().find((f) => f.path === path)
    if (!entry) return problem(404, 'FILE_NOT_FOUND', '파일을 찾을 수 없어요')
    if (!entry.openable)
      return problem(409, 'FILE_NOT_EDITABLE', '이 파일은 편집기에서 열 수 없어요')
    return HttpResponse.json(fileOf(path, progress.files[path] ?? ORIGINAL_FILES[path]))
  }),
  http.put('*/api/labs/:id/files/content', async ({ request }) => {
    if (!currentUser()) return unauthenticated()
    const path = new URL(request.url).searchParams.get('path') ?? ''
    const body = (await request.json()) as SaveLabFileRequest
    const progress = settleProgress()
    if (progress.stage !== 'DEFENSE') return wrongStage()
    if (isReadOnly(path)) return problem(403, 'FILE_READ_ONLY', '수정할 수 없는 파일이에요')
    const current = progress.files[path] ?? ORIGINAL_FILES[path]
    if (
      body.baseSha256 &&
      (loadScenario().save === 'CONFLICT' || body.baseSha256 !== hashOf(current))
    )
      return problem(409, 'FILE_CHANGED', '파일이 다른 곳에서 바뀌었어요')
    progress.files[path] = body.content
    saveProgress(progress)
    return HttpResponse.json(fileOf(path, body.content))
  }),
  http.post('*/api/labs/:id/files/revert', ({ request }) => {
    if (!currentUser()) return unauthenticated()
    const path = new URL(request.url).searchParams.get('path') ?? ''
    const progress = settleProgress()
    if (progress.stage !== 'DEFENSE') return wrongStage()
    if (isReadOnly(path)) return problem(403, 'FILE_READ_ONLY', '수정할 수 없는 파일이에요')
    if (!(path in ORIGINAL_FILES)) return problem(404, 'FILE_NOT_FOUND', '원본에 없는 파일이에요')
    delete progress.files[path]
    saveProgress(progress)
    return HttpResponse.json(fileOf(path, ORIGINAL_FILES[path]))
  }),

  // 재배포와 서비스 초기화: RUNNING으로 접수하고, 조회할 때 시간이 됐으면 결과가 나온다
  http.post('*/api/labs/:id/redeploys', () => {
    if (!currentUser()) return unauthenticated()
    const progress = settleProgress()
    if (progress.stage !== 'DEFENSE') return wrongStage()
    if (jobRunning(progress)) return problem(409, 'LAB_JOB_RUNNING', '다른 작업이 실행 중이에요')
    return HttpResponse.json(startRedeploy(progress, 'REDEPLOY'), { status: 202 })
  }),
  http.get('*/api/labs/:id/redeploys', () => {
    if (!currentUser()) return unauthenticated()
    return HttpResponse.json(
      settleProgress()
        .redeploys.map((r) => publicRedeploy(r, false))
        .reverse(),
    )
  }),
  http.get('*/api/labs/:id/redeploys/:redeployId', ({ params }) => {
    if (!currentUser()) return unauthenticated()
    const found = settleProgress().redeploys.find((r) => r.id === Number(params.redeployId))
    return found
      ? HttpResponse.json(publicRedeploy(found, true))
      : problem(404, 'REDEPLOY_NOT_FOUND', '기록을 찾을 수 없어요')
  }),
  http.post('*/api/labs/:id/reset', async ({ request }) => {
    if (!currentUser()) return unauthenticated()
    const body = (await request.json()) as ResetLabRequest
    const progress = settleProgress()
    if (jobRunning(progress)) return problem(409, 'LAB_JOB_RUNNING', '다른 작업이 실행 중이에요')
    if (!body.keepStage) Object.assign(progress, { stage: 'ATTACK', attackSkipped: false })
    progress.files = {}
    const { lab } = loadScenario()
    if (body.scope === 'ENVIRONMENT') {
      progress.recreateAt = Date.now()
      saveProgress(progress)
      return HttpResponse.json({ session: labOf(lab, progress), redeploy: null }, { status: 202 })
    }
    const redeploy = startRedeploy(progress, 'RESET')
    return HttpResponse.json({ session: labOf(lab, progress), redeploy }, { status: 202 })
  }),
]

const wrongStage = () => problem(409, 'WRONG_LAB_STAGE', '방어 단계에서만 할 수 있어요')

const fileOf = (path: string, content: string) => ({
  path,
  content,
  sha256: hashOf(content),
  readOnly: isReadOnly(path),
})

/** HTTP와 웹 터미널(WebSocket) mock 모두. 브라우저 worker와 화면 테스트가 쓴다 */
export const allHandlers = [...handlers, terminalHandler]

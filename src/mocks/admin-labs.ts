import type {
  AdminLabSessionPageResponse,
  AdminLabSessionResponse,
  LabSessionResponse,
} from '@/api/generated/types.gen'

import { listChallenges } from './challenges'
import { labOf, MOCK_TARGET_URL } from './labs'

// 관리자 세션 목록 mock(ADR 026). 학습자 여럿의 진행 중·끝난 세션. 강제 종료는 이 모듈 안에서 기억한다

const LEARNERS: [id: number, name: string, nickname: string][] = [
  [11, '이수민', 'sumin_lee'],
  [12, '박준호', 'junho_p'],
  [13, '최예린', 'yerin'],
  [14, '김하늘', 'haneul'],
  [15, '정도윤', 'doyun'],
  [16, '한지우', 'jiwoo'],
]

/** 강제 종료한 세션 id와 시각 */
const terminated = new Map<number, number>()

export function resetAdminLabs() {
  terminated.clear()
}

function sessions(): AdminLabSessionResponse[] {
  const now = Date.now()
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString()
  const challenges = listChallenges(new URLSearchParams()).items
  const make = (
    id: number,
    learner: number,
    challenge: number,
    startedAgo: number,
    over: Partial<LabSessionResponse>,
  ): AdminLabSessionResponse => {
    const [userId, userName, userNickname] = LEARNERS[learner]
    const c = challenges[challenge % challenges.length]
    let session: LabSessionResponse = {
      ...labOf('ended-user'),
      id,
      challengeId: c.id,
      challengeTitle: c.title,
      status: 'READY',
      stage: 'ATTACK',
      endReason: null,
      createdAt: at(-startedAgo),
      readyAt: at(-startedAgo + 1),
      endedAt: null,
      targetUrl: MOCK_TARGET_URL,
      idleDeadline: at(24),
      idleWarningAt: at(19),
      ...over,
    }
    const end = terminated.get(id)
    if (end && session.status !== 'DELETED' && session.status !== 'FAILED')
      session = {
        ...session,
        status: now - end < 4_000 ? 'TERMINATING' : 'DELETED',
        endReason: 'ADMIN',
        endedAt: now - end < 4_000 ? null : new Date(end + 4_000).toISOString(),
        targetUrl: null,
        idleDeadline: null,
        idleWarningAt: null,
      }
    return {
      userId,
      userName,
      userNickname,
      userEmail: `${userNickname}@example.com`,
      session,
    }
  }
  const ended = (minutes: number, reason: LabSessionResponse['endReason']) => ({
    status: 'DELETED' as const,
    endReason: reason,
    endedAt: at(-minutes),
    targetUrl: null,
    idleDeadline: null,
    idleWarningAt: null,
  })
  return [
    make(108, 0, 3, 12, { attackHintsRevealed: 1 }),
    make(107, 1, 5, 2, {
      status: 'CREATING',
      prepStep: 'CONTAINER',
      readyAt: null,
      targetUrl: null,
      idleDeadline: null,
      idleWarningAt: null,
    }),
    make(106, 2, 1, 38, {
      stage: 'DEFENSE',
      defenseAttempts: 2,
      completedAt: at(-2),
      idleDeadline: at(3),
      idleWarningAt: at(-2),
    }),
    make(105, 3, 7, 26, { stage: 'DEFENSE', defenseAttempts: 1, idleDeadline: at(4) }),
    make(104, 4, 2, 9, { status: 'TERMINATING', endReason: 'USER', idleDeadline: null }),
    make(103, 5, 4, 70, { stage: 'DEFENSE', defenseAttempts: 3, ...ended(31, 'IDLE') }),
    make(102, 0, 6, 160, {
      stage: 'DEFENSE',
      defenseAttempts: 2,
      completedAt: at(-125),
      ...ended(120, 'USER'),
    }),
    make(101, 2, 0, 300, { ...ended(296, null), status: 'FAILED', readyAt: null }),
    make(100, 1, 8, 1500, { ...ended(1460, 'ADMIN') }),
  ]
}

const LIVE: LabSessionResponse['status'][] = ['CREATING', 'INITIALIZING', 'READY', 'TERMINATING']

/** `GET /api/admin/labs`: 기본은 종료 전 세션, ALL이면 전체. 최근 시작 순 */
export function adminLabs(params: URLSearchParams): AdminLabSessionPageResponse {
  const all = params.get('status') === 'ALL'
  const items = sessions().filter((s) => all || LIVE.includes(s.session.status))
  return { items, page: 1, size: 20, totalItems: items.length, totalPages: 1 }
}

export function adminLab(id: number): AdminLabSessionResponse | undefined {
  return sessions().find((s) => s.session.id === id)
}

/** 강제 종료: 종료 전 세션만 TERMINATING(ADMIN)으로. 이미 끝났으면 지금 상태 그대로 */
export function terminateAdminLab(id: number): LabSessionResponse | undefined {
  const found = adminLab(id)
  if (!found) return undefined
  if (LIVE.includes(found.session.status) && found.session.status !== 'TERMINATING')
    terminated.set(id, Date.now())
  return adminLab(id)!.session
}

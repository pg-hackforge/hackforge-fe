import type { ChallengeDifficulty } from '@/api/generated/types.gen'

// 시안: 백엔드 `GET /api/me/activity`(ADR 030 예정)가 생기면 생성 타입으로 바꾼다

/** 시도한 문제 하나의 사실. 세션이 여럿이면 가장 좋은 세션(해답 없이 완료 > 해답 확인 후 완료 > 끝내지 못함) 기준 */
export type ChallengeFact = {
  challengeId: number
  title: string
  category: { key: string; name: string }
  difficulty: ChallengeDifficulty
  sessions: number
  result: 'COMPLETED' | 'COMPLETED_AFTER_SOLUTION' | 'UNFINISHED'
  attack: { passed: boolean; skipped: boolean; hints: number }
  defense: { attempts: number; hints: number }
}

export type MyActivity = {
  totalChallenges: number
  categories: { key: string; name: string; total: number }[]
  sessions: number
  totalMinutes: number
  /** 최근 365일, 오래된 날부터. 날짜는 YYYY-MM-DD(한국 시간) */
  days: { date: string; count: number }[]
  challenges: ChallengeFact[]
}

/** 어려운 문제를 더 친다(solved.ac 태그 레이팅처럼 난이도로 무게를 둔다) */
const WEIGHT: Record<ChallengeDifficulty, number> = {
  INTRO: 1,
  BEGINNER: 1.5,
  INTERMEDIATE: 2,
  ADVANCED: 3,
}

/** 공격: 힌트 없이 성공 1, 힌트 하나에 0.2씩 깎되 성공했으면 0.4 이상. 건너뜀이나 실패는 0 */
export function attackScore(fact: ChallengeFact): number {
  if (fact.attack.skipped || !fact.attack.passed) return 0
  return Math.max(0.4, 1 - 0.2 * fact.attack.hints)
}

/** 방어: 해답 없이 완료는 검증 한 번 더에 0.1, 힌트 하나에 0.15 깎되 0.5 이상. 해답 확인 후 완료 0.3, 못 끝냄 0 */
export function defenseScore(fact: ChallengeFact): number {
  if (fact.result === 'UNFINISHED') return 0
  if (fact.result === 'COMPLETED_AFTER_SOLUTION') return 0.3
  const score = 1 - 0.1 * (fact.defense.attempts - 1) - 0.15 * fact.defense.hints
  return Math.min(1, Math.max(0.5, score))
}

/** 판정에 필요한 시도한 문제 수. 이보다 적으면 막대를 흐리게 하고 강점·보완점에서 뺀다 */
export const MIN_FOR_JUDGMENT = 3

export type CategoryStat = {
  key: string
  name: string
  total: number
  tried: number
  completed: number
  /** 0~1. 시도한 문제가 없으면 null */
  attack: number | null
  defense: number | null
  facts: ChallengeFact[]
}

export function categoryStats(activity: MyActivity): CategoryStat[] {
  return activity.categories.map(({ key, name, total }) => {
    const facts = activity.challenges.filter((f) => f.category.key === key)
    const weighted = (score: (f: ChallengeFact) => number) => {
      const sum = facts.reduce((s, f) => s + WEIGHT[f.difficulty], 0)
      return sum ? facts.reduce((s, f) => s + WEIGHT[f.difficulty] * score(f), 0) / sum : null
    }
    return {
      key,
      name,
      total,
      tried: facts.length,
      completed: facts.filter((f) => f.result !== 'UNFINISHED').length,
      attack: weighted(attackScore),
      defense: weighted(defenseScore),
      facts,
    }
  })
}

/**
 * 정렬 점수: 공격·방어 평균에 시도한 문제 수만큼 믿음을 준다(tried / (tried + 2)).
 * 많이 해 보고 잘한 분류가 위, 한두 문제만 잘한 분류는 그보다 아래, 안 해 본 분류는 0
 */
export function rankScore(stat: CategoryStat): number {
  if (stat.tried === 0) return 0
  return ((stat.attack! + stat.defense!) / 2) * (stat.tried / (stat.tried + 2))
}

export const SIDE_LABEL = { ATTACK: '공격', DEFENSE: '방어', BOTH: '공격·방어 모두' } as const

export type Finding = { stat: CategoryStat; side: 'ATTACK' | 'DEFENSE' | 'BOTH'; reason: string }

const average = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length
const one = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

function reason(stat: CategoryStat, side: 'ATTACK' | 'DEFENSE'): string {
  const facts = stat.facts
  if (side === 'ATTACK') {
    const skipped = facts.filter((f) => f.attack.skipped).length
    return [
      `공격 힌트 평균 ${one(average(facts.map((f) => f.attack.hints)))}개`,
      skipped && `건너뜀 ${skipped}번`,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  const solved = facts.filter((f) => f.result !== 'UNFINISHED')
  const afterSolution = facts.filter((f) => f.result === 'COMPLETED_AFTER_SOLUTION').length
  return [
    solved.length && `방어 검증 평균 ${one(average(solved.map((f) => f.defense.attempts)))}번`,
    afterSolution && `해답 확인 ${afterSolution}번`,
    facts.length - solved.length && `끝내지 못함 ${facts.length - solved.length}개`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** 강점: 공격·방어 모두 0.75 이상인 분류, 낮은 쪽이 높은 순으로 둘 */
export function strengths(stats: CategoryStat[]): Finding[] {
  return stats
    .filter((s) => s.tried >= MIN_FOR_JUDGMENT && Math.min(s.attack!, s.defense!) >= 0.75)
    .sort((a, b) => Math.min(b.attack!, b.defense!) - Math.min(a.attack!, a.defense!))
    .slice(0, 2)
    .map((stat) => ({
      stat,
      side: 'BOTH',
      reason: `${stat.tried}문제 중 해답 없이 완료 ${stat.facts.filter((f) => f.result === 'COMPLETED').length}개`,
    }))
}

/** 보완점: 공격이나 방어가 0.6 미만인 분류의 그 쪽, 낮은 순으로 둘 */
export function weaknesses(stats: CategoryStat[]): Finding[] {
  return stats
    .filter((s) => s.tried >= MIN_FOR_JUDGMENT && Math.min(s.attack!, s.defense!) < 0.6)
    .sort((a, b) => Math.min(a.attack!, a.defense!) - Math.min(b.attack!, b.defense!))
    .slice(0, 2)
    .map((stat): Finding => {
      // 둘 다 낮으면 한 줄에 둘 다, 아니면 낮은 쪽만
      if (stat.attack! < 0.6 && stat.defense! < 0.6)
        return {
          stat,
          side: 'BOTH',
          reason: `${reason(stat, 'ATTACK')} · ${reason(stat, 'DEFENSE')}`,
        }
      const side = stat.attack! < stat.defense! ? 'ATTACK' : 'DEFENSE'
      return { stat, side, reason: reason(stat, side) }
    })
}

/** 분(1시간 넘으면 시간과 분) */
export const formatMinutes = (minutes: number) =>
  minutes < 60 ? `${minutes}분` : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`

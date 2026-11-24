import { describe, expect, it } from 'vitest'

import {
  attackScore,
  categoryStats,
  defenseScore,
  rankScore,
  strengths,
  weaknesses,
  type ChallengeFact,
  type MyActivity,
} from './analysis'

const fact = (over: Partial<ChallengeFact> & { key?: string }): ChallengeFact => ({
  challengeId: 1,
  title: '문제',
  category: { key: over.key ?? 'xss', name: over.key ?? 'xss' },
  difficulty: 'INTERMEDIATE',
  sessions: 1,
  result: 'COMPLETED',
  attack: { passed: true, skipped: false, hints: 0 },
  defense: { attempts: 1, hints: 0 },
  ...over,
})

const activity = (challenges: ChallengeFact[]): MyActivity => ({
  totalChallenges: 10,
  categories: [
    { key: 'xss', name: 'XSS', total: 5 },
    { key: 'sqli', name: 'SQL Injection', total: 5 },
  ],
  sessions: challenges.length,
  totalMinutes: 0,
  days: [],
  challenges,
})

describe('분석', () => {
  it('공격 점수: 힌트 없이 1, 힌트마다 깎되 성공이면 0.4 이상, 건너뜀·실패 0', () => {
    expect(attackScore(fact({}))).toBe(1)
    expect(attackScore(fact({ attack: { passed: true, skipped: false, hints: 2 } }))).toBeCloseTo(
      0.6,
    )
    expect(attackScore(fact({ attack: { passed: true, skipped: false, hints: 5 } }))).toBe(0.4)
    expect(attackScore(fact({ attack: { passed: false, skipped: true, hints: 0 } }))).toBe(0)
  })

  it('방어 점수: 해답 없이 완료가 높고, 해답 확인 후 0.3, 못 끝냄 0', () => {
    expect(defenseScore(fact({}))).toBe(1)
    expect(defenseScore(fact({ defense: { attempts: 4, hints: 1 } }))).toBeCloseTo(0.55)
    expect(defenseScore(fact({ defense: { attempts: 9, hints: 3 } }))).toBe(0.5)
    expect(defenseScore(fact({ result: 'COMPLETED_AFTER_SOLUTION' }))).toBe(0.3)
    expect(defenseScore(fact({ result: 'UNFINISHED' }))).toBe(0)
  })

  it('분류 점수는 어려운 문제를 더 치고, 시도하지 않은 분류는 비움', () => {
    const [xss, sqli] = categoryStats(
      activity([
        fact({ difficulty: 'ADVANCED' }),
        fact({ difficulty: 'INTRO', result: 'UNFINISHED' }),
      ]),
    )
    expect(xss.defense).toBeCloseTo(3 / 4)
    expect(xss.tried).toBe(2)
    expect(sqli.attack).toBeNull()
  })

  it('강점과 보완점은 3문제 이상 시도한 분류만, 보완점은 약한 쪽과 근거', () => {
    const stats = categoryStats(
      activity([
        ...[1, 2, 3].map(() => fact({})),
        ...[1, 2, 3].map(() =>
          fact({
            key: 'sqli',
            result: 'COMPLETED_AFTER_SOLUTION',
            defense: { attempts: 3, hints: 2 },
          }),
        ),
      ]),
    )
    expect(strengths(stats).map((f) => f.stat.key)).toEqual(['xss'])
    const [weak] = weaknesses(stats)
    expect(weak.stat.key).toBe('sqli')
    expect(weak.side).toBe('DEFENSE')
    expect(weak.reason).toBe('방어 검증 평균 3번 · 해답 확인 3번')
    expect(
      weaknesses(categoryStats(activity([fact({ key: 'sqli', result: 'UNFINISHED' })]))),
    ).toEqual([])
    // 공격·방어 둘 다 낮으면 한 줄에 둘 다
    const both = weaknesses(
      categoryStats(
        activity(
          [1, 2, 3].map(() =>
            fact({ result: 'UNFINISHED', attack: { passed: false, skipped: true, hints: 0 } }),
          ),
        ),
      ),
    )
    expect(both[0].side).toBe('BOTH')
    expect(both[0].reason).toBe('공격 힌트 평균 0개 · 건너뜀 3번 · 끝내지 못함 3개')
  })

  it('정렬은 시도한 수와 점수를 함께: 많이 해 보고 잘한 분류가 한 문제만 잘한 분류보다 위', () => {
    const stats = categoryStats(
      activity([
        fact({ key: 'sqli' }),
        ...[1, 2, 3, 4, 5, 6].map(() => fact({ defense: { attempts: 3, hints: 0 } })),
      ]),
    )
    const [xss, sqli] = stats
    expect(rankScore(xss)).toBeGreaterThan(rankScore(sqli))
    expect(rankScore({ ...sqli, tried: 0 })).toBe(0)
  })
})

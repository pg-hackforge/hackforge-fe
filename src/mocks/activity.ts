import type { ChallengeDifficulty } from '@/api/generated/types.gen'
import type { ChallengeFact, MyActivity } from '@/lib/analysis'

import { CATEGORIES } from './challenges'

// 문제와 분류가 많은 서비스를 가정한 내 분석 mock(문제 120개). 실제 문제 이름이나 풀이는 쓰지 않는다

/** 분류마다 [전체 문제 수, 시도한 문제 수, 공격 실력, 방어 실력](0~1) */
const PROFILE: Record<string, [total: number, tried: number, attack: number, defense: number]> = {
  sqli: [14, 9, 0.95, 0.35],
  xss: [12, 8, 0.9, 0.9],
  'access-control': [12, 7, 0.85, 0.8],
  'auth-session': [10, 6, 0.7, 0.65],
  'command-injection': [10, 5, 0.3, 0.6],
  'path-traversal': [10, 4, 0.8, 0.75],
  'file-upload': [9, 3, 0.6, 0.4],
  ssrf: [9, 2, 0.5, 0.5],
  csrf: [9, 1, 0.9, 0.9],
  xxe: [8, 0, 0, 0],
  deserialization: [9, 0, 0, 0],
  'info-disclosure': [8, 3, 0.9, 0.85],
  // ADR 032에서 더한 분류. 아직 공개 문제가 없다
  'nosql-injection': [0, 0, 0, 0],
  ssti: [0, 0, 0, 0],
  'business-logic': [0, 0, 0, 0],
  'prototype-pollution': [0, 0, 0, 0],
  misconfiguration: [0, 0, 0, 0],
}

const DIFFICULTIES: ChallengeDifficulty[] = ['INTRO', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED']

// 같은 화면이 나오도록 고정한 의사 난수
let seed = 7
const random = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

function facts(): ChallengeFact[] {
  let id = 1000
  return CATEGORIES.flatMap(([key, name]) => {
    const [, tried, attack, defense] = PROFILE[key]
    return Array.from({ length: tried }, (_, i): ChallengeFact => {
      const skipped = random() > attack + 0.25
      const hints = skipped
        ? 0
        : Math.min(3, Math.round((1 - attack) * 4 * random() + random() * 0.7))
      const r = random()
      const result =
        r < defense ? 'COMPLETED' : r < defense + 0.25 ? 'COMPLETED_AFTER_SOLUTION' : 'UNFINISHED'
      return {
        challengeId: id++,
        title: `${name} 실습 ${i + 1}`,
        category: { key, name },
        difficulty: DIFFICULTIES[Math.min(3, Math.floor(i / 2))],
        sessions: result === 'COMPLETED' ? 1 : 1 + Math.round(random() * 2),
        result,
        attack: { passed: !skipped, skipped, hints },
        defense: {
          attempts: result === 'UNFINISHED' ? 0 : 1 + Math.round((1 - defense) * 5 * random()),
          hints: Math.round((1 - defense) * 3 * random()),
        },
      }
    })
  })
}

function days(): MyActivity['days'] {
  const today = new Date()
  return Array.from({ length: 365 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 364 + i)
    // 최근으로 올수록 자주, 주말은 덜
    const busy = (i / 365) * 0.7 * (d.getDay() % 6 === 0 ? 0.4 : 1)
    const r = random()
    const count = r < busy * 0.25 ? 3 : r < busy * 0.55 ? 2 : r < busy ? 1 : 0
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { date, count }
  })
}

export function myActivity(): MyActivity {
  seed = 7
  const challenges = facts()
  const dayList = days()
  return {
    totalChallenges: Object.values(PROFILE).reduce((s, [total]) => s + total, 0),
    categories: CATEGORIES.map(([key, name]) => ({ key, name, total: PROFILE[key][0] })),
    sessions: dayList.reduce((s, d) => s + d.count, 0),
    totalMinutes: challenges.reduce((s, c) => s + c.sessions * 38, 0),
    days: dayList,
    challenges,
  }
}

import { describe, expect, it } from 'vitest'

import { evaluate } from './audit-check.mjs'

const advisory = (id, severity = 'high', name = 'picomatch') => ({
  source: 1,
  name,
  title: `${name} 취약점`,
  url: `https://github.com/advisories/${id}`,
  severity,
})

const report = (...vias) => ({
  vulnerabilities: Object.fromEntries(
    vias.map((via, i) => [`pkg${i}`, { severity: via.severity ?? 'high', via: [via] }]),
  ),
})

describe('audit-check', () => {
  it('높은 위험 이상 취약점이 있으면 실패', () => {
    const result = evaluate(report(advisory('GHSA-aaaa')), [], '2026-11-18')
    expect(result.failures.map((f) => f.id)).toEqual(['GHSA-aaaa'])
  })

  it('중간 위험 이하는 막지 않음', () => {
    const result = evaluate(report(advisory('GHSA-aaaa', 'moderate')), [], '2026-11-18')
    expect(result.failures).toEqual([])
  })

  it('허용 목록에 있고 재검토 날짜 전이면 통과', () => {
    const allow = [{ id: 'GHSA-aaaa', reason: '빌드 도구 전용', until: '2026-12-15' }]
    const result = evaluate(report(advisory('GHSA-aaaa')), allow, '2026-12-15')
    expect(result.failures).toEqual([])
    expect(result.allowed.map((a) => a.id)).toEqual(['GHSA-aaaa'])
  })

  it('재검토 날짜가 지나면 다시 실패', () => {
    const allow = [{ id: 'GHSA-aaaa', reason: '빌드 도구 전용', until: '2026-12-15' }]
    const result = evaluate(report(advisory('GHSA-aaaa')), allow, '2026-12-16')
    expect(result.failures).toEqual([expect.objectContaining({ id: 'GHSA-aaaa', expired: true })])
  })

  it('허용 목록에 없는 다른 취약점은 그대로 막음', () => {
    const allow = [{ id: 'GHSA-aaaa', reason: '빌드 도구 전용', until: '2026-12-15' }]
    const result = evaluate(
      report(advisory('GHSA-aaaa'), advisory('GHSA-bbbb', 'critical', 'other')),
      allow,
      '2026-11-18',
    )
    expect(result.failures.map((f) => f.id)).toEqual(['GHSA-bbbb'])
  })

  it('같은 취약점이 여러 패키지에 걸려도 한 번만 셈', () => {
    const r = report(advisory('GHSA-aaaa'), advisory('GHSA-aaaa'))
    r.vulnerabilities.vite = { severity: 'high', via: ['picomatch'] }
    expect(evaluate(r, [], '2026-11-18').failures).toHaveLength(1)
  })
})

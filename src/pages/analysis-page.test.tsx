import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { myActivity } from '@/mocks/activity'
import { listChallenges } from '@/mocks/challenges'
import { renderAt, setupMockServer } from '@/test/app'

const server = setupMockServer()

describe('내 기록 분석', () => {
  it('분류별 공격·방어는 많이 해 보고 잘한 분류가 위, 안 해 본 분류는 맨 아래', async () => {
    renderAt('/records/analysis', 'learner')
    expect(await screen.findByRole('link', { name: '분석', current: 'page' })).toBeInTheDocument()
    const rows = await screen.findAllByRole('link', { name: /: (공격 \d+|아직 안 해 봄)/ })
    expect(rows).toHaveLength(17)
    expect(rows[0]).toHaveAccessibleName(/^XSS: 공격 \d+, 방어 \d+, 12문제 중 8문제 시도$/)
    expect(rows[0]).toHaveAttribute('href', '/problems?category=xss')
    expect(screen.getByRole('link', { name: '역직렬화: 아직 안 해 봄, 9문제' })).toBeInTheDocument()
    // ADR 032로 더한 분류는 공개 문제가 없어 안 해 본 분류 맨 아래(표시 순서)
    expect(rows.at(-1)).toHaveAccessibleName('보안 설정 오류: 아직 안 해 봄, 0문제')
  })

  it('강점과 보완할 점은 근거와 함께, 보완할 분류에서 추천 문제', async () => {
    renderAt('/records/analysis', 'learner')
    const strong = (await screen.findByRole('heading', { name: '강점' })).parentElement!
    expect(within(strong).getByText('XSS')).toBeInTheDocument()
    expect(within(strong).getByText(/8문제 중 해답 없이 완료 \d+개/)).toBeInTheDocument()
    const weak = screen.getByRole('heading', { name: '보완할 점' }).parentElement!
    expect(within(weak).getByText('SQL Injection')).toBeInTheDocument()
    expect(within(weak).getAllByText(/방어 검증 평균 [0-9.]+번/)[0]).toBeInTheDocument()
    const recommend = (await screen.findByRole('heading', { name: '추천 문제' })).parentElement!
    expect(within(recommend).getByText('SQL Injection 방어 연습')).toBeInTheDocument()
    expect(within(recommend).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/problems\/\d+$/),
    )
  })

  it('예정 문제는 추천하지 않음(ADR 031)', async () => {
    server.use(
      http.get('*/api/challenges', ({ request }) => {
        const page = listChallenges(new URL(request.url).searchParams)
        const [first, ...rest] = page.items
        const planned = { ...first, id: 999, title: '예정인 SQL 문제', status: 'PLANNED' as const }
        return HttpResponse.json({ ...page, items: [planned, first, ...rest] })
      }),
    )
    renderAt('/records/analysis', 'learner')
    const recommend = (await screen.findByRole('heading', { name: '추천 문제' })).parentElement!
    expect(await within(recommend).findByRole('link')).not.toHaveAttribute('href', '/problems/999')
    expect(within(recommend).queryByText('예정인 SQL 문제')).not.toBeInTheDocument()
  })

  it('결과가 난 실습이 없으면 문제 보기로 안내', async () => {
    server.use(
      http.get('*/api/me/activity', () =>
        HttpResponse.json({ ...myActivity(), sessions: 0, totalMinutes: 0, challenges: [] }),
      ),
    )
    renderAt('/records/analysis', 'learner')
    expect(await screen.findByText(/아직 분석할 실습이 없어요/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '문제 보기' })).toHaveAttribute('href', '/problems')
    expect(screen.queryByRole('heading', { name: '강점' })).not.toBeInTheDocument()
  })

  it('실습 기록 탭 오른쪽 패널은 분석의 핵심 한 줄로 분석 탭에 보냄', async () => {
    renderAt('/records', 'learner')
    const panel = await screen.findByRole('complementary', { name: '내 실습 요약' })
    const link = await within(panel).findByRole('link', { name: /보완할 점\s*SQL Injection 방어/ })
    expect(link).toHaveAttribute('href', '/records/analysis')
  })
})

import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { myActivity } from '@/mocks/activity'
import { renderAt, setupMockServer } from '@/test/app'

const server = setupMockServer()

describe('홈', () => {
  it('진행 중인 실습, 끝내지 못한 문제, 내 진행, 최근 기록', async () => {
    renderAt('/', 'learner', 'READY')
    expect(await screen.findByRole('heading', { name: /안녕하세요/ })).toBeInTheDocument()

    const current = await screen.findByRole('region', { name: '진행 중인 실습' })
    expect(within(current).getByText('SQL Injection 로그인 우회')).toBeInTheDocument()
    expect(within(current).getByText(/자동 종료까지/)).toHaveTextContent(/(29|30):\d\d/)
    expect(within(current).getByRole('link', { name: '실습으로 돌아가기' })).toHaveAttribute(
      'href',
      '/labs/42',
    )

    expect(await screen.findByRole('heading', { name: /끝내지 못한 문제/ })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: '모두 보기' })[0]).toHaveAttribute(
      'href',
      '/problems?myStatus=UNFINISHED',
    )
    // 내 진행: 진행한 분류만 많이 완료한 순, 안 해 본 분류는 한 줄로 그 분류들의 문제 목록에
    const progress = (await screen.findByRole('heading', { name: '내 진행' })).closest('section')!
    expect(await within(progress).findByText('/ 120 완료')).toBeInTheDocument()
    expect(within(progress).getByRole('link', { name: '문제 보기' })).toHaveAttribute(
      'href',
      '/problems',
    )
    expect(within(progress).getAllByRole('link', { name: /\d+\/\d+$/ })[0]).toHaveAttribute(
      'href',
      '/problems?category=xss',
    )
    expect(within(progress).getByRole('link', { name: '안 해 본 분류 2개' })).toHaveAttribute(
      'href',
      '/problems?category=xxe&category=deserialization',
    )
    // 진행 중인 문제는 끝내지 못한 문제 목록에 다시 나오지 않는다
    const pending = screen.getByRole('heading', { name: /끝내지 못한 문제/ }).closest('section')!
    expect(within(pending).queryByText('SQL Injection 로그인 우회')).not.toBeInTheDocument()

    // 최근 기록: 진행 중인 세션이 맨 위, 지난 세션은 결과와 함께
    expect(await screen.findByText('진행 중', { selector: 'a span' })).toBeInTheDocument()
    expect(screen.getByText('해답 확인 후 완료')).toBeInTheDocument()
    expect(screen.getByText('끝내지 못함 · 관리자 종료')).toBeInTheDocument()
  })

  it('추천 문제: 분석에서 가장 보완할 분류의 문제, 분석 보기로 이어짐', async () => {
    renderAt('/', 'learner')
    const card = (await screen.findByRole('heading', { name: '추천 문제' })).closest('section')!
    expect(await within(card).findByText('SQL Injection 방어 연습')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: '분석 보기' })).toHaveAttribute(
      'href',
      '/records/analysis',
    )
  })

  it('보완할 점이 없으면 추천 문제 카드가 없음', async () => {
    server.use(
      http.get('*/api/me/activity', () => HttpResponse.json({ ...myActivity(), challenges: [] })),
    )
    renderAt('/', 'learner')
    expect(await screen.findByText('/ 120 완료')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '추천 문제' })).not.toBeInTheDocument()
  })

  it('진행 중인 실습이 없으면 그 띠가 없음', async () => {
    renderAt('/', 'learner', 'none')
    expect(await screen.findByRole('heading', { name: /끝내지 못한 문제/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '진행 중인 실습' })).not.toBeInTheDocument()
  })

  it('승인 전에는 둘러보기 안내, 입문 문제와 분류', async () => {
    renderAt('/', 'pending')
    expect(await screen.findByText('승인 전에는 문제를 둘러볼 수만 있어요.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '처음이라면 입문 문제부터' })).toBeInTheDocument()
    expect(await screen.findAllByRole('link', { name: /보기$/ })).not.toHaveLength(0)
    expect(screen.getByRole('link', { name: /SQL Injection문제/ })).toHaveAttribute(
      'href',
      '/problems?category=sqli',
    )
  })

  it('아직 푼 문제가 없으면 환영 안내', async () => {
    server.use(
      http.get('*/api/me/progress', () =>
        HttpResponse.json({
          totalChallenges: 23,
          completed: 0,
          unfinished: 0,
          categories: [{ key: 'sqli', name: 'SQL Injection', total: 3, completed: 0 }],
        }),
      ),
    )
    renderAt('/', 'learner', 'none')
    expect(
      await screen.findByRole('heading', { name: '환영해요, forge_kim님' }),
    ).toBeInTheDocument()
    expect(screen.getByText('아직 푼 문제가 없어요.')).toBeInTheDocument()
  })
})

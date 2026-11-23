import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { renderAt, setupMockServer } from '@/test/app'

setupMockServer()

const rows = async () => {
  const list = await screen.findByRole('list')
  return within(list).getAllByRole('link')
}

describe('문제 목록', () => {
  it('20개씩 보이고 개수와 내 상태', async () => {
    renderAt('/problems', 'learner', 'READY')
    expect(await screen.findByRole('heading', { name: '문제' })).toBeInTheDocument()
    expect(await screen.findByText('23개')).toBeInTheDocument()
    expect(await rows()).toHaveLength(20)
    expect(screen.getByText('전체 23개 중 1–20')).toBeInTheDocument()
    const xss = screen.getByText('게시판 저장형 XSS').closest('a')!
    expect(within(xss).getByText('완료')).toBeInTheDocument()
    expect(xss).toHaveAttribute('href', '/problems?p=112')
  })

  it('문제를 누르면 오른쪽 패널로 상세, 크게 보기는 상세 페이지, 닫으면 목록만', async () => {
    const router = renderAt('/problems?category=sqli', 'learner')
    await userEvent.click(await screen.findByText('SQL Injection 로그인 우회'))
    const drawer = await screen.findByRole('dialog', { name: 'SQL Injection 로그인 우회' })
    expect(router.state.location.search).toBe('?category=sqli&p=12')
    expect(await within(drawer).findByRole('heading', { name: '할 일' })).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: '실습 시작' })).toBeEnabled()
    expect(within(drawer).getByRole('link', { name: '크게 보기' })).toHaveAttribute(
      'href',
      '/problems/12',
    )
    await userEvent.click(within(drawer).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(router.state.location.search).toBe('?category=sqli'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('진행 중 실습의 문제는 내 상태 대신 진행 중', async () => {
    renderAt('/problems?category=sqli', 'learner', 'READY')
    const sqli = (await screen.findByText('SQL Injection 로그인 우회')).closest('a')!
    expect(within(sqli).getByText('진행 중')).toBeInTheDocument()
  })

  it('필터와 검색은 주소에 남고 1쪽부터, 개수는 자기 조건만 빼고 셈', async () => {
    const router = renderAt('/problems?page=2', 'learner')
    await userEvent.click(await screen.findByRole('checkbox', { name: /XSS/ }))
    await waitFor(() => expect(router.state.location.search).toBe('?category=xss'))
    expect(await rows()).toHaveLength(3)
    expect(
      screen.getByRole('checkbox', { name: /SQL Injection/ }).closest('label'),
    ).toHaveTextContent('3')

    await userEvent.click(screen.getByRole('checkbox', { name: /완료/ }))
    await waitFor(() => expect(screen.getAllByRole('link', { name: /XSS/ })).toHaveLength(3))

    await userEvent.type(screen.getByRole('searchbox', { name: '문제 검색' }), '반사형')
    await waitFor(() =>
      expect(router.state.location.search).toContain('q=%EB%B0%98%EC%82%AC%ED%98%95'),
    )
    await waitFor(async () => expect(await rows()).toHaveLength(1))
  })

  it('고른 필터를 목록 위 칩으로 보여 주고, 칩마다 빼거나 모두 지움(정렬은 그대로)', async () => {
    const router = renderAt(
      '/problems?q=SSRF&category=ssrf&difficulty=ADVANCED&sort=TIME',
      'learner',
    )
    expect(await screen.findByRole('button', { name: '검색: SSRF 필터 빼기' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'SSRF 필터 빼기' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '고급 필터 빼기' }))
    await waitFor(() =>
      expect(router.state.location.search).toBe('?q=SSRF&category=ssrf&sort=TIME'),
    )
    expect(screen.getByRole('checkbox', { name: /고급/ })).not.toBeChecked()

    await userEvent.click(screen.getByRole('button', { name: '모두 지우기' }))
    await waitFor(() => expect(router.state.location.search).toBe('?sort=TIME'))
    expect(screen.queryByRole('button', { name: '모두 지우기' })).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: '문제 검색' })).toHaveValue('')
  })

  it('맞는 문제가 없으면 안내와 조건 지우기', async () => {
    const router = renderAt('/problems?q=없는문제', 'learner')
    expect(await screen.findByText('조건에 맞는 문제가 없어요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '조건 모두 지우기' }))
    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect(screen.getByRole('searchbox', { name: '문제 검색' })).toHaveValue('')
  })

  it('다음 페이지', async () => {
    const router = renderAt('/problems', 'learner')
    await userEvent.click(await screen.findByRole('button', { name: '다음 페이지' }))
    await waitFor(async () => expect(await rows()).toHaveLength(3))
    expect(router.state.location.search).toBe('?page=2')
  })

  it('정렬 드롭다운: 기준마다 기본·반대 방향(ADR 028)', async () => {
    const router = renderAt('/problems', 'learner')
    const pick = async (now: string, next: string) => {
      await userEvent.click(await screen.findByRole('button', { name: `정렬: ${now}` }))
      await userEvent.click(await screen.findByRole('menuitemradio', { name: next }))
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    }
    await pick('새로 추가된 순', '짧은 순')
    await waitFor(() => expect(router.state.location.search).toBe('?sort=TIME'))
    await waitFor(async () => expect((await rows())[0]).toHaveTextContent('열린 디버그 페이지'))

    await pick('짧은 순', '긴 순')
    await waitFor(() => expect(router.state.location.search).toBe('?sort=TIME&reverse=true'))
    await waitFor(async () => expect((await rows())[0]).toHaveTextContent('세션 쿠키 역직렬화'))

    await pick('긴 순', '오래된 순')
    await waitFor(() => expect(router.state.location.search).toBe('?reverse=true'))
    await waitFor(async () =>
      expect((await rows())[0]).toHaveTextContent('SQL Injection 로그인 우회'),
    )
  })
})

describe('문제 상세와 실습 시작', () => {
  it('설명(Markdown)을 보여 주고 시작하면 실습 화면으로', async () => {
    const router = renderAt('/problems/12', 'learner')
    expect(
      await screen.findByRole('heading', { name: 'SQL Injection 로그인 우회' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '할 일' })).toBeInTheDocument()
    expect(screen.getByText('web/src/index.php')).toBeInTheDocument()
    expect(screen.getByText('전용 실습 환경을 만들어요')).toBeInTheDocument()
    expect(screen.queryByText('다른 실습이 진행 중이에요')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '실습 시작' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/labs/42'))
  })

  it('이 문제를 실습 중이면 돌아가기, 다른 문제면 진행 중 실습으로', async () => {
    renderAt('/problems/12', 'learner', 'READY')
    expect(await screen.findByText('이 문제를 실습 중이에요')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '실습으로 돌아가기' })).toHaveAttribute(
      'href',
      '/labs/42',
    )
  })

  it('다른 문제를 실습 중이면 시작 대신 안내', async () => {
    renderAt('/problems/128', 'learner', 'CREATING')
    expect(await screen.findByText('다른 실습이 진행 중이에요')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '실습 시작' })).not.toBeInTheDocument()
  })

  it('정원이 차면 안내', async () => {
    renderAt('/problems/128', 'learner', 'capacity-full')
    await userEvent.click(await screen.findByRole('button', { name: '실습 시작' }))
    expect(await screen.findByText(/실습 자리가 모두 찼어요/)).toBeInTheDocument()
  })

  it('승인 대기 계정은 시작할 수 없음', async () => {
    renderAt('/problems/128', 'pending')
    expect(await screen.findByRole('button', { name: '실습 시작' })).toBeDisabled()
    expect(screen.getByText('가입이 승인되면 실습을 시작할 수 있어요.')).toBeInTheDocument()
  })

  it('없는 문제는 404 화면', async () => {
    renderAt('/problems/999', 'learner')
    expect(await screen.findByText(/찾을 수 없/)).toBeInTheDocument()
  })
})

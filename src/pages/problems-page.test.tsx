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
    expect(xss).toHaveAttribute('href', '/problems/112')
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

  it('열 제목을 누르면 그 기준, 다시 누르면 반대 방향(ADR 028)', async () => {
    const router = renderAt('/problems', 'learner')
    await userEvent.click(await screen.findByRole('button', { name: /^예상: 누르면 짧은 순/ }))
    await waitFor(() => expect(router.state.location.search).toBe('?sort=TIME'))
    await waitFor(async () => expect((await rows())[0]).toHaveTextContent('열린 디버그 페이지'))

    await userEvent.click(
      screen.getByRole('button', { name: /^예상: 짧은 순으로 정렬됨, 누르면 긴 순/ }),
    )
    await waitFor(() => expect(router.state.location.search).toBe('?sort=TIME&reverse=true'))
    await waitFor(async () => expect((await rows())[0]).toHaveTextContent('세션 쿠키 역직렬화'))

    await userEvent.click(screen.getByRole('button', { name: /^번호: 누르면 새로 추가된 순/ }))
    await waitFor(() => expect(router.state.location.search).toBe(''))
    await userEvent.click(
      screen.getByRole('button', { name: /^번호: 새로 추가된 순으로 정렬됨, 누르면 오래된 순/ }),
    )
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

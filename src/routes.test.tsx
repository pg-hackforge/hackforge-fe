import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import '@/api/query' // 앱과 같은 공통 처리(CSRF, 오류 변환)를 기본 client에 붙인다
import { client } from '@/api/generated/client.gen'
import { ThemeProvider } from '@/components/theme-provider'
import { handlers } from '@/mocks/handlers'
import { saveScenario, type Scenario } from '@/mocks/scenario'
import { routes } from '@/routes'

// 화면 테스트도 mock 모드와 같은 가짜 응답을 쓴다
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
beforeEach(() => {
  client.setConfig({ baseUrl: 'http://localhost' }) // Node의 fetch는 상대 주소를 받지 않는다
  localStorage.clear()
  document.cookie = 'XSRF-TOKEN=mock; path=/'
})

function renderAt(path: string, account: Scenario['account']) {
  saveScenario({ account, lab: 'none' })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  )
  return router
}

const nav = () => screen.findByRole('navigation', { name: '주 메뉴' })

describe('로그인 안 됨', () => {
  it('첫 화면에 로그인·가입 신청이 있고 주 메뉴는 없음', async () => {
    renderAt('/', 'logged-out')
    const topBar = within(await screen.findByRole('banner'))
    expect(await topBar.findByRole('link', { name: '가입 신청' })).toBeInTheDocument()
    expect(topBar.getByRole('link', { name: '로그인' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: '주 메뉴' })).not.toBeInTheDocument()
  })

  it('로그인이 필요한 경로는 로그인 화면으로 보냄', async () => {
    const router = renderAt('/problems', 'logged-out')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})

describe('로그인함', () => {
  it('학습자는 홈·문제·내 기록 메뉴가 있고 관리 메뉴는 없음', async () => {
    renderAt('/', 'learner')
    const menu = within(await nav())
    expect(menu.getByRole('link', { name: '홈' })).toBeInTheDocument()
    expect(menu.getByRole('link', { name: '문제' })).toBeInTheDocument()
    expect(menu.getByRole('link', { name: '내 기록' })).toBeInTheDocument()
    expect(menu.queryByRole('link', { name: '관리' })).not.toBeInTheDocument()
  })

  it('학습자가 관리 경로로 오면 403 화면', async () => {
    renderAt('/admin', 'learner')
    expect(await screen.findByRole('heading', { name: '접근 권한이 없습니다' })).toBeInTheDocument()
  })

  it('관리자는 관리 메뉴가 있고 관리 화면에 들어감', async () => {
    renderAt('/admin', 'admin')
    expect(within(await nav()).getByRole('link', { name: '관리' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '관리' })).toBeInTheDocument()
  })

  it.each([
    ['pending', '승인 대기 중입니다'],
    ['rejected', '가입이 거절되었습니다'],
  ] as const)('%s 계정은 상단 줄 아래에 안내 띠', async (account, text) => {
    renderAt('/', account)
    expect(await screen.findByRole('status')).toHaveTextContent(text)
  })

  it('승인된 계정은 안내 띠가 없음', async () => {
    renderAt('/', 'learner')
    await nav()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('사용자 메뉴에 닉네임·역할·이메일이 있고, 내 계정으로 이동함', async () => {
    const router = renderAt('/', 'learner')
    await userEvent.click(await screen.findByRole('button', { name: /forge_kim/ }))
    const menu = within(await screen.findByRole('menu'))
    expect(menu.getByText('학습자')).toBeInTheDocument()
    expect(menu.getByText('forge_kim@example.com')).toBeInTheDocument()
    await userEvent.click(menu.getByRole('menuitem', { name: '내 계정' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/account'))
  })

  it('사용자 메뉴의 테마 선택이 저장됨', async () => {
    renderAt('/', 'learner')
    await userEvent.click(await screen.findByRole('button', { name: /forge_kim/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '라이트' }))
    expect(localStorage.getItem('hackforge-theme')).toBe('light')
  })

  it('사용자 메뉴에서 로그아웃하면 첫 화면의 로그인 상태로', async () => {
    const router = renderAt('/problems', 'learner')
    await userEvent.click(await screen.findByRole('button', { name: /forge_kim/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '로그아웃' }))
    expect(
      await within(screen.getByRole('banner')).findByRole('link', { name: '가입 신청' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('그 밖의 화면', () => {
  it('없는 주소는 404 화면', async () => {
    renderAt('/no-such-page', 'learner')
    expect(
      await screen.findByRole('heading', { name: '페이지를 찾을 수 없습니다' }),
    ).toBeInTheDocument()
  })

  it('백엔드에 연결할 수 없으면 연결 실패 화면', async () => {
    server.use(http.get('*/api/me', () => HttpResponse.error()))
    renderAt('/', 'learner')
    expect(
      await screen.findByRole('heading', { name: '백엔드에 연결할 수 없습니다' }),
    ).toBeInTheDocument()
  })
})

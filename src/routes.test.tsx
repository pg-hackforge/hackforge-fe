import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { renderAt, setupMockServer } from '@/test/app'

const server = setupMockServer()

const nav = () => screen.findByRole('navigation', { name: '주 메뉴' })

describe('로그인 안 됨', () => {
  it('첫 화면은 소개 화면: 자기 상단 줄에 로그인·회원가입, 주 메뉴는 없음', async () => {
    renderAt('/', 'logged-out')
    // 내 계정을 묻는 동안은 앱 상단 줄이라, 소개 화면이 뜬 뒤 상단 줄을 본다
    expect(await screen.findByRole('heading', { level: 1, name: /Strike Hot/ })).toBeInTheDocument()
    const topBar = within(screen.getByRole('banner'))
    expect(topBar.getByRole('link', { name: '회원가입' })).toHaveAttribute('href', '/signup')
    // 휴대폰 폭의 메뉴 안에도 로그인이 있다
    expect(topBar.getAllByRole('link', { name: '로그인' })[0]).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('navigation', { name: '주 메뉴' })).not.toBeInTheDocument()
  })

  it('소개 화면이 아닌 곳은 앱 상단 줄에 로그인·회원가입', async () => {
    renderAt('/login', 'logged-out')
    const topBar = within(await screen.findByRole('banner'))
    expect(await topBar.findByRole('link', { name: '회원가입' })).toBeInTheDocument()
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
    expect(menu.queryByRole('link', { name: '관리자' })).not.toBeInTheDocument()
  })

  it('학습자가 관리 경로로 오면 403 화면', async () => {
    renderAt('/admin', 'learner')
    expect(await screen.findByRole('heading', { name: '접근 권한이 없어요' })).toBeInTheDocument()
  })

  it('관리자는 관리 메뉴가 있고 관리 화면에 들어감', async () => {
    const router = renderAt('/admin', 'admin')
    expect(within(await nav()).getByRole('link', { name: '관리자' })).toBeInTheDocument()
    // 관리자 첫 화면은 실습 세션
    expect(
      await screen.findByRole('link', { name: '실습 세션', current: 'page' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/labs')
  })

  it.each([
    ['pending', '가입 승인을 기다리고 있어요'],
    ['rejected', '가입이 승인되지 않았어요'],
  ] as const)('%s 계정은 상단 줄 아래에 안내 띠', async (account, text) => {
    renderAt('/', account)
    expect(await screen.findByRole('status')).toHaveTextContent(text)
  })

  it('승인된 계정은 안내 띠가 없음', async () => {
    renderAt('/', 'learner')
    await nav()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('사용자 메뉴에 닉네임·권한·이메일이 있고, 내 정보로 이동함', async () => {
    const router = renderAt('/', 'learner')
    await userEvent.click(await screen.findByRole('button', { name: /forge_kim/ }))
    const menu = within(await screen.findByRole('menu'))
    expect(menu.getByText('학습자')).toBeInTheDocument()
    expect(menu.getByText('forge_kim@example.com')).toBeInTheDocument()
    await userEvent.click(menu.getByRole('menuitem', { name: '내 정보' }))
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
    expect(await screen.findByRole('heading', { level: 1, name: /Strike Hot/ })).toBeInTheDocument()
    expect(
      within(screen.getByRole('banner')).getByRole('link', { name: '회원가입' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('그 밖의 화면', () => {
  it('없는 주소는 404 화면', async () => {
    renderAt('/no-such-page', 'learner')
    expect(
      await screen.findByRole('heading', { name: '페이지를 찾을 수 없어요' }),
    ).toBeInTheDocument()
  })

  it('백엔드에 연결할 수 없으면 연결 실패 화면', async () => {
    server.use(http.get('*/api/me', () => HttpResponse.error()))
    renderAt('/', 'learner')
    expect(
      await screen.findByRole('heading', { name: '서버에 연결할 수 없어요' }),
    ).toBeInTheDocument()
  })
})

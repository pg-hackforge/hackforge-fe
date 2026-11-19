import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { renderAt, setupMockServer } from '@/test/app'

const server = setupMockServer()

async function logIn(email: string, password = 'Passw0rd!') {
  await userEvent.type(await screen.findByLabelText('이메일'), email)
  await userEvent.type(screen.getByLabelText('비밀번호'), password)
  await userEvent.click(screen.getByRole('button', { name: '로그인' }))
}

type SignupInput = { email?: string; password?: string; confirm?: string; nickname?: string }

async function signUp({
  email = 'new@example.com',
  password = 'Passw0rd!',
  confirm = password,
  nickname = 'new_kim',
}: SignupInput = {}) {
  await userEvent.type(await screen.findByLabelText('이메일'), email)
  await userEvent.type(screen.getByLabelText('비밀번호'), password)
  await userEvent.type(screen.getByLabelText('비밀번호 확인'), confirm)
  await userEvent.type(screen.getByLabelText('이름'), '김새내')
  await userEvent.type(screen.getByLabelText('닉네임'), nickname)
  await userEvent.type(screen.getByLabelText('소속'), '한빛대학교')
  await userEvent.click(screen.getByLabelText('[필수] 개인정보 수집·이용 동의'))
  await userEvent.click(screen.getByRole('button', { name: '가입하기' }))
}

describe('로그인', () => {
  it('로그인이 필요한 화면에서 왔으면 로그인 후 그 화면으로', async () => {
    const router = renderAt('/problems', 'logged-out')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    await logIn('forge_kim@example.com')
    await waitFor(() => expect(router.state.location.pathname).toBe('/problems'))
    expect(await screen.findByRole('navigation', { name: '주 메뉴' })).toBeInTheDocument()
  })

  it('바로 로그인 화면으로 왔으면 로그인 후 홈으로', async () => {
    const router = renderAt('/login', 'logged-out')
    await logIn('forge_kim@example.com')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(
      await screen.findByRole('heading', { name: '안녕하세요, forge_kim님' }),
    ).toBeInTheDocument()
  })

  it('이메일이나 비밀번호가 틀리면 어느 쪽인지 말하지 않는 안내', async () => {
    renderAt('/login', 'logged-out')
    await logIn('nobody@example.com')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '이메일 또는 비밀번호를 다시 확인해 주세요.',
    )
  })

  it('잠긴 계정은 15분 뒤 다시 시도하라는 안내', async () => {
    renderAt('/login', 'logged-out')
    await logIn('locked@example.com')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('로그인이 잠겼어요')
    expect(alert).toHaveTextContent('15분 동안 로그인할 수 없어요')
  })

  it.each(['/login', '/signup'])('로그인한 상태로 %s에 오면 홈으로', async (path) => {
    const router = renderAt(path, 'learner')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })
})

describe('회원가입', () => {
  it('가입하면 바로 로그인되어 홈에 승인 대기 안내 띠', async () => {
    const router = renderAt('/signup', 'logged-out')
    await signUp()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(
      await screen.findByRole('heading', { name: '안녕하세요, new_kim님' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('가입 승인을 기다리고 있어요')
  })

  it('이미 가입된 이메일은 이메일 칸 아래에', async () => {
    renderAt('/signup', 'logged-out')
    await signUp({ email: 'forge_kim@example.com' })
    await waitFor(() =>
      expect(screen.getByLabelText('이메일')).toHaveAccessibleDescription(
        '이미 가입된 이메일이에요',
      ),
    )
    expect(screen.getByLabelText('이메일')).toHaveAttribute('aria-invalid', 'true')
  })

  it('이미 사용 중인 닉네임은 닉네임 칸 아래에', async () => {
    renderAt('/signup', 'logged-out')
    await signUp({ nickname: 'forge_kim' })
    await waitFor(() =>
      expect(screen.getByLabelText('닉네임')).toHaveAccessibleDescription(
        '이미 사용 중인 닉네임이에요',
      ),
    )
  })

  it('입력 규칙 위반은 백엔드가 준 문구를 그 칸 아래에', async () => {
    renderAt('/signup', 'logged-out')
    await signUp({ nickname: 'a b' })
    await waitFor(() =>
      expect(screen.getByLabelText('닉네임')).toHaveAccessibleDescription(
        '2~20자의 한글, 영문, 숫자, _만 쓸 수 있어요',
      ),
    )
  })

  it('비밀번호 확인이 다르면 요청하지 않고 확인 칸 아래에', async () => {
    let requested = false
    server.use(
      http.post('*/api/auth/signup', () => {
        requested = true
        return new HttpResponse(null, { status: 500 })
      }),
    )
    renderAt('/signup', 'logged-out')
    await signUp({ confirm: 'Passw0rd?' })
    expect(screen.getByLabelText('비밀번호 확인')).toHaveAccessibleDescription(
      '비밀번호가 일치하지 않아요',
    )
    expect(requested).toBe(false)
  })

  it('비밀번호 규칙은 입력하는 동안 맞는 것부터 통과로', async () => {
    renderAt('/signup', 'logged-out')
    const rules = within(await screen.findByRole('list', { name: '비밀번호 규칙' }))
    await userEvent.type(screen.getByLabelText('비밀번호'), 'abc1')
    expect(rules.getByText('영문').closest('li')).toHaveAttribute('data-ok', 'true')
    expect(rules.getByText('숫자').closest('li')).toHaveAttribute('data-ok', 'true')
    expect(rules.getByText('8~64자').closest('li')).toHaveAttribute('data-ok', 'false')
  })

  it('가입은 됐는데 이어서 하는 로그인이 실패하면 로그인 화면에서 안내', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.error()))
    const router = renderAt('/signup', 'logged-out')
    await signUp()
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(await screen.findByRole('status')).toHaveTextContent(
      '회원가입이 완료됐어요. 로그인해 주세요.',
    )
    expect(screen.getByLabelText('이메일')).toHaveValue('new@example.com')
  })

  it('동의 내용은 보기를 눌러 펼침', async () => {
    renderAt('/signup', 'logged-out')
    const more = await screen.findByRole('button', { name: '보기' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(more)
    expect(
      screen.getByText(/탈퇴를 요청하거나 서비스 운영을 끝내면 지체 없이 파기합니다/),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: '접기' })).toHaveAttribute('aria-expanded', 'true')
  })
})

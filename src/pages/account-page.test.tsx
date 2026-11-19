import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { renderAt, setupMockServer } from '@/test/app'

const server = setupMockServer()

async function changePassword(current: string, next = 'NewPassw0rd!', confirm = next) {
  await userEvent.type(await screen.findByLabelText('현재 비밀번호'), current)
  await userEvent.type(screen.getByLabelText('새 비밀번호'), next)
  await userEvent.type(screen.getByLabelText('새 비밀번호 확인'), confirm)
  await userEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
}

describe('기본 정보', () => {
  it('내 정보를 보기만 함', async () => {
    renderAt('/account', 'learner')
    expect(await screen.findByRole('heading', { name: '내 정보' })).toBeInTheDocument()
    const info = within(screen.getByRole('region', { name: '기본 정보' }))
    expect(info.getByText('forge_kim@example.com')).toBeInTheDocument()
    expect(info.getByText('forge_kim')).toBeInTheDocument()
    expect(info.getByText('학습자')).toBeInTheDocument()
    expect(info.getByText('승인 완료')).toBeInTheDocument()
    expect(info.getByText('2026년 11월 1일')).toBeInTheDocument()
    expect(info.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('승인 대기 계정은 승인 상태가 승인 대기', async () => {
    renderAt('/account', 'pending')
    const info = within(await screen.findByRole('region', { name: '기본 정보' }))
    expect(info.getByText('승인 대기')).toBeInTheDocument()
  })
})

describe('비밀번호 변경', () => {
  it('바꾸면 성공 안내를 보여 주고 칸을 비움', async () => {
    renderAt('/account', 'learner')
    await changePassword('Passw0rd!')
    expect(await screen.findByRole('status')).toHaveTextContent(
      '비밀번호를 바꿨어요. 다른 기기에서는 로그아웃됐어요.',
    )
    expect(screen.getByLabelText('현재 비밀번호')).toHaveValue('')
    expect(screen.getByLabelText('새 비밀번호')).toHaveValue('')
    expect(screen.getByLabelText('새 비밀번호 확인')).toHaveValue('')
  })

  it('현재 비밀번호가 틀리면 그 칸 아래에', async () => {
    renderAt('/account', 'learner')
    await changePassword('wrong')
    await waitFor(() =>
      expect(screen.getByLabelText('현재 비밀번호')).toHaveAccessibleDescription(
        '현재 비밀번호가 맞지 않아요. 5번 잘못 입력하면 15분 동안 로그인할 수 없어요.',
      ),
    )
  })

  it('새 비밀번호 규칙 위반은 백엔드 문구를 새 비밀번호 칸 아래에', async () => {
    renderAt('/account', 'learner')
    await changePassword('Passw0rd!', 'short')
    await waitFor(() =>
      expect(screen.getByLabelText('새 비밀번호')).toHaveAccessibleDescription(
        '8~64자로 영문, 숫자, 특수문자를 하나 이상씩 넣어 주세요',
      ),
    )
  })

  it('새 비밀번호 확인이 다르면 요청하지 않고 확인 칸 아래에', async () => {
    let requested = false
    server.use(
      http.put('*/api/me/password', () => {
        requested = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderAt('/account', 'learner')
    await changePassword('Passw0rd!', 'NewPassw0rd!', 'NewPassw0rd?')
    expect(screen.getByLabelText('새 비밀번호 확인')).toHaveAccessibleDescription(
      '비밀번호가 일치하지 않아요',
    )
    expect(requested).toBe(false)
  })

  it('5번째로 틀려 잠기면 로그아웃되고 로그인 화면에 잠김 안내', async () => {
    const router = renderAt('/account', 'learner')
    await changePassword('locked')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(await screen.findByRole('alert')).toHaveTextContent('로그인이 잠겼어요')
    expect(
      within(screen.getByRole('banner')).getByRole('link', { name: '회원가입' }),
    ).toBeInTheDocument()
  })

  it('다른 곳의 로그인 실패로 이미 잠겼으면 세션은 그대로이고 이 화면에서 안내', async () => {
    server.use(
      http.put('*/api/me/password', () =>
        HttpResponse.json(
          { status: 429, code: 'ACCOUNT_LOCKED', title: '잠김' },
          { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    const router = renderAt('/account', 'learner')
    await changePassword('Passw0rd!')
    expect(await screen.findByRole('alert')).toHaveTextContent('로그인이 잠겼어요')
    expect(router.state.location.pathname).toBe('/account')
  })
})

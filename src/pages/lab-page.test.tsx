import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { renderAt, setupMockServer } from '@/test/app'

setupMockServer()

const rail = (name: string) =>
  within(screen.getByRole('navigation', { name: '실습 화면' })).getByRole('button', {
    name: new RegExp(name),
  })

describe('실습 화면', () => {
  it('준비 중이면 준비 단계와 지금 단계, 레일은 막힘', async () => {
    renderAt('/labs/42', 'learner', 'INITIALIZING')
    expect(
      await screen.findByRole('heading', { name: '실습 환경을 준비하고 있어요' }),
    ).toBeInTheDocument()
    const step = (name: string) => screen.getByText(name).closest('li')!
    expect(step('실습 서비스 불러오기')).toHaveTextContent('(진행 중)')
    expect(step('컨테이너 시작')).not.toHaveTextContent('(진행 중)')
    expect(rail('공격 대상')).toBeDisabled()
  })

  it('준비가 끝나면 공격 대상 화면, 공격 단계 표시, 코드는 잠김', async () => {
    renderAt('/labs/42', 'learner', 'READY')
    expect(await screen.findByTitle('공격 대상')).toBeInTheDocument()
    expect(screen.getByText('공격', { selector: '[aria-current="step"]' })).toBeInTheDocument()
    expect(rail('코드')).toBeDisabled()
    expect(screen.getByText(/자동 종료까지/)).toHaveTextContent(/(29|30):\d\d/)

    await userEvent.click(rail('문제'))
    expect(await screen.findByRole('heading', { name: '할 일' })).toBeInTheDocument()
  })

  it('곧 자동 종료면 안내와 계속하기', async () => {
    renderAt('/labs/42', 'learner', 'idle-warning')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('뒤에 실습이 자동으로 끝나요')
    await userEvent.click(within(alert).getByRole('button', { name: '계속하기' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('실습 종료는 확인 창을 거쳐 끝내고 안내', async () => {
    renderAt('/labs/42', 'learner', 'READY')
    await userEvent.click(await screen.findByRole('button', { name: '실습 종료' }))
    const dialog = await screen.findByRole('alertdialog', { name: '실습을 종료할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '실습 종료' }))
    expect(await screen.findByRole('heading', { name: '실습을 종료했어요' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '문제로 돌아가기' })).toHaveAttribute(
      'href',
      '/problems/12',
    )
  })

  it('관리자가 끝낸 실습은 그 이유를 안내', async () => {
    renderAt('/labs/42', 'learner', 'ended-admin')
    expect(
      await screen.findByRole('heading', { name: '관리자가 실습을 종료했어요' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '실습 종료' })).not.toBeInTheDocument()
  })

  it('생성에 실패하면 다시 시작', async () => {
    renderAt('/labs/42', 'learner', 'FAILED')
    expect(
      await screen.findByRole('heading', { name: '실습 환경을 만들지 못했어요' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시작' })).toBeEnabled()
  })

  it('로그인하지 않았으면 로그인 화면으로', async () => {
    const router = renderAt('/labs/42', 'logged-out')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { renderAt, setupMockServer } from '@/test/app'

const server = setupMockServer()

const tab = (name: RegExp) => screen.findByRole('tab', { name })
const row = async (name: string) =>
  (await screen.findByRole('cell', { name: new RegExp(name) })).closest('tr') as HTMLElement

describe('목록', () => {
  it('처음에는 승인 대기 탭이고, 탭마다 회원 수', async () => {
    renderAt('/admin/users', 'admin')
    expect(await screen.findByRole('link', { name: '회원', current: 'page' })).toBeInTheDocument()
    expect(await tab(/승인 대기\s*3/)).toHaveAttribute('aria-selected', 'true')
    expect(await tab(/승인 완료\s*3/)).toBeInTheDocument()
    expect(await tab(/거절\s*1/)).toBeInTheDocument()
    const sumin = await row('이수민')
    expect(within(sumin).getByText('웹보안 3분반 수강생입니다.')).toBeInTheDocument()
  })

  it('승인 완료 탭은 가입 메모 대신 권한, 내 줄은 권한 변경과 임시 비밀번호를 막음', async () => {
    renderAt('/admin/users', 'admin')
    await userEvent.click(await tab(/승인 완료/))
    const me = await row('admin@example.com')
    expect(within(me).getByText('나')).toBeInTheDocument()
    expect(within(me).getByRole('button', { name: '권한 변경' })).toBeDisabled()
    expect(within(me).getByRole('button', { name: '임시 비밀번호' })).toBeDisabled()
    expect(within(await row('김대장')).getByText('학습자')).toBeInTheDocument()
  })

  it('목록이 비면 안내', async () => {
    server.use(http.get('*/api/admin/users', () => HttpResponse.json([])))
    renderAt('/admin/users', 'admin')
    expect(await screen.findByText('승인을 기다리는 회원이 없어요')).toBeInTheDocument()
  })
})

describe('승인과 거절', () => {
  it('승인은 확인 창 없이 바로 하고 승인 완료로 옮겨 감', async () => {
    renderAt('/admin/users', 'admin')
    await userEvent.click(within(await row('이수민')).getByRole('button', { name: '승인' }))
    expect(await tab(/승인 대기\s*2/)).toBeInTheDocument()
    expect(await tab(/승인 완료\s*4/)).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: /이수민/ })).not.toBeInTheDocument()
  })

  it('거절은 확인 창을 거침. 취소하면 그대로', async () => {
    renderAt('/admin/users', 'admin')
    await userEvent.click(within(await row('이수민')).getByRole('button', { name: '거절' }))
    const dialog = await screen.findByRole('alertdialog', {
      name: '이수민 님의 가입을 거절할까요?',
    })
    await userEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(await tab(/승인 대기\s*3/)).toBeInTheDocument()
  })

  it('거절하기를 누르면 거절 탭으로 옮겨 감', async () => {
    renderAt('/admin/users', 'admin')
    await userEvent.click(within(await row('이수민')).getByRole('button', { name: '거절' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '거절하기' }))
    expect(await tab(/거절\s*2/)).toBeInTheDocument()
    expect(await tab(/승인 대기\s*2/)).toBeInTheDocument()
  })

  it('거절 탭에서 다시 승인할 수 있음', async () => {
    renderAt('/admin/users', 'admin')
    await userEvent.click(await tab(/거절/))
    await userEvent.click(within(await row('한도윤')).getByRole('button', { name: '승인' }))
    expect(await tab(/거절\s*0/)).toBeInTheDocument()
  })

  it('다른 관리자가 먼저 처리했으면 안내하고 목록을 새로 고침', async () => {
    renderAt('/admin/users', 'admin')
    await userEvent.click(within(await row('박준호')).getByRole('button', { name: '승인' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '이미 다른 관리자가 처리한 회원이에요. 목록을 새로 고쳤어요.',
    )
    await waitFor(() =>
      expect(screen.queryByRole('cell', { name: /박준호/ })).not.toBeInTheDocument(),
    )
  })
})

describe('확인 창에서 실패', () => {
  it('창을 닫고 안내를 보여 줌', async () => {
    server.use(
      http.post('*/api/admin/users/:id/reject', () =>
        HttpResponse.json(
          { status: 409, code: 'INVALID_STATUS_TRANSITION', title: '이미 처리된 회원이에요' },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderAt('/admin/users', 'admin')
    await userEvent.click(within(await row('이수민')).getByRole('button', { name: '거절' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: '거절하기' }),
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '이미 다른 관리자가 처리한 회원이에요',
    )
  })
})

describe('권한 변경', () => {
  it('창에서 권한을 골라 바꿈', async () => {
    renderAt('/admin/users', 'admin')
    await userEvent.click(await tab(/승인 완료/))
    await userEvent.click(within(await row('김대장')).getByRole('button', { name: '권한 변경' }))
    const dialog = await screen.findByRole('alertdialog', { name: '김대장 님의 권한 변경' })
    expect(within(dialog).getByRole('radio', { name: /학습자/ })).toBeChecked()
    expect(within(dialog).getByRole('button', { name: '변경하기' })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('radio', { name: /출제자/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: '변경하기' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(await within(await row('김대장')).findByText('출제자')).toBeInTheDocument()
  })
})

describe('임시 비밀번호', () => {
  it('발급을 확인하면 비밀번호를 한 번 보여 주고, 창을 닫으면 사라짐', async () => {
    renderAt('/admin/users', 'admin')
    await userEvent.click(await tab(/승인 완료/))
    await userEvent.click(
      within(await row('김대장')).getByRole('button', { name: '임시 비밀번호' }),
    )
    const confirm = await screen.findByRole('alertdialog', {
      name: '김대장 님의 임시 비밀번호를 발급할까요?',
    })
    await userEvent.click(within(confirm).getByRole('button', { name: '발급하기' }))
    const result = await screen.findByRole('alertdialog', { name: '임시 비밀번호를 발급했어요' })
    expect(within(result).getByText('Tq7#mW2pLx9!')).toBeInTheDocument()
    expect(result).toHaveTextContent('창을 닫으면 다시 볼 수 없어요')
    await userEvent.click(within(result).getByRole('button', { name: '확인' }))
    await waitFor(() => expect(screen.queryByText('Tq7#mW2pLx9!')).not.toBeInTheDocument())
  })
})

import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { renderAt, setupMockServer } from '@/test/app'

setupMockServer()

const rows = async () => {
  const table = await screen.findByRole('table')
  return within(table).getAllByRole('row').slice(1)
}

describe('관리자 실습 세션', () => {
  it('진행 중 세션: 학습자, 문제, 상태, 진행, 시간과 강제 종료. 탭마다 수', async () => {
    renderAt('/admin/labs', 'admin')
    const [first, preparing, , , terminating] = await rows()
    expect(first).toHaveTextContent('이수민')
    expect(first).toHaveTextContent('실습 중')
    expect(first).toHaveTextContent(/\d+분 뒤 자동 종료/)
    expect(within(first).getByRole('link', { name: '프로필 사진 웹셸 업로드' })).toHaveAttribute(
      'href',
      '/admin/labs/108',
    )
    expect(preparing).toHaveTextContent('준비 중 · 컨테이너 시작')
    // 종료 중인 세션은 강제 종료가 없다
    expect(terminating).toHaveTextContent('종료 중')
    expect(within(terminating).queryByRole('button', { name: '강제 종료' })).not.toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: /진행 중\s*5/ })).toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: /전체\s*9/ })).toBeInTheDocument()
  })

  it('전체 탭은 끝난 세션도 종료 시각과 사유로', async () => {
    const user = userEvent.setup()
    renderAt('/admin/labs', 'admin')
    await user.click(await screen.findByRole('tab', { name: /전체/ }))
    const all = await rows()
    expect(all).toHaveLength(9)
    expect(all[5]).toHaveTextContent(/\d\d:\d\d 종료 · 입력 없음/)
    expect(all[7]).toHaveTextContent('생성 실패')
  })

  it('강제 종료는 확인 창을 거쳐 종료 중으로 바뀜', async () => {
    const user = userEvent.setup()
    renderAt('/admin/labs', 'admin')
    const [first] = await rows()
    await user.click(within(first).getByRole('button', { name: '강제 종료' }))
    const dialog = await screen.findByRole('alertdialog', {
      name: '이수민 님의 실습을 종료할까요?',
    })
    await user.click(within(dialog).getByRole('button', { name: '강제 종료' }))
    expect(await within((await rows())[0]).findByText('종료 중')).toBeInTheDocument()
  })

  it('세션 기록: 학습자와 기록, 강제 종료. 해답은 보이지 않음', async () => {
    renderAt('/admin/labs/108', 'admin')
    expect(
      await screen.findByRole('heading', { name: '프로필 사진 웹셸 업로드' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('sumin_lee@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '실습 세션' })).toHaveAttribute('href', '/admin/labs')
    expect(screen.getByRole('button', { name: '강제 종료' })).toBeInTheDocument()
    expect(await screen.findByRole('list', { name: '이 실습의 기록' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '해답' })).not.toBeInTheDocument()
  })

  it('학습자는 다른 사람의 세션 기록을 볼 수 없음', async () => {
    renderAt('/records/108', 'learner')
    expect(await screen.findByText('페이지를 찾을 수 없어요')).toBeInTheDocument()
  })
})

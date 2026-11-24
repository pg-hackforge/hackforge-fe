import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { renderAt, setupMockServer } from '@/test/app'

const server = setupMockServer()

describe('내 실습 기록', () => {
  it('목록: 세션마다 진행과 결과, 누르면 그 세션의 기록', async () => {
    renderAt('/records', 'learner', 'READY')
    const list = await screen.findByRole('list', { name: '실습 기록' })
    expect(screen.getByText('실습 6번')).toBeInTheDocument()
    const rows = within(list).getAllByRole('link')
    expect(rows[0]).toHaveAttribute('href', '/records/42')
    expect(rows[0]).toHaveTextContent('진행 중')
    expect(within(list).getByText('해답 확인 후 완료')).toBeInTheDocument()
    expect(within(list).getByText('실습 환경을 만들지 못했어요')).toBeInTheDocument()
  })

  it('기록이 없으면 문제 보기로 안내', async () => {
    server.use(
      http.get('*/api/labs', () =>
        HttpResponse.json({ items: [], page: 1, size: 20, totalItems: 0, totalPages: 0 }),
      ),
    )
    renderAt('/records', 'learner')
    expect(await screen.findByText('아직 실습 기록이 없어요.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '문제 보기' })).toHaveAttribute('href', '/problems')
  })

  it('세션 하나: 시작부터 종료까지 오래된 순, 방어 검증은 펼쳐 보고, 연 해답을 다시 봄', async () => {
    const user = userEvent.setup()
    renderAt('/records/39', 'learner')
    expect(await screen.findByRole('heading', { name: '게시판 저장형 XSS' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '문제 보기' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '실습으로 돌아가기' })).not.toBeInTheDocument()

    const timeline = await screen.findByRole('list', { name: '이 실습의 기록' })
    const titles = within(timeline)
      .getAllByRole('listitem')
      .map((item) => item.querySelector('.font-semibold')?.textContent)
    expect(titles[0]).toBe('실습 시작')
    expect(titles.indexOf('해답 열람')).toBeLessThan(titles.indexOf('방어 검증 06'))
    expect(titles.at(-2)).toBe('실습 완료')
    expect(titles.at(-1)).toBe('실습 종료')

    expect(screen.getAllByText('기존 공격 차단')[0]).not.toBeVisible()
    await user.click(screen.getByText('방어 검증 01'))
    expect(screen.getAllByText('기존 공격 차단')[0]).toBeVisible()

    expect(await screen.findByRole('heading', { name: '해답' })).toBeInTheDocument()
    expect(await screen.findByText(/mock 해답이에요/)).toBeInTheDocument()
  })

  it('진행 중인 세션은 실습으로 돌아가기', async () => {
    renderAt('/records/42', 'learner', 'READY')
    expect(await screen.findByRole('link', { name: '실습으로 돌아가기' })).toHaveAttribute(
      'href',
      '/labs/42',
    )
    expect(await screen.findByText('실습 환경 준비 완료')).toBeInTheDocument()
  })

  it('내 세션이 아니면 찾을 수 없음', async () => {
    renderAt('/records/999', 'learner')
    expect(await screen.findByText('페이지를 찾을 수 없어요')).toBeInTheDocument()
  })
})

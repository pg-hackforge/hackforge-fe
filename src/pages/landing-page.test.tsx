import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderAt, setupMockServer } from '@/test/app'

setupMockServer()

describe('소개 화면', () => {
  it('구간 순서대로 제목, 가입 신청과 로그인으로 가는 길', async () => {
    renderAt('/', 'logged-out')
    expect(await screen.findByRole('heading', { level: 1, name: /Strike hot/ })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      '공격이 통하면, 고쳐서 막습니다',
      '한 문제를 공격부터 방어까지끝까지 따라갑니다',
      '통과 여부는 입력이 아니라결과로 판정합니다',
      '마음껏 공격해도 되는 환경',
      '웹 서비스에서 실제로 나오는 취약점을 분류별로',
      '입문 문제부터 시작해 보세요',
    ])
    for (const link of screen.getAllByRole('link', { name: '가입 신청' }))
      expect(link).toHaveAttribute('href', '/signup')
    expect(screen.getByRole('link', { name: '실습 방식 보기' })).toHaveAttribute('href', '#how')
    expect(screen.getByRole('link', { name: '전체 문제 둘러보기' })).toHaveAttribute(
      'href',
      '/problems',
    )
  })

  it('맨 아래 줄에 개발자 이름과 연락처', async () => {
    renderAt('/', 'logged-out')
    const footer = await screen.findByRole('contentinfo')
    expect(footer).toHaveTextContent('기획·개발고성노')
    expect(within(footer).getByRole('link', { name: 'rhtjdsh35@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:rhtjdsh35@gmail.com',
    )
  })

  it('로그인한 사람에게는 홈', async () => {
    renderAt('/', 'learner')
    expect(await screen.findByRole('heading', { name: /안녕하세요/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Strike hot/ })).not.toBeInTheDocument()
  })
})

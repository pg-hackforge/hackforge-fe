import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CATEGORIES } from '@/mocks/challenges'
import { renderAt, setupMockServer } from '@/test/app'

setupMockServer()

describe('소개 화면', () => {
  it('구간 순서대로 제목, 회원가입과 로그인으로 가는 길', async () => {
    renderAt('/', 'logged-out')
    expect(await screen.findByRole('heading', { level: 1, name: /Strike Hot/ })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      '공격이 통하면, 고쳐서 막아요',
      '문제 하나를 공격부터방어 검증까지 이어서 풀어요',
      '통과 여부는 입력이 아니라결과로 판정해요',
      '마음껏 공격해도 되는 환경',
      '웹 서비스에 흔한 취약점을 분류별로 연습해요',
      '입문 문제부터 시작해 보세요',
    ])
    for (const link of screen.getAllByRole('link', { name: '회원가입' }))
      expect(link).toHaveAttribute('href', '/signup')
    expect(screen.getByRole('link', { name: '실습 방식 보기' })).toHaveAttribute('href', '#how')
    expect(screen.getByRole('link', { name: '전체 문제 둘러보기' })).toHaveAttribute(
      'href',
      '/problems',
    )
  })

  it('문제 분류 타일은 실제 분류 목록과 같은 이름, 같은 순서(백엔드 V8, ADR 020)', async () => {
    renderAt('/', 'logged-out')
    const tiles = within(await screen.findByRole('list', { name: '취약점 분류' })).getAllByRole(
      'listitem',
    )
    expect(tiles.map((tile) => tile.querySelector('b')?.textContent)).toEqual(
      CATEGORIES.map(([, name]) => name),
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
    expect(screen.queryByRole('heading', { name: /Strike Hot/ })).not.toBeInTheDocument()
  })
})

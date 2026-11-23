import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderAt, setupMockServer } from '@/test/app'

setupMockServer()

// jsdom에서는 Monaco가 돌지 않아 textarea로 흉내 낸다
vi.mock('@/components/lab/monaco', () => import('@/test/monaco-fake'))

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

  it('공격 검증 PASS면 결과 안내, 방어 단계로 넘어가고 코드가 열림', async () => {
    renderAt('/labs/42', 'learner', 'READY', { verify: 'PASS' })
    await userEvent.click(await screen.findByRole('button', { name: /공격 검증 요청/ }))
    expect(await screen.findByRole('button', { name: /검증 중/ })).toBeDisabled()
    const notice = await screen.findByText(/공격에 성공했어요/, {}, { timeout: 4_000 })
    expect(notice.closest('[role="status"]')).toHaveTextContent('admin으로 로그인함')
    await waitFor(() =>
      expect(screen.getByText('방어', { selector: '[aria-current="step"]' })).toBeInTheDocument(),
    )
    expect(rail('코드')).toBeEnabled()
    expect(screen.queryByRole('button', { name: /공격 검증 요청/ })).not.toBeInTheDocument()
    expect(screen.getByText('마지막 검증').parentElement).toHaveTextContent('PASS')
  })

  it('공격 검증 FAIL과 ERROR는 단계를 바꾸지 않고, 기록에 남음', async () => {
    renderAt('/labs/42', 'learner', 'READY', { verify: 'FAIL' })
    await userEvent.click(await screen.findByRole('button', { name: /공격 검증 요청/ }))
    expect(
      await screen.findByText('아직 공격이 확인되지 않았어요.', {}, { timeout: 4_000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('공격', { selector: '[aria-current="step"]' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '기록 보기' }))
    expect(await screen.findByRole('heading', { name: '공격 검증' })).toBeInTheDocument()
    expect(screen.getByText('관리자로 로그인하지 못했어요 · 3.4초')).toBeInTheDocument()
    expect(rail('기록')).toHaveTextContent('1')
  })

  it('힌트는 순서대로 하나씩 열고, 건너뛰면 방어 단계', async () => {
    renderAt('/labs/42', 'learner', 'READY')
    await userEvent.click(await rail('힌트'))
    await userEvent.click(await screen.findByRole('button', { name: '힌트 1 보기' }))
    expect(await screen.findByText(/서버에서 어떻게 쓰이는지/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '힌트 2 보기' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '힌트 3 보기' })).not.toBeInTheDocument()
    await waitFor(() => expect(rail('힌트')).toHaveTextContent('1/3'))

    await userEvent.click(screen.getByRole('button', { name: '공격 건너뛰기' }))
    const dialog = await screen.findByRole('alertdialog', { name: '공격을 건너뛸까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '건너뛰기' }))
    expect(await screen.findByText('공격을 건너뛰고 방어 단계로 왔어요.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '힌트 2 보기' })).not.toBeInTheDocument()
    expect(rail('코드')).toBeEnabled()
  })

  it('방어 단계: 코드에서 고친 내용은 입력이 멈추면 자동 저장', async () => {
    renderAt('/labs/42', 'learner', 'defense')
    await userEvent.click(await screen.findByRole('button', { name: /^코드/ }))
    const editor = await screen.findByRole('textbox', { name: '코드 편집기' })
    await waitFor(() => expect(editor).toHaveDisplayValue(/<\?php/), {
      timeout: 3_000,
    })
    expect(screen.getByRole('button', { name: /index\.php/ })).toHaveAttribute('aria-current')
    await userEvent.type(editor, '// 고침')
    expect(await screen.findByText(/자동 저장됨/, {}, { timeout: 3_000 })).toBeInTheDocument()
  })

  it('원본과 달라지면 탐색기에 M과 +/− 수, 처음 상태로 되돌리면 사라짐', async () => {
    renderAt('/labs/42', 'learner', 'defense')
    await userEvent.click(await screen.findByRole('button', { name: /^코드/ }))
    const editor = await screen.findByRole('textbox', { name: '코드 편집기' })
    await waitFor(() => expect(editor).toHaveDisplayValue(/<\?php/), { timeout: 3_000 })
    const changes = screen.getByLabelText('원본과 달라진 줄')
    await waitFor(() => expect(changes).toHaveTextContent('+0 −0'))
    expect(screen.getByRole('button', { name: /index\.php/ })).not.toHaveTextContent('M')

    // 마지막 빈 줄에 입력하면 그 줄이 바뀐 줄이 된다
    await userEvent.type(editor, '// 고침')
    await waitFor(() => expect(changes).toHaveTextContent('+1 −1'))
    expect(screen.getByRole('button', { name: /index\.php/ })).toHaveTextContent('M')

    await userEvent.click(screen.getByRole('button', { name: /처음 상태로/ }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: '되돌리기' }),
    )
    await waitFor(() => expect(changes).toHaveTextContent('+0 −0'))
    expect(screen.getByRole('button', { name: /index\.php/ })).not.toHaveTextContent('M')
  })

  it('다른 곳에서 파일이 바뀌었으면 저장을 멈추고 덮어쓸지 물음', async () => {
    renderAt('/labs/42', 'learner', 'defense', { save: 'CONFLICT' })
    await userEvent.click(await screen.findByRole('button', { name: /^코드/ }))
    const editor = await screen.findByRole('textbox', { name: '코드 편집기' })
    await waitFor(() => expect(editor).toHaveDisplayValue(/<\?php/), {
      timeout: 3_000,
    })
    await userEvent.type(editor, 'x')
    const alert = await screen.findByRole('alert', {}, { timeout: 3_000 })
    expect(alert).toHaveTextContent('터미널 등에서 이 파일이 바뀌었어요')
    await userEvent.click(within(alert).getByRole('button', { name: '내 내용으로 덮어쓰기' }))
    expect(await screen.findByText(/자동 저장됨/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('수정 불가 파일은 읽기 전용, 처음 상태로 되돌리기 없음', async () => {
    renderAt('/labs/42', 'learner', 'defense')
    await userEvent.click(await screen.findByRole('button', { name: /^코드/ }))
    await userEvent.click(await screen.findByRole('button', { name: /compose\.yaml/ }))
    const editor = await screen.findByRole('textbox', { name: '코드 편집기' })
    await waitFor(() => expect(editor).toHaveDisplayValue(/services:/), {
      timeout: 3_000,
    })
    expect(editor).toHaveAttribute('readonly')
    expect(screen.getByText('읽기 전용 파일이에요')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /처음 상태로/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /logo\.png/ })).toBeDisabled()
  })

  it('재배포 성공과 실패(빌드 로그)', async () => {
    renderAt('/labs/42', 'learner', 'defense', { redeploy: 'FAIL' })
    await userEvent.click(await screen.findByRole('button', { name: '재배포' }))
    expect(
      await screen.findByText(/재배포에 실패했어요/, {}, { timeout: 4_000 }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '빌드 로그' }))
    const log = await screen.findByRole('dialog', { name: '빌드 로그' })
    expect(log).toHaveTextContent('PHP Parse error')
  })

  it('초기화: 방어 단계에서 처음부터 고르면 서비스 초기화 뒤 공격 단계', async () => {
    renderAt('/labs/42', 'learner', 'defense')
    await userEvent.click(await screen.findByRole('button', { name: '초기화' }))
    const dialog = await screen.findByRole('alertdialog', { name: '무엇을 초기화할까요?' })
    expect(within(dialog).getByRole('radio', { name: /^서비스 초기화/ })).toBeChecked()
    await userEvent.click(within(dialog).getByRole('radio', { name: /공격 단계\)부터/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: '초기화하기' }))
    expect(
      await screen.findByText('서비스를 처음 상태로 되돌렸어요.', {}, { timeout: 4_000 }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText('공격', { selector: '[aria-current="step"]' })).toBeInTheDocument(),
    )
    expect(rail('코드')).toBeDisabled()
  })

  it('공격 단계의 초기화는 단계를 묻지 않음', async () => {
    renderAt('/labs/42', 'learner', 'READY')
    await userEvent.click(await screen.findByRole('button', { name: '초기화' }))
    const dialog = await screen.findByRole('alertdialog', { name: '무엇을 초기화할까요?' })
    expect(within(dialog).getByRole('radio', { name: /실습 환경 다시 만들기/ })).toBeInTheDocument()
    expect(within(dialog).queryByRole('radio', { name: /공격 단계\)부터/ })).not.toBeInTheDocument()
  })

  it('로그인하지 않았으면 로그인 화면으로', async () => {
    const router = renderAt('/labs/42', 'logged-out')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})

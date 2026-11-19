import { getResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { configureApiClient } from '@/api/client'
import { ApiError } from '@/api/errors'
import { createClient, createConfig } from '@/api/generated/client'
import { getCurrentLab, getLab, login, logout, startLab } from '@/api/generated/sdk.gen'
import { fetchMe } from '@/api/me'

import { handlers } from './handlers'
import { loadScenario, saveScenario, type Scenario } from './scenario'

/** 실제 생성 SDK에 mock handler를 fetch로 붙인다(브라우저에서는 service worker가 같은 일을 한다) */
function setup(scenario: Scenario) {
  saveScenario(scenario)
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) =>
    (await getResponse(handlers, new Request(input, init))) ??
    new Response('mock handler 없음', { status: 599 })
  const client = createClient(createConfig({ baseUrl: 'http://localhost', fetch }))
  configureApiClient(client, { onUnauthorized: () => {} })
  return client
}

beforeEach(() => {
  localStorage.clear()
  document.cookie = 'XSRF-TOKEN=mock; path=/'
})

describe('계정 시나리오', () => {
  it('로그인 안 됨이면 내 계정이 null', async () => {
    const client = setup({ account: 'logged-out', lab: 'none' })
    expect(await fetchMe(client)).toBeNull()
  })

  it.each([
    ['pending', 'LEARNER', 'PENDING'],
    ['learner', 'LEARNER', 'APPROVED'],
    ['admin', 'ADMIN', 'APPROVED'],
  ] as const)('%s이면 역할 %s, 상태 %s', async (account, role, status) => {
    const client = setup({ account, lab: 'none' })
    expect(await fetchMe(client)).toMatchObject({ role, status })
  })

  it('시나리오 계정의 이메일로 로그인하면 그 계정으로, 로그아웃하면 로그아웃 상태로 바뀜', async () => {
    const client = setup({ account: 'logged-out', lab: 'none' })
    await login({ client, body: { email: 'forge_kim@example.com', password: 'Passw0rd!' } })
    expect(loadScenario().account).toBe('learner')
    await logout({ client })
    expect(loadScenario().account).toBe('logged-out')
  })
})

describe('실습 시나리오', () => {
  it('없음이면 진행 중 세션이 없음(204)', async () => {
    const client = setup({ account: 'learner', lab: 'none' })
    const { data, response } = await getCurrentLab({ client })
    expect(response?.status).toBe(204)
    expect(data).toBeFalsy()
  })

  it.each(['CREATING', 'READY'] as const)('%s이면 진행 중 세션이 그 상태', async (lab) => {
    const client = setup({ account: 'learner', lab })
    const { data } = await getCurrentLab({ client })
    expect(data?.status).toBe(lab)
  })

  it('FAILED이면 시작은 접수되고 조회하면 FAILED', async () => {
    const client = setup({ account: 'learner', lab: 'FAILED' })
    const started = await startLab({ client, body: { challengeId: 1 } })
    expect(started.data?.status).toBe('CREATING')
    const { data } = await getLab({ client, path: { id: started.data!.id } })
    expect(data?.status).toBe('FAILED')
  })

  it('정원 초과면 시작이 503 LAB_CAPACITY_FULL', async () => {
    const client = setup({ account: 'learner', lab: 'capacity-full' })
    const { error } = await startLab({ client, body: { challengeId: 1 } })
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 503, code: 'LAB_CAPACITY_FULL' })
  })

  it('승인 대기 계정은 시작이 403 ACCOUNT_NOT_APPROVED', async () => {
    const client = setup({ account: 'pending', lab: 'none' })
    const { error } = await startLab({ client, body: { challengeId: 1 } })
    expect(error).toMatchObject({ status: 403, code: 'ACCOUNT_NOT_APPROVED' })
  })
})

describe('시나리오 저장', () => {
  it('저장한 값이 없거나 깨져 있으면 기본값(학습자, 실습 없음)', () => {
    expect(loadScenario()).toEqual({ account: 'learner', lab: 'none' })
    localStorage.setItem('hackforge.mock', '{"account":"hacker"}')
    expect(loadScenario()).toEqual({ account: 'learner', lab: 'none' })
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { configureApiClient } from './client'
import { ApiError } from './errors'
import { createClient, createConfig } from './generated/client'
import { getMe, login, signup } from './generated/sdk.gen'
import { fetchMe } from './me'

type Handler = (request: Request) => Response | Promise<Response>

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': type } })

const problem = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  json(status, { status, title: code, code, ...extra }, 'application/problem+json')

/** 실제 생성 SDK와 같은 client를 만들고, fetch만 바꿔 요청을 기록한다 */
function setup(handler: Handler) {
  const requests: Request[] = []
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    requests.push(request.clone())
    return handler(request)
  })
  const client = createClient(createConfig({ baseUrl: 'http://localhost', fetch }))
  const onUnauthorized = vi.fn()
  configureApiClient(client, { onUnauthorized })
  return { client, requests, onUnauthorized }
}

const setCookie = (value: string) => {
  document.cookie = `XSRF-TOKEN=${value}; path=/`
}
const clearCookie = () => {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}

const loginBody = { email: 'kim@example.com', password: 'Passw0rd!' }

afterEach(clearCookie)

describe('API client', () => {
  it('데이터를 바꾸는 요청에 X-XSRF-TOKEN이 붙고, GET에는 붙지 않음', async () => {
    setCookie('tok1')
    const { client, requests } = setup((req) =>
      req.method === 'GET' ? problem(401, 'UNAUTHENTICATED') : new Response(null, { status: 204 }),
    )

    await login({ client, body: loginBody })
    await getMe({ client })

    expect(requests[0].headers.get('X-XSRF-TOKEN')).toBe('tok1')
    expect(requests[1].headers.get('X-XSRF-TOKEN')).toBeNull()
  })

  it('XSRF-TOKEN cookie가 없으면 GET /api/me로 먼저 받고 보냄', async () => {
    const { client, requests } = setup((req) => {
      if (new URL(req.url).pathname === '/api/me') {
        setCookie('tok2')
        return problem(401, 'UNAUTHENTICATED')
      }
      return new Response(null, { status: 204 })
    })

    await login({ client, body: loginBody })

    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      'GET /api/me',
      'POST /api/auth/login',
    ])
    expect(requests[1].headers.get('X-XSRF-TOKEN')).toBe('tok2')
  })

  it('VALIDATION_FAILED가 입력 칸별 오류로 변환됨', async () => {
    setCookie('tok3')
    const { client } = setup(() =>
      problem(400, 'VALIDATION_FAILED', {
        errors: [
          { field: 'email', message: '이메일 형식이 아닙니다' },
          { field: 'password', message: '8자 이상이어야 합니다' },
        ],
      }),
    )

    const result = signup({
      client,
      throwOnError: true,
      body: {
        ...loginBody,
        name: '김',
        nickname: 'kim',
        affiliation: '연구실',
        privacyAgreed: true,
      },
    })

    await expect(result).rejects.toBeInstanceOf(ApiError)
    await expect(result).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      fieldErrors: { email: '이메일 형식이 아닙니다', password: '8자 이상이어야 합니다' },
    })
  })

  it('401이면 로그아웃 상태: 내 계정은 null이고 로그아웃 처리를 알림', async () => {
    const { client, onUnauthorized } = setup(() => problem(401, 'UNAUTHENTICATED'))

    await expect(fetchMe(client)).resolves.toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('401이 아닌 오류는 내 계정 조회에서 그대로 실패', async () => {
    const { client } = setup(() => problem(500, 'INTERNAL_ERROR'))

    await expect(fetchMe(client)).rejects.toMatchObject({ status: 500, code: 'INTERNAL_ERROR' })
  })
})

import { syncServerClock } from '@/lib/server-clock'

import { toApiError } from './errors'
import type { Client } from './generated/client'
import { getMe } from './generated/sdk.gen'

export const CSRF_COOKIE = 'XSRF-TOKEN'
export const CSRF_HEADER = 'X-XSRF-TOKEN'

/** CSRF 토큰이 필요 없는 method. 나머지(POST, PUT, PATCH, DELETE)는 헤더를 붙인다 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function readCookie(name: string, cookie = document.cookie): string | undefined {
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

/**
 * 생성된 API client에 공통 처리를 붙인다(hackforge-be openapi.yaml의 인증·CSRF·오류 규칙).
 * - 데이터를 바꾸는 요청: XSRF-TOKEN cookie 값을 X-XSRF-TOKEN 헤더로. cookie가 없으면 GET /api/me로 먼저 받는다
 * - 401: onUnauthorized를 불러 화면이 로그아웃 상태가 되게 한다
 * - 오류: Problem Details를 ApiError로 바꾼다(VALIDATION_FAILED는 입력 칸별 오류 포함)
 */
export function configureApiClient(client: Client, options: { onUnauthorized: () => void }) {
  let priming: Promise<unknown> | undefined

  async function csrfToken() {
    let token = readCookie(CSRF_COOKIE)
    if (!token) {
      // 동시에 여러 요청이 와도 cookie를 받는 요청은 한 번만 보낸다
      priming ??= getMe({ client }).finally(() => (priming = undefined))
      await priming
      token = readCookie(CSRF_COOKIE)
    }
    return token
  }

  client.interceptors.request.use(async (request) => {
    if (SAFE_METHODS.has(request.method)) return request
    const token = await csrfToken()
    if (token) request.headers.set(CSRF_HEADER, token)
    return request
  })

  client.interceptors.response.use((response) => {
    syncServerClock(response.headers.get('Date'))
    if (response.status === 401) options.onUnauthorized()
    return response
  })

  client.interceptors.error.use((error, response) => toApiError(response?.status ?? 0, error))
}

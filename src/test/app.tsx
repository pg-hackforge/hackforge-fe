import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'

import '@/api/query' // 앱과 같은 공통 처리(CSRF, 오류 변환)를 기본 client에 붙인다
import { client } from '@/api/generated/client.gen'
import { ThemeProvider } from '@/components/theme-provider'
import { handlers } from '@/mocks/handlers'
import { saveScenario, type Scenario } from '@/mocks/scenario'
import { routes } from '@/routes'

/** 화면 테스트도 mock 모드와 같은 가짜 응답을 쓴다. 테스트 파일 맨 위에서 한 번 부른다 */
export function setupMockServer() {
  const server = setupServer(...handlers)
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
  afterEach(() => {
    cleanup()
    server.resetHandlers()
  })
  afterAll(() => server.close())
  beforeEach(() => {
    client.setConfig({ baseUrl: 'http://localhost' }) // Node의 fetch는 상대 주소를 받지 않는다
    localStorage.clear()
    document.cookie = 'XSRF-TOKEN=mock; path=/'
  })
  return server
}

/** 앱 전체를 path에서 띄운다. 이동을 확인할 수 있게 router를 반환한다 */
export function renderAt(path: string, account: Scenario['account']) {
  saveScenario({ account, lab: 'none' })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  )
  return router
}

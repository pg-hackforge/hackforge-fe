import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'

import { queryClient } from '@/api/query'
import { ThemeProvider } from '@/components/theme-provider'
import { routes } from '@/routes'
import './index.css'

async function start() {
  let mockPanel: ReactNode = null
  // npm run dev:mock일 때만. 일반 개발과 배포 빌드에서는 이 분기와 mock 코드가 빠진다
  if (import.meta.env.MODE === 'mock') {
    const [{ startMocking }, { MockPanel }] = await Promise.all([
      import('@/mocks/browser'),
      import('@/mocks/mock-panel'),
    ])
    await startMocking()
    mockPanel = <MockPanel />
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RouterProvider router={createBrowserRouter(routes)} />
          {mockPanel}
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

void start()

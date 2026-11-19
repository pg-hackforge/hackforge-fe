import type { RouteObject } from 'react-router'

import { AppLayout } from '@/components/app-layout'
import { RequireAdmin, RequireLoggedOut, RequireLogin } from '@/components/route-guards'
import { LoginPage, SignupPage } from '@/pages/auth-pages'
import { AccountPage } from '@/pages/account-page'
import { AdminPage } from '@/pages/admin-page'
import { IndexPage, ProblemsPage, RecordsPage } from '@/pages/placeholder-pages'
import { NotFoundPage } from '@/pages/status-pages'

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <IndexPage /> },
      {
        element: <RequireLoggedOut />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'signup', element: <SignupPage /> },
        ],
      },
      {
        element: <RequireLogin />,
        children: [
          { path: 'problems', element: <ProblemsPage /> },
          { path: 'records', element: <RecordsPage /> },
          { path: 'account', element: <AccountPage /> },
          { element: <RequireAdmin />, children: [{ path: 'admin', element: <AdminPage /> }] },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

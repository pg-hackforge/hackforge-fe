import type { RouteObject } from 'react-router'

import { AppLayout } from '@/components/app-layout'
import { RequireAdmin, RequireLogin } from '@/components/route-guards'
import {
  AdminPage,
  IndexPage,
  LoginPage,
  ProblemsPage,
  RecordsPage,
  SignupPage,
} from '@/pages/placeholder-pages'
import { NotFoundPage } from '@/pages/status-pages'

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <IndexPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      {
        element: <RequireLogin />,
        children: [
          { path: 'problems', element: <ProblemsPage /> },
          { path: 'records', element: <RecordsPage /> },
          { element: <RequireAdmin />, children: [{ path: 'admin', element: <AdminPage /> }] },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

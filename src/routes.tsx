import { Navigate, type RouteObject } from 'react-router'

import { AppLayout } from '@/components/app-layout'
import { RequireAdmin, RequireLoggedOut, RequireLogin } from '@/components/route-guards'
import { LoginPage, SignupPage } from '@/pages/auth-pages'
import { AccountPage } from '@/pages/account-page'
import { AdminLabPage } from '@/pages/admin-lab-page'
import { AdminLabsPage } from '@/pages/admin-labs-page'
import { AdminPage } from '@/pages/admin-page'
import { IndexPage } from '@/pages/placeholder-pages'
import { LabPage } from '@/pages/lab-page'
import { ProblemPage } from '@/pages/problem-page'
import { ProblemsPage } from '@/pages/problems-page'
import { AnalysisPage } from '@/pages/analysis-page'
import { RecordPage, RecordsPage } from '@/pages/records-page'
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
          { path: 'problems/:id', element: <ProblemPage /> },
          { path: 'records', element: <RecordsPage /> },
          { path: 'records/analysis', element: <AnalysisPage /> },
          { path: 'records/:id', element: <RecordPage /> },
          { path: 'account', element: <AccountPage /> },
          {
            element: <RequireAdmin />,
            children: [
              { path: 'admin', element: <Navigate to="/admin/labs" replace /> },
              { path: 'admin/labs', element: <AdminLabsPage /> },
              { path: 'admin/labs/:id', element: <AdminLabPage /> },
              { path: 'admin/users', element: <AdminPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  // 실습 화면은 자체 상단 줄을 쓴다(DESIGN.md "실습 화면")
  { element: <RequireLogin />, children: [{ path: 'labs/:id', element: <LabPage /> }] },
]

import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'

/** 제목과 그 아래 탭(내 기록, 관리자). 탭은 주소마다 하나라 링크로 둔다. [주소, 글자, 정확히 같을 때만 지금 탭] */
export function PageHeader({ title, tabs }: { title: string; tabs: [string, string, boolean?][] }) {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <nav aria-label={title} className="mt-5 flex gap-6 border-b">
        {tabs.map(([to, label, end]) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

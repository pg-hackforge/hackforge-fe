import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'

import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Theme } from '@/lib/theme'

const options: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: 'light', label: '라이트', icon: SunIcon },
  { value: 'dark', label: '다크', icon: MoonIcon },
  { value: 'system', label: '시스템 설정', icon: MonitorIcon },
]

function ThemeRadioItems() {
  const { theme, setTheme } = useTheme()
  return (
    <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
      {options.map(({ value, label, icon: Icon }) => (
        <DropdownMenuRadioItem key={value} value={value}>
          <Icon />
          {label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}

/** 로그인 전 상단 줄의 테마 메뉴. 로그인 후에는 사용자 메뉴 안에서 고른다 */
export function ModeToggle() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="화면 테마" />}>
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <ThemeRadioItems />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

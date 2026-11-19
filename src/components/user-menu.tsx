import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOutIcon, MonitorIcon, MoonIcon, SunIcon, UserIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { logoutMutation } from '@/api/generated/@tanstack/react-query.gen'
import type { UserResponse } from '@/api/generated/types.gen'
import { meQueryKey } from '@/api/me'
import { useTheme } from '@/components/theme-provider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Theme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<UserResponse['role'], string> = {
  LEARNER: '학습자',
  AUTHOR: '출제자',
  ADMIN: '관리자',
}

const THEMES: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: 'light', label: '라이트', icon: SunIcon },
  { value: 'dark', label: '다크', icon: MoonIcon },
  { value: 'system', label: '시스템 설정', icon: MonitorIcon },
]

/** 닉네임 첫 글자 원. 불씨색 면 위 불씨색 글자 */
function Avatar({ nickname, className }: { nickname: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-ember-soft font-semibold text-primary uppercase',
        className,
      )}
    >
      {nickname.slice(0, 1)}
    </span>
  )
}

/** 상단 줄 오른쪽 사용자 메뉴. 버튼은 첫 글자 원 하나, 계정 정보는 메뉴 머리에 둔다(2026-11-19 사람이 결정) */
export function UserMenu({ me }: { me: UserResponse }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const logout = useMutation({
    ...logoutMutation(),
    onSuccess: async () => {
      // 먼저 첫 화면으로 옮긴다. 계정을 먼저 지우면 로그인 필요 화면에서 로그인 화면으로 튕긴다
      await navigate('/')
      queryClient.setQueryData(meQueryKey, null)
      // 다른 사람 데이터가 남지 않게 내 계정 말고는 모두 지운다
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meQueryKey[0] })
    },
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${me.nickname} 계정 메뉴`}
        className="grid size-8 place-items-center rounded-full transition-shadow outline-none hover:ring-1 hover:ring-input focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:shadow-[0_0_0_2px_var(--card),0_0_0_3px_var(--primary)] aria-expanded:ring-0"
      >
        <Avatar nickname={me.nickname} className="size-7 text-[13px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-62 rounded-xl p-1.5">
        <div className="flex items-center gap-2.5 px-2 pt-2 pb-2.5">
          <Avatar nickname={me.nickname} className="size-9 text-sm" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <span className="truncate">{me.nickname}</span>
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-px text-xs font-medium text-muted-foreground">
                {ROLE_LABEL[me.role]}
              </span>
            </p>
            <p className="mt-0.5 truncate text-xs text-subtle-foreground">{me.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2.5 px-2 py-1.5" render={<Link to="/account" />}>
          <UserIcon className="text-muted-foreground" />내 계정
        </DropdownMenuItem>
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-sm text-muted-foreground">테마</span>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as Theme)}
            className="flex gap-0.5 rounded-lg bg-muted p-0.5"
          >
            {THEMES.map(({ value, label, icon: Icon }) => (
              <MenuPrimitive.RadioItem
                key={value}
                value={value}
                closeOnClick={false}
                aria-label={label}
                title={label}
                className="grid h-6 w-7.5 cursor-default place-items-center rounded-md text-muted-foreground outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-highlighted:text-foreground data-checked:bg-card data-checked:text-foreground data-checked:shadow-sm"
              >
                <Icon className="size-4" />
              </MenuPrimitive.RadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2.5 px-2 py-1.5"
          disabled={logout.isPending}
          onClick={() => logout.mutate({})}
        >
          <LogOutIcon className="text-muted-foreground" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

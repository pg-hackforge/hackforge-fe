import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon, LogOutIcon } from 'lucide-react'
import { useNavigate } from 'react-router'

import { logoutMutation } from '@/api/generated/@tanstack/react-query.gen'
import type { UserResponse } from '@/api/generated/types.gen'
import { meQueryKey } from '@/api/me'
import { ThemeRadioItems } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const ROLE_LABEL: Record<UserResponse['role'], string> = {
  LEARNER: '학습자',
  AUTHOR: '출제자',
  ADMIN: '관리자',
}

/** 상단 줄 오른쪽 사용자 메뉴: 계정, 테마, 로그아웃 */
export function UserMenu({ me }: { me: UserResponse }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const logout = useMutation({
    ...logoutMutation(),
    onSuccess: () => {
      queryClient.setQueryData(meQueryKey, null)
      // 다른 사람 데이터가 남지 않게 내 계정 말고는 모두 지운다
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meQueryKey[0] })
      void navigate('/')
    },
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="h-8 gap-2 rounded-full pr-2 pl-1" />}
      >
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-full bg-muted text-xs font-semibold uppercase"
        >
          {me.nickname.slice(0, 1)}
        </span>
        <span className="font-medium max-sm:sr-only">{me.nickname}</span>
        <span className="text-xs text-subtle-foreground max-sm:hidden">{ROLE_LABEL[me.role]}</span>
        <ChevronDownIcon className="text-subtle-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{me.email}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>테마</DropdownMenuLabel>
          <ThemeRadioItems />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={logout.isPending} onClick={() => logout.mutate({})}>
          <LogOutIcon />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

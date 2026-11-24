import { Tabs } from '@base-ui/react/tabs'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, CopyIcon, KeyRoundIcon } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { ApiError } from '@/api/errors'
import {
  approveUser,
  changeUserRole,
  issueTemporaryPassword,
  listUsers,
  rejectUser,
} from '@/api/generated/sdk.gen'
import type { AdminUserResponse, UserResponse } from '@/api/generated/types.gen'
import { useMe } from '@/api/me'
import { AdminHeader } from '@/components/admin/admin-header'
import { SmallButton } from '@/components/admin/small-button'
import { ActionButton, CancelButton, Dialog, DialogText } from '@/components/dialog'
import { FormAlert } from '@/components/form'
import { ROLE_LABEL, STATUS_LABEL } from '@/lib/account'

type Status = UserResponse['status']
type Role = UserResponse['role']

const STATUSES: Status[] = ['PENDING', 'APPROVED', 'REJECTED']
const ROLES: Role[] = ['LEARNER', 'AUTHOR', 'ADMIN']

const usersKey = ['admin-users'] as const

const EMPTY: Record<Status, [string, string]> = {
  PENDING: ['승인을 기다리는 회원이 없어요', '새로 가입한 회원이 여기에 보여요.'],
  APPROVED: ['승인한 회원이 없어요', '가입을 승인하면 여기에 보여요.'],
  REJECTED: ['거절한 회원이 없어요', '거절한 회원은 여기서 다시 승인할 수 있어요.'],
}

/** 확인 창 상태. 임시 비밀번호는 결과 창에만 두고, 창을 닫으면 버린다 */
type DialogState =
  | { kind: 'reject' | 'role' | 'issue'; user: AdminUserResponse }
  | { kind: 'issued'; user: AdminUserResponse; password: string }
  | null

/** 화면에 보이는 오류 문구. 목록은 어떤 오류든 다시 불러온다 */
function errorText(error: Error) {
  if (!(error instanceof ApiError)) return error.message
  if (error.code === 'INVALID_STATUS_TRANSITION')
    return '이미 다른 관리자가 처리한 회원이에요. 목록을 새로 고쳤어요.'
  if (error.code === 'USER_NOT_FOUND') return '회원을 찾을 수 없어요. 목록을 새로 고쳤어요.'
  if (error.code === 'CANNOT_CHANGE_OWN_ROLE') return '내 권한은 바꿀 수 없어요.'
  return error.message
}

/** `/admin/users` 회원 관리(DESIGN.md "계정 화면"). 본문 1240px 틀을 가운데에 두고 왼쪽 정렬 */
export function AdminPage() {
  const me = useMe().data
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const current = (STATUSES as string[]).includes(params.get('status') ?? '')
    ? (params.get('status') as Status)
    : 'PENDING'
  const [dialog, setDialog] = useState<DialogState>(null)
  const [error, setError] = useState<string>()

  const lists = useQueries({
    queries: STATUSES.map((status) => ({
      queryKey: [...usersKey, status],
      queryFn: async () => (await listUsers({ query: { status }, throwOnError: true })).data,
    })),
  })

  const handlers = {
    onMutate: () => setError(undefined),
    // 확인 창이 열려 있으면 안내가 창 뒤에 가려지므로 창을 닫는다
    onError: (e: Error) => {
      setDialog(null)
      setError(errorText(e))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  }
  const run = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    ...handlers,
    onSuccess: () => setDialog(null),
  })
  const issue = useMutation({
    mutationFn: async (user: AdminUserResponse) =>
      (await issueTemporaryPassword({ path: { id: user.id }, throwOnError: true })).data
        .temporaryPassword,
    ...handlers,
    onSuccess: (password, user) => setDialog({ kind: 'issued', user, password }),
  })
  const close = () => setDialog(null)
  const pending = run.isPending || issue.isPending

  const approve = (user: AdminUserResponse) =>
    run.mutate(() => approveUser({ path: { id: user.id }, throwOnError: true }))

  return (
    <div className="mx-auto w-full max-w-332 px-4 pt-10 pb-14 sm:px-11">
      <AdminHeader />
      <p className="mt-4 text-sm text-muted-foreground">
        가입을 승인하고, 회원의 권한과 비밀번호를 관리해요.
      </p>
      {error && <FormAlert tone="error">{error}</FormAlert>}
      <Tabs.Root
        value={current}
        onValueChange={(value) => setParams({ status: value as Status }, { replace: true })}
      >
        <Tabs.List className="mt-5.5 flex gap-1 border-b">
          {STATUSES.map((status, i) => (
            <Tabs.Tab
              key={status}
              value={status}
              className="group -mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.25 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-active:border-primary data-active:font-semibold data-active:text-foreground"
            >
              {STATUS_LABEL[status]}
              <span className="rounded-md bg-muted px-1.5 text-xs leading-4.5 font-semibold text-muted-foreground tabular-nums group-data-active:bg-primary group-data-active:text-primary-foreground">
                {lists[i].data?.length ?? ''}
              </span>
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {STATUSES.map((status, i) => (
          <Tabs.Panel key={status} value={status} className="outline-none">
            {lists[i].isError ? (
              <FormAlert tone="error">{errorText(lists[i].error)}</FormAlert>
            ) : !lists[i].data ? null : lists[i].data.length === 0 ? (
              <div className="py-14 text-center text-sm text-muted-foreground">
                <p className="mb-1 font-semibold text-foreground">{EMPTY[status][0]}</p>
                {EMPTY[status][1]}
              </div>
            ) : (
              <UserTable
                status={status}
                users={lists[i].data}
                myId={me?.id}
                disabled={pending}
                onApprove={approve}
                onOpen={(kind, user) => setDialog({ kind, user })}
              />
            )}
          </Tabs.Panel>
        ))}
      </Tabs.Root>

      <Dialog
        open={dialog?.kind === 'reject'}
        onClose={close}
        title={`${dialog?.user.name} 님의 가입을 거절할까요?`}
        actions={
          <>
            <CancelButton />
            <ActionButton
              danger
              disabled={pending}
              onClick={() =>
                dialog &&
                run.mutate(() => rejectUser({ path: { id: dialog.user.id }, throwOnError: true }))
              }
            >
              거절하기
            </ActionButton>
          </>
        }
      >
        <DialogText>
          거절해도 로그인과 문제 보기는 할 수 있고, 실습만 할 수 없어요. 나중에 "거절" 탭에서 승인할
          수 있어요.
        </DialogText>
      </Dialog>

      {dialog?.kind === 'role' && (
        <RoleDialog
          user={dialog.user}
          pending={pending}
          onClose={close}
          onChange={(role) =>
            run.mutate(() =>
              changeUserRole({ path: { id: dialog.user.id }, body: { role }, throwOnError: true }),
            )
          }
        />
      )}

      <Dialog
        open={dialog?.kind === 'issue'}
        onClose={close}
        title={`${dialog?.user.name} 님의 임시 비밀번호를 발급할까요?`}
        actions={
          <>
            <CancelButton />
            <ActionButton disabled={pending} onClick={() => dialog && issue.mutate(dialog.user)}>
              발급하기
            </ActionButton>
          </>
        }
      >
        <DialogText>{dialog?.user.name} 님은 모든 기기에서 로그아웃돼요.</DialogText>
      </Dialog>

      {dialog?.kind === 'issued' && (
        <IssuedDialog name={dialog.user.name} password={dialog.password} onClose={close} />
      )}
    </div>
  )
}

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function UserTable({
  status,
  users,
  myId,
  disabled,
  onApprove,
  onOpen,
}: {
  status: Status
  users: AdminUserResponse[]
  myId?: number
  disabled: boolean
  onApprove: (user: AdminUserResponse) => void
  onOpen: (kind: 'reject' | 'role' | 'issue', user: AdminUserResponse) => void
}) {
  const approved = status === 'APPROVED'
  return (
    <div className="relative overflow-x-auto">
      <table className="mt-1 w-full min-w-180 border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b text-left text-xs text-subtle-foreground">
            <th className="px-3 pt-3 pb-2 font-medium">가입일</th>
            <th className="px-3 pt-3 pb-2 font-medium">이름 · 닉네임</th>
            <th className="px-3 pt-3 pb-2 font-medium">소속</th>
            <th className="px-3 pt-3 pb-2 font-medium">{approved ? '권한' : '가입 메모'}</th>
            <th className="px-3 pt-3 pb-2">
              <span className="sr-only">동작</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const mine = user.id === myId
            return (
              <tr key={user.id} className="border-b align-top">
                <td className="px-3 py-3.25 whitespace-nowrap text-muted-foreground tabular-nums">
                  {dateFormat.format(new Date(user.createdAt))}
                </td>
                <td className="px-3 py-3.25">
                  <span className="font-semibold">{user.name}</span>
                  <span className="ml-1.5 text-muted-foreground">{user.nickname}</span>
                  {mine && <span className="ml-1.5 text-xs text-subtle-foreground">나</span>}
                  <div className="mt-0.5 text-[12.5px] text-muted-foreground">{user.email}</div>
                </td>
                <td className="px-3 py-3.25">{user.affiliation}</td>
                <td className="max-w-65 px-3 py-3.25 leading-normal text-muted-foreground">
                  {approved ? (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                      {ROLE_LABEL[user.role]}
                    </span>
                  ) : (
                    (user.signupNote ?? <span className="text-subtle-foreground">없음</span>)
                  )}
                </td>
                <td className="px-3 py-3.25 text-right whitespace-nowrap">
                  {approved ? (
                    <>
                      <SmallButton disabled={disabled || mine} onClick={() => onOpen('role', user)}>
                        권한 변경
                      </SmallButton>
                      <SmallButton
                        disabled={disabled || mine}
                        onClick={() => onOpen('issue', user)}
                      >
                        <KeyRoundIcon />
                        임시 비밀번호
                      </SmallButton>
                    </>
                  ) : (
                    <>
                      {status === 'PENDING' && (
                        <SmallButton disabled={disabled} onClick={() => onOpen('reject', user)}>
                          거절
                        </SmallButton>
                      )}
                      <SmallButton approve disabled={disabled} onClick={() => onApprove(user)}>
                        <CheckIcon />
                        승인
                      </SmallButton>
                    </>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** 권한 변경 창. 창 안에서 셋 중 하나를 고르고, 지금 권한에는 "현재" 표시 */
function RoleDialog({
  user,
  pending,
  onClose,
  onChange,
}: {
  user: AdminUserResponse
  pending: boolean
  onClose: () => void
  onChange: (role: Role) => void
}) {
  const [role, setRole] = useState(user.role)
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${user.name} 님의 권한 변경`}
      actions={
        <>
          <CancelButton />
          <ActionButton disabled={pending || role === user.role} onClick={() => onChange(role)}>
            변경하기
          </ActionButton>
        </>
      }
    >
      <fieldset className="mt-3.5 flex flex-col gap-1.5">
        <legend className="sr-only">권한</legend>
        {ROLES.map((value) => (
          <label
            key={value}
            className="flex items-center gap-2.5 rounded-[9px] border px-3 py-2.25 text-[13.5px] has-checked:border-primary has-checked:bg-primary/7"
          >
            <input
              type="radio"
              name="role"
              value={value}
              checked={role === value}
              onChange={() => setRole(value)}
              className="size-4"
            />
            {ROLE_LABEL[value]}
            {value === user.role && (
              <small className="ml-auto text-xs text-subtle-foreground">현재</small>
            )}
          </label>
        ))}
      </fieldset>
      <DialogText>
        바꾸면 이 회원은 모든 기기에서 로그아웃되고, 다시 로그인하면 새 권한이 적용돼요.
      </DialogText>
    </Dialog>
  )
}

/** 임시 비밀번호 결과 창. 응답으로 한 번만 받으므로 창을 닫으면 다시 볼 수 없다(openapi.yaml) */
function IssuedDialog({
  name,
  password,
  onClose,
}: {
  name: string
  password: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(password)
    setCopied(true)
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title="임시 비밀번호를 발급했어요"
      actions={<ActionButton onClick={onClose}>확인</ActionButton>}
    >
      <DialogText>{name} 님은 모든 기기에서 로그아웃됐고, 로그인 잠금도 풀렸어요.</DialogText>
      <div className="mt-4 flex items-center gap-2 rounded-[10px] bg-muted py-3 pr-3 pl-3.5">
        <code className="flex-1 font-mono text-[17px] tracking-wider">{password}</code>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.25 rounded-[7px] border border-input bg-card px-2.5 py-1.25 text-[12.5px] font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-3.5"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? '복사했어요' : '복사'}
        </button>
      </div>
      <div className="[&>div]:mt-3.5">
        <FormAlert tone="error">
          창을 닫으면 다시 볼 수 없어요. 회원에게 직접 알려 주고, 로그인한 뒤 비밀번호를 바꾸도록
          안내해 주세요.
        </FormAlert>
      </div>
    </Dialog>
  )
}

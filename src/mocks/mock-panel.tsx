import { useQueryClient } from '@tanstack/react-query'
import { useReducer } from 'react'

import { useMe } from '@/api/me'

import { LOCKED_EMAIL, LOCKING_PASSWORD, WRONG_PASSWORD } from './handlers'
import {
  ACCOUNTS,
  DEFENSE_RESULTS,
  LABS,
  loadScenario,
  REDEPLOY_RESULTS,
  SAVE_RESULTS,
  saveScenario,
  VERIFY_RESULTS,
  type Scenario,
} from './scenario'

/** mock 모드에서만 화면 오른쪽 아래에 뜨는 시나리오 전환 패널. 바꾸면 모든 API 조회를 다시 한다 */
export function MockPanel() {
  const queryClient = useQueryClient()
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  useMe() // 화면에서 로그인·로그아웃해도 시나리오가 바뀌므로, 내 계정이 바뀔 때마다 다시 읽는다
  const scenario = loadScenario()

  const change = (next: Scenario) => {
    saveScenario(next)
    rerender()
    void queryClient.resetQueries()
  }

  return (
    <details
      open
      className="fixed right-4 bottom-4 z-50 w-56 rounded-lg border bg-card text-sm shadow-lg"
    >
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold tracking-wide text-primary select-none">
        MOCK 시나리오
      </summary>
      <div className="space-y-2 border-t px-3 py-3">
        <Select
          label="계정"
          value={scenario.account}
          options={ACCOUNTS}
          onChange={(account) => change({ ...scenario, account })}
        />
        <Select
          label="실습"
          value={scenario.lab}
          options={LABS}
          onChange={(lab) => change({ ...scenario, lab, progress: undefined })}
        />
        <Select
          label="공격 검증"
          value={scenario.verify ?? 'PASS'}
          options={VERIFY_RESULTS}
          onChange={(verify) => change({ ...scenario, verify })}
        />
        <Select
          label="방어 검증"
          value={scenario.defense ?? 'PASS'}
          options={DEFENSE_RESULTS}
          onChange={(defense) => change({ ...scenario, defense })}
        />
        <Select
          label="재배포"
          value={scenario.redeploy ?? 'SUCCESS'}
          options={REDEPLOY_RESULTS}
          onChange={(redeploy) => change({ ...scenario, redeploy })}
        />
        <Select
          label="파일 저장"
          value={scenario.save ?? 'OK'}
          options={SAVE_RESULTS}
          onChange={(save) => change({ ...scenario, save })}
        />
        <p className="text-xs leading-relaxed wrap-anywhere text-muted-foreground">
          로그인 이메일은 forge_kim(학습자), newbie(승인 대기), denied(거절), admin(관리자) 뒤에
          @example.com, 비밀번호는 아무거나. {LOCKED_EMAIL}은 잠김
        </p>
        <p className="text-xs leading-relaxed wrap-anywhere text-muted-foreground">
          내 정보의 비밀번호 변경: 현재 비밀번호 {WRONG_PASSWORD}는 틀림, {LOCKING_PASSWORD}는 잠김
        </p>
        <p className="text-xs leading-relaxed wrap-anywhere text-muted-foreground">
          회원 관리: 박준호는 승인·거절하면 다른 관리자가 먼저 처리한 상황
        </p>
      </div>
    </details>
  )
}

function Select<T extends string>(props: {
  label: string
  value: T
  options: Record<T, string>
  onChange: (value: T) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value as T)}
        className="w-36 rounded-md border border-input bg-background px-2 py-1 text-foreground"
      >
        {(Object.entries(props.options) as [T, string][]).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}

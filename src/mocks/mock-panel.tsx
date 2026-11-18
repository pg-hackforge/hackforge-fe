import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ACCOUNTS, LABS, loadScenario, saveScenario, type Scenario } from './scenario'

/** mock 모드에서만 화면 오른쪽 아래에 뜨는 시나리오 전환 패널. 바꾸면 모든 API 조회를 다시 한다 */
export function MockPanel() {
  const queryClient = useQueryClient()
  const [scenario, setScenario] = useState(loadScenario)

  const change = (next: Scenario) => {
    saveScenario(next)
    setScenario(next)
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
          onChange={(lab) => change({ ...scenario, lab })}
        />
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

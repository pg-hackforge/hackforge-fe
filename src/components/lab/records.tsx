import type {
  LabSessionResponse,
  RedeployResponse,
  VerificationResponse,
} from '@/api/generated/types.gen'
import { useHints } from '@/api/labs'
import { Panel, Verdict } from '@/components/lab/attack'
import { DefenseResult, SolutionSection } from '@/components/lab/defense'
import { clockTime, labRecords } from '@/lib/lab'

/**
 * 기록(확정 캡처 `lab-records`): 맨 위에 마지막 검증 결과(방어 검증이면 차단·기능 카드와 시도 횟수),
 * 아래에 이 실습의 기록, 맨 아래에 해답
 */
export function RecordsPanel({
  lab,
  verifications,
  redeploys,
}: {
  lab: LabSessionResponse
  verifications?: VerificationResponse[]
  redeploys?: RedeployResponse[]
}) {
  const hints = useHints(lab.id, true).data
  const latest = verifications?.[0]
  const records = labRecords(verifications ?? [], hints?.hints ?? [], redeploys ?? [])
  const defense = latest?.type === 'DEFENSE'
  return (
    <Panel className="px-8 py-7">
      <div className="mx-auto max-w-200">
        {latest ? (
          <div className="flex items-center gap-3">
            <Verdict status={latest.status} className="h-7 px-2.5 text-[13px]" />
            <h1 className="text-xl font-semibold tracking-tight">
              {records.find((r) => r.key === `v${latest.id}`)?.title}
            </h1>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {clockTime(latest.startedAt)}
              {defense && ` · 시도 ${lab.defenseAttempts}/${lab.maxDefenseAttempts}`}
            </span>
          </div>
        ) : (
          <h1 className="text-xl font-semibold tracking-tight">기록</h1>
        )}
        {latest?.message && <p className="mt-2 text-sm">{latest.message}</p>}
        {defense && <DefenseResult verification={latest} />}
        <h2 className="mt-8 border-b pb-2 text-[13px] font-semibold text-muted-foreground">
          이 실습의 기록
        </h2>
        {records.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            {lab.stage === 'ATTACK'
              ? '아직 기록이 없어요. 공격 대상에서 공격한 뒤 [공격 검증 요청]을 눌러요.'
              : '아직 기록이 없어요. 코드를 고치고 재배포한 뒤 [방어 검증 요청]을 눌러요.'}
          </p>
        ) : (
          <ul>
            {records.map((record) => (
              <li
                key={record.key}
                className="grid grid-cols-[56px_1fr_auto] items-start gap-3 border-b py-3"
              >
                <span className="pt-0.5 font-mono text-[13px] text-muted-foreground">
                  {clockTime(record.at)}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{record.title}</span>
                  {record.detail && (
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">
                      {record.detail}
                    </span>
                  )}
                </span>
                {record.status && record.status !== 'RUNNING' && <Verdict status={record.status} />}
              </li>
            ))}
          </ul>
        )}
        <SolutionSection lab={lab} verifications={verifications} />
      </div>
    </Panel>
  )
}

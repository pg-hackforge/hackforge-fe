import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation, useParams } from 'react-router'

import { listAdminLabsOptions } from '@/api/generated/@tanstack/react-query.gen'
import type { AdminLabSessionResponse } from '@/api/generated/types.gen'
import { useLab } from '@/api/labs'
import { SmallButton } from '@/components/admin/small-button'
import { TerminateDialog, type TerminateTarget } from '@/components/admin/terminate-dialog'
import { FormAlert } from '@/components/form'
import { canTerminate } from '@/lib/admin'
import { RecordPage } from '@/pages/records-page'

/**
 * `/admin/labs/:id` 한 세션의 기록(ADR 026): 학습자 화면과 같은 기록에 학습자 정보와 강제 종료.
 * 학습자 정보는 목록에서 넘겨받고, 바로 열었으면 전체 목록 첫 쪽에서 찾는다
 */
export function AdminLabPage() {
  const id = Number(useParams().id)
  const passed = (useLocation().state as { learner?: AdminLabSessionResponse } | null)?.learner
  const all = useQuery({
    ...listAdminLabsOptions({ query: { status: 'ALL' } }),
    enabled: !passed,
  })
  const learner = passed ?? all.data?.items.find((s) => s.session.id === id)
  const lab = useLab(id).data
  const [target, setTarget] = useState<TerminateTarget | null>(null)
  const [error, setError] = useState<string>()

  return (
    <>
      {error && (
        <div className="mx-auto w-full max-w-200 px-4 sm:px-6">
          <FormAlert tone="error">{error}</FormAlert>
        </div>
      )}
      <RecordPage
        admin={{
          learner: learner && (
            <p className="mt-1.5 text-sm">
              <span className="font-semibold">{learner.userName}</span>
              <span className="ml-1.5 text-muted-foreground">{learner.userNickname}</span>
              <span className="ml-1.5 text-muted-foreground">{learner.userEmail}</span>
            </p>
          ),
          actions: lab && canTerminate(lab) && (
            <SmallButton
              danger
              className="ml-0 h-8"
              onClick={() =>
                setTarget({
                  id,
                  name: learner?.userName ?? '학습자',
                  challengeTitle: lab.challengeTitle,
                })
              }
            >
              강제 종료
            </SmallButton>
          ),
        }}
      />
      <TerminateDialog target={target} onClose={() => setTarget(null)} onError={setError} />
    </>
  )
}

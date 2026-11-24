import { PageHeader } from '@/components/page-header'

/** 관리자 화면 제목과 탭(실습 세션, 회원) */
export function AdminHeader() {
  return (
    <PageHeader
      title="관리자"
      tabs={[
        ['/admin/labs', '실습 세션'],
        ['/admin/users', '회원'],
      ]}
    />
  )
}

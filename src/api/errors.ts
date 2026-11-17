import type { Problem } from './generated/types.gen'

/** 백엔드 오류 코드(openapi.yaml Problem.code)와, 응답을 받지 못했을 때의 NETWORK_ERROR */
export type ApiErrorCode = Problem['code'] | 'NETWORK_ERROR'

/**
 * API 오류. 백엔드의 Problem Details(RFC 9457)를 화면에서 쓰기 쉽게 바꾼다.
 * VALIDATION_FAILED의 errors[]는 입력 칸 이름별 메시지(fieldErrors)로 모은다.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly detail?: string
  readonly fieldErrors: Record<string, string>

  constructor(init: {
    status: number
    code: ApiErrorCode
    title: string
    detail?: string
    fieldErrors?: Record<string, string>
  }) {
    super(init.detail ?? init.title)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.detail = init.detail
    this.fieldErrors = init.fieldErrors ?? {}
  }
}

const isProblem = (value: unknown): value is Problem =>
  typeof value === 'object' && value !== null && 'code' in value && 'status' in value

/** 응답 상태와 본문(이미 JSON으로 읽은 값)으로 ApiError를 만든다. status 0은 응답을 받지 못한 경우 */
export function toApiError(status: number, body: unknown): ApiError {
  if (body instanceof ApiError) return body
  if (status === 0) {
    return new ApiError({ status: 0, code: 'NETWORK_ERROR', title: '서버에 연결할 수 없습니다' })
  }
  if (!isProblem(body)) {
    return new ApiError({
      status,
      code: 'INTERNAL_ERROR',
      title: `요청이 실패했습니다(HTTP ${status})`,
    })
  }
  const fieldErrors: Record<string, string> = {}
  for (const { field, message } of body.errors ?? []) {
    fieldErrors[field] ??= message // 한 칸에 여러 이유가 오면 첫 번째만 보여 준다
  }
  return new ApiError({
    status,
    code: body.code,
    title: body.title,
    detail: body.detail,
    fieldErrors,
  })
}

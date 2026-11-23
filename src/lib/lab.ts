import type { LabPrepStep, LabSessionResponse, LabStatus } from '@/api/generated/types.gen'

/** 준비 단계(hackforge-docs ADR 021). 진행 순서 */
export const PREP_STEPS: [LabPrepStep, string][] = [
  ['SPACE', '실습 공간 만들기'],
  ['CONTAINER', '컨테이너 시작'],
  ['LOADING', '실습 서비스 불러오기'],
  ['STARTING', '서비스 시작과 상태 확인'],
]

/** 상태 조회 간격(openapi.yaml lab 태그). 끝난 세션은 조회하지 않는다 */
export function labPollInterval(status: LabStatus | undefined): number | false {
  if (status === 'READY') return 10_000
  if (status === 'DELETED' || status === 'FAILED') return false
  return 2_500
}

export const isEnded = (status: LabStatus) => status === 'DELETED' || status === 'FAILED'

/** 끝난 세션의 안내. [제목, 설명] */
export function endNotice(
  lab: Pick<LabSessionResponse, 'status' | 'endReason' | 'completedAt'>,
): [string, string] {
  if (lab.status === 'FAILED' || (lab.status === 'TERMINATING' && !lab.endReason))
    return [
      '실습 환경을 만들지 못했어요',
      '잠시 뒤 다시 시작해 주세요. 계속 안 되면 관리자에게 알려 주세요.',
    ]
  switch (lab.endReason) {
    case 'IDLE':
      return lab.completedAt
        ? ['실습을 완료했어요', '완료한 뒤 입력이 없어 실습 환경을 정리했어요.']
        : [
            '입력이 없어 실습이 끝났어요',
            '30분 동안 입력이 없으면 실습 환경을 정리해요. 다시 시작하면 처음 상태로 만들어요.',
          ]
    case 'POD_LOST':
      return [
        '실습 환경에 문제가 생겨 끝났어요',
        '메모리나 디스크를 너무 많이 쓰면 이렇게 될 수 있어요. 다시 시작해 주세요.',
      ]
    case 'ADMIN':
      return ['관리자가 실습을 종료했어요', '궁금한 점은 관리자에게 문의해 주세요.']
    default:
      return ['실습을 종료했어요', '실습 환경을 정리했어요.']
  }
}

/** 남은 시간을 분:초로. 0보다 작으면 0:00 */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** 웹 터미널 WebSocket 주소(ADR 022). 같은 호스트의 `/api` 아래 */
export function terminalUrl(
  labId: number,
  location: Pick<Location, 'protocol' | 'host'> = window.location,
) {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${location.host}/api/labs/${labId}/terminal`
}

/** 서버가 터미널을 닫은 이유(openapi.yaml `openLabTerminal`). 다시 연결할 수 있는지와 안내 */
export function terminalCloseNotice(code: number): { text: string; retry: boolean } {
  switch (code) {
    case 1000:
      return { text: '셸이 끝났어요.', retry: true }
    case 4410:
      return { text: '실습이 끝나 터미널이 닫혔어요.', retry: false }
    case 4409:
      return { text: '실습 환경이 아직 준비되지 않았어요.', retry: true }
    case 4429:
      return { text: '터미널은 한 실습에 3개까지 열 수 있어요.', retry: false }
    case 4404:
      return { text: '실습을 찾을 수 없어요.', retry: false }
    default:
      return { text: '터미널 연결이 끊겼어요.', retry: true }
  }
}

/** 터미널과 코드 편집기의 글자 크기(px). 둘은 따로 정하고 브라우저에 저장한다 */
export const FONT_SIZE = { min: 11, max: 20, initial: 13 }

export const clampFontSize = (size: number) =>
  Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, Math.round(size)))

/** 저장된 값을 읽는다. 없거나 숫자가 아니면 기본값 */
export function readFontSize(stored: string | null): number {
  const size = Number(stored)
  return stored && Number.isFinite(size) ? clampFontSize(size) : FONT_SIZE.initial
}

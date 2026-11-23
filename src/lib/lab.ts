import type {
  HintResponse,
  LabFileEntry,
  LabPrepStep,
  LabSessionResponse,
  LabStage,
  LabStatus,
  RedeployResponse,
  VerificationResponse,
  VerificationStatus,
} from '@/api/generated/types.gen'

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

/** 공격 힌트가 순서마다 알려 주는 것(openapi.yaml `revealAttackHint`) */
const ATTACK_HINT_KIND = ['방향', '위치', '공격 방법']

export function hintTitle(stage: LabStage, position: number): string {
  return stage === 'ATTACK'
    ? `공격 힌트 ${position} · ${ATTACK_HINT_KIND[position - 1]}`
    : `방어 힌트 ${position}`
}

export type LabRecord = {
  key: string
  at: string
  title: string
  detail?: string
  status?: VerificationStatus
}

/** 실습 화면 "기록": 검증과 힌트 열람을 최근 순으로. 방어 검증은 몇 번째인지 붙인다 */
export function labRecords(
  verifications: VerificationResponse[],
  hints: HintResponse[],
  redeploys: RedeployResponse[] = [],
): LabRecord[] {
  const defenseOrder = verifications
    .filter((v) => v.type === 'DEFENSE')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((v) => v.id)
  const records: LabRecord[] = [
    ...verifications.map((v) => ({
      key: `v${v.id}`,
      at: v.startedAt,
      title:
        v.type === 'ATTACK'
          ? '공격 검증'
          : `방어 검증 ${String(defenseOrder.indexOf(v.id) + 1).padStart(2, '0')}`,
      detail: v.status === 'RUNNING' ? '검증 중' : withDuration(v.message, v.durationMs),
      status: v.status,
    })),
    ...redeploys.map((r) => ({
      key: `r${r.id}`,
      at: r.startedAt,
      title: r.kind === 'REDEPLOY' ? '재배포' : '서비스 초기화',
      detail: r.status === 'RUNNING' ? '진행 중' : withDuration(r.message, r.durationMs),
      // 성공은 판정 표시 없이 줄만, 실패만 눈에 띄게
      status: r.status === 'SUCCESS' ? undefined : r.status,
    })),
    ...hints.map((h) => ({
      key: `h${h.stage}${h.position}`,
      at: h.revealedAt,
      title: `${hintTitle(h.stage, h.position)} 열람`,
    })),
  ]
  return records.sort((a, b) => b.at.localeCompare(a.at))
}

function withDuration(message: string | null, durationMs: number | null) {
  return [message, durationMs != null && `${(durationMs / 1000).toFixed(1)}초`]
    .filter(Boolean)
    .join(' · ')
}

/** 기록의 시각(로컬 시:분) */
export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })

export type FileNode = {
  /** 폴더나 파일 이름 */
  name: string
  /** `/app` 기준 경로 */
  path: string
  depth: number
  /** 파일이면 목록 항목, 폴더면 없음 */
  entry?: LabFileEntry
}

/** 탐색기: 파일 목록(경로)을 폴더 먼저, 이름순으로 펼친 트리 */
export function fileTree(entries: LabFileEntry[]): FileNode[] {
  type Dir = { dirs: Map<string, Dir>; files: LabFileEntry[] }
  const root: Dir = { dirs: new Map(), files: [] }
  for (const entry of entries) {
    const parts = entry.path.split('/')
    let dir = root
    for (const part of parts.slice(0, -1)) {
      if (!dir.dirs.has(part)) dir.dirs.set(part, { dirs: new Map(), files: [] })
      dir = dir.dirs.get(part)!
    }
    dir.files.push(entry)
  }
  const nodes: FileNode[] = []
  const walk = (dir: Dir, prefix: string, depth: number) => {
    for (const [name, child] of [...dir.dirs].sort(([a], [b]) => a.localeCompare(b))) {
      nodes.push({ name, path: prefix + name, depth })
      walk(child, `${prefix}${name}/`, depth + 1)
    }
    for (const entry of [...dir.files].sort((a, b) => a.path.localeCompare(b.path)))
      nodes.push({ name: entry.path.split('/').pop()!, path: entry.path, depth, entry })
  }
  walk(root, '', 0)
  return nodes
}

const LANGUAGES: Record<string, string> = {
  php: 'php',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  java: 'java',
  go: 'go',
  rb: 'ruby',
  sql: 'sql',
  yaml: 'yaml',
  yml: 'yaml',
  json: 'javascript',
  html: 'html',
  htm: 'html',
  css: 'css',
  sh: 'shell',
  md: 'markdown',
  xml: 'xml',
}

/** 편집기 언어(Monaco 언어 id). Dockerfile은 이름으로 */
export function languageOf(path: string): string {
  const name = path.split('/').pop()!
  if (name.startsWith('Dockerfile')) return 'dockerfile'
  const dot = name.lastIndexOf('.')
  return (dot > 0 && LANGUAGES[name.slice(dot + 1).toLowerCase()]) || 'plaintext'
}

export type LineChange = { line: number; kind: 'added' | 'modified' | 'deleted' }

/** 가운데 비교 표가 이보다 크면 줄 맞추기 없이 통째로 바뀐 것으로 본다 */
const MAX_DIFF_CELLS = 4_000_000

/**
 * 원본과 지금 코드의 줄 비교(ADR 029). 편집기 막대용으로 지금 코드의 줄 번호(1부터)마다 더함·바뀜을,
 * 지운 줄은 그 자리 다음 줄에 표시를 준다. 원본에 없는 파일(null)은 모든 줄이 더한 줄이다.
 * 공통 앞뒤 줄을 잘라 내고 가운데만 LCS로 맞춘다
 */
export function lineChanges(
  original: string | null,
  current: string,
): { added: number; removed: number; lines: LineChange[] } {
  const a = original === null ? [] : original.split('\n')
  const b = current.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const n = endA - start
  const m = endB - start
  // ponytail: O(n·m) LCS, 가운데가 아주 크면 통째로 바뀐 것으로 본다. 필요하면 Myers diff로 바꾼다
  const lcs = new Int32Array(n * m <= MAX_DIFF_CELLS ? (n + 1) * (m + 1) : 0)
  if (lcs.length)
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        lcs[i * (m + 1) + j] =
          a[start + i] === b[start + j]
            ? lcs[(i + 1) * (m + 1) + j + 1] + 1
            : Math.max(lcs[(i + 1) * (m + 1) + j], lcs[i * (m + 1) + j + 1])

  const lines: LineChange[] = []
  let added = 0
  let removed = 0
  let deletes = 0
  let inserts: number[] = []
  // 같은 줄을 만날 때마다 그 앞의 지움·더함 묶음을 표시로 바꾼다
  const flush = (nextLine: number) => {
    inserts.forEach((line, k) => lines.push({ line, kind: k < deletes ? 'modified' : 'added' }))
    if (deletes > 0 && inserts.length === 0)
      lines.push({ line: Math.max(1, Math.min(nextLine, b.length)), kind: 'deleted' })
    added += inserts.length
    removed += deletes
    deletes = 0
    inserts = []
  }
  let i = 0
  let j = 0
  while (i < n || j < m) {
    const same = i < n && j < m && a[start + i] === b[start + j]
    if (same && lcs.length) {
      flush(start + j + 1)
      i++
      j++
    } else if (
      j >= m ||
      (i < n && lcs.length && lcs[(i + 1) * (m + 1) + j] >= lcs[i * (m + 1) + j + 1])
    ) {
      deletes++
      i++
    } else if (i >= n || lcs.length) {
      inserts.push(start + j + 1)
      j++
    } else {
      // 비교 표 없이: 남은 원본은 지우고 남은 지금 코드는 더한다
      deletes += n - i
      i = n
    }
  }
  flush(start + m + 1)
  return { added, removed, lines }
}

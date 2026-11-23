import { ws } from 'msw'

import type {
  HintResponse,
  LabSessionResponse,
  LabStage,
  RedeployResponse,
  VerificationResponse,
} from '@/api/generated/types.gen'

import { LAB_CHALLENGE } from './challenges'
import { loadScenario, saveScenario, type Scenario } from './scenario'

export const LAB_ID = 42

/** mock 공격 대상. 실제로는 Pod 안 문제 서비스(ADR 022). 문제 화면 모양만 흉내 낸다 */
const TARGET_PAGE = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>회원 로그인</title>
<body style="font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#fff;color:#111">
<form style="width:360px" onsubmit="event.preventDefault();document.getElementById('m').textContent='아이디 또는 비밀번호가 맞지 않습니다'">
<h1 style="font-size:24px">회원 로그인</h1>
<label>아이디<br><input style="width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box"></label>
<label>비밀번호<br><input type="password" style="width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box"></label>
<button style="width:100%;padding:12px;background:#111;color:#fff;border:0;border-radius:6px">로그인</button>
<p id="m" style="color:#666;font-size:14px"></p></form></body></html>`

export const MOCK_TARGET_URL = `data:text/html;charset=utf-8,${encodeURIComponent(TARGET_PAGE)}`

type LabState = Scenario['lab']

/** 진행 중으로 보는 시나리오(현재 세션 API가 반환함) */
export const ACTIVE_LABS: LabState[] = [
  'CREATING',
  'INITIALIZING',
  'READY',
  'defense',
  'idle-warning',
  'terminating',
]

/** 시나리오의 세션 응답. 시작한 뒤(없음)는 준비 완료로 본다 */
export function labOf(state: LabState, progress = progressOf(state)): LabSessionResponse {
  const now = Date.now()
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString()
  let status: LabSessionResponse['status'] =
    state === 'CREATING' || state === 'INITIALIZING' || state === 'FAILED'
      ? state
      : state === 'ended-user' || state === 'ended-admin'
        ? 'DELETED'
        : state === 'terminating'
          ? 'TERMINATING'
          : 'READY'
  // 실습 환경 다시 만들기: 잠시 준비 단계를 거쳐 다시 READY
  const since = progress.recreateAt ? now - progress.recreateAt : Infinity
  if (status === 'READY' && since < RECREATE_MS)
    status = since < RECREATE_MS / 2 ? 'CREATING' : 'INITIALIZING'
  const ready = status === 'READY'
  const deadline = state === 'idle-warning' ? 3 : 30
  return {
    id: LAB_ID,
    challengeId: LAB_CHALLENGE.id,
    challengeTitle: LAB_CHALLENGE.title,
    status,
    prepStep: status === 'CREATING' ? 'SPACE' : status === 'INITIALIZING' ? 'LOADING' : null,
    retrying: false,
    targetUrl: ready ? MOCK_TARGET_URL : null,
    stage: progress.stage,
    attackSkipped: progress.attackSkipped,
    attackHintsRevealed: progress.hints.filter((h) => h.stage === 'ATTACK').length,
    defenseHintsRevealed: progress.hints.filter((h) => h.stage === 'DEFENSE').length,
    defenseAttempts: 0,
    maxDefenseAttempts: 5,
    solutionAvailable: false,
    solutionViewedAt: null,
    completedAt: null,
    endReason:
      state === 'ended-admin'
        ? 'ADMIN'
        : state === 'ended-user' || state === 'terminating'
          ? 'USER'
          : null,
    createdAt: at(-1),
    readyAt: ready ? at(-1) : null,
    endedAt: status === 'DELETED' ? at(0) : null,
    idleDeadline: ready ? at(deadline) : null,
    idleWarningAt: ready ? at(deadline - 5) : null,
  }
}

/** 실습 중 진행: 단계, 연 힌트, 검증. 검증은 `doneAt`이 지나면 결과가 나온다 */
export type MockProgress = {
  stage: LabStage
  attackSkipped: boolean
  hints: HintResponse[]
  verifications: (VerificationResponse & { doneAt: number })[]
  /** 재배포와 서비스 초기화. `doneAt`이 지나면 결과가 나온다 */
  redeploys: (RedeployResponse & { doneAt: number })[]
  /** 학습자가 고친 파일 내용(경로별). 없으면 원본 */
  files: Record<string, string>
  /** 실습 환경 다시 만들기를 요청한 시각 */
  recreateAt?: number
}

const progressOf = (state: LabState, saved?: Partial<MockProgress>): MockProgress => ({
  stage: state === 'defense' ? 'DEFENSE' : 'ATTACK',
  attackSkipped: false,
  hints: [],
  verifications: [],
  redeploys: [],
  files: {},
  ...saved,
})

/** 화면 테스트에서는 바로, 브라우저에서는 2초 뒤 결과 */
const TEST = import.meta.env.MODE === 'test'
const VERIFY_MS = TEST ? 0 : 2_000
const REDEPLOY_MS = TEST ? 0 : 3_000
const RECREATE_MS = TEST ? 0 : 6_000

export const ATTACK_HINTS = [
  '로그인 폼에 넣은 **아이디**가 서버에서 어떻게 쓰이는지 생각해 봐요.',
  '`web/src/index.php`에서 로그인 쿼리를 만드는 줄을 찾아봐요.',
  '아이디 칸에서 문자열을 일찍 닫고, 뒤에 붙는 비밀번호 조건이 무시되게 해 봐요.',
]

/** 지금 진행을 읽고, 시간이 된 검증은 결과를 정해 저장한다 */
export function settleProgress(): MockProgress {
  const scenario = loadScenario()
  const progress = progressOf(scenario.lab, scenario.progress)
  const result = scenario.verify ?? 'PASS'
  for (const r of progress.redeploys) {
    if (r.status !== 'RUNNING' || r.doneAt > Date.now()) continue
    // 서비스 초기화는 늘 성공, 재배포는 mock 패널에서 고른 결과
    const status = r.kind === 'RESET' ? 'SUCCESS' : (scenario.redeploy ?? 'SUCCESS')
    Object.assign(r, {
      status,
      message: {
        SUCCESS: '모든 서비스가 정상이에요',
        FAIL: 'web 빌드에 실패했어요. 빌드 로그를 확인해 주세요',
        ERROR: '재배포를 실행하지 못했어요. 다시 시도해 주세요',
      }[status],
      log: status === 'ERROR' ? null : status === 'SUCCESS' ? BUILD_LOG_OK : BUILD_LOG_FAIL,
      durationMs: status === 'ERROR' ? null : 4_100,
      finishedAt: new Date().toISOString(),
    })
  }
  for (const v of progress.verifications) {
    if (v.status !== 'RUNNING' || v.doneAt > Date.now()) continue
    Object.assign(v, {
      status: result,
      message: {
        PASS: 'admin으로 로그인함',
        FAIL: '관리자로 로그인하지 못했어요',
        ERROR: '검증 스크립트를 실행하지 못했어요',
      }[result],
      durationMs: result === 'ERROR' ? null : 3_400,
      finishedAt: new Date().toISOString(),
    })
    if (result === 'PASS' && progress.stage === 'ATTACK') progress.stage = 'DEFENSE'
  }
  saveScenario({ ...scenario, progress })
  return progress
}

export function saveProgress(progress: MockProgress) {
  saveScenario({ ...loadScenario(), progress })
}

export function startRedeploy(
  progress: MockProgress,
  kind: RedeployResponse['kind'],
): RedeployResponse {
  const now = Date.now()
  const redeploy = {
    id: progress.redeploys.length + 1,
    kind,
    status: 'RUNNING' as const,
    message: null,
    log: null,
    durationMs: null,
    startedAt: new Date(now).toISOString(),
    finishedAt: null,
    doneAt: now + REDEPLOY_MS,
  }
  progress.redeploys.push(redeploy)
  saveProgress(progress)
  return publicRedeploy(redeploy, false)
}

/** 응답에는 mock 전용 `doneAt`을 넣지 않는다. 빌드 로그는 한 건 조회에서만 */
export function publicRedeploy(
  stored: MockProgress['redeploys'][number],
  withLog: boolean,
): RedeployResponse {
  const { doneAt, ...redeploy } = stored
  void doneAt
  return { ...redeploy, log: withLog ? redeploy.log : null }
}

/** 실행 중인 검증이나 재배포·초기화가 있으면 새 작업을 받지 않는다(ADR 024) */
export const jobRunning = (progress: MockProgress) =>
  progress.verifications.some((v) => v.status === 'RUNNING') ||
  progress.redeploys.some((r) => r.status === 'RUNNING')

const BUILD_LOG_OK = `#1 [web internal] load build definition from Dockerfile
#1 DONE 0.0s
#2 [web 1/3] FROM hackforge/sqli-login-web-base
#2 CACHED
#3 [web 2/3] COPY src/ /var/www/html/
#3 DONE 0.1s
#4 [web 3/3] RUN php -l /var/www/html/index.php
#4 0.312 No syntax errors detected in /var/www/html/index.php
#4 DONE 0.4s
#5 [web] exporting to image
#5 DONE 0.2s
 Container app-db-1  Running
 Container app-web-1  Recreated
 Container app-web-1  Started
 Container app-web-1  Healthy
`

const BUILD_LOG_FAIL = `#1 [web internal] load build definition from Dockerfile
#1 DONE 0.0s
#2 [web 1/3] FROM hackforge/sqli-login-web-base
#2 CACHED
#3 [web 2/3] COPY src/ /var/www/html/
#3 DONE 0.1s
#4 [web 3/3] RUN php -l /var/www/html/index.php
#4 0.298 PHP Parse error:  syntax error, unexpected token "}" in /var/www/html/index.php on line 12
#4 ERROR: process "/bin/sh -c php -l /var/www/html/index.php" did not complete successfully: exit code: 255
failed to solve: process "/bin/sh -c php -l /var/www/html/index.php" did not complete successfully: exit code: 255
`

export function startAttackVerification(progress: MockProgress): VerificationResponse {
  const now = Date.now()
  const verification = {
    id: progress.verifications.length + 1,
    type: 'ATTACK' as const,
    status: 'RUNNING' as const,
    message: null,
    durationMs: null,
    securityPassed: null,
    functionalPassed: null,
    securityMessage: null,
    functionalMessage: null,
    defenseHintsRevealed: null,
    afterSolution: null,
    startedAt: new Date(now).toISOString(),
    finishedAt: null,
    doneAt: now + VERIFY_MS,
  }
  progress.verifications.push(verification)
  saveProgress(progress)
  return publicVerification(verification)
}

/** 응답에는 mock 전용 `doneAt`을 넣지 않는다 */
export function publicVerification(
  stored: MockProgress['verifications'][number],
): VerificationResponse {
  const { doneAt, ...verification } = stored
  void doneAt
  return verification
}

const PROMPT = '/app # '

/** mock 셸의 답. 학습자가 흔히 치는 명령만 흉내 낸다 */
function answer(line: string): string {
  const command = line.trim()
  if (!command) return ''
  if (command === 'ls' || command.startsWith('ls ')) return 'compose.yaml  db  web\r\n'
  if (command.startsWith('docker compose ps'))
    return 'NAME        SERVICE   STATUS\r\napp-db-1    db        running (healthy)\r\napp-web-1   web       running (healthy)\r\n'
  if (command === 'pwd') return '/app\r\n'
  if (command === 'whoami') return 'root\r\n'
  return `sh: ${command.split(' ')[0]}: mock 셸에서는 이 명령을 흉내 내지 않아요\r\n`
}

/**
 * 웹 터미널 mock(ADR 022 메시지 형식). binary는 셸 입력·출력, text는 resize 제어.
 * 한 줄을 모아 Enter에 답하고, 입력은 그대로 되돌려 보낸다(TTY 에코)
 */
export const terminalHandler = ws
  .link('ws://*/api/labs/:id/terminal')
  .addEventListener('connection', ({ client }) => {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const send = (text: string) => client.send(encoder.encode(text))
    let line = ''
    send(`mock 셸이에요. ls, pwd, docker compose ps를 흉내 내요.\r\n${PROMPT}`)
    client.addEventListener('message', (event) => {
      if (typeof event.data === 'string') return // resize
      const input =
        event.data instanceof ArrayBuffer
          ? decoder.decode(event.data)
          : decoder.decode(event.data as Uint8Array)
      for (const ch of input) {
        if (ch === '\r') {
          send(`\r\n${answer(line)}${PROMPT}`)
          line = ''
        } else if (ch === '\u007f') {
          if (line) {
            line = line.slice(0, -1)
            send('\b \b')
          }
        } else {
          line += ch
          send(ch)
        }
      }
    })
  })

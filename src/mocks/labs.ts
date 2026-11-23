import { ws } from 'msw'

import type {
  HintResponse,
  LabSessionResponse,
  LabStage,
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
  const status: LabSessionResponse['status'] =
    state === 'CREATING' || state === 'INITIALIZING' || state === 'FAILED'
      ? state
      : state === 'ended-user' || state === 'ended-admin'
        ? 'DELETED'
        : state === 'terminating'
          ? 'TERMINATING'
          : 'READY'
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
}

const progressOf = (state: LabState, saved?: MockProgress): MockProgress =>
  saved ?? {
    stage: state === 'defense' ? 'DEFENSE' : 'ATTACK',
    attackSkipped: false,
    hints: [],
    verifications: [],
  }

/** 화면 테스트에서는 바로, 브라우저에서는 2초 뒤 결과 */
const VERIFY_MS = import.meta.env.MODE === 'test' ? 0 : 2_000

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

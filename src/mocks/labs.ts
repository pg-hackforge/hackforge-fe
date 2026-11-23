import { ws } from 'msw'

import type { LabSessionResponse } from '@/api/generated/types.gen'

import { LAB_CHALLENGE } from './challenges'
import type { Scenario } from './scenario'

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
export const ACTIVE_LABS: LabState[] = ['CREATING', 'INITIALIZING', 'READY', 'idle-warning']

/** 시나리오의 세션 응답. 시작한 뒤(없음)는 준비 완료로 본다 */
export function labOf(state: LabState): LabSessionResponse {
  const now = Date.now()
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString()
  const status: LabSessionResponse['status'] =
    state === 'CREATING' || state === 'INITIALIZING' || state === 'FAILED'
      ? state
      : state === 'ended-user' || state === 'ended-admin'
        ? 'DELETED'
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
    stage: 'ATTACK',
    attackSkipped: false,
    attackHintsRevealed: 0,
    defenseHintsRevealed: 0,
    defenseAttempts: 0,
    maxDefenseAttempts: 5,
    solutionAvailable: false,
    solutionViewedAt: null,
    completedAt: null,
    endReason: state === 'ended-admin' ? 'ADMIN' : state === 'ended-user' ? 'USER' : null,
    createdAt: at(-1),
    readyAt: ready ? at(-1) : null,
    endedAt: status === 'DELETED' ? at(0) : null,
    idleDeadline: ready ? at(deadline) : null,
    idleWarningAt: ready ? at(deadline - 5) : null,
  }
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

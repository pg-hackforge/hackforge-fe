import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { AArrowDownIcon, AArrowUpIcon, PlusIcon, RotateCwIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { clampFontSize, FONT_SIZE, readFontSize, terminalCloseNotice, terminalUrl } from '@/lib/lab'
import { cn } from '@/lib/utils'

/** 한 실습에 열 수 있는 터미널 수(서버 제한, 4429) */
const MAX_TABS = 3

/** 자주 쓰는 명령. 누르면 지금 터미널에 입력한다(Enter는 누르지 않음) */
const COMMANDS: [string, string][] = [
  ['서비스 상태', 'docker compose ps'],
  ['웹 서비스 로그', 'docker compose logs --tail 50 web'],
  ['공격 대상 응답', 'wget -qO- http://127.0.0.1:8080/ | head -n 20'],
  ['파일 목록', 'ls -la'],
]

type Tab = { id: number; label: string }

/** 터미널 글자 크기를 저장하는 곳(코드 편집기와 따로) */
const FONT_SIZE_KEY = 'hackforge.terminal-font-size'

function storedFontSize() {
  try {
    return readFontSize(localStorage.getItem(FONT_SIZE_KEY))
  } catch {
    return FONT_SIZE.initial
  }
}

/**
 * 웹 터미널(ADR 022, DESIGN.md "터미널(실습)"). 탭마다 WebSocket 하나로 Pod 안 셸에 붙는다.
 * 실습 화면에서 다른 화면을 봐도 셸이 끊기지 않게, 부모는 이 패널을 숨기기만 한다
 */
export function TerminalPanel({ labId, visible }: { labId: number; visible: boolean }) {
  const [tabs, setTabs] = useState<Tab[]>([{ id: 1, label: '터미널 1' }])
  const [active, setActive] = useState(1)
  const senders = useRef(new Map<number, (text: string) => void>())
  const [fontSize, setFontSize] = useState(storedFontSize)
  const changeFontSize = (step: number) => {
    const next = clampFontSize(fontSize + step)
    setFontSize(next)
    try {
      localStorage.setItem(FONT_SIZE_KEY, String(next))
    } catch {
      // 저장이 막힌 브라우저에서는 이번 실습 동안만 쓴다
    }
  }

  const add = () => {
    const id = Math.max(...tabs.map((t) => t.id)) + 1
    setTabs([...tabs, { id, label: `터미널 ${id}` }])
    setActive(id)
  }
  const close = (id: number) => {
    const rest = tabs.filter((t) => t.id !== id)
    setTabs(rest)
    if (active === id) setActive(rest[rest.length - 1]?.id ?? 0)
  }

  return (
    <div className={cn('flex h-full min-h-0', !visible && 'hidden')}>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-terminal scheme-dark">
        <div
          role="tablist"
          aria-label="터미널"
          className="flex items-center gap-1 border-b border-white/10 px-2 pt-2"
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'flex items-center rounded-t-md text-[12.5px]',
                tab.id === active
                  ? 'bg-white/10 text-terminal-foreground'
                  : 'text-terminal-foreground/60',
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab.id === active}
                onClick={() => setActive(tab.id)}
                className="px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {tab.label}
              </button>
              {tabs.length > 1 && (
                <button
                  type="button"
                  aria-label={`${tab.label} 닫기`}
                  onClick={() => close(tab.id)}
                  className="mr-1 rounded p-0.5 hover:bg-white/10"
                >
                  <XIcon className="size-3.5" aria-hidden />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            aria-label="터미널 추가"
            disabled={tabs.length >= MAX_TABS}
            onClick={add}
            className="mb-1 rounded p-1 text-terminal-foreground/70 hover:bg-white/10 disabled:opacity-30"
          >
            <PlusIcon className="size-4" aria-hidden />
          </button>
          <div className="mb-1 ml-auto flex items-center gap-0.5 text-terminal-foreground/70">
            <button
              type="button"
              aria-label="글자 작게"
              disabled={fontSize <= FONT_SIZE.min}
              onClick={() => changeFontSize(-1)}
              className="rounded p-1 hover:bg-white/10 disabled:opacity-30"
            >
              <AArrowDownIcon className="size-4" aria-hidden />
            </button>
            <span
              className="w-6 text-center font-mono text-[12px] tabular-nums"
              aria-label={`글자 크기 ${fontSize}`}
            >
              {fontSize}
            </span>
            <button
              type="button"
              aria-label="글자 크게"
              disabled={fontSize >= FONT_SIZE.max}
              onClick={() => changeFontSize(1)}
              className="rounded p-1 hover:bg-white/10 disabled:opacity-30"
            >
              <AArrowUpIcon className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          {tabs.map((tab) => (
            <TerminalView
              key={tab.id}
              labId={labId}
              visible={visible && tab.id === active}
              fontSize={fontSize}
              onSender={(send) => senders.current.set(tab.id, send)}
            />
          ))}
        </div>
      </div>
      <aside className="ml-3 w-60 shrink-0 rounded-xl border bg-card p-4 text-sm">
        <p className="font-semibold">자주 쓰는 명령</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          누르면 터미널에 입력돼요. 실행은 Enter로 해요.
        </p>
        <ul className="mt-3 space-y-1.5">
          {COMMANDS.map(([label, command]) => (
            <li key={command}>
              <button
                type="button"
                onClick={() => senders.current.get(active)?.(command)}
                className="w-full rounded-lg border px-2.5 py-2 text-left hover:bg-muted/60"
              >
                <span className="block text-[12.5px] font-medium">{label}</span>
                <code className="mt-0.5 block truncate font-mono text-[11.5px] text-muted-foreground">
                  {command}
                </code>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

/** xterm의 색은 CSS 토큰에서 읽는다(DESIGN.md: 터미널은 두 테마 모두 어두운 바탕) */
function terminalTheme() {
  const css = getComputedStyle(document.documentElement)
  const token = (name: string) => css.getPropertyValue(name).trim() || undefined
  return {
    background: token('--terminal'),
    foreground: token('--terminal-foreground'),
    cursor: token('--primary'),
    selectionBackground: 'rgba(255,255,255,0.2)',
  }
}

type Connection =
  { state: 'connecting' } | { state: 'open' } | { state: 'closed'; text: string; retry: boolean }

/** 셸 하나. 닫히면 이유를 보여 주고, 다시 연결하면 새 셸이다 */
function TerminalView({
  labId,
  visible,
  fontSize,
  onSender,
}: {
  labId: number
  visible: boolean
  fontSize: number
  onSender: (send: (text: string) => void) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const fitRef = useRef<FitAddon>(null)
  const termRef = useRef<Terminal>(null)
  const [attempt, setAttempt] = useState(0)
  const [connection, setConnection] = useState<Connection>({ state: 'connecting' })
  const onSenderRef = useRef(onSender)
  const fontSizeRef = useRef(fontSize)
  useEffect(() => {
    onSenderRef.current = onSender
    fontSizeRef.current = fontSize
  })

  useEffect(() => {
    const term = new Terminal({
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: fontSizeRef.current,
      lineHeight: 1.25,
      cursorBlink: true,
      theme: terminalTheme(),
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host.current!)
    termRef.current = term
    fitRef.current = fit

    const socket = new WebSocket(terminalUrl(labId))
    socket.binaryType = 'arraybuffer'
    const encoder = new TextEncoder()
    const send = (text: string) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(encoder.encode(text))
    }
    const sendSize = () => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }
    socket.onopen = () => {
      setConnection({ state: 'open' })
      sendSize()
      term.focus()
    }
    socket.onmessage = (event) =>
      term.write(
        typeof event.data === 'string' ? event.data : new Uint8Array(event.data as ArrayBuffer),
      )
    socket.onclose = (event) =>
      setConnection({ state: 'closed', ...terminalCloseNotice(event.code) })
    const input = term.onData(send)
    const resize = term.onResize(sendSize)
    onSenderRef.current((text) => {
      send(text)
      term.focus()
    })

    const observer = new ResizeObserver(() => {
      if (host.current?.offsetParent) fit.fit()
    })
    observer.observe(host.current!)
    return () => {
      observer.disconnect()
      input.dispose()
      resize.dispose()
      socket.close()
      term.dispose()
    }
  }, [labId, attempt])

  // 글자 크기가 바뀌면 줄과 칸 수를 다시 맞춘다. 바뀐 크기는 onResize로 셸에 알린다
  useEffect(() => {
    const term = termRef.current
    if (!term || term.options.fontSize === fontSize) return
    term.options.fontSize = fontSize
    if (host.current?.offsetParent) fitRef.current?.fit()
  }, [fontSize])

  // 숨겨져 있던 동안의 크기 변화는 보일 때 맞춘다
  useEffect(() => {
    if (!visible) return
    fitRef.current?.fit()
    termRef.current?.focus()
  }, [visible])

  const reconnect = () => {
    setConnection({ state: 'connecting' })
    setAttempt((n) => n + 1)
  }

  return (
    <div className={cn('absolute inset-0 p-2', !visible && 'invisible')}>
      <div ref={host} className="h-full" aria-label="터미널 화면" />
      {connection.state === 'closed' && (
        <div
          role="status"
          className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-lg border border-white/15 bg-black/60 px-3.5 py-2.5 text-[13px] text-terminal-foreground backdrop-blur"
        >
          {connection.text}
          {connection.retry && (
            <button
              type="button"
              onClick={reconnect}
              className="flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 font-medium hover:bg-white/20"
            >
              <RotateCwIcon className="size-3.5" aria-hidden />새 셸로 다시 연결
            </button>
          )}
        </div>
      )}
    </div>
  )
}

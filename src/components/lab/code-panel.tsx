import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AArrowDownIcon,
  AArrowUpIcon,
  CheckIcon,
  FileIcon,
  FolderIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError } from '@/api/errors'
import {
  getLabFileOptions,
  getLabFileQueryKey,
  getOriginalLabFileOptions,
  listLabFilesOptions,
  listLabFilesQueryKey,
} from '@/api/generated/@tanstack/react-query.gen'
import { revertLabFile, saveLabFile } from '@/api/generated/sdk.gen'
import type { LabFileResponse } from '@/api/generated/types.gen'
import { ActionButton, CancelButton, Dialog, DialogText } from '@/components/dialog'
import { FormAlert } from '@/components/form'
import { applyEditorTheme, monaco } from '@/components/lab/monaco'
import { Button } from '@/components/ui/button'
import {
  clampFontSize,
  clockTime,
  FONT_SIZE,
  fileTree,
  languageOf,
  lineChanges,
  readFontSize,
} from '@/lib/lab'
import { cn } from '@/lib/utils'
import { CODE_FONT, onCodeFontReady } from '@/lib/code-font'

/** 편집기 글자 크기를 저장하는 곳(터미널과 따로) */
const FONT_SIZE_KEY = 'hackforge.editor-font-size'
/** 마지막 입력 뒤 이만큼 지나면 자동 저장 */
const SAVE_DELAY_MS = 800

type SaveState =
  | { state: 'loaded' }
  | { state: 'dirty' }
  | { state: 'saving' }
  | { state: 'saved'; at: string }
  | { state: 'conflict' }
  | { state: 'error' }

/** 지금 편집기에 열린 파일. 저장할 때 보낼 해시와 저장 안 된 변경 여부 */
type Doc = { path: string; sha: string; dirty: boolean; readOnly: boolean }

function storedFontSize() {
  try {
    return readFontSize(localStorage.getItem(FONT_SIZE_KEY))
  } catch {
    return FONT_SIZE.initial
  }
}

/**
 * 코드(ADR 024, 확정 캡처 `lab-code`): 왼쪽 탐색기, 오른쪽 편집기. 편집 내용은 입력이 멈추면 자동 저장한다.
 * 저장할 때 읽은 시점의 해시를 보내고, 터미널 등에서 파일이 바뀌었으면(409) 다시 불러올지 덮어쓸지 묻는다.
 * 실습 화면에서 다른 화면을 봐도 편집 상태가 남게, 부모는 이 패널을 숨기기만 한다
 */
export function CodePanel({
  labId,
  visible,
  lastRedeployAt,
  onFlush,
  onSaved,
}: {
  labId: number
  visible: boolean
  /** 마지막 재배포 시각(탐색기 아래) */
  lastRedeployAt?: string
  /** 저장 안 된 내용을 저장하는 함수를 부모에 알린다(재배포 전에 부름) */
  onFlush: (flush: () => Promise<void>) => void
  /** 저장(되돌리기 포함)에 성공할 때마다. 재배포하지 않은 변경을 알리는 데 쓴다 */
  onSaved: () => void
}) {
  const queryClient = useQueryClient()
  const files = useQuery(listLabFilesOptions({ path: { id: labId } }))
  const [chosen, setChosen] = useState<string | null>(null)
  // 처음에는 고칠 수 있는 첫 파일을 연다
  const path =
    chosen ?? files.data?.find((f) => f.openable && !f.readOnly)?.path ?? files.data?.[0]?.path
  const fileOptions = getLabFileOptions({ path: { id: labId }, query: { path: path ?? '' } })
  const file = useQuery({ ...fileOptions, enabled: !!path })
  const entry = files.data?.find((f) => f.path === path)
  // 원본(ADR 029). 원본에 없는 파일(학습자가 만든 파일)은 null로 보고 모든 줄을 더한 줄로 표시한다
  const originalQuery = useQuery({
    ...getOriginalLabFileOptions({ path: { id: labId }, query: { path: path ?? '' } }),
    enabled: !!entry?.openable,
    retry: false,
  })
  const original = originalQuery.data
    ? originalQuery.data.content
    : originalQuery.error instanceof ApiError && originalQuery.error.code === 'FILE_NOT_FOUND'
      ? null
      : undefined

  const host = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>(null)
  const docRef = useRef<Doc>(null)
  const loading = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const inflight = useRef<Promise<void>>(null)
  const [save, setSaveState] = useState<SaveState>({ state: 'loaded' })
  // 입력 처리에서 지금 저장 상태를 읽으려고 ref에도 둔다
  const saveRef = useRef<SaveState>(save)
  const setSave = useCallback((next: SaveState) => {
    saveRef.current = next
    setSaveState(next)
  }, [])
  const [readOnly, setReadOnly] = useState(false)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [fontSize, setFontSize] = useState(storedFontSize)
  const [confirmRevert, setConfirmRevert] = useState(false)
  const [revertError, setRevertError] = useState(false)
  const [changes, setChanges] = useState({ added: 0, removed: 0 })
  const originalRef = useRef<{ path: string; content: string | null }>(null)
  const decorations = useRef<monaco.editor.IEditorDecorationsCollection>(null)
  const diffTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  /** 원본과 지금 편집기 내용을 비교해 막대와 +/− 수를 바꾼다. 원본을 아직 못 받았으면 표시하지 않는다 */
  const refreshDiff = useCallback(() => {
    const editor = editorRef.current
    const base = originalRef.current
    if (!editor || !base || base.path !== docRef.current?.path) {
      decorations.current?.clear()
      setChanges({ added: 0, removed: 0 })
      return
    }
    const result = lineChanges(base.content, editor.getValue())
    decorations.current?.set(
      result.lines.map(({ line, kind }) => ({
        range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
        options: { linesDecorationsClassName: `hf-line-${kind}` },
      })),
    )
    setChanges({ added: result.added, removed: result.removed })
  }, [])

  const fileKey = useCallback(
    (p: string) => getLabFileQueryKey({ path: { id: labId }, query: { path: p } }),
    [labId],
  )

  const onSavedRef = useRef(onSaved)
  // 타이머와 정리 함수는 늘 최신 flush를 부른다
  const flushRef = useRef<(overwrite?: boolean) => Promise<void>>(async () => {})
  const fontSizeRef = useRef(fontSize)

  /** 저장 안 된 내용을 저장한다. 덮어쓰기면 해시 없이 보낸다 */
  const flush = useCallback(
    async (overwrite = false): Promise<void> => {
      clearTimeout(timer.current)
      if (inflight.current) await inflight.current
      const doc = docRef.current
      const editor = editorRef.current
      if (!doc || !editor || doc.readOnly || (!doc.dirty && !overwrite)) return
      const content = editor.getValue()
      setSave({ state: 'saving' })
      const run = (async () => {
        try {
          const saved = (
            await saveLabFile({
              path: { id: labId },
              query: { path: doc.path },
              body: { content, baseSha256: overwrite ? null : doc.sha },
              throwOnError: true,
            })
          ).data
          doc.sha = saved.sha256
          doc.dirty = docRef.current === doc && editor.getValue() !== content
          queryClient.setQueryData(fileKey(doc.path), saved)
          onSavedRef.current()
          // 다른 파일의 M(원본과 다름)은 목록이 알려 준다
          void queryClient.invalidateQueries({
            queryKey: listLabFilesQueryKey({ path: { id: labId } }),
          })
          if (docRef.current !== doc) return
          if (doc.dirty) {
            setSave({ state: 'dirty' })
            timer.current = setTimeout(() => void flushRef.current(), SAVE_DELAY_MS)
          } else setSave({ state: 'saved', at: new Date().toISOString() })
        } catch (error) {
          setSave({
            state:
              error instanceof ApiError && error.code === 'FILE_CHANGED' ? 'conflict' : 'error',
          })
        }
      })()
      inflight.current = run
      await run
      inflight.current = null
    },
    [labId, queryClient, fileKey, setSave],
  )

  useEffect(() => {
    flushRef.current = flush
    fontSizeRef.current = fontSize
    onSavedRef.current = onSaved
    onFlush(() => flush())
  })

  /** 받은 파일을 편집기에 넣는다(처음 열기, 다른 파일, 다시 불러오기, 되돌리기, 초기화) */
  const load = useCallback(
    (data: LabFileResponse) => {
      const editor = editorRef.current
      if (!editor) return
      loading.current = true
      editor.setValue(data.content)
      monaco.editor.setModelLanguage(editor.getModel()!, languageOf(data.path))
      editor.updateOptions({ readOnly: data.readOnly })
      loading.current = false
      docRef.current = { path: data.path, sha: data.sha256, dirty: false, readOnly: data.readOnly }
      setReadOnly(data.readOnly)
      setSave({ state: 'loaded' })
      refreshDiff()
    },
    [setSave, refreshDiff],
  )

  // 편집기는 한 번 만들고 파일을 바꿔 끼운다
  useEffect(() => {
    applyEditorTheme()
    const editor = monaco.editor.create(host.current!, {
      value: '',
      fontFamily: CODE_FONT,
      fontSize: fontSizeRef.current,
      lineHeight: 1.7,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      tabSize: 4,
      renderLineHighlight: 'all',
    })
    editorRef.current = editor
    onCodeFontReady(() => monaco.editor.remeasureFonts())
    decorations.current = editor.createDecorationsCollection()
    const change = editor.onDidChangeModelContent(() => {
      clearTimeout(diffTimer.current)
      diffTimer.current = setTimeout(refreshDiff, 150)
      const doc = docRef.current
      if (loading.current || !doc || doc.readOnly) return
      doc.dirty = true
      clearTimeout(timer.current)
      // 충돌이나 저장 실패를 처리하기 전에는 자동 저장하지 않는다
      const state = saveRef.current.state
      if (state === 'conflict' || state === 'error') return
      setSave({ state: 'dirty' })
      timer.current = setTimeout(() => void flushRef.current(), SAVE_DELAY_MS)
    })
    const move = editor.onDidChangeCursorPosition((event) =>
      setCursor({ line: event.position.lineNumber, column: event.position.column }),
    )
    // 라이트·다크를 바꾸면 편집기 색도 바꾼다
    const themeWatch = new MutationObserver(applyEditorTheme)
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => {
      themeWatch.disconnect()
      change.dispose()
      move.dispose()
      clearTimeout(diffTimer.current)
      void flushRef.current()
      editor.dispose()
      editorRef.current = null
    }
  }, [setSave, refreshDiff])

  // 원본을 받으면(또는 원본에 없는 파일이면) 다시 비교한다
  useEffect(() => {
    if (!path || original === undefined) return
    originalRef.current = { path, content: original }
    refreshDiff()
  }, [path, original, refreshDiff])

  // 받은 내용이 편집기와 다르면 넣는다. 저장 안 된 변경이 있으면 덮지 않는다
  useEffect(() => {
    const data = file.data
    if (!data) return
    const doc = docRef.current
    if (doc?.path === data.path && (doc.dirty || doc.sha === data.sha256)) return
    load(data)
  }, [file.data, load])

  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize })
  }, [fontSize])

  const open = async (next: string) => {
    if (next === path) return
    await flush()
    setChosen(next)
  }

  const reload = async () => {
    const fresh = await file.refetch()
    if (fresh.data) load(fresh.data)
  }

  const revert = async () => {
    setConfirmRevert(false)
    setRevertError(false)
    clearTimeout(timer.current)
    try {
      const data = (
        await revertLabFile({ path: { id: labId }, query: { path: path! }, throwOnError: true })
      ).data
      queryClient.setQueryData(fileKey(data.path), data)
      load(data)
      onSaved()
      void queryClient.invalidateQueries({
        queryKey: listLabFilesQueryKey({ path: { id: labId } }),
      })
    } catch {
      setRevertError(true)
    }
  }

  const changeFontSize = (step: number) => {
    const next = clampFontSize(fontSize + step)
    setFontSize(next)
    try {
      localStorage.setItem(FONT_SIZE_KEY, String(next))
    } catch {
      // 저장이 막힌 브라우저에서는 이번 실습 동안만 쓴다
    }
  }

  const language = path
    ? (monaco.languages.getLanguages().find((l) => l.id === languageOf(path))?.aliases?.[0] ??
      '텍스트')
    : ''

  return (
    <div
      className={cn(
        'flex h-full overflow-hidden rounded-xl border bg-editor-chrome',
        !visible && 'hidden',
      )}
    >
      <aside className="flex w-60 shrink-0 flex-col border-r" aria-label="탐색기">
        <p className="border-b px-3 py-2.5 text-xs font-semibold text-muted-foreground">탐색기</p>
        {files.isError && (
          <div className="px-3">
            <FormAlert tone="error">파일 목록을 불러오지 못했어요.</FormAlert>
          </div>
        )}
        <ul className="min-h-0 flex-1 overflow-y-auto py-1.5 text-[13px]">
          {fileTree(files.data ?? []).map((node) => {
            const indent = { paddingLeft: 12 + node.depth * 14 }
            if (!node.entry)
              return (
                <li
                  key={`d:${node.path}`}
                  style={indent}
                  className="flex items-center gap-1.5 py-1 text-muted-foreground"
                >
                  <FolderIcon className="size-3.5" aria-hidden />
                  {node.name}
                </li>
              )
            const { openable, readOnly: locked } = node.entry
            // 지금 연 파일은 입력 중인 내용으로, 나머지는 저장된 파일 기준(목록의 modified)
            const changed =
              node.path === path ? changes.added + changes.removed > 0 : node.entry.modified
            return (
              <li key={node.path}>
                <button
                  type="button"
                  style={indent}
                  disabled={!openable}
                  aria-current={node.path === path || undefined}
                  title={openable ? undefined : '1MB를 넘거나 바이너리라 열 수 없어요'}
                  onClick={() => void open(node.path)}
                  className="flex w-full items-center gap-1.5 py-1 pr-2 text-left hover:bg-muted/60 disabled:opacity-45 aria-[current]:bg-editor-line aria-[current]:text-foreground aria-[current]:shadow-[inset_2px_0_0_var(--color-primary)]"
                >
                  <FileIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{node.name}</span>
                  {changed && (
                    <span
                      className="shrink-0 font-mono text-[11px] font-bold text-primary"
                      title="원본과 달라요"
                    >
                      M
                    </span>
                  )}
                  {locked && (
                    <span className="shrink-0 rounded border px-1 text-[10.5px] text-muted-foreground">
                      읽기 전용
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="space-y-1 border-t px-3 py-2.5 text-xs text-muted-foreground">
          {path && (
            <p className="flex justify-between gap-2" aria-label="원본과 달라진 줄">
              <span className="truncate">{path.split('/').pop()}</span>
              <span className="shrink-0 font-mono tabular-nums">
                +{changes.added} −{changes.removed}
              </span>
            </p>
          )}
          <p className="flex justify-between">
            마지막 재배포
            <span className="font-mono">{lastRedeployAt ? clockTime(lastRedeployAt) : '없음'}</span>
          </p>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col" aria-label="편집기">
        <div className="flex items-center gap-3 border-b px-3 py-1.5">
          <span className="flex items-center gap-1.5 rounded-t-md border-b-2 border-primary px-2 py-1 text-[13px] font-medium">
            <FileIcon className="size-3.5" aria-hidden />
            {path?.split('/').pop()}
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <SaveStatus save={save} readOnly={readOnly} onRetry={() => void flush()} />
          </span>
          {entry && !entry.readOnly && (
            <Button variant="outline" size="sm" onClick={() => setConfirmRevert(true)}>
              <RotateCcwIcon className="size-3.5" aria-hidden />이 파일 처음 상태로
            </Button>
          )}
        </div>
        <p className="border-b px-4 py-1.5 font-mono text-[12px] text-muted-foreground">
          app {path?.split('/').map((part) => ` › ${part}`)}
        </p>
        {save.state === 'conflict' && (
          <div
            role="alert"
            className="flex items-center gap-3 border-b bg-ember-soft px-4 py-2.5 text-[13px]"
          >
            <TriangleAlertIcon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="flex-1">
              <b className="font-semibold">터미널 등에서 이 파일이 바뀌었어요.</b> 내가 고친 내용은
              아직 저장되지 않았어요.
            </span>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              다시 불러오기
            </Button>
            <Button size="sm" onClick={() => void flush(true)}>
              내 내용으로 덮어쓰기
            </Button>
          </div>
        )}
        {revertError && (
          <div className="px-4">
            <FormAlert tone="error">처음 상태로 되돌리지 못했어요. 다시 시도해 주세요.</FormAlert>
          </div>
        )}
        {file.isError && (
          <div className="px-4">
            <FormAlert tone="error">파일을 열지 못했어요. 다시 시도해 주세요.</FormAlert>
          </div>
        )}
        <div ref={host} className="min-h-0 flex-1 bg-editor" />
        <div className="flex items-center gap-4 border-t px-3 py-1 text-xs text-muted-foreground">
          <span className="tabular-nums">
            줄 {cursor.line}, 열 {cursor.column}
          </span>
          <span>UTF-8</span>
          <span>{language}</span>
          <span className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="글자 작게"
              disabled={fontSize <= FONT_SIZE.min}
              onClick={() => changeFontSize(-1)}
              className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
            >
              <AArrowDownIcon className="size-3.5" aria-hidden />
            </button>
            <span
              className="w-5 text-center font-mono tabular-nums"
              aria-label={`글자 크기 ${fontSize}`}
            >
              {fontSize}
            </span>
            <button
              type="button"
              aria-label="글자 크게"
              disabled={fontSize >= FONT_SIZE.max}
              onClick={() => changeFontSize(1)}
              className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
            >
              <AArrowUpIcon className="size-3.5" aria-hidden />
            </button>
          </span>
          <span className="ml-auto">재배포하면 고친 코드로 서비스를 다시 빌드해요</span>
        </div>
      </section>

      <Dialog
        open={confirmRevert}
        onClose={() => setConfirmRevert(false)}
        title="이 파일을 처음 상태로 되돌릴까요?"
        actions={
          <>
            <CancelButton />
            <ActionButton onClick={() => void revert()}>되돌리기</ActionButton>
          </>
        }
      >
        <DialogText>
          {path}에서 고친 내용이 사라지고 문제의 원본으로 돌아가요. 서비스에 반영하려면 재배포해요.
        </DialogText>
      </Dialog>
    </div>
  )
}

function SaveStatus({
  save,
  readOnly,
  onRetry,
}: {
  save: SaveState
  readOnly: boolean
  onRetry: () => void
}) {
  if (readOnly) return <>읽기 전용 파일이에요</>
  switch (save.state) {
    case 'dirty':
      return <>저장 대기</>
    case 'saving':
      return <>저장 중…</>
    case 'saved':
      return (
        <>
          <CheckIcon className="size-3.5 text-pass" aria-hidden />
          자동 저장됨 · {clockTime(save.at)}
        </>
      )
    case 'error':
      return (
        <span className="flex items-center gap-2 text-fail">
          저장하지 못했어요
          <button type="button" onClick={onRetry} className="underline underline-offset-2">
            다시 시도
          </button>
        </span>
      )
    case 'conflict':
      return <span className="text-primary">저장 멈춤</span>
    default:
      return <>자동 저장</>
  }
}

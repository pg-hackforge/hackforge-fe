// Monaco 편집기 준비(ADR 027: 외부 CDN 없이 번들에 넣고 코드 화면을 열 때만 불러온다).
// 편집 기능만 쓰고 언어는 문법 강조만 등록한다(언어 서비스와 전용 worker 없음).
import * as monaco from 'monaco-editor/editor/editor.api'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import 'monaco-editor/languages/definitions/css/register'
import 'monaco-editor/languages/definitions/dockerfile/register'
import 'monaco-editor/languages/definitions/go/register'
import 'monaco-editor/languages/definitions/html/register'
import 'monaco-editor/languages/definitions/java/register'
import 'monaco-editor/languages/definitions/javascript/register'
import 'monaco-editor/languages/definitions/markdown/register'
import 'monaco-editor/languages/definitions/php/register'
import 'monaco-editor/languages/definitions/python/register'
import 'monaco-editor/languages/definitions/ruby/register'
import 'monaco-editor/languages/definitions/shell/register'
import 'monaco-editor/languages/definitions/sql/register'
import 'monaco-editor/languages/definitions/typescript/register'
import 'monaco-editor/languages/definitions/xml/register'
import 'monaco-editor/languages/definitions/yaml/register'

self.MonacoEnvironment = { getWorker: () => new EditorWorker() }

/** 색은 CSS 토큰에서 읽는다(DESIGN.md "편집기"). 테마를 바꾸면 다시 부른다 */
export function applyEditorTheme() {
  const css = getComputedStyle(document.documentElement)
  const token = (name: string) => css.getPropertyValue(name).trim()
  const dark = document.documentElement.classList.contains('dark')
  monaco.editor.defineTheme('hackforge', {
    base: dark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [{ token: 'string', foreground: token('--code-string').slice(1) }],
    colors: {
      'editor.background': token('--editor'),
      'editor.foreground': token('--foreground'),
      'editorGutter.background': token('--editor-gutter'),
      'editor.lineHighlightBackground': token('--editor-line'),
      'editor.lineHighlightBorder': token('--editor-line'),
      'editorLineNumber.foreground': token('--muted-foreground'),
      'editorLineNumber.activeForeground': token('--primary'),
      'editorCursor.foreground': token('--primary'),
      'editorWidget.background': token('--editor-chrome'),
      'editorWidget.border': token('--border'),
    },
  })
  monaco.editor.setTheme('hackforge')
}

export { monaco }

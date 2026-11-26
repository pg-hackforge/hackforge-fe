/** 코드 글꼴(DESIGN.md "코드"). 파일은 src/index.css가 불러온다(@fontsource-variable/jetbrains-mono) */
export const CODE_FONT = "'JetBrains Mono Variable', ui-monospace, monospace"

/**
 * 코드 글꼴 파일을 받은 뒤 fn을 부른다. 편집기와 터미널은 만들 때 글자 폭을 재므로,
 * 글꼴이 늦게 오면 다시 재야 칸이 맞는다. 글꼴 API가 없는 곳(테스트)에서는 부르지 않는다
 */
export function onCodeFontReady(fn: () => void) {
  document.fonts?.load("13px 'JetBrains Mono Variable'").then(fn, () => {})
}

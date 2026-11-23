// 화면 테스트용 가짜 Monaco. jsdom에서는 실제 편집기가 돌지 않아 textarea로 흉내 낸다.
// 코드 패널이 쓰는 것만: 만들기, 내용 읽기·쓰기, 읽기 전용, 내용·커서 변경 알림
type Listener = () => void

export const monaco = {
  editor: {
    create(host: HTMLElement) {
      const area = document.createElement('textarea')
      area.setAttribute('aria-label', '코드 편집기')
      host.appendChild(area)
      const listeners = new Set<Listener>()
      area.addEventListener('input', () => listeners.forEach((l) => l()))
      return {
        getValue: () => area.value,
        setValue: (value: string) => {
          area.value = value
          listeners.forEach((l) => l())
        },
        getModel: () => ({}),
        updateOptions: (options: { readOnly?: boolean }) => {
          if (options.readOnly !== undefined) area.readOnly = options.readOnly
        },
        onDidChangeModelContent: (listener: Listener) => {
          listeners.add(listener)
          return { dispose: () => listeners.delete(listener) }
        },
        onDidChangeCursorPosition: () => ({ dispose: () => {} }),
        dispose: () => area.remove(),
      }
    },
    setModelLanguage: () => {},
  },
  languages: { getLanguages: () => [] },
}

export function applyEditorTheme() {}

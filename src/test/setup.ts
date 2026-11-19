import '@testing-library/jest-dom/vitest'

// jsdom에는 matchMedia가 없다. 테마 provider가 시스템 설정을 읽을 때 쓰므로 라이트로 고정한 대체물을 둔다
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

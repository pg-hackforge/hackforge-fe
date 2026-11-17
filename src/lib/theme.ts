export type Theme = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'hackforge-theme'

/** 처음 접속하면 다크(hackforge-docs ADR 017). 시스템 설정 따라가기는 사용자가 고를 수 있다 */
export const DEFAULT_THEME: Theme = 'dark'

const isTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system'

/** 저장된 선택. 없거나 읽을 수 없으면 기본 테마 */
export function loadTheme(storage: Pick<Storage, 'getItem'> | undefined): Theme {
  try {
    const saved = storage?.getItem(THEME_STORAGE_KEY)
    return isTheme(saved) ? saved : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function saveTheme(storage: Pick<Storage, 'setItem'> | undefined, theme: Theme) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // 저장소를 쓸 수 없으면(사생활 보호 모드 등) 이번 탭에서만 유지
  }
}

/** system이면 OS 설정을 따른다 */
export function resolveTheme(theme: Theme, prefersDark: boolean): 'light' | 'dark' {
  return theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme
}

export function applyTheme(root: HTMLElement, resolved: 'light' | 'dark') {
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

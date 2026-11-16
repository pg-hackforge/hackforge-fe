import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { applyTheme, loadTheme, resolveTheme, saveTheme, type Theme } from '@/lib/theme'

type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void }

const ThemeContext = createContext<ThemeContextValue | null>(null)

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => loadTheme(window.localStorage))

  useEffect(() => {
    const media = darkQuery()
    const sync = () => applyTheme(document.documentElement, resolveTheme(theme, media.matches))
    sync()
    if (theme !== 'system') return
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [theme])

  const setTheme = (next: Theme) => {
    saveTheme(window.localStorage, next)
    setThemeState(next)
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme은 ThemeProvider 안에서만 쓴다')
  return context
}

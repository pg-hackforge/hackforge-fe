import { describe, expect, it } from 'vitest'

import { applyTheme, loadTheme, resolveTheme, saveTheme, THEME_STORAGE_KEY } from './theme'

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial }
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value
    },
  }
}

describe('theme', () => {
  it('저장된 값이 없거나 잘못되면 dark(기본 테마)', () => {
    expect(loadTheme(memory())).toBe('dark')
    expect(loadTheme(memory({ [THEME_STORAGE_KEY]: 'blue' }))).toBe('dark')
    expect(loadTheme(undefined)).toBe('dark')
  })

  it('저장된 system은 그대로 유지', () => {
    expect(loadTheme(memory({ [THEME_STORAGE_KEY]: 'system' }))).toBe('system')
  })

  it('저장소를 읽을 수 없어도 dark로 동작', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
    }
    expect(loadTheme(broken)).toBe('dark')
  })

  it('저장한 값을 다시 읽음', () => {
    const storage = memory()
    saveTheme(storage, 'dark')
    expect(loadTheme(storage)).toBe('dark')
  })

  it('system은 OS 설정을 따름', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('dark면 html에 dark class와 color-scheme을 둠', () => {
    const root = document.createElement('html')
    applyTheme(root, 'dark')
    expect(root.classList.contains('dark')).toBe(true)
    expect(root.style.colorScheme).toBe('dark')
    applyTheme(root, 'light')
    expect(root.classList.contains('dark')).toBe(false)
  })
})

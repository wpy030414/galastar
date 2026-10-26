import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { Locale } from '@/lib/types'

/**
 * IDE 自身的偏好（不是作品设置）：主题与界面语言。
 * 存在 localStorage，同步作用于 <html>：主题走 class，语言走 lang。
 */

export type ThemeMode = 'dark' | 'light'
export type { Locale }

export interface Prefs {
  theme: ThemeMode
  locale: Locale
}

const STORAGE_KEY = 'galastar.prefs'

/** 首次启动跟随浏览器语言：中文（含 zh-TW/HK 等）落简体，其余落英文 */
function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'zh-CN'
  return /^zh\b/i.test(navigator.language || '') ? 'zh-CN' : 'en'
}

export function readPrefs(): Prefs {
  const fallback: Prefs = { theme: 'dark', locale: detectLocale() }
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      locale: parsed.locale === 'en' || parsed.locale === 'zh-CN' ? parsed.locale : fallback.locale,
    }
  } catch {
    return fallback
  }
}

/** 把偏好落到 DOM 上。main.tsx 在首帧前也会调用一次，避免亮/暗闪一下 */
export function applyPrefs(prefs: Prefs) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', prefs.theme === 'dark')
  root.classList.toggle('light', prefs.theme === 'light')
  // 让原生控件（滚动条、日期选择器、autofill）跟着主题走
  root.style.colorScheme = prefs.theme
  root.lang = prefs.locale
}

interface PrefsContextValue {
  prefs: Prefs
  setTheme: (theme: ThemeMode) => void
  setLocale: (locale: Locale) => void
}

const PrefsContext = createContext<PrefsContextValue | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs)

  useEffect(() => {
    applyPrefs(prefs)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      /* 无痕模式或配额溢出：只在本次会话生效 */
    }
  }, [prefs])

  const setTheme = useCallback((theme: ThemeMode) => setPrefs((p) => ({ ...p, theme })), [])
  const setLocale = useCallback((locale: Locale) => setPrefs((p) => ({ ...p, locale })), [])

  const value = useMemo(() => ({ prefs, setTheme, setLocale }), [prefs, setTheme, setLocale])

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider')
  return ctx
}

import { useMemo } from 'react'
import { usePrefs, type Locale } from '@/store/prefs'
import { translate, type MessageKey } from './dict'

export type { Message, MessageKey } from './dict'
export { translate } from './dict'

export interface I18n {
  /** 取一条文案；键不存在时原样返回键名，方便一眼看出漏翻 */
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  locale: Locale
}

export function useI18n(): I18n {
  const { prefs } = usePrefs()
  const { locale } = prefs
  return useMemo(
    () => ({
      locale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale],
  )
}

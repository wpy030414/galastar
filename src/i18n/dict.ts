import type { Locale } from '@/store/prefs'
import type { Message } from './types'
import { commonZh, commonEn } from './messages/common'
import { editorZh, editorEn } from './messages/editor'
import { libraryZh, libraryEn } from './messages/library'
import { settingsZh, settingsEn } from './messages/settings'
import { appZh, appEn } from './messages/app'

export type { Message } from './types'

/**
 * 界面文案词典。中文是唯一的事实来源：en 的类型是 Record<MessageKey, …>，
 * 少一条就编译不过，不必等到界面上露出半句中文才发现。
 *
 * 这里只有纯数据，不依赖 React —— 打包、生成 README 这类非组件代码也能用。
 */
export const zh = {
  ...commonZh,
  ...editorZh,
  ...libraryZh,
  ...settingsZh,
  ...appZh,
}

export type MessageKey = keyof typeof zh

export const en: Record<MessageKey, Message> = {
  ...commonEn,
  ...editorEn,
  ...libraryEn,
  ...settingsEn,
  ...appEn,
}

const DICTS: Record<Locale, Record<MessageKey, Message>> = { 'zh-CN': zh, en }

const PLACEHOLDER = /\{(\w+)\}/g

function fill(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(PLACEHOLDER, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

function pick(message: Message, vars?: Record<string, string | number>): string {
  if (typeof message === 'string') return fill(message, vars)
  // 只有数字走复数；中文两边文案一致
  return fill(vars?.n === 1 ? message.one : message.other, vars)
}

/** 取一条文案；键不存在时原样返回键名，方便一眼看出漏翻 */
export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const dict = DICTS[locale] ?? zh
  const message = dict[key] != null ? dict[key] : zh[key]
  return message != null ? pick(message, vars) : key
}

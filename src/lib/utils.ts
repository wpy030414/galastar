import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 短 id，足够在一个作品内保持唯一，也方便肉眼比对 */
export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 8)
  const time = Date.now().toString(36).slice(-4)
  return `${prefix}${prefix ? '_' : ''}${time}${rand}`
}

export function formatDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 相对时间的「数值」，文案交给调用方翻译：
 * 逻辑在 lib 里，语言在 i18n 里，两边都不必知道对方。
 */
export type TimeAgo =
  | { unit: 'now' }
  | { unit: 'minute' | 'hour' | 'day'; n: number }
  | { unit: 'date' }

export function timeAgo(ts: number): TimeAgo {
  const diff = Date.now() - ts
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return { unit: 'now' }
  if (diff < hour) return { unit: 'minute', n: Math.floor(diff / minute) }
  if (diff < day) return { unit: 'hour', n: Math.floor(diff / hour) }
  if (diff < day * 7) return { unit: 'day', n: Math.floor(diff / day) }
  return { unit: 'date' }
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function truncate(text: string, max = 60): string {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** 把任意标题变成安全的文件名 */
export function safeFileName(name: string, fallback = 'galastar'): string {
  const cleaned = (name || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 60)
  return cleaned || fallback
}

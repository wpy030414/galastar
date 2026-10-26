/**
 * 与运行环境无关的小工具。
 *
 * 这里只放「浏览器、Node、测试」都能原样运行的纯函数：
 * 不 import DOM 类型、不碰 React、不读全局状态。
 * CLI 的导入链会经过本文件，任何 UI 依赖都会把播放器无关的东西拖进终端。
 */

/** 短 id，足够在一个作品内保持唯一，也方便肉眼比对 */
export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 8)
  const time = Date.now().toString(36).slice(-4)
  return `${prefix}${prefix ? '_' : ''}${time}${rand}`
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

/**
 * 只认 http(s)：远程素材允许填链接，但不允许 javascript: / data: 之类
 * 会被写进 <img src> 或 CSS url() 的协议。
 */
export function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim())
}

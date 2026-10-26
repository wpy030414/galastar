/**
 * 素材文件名规则：浏览器导入与 CLI `asset add` 共用一套，
 * 否则同一张图经两条路径会得到两个名字，工程包就再也对不上。
 *
 * 纯字符串逻辑，不依赖 File / DOM。
 */
import type { AssetKind } from './types'

/** fileName 的前缀，让人一眼看出这是什么素材 */
export const ASSET_PREFIX: Record<AssetKind, string> = {
  background: 'bg',
  sprite: 'sprite',
  bgm: 'bgm',
  sfx: 'sfx',
  voice: 'voice',
}

/** 常见素材扩展名 → MIME。浏览器导入、CLI、远程链接共用一张表 */
const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
}

export function mimeForFileName(name: string): string {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

/** 扩展名优先取文件名（最多 5 个字符），否则退回 MIME 子类型 */
export function extensionOf(name: string, mime = ''): string {
  const fromName = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  if (fromName && fromName.length <= 5) return fromName
  const sub = mime.split('/')[1] || 'bin'
  return sub.replace('+xml', '').replace('mpeg', 'mp3')
}

/** 去掉扩展名与非法字符，保留中文；过长截断，空则 asset */
export function slug(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  const cleaned = base
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^\w一-龥-]/g, '')
    .slice(0, 32)
  return cleaned || 'asset'
}

/** 生成作品内唯一的文件名：`<前缀>-<slugar>.<ext>`，重名依次加 `-2`、`-3` */
export function makeAssetFileName(
  kind: AssetKind,
  originalName: string,
  mime: string,
  existing: Iterable<string>,
): string {
  const prefix = ASSET_PREFIX[kind]
  const rawSlug = slug(originalName)
  const baseName = rawSlug.startsWith(`${prefix}-`) ? rawSlug : `${prefix}-${rawSlug}`
  const ext = extensionOf(originalName, mime)
  const taken = new Set(existing)
  let fileName = `${baseName}.${ext}`
  let n = 2
  while (taken.has(fileName)) {
    fileName = `${baseName}-${n++}.${ext}`
  }
  return fileName
}

/** 从链接里取文件名（已解码）；取不到返回空串 */
export function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const last = pathname.split('/').filter(Boolean).pop() || ''
    return decodeURIComponent(last)
  } catch {
    return ''
  }
}

/** 给远程素材生成安全的 fileName：链接没带文件名时用 `<前缀>-remote` */
export function makeRemoteFileName(
  kind: AssetKind,
  url: string,
  existing: Iterable<string>,
): string {
  const base = fileNameFromUrl(url) || `${ASSET_PREFIX[kind]}-remote`
  return makeAssetFileName(kind, base, mimeForFileName(base), existing)
}

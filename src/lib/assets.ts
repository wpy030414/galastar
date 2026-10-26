import type { AssetKind, AssetRecord } from './types'
import { getBlob, putBlob } from './db'
import { uid } from './utils'

export const ASSET_META: Record<
  AssetKind,
  { label: string; prefix: string; accept: string; hint: string }
> = {
  background: {
    label: '背景',
    prefix: 'bg',
    accept: 'image/*',
    hint: '建议 16:9，导出时按原尺寸打包',
  },
  sprite: { label: '立绘', prefix: 'sprite', accept: 'image/*', hint: '建议透明底 PNG，全身像' },
  bgm: { label: '音乐', prefix: 'bgm', accept: 'audio/*', hint: 'MP3 / OGG / M4A，可循环' },
  sfx: { label: '音效', prefix: 'sfx', accept: 'audio/*', hint: '短促的一次性音效' },
  voice: { label: '语音', prefix: 'voice', accept: 'audio/*', hint: '单句角色语音' },
}

export const ASSET_KINDS: AssetKind[] = ['background', 'sprite', 'bgm', 'voice', 'sfx']

function extensionOf(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
  if (fromName && fromName.length <= 5) return fromName
  const mime = file.type.split('/')[1] || 'bin'
  return mime.replace('+xml', '').replace('mpeg', 'mp3')
}

function slug(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  const cleaned = base
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .slice(0, 32)
  return cleaned || 'asset'
}

async function imageSize(blob: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(blob)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return null
  }
}

/** 把一个 File 变成作品资产：写 Blob 进 IndexedDB，返回元信息 */
export async function importAssetFile(
  projectId: string,
  file: File,
  kind: AssetKind,
  existing: AssetRecord[],
  forcedId?: string,
): Promise<AssetRecord> {
  const id = forcedId ?? uid('a')
  const ext = extensionOf(file)
  const prefix = ASSET_META[kind].prefix
  const rawSlug = slug(file.name)
  const baseName = rawSlug.startsWith(`${prefix}-`) ? rawSlug : `${prefix}-${rawSlug}`
  let fileName = `${baseName}.${ext}`
  let n = 2
  while (existing.some((a) => a.fileName === fileName)) {
    fileName = `${baseName}-${n++}.${ext}`
  }
  const size = kind === 'background' || kind === 'sprite' ? await imageSize(file) : null
  const record: AssetRecord = {
    id,
    kind,
    name: file.name,
    fileName,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    width: size?.width,
    height: size?.height,
    createdAt: Date.now(),
  }
  await putBlob(projectId, id, file)
  return record
}

/** 读取作品全部资产的 objectURL；调用方负责在切换作品时 revoke */
export async function loadAssetUrls(
  projectId: string,
  assets: AssetRecord[],
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    assets.map(async (asset) => {
      const blob = await getBlob(projectId, asset.id)
      return [asset.id, blob ? URL.createObjectURL(blob) : ''] as const
    }),
  )
  return Object.fromEntries(entries.filter(([, url]) => url))
}

export function revokeAssetUrls(urls: Record<string, string>) {
  Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
}

export function kindOfFile(file: File): AssetKind {
  if (file.type.startsWith('image/')) return 'sprite'
  if (file.type.startsWith('audio/')) return 'bgm'
  return 'sfx'
}

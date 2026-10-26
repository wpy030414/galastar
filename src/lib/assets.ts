import type { MessageKey } from '@/i18n'
import type { AssetKind, AssetRecord } from './types'
import {
  fileNameFromUrl,
  makeAssetFileName,
  makeRemoteFileName,
  mimeForFileName,
} from './asset-names'
import { getBlob, putBlob } from './db'
import { isHttpUrl, uid } from './pure'

/** 素材类型的展示名走 i18n 词典，这里只存键名，避免把中文钉死在数据层 */
export const ASSET_META: Record<
  AssetKind,
  { labelKey: MessageKey; accept: string; hintKey: MessageKey }
> = {
  background: {
    labelKey: 'asset.background',
    accept: 'image/*',
    hintKey: 'asset.background.hint',
  },
  sprite: {
    labelKey: 'asset.sprite',
    accept: 'image/*',
    hintKey: 'asset.sprite.hint',
  },
  bgm: {
    labelKey: 'asset.bgm',
    accept: 'audio/*',
    hintKey: 'asset.bgm.hint',
  },
  sfx: {
    labelKey: 'asset.sfx',
    accept: 'audio/*',
    hintKey: 'asset.sfx.hint',
  },
  voice: {
    labelKey: 'asset.voice',
    accept: 'audio/*',
    hintKey: 'asset.voice.hint',
  },
}

export const ASSET_KINDS: AssetKind[] = ['background', 'sprite', 'bgm', 'voice', 'sfx']

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
  const fileName = makeAssetFileName(
    kind,
    file.name,
    file.type,
    existing.map((asset) => asset.fileName),
  )
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

/** 登记一个远程素材：不写 IndexedDB，只把 http(s) 链接存进工程 */
export function importRemoteAsset(
  kind: AssetKind,
  url: string,
  existing: AssetRecord[],
  name?: string,
): AssetRecord {
  const trimmed = url.trim()
  if (!isHttpUrl(trimmed)) throw new Error('远程素材必须是 http(s) 链接')
  const urlName = fileNameFromUrl(trimmed)
  const displayName = name?.trim() || urlName || `${kind}-remote`
  return {
    id: uid('a'),
    kind,
    name: displayName,
    fileName: makeRemoteFileName(
      kind,
      trimmed,
      existing.map((asset) => asset.fileName),
    ),
    mime: mimeForFileName(urlName || displayName),
    size: 0,
    url: trimmed,
    createdAt: Date.now(),
  }
}

/** 读取作品全部资产的可用地址：远程素材直接用链接，本地的用 objectURL */
export async function loadAssetUrls(
  projectId: string,
  assets: AssetRecord[],
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    assets.map(async (asset) => {
      if (isHttpUrl(asset.url)) return [asset.id, asset.url.trim()] as const
      const blob = await getBlob(projectId, asset.id)
      return [asset.id, blob ? URL.createObjectURL(blob) : ''] as const
    }),
  )
  return Object.fromEntries(entries.filter(([, url]) => url))
}

export function revokeAssetUrls(urls: Record<string, string>) {
  Object.values(urls).forEach((url) => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  })
}

export function kindOfFile(file: File): AssetKind {
  if (file.type.startsWith('image/')) return 'sprite'
  if (file.type.startsWith('audio/')) return 'bgm'
  return 'sfx'
}

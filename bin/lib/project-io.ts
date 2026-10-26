/**
 * 工程读写：CLI 的「文件系统适配层」。
 *
 * 浏览器把工程存在 IndexedDB，素材是 blob；终端里对应的是
 * `<dir>/project.json` + `<dir>/assets/<fileName>`，或一个 .galastar 工程包。
 * 这里只做这两件事，不碰打包逻辑。
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import type { AssetRecord, Project } from '@/lib/types'
import { isHttpUrl } from '@/lib/pure'
import { CliError } from './output'

export interface InputSource {
  kind: 'dir' | 'json' | 'archive'
  /** 工程目录；archive/json 时是文件所在目录 */
  root: string
  /** 工程文件路径；archive 时是压缩包路径 */
  file: string
  raw: unknown
  zip?: JSZip
}

const ARCHIVE_EXT = /\.(galastar|zip)$/i

function parseJson(text: string, file: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new CliError('E_BAD_JSON', `project.json 不是合法 JSON：${file}`, {
      exitCode: 2,
      hint: error instanceof Error ? error.message : undefined,
      path: file,
    })
  }
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function resolveInput(input?: string): Promise<InputSource> {
  const target = path.resolve(input || '.')
  if (!existsSync(target)) {
    throw new CliError('E_NOT_FOUND', `路径不存在：${target}`, { exitCode: 2, path: target })
  }
  const stat = statSync(target)

  if (stat.isDirectory()) {
    const file = path.join(target, 'project.json')
    if (!existsSync(file)) {
      throw new CliError('E_NO_PROJECT', '目录里没有 project.json', {
        exitCode: 2,
        path: target,
        hint: '用 galastar init 新建工程，或把目录指到工程根目录',
      })
    }
    return { kind: 'dir', root: target, file, raw: parseJson(readFileSync(file, 'utf8'), file) }
  }

  if (ARCHIVE_EXT.test(target)) {
    const zip = await JSZip.loadAsync(readFileSync(target))
    const entry = zip.file('project.json') || zip.file(/project\.json$/)[0]
    if (!entry) {
      throw new CliError('E_NO_PROJECT', '压缩包里没有 project.json', {
        exitCode: 2,
        path: target,
        hint: '这可能不是 Galastar 工程包',
      })
    }
    return {
      kind: 'archive',
      root: path.dirname(target),
      file: target,
      raw: parseJson(await entry.async('text'), target),
      zip,
    }
  }

  if (target.toLowerCase().endsWith('.json')) {
    return {
      kind: 'json',
      root: path.dirname(target),
      file: target,
      raw: parseJson(readFileSync(target, 'utf8'), target),
    }
  }

  throw new CliError('E_BAD_INPUT', `无法识别输入：${target}`, {
    exitCode: 2,
    hint: '给一个工程目录、project.json，或 .galastar 工程包',
  })
}

/** 素材目录：默认 <工程目录>/assets，可用 --assets-dir 覆盖 */
export function assetsDirOf(source: InputSource, explicit?: string): string {
  if (source.kind === 'archive') {
    throw new CliError('E_USAGE', '工程包输入没有素材目录', { exitCode: 2 })
  }
  return path.resolve(explicit || path.join(source.root, 'assets'))
}

/** assets/ 与 media/ 都算数：后者是 GUI 可玩包的布局，导入时也兼容 */
export function listAssetFileNames(source: InputSource, assetsDir: string): Set<string> {
  const names = new Set<string>()
  if (source.kind === 'archive') {
    source.zip?.forEach((zipPath) => {
      if (!/\.(png|jpe?g|webp|gif|svg|mp3|ogg|m4a|wav|flac)$/i.test(zipPath)) return
      names.add(path.posix.basename(zipPath))
    })
    return names
  }
  for (const dir of [assetsDir, path.join(source.root, 'media'), source.root]) {
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile()) names.add(entry.name)
    }
  }
  return names
}

function findAssetInDir(dirs: string[], fileName: string): string | null {
  for (const dir of dirs) {
    const candidate = path.join(dir, fileName)
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

export interface LoadedAssets {
  assets: Map<string, Uint8Array>
  missing: string[]
}

export async function loadAssets(
  source: InputSource,
  project: Project,
  assetsDir: string,
): Promise<LoadedAssets> {
  const assets = new Map<string, Uint8Array>()
  const missing: string[] = []

  if (source.kind === 'archive' && source.zip) {
    const zip = source.zip
    for (const asset of project.assets) {
      if (isHttpUrl(asset.url)) continue
      const entry =
        zip.file(`assets/${asset.fileName}`) ||
        zip.file(`media/${asset.fileName}`) ||
        zip.file(asset.fileName) ||
        zip.file(new RegExp(`(^|/)${escapeRegExp(asset.fileName)}$`))[0]
      if (!entry) {
        missing.push(asset.fileName)
        continue
      }
      assets.set(asset.id, await entry.async('uint8array'))
    }
    return { assets, missing }
  }

  const dirs = [assetsDir, path.join(source.root, 'media'), source.root]
  for (const asset of project.assets) {
    /* 远程素材没有本地字节，不算缺失 */
    if (isHttpUrl(asset.url)) continue
    const found = findAssetInDir(dirs, asset.fileName)
    if (!found) {
      missing.push(asset.fileName)
      continue
    }
    assets.set(asset.id, readFileSync(found))
  }
  return { assets, missing }
}

export function writeProjectJson(file: string, project: unknown) {
  writeFileAtomic(file, `${JSON.stringify(project, null, 2)}\n`)
}

/** 同步小睡：Windows 上杀毒/索引器会短暂占用目标文件，自旋会白烧 CPU */
function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** 原子写：先写同目录临时文件再 rename；Windows 覆盖失败时重试 */
export function writeFileAtomic(dest: string, data: Uint8Array | string) {
  mkdirSync(path.dirname(dest), { recursive: true })
  const tmp = `${dest}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`
  writeFileSync(tmp, data)
  let lastError: unknown = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      renameSync(tmp, dest)
      return
    } catch (error) {
      lastError = error
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') break
      sleepSync(20 * (attempt + 1))
    }
  }
  try {
    writeFileSync(dest, data)
    rmSync(tmp, { force: true })
  } catch {
    rmSync(tmp, { force: true })
    throw lastError instanceof Error
      ? lastError
      : new CliError('E_WRITE_FAILED', `写入失败：${dest}`, { path: dest })
  }
}

export function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

export function assetFilePath(assetsDir: string, fileName: string): string {
  return path.join(assetsDir, fileName)
}

export function ensureAssetsDir(dir: string) {
  mkdirSync(dir, { recursive: true })
}

/** 素材 id 用内容哈希，重复添加同一个文件天然幂等 */
export function assetIdFor(sha: string, existingIds: Set<string>): string {
  const base = `a_${sha.slice(0, 8)}`
  if (!existingIds.has(base)) return base
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}_${n}`
    if (!existingIds.has(candidate)) return candidate
  }
  return `${base}_${Date.now().toString(36)}`
}

export function kindFromMime(mime: string): AssetRecord['kind'] {
  if (mime.startsWith('image/')) return 'sprite'
  if (mime.startsWith('audio/')) return 'bgm'
  return 'sfx'
}

import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 仓库根目录。全局 link 之后 cwd 是用户目录，所有内置资源都必须从这里推导 */
export const REPO_ROOT: string = fileURLToPath(new URL('../../', import.meta.url))

export const SRC_DIR = `${REPO_ROOT}src`
export const ENGINE_DIR = `${REPO_ROOT}public/engine`
export const TEMPLATE_DIR = `${REPO_ROOT}bin/templates`

/** 展开开头的 ~：Node 的 path 不认它，而作者很自然会写 ~/Documents */
export function expandHome(input: string): string {
  const value = input.trim()
  if (value === '~') return os.homedir()
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(2))
  }
  return value
}

/**
 * 新作品默认落在这里：~/Documents/GalastarWorks/<proj_name>。
 * --workspace > GALASTAR_WORKSPACE > 默认位置。
 */
export function resolveWorkspaceRoot(explicit?: string): string {
  const raw = explicit || process.env['GALASTAR_WORKSPACE'] || '~/Documents/GalastarWorks'
  return path.resolve(expandHome(raw))
}

let cachedVersion: string | null = null

export function cliVersion(): string {
  if (cachedVersion) return cachedVersion
  try {
    const pkg = JSON.parse(readFileSync(`${REPO_ROOT}package.json`, 'utf8')) as { version?: string }
    cachedVersion = pkg.version || '0.0.0'
  } catch {
    cachedVersion = '0.0.0'
  }
  return cachedVersion
}

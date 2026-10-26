import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { EngineSource } from '@/lib/pack-core'
import { ENGINE_DIR } from './paths'
import { CliError } from './output'

export interface Engine {
  dir: string
  version: string
  source: EngineSource
}

/** --engine > GALASTAR_ENGINE_DIR > 仓库 public/engine */
export function resolveEngineDir(explicit?: string): string {
  const dir = explicit || process.env.GALASTAR_ENGINE_DIR || ENGINE_DIR
  return path.resolve(dir)
}

export function loadEngine(dir: string): Engine {
  const js = path.join(dir, 'runtime.js')
  const css = path.join(dir, 'runtime.css')
  for (const file of [js, css]) {
    if (!existsSync(file)) {
      throw new CliError('E_ENGINE_MISSING', `播放器文件不存在：${file}`, {
        exitCode: 2,
        path: file,
        hint: '用 --engine 指向包含 runtime.js / runtime.css 的目录',
      })
    }
  }
  const runtimeJs = readFileSync(js, 'utf8')
  const match = /VERSION\s*=\s*['"]([^'"]+)['"]/.exec(runtimeJs)
  return {
    dir,
    version: match ? match[1]! : 'unknown',
    source: { runtimeJs, runtimeCss: readFileSync(css, 'utf8') },
  }
}

import JSZip from 'jszip'
import type { Locale, Project } from './types'
import { normalizeProject } from './project'
import { getProjectBlobs } from './db'
import { translate } from '@/i18n/dict'
import { archiveEntries, playableEntries, zipEntries } from './pack-core'

export { archiveFileName, zipFileName } from './pack-core'

const BASE = import.meta.env.BASE_URL

/** 打包阶段。文案在导出对话框里翻译，pack.ts 只报告进度走到了哪一步 */
export type PackStage = 'player' | 'assets' | 'zip' | 'done'
export type Progress = (stage: PackStage, ratio: number) => void

async function readEngineFile(name: string, locale: Locale): Promise<string> {
  const url = `${BASE}engine/${name}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(translate(locale, 'pack.error.playerFile', { url }))
  return res.text()
}

/**
 * 浏览器适配层：只负责取播放器源码、从 IndexedDB 取素材、把字节包回 Blob。
 * 产物结构由 pack-core 决定，与 CLI 共用同一份。
 */
export async function exportPlayableZip(project: Project, onProgress?: Progress): Promise<Blob> {
  onProgress?.('player', 0.05)
  const [runtimeJs, runtimeCss] = await Promise.all([
    readEngineFile('runtime.js', project.meta.locale),
    readEngineFile('runtime.css', project.meta.locale),
  ])

  onProgress?.('assets', 0.15)
  const blobs = await getProjectBlobs(project.meta.id)
  const { entries, missing } = playableEntries({
    project,
    engine: { runtimeJs, runtimeCss },
    assets: blobs,
    allowMissing: true,
  })
  if (missing.length > 0) {
    console.warn(`[Galastar] skipped ${missing.length} asset(s) with no binary data`)
  }

  onProgress?.('zip', 0.55)
  const buffer = await zipEntries(entries, {
    onProgress: (ratio) => onProgress?.('zip', 0.55 + ratio * 0.45),
  })
  onProgress?.('done', 1)
  return new Blob([buffer], { type: 'application/zip' })
}

/** 导出可再编辑的工程包（含全部素材），用于备份与跨设备迁移 */
export async function exportProjectArchive(project: Project, onProgress?: Progress): Promise<Blob> {
  onProgress?.('assets', 0.2)
  const blobs = await getProjectBlobs(project.meta.id)
  const { entries, missing } = archiveEntries({ project, assets: blobs, allowMissing: true })
  if (missing.length > 0) {
    console.warn(`[Galastar] skipped ${missing.length} asset(s) with no binary data`)
  }

  onProgress?.('zip', 0.2)
  const buffer = await zipEntries(entries, {
    onProgress: (ratio) => onProgress?.('zip', 0.2 + ratio * 0.8),
  })
  onProgress?.('done', 1)
  return new Blob([buffer], { type: 'application/zip' })
}

export interface ImportResult {
  project: Project
  files: Array<{ assetId: string; blob: Blob }>
}

/** 导入 .galastar 工程包，或一个只含 project.json 的裸 JSON */
export async function importProjectFile(
  file: File,
  locale: Locale = 'zh-CN',
): Promise<ImportResult> {
  const isJson = file.name.toLowerCase().endsWith('.json')
  if (isJson) {
    const text = await file.text()
    const project = normalizeProject(JSON.parse(text), locale)
    return { project, files: [] }
  }

  const zip = await JSZip.loadAsync(file)
  const projectEntry = zip.file('project.json') || zip.file(/project\.json$/)[0]
  if (!projectEntry) throw new Error(translate(locale, 'pack.error.noProject'))
  const project = normalizeProject(JSON.parse(await projectEntry.async('text')), locale)

  const files: Array<{ assetId: string; blob: Blob }> = []
  await Promise.all(
    project.assets.map(async (asset) => {
      const candidates = [
        zip.file(`assets/${asset.fileName}`),
        zip.file(`media/${asset.fileName}`),
        zip.file(asset.fileName),
        zip.file(new RegExp(`(^|/)${asset.fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))[0],
      ]
      const entry = candidates.find(Boolean)
      if (!entry) return
      const blob = await entry.async('blob')
      files.push({ assetId: asset.id, blob })
    }),
  )
  return { project, files }
}

import JSZip from 'jszip'
import type { Project } from './types'
import { buildPayload, normalizeProject } from './project'
import { getProjectBlobs } from './db'
import { safeFileName } from './utils'

const BASE = import.meta.env.BASE_URL

export type Progress = (message: string, ratio: number) => void

async function readEngineFile(name: string): Promise<string> {
  const url = `${BASE}engine/${name}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`无法读取播放器文件：${url}`)
  return res.text()
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  )
}

function startHtml(project: Project): string {
  const title = escapeHtml(project.meta.name || 'Galastar 作品')
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${title}</title>
    <link rel="stylesheet" href="./galastar.css" />
    <style>
      html, body { margin: 0; height: 100%; background: #05050a; overflow: hidden; }
      #galastar-root { position: fixed; inset: 0; }
    </style>
  </head>
  <body>
    <div id="galastar-root"></div>
    <script src="./data.js"></script>
    <script src="./galastar.js"></script>
    <script>
      window.addEventListener('load', function () {
        if (!window.GALASTAR_DATA) return
        window.Galastar.boot(window.GALASTAR_DATA, { root: document.getElementById('galastar-root') })
      })
    </script>
  </body>
</html>
`
}

function readme(project: Project): string {
  return `${project.meta.name || '未命名作品'}
${'='.repeat((project.meta.name || '未命名作品').length * 2)}

作者：${project.meta.author || '未知'}
版本：${project.meta.version || '1.0.0'}
打包时间：${new Date().toLocaleString('zh-CN')}

怎么玩
------
1. 把整个文件夹解压出来（不要只拿走 start.html，素材在同级的 media 目录里）。
2. 双击 start.html，用浏览器打开即可开始，全程离线，无需联网。
3. 推荐 Chrome / Edge / Firefox / Safari 桌面版；手机浏览器同样可以打开。

操作
----
点击画面 / 空格 / 回车 …… 继续
Ctrl（按住） …… 快进
A …… 自动播放
L …… 回看已读台词
S …… 存档 / 读档
F …… 全屏（设置面板里也有这个按钮）
Esc …… 设置

本作品由 Galastar 制作并打包。
`
}

/**
 * 打包成可直接游玩的 Web Zip。
 * 结构：start.html / galastar.js / galastar.css / data.js / media/*
 * 所有引用都是相对路径，且数据以 script 注入而不是 fetch，
 * 因此 file:// 双击打开也能正常工作。
 */
export async function exportPlayableZip(project: Project, onProgress?: Progress): Promise<Blob> {
  onProgress?.('读取播放器', 0.05)
  const [runtime, css] = await Promise.all([
    readEngineFile('runtime.js'),
    readEngineFile('runtime.css'),
  ])

  onProgress?.('收集素材', 0.15)
  const blobs = await getProjectBlobs(project.meta.id)
  const payload = buildPayload(project, (assetId) => {
    const asset = project.assets.find((a) => a.id === assetId)
    return asset ? `media/${asset.fileName}` : ''
  })

  const zip = new JSZip()
  zip.file('start.html', startHtml(project))
  zip.file('galastar.js', runtime)
  zip.file('galastar.css', css)
  zip.file(
    'data.js',
    `window.GALASTAR_DATA = ${JSON.stringify(payload).replace(/<\//g, '<\\/')};\n`,
  )
  zip.file('README.txt', readme(project))

  const media = zip.folder('media')!
  let missing = 0
  project.assets.forEach((asset) => {
    const blob = blobs.get(asset.id)
    if (!blob) {
      missing += 1
      return
    }
    media.file(asset.fileName, blob)
  })
  if (missing > 0) console.warn(`[Galastar] ${missing} 个素材缺少二进制数据，已跳过`)

  onProgress?.('压缩打包', 0.55)
  const out = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => {
      onProgress?.('压缩打包', 0.55 + (meta.percent / 100) * 0.45)
    },
  )
  onProgress?.('完成', 1)
  return out
}

/** 导出可再编辑的工程包（含全部素材），用于备份与跨设备迁移 */
export async function exportProjectArchive(project: Project, onProgress?: Progress): Promise<Blob> {
  onProgress?.('收集素材', 0.2)
  const blobs = await getProjectBlobs(project.meta.id)
  const zip = new JSZip()
  zip.file('project.json', JSON.stringify(project, null, 2))
  zip.file(
    'README.txt',
    `Galastar 工程包\n\n作品：${project.meta.name}\n\n在 Galastar 编辑器首页点击「导入工程」即可继续编辑。\n`,
  )
  const media = zip.folder('assets')!
  let missing = 0
  project.assets.forEach((asset) => {
    const blob = blobs.get(asset.id)
    if (!blob) {
      missing += 1
      return
    }
    media.file(asset.fileName, blob)
  })
  if (missing > 0) console.warn(`[Galastar] ${missing} 个素材缺少二进制数据，已跳过`)
  const out = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => {
      onProgress?.('压缩打包', 0.2 + (meta.percent / 100) * 0.8)
    },
  )
  onProgress?.('完成', 1)
  return out
}

export interface ImportResult {
  project: Project
  files: Array<{ assetId: string; blob: Blob }>
}

/** 导入 .galastar 工程包，或一个只含 project.json 的裸 JSON */
export async function importProjectFile(file: File): Promise<ImportResult> {
  const isJson = file.name.toLowerCase().endsWith('.json')
  if (isJson) {
    const text = await file.text()
    const project = normalizeProject(JSON.parse(text))
    return { project, files: [] }
  }

  const zip = await JSZip.loadAsync(file)
  const projectEntry = zip.file('project.json') || zip.file(/project\.json$/)[0]
  if (!projectEntry) throw new Error('压缩包里没有 project.json，可能不是 Galastar 工程包')
  const project = normalizeProject(JSON.parse(await projectEntry.async('text')))

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

export function zipFileName(project: Project): string {
  return `${safeFileName(project.meta.name)}-web.zip`
}

export function archiveFileName(project: Project): string {
  return `${safeFileName(project.meta.name)}.galastar`
}

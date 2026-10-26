import JSZip from 'jszip'
import type { Locale, Project } from './types'
import { buildPayload, normalizeProject } from './project'
import { getProjectBlobs } from './db'
import { translate } from '@/i18n/dict'
import { safeFileName } from './utils'

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

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  )
}

function startHtml(project: Project): string {
  const title = escapeHtml(project.meta.name || 'Galastar')
  return `<!doctype html>
<html lang="${project.meta.locale}">
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

/**
 * 给玩家看的说明，跟随作品语言而不是编辑器语言 ——
 * 作者用中文编辑器，也可以发布面向英文玩家的作品。
 */
function readme(project: Project): string {
  const locale = project.meta.locale
  const name = project.meta.name || translate(locale, 'common.untitledWork')
  const date = new Date().toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN')
  const meta =
    locale === 'en'
      ? `Author: ${project.meta.author || 'Unknown'}\nVersion: ${project.meta.version || '1.0.0'}\nPackaged: ${date}`
      : `作者：${project.meta.author || '未知'}\n版本：${project.meta.version || '1.0.0'}\n打包时间：${date}`
  const body =
    locale === 'en'
      ? `How to play
-----------
1. Unzip the whole folder — don't take start.html alone; assets live in the sibling media/ folder.
2. Double-click start.html to open it in a browser. Fully offline, no network needed.
3. Chrome / Edge / Firefox / Safari on desktop are recommended; mobile browsers work too.

Controls
--------
Click / Space / Enter …… continue
Hold Ctrl …… skip
A …… auto-play
L …… backlog
S …… save / load
F …… fullscreen (also in the settings panel)
Esc …… settings

Made and packaged with Galastar.`
      : `怎么玩
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

本作品由 Galastar 制作并打包。`

  return `${name}
${'='.repeat(name.length * 2)}

${meta}

${body}
`
}

/**
 * 打包成可直接游玩的 Web Zip。
 * 结构：start.html / galastar.js / galastar.css / data.js / media/*
 * 所有引用都是相对路径，且数据以 script 注入而不是 fetch，
 * 因此 file:// 双击打开也能正常工作。
 */
export async function exportPlayableZip(project: Project, onProgress?: Progress): Promise<Blob> {
  onProgress?.('player', 0.05)
  const [runtime, css] = await Promise.all([
    readEngineFile('runtime.js', project.meta.locale),
    readEngineFile('runtime.css', project.meta.locale),
  ])

  onProgress?.('assets', 0.15)
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
  if (missing > 0) console.warn(`[Galastar] skipped ${missing} asset(s) with no binary data`)

  onProgress?.('zip', 0.55)
  const out = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => {
      onProgress?.('zip', 0.55 + (meta.percent / 100) * 0.45)
    },
  )
  onProgress?.('done', 1)
  return out
}

/** 导出可再编辑的工程包（含全部素材），用于备份与跨设备迁移 */
export async function exportProjectArchive(project: Project, onProgress?: Progress): Promise<Blob> {
  onProgress?.('assets', 0.2)
  const blobs = await getProjectBlobs(project.meta.id)
  const zip = new JSZip()
  zip.file('project.json', JSON.stringify(project, null, 2))
  zip.file(
    'README.txt',
    project.meta.locale === 'en'
      ? `Galastar project archive\n\nWork: ${project.meta.name}\n\nClick “Import project” on the Galastar library page to keep editing.\n`
      : `Galastar 工程包\n\n作品：${project.meta.name}\n\n在 Galastar 编辑器首页点击「导入工程」即可继续编辑。\n`,
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
  if (missing > 0) console.warn(`[Galastar] skipped ${missing} asset(s) with no binary data`)
  const out = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => {
      onProgress?.('zip', 0.2 + (meta.percent / 100) * 0.8)
    },
  )
  onProgress?.('done', 1)
  return out
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

export function zipFileName(project: Project): string {
  return `${safeFileName(project.meta.name)}-web.zip`
}

export function archiveFileName(project: Project): string {
  return `${safeFileName(project.meta.name)}.galastar`
}

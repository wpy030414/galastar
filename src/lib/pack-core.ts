/**
 * 打包核心：只认「工程 + 播放器源码 + 素材字节」，不认运行环境。
 *
 * 浏览器（src/lib/pack.ts）负责 fetch 播放器、从 IndexedDB 取 Blob；
 * CLI（bin/）负责读文件、读 zip。两边拿到的 ZipEntry 完全一致，
 * 所以「GUI 导出的包」与「终端打的包」在结构上不会分叉。
 *
 * 这里禁止出现：import.meta.env、fetch、indexedDB、React、node:fs。
 */
import JSZip from 'jszip'
import { translate } from '@/i18n/dict'
import { buildPayload } from './project'
import { isHttpUrl, safeFileName } from './pure'
import type { AssetRecord, Project } from './types'

/** 素材字节：浏览器直接给 Blob（零拷贝），Node 给 Uint8Array */
export type AssetData = Blob | Uint8Array

/** 播放器源码。运行时是 classic script，只需按字节复制，不在 Node 里执行 */
export interface EngineSource {
  runtimeJs: string
  runtimeCss: string
}

export interface ZipEntry {
  path: string
  data: string | AssetData
}

export interface EntriesResult {
  entries: ZipEntry[]
  /** 工程里声明了、但没有拿到字节的 fileName；调用方决定是报错还是告警 */
  missing: string[]
}

/** 可玩包与工程包的固定文件名，改这里等于改产物契约 */
export const PLAYABLE_LAYOUT = {
  start: 'start.html',
  runtimeJs: 'galastar.js',
  runtimeCss: 'galastar.css',
  data: 'data.js',
  readme: 'README.txt',
  mediaDir: 'media',
} as const

export const ARCHIVE_LAYOUT = {
  project: 'project.json',
  readme: 'README.txt',
  assetsDir: 'assets',
} as const

export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  )
}

export function renderStartHtml(project: Project): string {
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
 *
 * builtAt 由调用方注入：CLI 用它做可复现构建，浏览器默认取当前时间。
 */
export function renderReadme(project: Project, builtAt: Date = new Date()): string {
  const locale = project.meta.locale
  const name = project.meta.name || translate(locale, 'common.untitledWork')
  const date = builtAt.toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN')
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

/** 素材在播放器里的地址：远程链接原样用，本地素材走 media/ */
export function assetRuntimePath(asset: AssetRecord): string {
  return isHttpUrl(asset.url) ? asset.url.trim() : `${PLAYABLE_LAYOUT.mediaDir}/${asset.fileName}`
}

/** data.js：classic script 注入数据，file:// 下也能读 */
export function renderDataJs(project: Project): string {
  const payload = buildPayload(project, (assetId) => {
    const asset = project.assets.find((a) => a.id === assetId)
    return asset ? assetRuntimePath(asset) : ''
  })
  return `window.GALASTAR_DATA = ${JSON.stringify(payload).replace(/<\//g, '<\\/')};\n`
}

export function zipFileName(project: Project): string {
  return `${safeFileName(project.meta.name)}-web.zip`
}

export function archiveFileName(project: Project): string {
  return `${safeFileName(project.meta.name)}.galastar`
}

export interface PlayableInput {
  project: Project
  engine: EngineSource
  assets: Map<string, AssetData>
  /** 缺素材时：true 只记入 missing，false 直接抛错 */
  allowMissing?: boolean
  builtAt?: Date
}

/**
 * 可玩包条目：start.html / galastar.js / galastar.css / data.js / README.txt / media/*
 * 所有引用都是相对路径，且数据以 script 注入而不是 fetch，
 * 因此 file:// 双击打开也能正常工作。
 */
export function playableEntries(input: PlayableInput): EntriesResult {
  const { project, engine, assets, allowMissing = false, builtAt } = input
  const entries: ZipEntry[] = [
    { path: PLAYABLE_LAYOUT.start, data: renderStartHtml(project) },
    { path: PLAYABLE_LAYOUT.runtimeJs, data: engine.runtimeJs },
    { path: PLAYABLE_LAYOUT.runtimeCss, data: engine.runtimeCss },
    { path: PLAYABLE_LAYOUT.data, data: renderDataJs(project) },
    { path: PLAYABLE_LAYOUT.readme, data: renderReadme(project, builtAt) },
  ]
  const missing: string[] = []
  for (const asset of project.assets) {
    /* 远程素材不复制进 zip，data.js 里已经写了它的 URL */
    if (isHttpUrl(asset.url)) continue
    const data = assets.get(asset.id)
    if (!data) {
      missing.push(asset.fileName)
      continue
    }
    entries.push({ path: `${PLAYABLE_LAYOUT.mediaDir}/${asset.fileName}`, data })
  }
  if (missing.length && !allowMissing) {
    throw new Error(`缺少素材字节：${missing.join('、')}`)
  }
  return { entries, missing }
}

/** 工程包条目：project.json / README.txt / assets/*，供换设备继续编辑 */
export function archiveEntries(input: {
  project: Project
  assets: Map<string, AssetData>
  allowMissing?: boolean
}): EntriesResult {
  const { project, assets, allowMissing = false } = input
  const locale = project.meta.locale
  const readme =
    locale === 'en'
      ? `Galastar project archive\n\nWork: ${project.meta.name}\n\nClick “Import project” on the Galastar library page to keep editing.\n`
      : `Galastar 工程包\n\n作品：${project.meta.name}\n\n在 Galastar 编辑器首页点击「导入工程」即可继续编辑。\n`
  const entries: ZipEntry[] = [
    { path: ARCHIVE_LAYOUT.project, data: JSON.stringify(project, null, 2) },
    { path: ARCHIVE_LAYOUT.readme, data: readme },
  ]
  const missing: string[] = []
  for (const asset of project.assets) {
    /* 远程素材只在 project.json 里留 URL，不打包字节 */
    if (isHttpUrl(asset.url)) continue
    const data = assets.get(asset.id)
    if (!data) {
      missing.push(asset.fileName)
      continue
    }
    entries.push({ path: `${ARCHIVE_LAYOUT.assetsDir}/${asset.fileName}`, data })
  }
  if (missing.length && !allowMissing) {
    throw new Error(`缺少素材字节：${missing.join('、')}`)
  }
  return { entries, missing }
}

/**
 * 文本走 DEFLATE，媒体走 STORE —— PNG / JPEG / MP3 已经是压缩格式，
 * 再 deflate 只是一遍无谓的 CPU。所有条目共用同一个时间戳，便于复现构建。
 *
 * 返回 ArrayBuffer 而不是 Uint8Array：浏览器可以直接包成 Blob，
 * Node 可以包成 Buffer 写盘，两边都不必为 TS 的 ArrayBufferLike 泛型做转换。
 */
export async function zipEntries(
  entries: ZipEntry[],
  opts: { onProgress?: (ratio: number) => void; builtAt?: Date } = {},
): Promise<ArrayBuffer> {
  const zip = new JSZip()
  const date = opts.builtAt ?? new Date()
  for (const entry of entries) {
    const binary = typeof entry.data !== 'string'
    zip.file(entry.path, entry.data, {
      binary,
      date,
      compression: binary ? 'STORE' : 'DEFLATE',
      ...(binary ? {} : { compressionOptions: { level: 6 } }),
    })
  }
  return zip.generateAsync({ type: 'arraybuffer' }, (meta) => {
    opts.onProgress?.(meta.percent / 100)
  })
}

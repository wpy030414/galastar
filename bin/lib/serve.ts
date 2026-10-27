/**
 * 本地预览服务。只绑回环地址，只读工程目录里的文件。
 *
 * 除了静态文件，它还负责 `/__shot.html`：一个「定格在某一帧」的入口，
 * 让 headless 浏览器不必点击也能截到需要的画面。
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'

export interface ShotQuery {
  mode: 'title' | 'frame'
  sceneId: string
  index: number
}

export interface PreviewServer {
  url: string
  port: number
  root: string
  stats: { requests: number; notFound: number; notFoundPaths: string[] }
  close: () => Promise<void>
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.woff2': 'font/woff2',
}

function renderShotHtml(query: ShotQuery): string {
  const payload = JSON.stringify(query)
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Galastar shot</title>
    <link rel="stylesheet" href="/galastar.css" />
    <style>
      html, body { margin: 0; height: 100%; background: #05050a; overflow: hidden; }
      #galastar-root { position: fixed; inset: 0; }
    </style>
  </head>
  <body>
    <div id="galastar-root"></div>
    <script src="/data.js"></script>
    <script src="/galastar.js"></script>
    <script>
      (function () {
        var query = ${payload}
        var stage = window.Galastar.create(document.getElementById('galastar-root'), window.GALASTAR_DATA, { mode: 'play' })
        window.GALASTAR_STAGE = stage
        if (query.mode === 'title') stage.showTitle()
        else stage.showFrame(query.sceneId, query.index)

        function markReady() {
          document.documentElement.dataset.galastarReady = '1'
        }
        var ticks = 0
        /* 视频背景要等它出画，否则截到的是黑帧 */
        function waitMedia() {
          ticks += 1
          var images = document.querySelectorAll('img')
          var videos = document.querySelectorAll('.gs-bg-video')
          var pending = 0
          for (var i = 0; i < images.length; i += 1) if (!images[i].complete) pending += 1
          for (var j = 0; j < videos.length; j += 1) {
            if (videos[j].style.display === 'none') continue
            if (videos[j].readyState < 2) pending += 1
          }
          if (pending > 0 && ticks < 200) return setTimeout(waitMedia, 50)
          setTimeout(markReady, 250)
        }
        setTimeout(waitMedia, 30)
      })()
    </script>
  </body>
</html>
`
}

function contentType(file: string): string {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'
}

export async function startServer(
  root: string,
  opts: { port?: number; host?: string; shot?: ShotQuery } = {},
): Promise<PreviewServer> {
  const resolvedRoot = path.resolve(root)
  const stats = { requests: 0, notFound: 0, notFoundPaths: [] as string[] }

  const server: Server = createServer((req, res) => {
    stats.requests += 1
    let pathname = '/'
    try {
      pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname)
    } catch {
      res.statusCode = 400
      res.end('bad request')
      return
    }

    /* 浏览器会自己来要图标；这不是工程缺文件 */
    if (pathname === '/favicon.ico') {
      res.statusCode = 204
      res.end()
      return
    }

    if (pathname === '/__shot.html' && opts.shot) {
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.setHeader('cache-control', 'no-store')
      res.end(renderShotHtml(opts.shot))
      return
    }

    if (pathname === '/') pathname = '/start.html'
    const relative = pathname.replace(/^\/+/, '')
    let file = path.resolve(resolvedRoot, relative)
    const inside =
      file === resolvedRoot ||
      file.toLowerCase().startsWith(`${resolvedRoot.toLowerCase()}${path.sep}`)
    if (!inside) {
      stats.notFound += 1
      res.statusCode = 403
      res.end('forbidden')
      return
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!existsSync(file) || !statSync(file).isFile()) {
      stats.notFound += 1
      if (stats.notFoundPaths.length < 20) stats.notFoundPaths.push(pathname)
      res.statusCode = 404
      res.end('not found')
      return
    }
    res.setHeader('content-type', contentType(file))
    res.setHeader('cache-control', 'no-store')
    createReadStream(file).pipe(res)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(opts.port ?? 0, opts.host ?? '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  const address = server.address() as AddressInfo
  const host = opts.host ?? '127.0.0.1'
  const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host
  return {
    url: `http://${displayHost}:${address.port}/`,
    port: address.port,
    root: resolvedRoot,
    stats,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.()
        server.close(() => resolve())
      }),
  }
}

/**
 * 播放器 E2E：用本机 Chrome 的无头模式跑一遍真实的播放流程。
 *
 * 覆盖的都是一点就崩、改完又容易回退的链路：
 *  - 跨幕：幕末卡 → 幕名开场帧 → 下一幕，且跨幕后点击仍然能推进剧情
 *  - 幕末卡不再给按钮；全线终点只留「回到标题」
 *  - 台词记录只保留本幕
 *  - 存档槽位尺寸固定（填没填都一样大）
 *  - 标题界面的「关于作品」叠在标题上，不会先露出游戏画面
 *
 * 测试本身零依赖：起一个只读静态服务，让 Chrome --dump-dom 把结果带回来。
 * 页面里的断言结果以 base64 写进 #e2e-result，避免被 HTML 转义破坏。
 */
import { spawn } from 'node:child_process'
import { createReadStream, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENGINE = path.join(ROOT, 'public', 'engine')

const TXT = {
  a1: '第一幕的第一句。',
  a2: '第一幕的第二句。',
  b1: '第二幕的第一句。',
  b2: '第二幕的第二句。',
  c1: '第三幕的收尾。',
}

/* 立绘摆放的默认值：帧上的 transform 必须给全，播放器会按范围裁剪 */
const TR = { scale: 100, offsetX: 0, offsetY: 0 }

const line = (id, text, extra) => ({
  id,
  type: 'line',
  speaker: { characterId: null, name: '' },
  innerVoice: false,
  text,
  bg: null,
  bgm: null,
  sfx: null,
  voice: null,
  cast: { left: null, center: null, right: null },
  transition: 'fade',
  shake: false,
  ...extra,
})

const end = (id, title, next) => ({
  id,
  type: 'end',
  kind: next ? 'chapter' : 'ending',
  title,
  subtitle: next ? '—— 幕间 ——' : '灯亮了。',
  next,
})

/*
 * 立绘用的 1x1 PNG 自己画：播放器只看 img 的 src 属性，不解码像素，
 * 所以这一小段定长 base64 就够把「台上有没有人」这件事跑通。
 */
const BLANK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const DATA = {
  format: 'galastar/2',
  meta: {
    id: 'e2e',
    name: 'E2E 测试',
    author: 'Galastar',
    description: '',
    version: '1.0.0',
    accent: '#9d8cff',
    skin: 'pgf',
    locale: 'zh-CN',
    stage: { width: 1280, height: 720 },
    title: { enabled: false, subtitle: '', background: null },
  },
  characters: {
    char_a: { name: '角色A', color: '#ff88cc', sprites: { normal: 'a_sp_a' } },
    char_b: { name: '角色B', color: '#88ccff', sprites: { normal: 'a_sp_b' } },
  },
  flags: [],
  assets: {
    a_sp_a: { kind: 'sprite', path: BLANK_PNG, name: 'A.png' },
    a_sp_b: { kind: 'sprite', path: BLANK_PNG, name: 'B.png' },
  },
  scenes: [
    {
      id: 'scene-a',
      name: '第一幕 · 测试',
      frames: [line('a1', TXT.a1), line('a2', TXT.a2), end('ea', '第一幕 完', 'scene-b')],
    },
    {
      id: 'scene-b',
      name: '第二幕 · 测试',
      frames: [line('b1', TXT.b1), line('b2', TXT.b2), end('eb', '第二幕 完', 'scene-c')],
    },
    {
      id: 'scene-c',
      name: '第三幕 · 测试',
      frames: [line('c1', TXT.c1), end('ec', '结局 · 测试', null)],
    },
    /*
     * 心理活动：台上站两个人，用三种归因把两条规则分开验。
     * iv-a 有名字牌当对照，免得「名牌没出现」是因为根本没配名字。
     */
    {
      id: 'scene-iv',
      name: '心理活动 · 测试',
      frames: [
        line('iv-a', '台上有人开口。', {
          speaker: { characterId: 'char_a', name: '角色A' },
          cast: {
            left: { characterId: 'char_a', expression: 'normal', transform: { ...TR } },
            center: null,
            right: { characterId: 'char_b', expression: 'normal', transform: { ...TR } },
          },
        }),
        line('iv-b', '这是角色B的内心。', {
          innerVoice: true,
          speaker: { characterId: 'char_b', name: '角色B' },
          cast: {
            left: { characterId: 'char_a', expression: 'normal', transform: { ...TR } },
            center: null,
            right: { characterId: 'char_b', expression: 'normal', transform: { ...TR } },
          },
        }),
        line('iv-c', '这是「我」在想。', {
          innerVoice: true,
          cast: {
            left: { characterId: 'char_a', expression: 'normal', transform: { ...TR } },
            center: null,
            right: { characterId: 'char_b', expression: 'normal', transform: { ...TR } },
          },
        }),
      ],
    },
  ],
}

const DRIVER = String.raw`
(function () {
  var results = []
  var stage = null

  function check(name, ok, extra) {
    results.push({ name: name, ok: !!ok, extra: extra == null ? null : String(extra) })
  }
  function q(sel) {
    return document.querySelector(sel)
  }
  function click(node) {
    if (!node) throw new Error('找不到节点')
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }
  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms) })
  }
  function visible(node) {
    return !!node && getComputedStyle(node).display !== 'none'
  }
  function finish(payload) {
    var json = JSON.stringify(payload)
    var bytes = new TextEncoder().encode(json)
    var binary = ''
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    var pre = document.createElement('pre')
    pre.id = 'e2e-result'
    pre.textContent = 'E2E_RESULT:' + btoa(binary)
    document.body.appendChild(pre)
  }

  async function run() {
    localStorage.setItem(
      'galastar:config:',
      JSON.stringify({ textSpeed: 4, autoDelay: 200, bgmVolume: 0, sfxVolume: 0, voiceVolume: 0 }),
    )

    var root = document.createElement('div')
    root.id = 'galastar-root'
    document.body.appendChild(root)
    stage = window.Galastar.create(root, window.GALASTAR_DATA, { mode: 'play' })
    window.__stage = stage

    /* ---------------- 第一幕 ---------------- */
    stage.startFrom('scene-a', 0)
    await sleep(260)
    check('首句渲染', q('.gs-text').textContent === ${JSON.stringify(TXT.a1)}, q('.gs-text').textContent)

    click(q('.gs-dialog'))
    await sleep(200)
    check('同幕推进到第二句', stage.view.index === 1 && stage.view.sceneId === 'scene-a', stage.view.index)

    await sleep(220)
    click(q('.gs-dialog'))
    await sleep(200)
    check('走到幕末卡', stage.view.endCard === true, stage.view.endCard)
    check('幕末卡标题', q('.gs-end-title').textContent === '第一幕 完', q('.gs-end-title').textContent)
    check('幕末卡不再有按钮', q('.gs-end .gs-title-btn') === null, '按钮数 ' + document.querySelectorAll('.gs-end .gs-title-btn').length)
    check('幕末卡给出点击提示', q('.gs-end-hint') !== null)

    /* ---------------- 跨幕 ---------------- */
    click(q('.gs-end'))
    await sleep(220)
    check('幕名卡出现', visible(q('.gs-opening')), q('.gs-opening').style.display)
    check(
      '幕名卡写着下一幕',
      q('.gs-opening-title').textContent === '第二幕 · 测试',
      q('.gs-opening-title').textContent,
    )

    await sleep(620)
    check('幕名卡就位', stage.view.busy === false && stage.view.opening === 'scene-b', stage.view.opening)
    check('跨幕后 running 恢复', stage.view.running === true, stage.view.running)
    check('幕末卡已经退场', !visible(q('.gs-end')))

    click(q('.gs-opening'))
    await sleep(720)
    check('进入第二幕', stage.view.sceneId === 'scene-b' && stage.view.index === 0, stage.view.sceneId + '/' + stage.view.index)
    check('幕名卡已收起', !visible(q('.gs-opening')))

    await sleep(280)
    check('新幕后第一句渲染', q('.gs-text').textContent === ${JSON.stringify(TXT.b1)}, q('.gs-text').textContent)

    /* 回归：跨幕后点击必须还能推动剧情 */
    click(q('.gs-dialog'))
    await sleep(200)
    check('跨幕后仍能推进', stage.view.sceneId === 'scene-b' && stage.view.index === 1, stage.view.index)

    await sleep(220)
    click(q('.gs-dialog'))
    await sleep(220)
    check('第二幕幕末卡', stage.view.endCard === true && q('.gs-end-title').textContent === '第二幕 完')

    /* ---------------- 记录只属于本幕 ---------------- */
    var texts = stage.view.history.map(function (item) { return item.text })
    check('记录标记为本幕', stage.view.historyScene === 'scene-b', stage.view.historyScene)
    check(
      '记录不含上一幕台词',
      texts.indexOf(${JSON.stringify(TXT.a1)}) === -1 && texts.indexOf(${JSON.stringify(TXT.a2)}) === -1,
      texts.join(' | '),
    )
    check('记录含本幕台词', texts.indexOf(${JSON.stringify(TXT.b1)}) !== -1 && texts.indexOf(${JSON.stringify(TXT.b2)}) !== -1)

    /* ---------------- 第二幕 → 第三幕 → 全线终点 ---------------- */
    click(q('.gs-end'))
    await sleep(820)
    click(q('.gs-opening'))
    await sleep(720)
    check('进入第三幕', stage.view.sceneId === 'scene-c', stage.view.sceneId)

    await sleep(280)
    click(q('.gs-dialog'))
    await sleep(220)
    check('全线终点卡', stage.view.endCard === true && q('.gs-end-title').textContent === '结局 · 测试')
    var endButtons = Array.prototype.map.call(
      document.querySelectorAll('.gs-end .gs-title-btn'),
      function (b) { return b.textContent },
    )
    check(
      '终点只提供回到标题',
      endButtons.length === 1 && endButtons[0] === '回到标题' && q('.gs-end [data-i18n="player.replay"]') === null,
      endButtons.join(' | '),
    )

    click(q('.gs-end .gs-title-btn'))
    await sleep(200)
    check('回到标题', visible(q('.gs-title')) && stage.view.running === false, stage.view.running)

    /* ---------------- 存档槽位尺寸 ---------------- */
    click(q('.gs-title [data-i18n="player.start"]'))
    await sleep(320)
    click(q('.gs-toolbar [data-key="save"]'))
    await sleep(160)
    var before = document.querySelectorAll('.gs-save-slot')
    check('存档面板有六个槽位', before.length === 6, before.length)
    click(before[0])
    await sleep(160)
    var after = document.querySelectorAll('.gs-save-slot')
    var r1 = after[0].getBoundingClientRect()
    var r2 = after[1].getBoundingClientRect()
    check(
      '存档槽位填没填都一样大',
      Math.abs(r1.width - r2.width) < 0.5 && Math.abs(r1.height - r2.height) < 0.5,
      r1.width + 'x' + r1.height + ' vs ' + r2.width + 'x' + r2.height,
    )
    var cols = getComputedStyle(q('.gs-save-grid')).gridTemplateColumns.split(' ')
    check(
      '存档两列等宽',
      cols.length === 2 && Math.abs(parseFloat(cols[0]) - parseFloat(cols[1])) < 0.5,
      cols.join(' / '),
    )

    /* ---------------- 标题界面的「关于作品」 ---------------- */
    stage.showTitle()
    await sleep(200)
    var about = q('.gs-title [data-i18n="player.about"]')
    check('关于按钮存在', !!about)
    click(about)
    await sleep(200)
    check(
      '关于作品叠在标题上',
      visible(q('.gs-title')) && visible(q('.gs-log')),
      getComputedStyle(q('.gs-title')).display + ' / ' + getComputedStyle(q('.gs-log')).display,
    )
    click(q('.gs-log .gs-close'))
    await sleep(200)
    check(
      '关闭关于后标题仍在',
      visible(q('.gs-title')) && !visible(q('.gs-log')) && stage.view.running === false,
      getComputedStyle(q('.gs-title')).display,
    )

    /* ---------------- 心理活动 ---------------- */
    function slotState(cls) {
      var node = q('.gs-slot-' + cls)
      return {
        on: node.classList.contains('gs-slot-on'),
        lit: node.classList.contains('gs-slot-speaker'),
        dim: node.classList.contains('gs-slot-dim'),
      }
    }

    stage.startFrom('scene-iv', 0)
    await sleep(360)
    check(
      '普通台词仍然显示名牌',
      q('.gs-dialog').dataset.hasName === 'true' && visible(q('.gs-name')),
      q('.gs-dialog').dataset.hasName + ' / ' + q('.gs-name-text').textContent,
    )
    var ivA = slotState('left')
    check(
      '普通台词只亮说话人',
      ivA.on && ivA.lit && !ivA.dim && !slotState('right').lit && slotState('right').dim,
      JSON.stringify([ivA, slotState('right')]),
    )

    click(q('.gs-dialog'))
    await sleep(360)
    check(
      '角色心理活动不显示名牌',
      q('.gs-dialog').dataset.hasName === 'false' && !visible(q('.gs-name')),
      q('.gs-dialog').dataset.hasName,
    )
    var ivB = slotState('right')
    check(
      '角色心理活动仍然只亮他自己',
      ivB.on && ivB.lit && !ivB.dim && !slotState('left').lit && slotState('left').dim,
      JSON.stringify([slotState('left'), ivB]),
    )

    click(q('.gs-dialog'))
    await sleep(360)
    check(
      '旁白式心理活动也不显示名牌',
      q('.gs-dialog').dataset.hasName === 'false' && !visible(q('.gs-name')),
      q('.gs-dialog').dataset.hasName,
    )
    var ivCLeft = slotState('left')
    var ivCRight = slotState('right')
    check(
      '旁白式心理活动压暗全部立绘',
      ivCLeft.on && ivCRight.on && !ivCLeft.lit && !ivCRight.lit && ivCLeft.dim && ivCRight.dim,
      JSON.stringify([ivCLeft, ivCRight]),
    )
    var ivNames = stage.view.history.map(function (item) { return item.name })
    check(
      '心理活动的归因仍写进记录',
      ivNames.join('|') === '角色A|角色B|',
      ivNames.join('|'),
    )

finish({ ok: results.every(function (r) { return r.ok }), checks: results })
  }

  run().catch(function (error) {
    finish({
      ok: false,
      checks: results.concat([{ name: '运行时异常', ok: false, extra: String(error && error.stack || error) }]),
    })
  })
})()
`

/* ------------------------------------------------------------------ *
 * 浏览器查找：与 bin/lib/shot.ts 保持同样的来源（环境变量 > 系统安装 > Playwright 缓存）
 * ------------------------------------------------------------------ */

const EXE_NAMES =
  process.platform === 'win32'
    ? ['chrome.exe', 'chrome-headless-shell.exe', 'msedge.exe']
    : ['chrome', 'chrome-headless-shell', 'chromium', 'chromium-browser', 'google-chrome', 'msedge']

function isFile(file) {
  try {
    return existsSync(file) && statSync(file).isFile()
  } catch {
    return false
  }
}

function searchForExe(dir, depth) {
  if (depth < 0) return null
  let entries = []
  try {
    entries = readdirSync(dir)
  } catch {
    return null
  }
  for (const name of EXE_NAMES) {
    const candidate = path.join(dir, name)
    if (isFile(candidate)) return candidate
  }
  for (const entry of entries) {
    const full = path.join(dir, entry)
    try {
      if (!statSync(full).isDirectory()) continue
    } catch {
      continue
    }
    const found = searchForExe(full, depth - 1)
    if (found) return found
  }
  return null
}

function findBrowser() {
  const env = process.env.GALASTAR_CHROME
  if (env && isFile(env)) return env

  const candidates = []
  if (process.platform === 'win32') {
    for (const root of [
      process.env.PROGRAMFILES,
      process.env['PROGRAMFILES(X86)'],
      process.env.LOCALAPPDATA,
    ]) {
      if (!root) continue
      candidates.push(path.join(root, 'Google/Chrome/Application/chrome.exe'))
      candidates.push(path.join(root, 'Microsoft/Edge/Application/msedge.exe'))
    }
    const playwright = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')
    for (const dir of [process.env.PLAYWRIGHT_BROWSERS_PATH, playwright]) {
      if (!dir || !existsSync(dir)) continue
      for (const entry of readdirSync(dir)) {
        if (!/^chromium|^chromium_headless_shell/.test(entry)) continue
        const exe = searchForExe(path.join(dir, entry), 4)
        if (exe) candidates.push(exe)
      }
    }
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    candidates.push('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge')
    candidates.push('/Applications/Chromium.app/Contents/MacOS/Chromium')
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
    )
  }
  return candidates.find(isFile) || null
}

/* ------------------------------------------------------------------ *
 * 临时站点 + Chrome
 * ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

function startServer(dir) {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent((req.url || '/').split('?')[0])
    const file = pathname === '/' ? path.join(dir, 'index.html') : path.join(dir, pathname)
    if (!file.startsWith(dir) || !isFile(file)) {
      res.statusCode = 404
      res.end('not found')
      return
    }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream')
    createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port })
    })
  })
}

function runBrowser(exe, url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const profile = mkdtempSync(path.join(os.tmpdir(), 'galastar-e2e-'))
    const args = [
      '--headless=new',
      `--user-data-dir=${profile}`,
      '--hide-scrollbars',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--mute-audio',
      '--no-sandbox',
      '--force-device-scale-factor=1',
      '--window-size=1280,720',
      '--virtual-time-budget=30000',
      '--dump-dom',
      url,
    ]
    const child = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    const timer = setTimeout(() => {
      try {
        process.kill(child.pid)
      } catch {
        /* 已退出 */
      }
      rmSync(profile, { recursive: true, force: true })
      reject(new Error(`浏览器 ${timeoutMs}ms 内没有结束`))
    }, timeoutMs)
    child.once('error', (error) => {
      clearTimeout(timer)
      rmSync(profile, { recursive: true, force: true })
      reject(error)
    })
    child.once('close', () => {
      clearTimeout(timer)
      rmSync(profile, { recursive: true, force: true })
      resolve({ stdout, stderr })
    })
  })
}

async function main() {
  const browser = findBrowser()
  if (!browser) {
    console.error('找不到可用的 Chrome / Edge。设置 GALASTAR_CHROME 指向可执行文件后重试。')
    process.exit(2)
  }

  const dir = mkdtempSync(path.join(os.tmpdir(), 'galastar-e2e-site-'))
  await mkdir(dir, { recursive: true })
  await Promise.all([
    copyFile(path.join(ENGINE, 'runtime.js'), path.join(dir, 'runtime.js')),
    copyFile(path.join(ENGINE, 'runtime.css'), path.join(dir, 'runtime.css')),
  ])
  await writeFile(
    path.join(dir, 'index.html'),
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="/runtime.css" />
    <style>
      html, body { margin: 0; height: 100%; background: #06060c; overflow: hidden; }
      #galastar-root { position: absolute; inset: 0; }
    </style>
  </head>
  <body>
    <script>window.GALASTAR_DATA = ${JSON.stringify(DATA)}</script>
    <script src="/runtime.js"></script>
    <script>${DRIVER}</script>
  </body>
</html>
`,
  )

  const { server, port } = await startServer(dir)
  let output
  try {
    output = await runBrowser(browser, `http://127.0.0.1:${port}/`, 60_000)
  } finally {
    server.close()
    rmSync(dir, { recursive: true, force: true })
  }

  const match = /E2E_RESULT:([A-Za-z0-9+/=]+)/.exec(output.stdout)
  if (!match) {
    console.error('页面没有产出断言结果。')
    console.error(output.stdout.slice(0, 4000))
    console.error(output.stderr.slice(-2000))
    process.exit(1)
  }

  const result = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'))
  for (const check of result.checks) {
    const mark = check.ok ? '✓' : '✗'
    console.log(`${mark} ${check.name}${check.ok || !check.extra ? '' : `  → ${check.extra}`}`)
  }
  const passed = result.checks.filter((c) => c.ok).length
  console.log(`\n${passed}/${result.checks.length} 通过（${path.basename(browser)}）`)
  if (!result.ok) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

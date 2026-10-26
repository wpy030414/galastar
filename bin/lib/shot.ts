/**
 * 零依赖截图：找一个本机浏览器，用它的 headless 模式打开预览页。
 *
 * 先 `--dump-dom` 确认页面真的就绪（data-galastar-ready），再 `--screenshot`。
 * 少了这一步，404 或运行时异常也会得到一张「成功生成」的黑图。
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CliError } from './output'

export interface BrowserInfo {
  path: string
  kind: 'chrome' | 'headless-shell'
  name: string
}

const EXE_NAMES =
  process.platform === 'win32'
    ? ['chrome.exe', 'chrome-headless-shell.exe', 'msedge.exe']
    : ['chrome', 'chrome-headless-shell', 'chromium', 'chromium-browser', 'google-chrome', 'msedge']

function isFile(file: string): boolean {
  try {
    return existsSync(file) && statSync(file).isFile()
  } catch {
    return false
  }
}

function systemCandidates(): BrowserInfo[] {
  const list: Array<[string, string]> = []
  if (process.platform === 'win32') {
    const env = process.env
    const roots = [env['PROGRAMFILES'], env['PROGRAMFILES(X86)'], env['LOCALAPPDATA']].filter(
      (value): value is string => Boolean(value),
    )
    for (const root of roots) {
      list.push([path.join(root, 'Google/Chrome/Application/chrome.exe'), 'Google Chrome'])
      list.push([path.join(root, 'Microsoft/Edge/Application/msedge.exe'), 'Microsoft Edge'])
      list.push([path.join(root, 'Chromium/Application/chrome.exe'), 'Chromium'])
    }
  } else if (process.platform === 'darwin') {
    list.push(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'Google Chrome'])
    list.push(['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'Microsoft Edge'])
    list.push(['/Applications/Chromium.app/Contents/MacOS/Chromium', 'Chromium'])
  } else {
    for (const file of [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
    ]) {
      list.push([file, path.basename(file)])
    }
  }
  return list
    .filter(([file]) => isFile(file))
    .map(([file, name]) => ({ path: file, kind: 'chrome' as const, name }))
}

function searchForExe(dir: string, depth: number): string | null {
  if (depth < 0) return null
  let entries: string[] = []
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

function playwrightCandidates(): BrowserInfo[] {
  const bases = [
    process.env['PLAYWRIGHT_BROWSERS_PATH'],
    process.platform === 'win32' && process.env['LOCALAPPDATA']
      ? path.join(process.env['LOCALAPPDATA'], 'ms-playwright')
      : null,
    process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Caches/ms-playwright') : null,
    path.join(os.homedir(), '.cache/ms-playwright'),
  ].filter((value): value is string => Boolean(value))

  const found: BrowserInfo[] = []
  for (const base of bases) {
    if (!existsSync(base)) continue
    let entries: string[] = []
    try {
      entries = readdirSync(base)
    } catch {
      continue
    }
    /* 完整 chromium 排在 headless shell 前面：截图更接近真实浏览器 */
    const ordered = entries
      .filter((name) => /^chromium-\d+$/.test(name) || /^chromium_headless_shell-\d+$/.test(name))
      .sort(
        (a, b) =>
          (a.startsWith('chromium_headless') ? 1 : 0) - (b.startsWith('chromium_headless') ? 1 : 0),
      )
    for (const entry of ordered) {
      const exe = searchForExe(path.join(base, entry), 4)
      if (!exe) continue
      const shell = entry.startsWith('chromium_headless_shell')
      found.push({
        path: exe,
        kind: shell ? 'headless-shell' : 'chrome',
        name: `Playwright ${shell ? 'headless shell' : 'Chromium'} ${entry.replace(/^chromium(_headless_shell)?-/, '')}`,
      })
    }
  }
  return found
}

export function findBrowser(pref?: string): BrowserInfo | null {
  if (pref && pref !== 'auto') {
    if (isFile(pref)) {
      const shell = /headless-shell/i.test(path.basename(pref))
      return { path: path.resolve(pref), kind: shell ? 'headless-shell' : 'chrome', name: pref }
    }
    if (pref !== 'chrome' && pref !== 'edge' && pref !== 'headless-shell') {
      throw new CliError('E_BROWSER', `找不到浏览器：${pref}`, {
        exitCode: 2,
        hint: '传一个可执行文件路径，或直接用 --browser auto',
      })
    }
  }
  const env = process.env['GALASTAR_CHROME']
  if (env && isFile(env)) {
    return { path: env, kind: /headless-shell/i.test(env) ? 'headless-shell' : 'chrome', name: env }
  }
  const all = [...systemCandidates(), ...playwrightCandidates()]
  if (pref === 'headless-shell') return all.find((b) => b.kind === 'headless-shell') ?? null
  if (pref === 'edge') return all.find((b) => /edge/i.test(b.name)) ?? null
  if (pref === 'chrome') return all.find((b) => b.kind === 'chrome') ?? null
  return all[0] ?? null
}

function killTree(pid: number | undefined) {
  if (!pid) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
  } else {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* 已经退出 */
    }
  }
}

function runBrowser(
  browser: BrowserInfo,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(browser.path, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    const timer = setTimeout(() => {
      killTree(child.pid)
      reject(
        new CliError('E_SHOT_TIMEOUT', `浏览器在 ${Math.round(timeoutMs / 1000)} 秒内没有结束`, {
          exitCode: 1,
          hint: '调大 --wait，或确认页面没有卡在加载上',
        }),
      )
    }, timeoutMs)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(new CliError('E_BROWSER', `无法启动浏览器：${error.message}`, { exitCode: 2 }))
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve({ stdout, stderr })
      else
        reject(
          new CliError('E_SHOT_FAILED', `浏览器退出码 ${code}`, {
            exitCode: 1,
            hint: stderr.trim().split('\n').slice(-3).join('\n') || undefined,
          }),
        )
    })
  })
}

export interface CaptureResult {
  bytes: number
  checks: { ready: boolean; appMounted: boolean; browser: string }
}

export async function captureScreenshot(
  browser: BrowserInfo,
  url: string,
  outPath: string,
  opts: { width: number; height: number; wait: number; noSandbox?: boolean; expectReady?: boolean },
): Promise<CaptureResult> {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'galastar-shot-'))
  const common = [
    `--user-data-dir=${profile}`,
    '--hide-scrollbars',
    '--disable-gpu',
    '--force-device-scale-factor=1',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--mute-audio',
    '--run-all-compositor-stages-before-draw',
    `--window-size=${opts.width},${opts.height}`,
    `--virtual-time-budget=${opts.wait}`,
  ]
  if (browser.kind === 'chrome') common.push('--headless=new')
  if (opts.noSandbox) common.push('--no-sandbox')
  if (process.platform === 'linux') common.push('--disable-dev-shm-usage')

  const timeoutMs = opts.wait + 25_000
  try {
    const dump = await runBrowser(browser, [...common, '--dump-dom', url], timeoutMs)
    const ready = dump.stdout.includes('data-galastar-ready="1"')
    const appMounted = dump.stdout.includes('gs-app')
    /* 定格入口会自己写就绪标记；直接开 start.html 时只要求舞台建起来了 */
    const expectReady = opts.expectReady !== false
    if (!appMounted || (expectReady && !ready)) {
      throw new CliError('E_SHOT_NOT_READY', '页面没有进入就绪状态', {
        exitCode: 1,
        hint: '多半是 data.js / 素材加载失败，先跑 galastar validate，并检查 serve 的 404 计数',
      })
    }

    rmSync(outPath, { force: true })
    await runBrowser(browser, [...common, `--screenshot=${path.resolve(outPath)}`, url], timeoutMs)
    if (!existsSync(outPath)) {
      throw new CliError('E_SHOT_FAILED', `浏览器没有生成截图：${outPath}`, { exitCode: 1 })
    }
    return { bytes: statSync(outPath).size, checks: { ready, appMounted, browser: browser.name } }
  } finally {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        rmSync(profile, { recursive: true, force: true })
        break
      } catch {
        /* Windows 上浏览器可能还占着 profile，稍等再试 */
        await new Promise((resolve) => setTimeout(resolve, 120))
      }
    }
  }
}

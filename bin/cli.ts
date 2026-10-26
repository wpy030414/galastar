/**
 * galastar —— 面向 Agent 的命令行入口。
 *
 * 命令只做四件事：把工程读进来、按运行时的真实规则校验、调用与浏览器共享的
 * 打包核心、把产物或预览交给调用方。业务细节都在 src/lib 里，这里只做粘合。
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import type { AssetKind, AssetRecord, Locale, Project } from '@/lib/types'
import { normalizeProject } from '@/lib/project'
import { validateProject, type Issue } from '@/lib/validate'
import {
  ASSET_PREFIX,
  fileNameFromUrl,
  makeAssetFileName,
  makeRemoteFileName,
  mimeForFileName,
} from '@/lib/asset-names'
import { isHttpUrl, safeFileName } from '@/lib/pure'
import {
  archiveEntries,
  archiveFileName,
  playableEntries,
  zipEntries,
  zipFileName,
  type ZipEntry,
} from '@/lib/pack-core'
import {
  assertKnownFlags,
  flagBool,
  flagNumber,
  flagString,
  parseArgs,
  UsageError,
  type ParsedArgs,
} from './lib/args'
import { loadEngine, resolveEngineDir } from './lib/engine'
import { imageSize } from './lib/image-size'
import { CliError, Reporter } from './lib/output'
import { cliVersion, expandHome, REPO_ROOT, resolveWorkspaceRoot } from './lib/paths'
import {
  assetFilePath,
  assetIdFor,
  assetsDirOf,
  ensureAssetsDir,
  kindFromMime,
  listAssetFileNames,
  loadAssets,
  resolveInput,
  sha256,
  writeFileAtomic,
  writeProjectJson,
  type InputSource,
} from './lib/project-io'
import { startServer, type ShotQuery } from './lib/serve'
import { captureScreenshot, findBrowser } from './lib/shot'
import { scaffoldProject, type TemplateName } from './lib/templates'

const ASSET_KINDS: AssetKind[] = ['background', 'sprite', 'bgm', 'voice', 'sfx']

const COMMANDS = [
  'doctor',
  'init',
  'asset',
  'validate',
  'build',
  'serve',
  'shot',
  'help',
  'version',
]

/* ------------------------------------------------------------------ *
 * 入口
 * ------------------------------------------------------------------ */

export async function main(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv)
  const json = parsed.flags.json === true
  const command = parsed.command || (parsed.flags.version ? 'version' : 'help')
  const reporter = new Reporter(command, json)

  try {
    if (parsed.flags.version || command === 'version') {
      reporter.log(`galastar ${cliVersion()}`)
      reporter.ok({ version: cliVersion() })
      return
    }
    if (parsed.flags.help || command === 'help') {
      printHelp(reporter, parsed.positionals[0])
      reporter.ok({ commands: COMMANDS })
      return
    }
    if (!COMMANDS.includes(command)) {
      throw new UsageError(`未知命令：${command}`)
    }

    switch (command) {
      case 'doctor':
        await cmdDoctor(parsed, reporter)
        break
      case 'init':
        cmdInit(parsed, reporter)
        break
      case 'asset':
        await cmdAsset(parsed, reporter)
        break
      case 'validate':
        await cmdValidate(parsed, reporter)
        break
      case 'build':
        await cmdBuild(parsed, reporter)
        break
      case 'serve':
        await cmdServe(parsed, reporter)
        break
      case 'shot':
        await cmdShot(parsed, reporter)
        break
      default:
        throw new UsageError(`未知命令：${command}`)
    }
  } catch (error) {
    if (error instanceof UsageError) {
      reporter.fail(
        new CliError('E_USAGE', error.message, {
          exitCode: 2,
          hint: '运行 galastar help 查看用法',
        }),
      )
      return
    }
    reporter.fail(error)
  }
}

/* ------------------------------------------------------------------ *
 * doctor
 * ------------------------------------------------------------------ */

async function cmdDoctor(parsed: ParsedArgs, r: Reporter) {
  assertKnownFlags(parsed.flags, [])
  const engineDir = resolveEngineDir()
  let engine: { dir: string; version: string } | null = null
  let engineError: string | null = null
  try {
    const loaded = loadEngine(engineDir)
    engine = { dir: loaded.dir, version: loaded.version }
  } catch (error) {
    engineError = error instanceof Error ? error.message : String(error)
  }
  const browser = findBrowser()
  const typescript = (process.features as { typescript?: string }).typescript ?? null
  const workspace = resolveWorkspaceRoot()

  const data = {
    node: process.version,
    typescript,
    platform: process.platform,
    repoRoot: REPO_ROOT,
    workspace: { root: workspace, exists: existsSync(workspace) },
    engine: engine ?? { dir: engineDir, error: engineError },
    browser: browser ? { path: browser.path, kind: browser.kind, name: browser.name } : null,
  }

  r.log(`Node        ${process.version}`)
  r.log(`TypeScript  ${typescript ?? '不支持（需要 Node ≥ 24）'}`)
  r.log(`播放器      ${engine ? `${engine.version} · ${engine.dir}` : `不可用 · ${engineError}`}`)
  r.log(`浏览器      ${browser ? `${browser.name} · ${browser.path}` : '未找到（shot 不可用）'}`)
  r.log(`工作区      ${workspace}${existsSync(workspace) ? '' : '（尚未创建）'}`)

  /* 播放器缺失是环境问题：失败信封里带上完整诊断，但只输出一个 JSON 对象 */
  if (!engine) {
    throw new CliError('E_ENGINE_MISSING', '播放器运行时不可用', {
      exitCode: 2,
      hint: '确认仓库完整，或用 --engine 指向 public/engine',
      data,
    })
  }
  r.ok(data)
}

/* ------------------------------------------------------------------ *
 * init
 * ------------------------------------------------------------------ */

/** 裸名字（my-story）进工作区；带分隔符或绝对路径则按路径理解 */
function isBareName(value: string): boolean {
  return !path.isAbsolute(value) && !/[\\/]/.test(value) && value !== '.' && value !== '..'
}

function cmdInit(parsed: ParsedArgs, r: Reporter) {
  assertKnownFlags(parsed.flags, ['template', 'name', 'author', 'locale', 'force', 'workspace'])
  const localeRaw = flagString(parsed.flags, 'locale') || 'zh-CN'
  if (localeRaw !== 'zh-CN' && localeRaw !== 'en') {
    throw new UsageError('--locale 只支持 zh-CN / en')
  }
  const template = (flagString(parsed.flags, 'template') || 'blank') as TemplateName
  if (template !== 'blank' && template !== 'demo') {
    throw new UsageError('--template 只支持 blank / demo')
  }

  const workspace = resolveWorkspaceRoot(flagString(parsed.flags, 'workspace'))
  const rawDir = parsed.positionals[0]
  const requestedName = flagString(parsed.flags, 'name')?.trim()
  const dir =
    rawDir === undefined
      ? path.join(workspace, safeFileName(requestedName || 'untitled', 'untitled'))
      : isBareName(rawDir)
        ? path.join(workspace, safeFileName(rawDir, 'untitled'))
        : path.resolve(expandHome(rawDir))

  const { files } = scaffoldProject({
    dir,
    template,
    name: requestedName,
    author: flagString(parsed.flags, 'author'),
    locale: localeRaw as Locale,
    force: flagBool(parsed.flags, 'force'),
  })

  const resolved = path.resolve(dir)
  r.log(`已创建工程：${resolved}`)
  r.log(`工作区：${workspace}`)
  for (const file of files) r.log(`  ${file}`)
  r.log('')
  r.log(`下一步：编辑 project.json，然后运行 galastar validate "${resolved}"`)
  r.ok({ dir: resolved, workspace, template, files })
}

/* ------------------------------------------------------------------ *
 * asset add
 * ------------------------------------------------------------------ */

async function cmdAsset(parsed: ParsedArgs, r: Reporter) {
  const sub = parsed.positionals[0]
  if (sub !== 'add') throw new UsageError('用法：galastar asset add <文件...> [--kind ...]')
  assertKnownFlags(parsed.flags, [
    'kind',
    'assets-dir',
    'id',
    'dry-run',
    'project',
    'url',
    'name',
    'mime',
  ])
  const inputs = parsed.positionals.slice(1)
  const urlFlag = flagString(parsed.flags, 'url')
  if (!inputs.length && !urlFlag) {
    throw new UsageError('至少给一个素材文件，或用 --url 添加远程素材')
  }
  if (inputs.length && urlFlag) {
    throw new UsageError('文件和 --url 不要同时给')
  }

  const kindFlag = flagString(parsed.flags, 'kind')
  if (kindFlag && !ASSET_KINDS.includes(kindFlag as AssetKind)) {
    throw new UsageError(`--kind 只支持 ${ASSET_KINDS.join(' / ')}`)
  }
  if (flagString(parsed.flags, 'id') && inputs.length > 1) {
    throw new UsageError('--id 只能用于单个文件')
  }

  const source = await resolveInput(flagString(parsed.flags, 'project') || '.')
  if (source.kind === 'archive') {
    throw new CliError('E_USAGE', '工程包不能直接添加素材', {
      exitCode: 2,
      hint: '先解压成目录，或把它导入编辑器',
    })
  }
  const assetsDir = assetsDirOf(source, flagString(parsed.flags, 'assets-dir'))
  const raw = source.raw as Record<string, unknown>
  const records: AssetRecord[] = Array.isArray(raw.assets) ? (raw.assets as AssetRecord[]) : []
  const names = records.map((record) => record.fileName)
  const ids = new Set(records.map((record) => record.id))
  const dryRun = flagBool(parsed.flags, 'dry-run')
  if (!urlFlag && !dryRun) ensureAssetsDir(assetsDir)

  const added: AssetRecord[] = []
  const reused: AssetRecord[] = []

  if (urlFlag) {
    if (!isHttpUrl(urlFlag)) {
      throw new CliError('E_ASSET_URL_INVALID', '远程素材必须是 http(s) 链接', {
        exitCode: 2,
        hint: '例如 https://cdn.example.com/bg.png',
      })
    }
    const url = urlFlag.trim()
    const urlName = fileNameFromUrl(url)
    const mime = flagString(parsed.flags, 'mime') || mimeForFileName(urlName)
    const kind = (kindFlag as AssetKind | undefined) || kindFromMime(mime)
    const explicitId = flagString(parsed.flags, 'id')
    const contentId = `a_${sha256(Buffer.from(url)).slice(0, 8)}`
    /* 同一个链接重复添加是幂等的 */
    const duplicate = explicitId
      ? records.find((record) => record.id === explicitId)
      : records.find((record) => record.id === contentId || record.url === url)
    if (duplicate) {
      reused.push(duplicate)
    } else {
      const record: AssetRecord = {
        id: explicitId || assetIdFor(sha256(Buffer.from(url)), ids),
        kind,
        name: flagString(parsed.flags, 'name')?.trim() || urlName || `${kind}-remote`,
        fileName: makeRemoteFileName(kind, url, [...names, ...added.map((item) => item.fileName)]),
        mime,
        size: 0,
        url,
        createdAt: Date.now(),
      }
      added.push(record)
      ids.add(record.id)
    }
  } else {
    for (const input of inputs) {
      const filePath = path.resolve(input)
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        throw new CliError('E_NOT_FOUND', `素材文件不存在：${filePath}`, {
          exitCode: 2,
          path: filePath,
        })
      }
      const buffer = readFileSync(filePath)
      const mime = mimeForFileName(path.basename(filePath))
      const kind = (kindFlag as AssetKind | undefined) || kindFromMime(mime)
      const explicitId = flagString(parsed.flags, 'id')
      const contentId = `a_${sha256(buffer).slice(0, 8)}`
      /* 同一个文件重复添加应当幂等：id 是内容哈希，命中就返回既有记录 */
      const duplicate = explicitId
        ? records.find((record) => record.id === explicitId)
        : records.find((record) => record.id === contentId)
      if (duplicate) {
        reused.push(duplicate)
        continue
      }
      const id = explicitId || assetIdFor(sha256(buffer), ids)
      const fileName = makeAssetFileName(kind, path.basename(filePath), mime, [
        ...names,
        ...added.map((record) => record.fileName),
      ])
      if (!dryRun) copyFileSync(filePath, assetFilePath(assetsDir, fileName))
      const size = imageSize(buffer, mime)
      const record: AssetRecord = {
        id,
        kind,
        name: path.basename(filePath),
        fileName,
        mime,
        size: buffer.byteLength,
        ...(size ? { width: size.width, height: size.height } : {}),
        createdAt: Date.now(),
      }
      added.push(record)
      ids.add(id)
    }
  }

  if (!dryRun && added.length) {
    raw.assets = [...records, ...added]
    writeProjectJson(source.file, raw)
  }

  for (const record of added) {
    const detail = record.url
      ? '远程链接'
      : record.width
        ? `${record.width}×${record.height}`
        : undefined
    r.log(
      `+ ${record.id}  ${record.url ?? record.fileName}  (${record.kind}${detail ? `, ${detail}` : ''})`,
    )
  }
  for (const record of reused) {
    r.log(`= ${record.id}  已存在，跳过（${record.url ?? record.fileName}）`)
  }
  r.log(
    dryRun
      ? '（dry-run，未写入文件）'
      : urlFlag
        ? '远程素材只写进 project.json，不复制文件。'
        : `素材目录：${assetsDir}`,
  )
  r.ok({ added, reused, dir: urlFlag ? null : assetsDir, dryRun, remote: Boolean(urlFlag) })
}

/* ------------------------------------------------------------------ *
 * validate
 * ------------------------------------------------------------------ */

async function cmdValidate(parsed: ParsedArgs, r: Reporter) {
  assertKnownFlags(parsed.flags, ['assets-dir', 'strict', 'max-issues', 'project'])
  const source = await resolveInput(
    parsed.positionals[0] || flagString(parsed.flags, 'project') || '.',
  )
  const assetsDir =
    source.kind === 'archive' ? '' : assetsDirOf(source, flagString(parsed.flags, 'assets-dir'))
  const onDisk = listAssetFileNames(source, assetsDir)
  const maxIssues = flagNumber(parsed.flags, 'max-issues') ?? 200

  const result = validateProject(source.raw, {
    assetsOnDisk: onDisk,
    missingIsError: false,
    maxIssues,
  })
  printIssues(r, result.issues)
  const strict = flagBool(parsed.flags, 'strict')
  const valid = result.summary.errors === 0 && (!strict || result.summary.warnings === 0)

  r.log('')
  r.log(
    `${result.summary.scenes} 个场景 · ${result.summary.frames} 帧 · ${result.summary.assets} 个素材 · ${result.summary.errors} 个错误 · ${result.summary.warnings} 个警告`,
  )
  r.log(valid ? '工程可以打包。' : '工程还不能打包，先修上面的错误。')
  if (result.truncated) r.log(`（问题过多，只显示了前 ${maxIssues} 条）`)
  r.ok(
    {
      valid,
      project: source.file,
      ...result.summary,
      truncated: result.truncated,
    },
    { issues: result.issues },
  )
  if (!valid) process.exitCode = 1
}

function printIssues(r: Reporter, issues: Issue[], limit = 60) {
  for (const issue of issues.slice(0, limit)) {
    const mark = issue.severity === 'error' ? '✗' : '!'
    r.log(`${mark} ${issue.path}: ${issue.message}  [${issue.code}]`)
    if (issue.hint) r.log(`    → ${issue.hint}`)
  }
  if (issues.length > limit) r.log(`…… 还有 ${issues.length - limit} 条未显示`)
}

/* ------------------------------------------------------------------ *
 * build
 * ------------------------------------------------------------------ */

async function cmdBuild(parsed: ParsedArgs, r: Reporter) {
  assertKnownFlags(parsed.flags, [
    'out',
    'format',
    'assets-dir',
    'engine',
    'allow-missing',
    'source-date',
    'project',
  ])
  const source = await resolveInput(
    parsed.positionals[0] || flagString(parsed.flags, 'project') || '.',
  )
  const assetsDir =
    source.kind === 'archive' ? '' : assetsDirOf(source, flagString(parsed.flags, 'assets-dir'))
  const allowMissing = flagBool(parsed.flags, 'allow-missing')
  const format = flagString(parsed.flags, 'format') || 'web'
  if (!['web', 'archive', 'both'].includes(format)) {
    throw new UsageError('--format 只支持 web / archive / both')
  }

  const { project, assets, missing, issues } = await prepareProject(source, assetsDir, allowMissing)
  const engine = loadEngine(resolveEngineDir(flagString(parsed.flags, 'engine')))
  const builtAt = parseBuiltAt(parsed.flags)
  const outputs = resolveOutputs(source, parsed.flags, project, format)
  const artifacts: Array<{ kind: string; path: string; bytes: number; sha256: string }> = []

  const emit = async (kind: 'web' | 'archive', dest: string) => {
    const result =
      kind === 'web'
        ? playableEntries({ project, engine: engine.source, assets, allowMissing, builtAt })
        : archiveEntries({ project, assets, allowMissing })
    const buffer = await zipEntries(result.entries, { builtAt })
    const bytes = new Uint8Array(buffer)
    writeFileAtomic(dest, bytes)
    artifacts.push({ kind, path: dest, bytes: bytes.byteLength, sha256: sha256(bytes) })
    r.log(`✓ ${kind === 'web' ? '可玩包' : '工程包'}：${dest}（${formatBytes(bytes.byteLength)}）`)
  }

  if (outputs.web) await emit('web', outputs.web)
  if (outputs.archive) await emit('archive', outputs.archive)

  const remote = project.assets.filter((asset) => isHttpUrl(asset.url)).length
  r.log(
    `播放器 ${engine.version} · 素材 ${assets.size} 本地 + ${remote} 远程 · 时间戳 ${builtAt.toISOString()}`,
  )
  if (missing.length) r.note(`[警告] 跳过缺失素材：${missing.join('、')}`)

  r.ok(
    {
      project: source.file,
      artifacts,
      assets: {
        included: assets.size,
        remote,
        missing: missing.length,
        missingFiles: missing,
      },
      engine: { version: engine.version, dir: engine.dir },
      builtAt: builtAt.toISOString(),
    },
    { issues, warnings: missing.map((file) => ({ code: 'W_ASSET_FILE_SKIPPED', file })) },
  )
}

/** 先校验原始 JSON，再 normalize —— 反过来会把「空 scenes」洗成合法工程 */
async function prepareProject(source: InputSource, assetsDir: string, allowMissing: boolean) {
  const onDisk = listAssetFileNames(source, assetsDir)
  const check = validateProject(source.raw, {
    assetsOnDisk: onDisk,
    missingIsError: !allowMissing,
  })
  if (check.summary.errors > 0) {
    throw new CliError('E_VALIDATE_FAILED', `工程有 ${check.summary.errors} 处错误，未打包`, {
      exitCode: 1,
      data: { issues: check.issues, summary: check.summary },
      hint: '先运行 galastar validate 查看完整清单',
    })
  }
  const project = normalizeProject(source.raw, 'zh-CN')
  const { assets, missing } = await loadAssets(source, project, assetsDir)
  return { project, assets, missing, issues: check.issues }
}

function resolveOutputs(
  source: InputSource,
  flags: ParsedArgs['flags'],
  project: Project,
  format: string,
): { web?: string; archive?: string } {
  const out = flagString(flags, 'out')
  const defaultDir = path.join(source.root, 'dist')
  const looksLikeFile = out ? /\.(zip|galastar)$/i.test(out) : false
  if (out && looksLikeFile && format === 'both') {
    throw new UsageError('--format both 时 --out 必须是目录')
  }
  if (out && looksLikeFile) {
    return format === 'archive' ? { archive: path.resolve(out) } : { web: path.resolve(out) }
  }
  const dir = path.resolve(out || defaultDir)
  return {
    ...(format === 'web' || format === 'both' ? { web: path.join(dir, zipFileName(project)) } : {}),
    ...(format === 'archive' || format === 'both'
      ? { archive: path.join(dir, archiveFileName(project)) }
      : {}),
  }
}

function parseBuiltAt(flags: ParsedArgs['flags']): Date {
  const raw = flagString(flags, 'source-date') || process.env['SOURCE_DATE_EPOCH']
  if (!raw) return new Date()
  if (/^\d+$/.test(raw)) return new Date(Number(raw) * 1000)
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) throw new UsageError(`--source-date 无法解析：${raw}`)
  return date
}

/* ------------------------------------------------------------------ *
 * serve / shot
 * ------------------------------------------------------------------ */

interface PreviewContext {
  dir: string
  urlPath: string
  project: Project | null
}

async function preparePreview(
  input: string,
  flags: ParsedArgs['flags'],
  opts: { noBuild?: boolean } = {},
): Promise<PreviewContext> {
  const target = path.resolve(input)
  const projectFile = path.join(target, 'project.json')
  const startFile = path.join(target, 'start.html')

  /* 已经构建好的目录：直接服务，不再打包 */
  if (existsSync(startFile) && !existsSync(projectFile)) {
    return { dir: target, urlPath: '/', project: null }
  }

  const source = await resolveInput(target)
  /* 工程包没有独立素材目录，素材随 zip 一起读 */
  const assetsDir =
    source.kind === 'archive' ? '' : assetsDirOf(source, flagString(flags, 'assets-dir'))
  const previewDir = path.join(source.root, '.galastar', 'preview')
  if (!opts.noBuild || !existsSync(path.join(previewDir, 'start.html'))) {
    const { project, assets } = await prepareProject(source, assetsDir, false)
    const engine = loadEngine(resolveEngineDir(flagString(flags, 'engine')))
    const { entries } = playableEntries({
      project,
      engine: engine.source,
      assets,
      allowMissing: false,
      builtAt: new Date(),
    })
    writeEntries(previewDir, entries)
    return { dir: previewDir, urlPath: '/', project }
  }
  const project = normalizeProject(source.raw, 'zh-CN')
  return { dir: previewDir, urlPath: '/', project }
}

function writeEntries(baseDir: string, entries: ZipEntry[]) {
  rmSync(baseDir, { recursive: true, force: true })
  for (const entry of entries) {
    if (typeof entry.data === 'string') {
      const dest = path.join(baseDir, entry.path)
      mkdirSync(path.dirname(dest), { recursive: true })
      writeFileSync(dest, entry.data)
    } else if (entry.data instanceof Uint8Array) {
      const dest = path.join(baseDir, entry.path)
      mkdirSync(path.dirname(dest), { recursive: true })
      writeFileSync(dest, entry.data)
    } else {
      throw new CliError('E_INTERNAL', '预览只接受 Node 可写的字节（Uint8Array / string）')
    }
  }
}

function resolveShotQuery(project: Project | null, flags: ParsedArgs['flags']): ShotQuery | null {
  if (!project) return null
  const sceneFlag = flagString(flags, 'scene')
  const frameFlag = flagNumber(flags, 'frame')
  if (flagBool(flags, 'title')) return { mode: 'title', sceneId: '', index: 0 }
  if (sceneFlag !== undefined) {
    const scene =
      project.scenes.find((item) => item.id === sceneFlag) ??
      (/^\d+$/.test(sceneFlag) ? project.scenes[Number(sceneFlag)] : undefined)
    if (!scene) {
      throw new CliError('E_BAD_SCENE', `找不到场景：${sceneFlag}`, {
        exitCode: 2,
        hint: `现有场景：${project.scenes.map((item) => item.id).join('、')}`,
      })
    }
    return { mode: 'frame', sceneId: scene.id, index: frameFlag ?? 0 }
  }
  if (frameFlag !== undefined) {
    const first = project.scenes[0]
    if (!first) throw new CliError('E_NO_SCENES', '工程里没有场景', { exitCode: 1 })
    return { mode: 'frame', sceneId: first.id, index: frameFlag }
  }
  if (project.meta.title.enabled) return { mode: 'title', sceneId: '', index: 0 }
  const first = project.scenes[0]
  return first ? { mode: 'frame', sceneId: first.id, index: 0 } : null
}

async function cmdServe(parsed: ParsedArgs, r: Reporter) {
  assertKnownFlags(parsed.flags, [
    'port',
    'host',
    'no-build',
    'scene',
    'frame',
    'title',
    'engine',
    'assets-dir',
    'project',
  ])
  const input = parsed.positionals[0] || flagString(parsed.flags, 'project') || '.'
  const preview = await preparePreview(input, parsed.flags, {
    noBuild: flagBool(parsed.flags, 'no-build'),
  })
  const query = resolveShotQuery(preview.project, parsed.flags)
  const server = await startServer(preview.dir, {
    port: flagNumber(parsed.flags, 'port') ?? 0,
    host: flagString(parsed.flags, 'host') ?? '127.0.0.1',
    shot: query ?? undefined,
  })

  r.log(`预览已启动：${server.url}`)
  r.log(`目录：${preview.dir}`)
  if (query) r.log(`定格入口：${server.url}__shot.html`)
  r.log('按 Ctrl+C 停止。')
  r.ok({ url: server.url, port: server.port, dir: preview.dir, scene: query })

  const shutdown = () => {
    void server.close().then(() => process.exit(0))
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

async function cmdShot(parsed: ParsedArgs, r: Reporter) {
  assertKnownFlags(parsed.flags, [
    'out',
    'scene',
    'frame',
    'title',
    'size',
    'wait',
    'browser',
    'engine',
    'assets-dir',
    'project',
    'no-sandbox',
  ])
  const input = parsed.positionals[0] || flagString(parsed.flags, 'project') || '.'
  const preview = await preparePreview(input, parsed.flags)
  const query = resolveShotQuery(preview.project, parsed.flags)
  const { width, height } = parseSize(flagString(parsed.flags, 'size') || '1280x720')
  const wait = flagNumber(parsed.flags, 'wait') ?? 4000

  const browser = findBrowser(flagString(parsed.flags, 'browser'))
  if (!browser) {
    throw new CliError('E_NO_BROWSER', '找不到可用的浏览器', {
      exitCode: 2,
      hint: '安装 Chrome / Edge，或设置 GALASTAR_CHROME 指向可执行文件',
    })
  }

  /* 工程 / 工程包 → <根>/.galastar/preview.png；已构建目录 → <目录>/.galastar/preview.png */
  const defaultOut = preview.project
    ? path.join(preview.dir, '..', 'preview.png')
    : path.join(preview.dir, '.galastar', 'preview.png')
  const out = path.resolve(flagString(parsed.flags, 'out') || defaultOut)
  mkdirSync(path.dirname(out), { recursive: true })

  const server = await startServer(preview.dir, { port: 0, shot: query ?? undefined })
  const url = query ? `${server.url}__shot.html` : server.url
  try {
    const result = await captureScreenshot(browser, url, out, {
      width,
      height,
      wait,
      noSandbox: flagBool(parsed.flags, 'no-sandbox'),
      expectReady: query !== null,
    })
    if (server.stats.notFound > 0) {
      throw new CliError('E_SHOT_404', `预览期间有 ${server.stats.notFound} 个请求 404`, {
        exitCode: 1,
        hint: `未找到：${server.stats.notFoundPaths.join('、') || '（未知）'}；先跑 galastar validate`,
        data: {
          image: out,
          notFound: server.stats.notFound,
          notFoundPaths: server.stats.notFoundPaths,
        },
      })
    }
    r.log(`截图：${out}（${formatBytes(result.bytes)} · ${width}×${height}）`)
    r.log(`浏览器：${result.checks.browser}`)
    r.ok({
      image: out,
      width,
      height,
      bytes: result.bytes,
      scene: query,
      checks: { ...result.checks, notFound: server.stats.notFound },
    })
  } finally {
    await server.close()
  }
}

function parseSize(raw: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(raw)
  if (!match) throw new UsageError('--size 的格式是 1280x720')
  return { width: Number(match[1]), height: Number(match[2]) }
}

/* ------------------------------------------------------------------ *
 * 杂项
 * ------------------------------------------------------------------ */

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function printHelp(r: Reporter, topic?: string) {
  if (
    topic === 'init' ||
    topic === 'validate' ||
    topic === 'build' ||
    topic === 'serve' ||
    topic === 'shot'
  ) {
    r.log(`用法：galastar ${topic} —— 详细参数见 docs/specs/galastar-cli.md`)
    r.log('')
  }
  r.log(`galastar ${cliVersion()} · GalGame IDE 的命令行作者工具`)
  r.log('')
  r.log('用法：galastar <命令> [参数] [--json]')
  r.log('')
  r.log('命令：')
  r.log('  init [名字|路径]        新建工程（默认落在 ~/Documents/GalastarWorks/）')
  r.log('                          --template blank|demo --workspace <dir>')
  r.log('  asset add <文件...|--url <链接>>  添加素材（--kind background|sprite|bgm|voice|sfx）')
  r.log('  validate [dir]          校验工程（结构、引用、素材文件）')
  r.log('  build [dir]             打包（--format web|archive|both）')
  r.log('  serve [dir]             构建并本地预览')
  r.log('  shot [dir]              构建 + 截图（--scene / --frame / --title）')
  r.log('  doctor                  自检 Node、播放器、浏览器')
  r.log('')
  r.log('示例：')
  r.log('  galastar init my-story                # → ~/Documents/GalastarWorks/my-story')
  r.log('  galastar init demo --template demo')
  r.log('  galastar validate demo')
  r.log('  galastar build demo')
  r.log('  galastar shot demo --out demo/.galastar/preview.png')
  r.log('')
  r.log('所有命令都支持 --json：stdout 只输出一个 JSON 对象，日志走 stderr。')
  r.log(
    `素材前缀：${Object.entries(ASSET_PREFIX)
      .map(([key, value]) => `${key}=${value}-`)
      .join(' ')}`,
  )
  r.log('文档：docs/specs/galastar-cli.md · .claude/skills/galastar/SKILL.md')
  r.log(`仓库：${REPO_ROOT}`)
}

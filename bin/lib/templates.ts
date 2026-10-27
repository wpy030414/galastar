/**
 * `galastar init` 的两种模板。
 *
 * blank：一个能立刻 validate / build 的最小工程；
 * demo：带背景、立绘、分支与两个结局，用来验证整条链路（也方便截图）。
 * 两者都用可读 id，Agent 改 JSON 时不用在随机字符串里找目标。
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Locale, Project } from '@/lib/types'
import { TEMPLATE_DIR } from './paths'
import { CliError } from './output'

export type TemplateName = 'blank' | 'demo'

export interface ScaffoldOptions {
  dir: string
  template: TemplateName
  name?: string
  author?: string
  locale: Locale
  force?: boolean
}

const GITIGNORE = `# Galastar 构建产物与预览缓存
dist/
.galastar/
`

function blankProject(name: string, author: string, locale: Locale): Project {
  const now = Date.now()
  return {
    meta: {
      id: `p_${now.toString(36)}`,
      name,
      author,
      description: '',
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      stage: { width: 1280, height: 720 },
      theme: { accent: '#9d8cff', skin: 'pgf' },
      locale,
      title: { enabled: true, subtitle: '', background: null },
    },
    scenes: [
      {
        id: 'scene-1',
        name: locale === 'en' ? 'Act one' : '第一幕',
        frames: [
          {
            id: 'line-1',
            type: 'line',
            speaker: { characterId: null, name: '' },
            innerVoice: false,
            text: locale === 'en' ? 'The curtain rises.' : '大幕拉开了。',
            bg: null,
            bgm: null,
            sfx: null,
            voice: null,
            cast: { left: null, center: null, right: null },
            transition: 'fade',
            shake: false,
          },
        ],
      },
    ],
    characters: [],
    flags: [],
    assets: [],
  }
}

export function scaffoldProject(opts: ScaffoldOptions): { files: string[] } {
  const dir = path.resolve(opts.dir)
  const projectFile = path.join(dir, 'project.json')
  if (existsSync(projectFile) && !opts.force) {
    throw new CliError('E_EXISTS', `目录里已经有 project.json：${dir}`, {
      exitCode: 3,
      path: dir,
      hint: '换一个空目录，或加 --force 覆盖',
    })
  }
  mkdirSync(dir, { recursive: true })
  const files: string[] = []

  if (opts.template === 'demo') {
    const template = path.join(TEMPLATE_DIR, 'demo')
    if (!existsSync(template)) {
      throw new CliError('E_TEMPLATE', `找不到模板目录：${template}`, { exitCode: 2 })
    }
    cpSync(template, dir, { recursive: true })
    /* 远程素材不需要本地文件，但保留 assets/ 方便之后再补本地素材 */
    mkdirSync(path.join(dir, 'assets'), { recursive: true })
    const project = JSON.parse(readFileSync(projectFile, 'utf8')) as Project
    if (opts.name) project.meta.name = opts.name
    if (opts.author) project.meta.author = opts.author
    project.meta.locale = opts.locale
    project.meta.updatedAt = Date.now()
    writeFileSync(projectFile, `${JSON.stringify(project, null, 2)}\n`)
    files.push('project.json')
    const assets = path.join(dir, 'assets')
    if (existsSync(assets)) {
      for (const entry of readdirSync(assets)) files.push(`assets/${entry}`)
    }
  } else {
    const name = opts.name || (opts.locale === 'en' ? 'Untitled work' : '未命名作品')
    const project = blankProject(name, opts.author || '', opts.locale)
    mkdirSync(path.join(dir, 'assets'), { recursive: true })
    writeFileSync(projectFile, `${JSON.stringify(project, null, 2)}\n`)
    files.push('project.json', 'assets/')
  }

  const gitignore = path.join(dir, '.gitignore')
  if (!existsSync(gitignore)) {
    writeFileSync(gitignore, GITIGNORE)
    files.push('.gitignore')
  }

  return { files }
}

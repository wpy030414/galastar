import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Copy,
  FileArchive,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import type { Project } from '@/lib/types'
import {
  createDemoProject,
  createProject,
  DEMO_FILE_MAP,
  demoAssetFiles,
  summarize,
} from '@/lib/project'
import {
  getBlob,
  getProjectBlobs,
  listProjects,
  putBlob,
  readProject,
  removeProject,
  writeProject,
} from '@/lib/db'
import { importAssetFile } from '@/lib/assets'
import { importProjectFile } from '@/lib/pack'
import { cn, formatDate, relativeTime, uid } from '@/lib/utils'
import { Button, Dialog, EmptyState, Field, Input, Menu, MenuItem, useToast } from '@/components/ui'

const SEED_FLAG = 'galastar:seeded'

/** 首次访问自动准备一份示例作品，打开就能玩，也能立刻看清编辑器能做什么 */
let seedLock: Promise<boolean> | null = null

function ensureDemoProject(): Promise<boolean> {
  if (!seedLock) seedLock = seedDemo()
  return seedLock
}

async function seedDemo(): Promise<boolean> {
  if (localStorage.getItem(SEED_FLAG)) return false
  const existing = await listProjects()
  if (existing.length > 0) {
    localStorage.setItem(SEED_FLAG, '1')
    return false
  }
  const { project, slots } = createDemoProject()
  const files = demoAssetFiles()
  for (const item of DEMO_FILE_MAP) {
    const file = files.find((f) => f.name === item.file)
    if (!file) continue
    const record = await importAssetFile(
      project.meta.id,
      file,
      item.kind,
      project.assets,
      slots[item.key],
    )
    project.assets.push(record)
  }
  await writeProject(project)
  localStorage.setItem(SEED_FLAG, '1')
  return true
}

export function LibraryView({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [author, setAuthor] = useState('')
  const [importing, setImporting] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null)
  const [covers, setCovers] = useState<Record<string, string>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const reload = useCallback(async () => {
    setProjects(await listProjects())
  }, [])

  useEffect(() => {
    void (async () => {
      await ensureDemoProject()
      await reload()
    })()
  }, [reload])

  /* 用作品标题背景做封面，没有背景就用程序化渐变 */
  useEffect(() => {
    if (!projects) return
    let cancelled = false
    const urls: string[] = []
    void (async () => {
      const next: Record<string, string> = {}
      for (const project of projects.slice(0, 24)) {
        const bgId = project.meta.title.background
        if (!bgId) continue
        const blob = await getBlob(project.meta.id, bgId)
        if (!blob) continue
        const url = URL.createObjectURL(blob)
        urls.push(url)
        next[project.meta.id] = url
      }
      if (cancelled) {
        urls.forEach((u) => URL.revokeObjectURL(u))
        return
      }
      setCovers(next)
    })()
    return () => {
      cancelled = true
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [projects])

  const totals = useMemo(() => {
    if (!projects) return { scenes: 0, frames: 0, assets: 0 }
    return projects.reduce(
      (acc, p) => {
        const s = summarize(p)
        return {
          scenes: acc.scenes + s.sceneCount,
          frames: acc.frames + s.frameCount,
          assets: acc.assets + p.assets.length,
        }
      },
      { scenes: 0, frames: 0, assets: 0 },
    )
  }, [projects])

  const createNew = async () => {
    const project = createProject(name.trim() || '未命名作品', author.trim())
    await writeProject(project)
    setCreateOpen(false)
    setName('')
    setAuthor('')
    onOpen(project.meta.id)
  }

  const loadDemo = async () => {
    setSeeding(true)
    try {
      const { project, slots } = createDemoProject()
      const files = demoAssetFiles()
      for (const item of DEMO_FILE_MAP) {
        const file = files.find((f) => f.name === item.file)
        if (!file) continue
        const record = await importAssetFile(
          project.meta.id,
          file,
          item.kind,
          project.assets,
          slots[item.key],
        )
        project.assets.push(record)
      }
      await writeProject(project)
      await reload()
      toast('示例作品已创建', 'success')
    } finally {
      setSeeding(false)
    }
  }

  const handleImport = async (file: File) => {
    setImporting(true)
    try {
      const { project, files } = await importProjectFile(file)
      const clash = await readProject(project.meta.id)
      if (clash) project.meta.id = uid('p')
      for (const item of files) await putBlob(project.meta.id, item.assetId, item.blob)
      project.meta.updatedAt = Date.now()
      await writeProject(project)
      await reload()
      toast(`已导入《${project.meta.name}》`, 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : '导入失败', 'error')
    } finally {
      setImporting(false)
    }
  }

  const duplicate = async (source: Project) => {
    const copy = structuredClone(source)
    copy.meta.id = uid('p')
    copy.meta.name = `${source.meta.name} 副本`
    copy.meta.createdAt = Date.now()
    copy.meta.updatedAt = Date.now()
    const blobs = await getProjectBlobs(source.meta.id)
    await writeProject(copy)
    for (const asset of copy.assets) {
      const blob = blobs.get(asset.id)
      if (blob) await putBlob(copy.meta.id, asset.id, blob)
    }
    await reload()
    toast('已复制作品', 'success')
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    await removeProject(pendingDelete.meta.id)
    setPendingDelete(null)
    await reload()
    toast('作品已删除')
  }

  return (
    <div className="relative min-h-full overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 aurora" />
        <div className="absolute inset-0 starfield opacity-[0.5]" />
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-background/40 to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-[1240px] px-8 pb-20 pt-14">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <LogoMark />
              <span className="text-[11px] font-medium tracking-[0.32em] text-muted-foreground/70">
                GALASTAR
              </span>
              <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground/60">
                v2.0
              </span>
            </div>
            <h1 className="text-[38px] font-semibold leading-tight tracking-tight">
              把故事放进<span className="text-primary">星空</span>里
            </h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              可视化编排台词、立绘与分支，实时预览，一键打包成可离线游玩的 Web 作品。
              <br />
              不需要写一行 JSON。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".galastar,.zip,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleImport(file)
                e.target.value = ''
              }}
            />
            <Button
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              导入工程
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              新建作品
            </Button>
          </div>
        </header>

        <div className="mt-10 flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[13px] font-medium tracking-wide text-foreground/80">我的作品</h2>
            <span className="font-mono text-[11px] text-muted-foreground/50">
              {projects?.length ?? 0} 部 · {totals.scenes} 幕 · {totals.frames} 帧 · {totals.assets}{' '}
              素材
            </span>
          </div>
          <span className="hidden text-[11px] text-muted-foreground/40 sm:block">
            全部数据保存在本机浏览器
          </span>
        </div>

        {projects === null ? (
          <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            正在读取本地作品…
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-14">
            <EmptyState
              icon={<Sparkles className="h-8 w-8" />}
              title="还没有作品"
              hint="从零开始，或者先看看示例作品长什么样。"
              action={
                <div className="mt-2 flex gap-2">
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    新建作品
                  </Button>
                  <Button variant="secondary" onClick={() => void loadDemo()} disabled={seeding}>
                    {seeding ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FolderOpen className="h-3.5 w-3.5" />
                    )}
                    载入示例作品
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NewCard onClick={() => setCreateOpen(true)} />
            {projects.map((project) => (
              <ProjectCard
                key={project.meta.id}
                project={project}
                cover={covers[project.meta.id]}
                onOpen={() => onOpen(project.meta.id)}
                onDuplicate={() => void duplicate(project)}
                onDelete={() => setPendingDelete(project)}
              />
            ))}
          </div>
        )}

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-5 text-[11px] text-muted-foreground/40">
          <span>Galastar · Galgame 创作引擎</span>
          <span className="flex items-center gap-1.5">
            <FileArchive className="h-3 w-3" />
            导出产物为纯静态站点，可放到任意静态托管
          </span>
        </footer>
      </div>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="新建作品"
        description="之后可以随时在项目设置里修改。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={() => void createNew()}>
              创建并开始
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="作品名">
            <Input
              autoFocus
              value={name}
              placeholder="例如：星のかけら"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createNew()
              }}
            />
          </Field>
          <Field label="作者">
            <Input
              value={author}
              placeholder="署名，可留空"
              onChange={(e) => setAuthor(e.target.value)}
            />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="删除作品"
        description="该操作会同时清除作品的剧本与全部素材，无法撤销。建议先导出工程备份。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()}>
              <Trash2 className="h-3.5 w-3.5" />
              确认删除
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground/80">
          确定删除《{pendingDelete?.meta.name}》吗？
          <span className="mt-1 block text-xs text-muted-foreground">
            {pendingDelete
              ? `${pendingDelete.scenes.length} 个场景 · ${pendingDelete.assets.length} 个素材`
              : ''}
          </span>
        </p>
      </Dialog>
    </div>
  )
}

function ProjectCard({
  project,
  cover,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  project: Project
  cover?: string
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const summary = summarize(project)
  const hue = useMemo(() => hashHue(project.meta.id), [project.meta.id])
  const initial = project.meta.name.trim().slice(0, 1) || 'G'

  return (
    <div className="group relative">
      <button
        onClick={onOpen}
        className="flex w-full flex-col overflow-hidden rounded-xl border border-border/70 bg-panel text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_24px_60px_-32px_hsl(var(--primary)/0.6)]"
      >
        <div
          className="relative aspect-[16/9] w-full overflow-hidden"
          style={{
            background: `linear-gradient(135deg, hsl(${hue} 55% 20%), hsl(${(hue + 40) % 360} 60% 9%))`,
          }}
        >
          {cover ? (
            <img
              src={cover}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-80"
            />
          ) : (
            <div className="absolute inset-0 starfield opacity-45" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
          <div
            className="absolute -right-6 -top-10 h-32 w-32 rounded-full blur-2xl"
            style={{ background: `hsl(${(hue + 20) % 360} 90% 60% / 0.35)` }}
          />
          <span className="absolute bottom-3 left-4 text-[26px] font-semibold tracking-[0.2em] text-white/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
            {initial}
          </span>
          <div className="absolute bottom-3 right-3 flex gap-1">
            <span className="rounded border border-white/15 bg-black/40 px-1.5 py-0.5 text-[10px] text-white/70 backdrop-blur">
              {summary.sceneCount} 幕
            </span>
            <span className="rounded border border-white/15 bg-black/40 px-1.5 py-0.5 text-[10px] text-white/70 backdrop-blur">
              {summary.frameCount} 帧
            </span>
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="truncate text-[14.5px] font-medium text-foreground">{project.meta.name}</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground/60">
            {project.meta.author || '未署名'} · {relativeTime(project.meta.updatedAt)}
          </p>
        </div>
      </button>

      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <Menu
          trigger={
            <button
              className="rounded-md border border-white/10 bg-black/45 p-1.5 text-white/70 backdrop-blur transition-colors hover:text-white"
              aria-label="作品操作"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          }
        >
          {(close) => (
            <>
              <MenuItem
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={() => {
                  onDuplicate()
                  close()
                }}
              >
                创建副本
              </MenuItem>
              <MenuItem
                danger
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => {
                  onDelete()
                  close()
                }}
              >
                删除作品
              </MenuItem>
              <div className="mt-1 border-t border-border/60 px-2.5 pb-1 pt-1.5 font-mono text-[9px] text-muted-foreground/40">
                更新于 {formatDate(project.meta.updatedAt)}
              </div>
            </>
          )}
        </Menu>
      </div>
    </div>
  )
}

function NewCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 text-muted-foreground/60 transition-all',
        'hover:border-primary/50 hover:bg-primary/[0.04] hover:text-primary',
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-current/30">
        <Plus className="h-4 w-4" />
      </span>
      <span className="text-[12px]">新建作品</span>
    </button>
  )
}

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-primary" aria-hidden>
      <path
        d="M12 2c.4 3.6 2.4 5.6 6 6-3.6.4-5.6 2.4-6 6-.4-3.6-2.4-5.6-6-6 3.6-.4 5.6-2.4 6-6Z"
        fill="currentColor"
      />
      <circle cx="6" cy="19" r="1.5" fill="hsl(var(--star))" />
      <circle cx="18.5" cy="20" r="1" fill="hsl(var(--star))" opacity=".6" />
    </svg>
  )
}

function hashHue(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 360
  return hash
}

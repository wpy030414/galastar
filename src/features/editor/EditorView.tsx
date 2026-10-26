import { useEffect, useState } from 'react'
import { ArrowLeft, Download, Redo2, Settings2, Undo2 } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { Button, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { LeftRail } from './LeftRail'
import { StagePreview } from './StagePreview'
import { FrameStrip } from './FrameStrip'
import { Inspector } from './Inspector'
import { ProjectSettingsDialog } from './ProjectSettingsDialog'
import { ExportDialog } from './ExportDialog'

export function EditorView() {
  const { project, dirty, saving, patchMeta, saveNow, close, undo, redo, canUndo, canRedo } =
    useEditor()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const toast = useToast()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        void saveNow().then(() => toast('作品已保存到本地', 'success'))
      }
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
      if (key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveNow, toast, undo, redo])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="toolbar flex h-[52px] shrink-0 items-center gap-3 border-b border-border/60 px-3">
        <Button variant="ghost" size="icon" onClick={close} title="返回作品库（自动保存）">
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <LogoMark />
          <div className="hidden items-baseline gap-1.5 sm:flex">
            <span className="text-[11px] font-semibold tracking-[0.2em] text-foreground/50">
              GALASTAR
            </span>
          </div>
        </div>

        <div className="mx-1 h-4 w-px bg-border/70" />

        <div className="flex min-w-0 items-center gap-2">
          <input
            value={project.meta.name}
            onChange={(e) => patchMeta({ name: e.target.value })}
            className="min-w-0 max-w-[260px] truncate rounded border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] font-medium text-foreground outline-none transition-colors hover:border-border/60 focus:border-primary/50 focus:bg-raised/50"
            placeholder="作品名"
          />
          <span className="hidden truncate text-[11px] text-muted-foreground/50 md:inline">
            {project.meta.author || '未署名'}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="mr-1 flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={undo}
              disabled={!canUndo}
              title="撤销 Ctrl+Z"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={redo}
              disabled={!canRedo}
              title="重做 Ctrl+Shift+Z"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <span
            className={cn(
              'mr-1 hidden items-center gap-1.5 text-[11px] sm:flex',
              dirty ? 'text-muted-foreground/70' : 'text-emerald-400/70',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                saving ? 'animate-pulse bg-star' : dirty ? 'bg-star/70' : 'bg-emerald-400/80',
              )}
            />
            {saving ? '保存中…' : dirty ? '有改动' : '已保存'}
          </span>

          <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />
            项目设置
          </Button>
          <Button variant="primary" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="h-3.5 w-3.5" />
            打包作品
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <LeftRail />
        <main className="flex min-w-0 flex-1 flex-col">
          <StagePreview />
          <FrameStrip />
        </main>
        <Inspector />
      </div>

      <ProjectSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary" aria-hidden>
      <path
        d="M12 2c.4 3.6 2.4 5.6 6 6-3.6.4-5.6 2.4-6 6-.4-3.6-2.4-5.6-6-6 3.6-.4 5.6-2.4 6-6Z"
        fill="currentColor"
      />
      <circle cx="6" cy="19" r="1.5" fill="hsl(var(--star))" />
      <circle cx="18.5" cy="20" r="1" fill="hsl(var(--star))" opacity=".6" />
    </svg>
  )
}

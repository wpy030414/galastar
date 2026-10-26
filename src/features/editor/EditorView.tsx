import { useEffect, useState } from 'react'
import { ArrowLeft, PackageOpen, Redo2, Settings2, SlidersHorizontal, Undo2 } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { useI18n } from '@/i18n'
import { Button, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { LeftRail } from './LeftRail'
import { StagePreview } from './StagePreview'
import { FrameStrip } from './FrameStrip'
import { Inspector } from './Inspector'
import { ProjectSettingsDialog } from './ProjectSettingsDialog'
import { PreferencesDialog } from './PreferencesDialog'
import { ExportDialog } from './ExportDialog'

export function EditorView() {
  const { dirty, saving, saveNow, close, undo, redo, canUndo, canRedo } = useEditor()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const toast = useToast()
  const { t } = useI18n()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        void saveNow().then(() => toast(t('toolbar.savedToast'), 'success'))
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
  }, [saveNow, toast, t, undo, redo])

  const saveState = saving
    ? t('toolbar.state.saving')
    : dirty
      ? t('toolbar.state.dirty')
      : t('toolbar.state.saved')

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="toolbar flex h-[52px] shrink-0 items-center gap-3 border-b border-border/60 px-3">
        <Button variant="ghost" size="icon" onClick={close} title={t('toolbar.back')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="hidden text-[11px] font-semibold tracking-[0.2em] text-foreground/50 sm:inline">
            GALASTAR
          </span>
        </div>
        <TopbarDivider />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSettingsOpen(true)}
          title={t('toolbar.projectTip')}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {t('toolbar.project')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPrefsOpen(true)}
          title={t('toolbar.preferencesTip')}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t('toolbar.preferences')}
        </Button>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={undo}
              disabled={!canUndo}
              title={t('toolbar.undo')}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={redo}
              disabled={!canRedo}
              title={t('toolbar.redo')}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <TopbarDivider className="hidden sm:block" />

          <span
            className={cn(
              'hidden items-center gap-1.5 text-[11px] sm:flex',
              dirty ? 'text-muted-foreground/70' : 'text-success/70',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                saving ? 'animate-pulse bg-star' : dirty ? 'bg-star/70' : 'bg-success/80',
              )}
            />
            {saveState}
          </span>

          <TopbarDivider />

          <Button variant="primary" size="sm" onClick={() => setExportOpen(true)}>
            <PackageOpen className="h-3.5 w-3.5" />
            {t('toolbar.export')}
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
      <PreferencesDialog open={prefsOpen} onClose={() => setPrefsOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}

/** 顶栏分段竖线，留白量集中在此处，避免两侧各自补偿 gap 而走样 */
function TopbarDivider({ className }: { className?: string }) {
  return <div className={cn('mx-0.5 h-4 w-px bg-border/70', className)} aria-hidden />
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

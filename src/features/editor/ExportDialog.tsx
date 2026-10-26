import { useState } from 'react'
import { Check, Download, FileArchive, Globe, Loader2, Package } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { useI18n, type MessageKey } from '@/i18n'
import {
  archiveFileName,
  exportPlayableZip,
  exportProjectArchive,
  zipFileName,
  type PackStage,
} from '@/lib/pack'
import { downloadBlob, formatBytes } from '@/lib/utils'
import { Button, Dialog, useToast } from '@/components/ui'

const STAGE_KEYS: Record<PackStage, MessageKey> = {
  player: 'pack.progress.player',
  assets: 'pack.progress.assets',
  zip: 'pack.progress.zip',
  done: 'pack.progress.done',
}

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project } = useEditor()
  const { t } = useI18n()
  const toast = useToast()
  const [busy, setBusy] = useState<'web' | 'archive' | null>(null)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<{ label: string; name: string; size: number } | null>(null)

  const totalSize = project.assets.reduce((sum, a) => sum + a.size, 0)

  const run = async (kind: 'web' | 'archive') => {
    setBusy(kind)
    setResult(null)
    setProgress(0)
    try {
      const onProgress = (stage: PackStage, ratio: number) => {
        setMessage(t(STAGE_KEYS[stage]))
        setProgress(ratio)
      }
      if (kind === 'web') {
        const blob = await exportPlayableZip(project, onProgress)
        const name = zipFileName(project)
        downloadBlob(blob, name)
        setResult({ label: t('export.result.web'), name, size: blob.size })
      } else {
        const blob = await exportProjectArchive(project, onProgress)
        const name = archiveFileName(project)
        downloadBlob(blob, name)
        setResult({ label: t('export.result.archive'), name, size: blob.size })
      }
      toast(t('export.toast.done'), 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : t('export.toast.failed'), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('export.title')}
      description={t('export.description')}
      width="max-w-2xl"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <ExportCard
            icon={<Globe className="h-4 w-4" />}
            title={t('export.web.title')}
            description={t('export.web.desc')}
            meta={t('export.web.meta', {
              n: project.assets.length,
              size: formatBytes(totalSize),
            })}
            button={t('export.web.button')}
            busy={busy === 'web'}
            disabled={busy !== null}
            primary
            onClick={() => void run('web')}
          />
          <ExportCard
            icon={<FileArchive className="h-4 w-4" />}
            title={t('export.archive.title')}
            description={t('export.archive.desc')}
            meta={t('export.archive.meta')}
            button={t('export.archive.button')}
            busy={busy === 'archive'}
            disabled={busy !== null}
            onClick={() => void run('archive')}
          />
        </div>

        {busy ? (
          <div className="rounded-lg border border-border/60 bg-raised/30 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                {message || t('export.preparing')}
              </span>
              <span className="font-mono">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-border/70">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.max(progress * 100, 6)}%` }}
              />
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/[0.07] p-3 text-[12px] text-success">
            <Check className="h-3.5 w-3.5" />
            {t('export.result.generated', {
              label: result.label,
              name: result.name,
              size: formatBytes(result.size),
            })}
          </div>
        ) : null}

        <div className="rounded-lg border border-border/60 bg-foreground/[0.04] p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Package className="h-3 w-3" />
            {t('export.structure')}
          </div>
          <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-muted-foreground/70">
            {t('export.structureBody')}
          </pre>
        </div>
      </div>
    </Dialog>
  )
}

function ExportCard({
  icon,
  title,
  description,
  meta,
  button,
  onClick,
  busy,
  disabled,
  primary,
}: {
  icon: React.ReactNode
  title: string
  description: string
  meta: string
  button: string
  onClick: () => void
  busy: boolean
  disabled?: boolean
  primary?: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col justify-between gap-3 rounded-lg border border-border/70 bg-raised/20 p-3.5">
      <div>
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
          <span className={primary ? 'text-primary' : 'text-muted-foreground'}>{icon}</span>
          {title}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/70">{description}</p>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground/45">{meta}</p>
      </div>
      <Button
        variant={primary ? 'primary' : 'secondary'}
        size="sm"
        onClick={onClick}
        disabled={disabled}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
        {busy ? t('export.busy') : button}
      </Button>
    </div>
  )
}

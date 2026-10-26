import { useState } from 'react'
import { Check, Download, FileArchive, Globe, Loader2, Package } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { archiveFileName, exportPlayableZip, exportProjectArchive, zipFileName } from '@/lib/pack'
import { downloadBlob, formatBytes } from '@/lib/utils'
import { Button, Dialog, useToast } from '@/components/ui'

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project } = useEditor()
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
      const onProgress = (msg: string, ratio: number) => {
        setMessage(msg)
        setProgress(ratio)
      }
      if (kind === 'web') {
        const blob = await exportPlayableZip(project, onProgress)
        const name = zipFileName(project)
        downloadBlob(blob, name)
        setResult({ label: '可游玩 Web Zip', name, size: blob.size })
      } else {
        const blob = await exportProjectArchive(project, onProgress)
        const name = archiveFileName(project)
        downloadBlob(blob, name)
        setResult({ label: '工程备份包', name, size: blob.size })
      }
      toast('打包完成，已开始下载', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : '打包失败', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="打包作品"
      description="生成的文件完全离线运行，解压后双击 start.html 即可游玩。"
      width="max-w-2xl"
      footer={
        <Button variant="ghost" onClick={onClose}>
          关闭
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <ExportCard
            icon={<Globe className="h-4 w-4" />}
            title="Web 作品包"
            description="玩家拿到的最终产物：start.html + 播放器 + 素材。双击即玩，无需联网。"
            meta={`${project.assets.length} 个素材 · 约 ${formatBytes(totalSize)}`}
            button="打包并下载"
            busy={busy === 'web'}
            disabled={busy !== null}
            primary
            onClick={() => void run('web')}
          />
          <ExportCard
            icon={<FileArchive className="h-4 w-4" />}
            title="工程备份包"
            description="含 project.json 与全部素材，用于换设备继续编辑或备份存档。"
            meta=".galastar"
            button="导出工程"
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
                {message || '准备中…'}
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
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] p-3 text-[12px] text-emerald-300">
            <Check className="h-3.5 w-3.5" />
            {result.label}已生成：{result.name}（{formatBytes(result.size)}）
          </div>
        ) : null}

        <div className="rounded-lg border border-border/60 bg-black/20 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Package className="h-3 w-3" />
            压缩包结构
          </div>
          <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-muted-foreground/70">{`start.html        ← 双击打开
galastar.js       ← 播放器运行时（与编辑器预览同一份代码）
galastar.css
data.js           ← 剧本与素材索引（script 注入，file:// 也能读）
media/            ← 背景、立绘、音乐、语音、音效`}</pre>
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
        {busy ? '打包中…' : button}
      </Button>
    </div>
  )
}

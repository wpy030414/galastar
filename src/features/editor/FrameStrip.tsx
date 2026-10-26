import {
  ArrowDownUp,
  Copy,
  Flag,
  GitBranch,
  Image as ImageIcon,
  Mic,
  Plus,
  Trash2,
  Type,
} from 'lucide-react'
import type { Frame } from '@/lib/types'
import { useEditor } from '@/store/editor'
import { useI18n, type I18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

const TYPE_META: Record<
  Frame['type'],
  {
    labelKey: 'frames.type.line' | 'frames.type.choice' | 'frames.type.jump' | 'frames.type.end'
    className: string
    icon: typeof Type
  }
> = {
  line: {
    labelKey: 'frames.type.line',
    className: 'bg-primary/15 text-primary border-primary/25',
    icon: Type,
  },
  choice: {
    labelKey: 'frames.type.choice',
    className: 'bg-star/15 text-star border-star/25',
    icon: GitBranch,
  },
  jump: {
    labelKey: 'frames.type.jump',
    className: 'bg-info/15 text-info border-info/25',
    icon: ArrowDownUp,
  },
  end: {
    labelKey: 'frames.type.end',
    className: 'bg-destruct/15 text-destruct border-destruct/25',
    icon: Trash2,
  },
}

function framePreview(frame: Frame, speaker: string, { t }: I18n): string {
  switch (frame.type) {
    case 'line':
      if (!frame.text) return t('frames.preview.emptyLine')
      return speaker
        ? t('frames.preview.lineWithSpeaker', { speaker, text: frame.text })
        : frame.text
    case 'choice':
      return frame.options.map((o) => o.text || t('frames.preview.untitledOption')).join('  /  ')
    case 'jump':
      return frame.requires
        ? t('frames.preview.jumpCond', {
            key: frame.requires.key,
            op: frame.requires.op,
            value: frame.requires.value,
          })
        : t('frames.preview.jump')
    case 'end':
      return t('frames.preview.end', {
        kind: frame.kind === 'ending' ? t('frames.preview.ending') : t('frames.preview.chapter'),
        title: frame.title || t('frames.preview.untitled'),
      })
    default:
      return ''
  }
}

export function FrameStrip() {
  const { project, scene, frameId, selectFrame, addFrame, removeFrame, duplicateFrame, moveFrame } =
    useEditor()
  const i18n = useI18n()
  const { t } = i18n

  return (
    <div className="flex h-[252px] shrink-0 flex-col border-t border-border/60 bg-panel/30">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            {t('frames.title')}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/40">
            {scene.frames.length}
          </span>
          <span className="mx-1 h-3 w-px bg-border/60" />
          <span className="max-w-[220px] truncate text-[11px] text-muted-foreground/55">
            {scene.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addFrame('line')}
            title={t('frames.insert.line')}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('frames.type.line')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addFrame('choice')}
            title={t('frames.insert.choice')}
          >
            <GitBranch className="h-3.5 w-3.5" />
            {t('frames.type.choice')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addFrame('jump')}
            title={t('frames.insert.jump')}
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            {t('frames.type.jump')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addFrame('end')}
            title={t('frames.insert.end')}
          >
            <Flag className="h-3.5 w-3.5" />
            {t('frames.type.end')}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {scene.frames.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-xs text-muted-foreground/60">{t('frames.empty')}</p>
            <Button variant="secondary" size="sm" onClick={() => addFrame('line')}>
              <Plus className="h-3 w-3" />
              {t('frames.emptyCta')}
            </Button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {scene.frames.map((frame, index) => {
              const active = frame.id === frameId
              const meta = TYPE_META[frame.type]
              const Icon = meta.icon
              const speaker =
                frame.type === 'line'
                  ? (project.characters.find((c) => c.id === frame.speaker.characterId)?.name ??
                    frame.speaker.name)
                  : ''
              return (
                <div
                  key={frame.id}
                  onClick={() => selectFrame(frame.id)}
                  className={cn(
                    'group flex cursor-pointer items-center gap-2 rounded-md border border-transparent py-1 pl-2 pr-1 transition-colors',
                    active
                      ? 'border-primary/25 bg-primary/[0.09]'
                      : 'hover:border-border/60 hover:bg-foreground/[0.03]',
                  )}
                >
                  <span className="w-5 shrink-0 font-mono text-[10px] text-muted-foreground/35">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={cn(
                      'flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] leading-none',
                      meta.className,
                    )}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {t(meta.labelKey)}
                  </span>
                  {frame.type === 'line' && frame.voice ? (
                    <Mic className="h-3 w-3 shrink-0 text-primary/60" />
                  ) : null}
                  {frame.type === 'line' && frame.bg ? (
                    <ImageIcon className="h-3 w-3 shrink-0 text-muted-foreground/35" />
                  ) : null}
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-[12.5px]',
                      active ? 'text-foreground' : 'text-foreground/70',
                    )}
                  >
                    {framePreview(frame, speaker, i18n)}
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <IconBtn
                      label={t('frames.action.up')}
                      onClick={() => moveFrame(frame.id, -1)}
                      disabled={index === 0}
                    >
                      ↑
                    </IconBtn>
                    <IconBtn
                      label={t('frames.action.down')}
                      onClick={() => moveFrame(frame.id, 1)}
                      disabled={index === scene.frames.length - 1}
                    >
                      ↓
                    </IconBtn>
                    <IconBtn
                      label={t('frames.action.copy')}
                      onClick={() => duplicateFrame(frame.id)}
                    >
                      <Copy className="h-3 w-3" />
                    </IconBtn>
                    <IconBtn
                      label={t('frames.action.delete')}
                      onClick={() => removeFrame(frame.id)}
                      danger
                    >
                      <Trash2 className="h-3 w-3" />
                    </IconBtn>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded text-[10px] text-muted-foreground/60 transition-colors',
        danger
          ? 'hover:bg-destruct/15 hover:text-destruct'
          : 'hover:bg-foreground/[0.08] hover:text-foreground',
        disabled && 'pointer-events-none opacity-25',
      )}
    >
      {children}
    </button>
  )
}

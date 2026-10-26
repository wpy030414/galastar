import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Ban, Check, ChevronDown, Image as ImageIcon, Music, Plus, Upload } from 'lucide-react'
import type { AssetKind } from '@/lib/types'
import { ASSET_META } from '@/lib/assets'
import { useEditor } from '@/store/editor'
import { useI18n } from '@/i18n'
import { cn, formatBytes } from '@/lib/utils'
import { Button } from '@/components/ui'

const ACCEPT: Record<AssetKind, string> = {
  background: 'image/*',
  sprite: 'image/*',
  bgm: 'audio/*',
  sfx: 'audio/*',
  voice: 'audio/*',
}

const PANEL_WIDTH = 300

/**
 * 素材选择器：按钮 + 浮层网格。
 * 浮层走 portal + fixed 定位，避免被滚动容器裁掉。
 */
export function AssetPicker({
  kind,
  value,
  onChange,
  allowNone = true,
  compact,
  className,
}: {
  kind: AssetKind
  value: string | null
  onChange: (id: string | null) => void
  allowNone?: boolean
  compact?: boolean
  className?: string
}) {
  const { project, assetUrls, addAssets } = useEditor()
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{
    top: number
    left: number
    width: number
    up: boolean
  } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const assets = useMemo(
    () => project.assets.filter((a) => a.kind === kind),
    [project.assets, kind],
  )
  const current = assets.find((a) => a.id === value) ?? null
  const isImage = kind === 'background' || kind === 'sprite'
  const meta = ASSET_META[kind]
  const { t } = useI18n()

  const place = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const width = Math.max(PANEL_WIDTH, r.width)
    const left = Math.min(r.left, window.innerWidth - width - 12)
    const estimated = 320
    const up = r.bottom + estimated > window.innerHeight && r.top > estimated
    setRect({ left, top: up ? r.top : r.bottom + 6, width, up })
  }, [])

  useEffect(() => {
    if (!open) return
    place()
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || btnRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, place])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'group flex w-full items-center gap-2 rounded-md border border-border/80 bg-raised/50 px-2 text-left transition-colors hover:border-border hover:bg-raised/80',
          compact ? 'h-8' : 'h-9',
          open && 'border-primary/50 bg-raised/80',
          className,
        )}
      >
        {current ? (
          isImage ? (
            <img
              src={assetUrls[current.id]}
              alt=""
              className={cn('shrink-0 rounded object-cover', compact ? 'h-5 w-8' : 'h-6 w-10')}
            />
          ) : (
            <Music className="h-3.5 w-3.5 shrink-0 text-primary/70" />
          )
        ) : (
          <span className="flex h-5 w-8 shrink-0 items-center justify-center rounded bg-foreground/[0.04] text-muted-foreground/50">
            {isImage ? <ImageIcon className="h-3 w-3" /> : <Music className="h-3 w-3" />}
          </span>
        )}
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            compact ? 'text-xs' : 'text-sm',
            current ? 'text-foreground/90' : 'text-muted-foreground/60',
          )}
        >
          {current ? current.name : t('picker.none', { kind: t(meta.labelKey) })}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      </button>

      {open && rect
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                position: 'fixed',
                left: rect.left,
                width: rect.width,
                top: rect.up ? undefined : rect.top,
                bottom: rect.up ? window.innerHeight - rect.top + 6 : undefined,
                zIndex: 80,
              }}
              className="overflow-hidden rounded-lg border border-border/80 bg-panel shadow-[0_30px_70px_-30px_#000] animate-scale-in"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-2.5 py-2">
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
                  {t(meta.labelKey)} · {assets.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
                    <Upload className="h-3 w-3" />
                    {t('picker.upload')}
                  </Button>
                  {allowNone ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onChange(null)
                        setOpen(false)
                      }}
                    >
                      <Ban className="h-3 w-3" />
                      {t('picker.clear')}
                    </Button>
                  ) : null}
                </div>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT[kind]}
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length) await addAssets(files, kind)
                  e.target.value = ''
                }}
              />

              <div className="max-h-[248px] overflow-y-auto p-2">
                {assets.length === 0 ? (
                  <div className="px-2 py-6 text-center">
                    <p className="text-xs text-muted-foreground/70">{t('picker.empty', { kind: t(meta.labelKey) })}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/50">{t(meta.hintKey)}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      onClick={() => inputRef.current?.click()}
                    >
                      <Plus className="h-3 w-3" />
                      {t('picker.uploadKind')}
                    </Button>
                  </div>
                ) : isImage ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {assets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        title={`${asset.name}${asset.width ? ` · ${asset.width}×${asset.height}` : ''}`}
                        onClick={() => {
                          onChange(asset.id)
                          setOpen(false)
                        }}
                        className={cn(
                          'group relative aspect-[16/10] overflow-hidden rounded border transition-all',
                          value === asset.id
                            ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary))]'
                            : 'border-border/60 hover:border-border',
                        )}
                      >
                        <img
                          src={assetUrls[asset.id]}
                          alt={asset.name}
                          className="h-full w-full object-cover"
                        />
                        {value === asset.id ? (
                          <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5">
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {assets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => {
                          onChange(asset.id)
                          setOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
                          value === asset.id
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-foreground/[0.05]',
                        )}
                      >
                        <Music className="h-3 w-3 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{asset.name}</span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/50">
                          {formatBytes(asset.size)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

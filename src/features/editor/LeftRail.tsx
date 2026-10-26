import { useRef, useState } from 'react'
import {
  AudioLines,
  ChevronDown,
  Clapperboard,
  Image as ImageIcon,
  Layers,
  Link2,
  MoreHorizontal,
  Plus,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react'
import type { AssetKind, Character } from '@/lib/types'
import { ASSET_KINDS, ASSET_META } from '@/lib/assets'
import { useEditor } from '@/store/editor'
import { useI18n } from '@/i18n'
import { cn, formatBytes } from '@/lib/utils'
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  Field,
  Input,
  Menu,
  MenuItem,
  SectionTitle,
  Tabs,
  useToast,
} from '@/components/ui'
import { AssetPicker } from './AssetPicker'

type RailTab = 'script' | 'asset' | 'cast'

export function LeftRail() {
  const [tab, setTab] = useState<RailTab>('script')
  const { t } = useI18n()
  return (
    <aside className="flex w-[276px] shrink-0 flex-col border-r border-border/60 bg-panel/40">
      <div className="p-2">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            {
              value: 'script',
              label: t('rail.tab.script'),
              icon: <Clapperboard className="h-3.5 w-3.5" />,
            },
            {
              value: 'asset',
              label: t('rail.tab.asset'),
              icon: <Layers className="h-3.5 w-3.5" />,
            },
            { value: 'cast', label: t('rail.tab.cast'), icon: <Users className="h-3.5 w-3.5" /> },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'script' ? <SceneList /> : tab === 'asset' ? <AssetLibrary /> : <CharacterList />}
      </div>
      <RailFooter />
    </aside>
  )
}

/* --------------------------------- 场景 --------------------------------- */

function SceneList() {
  const { project, sceneId, selectScene, addScene, patchScene, removeScene, moveScene } =
    useEditor()
  const { t } = useI18n()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  return (
    <div className="pb-4">
      <SectionTitle
        action={
          <Button variant="ghost" size="icon-sm" onClick={addScene} title={t('rail.newScene')}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        }
      >
        {t('rail.scenes', { n: project.scenes.length })}
      </SectionTitle>

      <div className="space-y-0.5 px-2">
        {project.scenes.map((scene, index) => {
          const active = scene.id === sceneId
          return (
            <div
              key={scene.id}
              onClick={() => selectScene(scene.id)}
              onDoubleClick={() => {
                setEditing(scene.id)
                setDraft(scene.name)
              }}
              className={cn(
                'group flex cursor-pointer items-center gap-2 rounded-md py-1.5 pl-2 pr-1 transition-colors',
                active
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
              )}
            >
              <span className="w-4 shrink-0 font-mono text-[10px] tracking-wider text-muted-foreground/45">
                {String(index + 1).padStart(2, '0')}
              </span>
              {editing === scene.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    if (draft.trim()) patchScene(scene.id, { name: draft.trim() })
                    setEditing(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (draft.trim()) patchScene(scene.id, { name: draft.trim() })
                      setEditing(null)
                    }
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  className="min-w-0 flex-1 rounded border border-primary/50 bg-background px-1 py-0.5 text-[13px] focus:outline-none"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-[13px]">{scene.name}</span>
              )}
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground/35">
                {scene.frames.length}
              </span>
              <span onClick={(e) => e.stopPropagation()}>
                <Menu
                  trigger={
                    <button
                      className="rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                      aria-label={t('rail.sceneMenu')}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  }
                >
                  {(close) => (
                    <>
                      <MenuItem
                        onClick={() => {
                          setEditing(scene.id)
                          setDraft(scene.name)
                          close()
                        }}
                      >
                        {t('common.rename')}
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          moveScene(scene.id, -1)
                          close()
                        }}
                      >
                        {t('common.moveUp')}
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          moveScene(scene.id, 1)
                          close()
                        }}
                      >
                        {t('common.moveDown')}
                      </MenuItem>
                      <MenuItem
                        danger
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => {
                          if (project.scenes.length <= 1) return
                          removeScene(scene.id)
                          close()
                        }}
                      >
                        {t('rail.deleteScene')}
                      </MenuItem>
                    </>
                  )}
                </Menu>
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-4 px-3 text-[11px] leading-relaxed text-muted-foreground/45">
        {t('rail.sceneHint')}
      </p>
    </div>
  )
}

/* --------------------------------- 素材 --------------------------------- */

function AssetLibrary() {
  const { project, assetUrls, addAssets, addRemoteAsset, removeAsset } = useEditor()
  const { t } = useI18n()
  const [kind, setKind] = useState<AssetKind>('background')
  const [dragging, setDragging] = useState(false)
  const [urlOpen, setUrlOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const [urlName, setUrlName] = useState('')
  const [urlError, setUrlError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const assets = project.assets.filter((a) => a.kind === kind)
  const meta = ASSET_META[kind]

  const upload = async (files: File[]) => {
    if (!files.length) return
    await addAssets(files, kind)
    toast(t('rail.imported', { n: files.length, kind: t(meta.labelKey) }), 'success')
  }

  const closeUrlDialog = () => {
    setUrlOpen(false)
    setUrlDraft('')
    setUrlName('')
    setUrlError('')
  }

  const submitUrl = () => {
    const value = urlDraft.trim()
    if (!/^https?:\/\/\S+$/i.test(value)) {
      setUrlError(t('rail.urlInvalid'))
      return
    }
    try {
      addRemoteAsset({ kind, url: value, name: urlName })
      toast(t('rail.urlAdded', { kind: t(meta.labelKey) }), 'success')
      closeUrlDialog()
    } catch (error) {
      setUrlError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div
      className="pb-4"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (e) => {
        e.preventDefault()
        setDragging(false)
        await upload(Array.from(e.dataTransfer.files))
      }}
    >
      <SectionTitle
        action={
          <span className="font-mono text-[10px] text-muted-foreground/40">{assets.length}</span>
        }
      >
        {t('rail.assets')}
      </SectionTitle>

      <div className="flex flex-wrap gap-1 px-2">
        {ASSET_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn(
              'rounded px-1.5 py-1 text-[11px] transition-colors',
              kind === k
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground',
            )}
          >
            {t(ASSET_META[k].labelKey)}
            <span className="ml-1 font-mono text-[9px] opacity-50">
              {project.assets.filter((a) => a.kind === k).length}
            </span>
          </button>
        ))}
      </div>

      <div className="px-2 pt-2">
        <button
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-4 transition-colors',
            dragging
              ? 'border-primary/70 bg-primary/10'
              : 'border-border/70 hover:border-border hover:bg-foreground/[0.03]',
          )}
        >
          <Upload className="h-4 w-4 text-muted-foreground/60" />
          <span className="text-[11px] text-muted-foreground">
            {t('rail.uploadCta', { kind: t(meta.labelKey) })}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={kind === 'background' || kind === 'sprite' ? 'image/*' : 'audio/*'}
          className="hidden"
          onChange={async (e) => {
            await upload(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => setUrlOpen(true)}
          className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/70 py-2 text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-foreground/[0.03] hover:text-foreground"
        >
          <Link2 className="h-3.5 w-3.5" />
          {t('rail.addByUrl')}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 px-2">
        {assets.map((asset) => {
          const isImage = asset.kind === 'background' || asset.kind === 'sprite'
          return (
            <div
              key={asset.id}
              className="group relative overflow-hidden rounded-md border border-border/60 bg-raised/40"
            >
              <div
                className={cn(
                  'flex items-center justify-center overflow-hidden',
                  isImage ? 'aspect-[16/10]' : 'h-14',
                )}
              >
                {isImage ? (
                  <img
                    src={assetUrls[asset.id]}
                    alt={asset.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <AudioLines className="h-5 w-5 text-primary/50" />
                )}
              </div>
              <div className="border-t border-border/50 px-1.5 py-1">
                <p className="truncate text-[10px] text-foreground/75" title={asset.name}>
                  {asset.name}
                </p>
                <p className="font-mono text-[9px] text-muted-foreground/45">
                  {asset.width
                    ? `${asset.width}×${asset.height}`
                    : asset.url
                      ? t('rail.remote')
                      : formatBytes(asset.size)}
                </p>
              </div>
              {asset.url ? (
                <span
                  className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-black/70 px-1 py-0.5 text-[8px] text-white/80"
                  title={asset.url}
                >
                  <Link2 className="h-2.5 w-2.5" />
                  {t('rail.remoteBadge')}
                </span>
              ) : null}
              <button
                onClick={() => removeAsset(asset.id)}
                className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white/70 opacity-0 transition-opacity hover:text-destruct group-hover:opacity-100"
                title={t('rail.deleteAsset')}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )
        })}
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-6 w-6" />}
          title={t('rail.emptyAsset', { kind: t(meta.labelKey) })}
          hint={t(meta.hintKey)}
          className="py-6"
        />
      ) : null}

      <p className="mt-3 px-3 text-[11px] leading-relaxed text-muted-foreground/45">
        {t('rail.assetHint')}
      </p>

      <Dialog
        open={urlOpen}
        onClose={closeUrlDialog}
        title={t('rail.urlTitle')}
        description={t('rail.urlDesc')}
        footer={
          <>
            <Button variant="ghost" onClick={closeUrlDialog}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={submitUrl}>
              {t('rail.urlSubmit')}
            </Button>
          </>
        }
      >
        <div
          className="space-y-3"
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitUrl()
          }}
        >
          <Field label={t('rail.urlLabel')} hint={t('rail.urlHint')}>
            <Input
              autoFocus
              value={urlDraft}
              onChange={(e) => {
                setUrlDraft(e.target.value)
                setUrlError('')
              }}
              placeholder="https://example.com/bg.png"
            />
          </Field>
          <Field label={t('rail.urlNameLabel')}>
            <Input
              value={urlName}
              onChange={(e) => setUrlName(e.target.value)}
              placeholder={t('rail.urlNamePlaceholder')}
            />
          </Field>
          {urlError ? <p className="text-[11px] text-destruct">{urlError}</p> : null}
          <p className="text-[11px] leading-relaxed text-muted-foreground/50">
            {t(meta.labelKey)} · {t(meta.hintKey)}
          </p>
        </div>
      </Dialog>
    </div>
  )
}

/* --------------------------------- 角色 --------------------------------- */

function CharacterList() {
  const { project, assetUrls, mutate } = useEditor()
  const { t } = useI18n()
  const [openId, setOpenId] = useState<string | null>(project.characters[0]?.id ?? null)
  const [newExpr, setNewExpr] = useState('')

  const patchCharacter = (id: string, change: (c: Character) => void) => {
    mutate((draft) => {
      const target = draft.characters.find((c) => c.id === id)
      if (target) change(target)
    })
  }

  return (
    <div className="pb-4">
      <SectionTitle
        action={
          <Button
            variant="ghost"
            size="icon-sm"
            title={t('rail.newCharacter')}
            onClick={() => {
              mutate((draft) => {
                draft.characters.push({
                  id: `c_${Math.random().toString(36).slice(2, 8)}`,
                  name: t('rail.defaultCharacterName'),
                  color: '#9d8cff',
                  sprites: {},
                })
              })
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        }
      >
        {t('rail.cast', { n: project.characters.length })}
      </SectionTitle>

      <div className="space-y-1.5 px-2">
        {project.characters.map((char) => {
          const open = openId === char.id
          const firstSprite = Object.values(char.sprites)[0]
          return (
            <div
              key={char.id}
              className="overflow-hidden rounded-lg border border-border/60 bg-raised/25"
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                <button
                  onClick={() => setOpenId(open ? null : char.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10"
                    style={{ backgroundColor: `${char.color}22` }}
                  >
                    {firstSprite ? (
                      <img
                        src={assetUrls[firstSprite]}
                        alt=""
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <User className="h-3 w-3" style={{ color: char.color }} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {char.name || t('common.untitled')}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/40">
                    {t('rail.expressionCount', { n: Object.keys(char.sprites).length })}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 text-muted-foreground/50 transition-transform',
                      open && 'rotate-180',
                    )}
                  />
                </button>
              </div>

              {open ? (
                <div className="space-y-2 border-t border-border/50 p-2">
                  <div className="flex gap-1.5">
                    <Input
                      value={char.name}
                      onChange={(e) => patchCharacter(char.id, (c) => (c.name = e.target.value))}
                      className="h-7 text-xs"
                      placeholder={t('rail.characterNamePlaceholder')}
                    />
                    <input
                      type="color"
                      value={char.color}
                      onChange={(e) => patchCharacter(char.id, (c) => (c.color = e.target.value))}
                      className="h-7 w-8 shrink-0 cursor-pointer rounded border border-border/80 bg-transparent"
                      title={t('rail.nameColor')}
                    />
                  </div>

                  <div className="space-y-1">
                    {Object.entries(char.sprites).map(([expr, assetId]) => (
                      <div key={expr} className="flex items-center gap-1">
                        <span className="w-12 shrink-0 truncate text-[11px] text-muted-foreground/80">
                          {expr}
                        </span>
                        <AssetPicker
                          kind="sprite"
                          value={assetId}
                          compact
                          allowNone={false}
                          onChange={(id) => {
                            if (!id) return
                            patchCharacter(char.id, (c) => (c.sprites[expr] = id))
                          }}
                        />
                        <button
                          className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-destruct"
                          onClick={() =>
                            patchCharacter(char.id, (c) => {
                              delete c.sprites[expr]
                            })
                          }
                          title={t('rail.deleteExpression')}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <Input
                      value={newExpr}
                      onChange={(e) => setNewExpr(e.target.value)}
                      placeholder={t('rail.expressionPlaceholder')}
                      className="h-7 text-xs"
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' || !newExpr.trim()) return
                        patchCharacter(char.id, (c) => (c.sprites[newExpr.trim()] = ''))
                        setNewExpr('')
                      }}
                    />
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      title={t('rail.addExpression')}
                      onClick={() => {
                        if (!newExpr.trim()) return
                        patchCharacter(char.id, (c) => (c.sprites[newExpr.trim()] = ''))
                        setNewExpr('')
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  <button
                    className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-destruct"
                    onClick={() => {
                      mutate((draft) => {
                        draft.characters = draft.characters.filter((c) => c.id !== char.id)
                        for (const sc of draft.scenes) {
                          for (const f of sc.frames) {
                            if (f.type !== 'line') continue
                            for (const slot of ['left', 'center', 'right'] as const) {
                              if (f.cast[slot]?.characterId === char.id) f.cast[slot] = null
                            }
                            if (f.speaker.characterId === char.id)
                              f.speaker = { characterId: null, name: char.name }
                          }
                        }
                      })
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                    {t('rail.deleteCharacter')}
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {project.characters.length === 0 ? (
        <EmptyState
          icon={<User className="h-6 w-6" />}
          title={t('rail.emptyCast')}
          hint={t('rail.emptyCastHint')}
        />
      ) : null}

      <p className="mt-3 px-3 text-[11px] leading-relaxed text-muted-foreground/45">
        {t('rail.castHint')}
      </p>
    </div>
  )
}

/* --------------------------------- 底栏 --------------------------------- */

function RailFooter() {
  const { project } = useEditor()
  const { t } = useI18n()
  const total = project.assets.reduce((sum, a) => sum + a.size, 0)
  return (
    <div className="flex items-center justify-between border-t border-border/50 px-3 py-2 text-[10px] text-muted-foreground/45">
      <span className="flex items-center gap-1">
        <Layers className="h-3 w-3" />
        {t('rail.footerAssets', { n: project.assets.length })}
      </span>
      <Chip tone="muted">{formatBytes(total)}</Chip>
    </div>
  )
}

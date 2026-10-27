import { useState } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { useI18n, type MessageKey } from '@/i18n'
import { Button, Dialog, Field, Input, Segmented, Switch, Textarea } from '@/components/ui'
import { AssetPicker } from './AssetPicker'
import { cn } from '@/lib/utils'
import type { UiSkin } from '@/lib/types'

const ACCENTS = ['#9d8cff', '#7aa2ff', '#ffb1a0', '#7fd1b9', '#f5b544', '#f27a9c']

const SKINS: { id: UiSkin; labelKey: MessageKey }[] = [
  { id: 'pgf', labelKey: 'settings.skin.pgf' },
  { id: 'night', labelKey: 'settings.skin.night' },
]

export function ProjectSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, patchMeta, mutate } = useEditor()
  const { t } = useI18n()
  const [flagKey, setFlagKey] = useState('')

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('settings.title')}
      description={t('settings.description')}
      width="max-w-xl"
      footer={
        <Button variant="primary" onClick={onClose}>
          {t('settings.done')}
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('settings.name')}>
            <Input
              value={project.meta.name}
              onChange={(e) => patchMeta({ name: e.target.value })}
            />
          </Field>
          <Field label={t('settings.author')}>
            <Input
              value={project.meta.author}
              placeholder={t('settings.authorPlaceholder')}
              onChange={(e) => patchMeta({ author: e.target.value })}
            />
          </Field>
        </div>

        <Field label={t('settings.summary')} hint={t('settings.summaryHint')}>
          <Textarea
            rows={3}
            value={project.meta.description}
            onChange={(e) => patchMeta({ description: e.target.value })}
            className="text-[13px]"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('settings.version')}>
            <Input
              value={project.meta.version}
              onChange={(e) => patchMeta({ version: e.target.value })}
            />
          </Field>
          <Field label={t('settings.accent')} hint={t('settings.accentHint')}>
            <div className="flex items-center gap-1.5">
              {ACCENTS.map((color) => (
                <button
                  key={color}
                  onClick={() => patchMeta({ theme: { ...project.meta.theme, accent: color } })}
                  className={cn(
                    'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                    project.meta.theme.accent === color ? 'border-white' : 'border-transparent',
                  )}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <input
                type="color"
                value={project.meta.theme.accent}
                onChange={(e) =>
                  patchMeta({ theme: { ...project.meta.theme, accent: e.target.value } })
                }
                className="h-6 w-6 cursor-pointer rounded border border-border/70 bg-transparent"
              />
            </div>
          </Field>
        </div>

        <Field label={t('settings.skin')} hint={t('settings.skinHint')}>
          <div className="grid grid-cols-2 gap-2.5">
            {SKINS.map((skin) => (
              <button
                key={skin.id}
                onClick={() => patchMeta({ theme: { ...project.meta.theme, skin: skin.id } })}
                className={cn(
                  'group overflow-hidden rounded-lg border p-0 text-left transition-all',
                  project.meta.theme.skin === skin.id
                    ? 'border-primary/70 bg-primary/[0.07]'
                    : 'border-border/60 hover:border-border',
                )}
              >
                <SkinPreview skin={skin.id} accent={project.meta.theme.accent} />
                <p className="px-3 py-2.5 text-[12.5px] font-medium">{t(skin.labelKey)}</p>
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('settings.language')} hint={t('settings.languageHint')}>
          <Segmented
            value={project.meta.locale}
            options={[
              { value: 'zh-CN', label: '简体中文' },
              { value: 'en', label: 'English' },
            ]}
            onChange={(v) => patchMeta({ locale: v })}
            className="w-full [&>button]:flex-1"
          />
        </Field>

        <div className="rounded-lg border border-border/60 bg-raised/25 p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">{t('settings.titleScreen')}</p>
              <p className="text-[11px] text-muted-foreground/60">
                {t('settings.titleScreenHint')}
              </p>
            </div>
            <Switch
              checked={project.meta.title.enabled}
              onCheckedChange={(v) => patchMeta({ title: { ...project.meta.title, enabled: v } })}
              label={t('settings.titleScreen')}
            />
          </div>
          <div className="space-y-2.5">
            <Field label={t('settings.subtitle')}>
              <Input
                value={project.meta.title.subtitle}
                placeholder={t('settings.subtitlePlaceholder')}
                onChange={(e) =>
                  patchMeta({ title: { ...project.meta.title, subtitle: e.target.value } })
                }
              />
            </Field>
            <Field label={t('settings.titleBackground')}>
              <AssetPicker
                kind="background"
                value={project.meta.title.background}
                onChange={(id) => patchMeta({ title: { ...project.meta.title, background: id } })}
              />
            </Field>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">{t('settings.flags')}</p>
              <p className="text-[11px] text-muted-foreground/60">{t('settings.flagsHint')}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {project.flags.map((flag) => (
              <div key={flag.key} className="flex items-center gap-1.5">
                <Input
                  value={flag.key}
                  onChange={(e) =>
                    mutate((draft) => {
                      const target = draft.flags.find((f) => f.key === flag.key)
                      if (target) target.key = e.target.value
                    })
                  }
                  className="h-8 flex-1 font-mono text-[11px]"
                />
                <span className="text-[10px] text-muted-foreground/40">
                  {t('settings.initialValue')}
                </span>
                <Input
                  value={flag.initial}
                  onChange={(e) =>
                    mutate((draft) => {
                      const target = draft.flags.find((f) => f.key === flag.key)
                      if (target) target.initial = e.target.value
                    })
                  }
                  className="h-8 w-[88px] font-mono text-[11px]"
                />
                <button
                  className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-destruct"
                  onClick={() =>
                    mutate((draft) => {
                      draft.flags = draft.flags.filter((f) => f.key !== flag.key)
                    })
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <Input
                value={flagKey}
                placeholder={t('settings.newFlagPlaceholder')}
                onChange={(e) => setFlagKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || !flagKey.trim()) return
                  mutate((draft) => draft.flags.push({ key: flagKey.trim(), initial: '0' }))
                  setFlagKey('')
                }}
                className="h-8 flex-1 font-mono text-[11px]"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!flagKey.trim()) return
                  mutate((draft) => draft.flags.push({ key: flagKey.trim(), initial: '0' }))
                  setFlagKey('')
                }}
              >
                <Plus className="h-3 w-3" />
                {t('settings.addFlag')}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-star/25 bg-star/[0.06] p-3">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-star" />
          <p className="text-[11px] leading-relaxed text-star/80">{t('settings.tip')}</p>
        </div>
      </div>
    </Dialog>
  )
}

/** 皮肤缩略：只画结构，不复刻纹理，够分辨就行 */
function SkinPreview({ skin, accent }: { skin: UiSkin; accent: string }) {
  if (skin === 'night') {
    return (
      <div className="relative h-[86px] w-full overflow-hidden bg-[linear-gradient(160deg,#1b1a33,#0a0913_60%)]">
        {/* 上下黑幕：上窄下宽，和播放器里那两层渐变一致 */}
        <div className="absolute inset-x-0 top-0 h-[16px] bg-[linear-gradient(to_bottom,rgba(0,0,0,0.68),transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-[40px] bg-[linear-gradient(to_top,#000,rgba(0,0,0,0.66)_56%,transparent)]" />
        {/* 菜单不包壳：左三右一 */}
        <div className="absolute left-2 top-2 flex gap-[5px]">
          <span className="h-[3px] w-[9px] rounded-full bg-white/25" />
          <span className="h-[3px] w-[9px] rounded-full bg-white/25" />
          <span className="h-[3px] w-[9px] rounded-full bg-white/25" />
        </div>
        <div className="absolute right-2 top-2">
          <span className="block h-[3px] w-[9px] rounded-full" style={{ background: `${accent}88` }} />
        </div>
        {/* 两栏：左下灰名字 + 主题色竖条，右侧白台词 */}
        <div className="absolute inset-x-3 bottom-2.5 flex items-start gap-2">
          <div className="flex w-[32%] items-center gap-[3px] pt-[3px]">
            <span className="h-[6px] w-[2px] rounded-[1px]" style={{ background: accent }} />
            <span className="h-[3px] w-full rounded-full bg-white/55" />
          </div>
          <div className="flex-1 space-y-[5px] pt-[2px]">
            <span className="block h-[3px] w-full rounded-full bg-white/90" />
            <span className="block h-[3px] w-3/5 rounded-full bg-white/70" />
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="relative h-[86px] w-full overflow-hidden bg-[linear-gradient(160deg,#6a4a6a,#241a33_55%,#0b0912)]">
      <div className="absolute inset-x-0 bottom-0 h-[52px] bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.34))]" />
      <div className="absolute inset-x-3 top-[43px] h-[8px] rounded-[1px] bg-[#8b0000] ring-1 ring-white/85" />
      <div className="absolute bottom-[13px] left-3 right-3 space-y-1">
        <span className="block h-[3px] w-8 rounded-full bg-[#ffae00] shadow-[0_0_0_0.5px_#3b0000]" />
        <span className="block h-[4px] w-full rounded-full bg-white shadow-[0_0_0_1px_#3b0000]" />
        <span className="block h-[4px] w-2/3 rounded-full bg-white shadow-[0_0_0_1px_#3b0000]" />
      </div>
      <div className="absolute bottom-[3px] right-2 flex gap-[3px]">
        <span className="h-[2px] w-[5px] rounded-full bg-[#1a1012]/40" />
        <span className="h-[2px] w-[5px] rounded-full bg-[#1a1012]/40" />
        <span className="h-[2px] w-[5px] rounded-full bg-[#1a1012]/40" />
        <span className="h-[2px] w-[5px] rounded-full bg-[#1a1012]/40" />
      </div>
    </div>
  )
}

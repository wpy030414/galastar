import { useState } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { Button, Dialog, Field, Input, Switch, Textarea } from '@/components/ui'
import { AssetPicker } from './AssetPicker'
import { cn } from '@/lib/utils'
import type { UiSkin } from '@/lib/types'

const ACCENTS = ['#9d8cff', '#7aa2ff', '#ffb1a0', '#7fd1b9', '#f5b544', '#f27a9c']

const SKINS: { id: UiSkin; name: string }[] = [
  { id: 'pgf', name: 'PGF 经典' },
  { id: 'night', name: '夜航' },
]

export function ProjectSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, patchMeta, mutate } = useEditor()
  const [flagKey, setFlagKey] = useState('')

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="项目设置"
      description="这些信息会写进导出作品的标题界面与关于页。"
      width="max-w-xl"
      footer={
        <Button variant="primary" onClick={onClose}>
          完成
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="作品名">
            <Input
              value={project.meta.name}
              onChange={(e) => patchMeta({ name: e.target.value })}
            />
          </Field>
          <Field label="作者">
            <Input
              value={project.meta.author}
              placeholder="署名会显示在标题界面"
              onChange={(e) => patchMeta({ author: e.target.value })}
            />
          </Field>
        </div>

        <Field label="简介" hint="显示在播放器「关于作品」面板里">
          <Textarea
            rows={3}
            value={project.meta.description}
            onChange={(e) => patchMeta({ description: e.target.value })}
            className="text-[13px]"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="版本号">
            <Input
              value={project.meta.version}
              onChange={(e) => patchMeta({ version: e.target.value })}
            />
          </Field>
          <Field label="主题色" hint="「夜航」皮肤与编辑器高亮都跟随它">
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

        <Field label="界面皮肤" hint="决定玩家看到的画面长什么样，改完舞台立刻更新">
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
                <p className="px-3 py-2.5 text-[12.5px] font-medium">{skin.name}</p>
              </button>
            ))}
          </div>
        </Field>

        <div className="rounded-lg border border-border/60 bg-raised/25 p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">标题界面</p>
              <p className="text-[11px] text-muted-foreground/60">
                开启后玩家先看到标题，再选择开始或继续
              </p>
            </div>
            <Switch
              checked={project.meta.title.enabled}
              onCheckedChange={(v) => patchMeta({ title: { ...project.meta.title, enabled: v } })}
              label="标题界面"
            />
          </div>
          <div className="space-y-2.5">
            <Field label="副标题">
              <Input
                value={project.meta.title.subtitle}
                placeholder="一行短句，显示在作品名下方"
                onChange={(e) =>
                  patchMeta({ title: { ...project.meta.title, subtitle: e.target.value } })
                }
              />
            </Field>
            <Field label="标题背景">
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
              <p className="text-[13px] font-medium">标记变量</p>
              <p className="text-[11px] text-muted-foreground/60">
                选项写入、条件读取，用来做分歧与好感度
              </p>
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
                <span className="text-[10px] text-muted-foreground/40">初始值</span>
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
                placeholder="新标记名，如 affection"
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
                添加
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-star/25 bg-star/[0.06] p-3">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-star" />
          <p className="text-[11px] leading-relaxed text-star/80">
            提示：每一帧都保存完整的舞台状态。改背景不必回头改前一帧，播放器按帧直接切换。
          </p>
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
        <div className="absolute left-2 top-2 flex gap-1.5 rounded-full bg-black/45 px-2 py-[3px]">
          <span className="h-[3px] w-3 rounded-full" style={{ background: `${accent}88` }} />
          <span className="h-[3px] w-3 rounded-full bg-white/25" />
          <span className="h-[3px] w-3 rounded-full bg-white/25" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[46px] bg-[linear-gradient(to_bottom,transparent,rgba(4,4,9,0.94))]" />
        <div className="absolute bottom-3 left-3 right-3 space-y-1.5">
          <span className="block h-[5px] w-10 rounded-full" style={{ background: accent }} />
          <span className="block h-[4px] w-full rounded-full bg-white/75" />
          <span className="block h-[4px] w-3/5 rounded-full bg-white/55" />
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

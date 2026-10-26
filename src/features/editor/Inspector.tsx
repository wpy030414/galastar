import { useState } from 'react'
import {
  Copy,
  CornerDownLeft,
  GitBranch,
  MoveHorizontal,
  MoveVertical,
  Plus,
  RotateCcw,
  Scaling,
  Trash2,
  Type,
  Volume2,
  X,
} from 'lucide-react'
import {
  DEFAULT_TRANSFORM,
  TRANSFORM_LIMITS,
  type Condition,
  type Frame,
  type JumpFrame,
  type LineFrame,
  type Slot,
  type SpriteTransform,
  type Transition,
} from '@/lib/types'
import { withCastTransform } from '@/lib/project'
import { useEditor } from '@/store/editor'
import { cn } from '@/lib/utils'
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  Segmented,
  Select,
  Slider,
  Switch,
  Textarea,
} from '@/components/ui'
import { AssetPicker } from './AssetPicker'

const TRANSITIONS: Array<{ value: Transition; label: string }> = [
  { value: 'cut', label: '直接' },
  { value: 'fade', label: '淡入' },
  { value: 'dissolve', label: '溶接' },
  { value: 'flash', label: '闪白' },
  { value: 'rise', label: '上升' },
]

const SLOT_LABELS: Array<{ slot: Slot; label: string }> = [
  { slot: 'left', label: '左' },
  { slot: 'center', label: '中' },
  { slot: 'right', label: '右' },
]

export function Inspector() {
  const { frame } = useEditor()
  if (!frame) {
    return (
      <aside className="flex w-[372px] shrink-0 flex-col border-l border-border/60 bg-panel/40">
        <EmptyState
          className="flex-1"
          icon={<Type className="h-6 w-6" />}
          title="未选中任何帧"
          hint="在下方剧本列表中点击一帧，这里会显示它的全部可调参数。"
        />
      </aside>
    )
  }
  return (
    <aside className="flex w-[372px] shrink-0 flex-col border-l border-border/60 bg-panel/40">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <Chip
            tone={frame.type === 'choice' ? 'star' : frame.type === 'line' ? 'primary' : 'default'}
          >
            {frame.type === 'line'
              ? '台词帧'
              : frame.type === 'choice'
                ? '选择帧'
                : frame.type === 'jump'
                  ? '跳转帧'
                  : '结束帧'}
          </Chip>
          <span className="font-mono text-[10px] text-muted-foreground/35">
            {frame.id.slice(-8)}
          </span>
        </div>
        <FrameActions frame={frame} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {frame.type === 'line' ? <LineEditor frame={frame} /> : null}
        {frame.type === 'choice' ? <ChoiceEditor frame={frame} /> : null}
        {frame.type === 'jump' ? <JumpEditor frame={frame} /> : null}
        {frame.type === 'end' ? <EndEditor frame={frame} /> : null}
      </div>
    </aside>
  )
}

function FrameActions({ frame }: { frame: Frame }) {
  const { duplicateFrame, removeFrame } = useEditor()
  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        title="复制此帧"
        onClick={() => duplicateFrame(frame.id)}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" title="删除此帧" onClick={() => removeFrame(frame.id)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

/* --------------------------------- 台词帧 --------------------------------- */

function LineEditor({ frame }: { frame: LineFrame }) {
  const { project, patchFrame, addFrame } = useEditor()
  const char = project.characters.find((c) => c.id === frame.speaker.characterId) ?? null
  const speakerMode = char ? 'char' : frame.speaker.name ? 'custom' : 'narration'

  /**
   * 改摆放要整体替换 cast，但仍以当前帧为底，
   * 避免闭包拿到旧 frame 把其他槽位的改动一起写回去。
   */
  const setTransform = (slot: Slot, patch: Partial<SpriteTransform>, field: string) =>
    patchFrame(
      frame.id,
      { cast: withCastTransform(frame.cast, slot, patch) },
      `transform:${frame.id}:${slot}:${field}`,
    )

  return (
    <div className="divide-y divide-border/40">
      <Section title="台词">
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Select
              value={speakerMode === 'char' ? char!.id : speakerMode === 'custom' ? '__custom' : ''}
              onChange={(e) => {
                const v = e.target.value
                if (v === '') patchFrame(frame.id, { speaker: { characterId: null, name: '' } })
                else if (v === '__custom')
                  patchFrame(frame.id, {
                    speaker: { characterId: null, name: frame.speaker.name || '名字' },
                  })
                else {
                  const target = project.characters.find((c) => c.id === v)
                  patchFrame(frame.id, { speaker: { characterId: v, name: target?.name ?? '' } })
                }
              }}
              className="flex-1"
            >
              <option value="">旁白（无名字牌）</option>
              {project.characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__custom">自定义名称…</option>
            </Select>
            {speakerMode === 'custom' ? (
              <Input
                value={frame.speaker.name}
                onChange={(e) =>
                  patchFrame(frame.id, { speaker: { characterId: null, name: e.target.value } })
                }
                placeholder="名字"
                className="w-[104px]"
              />
            ) : null}
          </div>

          <div>
            <Textarea
              value={frame.text}
              rows={5}
              placeholder="在这里写台词。支持换行，逐字显示时长由播放器设置决定。"
              onChange={(e) => patchFrame(frame.id, { text: e.target.value })}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  addFrame('line')
                }
              }}
              className="min-h-[110px] text-[13px] leading-relaxed"
            />
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground/40">
              <span className="flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" />
                Ctrl / ⌘ + Enter 新建下一句
              </span>
              <span className="font-mono">{frame.text.length} 字</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="舞台">
        <div className="space-y-2.5">
          <Field label="背景">
            <AssetPicker
              kind="background"
              value={frame.bg}
              onChange={(id) => patchFrame(frame.id, { bg: id })}
            />
          </Field>
          <Field label="进场转场">
            <Segmented
              value={frame.transition}
              options={TRANSITIONS}
              onChange={(v) => patchFrame(frame.id, { transition: v })}
              className="w-full [&>button]:flex-1"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="背景音乐">
              <AssetPicker
                kind="bgm"
                value={frame.bgm}
                onChange={(id) => patchFrame(frame.id, { bgm: id })}
                compact
              />
            </Field>
            <Field label="环境音效">
              <AssetPicker
                kind="sfx"
                value={frame.sfx}
                onChange={(id) => patchFrame(frame.id, { sfx: id })}
                compact
              />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-raised/30 px-2.5 py-2">
            <div>
              <p className="text-xs text-foreground/85">震屏</p>
              <p className="text-[10px] text-muted-foreground/50">配合冲击性台词使用</p>
            </div>
            <Switch
              checked={frame.shake}
              onCheckedChange={(v) => patchFrame(frame.id, { shake: v })}
              label="震屏"
            />
          </div>
        </div>
      </Section>

      <Section
        title="立绘"
        action={<span className="text-[10px] text-muted-foreground/40">说话的角色会被提亮</span>}
      >
        <div className="space-y-2">
          {SLOT_LABELS.map(({ slot, label }) => {
            const cast = frame.cast[slot]
            const castChar = project.characters.find((c) => c.id === cast?.characterId) ?? null
            const expressions = castChar
              ? Object.keys(castChar.sprites).filter((e) => castChar.sprites[e])
              : []
            return (
              <div key={slot} className="rounded-md border border-border/50 bg-raised/20 p-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 shrink-0 text-center font-mono text-[10px] text-muted-foreground/45">
                    {label}
                  </span>
                  <Select
                    value={cast?.characterId ?? ''}
                    onChange={(e) => {
                      const id = e.target.value
                      const next = { ...frame.cast }
                      if (!id) next[slot] = null
                      else {
                        const target = project.characters.find((c) => c.id === id)
                        const expr = target
                          ? (Object.keys(target.sprites).find((k) => target.sprites[k]) ?? '')
                          : ''
                        next[slot] = {
                          characterId: id,
                          expression: expr,
                          // 换人是换了一张画布，摆放必须从零开始
                          transform: { ...DEFAULT_TRANSFORM },
                        }
                      }
                      patchFrame(frame.id, { cast: next })
                    }}
                    className="h-8 flex-1 text-xs"
                  >
                    <option value="">—</option>
                    {project.characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={cast?.expression ?? ''}
                    disabled={!castChar}
                    onChange={(e) => {
                      if (!cast) return
                      const next = { ...frame.cast }
                      next[slot] = { ...cast, expression: e.target.value }
                      patchFrame(frame.id, { cast: next })
                    }}
                    className="h-8 w-[92px] text-xs"
                  >
                    <option value="">表情</option>
                    {expressions.map((expr) => (
                      <option key={expr} value={expr}>
                        {expr}
                      </option>
                    ))}
                  </Select>
                  {cast ? (
                    <button
                      className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-destruct"
                      title="移除"
                      onClick={() =>
                        patchFrame(frame.id, {
                          cast: { ...frame.cast, [slot]: null } as LineFrame['cast'],
                        })
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : (
                    <span className="w-5" />
                  )}
                </div>

                {cast ? (
                  <div className="mt-1.5 space-y-1 border-t border-border/40 pt-1.5">
                    <TransformSlider
                      icon={<Scaling className="h-3 w-3" />}
                      label="缩放"
                      unit="%"
                      value={cast.transform.scale}
                      limits={TRANSFORM_LIMITS.scale}
                      onChange={(v) => setTransform(slot, { scale: v }, 'scale')}
                    />
                    <TransformSlider
                      icon={<MoveHorizontal className="h-3 w-3" />}
                      label="横向"
                      unit="px"
                      value={cast.transform.offsetX}
                      limits={TRANSFORM_LIMITS.offsetX}
                      onChange={(v) => setTransform(slot, { offsetX: v }, 'offsetX')}
                    />
                    <TransformSlider
                      icon={<MoveVertical className="h-3 w-3" />}
                      label="纵向"
                      unit="px"
                      value={cast.transform.offsetY}
                      limits={TRANSFORM_LIMITS.offsetY}
                      onChange={(v) => setTransform(slot, { offsetY: v }, 'offsetY')}
                    />
                    <button
                      className="flex items-center gap-1 text-[10px] text-muted-foreground/45 transition-colors hover:text-primary"
                      title="缩放与偏移恢复默认"
                      onClick={() => setTransform(slot, { ...DEFAULT_TRANSFORM }, 'reset')}
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      复位摆放
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
          {project.characters.length === 0 ? (
            <p className="rounded border border-dashed border-border/60 px-2 py-2 text-[11px] text-muted-foreground/50">
              还没有角色。左侧「角色」页新建角色并绑定立绘后，这里就能安排站位。
            </p>
          ) : null}
        </div>
      </Section>

      <Section title="语音">
        <AssetPicker
          kind="voice"
          value={frame.voice}
          onChange={(id) => patchFrame(frame.id, { voice: id })}
        />
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/45">
          <Volume2 className="h-3 w-3" />
          自动播放模式下会等语音播完再翻页
        </p>
      </Section>
    </div>
  )
}

/* --------------------------------- 选择帧 --------------------------------- */

function ChoiceEditor({ frame }: { frame: import('@/lib/types').ChoiceFrame }) {
  const { project, patchFrame } = useEditor()
  const update = (index: number, patch: Partial<(typeof frame.options)[number]>) => {
    const options = frame.options.map((o, i) => (i === index ? { ...o, ...patch } : o))
    patchFrame(frame.id, { options })
  }
  return (
    <div className="divide-y divide-border/40">
      <Section title="选择">
        <Field label="提示语（可留空）">
          <Input
            value={frame.prompt}
            placeholder="例如：风停了，你要怎么做？"
            onChange={(e) => patchFrame(frame.id, { prompt: e.target.value })}
          />
        </Field>
      </Section>

      <Section
        title={`选项 · ${frame.options.length}`}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              patchFrame(frame.id, {
                options: [
                  ...frame.options,
                  {
                    id: `o_${Math.random().toString(36).slice(2, 8)}`,
                    text: '',
                    target: null,
                    setFlags: {},
                    requires: null,
                  },
                ],
              })
            }
          >
            <Plus className="h-3 w-3" />
            添加
          </Button>
        }
      >
        <div className="space-y-2">
          {frame.options.map((option, index) => (
            <div key={option.id} className="rounded-lg border border-border/60 bg-raised/25 p-2">
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-star/15 font-mono text-[10px] text-star">
                  {index + 1}
                </span>
                <Input
                  value={option.text}
                  placeholder="选项文案"
                  onChange={(e) => update(index, { text: e.target.value })}
                  className="h-8 text-xs"
                />
                <button
                  className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-destruct"
                  title="删除选项"
                  onClick={() =>
                    patchFrame(frame.id, { options: frame.options.filter((_, i) => i !== index) })
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div className="mt-1.5 flex items-center gap-1.5">
                <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                <Select
                  value={option.target ?? ''}
                  onChange={(e) => update(index, { target: e.target.value || null })}
                  className="h-7 flex-1 text-[11px]"
                >
                  <option value="">顺着本场景继续</option>
                  {project.scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      跳转到 · {s.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="mt-1.5 space-y-1">
                {Object.entries(option.setFlags).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-1">
                    <Chip tone="primary">标记</Chip>
                    <Input value={key} readOnly className="h-7 w-[92px] text-[11px] text-primary" />
                    <span className="text-[10px] text-muted-foreground/40">=</span>
                    <Input
                      value={value}
                      onChange={(e) =>
                        update(index, { setFlags: { ...option.setFlags, [key]: e.target.value } })
                      }
                      className="h-7 flex-1 text-[11px]"
                    />
                    <button
                      className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-destruct"
                      onClick={() => {
                        const next = { ...option.setFlags }
                        delete next[key]
                        update(index, { setFlags: next })
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <FlagAdder
                  onAdd={(key, value) =>
                    update(index, { setFlags: { ...option.setFlags, [key]: value } })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function FlagAdder({ onAdd }: { onAdd: (key: string, value: string) => void }) {
  const { project } = useEditor()
  return (
    <div className="flex flex-wrap items-center gap-1 pt-0.5">
      <span className="text-[10px] text-muted-foreground/40">写入标记：</span>
      {project.flags.length === 0 ? (
        <span className="text-[10px] text-muted-foreground/30">先在「项目设置」里声明标记</span>
      ) : (
        project.flags.map((f) => (
          <button
            key={f.key}
            onClick={() => onAdd(f.key, f.initial === 'true' ? 'true' : f.initial)}
            className="rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70 hover:border-primary/50 hover:text-primary"
          >
            {f.key}
          </button>
        ))
      )}
    </div>
  )
}

/* --------------------------------- 跳转帧 --------------------------------- */

function JumpEditor({ frame }: { frame: JumpFrame }) {
  const { project, patchFrame } = useEditor()
  return (
    <div className="divide-y divide-border/40">
      <Section title="跳转">
        <div className="space-y-3">
          <Field label="目标场景" hint="条件不满足时会顺延到下一帧，可用作「条件分支」">
            <Select
              value={frame.target ?? ''}
              onChange={(e) => patchFrame(frame.id, { target: e.target.value || null })}
            >
              <option value="">不跳转（继续下一帧）</option>
              {project.scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <ConditionEditor
            value={frame.requires}
            onChange={(cond) => patchFrame(frame.id, { requires: cond })}
            label="触发条件"
          />
        </div>
      </Section>
    </div>
  )
}

/* --------------------------------- 结束帧 --------------------------------- */

function EndEditor({ frame: endFrame }: { frame: import('@/lib/types').EndFrame }) {
  const { project, patchFrame } = useEditor()
  return (
    <div className="divide-y divide-border/40">
      <Section title="结束">
        <div className="space-y-3">
          <Field label="类型">
            <Segmented
              value={endFrame.kind}
              options={[
                { value: 'chapter', label: '本章结束' },
                { value: 'ending', label: '结局' },
              ]}
              onChange={(v) => patchFrame(endFrame.id, { kind: v })}
              className="w-full [&>button]:flex-1"
            />
          </Field>
          <Field label="标题">
            <Input
              value={endFrame.title}
              onChange={(e) => patchFrame(endFrame.id, { title: e.target.value })}
            />
          </Field>
          <Field label="副标题 / 结语">
            <Textarea
              rows={3}
              value={endFrame.subtitle}
              placeholder="可以用换行写成两行诗"
              onChange={(e) => patchFrame(endFrame.id, { subtitle: e.target.value })}
              className="text-[13px]"
            />
          </Field>
          <Field label="之后前往" hint="留空则显示「回到标题 / 再来一次」">
            <Select
              value={endFrame.next ?? ''}
              onChange={(e) => patchFrame(endFrame.id, { next: e.target.value || null })}
            >
              <option value="">结束本作</option>
              {project.scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>
    </div>
  )
}

/* --------------------------------- 通用零件 --------------------------------- */

/**
 * 立绘摆放的单个数值控件：滑杆负责「拖到差不多」，数字框负责「钉到准确值」。
 * 数字框在聚焦时不与外部值同步，否则逐字输入会被反向改写。
 */
function TransformSlider({
  icon,
  label,
  unit,
  value,
  limits,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  unit: string
  value: number
  limits: { min: number; max: number; step: number }
  onChange: (next: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(value)

  const commit = (raw: string) => {
    const parsed = Math.round(Number(raw))
    if (!raw.trim() || !Number.isFinite(parsed)) return
    onChange(Math.min(limits.max, Math.max(limits.min, parsed)))
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="flex w-[52px] shrink-0 items-center gap-1 text-[10px] text-muted-foreground/60">
        {icon}
        {label}
        <span className="text-muted-foreground/35">{unit}</span>
      </span>
      <Slider
        value={value}
        min={limits.min}
        max={limits.max}
        step={limits.step}
        onChange={onChange}
        className="min-w-0 flex-1"
      />
      <input
        type="text"
        inputMode="numeric"
        value={shown}
        onFocus={() => setDraft(String(value))}
        onChange={(e) => {
          const raw = e.target.value
          if (!/^-?\d*$/.test(raw)) return
          setDraft(raw)
          commit(raw)
        }}
        onBlur={() => setDraft(null)}
        className="h-6 w-11 shrink-0 rounded border border-border/70 bg-raised/50 px-1 text-right font-mono text-[10px] text-foreground focus:border-primary/60 focus:outline-none"
      />
    </div>
  )
}

export function ConditionEditor({
  value,
  onChange,
  label,
}: {
  value: Condition | null
  onChange: (cond: Condition | null) => void
  label?: string
}) {
  const { project } = useEditor()
  if (!value) {
    return (
      <div>
        {label ? <p className="field-label">{label}</p> : null}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() =>
            onChange({ key: project.flags[0]?.key ?? 'stayed', op: '==', value: 'true' })
          }
        >
          <Plus className="h-3 w-3" />
          添加条件
        </Button>
      </div>
    )
  }
  return (
    <div>
      {label ? <p className="field-label">{label}</p> : null}
      <div className="flex items-center gap-1">
        <Input
          value={value.key}
          list="galastar-flag-keys"
          onChange={(e) => onChange({ ...value, key: e.target.value })}
          className="h-8 flex-1 text-[11px]"
          placeholder="标记名"
        />
        <Select
          value={value.op}
          onChange={(e) => onChange({ ...value, op: e.target.value as Condition['op'] })}
          className="h-8 w-[64px] text-[11px]"
        >
          {['==', '!=', '>', '>=', '<', '<='].map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </Select>
        <Input
          value={value.value}
          onChange={(e) => onChange({ ...value, value: e.target.value })}
          className="h-8 w-[76px] text-[11px]"
          placeholder="值"
        />
        <button
          className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-destruct"
          onClick={() => onChange(null)}
          title="移除条件"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <datalist id="galastar-flag-keys">
        {project.flags.map((f) => (
          <option key={f.key} value={f.key} />
        ))}
      </datalist>
    </div>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="px-3 py-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="section-label">{title}</span>
        {action}
      </div>
      <div className={cn('space-y-2')}>{children}</div>
    </div>
  )
}

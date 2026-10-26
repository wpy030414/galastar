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
import { useI18n, type MessageKey } from '@/i18n'
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

const TRANSITIONS: Array<{ value: Transition; labelKey: MessageKey }> = [
  { value: 'cut', labelKey: 'inspector.transition.cut' },
  { value: 'fade', labelKey: 'inspector.transition.fade' },
  { value: 'dissolve', labelKey: 'inspector.transition.dissolve' },
  { value: 'flash', labelKey: 'inspector.transition.flash' },
  { value: 'rise', labelKey: 'inspector.transition.rise' },
]

const SLOT_LABELS: Array<{ slot: Slot; labelKey: MessageKey }> = [
  { slot: 'left', labelKey: 'inspector.cast.slot.left' },
  { slot: 'center', labelKey: 'inspector.cast.slot.center' },
  { slot: 'right', labelKey: 'inspector.cast.slot.right' },
]

export function Inspector() {
  const { frame } = useEditor()
  const { t } = useI18n()
  if (!frame) {
    return (
      <aside className="flex w-[372px] shrink-0 flex-col border-l border-border/60 bg-panel/40">
        <EmptyState
          className="flex-1"
          icon={<Type className="h-6 w-6" />}
          title={t('inspector.none.title')}
          hint={t('inspector.none.hint')}
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
              ? t('inspector.type.line')
              : frame.type === 'choice'
                ? t('inspector.type.choice')
                : frame.type === 'jump'
                  ? t('inspector.type.jump')
                  : t('inspector.type.end')}
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
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        title={t('inspector.duplicateFrame')}
        onClick={() => duplicateFrame(frame.id)}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title={t('inspector.deleteFrame')}
        onClick={() => removeFrame(frame.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

/* --------------------------------- 台词帧 --------------------------------- */

function LineEditor({ frame }: { frame: LineFrame }) {
  const { project, patchFrame, addFrame } = useEditor()
  const { t } = useI18n()
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
      <Section title={t('inspector.section.line')}>
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Select
              value={speakerMode === 'char' ? char!.id : speakerMode === 'custom' ? '__custom' : ''}
              onChange={(e) => {
                const v = e.target.value
                if (v === '') patchFrame(frame.id, { speaker: { characterId: null, name: '' } })
                else if (v === '__custom')
                  patchFrame(frame.id, {
                    speaker: { characterId: null, name: frame.speaker.name || t('inspector.line.defaultName') },
                  })
                else {
                  const target = project.characters.find((c) => c.id === v)
                  patchFrame(frame.id, { speaker: { characterId: v, name: target?.name ?? '' } })
                }
              }}
              className="flex-1"
            >
              <option value="">{t('inspector.line.narration')}</option>
              {project.characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__custom">{t('inspector.line.custom')}</option>
            </Select>
            {speakerMode === 'custom' ? (
              <Input
                value={frame.speaker.name}
                onChange={(e) =>
                  patchFrame(frame.id, { speaker: { characterId: null, name: e.target.value } })
                }
                placeholder={t('inspector.line.namePlaceholder')}
                className="w-[104px]"
              />
            ) : null}
          </div>

          <div>
            <Textarea
              value={frame.text}
              rows={5}
              placeholder={t('inspector.line.textPlaceholder')}
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
                {t('inspector.line.newLineHint')}
              </span>
              <span className="font-mono">{t('inspector.line.charCount', { n: frame.text.length })}</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title={t('inspector.section.stage')}>
        <div className="space-y-2.5">
          <Field label={t('inspector.stage.background')}>
            <AssetPicker
              kind="background"
              value={frame.bg}
              onChange={(id) => patchFrame(frame.id, { bg: id })}
            />
          </Field>
          <Field label={t('inspector.stage.transition')}>
            <Segmented
              value={frame.transition}
              options={TRANSITIONS.map((item) => ({
                value: item.value,
                label: t(item.labelKey),
              }))}
              onChange={(v) => patchFrame(frame.id, { transition: v })}
              className="w-full [&>button]:flex-1"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('inspector.stage.bgm')}>
              <AssetPicker
                kind="bgm"
                value={frame.bgm}
                onChange={(id) => patchFrame(frame.id, { bgm: id })}
                compact
              />
            </Field>
            <Field label={t('inspector.stage.sfx')}>
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
              <p className="text-xs text-foreground/85">{t('inspector.stage.shake')}</p>
              <p className="text-[10px] text-muted-foreground/50">
                {t('inspector.stage.shakeHint')}
              </p>
            </div>
            <Switch
              checked={frame.shake}
              onCheckedChange={(v) => patchFrame(frame.id, { shake: v })}
              label={t('inspector.stage.shake')}
            />
          </div>
        </div>
      </Section>

      <Section
        title={t('inspector.section.cast')}
        action={
          <span className="text-[10px] text-muted-foreground/40">{t('inspector.cast.hint')}</span>
        }
      >
        <div className="space-y-2">
          {SLOT_LABELS.map(({ slot, labelKey }) => {
            const cast = frame.cast[slot]
            const castChar = project.characters.find((c) => c.id === cast?.characterId) ?? null
            const expressions = castChar
              ? Object.keys(castChar.sprites).filter((e) => castChar.sprites[e])
              : []
            return (
              <div key={slot} className="rounded-md border border-border/50 bg-raised/20 p-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 shrink-0 text-center font-mono text-[10px] text-muted-foreground/45">
                    {t(labelKey)}
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
                    className="h-8 w-[110px] text-xs"
                  >
                    <option value="">{t('inspector.cast.expression')}</option>
                    {expressions.map((expr) => (
                      <option key={expr} value={expr}>
                        {expr}
                      </option>
                    ))}
                  </Select>
                  {cast ? (
                    <button
                      className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-destruct"
                      title={t('common.remove')}
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
                      label={t('inspector.transform.scale')}
                      unit="%"
                      value={cast.transform.scale}
                      limits={TRANSFORM_LIMITS.scale}
                      onChange={(v) => setTransform(slot, { scale: v }, 'scale')}
                    />
                    <TransformSlider
                      icon={<MoveHorizontal className="h-3 w-3" />}
                      label={t('inspector.transform.x')}
                      unit="px"
                      value={cast.transform.offsetX}
                      limits={TRANSFORM_LIMITS.offsetX}
                      onChange={(v) => setTransform(slot, { offsetX: v }, 'offsetX')}
                    />
                    <TransformSlider
                      icon={<MoveVertical className="h-3 w-3" />}
                      label={t('inspector.transform.y')}
                      unit="px"
                      value={cast.transform.offsetY}
                      limits={TRANSFORM_LIMITS.offsetY}
                      onChange={(v) => setTransform(slot, { offsetY: v }, 'offsetY')}
                    />
                    <button
                      className="flex items-center gap-1 text-[10px] text-muted-foreground/45 transition-colors hover:text-primary"
                      title={t('inspector.transform.resetTip')}
                      onClick={() => setTransform(slot, { ...DEFAULT_TRANSFORM }, 'reset')}
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      {t('inspector.transform.reset')}
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
          {project.characters.length === 0 ? (
            <p className="rounded border border-dashed border-border/60 px-2 py-2 text-[11px] text-muted-foreground/50">
              {t('inspector.cast.noCharacters')}
            </p>
          ) : null}
        </div>
      </Section>

      <Section title={t('inspector.section.voice')}>
        <AssetPicker
          kind="voice"
          value={frame.voice}
          onChange={(id) => patchFrame(frame.id, { voice: id })}
        />
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/45">
          <Volume2 className="h-3 w-3" />
          {t('inspector.voice.hint')}
        </p>
      </Section>
    </div>
  )
}

/* --------------------------------- 选择帧 --------------------------------- */

function ChoiceEditor({ frame }: { frame: import('@/lib/types').ChoiceFrame }) {
  const { project, patchFrame } = useEditor()
  const { t } = useI18n()
  const update = (index: number, patch: Partial<(typeof frame.options)[number]>) => {
    const options = frame.options.map((o, i) => (i === index ? { ...o, ...patch } : o))
    patchFrame(frame.id, { options })
  }
  return (
    <div className="divide-y divide-border/40">
      <Section title={t('inspector.section.choice')}>
        <Field label={t('inspector.choice.prompt')}>
          <Input
            value={frame.prompt}
            placeholder={t('inspector.choice.promptPlaceholder')}
            onChange={(e) => patchFrame(frame.id, { prompt: e.target.value })}
          />
        </Field>
      </Section>

      <Section
        title={t('inspector.choice.options', { n: frame.options.length })}
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
            {t('common.add')}
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
                  placeholder={t('inspector.choice.optionPlaceholder')}
                  onChange={(e) => update(index, { text: e.target.value })}
                  className="h-8 text-xs"
                />
                <button
                  className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-destruct"
                  title={t('inspector.choice.deleteOption')}
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
                  <option value="">{t('inspector.choice.continue')}</option>
                  {project.scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {t('inspector.choice.jumpTo', { name: s.name })}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="mt-1.5 space-y-1">
                {Object.entries(option.setFlags).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-1">
                    <Chip tone="primary">{t('inspector.choice.flag')}</Chip>
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
  const { t } = useI18n()
  return (
    <div className="flex flex-wrap items-center gap-1 pt-0.5">
      <span className="text-[10px] text-muted-foreground/40">{t('inspector.choice.writeFlag')}</span>
      {project.flags.length === 0 ? (
        <span className="text-[10px] text-muted-foreground/30">
          {t('inspector.choice.noFlags')}
        </span>
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
  const { t } = useI18n()
  return (
    <div className="divide-y divide-border/40">
      <Section title={t('inspector.section.jump')}>
        <div className="space-y-3">
          <Field label={t('inspector.jump.target')} hint={t('inspector.jump.targetHint')}>
            <Select
              value={frame.target ?? ''}
              onChange={(e) => patchFrame(frame.id, { target: e.target.value || null })}
            >
              <option value="">{t('inspector.jump.none')}</option>
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
            label={t('inspector.jump.condition')}
          />
        </div>
      </Section>
    </div>
  )
}

/* --------------------------------- 结束帧 --------------------------------- */

function EndEditor({ frame: endFrame }: { frame: import('@/lib/types').EndFrame }) {
  const { project, patchFrame } = useEditor()
  const { t } = useI18n()
  return (
    <div className="divide-y divide-border/40">
      <Section title={t('inspector.section.end')}>
        <div className="space-y-3">
          <Field label={t('inspector.end.type')}>
            <Segmented
              value={endFrame.kind}
              options={[
                { value: 'chapter', label: t('inspector.end.chapter') },
                { value: 'ending', label: t('inspector.end.ending') },
              ]}
              onChange={(v) => patchFrame(endFrame.id, { kind: v })}
              className="w-full [&>button]:flex-1"
            />
          </Field>
          <Field label={t('inspector.end.title')}>
            <Input
              value={endFrame.title}
              onChange={(e) => patchFrame(endFrame.id, { title: e.target.value })}
            />
          </Field>
          <Field label={t('inspector.end.subtitle')}>
            <Textarea
              rows={3}
              value={endFrame.subtitle}
              placeholder={t('inspector.end.subtitlePlaceholder')}
              onChange={(e) => patchFrame(endFrame.id, { subtitle: e.target.value })}
              className="text-[13px]"
            />
          </Field>
          <Field label={t('inspector.end.next')} hint={t('inspector.end.nextHint')}>
            <Select
              value={endFrame.next ?? ''}
              onChange={(e) => patchFrame(endFrame.id, { next: e.target.value || null })}
            >
              <option value="">{t('inspector.end.finish')}</option>
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
  const { t } = useI18n()
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
          {t('inspector.condition.add')}
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
          placeholder={t('inspector.condition.keyPlaceholder')}
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
          placeholder={t('inspector.condition.valuePlaceholder')}
        />
        <button
          className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-destruct"
          onClick={() => onChange(null)}
          title={t('inspector.condition.remove')}
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

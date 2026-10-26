import {
  DEFAULT_TRANSFORM,
  TRANSFORM_LIMITS,
  type CastMap,
  type CastSlot,
  type Character,
  type ChoiceFrame,
  type ChoiceOption,
  type EndFrame,
  type Frame,
  type JumpFrame,
  type LineFrame,
  type Project,
  type ProjectSummary,
  type RuntimeAsset,
  type RuntimePayload,
  type Scene,
  type Slot,
  type SpriteTransform,
} from './types'
import { uid } from './utils'

export const emptyCast = (): CastMap => ({ left: null, center: null, right: null })

const SLOTS: Slot[] = ['left', 'center', 'right']

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** 数值输入可能被写歪（NaN、越界），渲染前统一收敛到合法范围 */
export function normalizeTransform(raw?: Partial<SpriteTransform> | null): SpriteTransform {
  const scale = Number(raw?.scale)
  const offsetX = Number(raw?.offsetX)
  const offsetY = Number(raw?.offsetY)
  return {
    scale: Number.isFinite(scale)
      ? clamp(scale, TRANSFORM_LIMITS.scale.min, TRANSFORM_LIMITS.scale.max)
      : DEFAULT_TRANSFORM.scale,
    offsetX: Number.isFinite(offsetX)
      ? clamp(offsetX, TRANSFORM_LIMITS.offsetX.min, TRANSFORM_LIMITS.offsetX.max)
      : DEFAULT_TRANSFORM.offsetX,
    offsetY: Number.isFinite(offsetY)
      ? clamp(offsetY, TRANSFORM_LIMITS.offsetY.min, TRANSFORM_LIMITS.offsetY.max)
      : DEFAULT_TRANSFORM.offsetY,
  }
}

/** 改一帧的摆放要整体替换 cast，这里只负责把某个槽位换成新值 */
export function withCastTransform(
  cast: CastMap,
  slot: Slot,
  patch: Partial<SpriteTransform>,
): CastMap {
  const current = cast[slot]
  if (!current) return cast
  return {
    ...cast,
    [slot]: { ...current, transform: normalizeTransform({ ...current.transform, ...patch }) },
  }
}

/**
 * 旧作品的 cast 没有 transform 字段。
 * 每个槽位单独判定：只有「同一个角色」沿用下来的摆放才继承得过去——
 * 同一角色的各套表情出自同一张画布，偏移量可以直接复用；
 * 换了人就从零开始，否则会把上一个角色的构图偏移错加到新立绘上。
 */
export function normalizeCast(raw: unknown, prev: CastMap | null = null): CastMap {
  const source = (raw ?? {}) as Partial<Record<Slot, CastSlot | null>>
  const before = (prev ?? {}) as Partial<Record<Slot, CastSlot | null>>
  const cast = emptyCast()
  for (const slot of SLOTS) {
    const entry = source[slot]
    if (!entry || typeof entry !== 'object' || !entry.characterId) {
      cast[slot] = null
      continue
    }
    const carried = before[slot]
    const sameSubject = !!carried && carried.characterId === entry.characterId
    cast[slot] = {
      characterId: entry.characterId,
      expression: typeof entry.expression === 'string' ? entry.expression : '',
      transform: normalizeTransform(
        entry.transform ?? (sameSubject ? carried?.transform : undefined) ?? DEFAULT_TRANSFORM,
      ),
    }
  }
  return cast
}

export function createLineFrame(prev?: LineFrame | null): LineFrame {
  return {
    id: uid('f'),
    type: 'line',
    speaker: { characterId: null, name: '' },
    text: '',
    bg: prev?.bg ?? null,
    bgm: prev?.bgm ?? null,
    sfx: null,
    voice: null,
    // 舞台是完整快照，新建帧逐槽位复制上一帧（含缩放与偏移），而不是共享引用
    cast: prev ? normalizeCast(prev.cast, prev.cast) : emptyCast(),
    transition: prev?.transition ?? 'fade',
    shake: false,
  }
}

export function createChoiceFrame(): ChoiceFrame {
  return {
    id: uid('f'),
    type: 'choice',
    prompt: '',
    options: [
      { id: uid('o'), text: '', target: null, setFlags: {}, requires: null },
      { id: uid('o'), text: '', target: null, setFlags: {}, requires: null },
    ],
  }
}

export function createJumpFrame(): JumpFrame {
  return { id: uid('f'), type: 'jump', requires: null, target: null }
}

export function createEndFrame(): EndFrame {
  return { id: uid('f'), type: 'end', kind: 'chapter', title: '本章完', subtitle: '', next: null }
}

export function createOption(): ChoiceOption {
  return { id: uid('o'), text: '', target: null, setFlags: {}, requires: null }
}

export function createScene(name = '新场景'): Scene {
  return { id: uid('s'), name, frames: [createLineFrame()] }
}

export function createCharacter(name = '新角色', color = '#9d8cff'): Character {
  return { id: uid('c'), name, color, sprites: {} }
}

export function createProject(name = '未命名作品', author = ''): Project {
  const now = Date.now()
  return {
    meta: {
      id: uid('p'),
      name,
      author,
      description: '',
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      stage: { width: 1280, height: 720 },
      theme: { accent: '#9d8cff', skin: 'pgf' },
      title: { enabled: true, subtitle: '', background: null },
    },
    scenes: [createScene('第一幕')],
    characters: [],
    flags: [],
    assets: [],
  }
}

/** 找到 index 之前最近的一个叙事帧，用于「延续上一帧的舞台」 */
export function previousLineFrame(scene: Scene, index: number): LineFrame | null {
  for (let i = index - 1; i >= 0; i--) {
    const frame = scene.frames[i]
    if (frame && frame.type === 'line') return frame
  }
  return null
}

export function countFrames(project: Project): number {
  return project.scenes.reduce((sum, scene) => sum + scene.frames.length, 0)
}

export function summarize(project: Project): ProjectSummary {
  return {
    id: project.meta.id,
    name: project.meta.name,
    author: project.meta.author,
    description: project.meta.description,
    createdAt: project.meta.createdAt,
    updatedAt: project.meta.updatedAt,
    sceneCount: project.scenes.length,
    frameCount: countFrames(project),
  }
}

export function frameLabel(frame: Frame, project: Project): string {
  switch (frame.type) {
    case 'line': {
      if (!frame.text) return '空台词'
      const char = frame.speaker.characterId
        ? project.characters.find((c) => c.id === frame.speaker.characterId)
        : null
      return char ? `${char.name}：${frame.text}` : frame.text
    }
    case 'choice':
      return frame.options.map((o) => o.text || '未命名').join(' / ')
    case 'jump':
      return frame.requires ? `条件跳转 · ${frame.requires.key}` : '跳转'
    case 'end':
      return frame.title || '结束'
    default:
      return ''
  }
}

export function speakerName(project: Project, frame: LineFrame): string {
  if (!frame.speaker.characterId) return frame.speaker.name
  return project.characters.find((c) => c.id === frame.speaker.characterId)?.name ?? ''
}

/* ------------------------------------------------------------------ *
 * 运行数据包
 * ------------------------------------------------------------------ */

export function buildPayload(
  project: Project,
  resolvePath: (assetId: string) => string,
): RuntimePayload {
  const assets: Record<string, RuntimeAsset> = {}
  project.assets.forEach((asset) => {
    assets[asset.id] = { kind: asset.kind, path: resolvePath(asset.id), name: asset.name }
  })
  const characters: RuntimePayload['characters'] = {}
  project.characters.forEach((c) => {
    characters[c.id] = { name: c.name, color: c.color, sprites: { ...c.sprites } }
  })
  return {
    format: 'galastar/2',
    meta: {
      id: project.meta.id,
      name: project.meta.name,
      author: project.meta.author,
      description: project.meta.description,
      version: project.meta.version,
      accent: project.meta.theme.accent,
      skin: project.meta.theme.skin,
      stage: project.meta.stage,
      title: project.meta.title,
    },
    characters,
    scenes: project.scenes,
    flags: project.flags,
    assets,
  }
}

/* ------------------------------------------------------------------ *
 * 导入容错：外部文件可能来自旧版本或手工修改
 * ------------------------------------------------------------------ */

export function normalizeProject(raw: unknown): Project {
  const data = raw as Partial<Project>
  if (!data || typeof data !== 'object' || !data.meta)
    throw new Error('不是有效的 Galastar 作品文件')
  const base = createProject(data.meta.name || '导入的作品')
  const project: Project = {
    meta: {
      ...base.meta,
      ...data.meta,
      stage: { width: 1280, height: 720 },
      theme: {
        accent: data.meta.theme?.accent || '#9d8cff',
        skin: data.meta.theme?.skin === 'night' ? 'night' : 'pgf',
      },
      title: {
        enabled: data.meta.title?.enabled ?? true,
        subtitle: data.meta.title?.subtitle ?? '',
        background: data.meta.title?.background ?? null,
      },
    },
    scenes: Array.isArray(data.scenes) && data.scenes.length ? data.scenes : base.scenes,
    characters: Array.isArray(data.characters) ? data.characters : [],
    flags: Array.isArray(data.flags) ? data.flags : [],
    assets: Array.isArray(data.assets) ? data.assets : [],
  }
  project.scenes = project.scenes.map((scene) => ({
    ...scene,
    id: scene.id || uid('s'),
    name: scene.name || '未命名场景',
    frames: (scene.frames || []).map((frame) => normalizeFrame(frame)),
  }))
  return project
}

function normalizeFrame(frame: Frame): Frame {
  if (!frame || typeof frame !== 'object') return createLineFrame()
  if (frame.type === 'line') {
    return {
      ...createLineFrame(),
      ...frame,
      speaker: frame.speaker ?? { characterId: null, name: '' },
      cast: normalizeCast(frame.cast),
    }
  }
  if (frame.type === 'choice') {
    return { ...frame, options: (frame.options || []).map((o) => ({ ...createOption(), ...o })) }
  }
  if (frame.type === 'jump') return { ...createJumpFrame(), ...frame }
  return { ...createEndFrame(), ...frame }
}

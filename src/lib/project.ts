import type {
  CastMap,
  Character,
  ChoiceFrame,
  ChoiceOption,
  EndFrame,
  Frame,
  JumpFrame,
  LineFrame,
  Project,
  ProjectSummary,
  RuntimeAsset,
  RuntimePayload,
  Scene,
} from './types'
import { uid } from './utils'

export const emptyCast = (): CastMap => ({ left: null, center: null, right: null })

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
    cast: prev ? { ...prev.cast } : emptyCast(),
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
      cast: { ...emptyCast(), ...frame.cast },
    }
  }
  if (frame.type === 'choice') {
    return { ...frame, options: (frame.options || []).map((o) => ({ ...createOption(), ...o })) }
  }
  if (frame.type === 'jump') return { ...createJumpFrame(), ...frame }
  return { ...createEndFrame(), ...frame }
}

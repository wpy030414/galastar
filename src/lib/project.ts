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

/* ------------------------------------------------------------------ *
 * 示例作品：用程序生成的 SVG 素材，保证离线可用、开箱即看
 * ------------------------------------------------------------------ */

function svgEdge(body: string, defs: string, w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`
}

function backgroundSvg(kind: 'dusk' | 'night' | 'dawn'): string {
  const grain = `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>`
  const grainRect = `<rect width="1280" height="720" filter="url(#grain)" opacity="0.06"/>`
  if (kind === 'dusk') {
    return svgEdge(
      `<rect width="1280" height="720" fill="url(#sky)"/>
       <circle cx="960" cy="230" r="210" fill="url(#sun)"/>
       <circle cx="960" cy="230" r="54" fill="#ffe6b0" opacity="0.92"/>
       <path d="M0 560 C 220 520 380 596 640 566 C 900 536 1080 588 1280 548 L1280 720 L0 720 Z" fill="#171225" opacity="0.72"/>
       <path d="M0 626 C 260 596 520 650 820 616 C 1040 592 1160 622 1280 606 L1280 720 L0 720 Z" fill="#0d0a17" opacity="0.86"/>
       ${grainRect}`,
      `<linearGradient id="sky" x1="0" y1="0" x2="0.3" y2="1">
         <stop offset="0" stop-color="#2b2145"/><stop offset="0.48" stop-color="#7a4f70"/>
         <stop offset="0.78" stop-color="#c9795f"/><stop offset="1" stop-color="#f0b083"/>
       </linearGradient>
       <radialGradient id="sun"><stop offset="0" stop-color="#ffd9a3" stop-opacity="0.85"/><stop offset="1" stop-color="#ffb37a" stop-opacity="0"/></radialGradient>
       ${grain}`,
      1280,
      720,
    )
  }
  if (kind === 'night') {
    let stars = ''
    let seed = 7
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    for (let i = 0; i < 150; i++) {
      const x = rnd() * 1280
      const y = rnd() * 470
      const r = rnd() * 1.5 + 0.4
      stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#ffffff" opacity="${(0.25 + rnd() * 0.6).toFixed(2)}"/>`
    }
    return svgEdge(
      `<rect width="1280" height="720" fill="url(#sky)"/>
       <circle cx="300" cy="180" r="150" fill="url(#moon)"/>
       <circle cx="300" cy="180" r="42" fill="#f4f1e6" opacity="0.95"/>
       ${stars}
       <path d="M0 588 L1280 566 L1280 720 L0 720 Z" fill="#080b18"/>
       <path d="M180 588 L180 470 L300 470 L300 588 Z" fill="#0b0f20" opacity="0.9"/>
       <path d="M1040 580 L1040 430 L1140 430 L1140 580 Z" fill="#0b0f20" opacity="0.9"/>
       ${grainRect}`,
      `<linearGradient id="sky" x1="0" y1="0" x2="0.1" y2="1">
         <stop offset="0" stop-color="#05060f"/><stop offset="0.55" stop-color="#121a38"/><stop offset="1" stop-color="#2c3459"/>
       </linearGradient>
       <radialGradient id="moon"><stop offset="0" stop-color="#dfe6ff" stop-opacity="0.55"/><stop offset="1" stop-color="#aab8ff" stop-opacity="0"/></radialGradient>
       ${grain}`,
      1280,
      720,
    )
  }
  return svgEdge(
    `<rect width="1280" height="720" fill="url(#sky)"/>
     <circle cx="420" cy="470" r="330" fill="url(#glow)"/>
     <path d="M0 512 C 320 486 560 528 860 502 C 1060 486 1180 506 1280 496 L1280 720 L0 720 Z" fill="#1b2340" opacity="0.5"/>
     <path d="M0 596 C 340 574 660 612 980 588 C 1120 578 1200 590 1280 584 L1280 720 L0 720 Z" fill="#121a30" opacity="0.7"/>
     ${grainRect}`,
    `<linearGradient id="sky" x1="0" y1="0" x2="0.2" y2="1">
       <stop offset="0" stop-color="#101a33"/><stop offset="0.5" stop-color="#4a4f83"/><stop offset="1" stop-color="#e3a390"/>
     </linearGradient>
     <radialGradient id="glow"><stop offset="0" stop-color="#ffd9c9" stop-opacity="0.55"/><stop offset="1" stop-color="#ffc6b0" stop-opacity="0"/></radialGradient>
     ${grain}`,
    1280,
    720,
  )
}

function silhouetteSvg(tone: 'cool' | 'warm', variant: 'calm' | 'smile'): string {
  const bodyTop = tone === 'cool' ? '#61539c' : '#a56484'
  const bodyBottom = tone === 'cool' ? '#241e42' : '#331d33'
  const hairTop = tone === 'cool' ? '#493f7c' : '#4c3049'
  const skinTop = tone === 'cool' ? '#7b6cbb' : '#bb7a94'
  const rim = tone === 'cool' ? '#b9b0ff' : '#ffc0ad'
  const tilt = variant === 'smile' ? 2 : 0
  const lockShift = variant === 'smile' ? 10 : 0
  return svgEdge(
    `<g>
       <path d="M300 130c-74 0-106 58-104 130 2 56 12 96 16 128l176 0c4-32 14-72 16-128 2-72-30-130-104-130z" fill="url(#hair)"/>
       <path d="M276 322h48v70c0 16-11 26-24 26s-24-10-24-26z" fill="url(#skin)"/>
       <path d="M300 366c-64 0-104 22-132 58-26 34-36 96-42 168l-18 608h384l-18-608c-6-72-16-134-42-168-28-36-68-58-132-58z" fill="url(#body)"/>
       <path d="M270 372c10 22 18 34 30 34s20-12 30-34c-18-10-42-10-60 0z" fill="url(#collar)"/>
       <ellipse cx="300" cy="248" rx="86" ry="98" fill="url(#skin)" transform="rotate(${tilt} 300 248)"/>
       <path d="M300 136c-66 0-96 54-94 116 10-34 34-52 62-56 26-4 52 4 72 24 18 18 28 44 30 70 16-58-2-154-70-154z" fill="url(#hair)"/>
       <path d="M${396 + lockShift} 214c10 46 10 92 0 138l-22-6c10-42 12-88 4-130z" fill="url(#hair)"/>
       <path d="M214 246c0 62 12 108 18 142" fill="none" stroke="${rim}" stroke-opacity="0.5" stroke-width="3"/>
       <path d="M304 140c-64 0-92 52-90 108" fill="none" stroke="${rim}" stroke-opacity="0.4" stroke-width="3"/>
       <path d="M168 424c-26 34-36 96-42 168l-18 608" fill="none" stroke="${rim}" stroke-opacity="0.32" stroke-width="3"/>
     </g>`,
    `<linearGradient id="body" x1="0.1" y1="0" x2="0.5" y2="1">
       <stop offset="0" stop-color="${bodyTop}"/><stop offset="1" stop-color="${bodyBottom}"/>
     </linearGradient>
     <linearGradient id="hair" x1="0.2" y1="0" x2="0.7" y2="1">
       <stop offset="0" stop-color="${hairTop}"/><stop offset="1" stop-color="${bodyBottom}"/>
     </linearGradient>
     <linearGradient id="skin" x1="0.2" y1="0" x2="0.8" y2="1">
       <stop offset="0" stop-color="${skinTop}"/><stop offset="1" stop-color="${hairTop}"/>
     </linearGradient>
     <linearGradient id="collar" x1="0" y1="0" x2="0" y2="1">
       <stop offset="0" stop-color="${rim}" stop-opacity="0.22"/><stop offset="1" stop-color="${rim}" stop-opacity="0"/>
     </linearGradient>`,
    600,
    1200,
  )
}

function svgFile(name: string, content: string): File {
  return new File([content], name, { type: 'image/svg+xml' })
}

/** 返回示例作品的素材文件，供首次启动时导入 */
export function demoAssetFiles(): File[] {
  return [
    svgFile('bgi-dusk.svg', backgroundSvg('dusk')),
    svgFile('bgi-night.svg', backgroundSvg('night')),
    svgFile('bgi-dawn.svg', backgroundSvg('dawn')),
    svgFile('img-haruka-calm.svg', silhouetteSvg('cool', 'calm')),
    svgFile('img-haruka-smile.svg', silhouetteSvg('cool', 'smile')),
    svgFile('img-mio-calm.svg', silhouetteSvg('warm', 'calm')),
    svgFile('img-mio-smile.svg', silhouetteSvg('warm', 'smile')),
  ]
}

export interface DemoBlueprint {
  project: Project
  /** 素材文件名 -> 资产 id，导入素材后按此建立引用 */
  slots: {
    bgDusk: string
    bgNight: string
    bgDawn: string
    harukaCalm: string
    harukaSmile: string
    mioCalm: string
    mioSmile: string
  }
}

export function createDemoProject(): DemoBlueprint {
  const project = createProject('星のかけら', 'Galastar')
  project.meta.description =
    '一个用来演示 Galastar 全部能力的短篇：逐字台词、立绘说话高亮、背景转场、分支选项、标记变量与章节衔接。'
  project.meta.title.subtitle = 'A Galastar Demo'

  const slots = {
    bgDusk: uid('a'),
    bgNight: uid('a'),
    bgDawn: uid('a'),
    harukaCalm: uid('a'),
    harukaSmile: uid('a'),
    mioCalm: uid('a'),
    mioSmile: uid('a'),
  }

  const haruka: Character = {
    id: uid('c'),
    name: '青井 遥',
    color: '#9db8ff',
    sprites: { 平静: slots.harukaCalm, 微笑: slots.harukaSmile },
  }
  const mio: Character = {
    id: uid('c'),
    name: '水尾 澪',
    color: '#ffb1a0',
    sprites: { 平静: slots.mioCalm, 微笑: slots.mioSmile },
  }
  project.characters = [haruka, mio]
  project.flags = [
    { key: 'stayed', initial: 'false' },
    { key: 'affection', initial: '0' },
  ]

  const prologue: Scene = { id: uid('s'), name: '序章 · 天台的风', frames: [] }
  const stayScene: Scene = { id: uid('s'), name: '分支 A · 留下来', frames: [] }
  const leaveScene: Scene = { id: uid('s'), name: '分支 B · 先回去', frames: [] }
  const finale: Scene = { id: uid('s'), name: '终章 · 星のかけら', frames: [] }

  const line = (patch: Partial<LineFrame>): LineFrame => ({ ...createLineFrame(), ...patch })
  const say = (char: Character | null, text: string, patch: Partial<LineFrame> = {}): LineFrame =>
    line({
      speaker: char ? { characterId: char.id, name: char.name } : { characterId: null, name: '' },
      text,
      ...patch,
    })

  prologue.frames = [
    say(null, '放学后的天台，风把云吹成一条缓缓流动的河。', {
      bg: slots.bgDusk,
      transition: 'fade',
    }),
    say(haruka, '你居然真的爬上来了。', {
      bg: slots.bgDusk,
      cast: { left: null, center: { characterId: haruka.id, expression: '平静' }, right: null },
      transition: 'fade',
    }),
    say(null, '青井遥靠在栏杆上，校服的裙摆被风掀起又落下。', {
      bg: slots.bgDusk,
      cast: { left: null, center: { characterId: haruka.id, expression: '平静' }, right: null },
    }),
    say(haruka, '因为你说，有东西要给我看？', {
      bg: slots.bgDusk,
      cast: { left: null, center: { characterId: haruka.id, expression: '微笑' }, right: null },
    }),
    say(haruka, '再等一下。太阳还没落到那条线上。', {
      bg: slots.bgDusk,
      cast: { left: null, center: { characterId: haruka.id, expression: '平静' }, right: null },
      transition: 'dissolve',
    }),
    say(null, '天空慢慢褪成深蓝，第一颗星浮了上来。', {
      bg: slots.bgNight,
      cast: { left: null, center: { characterId: haruka.id, expression: '平静' }, right: null },
      transition: 'fade',
    }),
    say(haruka, '……留下来陪我看完，好不好？', {
      bg: slots.bgNight,
      cast: { left: null, center: { characterId: haruka.id, expression: '微笑' }, right: null },
    }),
  ]

  const choice: ChoiceFrame = {
    id: uid('f'),
    type: 'choice',
    prompt: '风停了，城市的声音从很远的地方传来。',
    options: [
      {
        id: uid('o'),
        text: '留下来，陪她看完整片星空',
        target: stayScene.id,
        setFlags: { stayed: 'true', affection: '1' },
        requires: null,
      },
      {
        id: uid('o'),
        text: '今天就先回去吧',
        target: leaveScene.id,
        setFlags: { stayed: 'false' },
        requires: null,
      },
    ],
  }
  prologue.frames.push(choice)

  stayScene.frames = [
    line({
      speaker: { characterId: haruka.id, name: haruka.name },
      text: '谢谢你没有走。',
      bg: slots.bgNight,
      cast: { left: null, center: { characterId: haruka.id, expression: '微笑' }, right: null },
      transition: 'fade',
      shake: false,
    }),
    line({
      speaker: { characterId: null, name: '' },
      text: '她把掌心摊开，里面是一枚被磨得发亮的玻璃碎片。',
      bg: slots.bgNight,
      cast: { left: null, center: { characterId: haruka.id, expression: '平静' }, right: null },
    }),
    line({
      speaker: { characterId: haruka.id, name: haruka.name },
      text: '他们说，这种碎片是从星星上掉下来的。我一直想找个人一起确认。',
      bg: slots.bgNight,
      cast: { left: null, center: { characterId: haruka.id, expression: '平静' }, right: null },
    }),
    { id: uid('f'), type: 'jump', requires: null, target: finale.id },
  ]

  leaveScene.frames = [
    line({
      speaker: { characterId: mio.id, name: mio.name },
      text: '这么早就下来啦？遥还在上面吗？',
      bg: slots.bgDusk,
      cast: { left: { characterId: mio.id, expression: '平静' }, center: null, right: null },
      transition: 'fade',
    }),
    line({
      speaker: { characterId: null, name: '' },
      text: '回望天台的方向，只剩下一盏还亮着的灯。',
      bg: slots.bgDusk,
      cast: { left: { characterId: mio.id, expression: '平静' }, center: null, right: null },
    }),
    {
      id: uid('f'),
      type: 'end',
      kind: 'chapter',
      title: '第一幕 · 完',
      subtitle: '有些夜晚，只适合留在下一次。',
      next: finale.id,
    },
  ]

  finale.frames = [
    line({
      speaker: { characterId: null, name: '' },
      text: '第二天清晨，天台的门开着，栏杆上落了一层薄薄的露水。',
      bg: slots.bgDawn,
      cast: { left: null, center: null, right: null },
      transition: 'fade',
    }),
    line({
      speaker: { characterId: haruka.id, name: haruka.name },
      text: '早。今天也一起看星星吧——虽然现在是早上。',
      bg: slots.bgDawn,
      cast: {
        left: { characterId: haruka.id, expression: '微笑' },
        center: null,
        right: { characterId: mio.id, expression: '微笑' },
      },
    }),
    {
      id: uid('f'),
      type: 'end',
      kind: 'ending',
      title: '星のかけら',
      subtitle: '谢谢你读到这里。\n—— Demo End ——',
      next: null,
    },
  ]

  project.scenes = [prologue, stayScene, leaveScene, finale]
  project.meta.title.background = slots.bgNight

  return { project, slots }
}

export const DEMO_FILE_MAP: Array<{
  key: keyof DemoBlueprint['slots']
  file: string
  kind: 'background' | 'sprite'
}> = [
  { key: 'bgDusk', file: 'bgi-dusk.svg', kind: 'background' },
  { key: 'bgNight', file: 'bgi-night.svg', kind: 'background' },
  { key: 'bgDawn', file: 'bgi-dawn.svg', kind: 'background' },
  { key: 'harukaCalm', file: 'img-haruka-calm.svg', kind: 'sprite' },
  { key: 'harukaSmile', file: 'img-haruka-smile.svg', kind: 'sprite' },
  { key: 'mioCalm', file: 'img-mio-calm.svg', kind: 'sprite' },
  { key: 'mioSmile', file: 'img-mio-smile.svg', kind: 'sprite' },
]

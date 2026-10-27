/**
 * Galastar 2.0 数据模型
 *
 * 设计原则：**每一帧都是一份完整的舞台快照**。
 * v1 用的是「增量补丁 + null 表示不修改」，导致剧本无法单独阅读、撤销困难、也容易踩空指针。
 * v2 让每一帧自包含（背景、立绘、音乐全部写在帧里），编辑器新建帧时自动继承上一帧，
 * 于是「写起来一样省事，读起来完全自洽」。
 */

export type AssetKind = 'background' | 'sprite' | 'bgm' | 'sfx' | 'voice'

/** 界面语言。编辑器偏好在首选项里切；作品的播放器语言写在 meta.locale。 */
export type Locale = 'zh-CN' | 'en'

/** 资产元信息。本地素材的二进制存放在 IndexedDB 的 blobs 表里，按 `${projectId}:${assetId}` 取。 */
export interface AssetRecord {
  id: string
  kind: AssetKind
  /** 原始文件名，仅用于展示 */
  name: string
  /** 打包时使用的文件名（同一作品内唯一） */
  fileName: string
  mime: string
  size: number
  width?: number
  height?: number
  createdAt: number
  /**
   * 远程素材：直接引用 http(s) 链接，不读取本地 blob，打包时也不复制进 media/。
   * 有值时播放器与导出产物都用它作为资源地址；没有文件也能通过校验。
   */
  url?: string
}

export type Slot = 'left' | 'center' | 'right'

/**
 * 立绘摆放。
 * 立绘原图不一定是按角色居中裁切的，透明留白也各不相同，
 * 所以「站位」只给一个落点，缩放与偏移留给每一帧自己调。
 * 单位统一在 1280×720 舞台坐标系，播放器缩放时跟着舞台一起缩。
 */
export interface SpriteTransform {
  /** 相对站位预设高度的缩放百分比，100 为正好占满站位 */
  scale: number
  /** 水平偏移（px），正方向向右 */
  offsetX: number
  /** 垂直偏移（px），正方向向下 */
  offsetY: number
}

/**
 * 三个字段各自可调到哪儿。滑杆、数字输入和归一化都读这里，
 * 免得界面上的范围和落盘时的裁剪各写一份而慢慢对不上。
 * step 取 1：滑杆与数字框必须显示同一个数，
 * 否则输入 78 会被吸附到 5 的倍数，看起来像被改回去了。
 * 偏移上限取舞台的一半（1280/2、720 上下留裕度），足够把立绘推出画面。
 */
export const TRANSFORM_LIMITS = {
  scale: { min: 20, max: 300, step: 1 },
  offsetX: { min: -640, max: 640, step: 1 },
  offsetY: { min: -400, max: 400, step: 1 },
} as const satisfies Record<keyof SpriteTransform, { min: number; max: number; step: number }>

export const DEFAULT_TRANSFORM: SpriteTransform = { scale: 100, offsetX: 0, offsetY: 0 }

export interface CastSlot {
  characterId: string
  /** 表情键，对应 Character.sprites 的下标 */
  expression: string
  transform: SpriteTransform
}

export type CastMap = Record<Slot, CastSlot | null>

/**
 * 播放器皮肤。
 * pgf —— 初代 PGF 界面，取法 NEKOPARA 的排版（白字描边、清晰背景、暗红选项条），默认。
 * night —— 现代一点的暗色底衬版，适合画面偏暗或偏写实的作品。
 */
export type UiSkin = 'pgf' | 'night'

export type Transition = 'cut' | 'fade' | 'dissolve' | 'flash' | 'rise'

export interface Speaker {
  characterId: string | null
  /** characterId 为空时使用，空字符串表示旁白 */
  name: string
}

/** 标准叙事帧 */
export interface LineFrame {
  id: string
  type: 'line'
  speaker: Speaker
  /**
   * 心理活动：这句是「听到想法」而不是「听到声音」。
   * 开启后不显示说话人名牌，立绘由播放器自己判亮暗——
   * 有明确角色归因（characterId）就是场上某个人的内心，只亮他一个；
   * 归因是空的（旁白位选自定义名 / 无名）就是第一人称的「我」，全场压暗。
   */
  innerVoice: boolean
  text: string
  bg: string | null
  bgm: string | null
  /** 本次点击立即播放的一次性音效 */
  sfx: string | null
  /** 角色语音 */
  voice: string | null
  cast: CastMap
  transition: Transition
  /** 演出附加：轻微震屏 */
  shake: boolean
}

export type CompareOp = '==' | '!=' | '>' | '>=' | '<' | '<='

export interface Condition {
  key: string
  op: CompareOp
  value: string
}

export interface ChoiceOption {
  id: string
  text: string
  /** 目标场景；null 表示继续播放本场景的下一帧 */
  target: string | null
  /** 选择后写入的标记 */
  setFlags: Record<string, string>
  /** 仅当条件满足时该选项才出现 */
  requires: Condition | null
}

export interface ChoiceFrame {
  id: string
  type: 'choice'
  prompt: string
  options: ChoiceOption[]
}

export interface JumpFrame {
  id: string
  type: 'jump'
  /** 条件成立（或无条件）时跳转，否则顺延到下一帧 */
  requires: Condition | null
  target: string | null
}

export interface EndFrame {
  id: string
  type: 'end'
  kind: 'chapter' | 'ending'
  title: string
  subtitle: string
  /** 下一场景，用于章节衔接；null 表示回到标题 */
  next: string | null
}

export type Frame = LineFrame | ChoiceFrame | JumpFrame | EndFrame

export type FrameType = Frame['type']

export interface Character {
  id: string
  name: string
  /** 名字牌颜色，hex */
  color: string
  /** 表情名 -> 立绘资产 id */
  sprites: Record<string, string>
}

export interface Scene {
  id: string
  name: string
  frames: Frame[]
}

export interface FlagDef {
  key: string
  initial: string
}

export interface ProjectMeta {
  id: string
  name: string
  author: string
  description: string
  version: string
  createdAt: number
  updatedAt: number
  /** 舞台尺寸固定 16:9，保留字段便于以后扩展 */
  stage: { width: number; height: number }
  theme: {
    /** 界面高亮色，night 皮肤用得最多 */
    accent: string
    /** 播放器皮肤，决定玩家看到的界面长相 */
    skin: UiSkin
  }
  /** 播放器与标题界面的语言；导出后玩家看到的就是这一套文案 */
  locale: Locale
  title: {
    enabled: boolean
    subtitle: string
    background: string | null
  }
}

export interface Project {
  meta: ProjectMeta
  scenes: Scene[]
  characters: Character[]
  flags: FlagDef[]
  assets: AssetRecord[]
}

export interface ProjectSummary {
  id: string
  name: string
  author: string
  description: string
  createdAt: number
  updatedAt: number
  sceneCount: number
  frameCount: number
}

/** 运行时（播放器）使用的数据包，编辑器预览与导出 zip 共用同一份结构 */
export interface RuntimeAsset {
  kind: AssetKind
  /** 相对路径（导出）或 blob: URL（预览） */
  path: string
  name: string
}

export interface RuntimePayload {
  format: 'galastar/2'
  meta: {
    id: string
    name: string
    author: string
    description: string
    version: string
    accent: string
    skin: UiSkin
    locale: Locale
    stage: { width: number; height: number }
    title: { enabled: boolean; subtitle: string; background: string | null }
  }
  characters: Record<string, { name: string; color: string; sprites: Record<string, string> }>
  scenes: Scene[]
  flags: FlagDef[]
  assets: Record<string, RuntimeAsset>
}

/**
 * 工程校验：把「运行时其实会静默接受、但作者一定写错了」的情况说出来。
 *
 * 数据层的 normalizeProject 只会补默认值，不会报错；播放器遇到悬空引用
 * 也只是不显示、不跳转。对 GUI 而言这是容错，对 Agent 而言这是陷阱——
 * 它需要一个能照着修的清单，所以这里把规则写成稳定的 code + 中文说明。
 *
 * 纯函数：不读文件系统，素材是否落盘由调用方以 assetsOnDisk 注入。
 */
import { isHttpUrl } from './pure'
import { TRANSFORM_LIMITS } from './types'
import type { AssetKind } from './types'

export type Severity = 'error' | 'warning'

export interface Issue {
  severity: Severity
  code: string
  path: string
  message: string
  hint?: string
}

export interface ValidateResult {
  issues: Issue[]
  truncated: boolean
  summary: { scenes: number; frames: number; assets: number; errors: number; warnings: number }
}

export interface ValidateOptions {
  /** 已落盘的素材文件名；传入时才检查文件是否存在 */
  assetsOnDisk?: Set<string>
  /** 缺素材算 error（构建）还是 warning（预检） */
  missingIsError?: boolean
  /** 最多返回多少条，默认 200 */
  maxIssues?: number
}

type Rec = Record<string, unknown>

const ASSET_KINDS: AssetKind[] = ['background', 'sprite', 'bgm', 'voice', 'sfx']
const TRANSITIONS = ['cut', 'fade', 'dissolve', 'flash', 'rise']
const OPS = ['==', '!=', '>', '>=', '<', '<=']
const SLOTS = ['left', 'center', 'right'] as const
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
const IMAGE_FILE = /\.(png|jpe?g|webp|gif|svg|avif)$/i
const VIDEO_FILE = /\.(mp4|m4v|mov|webm|ogv)$/i
const AUDIO_FILE = /\.(mp3|ogg|oga|wav|m4a|flac|aac)$/i

type Media = 'image' | 'video' | 'audio'

/** 素材文件是哪一类媒体：先看 mime，老工程的 mime 不准时再看扩展名 */
function mediaKindOf(mime: unknown, fileName: unknown): Media | null {
  if (typeof mime === 'string') {
    if (mime.startsWith('image/')) return 'image'
    if (mime.startsWith('video/')) return 'video'
    if (mime.startsWith('audio/')) return 'audio'
  }
  if (typeof fileName === 'string') {
    if (IMAGE_FILE.test(fileName)) return 'image'
    if (VIDEO_FILE.test(fileName)) return 'video'
    if (AUDIO_FILE.test(fileName)) return 'audio'
  }
  return null
}

/** 立绘只走 <img>、音频只走 <audio>，只有背景能吃视频 */
const ALLOWED_MEDIA: Record<AssetKind, Media[]> = {
  background: ['image', 'video'],
  sprite: ['image'],
  bgm: ['audio'],
  voice: ['audio'],
  sfx: ['audio'],
}

const isObj = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function isSafeFileName(name: string): boolean {
  if (!name || name.length > 120) return false
  if (name.includes('/') || name.includes('\\')) return false
  if (name.includes('..')) return false
  for (let i = 0; i < name.length; i += 1) {
    if (name.charCodeAt(i) < 32) return false
  }
  if (/[:*?"<>|]/.test(name)) return false
  if (RESERVED_NAMES.test(name)) return false
  return true
}

class Collector {
  issues: Issue[] = []
  error(code: string, path: string, message: string, hint?: string) {
    this.issues.push({ severity: 'error', code, path, message, hint })
  }
  warn(code: string, path: string, message: string, hint?: string) {
    this.issues.push({ severity: 'warning', code, path, message, hint })
  }
}

export function validateProject(raw: unknown, opts: ValidateOptions = {}): ValidateResult {
  const c = new Collector()
  const maxIssues = opts.maxIssues ?? 200
  const missingSeverity: Severity = opts.missingIsError ? 'error' : 'warning'

  let frames = 0
  let scenes = 0
  let assets = 0

  if (!isObj(raw) || !isObj(raw.meta)) {
    c.error(
      'E_PROJECT_SHAPE',
      'meta',
      'project.json 缺少 meta 对象',
      'meta 是必填项，至少要有 id 与 name',
    )
    return finish(c, maxIssues, { scenes, frames, assets })
  }

  const meta = raw.meta
  /* ---- meta ---- */
  if (!isStr(meta.id) || !meta.id.trim())
    c.warn(
      'W_META_ID_MISSING',
      'meta.id',
      'meta.id 缺失或为空',
      '构建时会生成随机 id，本地存档会因此对不上',
    )
  for (const key of ['name', 'author', 'description', 'version'] as const) {
    if (meta[key] != null && !isStr(meta[key]))
      c.error('E_META_FIELD', `meta.${key}`, `meta.${key} 必须是字符串`)
  }
  if (meta.locale != null && meta.locale !== 'zh-CN' && meta.locale !== 'en')
    c.warn(
      'W_LOCALE',
      'meta.locale',
      `locale 只支持 zh-CN / en，收到 ${JSON.stringify(meta.locale)}`,
      '会被归一化为 zh-CN',
    )
  const stage = meta.stage
  if (!isObj(stage) || stage.width !== 1280 || stage.height !== 720)
    c.warn('W_STAGE', 'meta.stage', '舞台尺寸不是 1280×720', '编辑器导入时会重置为 1280×720')
  if (isObj(meta.theme)) {
    const theme = meta.theme
    if (theme.skin != null && theme.skin !== 'pgf' && theme.skin !== 'night')
      c.warn(
        'W_SKIN',
        'meta.theme.skin',
        `skin 只支持 pgf / night，收到 ${JSON.stringify(theme.skin)}`,
      )
    if (theme.accent != null && !(isStr(theme.accent) && /^#[0-9a-f]{6}$/i.test(theme.accent)))
      c.warn('W_ACCENT', 'meta.theme.accent', 'accent 建议写成 #rrggbb')
  }
  if (isObj(meta.title) && meta.title.enabled != null && typeof meta.title.enabled !== 'boolean')
    c.warn('W_TITLE_ENABLED', 'meta.title.enabled', 'title.enabled 必须是布尔值')

  /* ---- 集合 ---- */
  const characters = Array.isArray(raw.characters) ? raw.characters : []
  const flagDefs = Array.isArray(raw.flags) ? raw.flags : []
  const assetList = Array.isArray(raw.assets) ? raw.assets : []
  const sceneList = Array.isArray(raw.scenes) ? raw.scenes : []
  assets = assetList.length
  scenes = sceneList.length
  if (!Array.isArray(raw.scenes) || sceneList.length === 0) {
    c.error(
      'E_NO_SCENES',
      'scenes',
      'scenes 必须是非空数组',
      '至少写一个场景，播放器从 scenes[0] 第 0 帧开始',
    )
  }

  const characterById = new Map<string, Rec>()
  const characterIndexById = new Map<string, number>()
  const characterIdSet = new Set<string>()
  for (const [i, value] of characters.entries()) {
    const path = `characters[${i}]`
    if (!isObj(value)) {
      c.error('E_CHARACTER_SHAPE', path, '角色必须是对象')
      continue
    }
    if (!isStr(value.id) || !value.id.trim()) {
      c.error('E_CHARACTER_ID_MISSING', `${path}.id`, '角色缺少 id')
      continue
    }
    if (characterIdSet.has(value.id))
      c.error('E_DUP_CHARACTER_ID', `${path}.id`, `角色 id 重复：${value.id}`)
    characterIdSet.add(value.id)
    characterById.set(value.id, value)
    characterIndexById.set(value.id, i)
    if (value.sprites != null && !isObj(value.sprites))
      c.error('E_CHARACTER_SHAPE', `${path}.sprites`, 'sprites 必须是「表情 → 素材 id」的对象')
  }

  const flagKeys = new Set<string>()
  for (const [i, value] of flagDefs.entries()) {
    const path = `flags[${i}]`
    if (!isObj(value) || !isStr(value.key) || !value.key.trim()) {
      c.error('E_FLAG_SHAPE', path, 'flag 必须是 { key, initial } 且 key 非空')
      continue
    }
    if (flagKeys.has(value.key)) c.error('E_DUP_FLAG_KEY', `${path}.key`, `flag 重复：${value.key}`)
    flagKeys.add(value.key)
    if (value.initial != null && !isStr(value.initial))
      c.warn('W_FLAG_INITIAL', `${path}.initial`, 'flag.initial 建议用字符串')
  }

  /* ---- 素材 ---- */
  const assetById = new Map<string, Rec>()
  const fileNames = new Set<string>()
  const assetIds = new Set<string>()
  const referencedAssets = new Set<string>()
  for (const [i, value] of assetList.entries()) {
    const path = `assets[${i}]`
    if (!isObj(value)) {
      c.error('E_ASSET_SHAPE', path, '素材记录必须是对象')
      continue
    }
    if (!isStr(value.id) || !value.id.trim()) {
      c.error('E_ASSET_ID_MISSING', `${path}.id`, '素材缺少 id')
      continue
    }
    if (assetIds.has(value.id)) c.error('E_DUP_ASSET_ID', `${path}.id`, `素材 id 重复：${value.id}`)
    assetIds.add(value.id)
    assetById.set(value.id, value)
    if (!ASSET_KINDS.includes(value.kind as AssetKind))
      c.error('E_BAD_ENUM', `${path}.kind`, `kind 必须是 ${ASSET_KINDS.join(' / ')}`)
    else {
      const media = mediaKindOf(value.mime, value.fileName)
      if (media && !ALLOWED_MEDIA[value.kind as AssetKind].includes(media))
        c.error(
          'E_ASSET_MEDIA_UNSUPPORTED',
          path,
          `素材类型与 kind 不匹配：${String(value.fileName)} 是 ${media}，kind 却是 ${String(value.kind)}`,
          'background 可以吃图片与视频；sprite 只吃图片；bgm / sfx / voice 只吃音频',
        )
    }
    /* 远程素材：只认 http(s)，且不要求本地文件存在 */
    const remote = value.url != null
    if (remote && !isHttpUrl(value.url))
      c.error(
        'E_ASSET_URL_INVALID',
        `${path}.url`,
        'url 必须是 http:// 或 https:// 开头的链接',
        '只支持 http(s)；本地文件请放到 assets/，不要写 data: / file: 链接',
      )
    const fileName = value.fileName
    if (!isStr(fileName) || !isSafeFileName(fileName)) {
      c.error(
        'E_ASSET_FILENAME_UNSAFE',
        `${path}.fileName`,
        'fileName 必须是安全的单层文件名',
        '不能包含 / \\ .. 盘符或控制字符',
      )
    } else {
      if (fileNames.has(fileName))
        c.error('E_DUP_ASSET_FILENAME', `${path}.fileName`, `fileName 重复：${fileName}`)
      fileNames.add(fileName)
      if (opts.assetsOnDisk && !remote && !opts.assetsOnDisk.has(fileName)) {
        if (missingSeverity === 'error') {
          c.error(
            'E_ASSET_FILE_MISSING',
            path,
            `素材文件不存在：${fileName}`,
            '把它放到工程目录的 assets/ 下，或用 --allow-missing 允许缺素材',
          )
        } else {
          c.warn(
            'W_ASSET_FILE_MISSING',
            path,
            `素材文件尚未落盘：${fileName}`,
            '可用 galastar asset add 补上',
          )
        }
      }
    }
  }

  /* ---- 引用检查的小工具 ---- */
  const expectAsset = (id: unknown, kind: AssetKind, path: string) => {
    if (id == null) return
    if (!isStr(id) || !id.trim()) {
      c.error('E_ASSET_UNKNOWN', path, '素材引用必须是非空 id 或 null')
      return
    }
    referencedAssets.add(id)
    const asset = assetById.get(id)
    if (!asset) {
      c.error('E_ASSET_UNKNOWN', path, `引用了不存在的素材：${id}`)
      return
    }
    if (asset.kind !== kind)
      c.error(
        'E_ASSET_KIND_MISMATCH',
        path,
        `这里需要 ${kind} 素材，${id} 的类型是 ${String(asset.kind)}`,
      )
  }

  const expectScene = (id: unknown, path: string) => {
    if (id == null) return
    if (!isStr(id) || !id.trim()) {
      c.error('E_BAD_TARGET', path, '目标场景必须是非空 id 或 null')
      return
    }
    if (!sceneIdSetForCheck.has(id)) c.error('E_BAD_TARGET', path, `目标场景不存在：${id}`)
  }

  const checkCondition = (cond: unknown, path: string) => {
    if (cond == null) return
    if (!isObj(cond)) {
      c.error('E_BAD_CONDITION', path, 'requires 必须是 { key, op, value } 或 null')
      return
    }
    if (isStr(cond.op) && !OPS.includes(cond.op))
      c.error('E_BAD_CONDITION', `${path}.op`, `op 必须是 ${OPS.join(' ')}`)
    if (isStr(cond.key) && cond.key && !flagKeys.has(cond.key))
      c.warn(
        'W_FLAG_UNDECLARED',
        `${path}.key`,
        `条件引用了未声明的 flag：${cond.key}`,
        '建议在 flags 中声明初始值',
      )
  }

  const checkTransform = (t: unknown, path: string) => {
    if (t == null) return
    if (!isObj(t)) {
      c.error('E_BAD_TRANSFORM', path, 'transform 必须是 { scale, offsetX, offsetY }')
      return
    }
    const limits = {
      scale: TRANSFORM_LIMITS.scale,
      offsetX: TRANSFORM_LIMITS.offsetX,
      offsetY: TRANSFORM_LIMITS.offsetY,
    }
    for (const key of ['scale', 'offsetX', 'offsetY'] as const) {
      const value = t[key]
      if (value == null) continue
      if (!isNum(value)) {
        c.error('E_BAD_TRANSFORM', `${path}.${key}`, `${key} 必须是数字`)
        continue
      }
      const { min, max } = limits[key]
      if (value < min || value > max)
        c.warn(
          'W_TRANSFORM_CLAMPED',
          `${path}.${key}`,
          `${key}=${value} 超出 ${min}–${max}`,
          '运行时会夹取',
        )
    }
  }

  /* 场景 id 先收集，引用检查要用 */
  const sceneIdSetForCheck = new Set<string>()
  for (const scene of sceneList) {
    if (isObj(scene) && isStr(scene.id) && scene.id.trim()) sceneIdSetForCheck.add(scene.id)
  }

  const checkCast = (cast: unknown, path: string) => {
    if (cast == null) return
    if (!isObj(cast)) {
      c.error('E_BAD_CAST', path, 'cast 必须是 { left, center, right }')
      return
    }
    for (const slot of SLOTS) {
      const entry = cast[slot]
      const slotPath = `${path}.${slot}`
      if (entry == null) continue
      if (!isObj(entry)) {
        c.error('E_BAD_CAST', slotPath, '槽位必须是 { characterId, expression, transform } 或 null')
        continue
      }
      const characterId = entry.characterId
      if (!isStr(characterId) || !characterId.trim()) {
        c.error('E_CHARACTER_MISSING', `${slotPath}.characterId`, '槽位缺少 characterId')
        continue
      }
      const character = characterById.get(characterId)
      if (!character) {
        c.error('E_CHARACTER_MISSING', `${slotPath}.characterId`, `角色不存在：${characterId}`)
        continue
      }
      const expression = entry.expression
      const sprites = isObj(character.sprites) ? character.sprites : {}
      if (!isStr(expression) || !expression) {
        c.error('E_EXPRESSION_MISSING', `${slotPath}.expression`, '缺少表情名')
      } else if (!isStr(sprites[expression]) || !sprites[expression]) {
        c.error(
          'E_EXPRESSION_MISSING',
          `${slotPath}.expression`,
          `角色 ${characterId} 没有表情 ${expression}`,
          '先在 character.sprites 里登记「表情 → 立绘素材 id」',
        )
      } else {
        expectAsset(sprites[expression], 'sprite', `${slotPath}.expression`)
      }
      checkTransform(entry.transform, `${slotPath}.transform`)
    }
  }

  /* ---- 场景 / 帧 ---- */
  const sceneIds = new Set<string>()
  const frameIds = new Set<string>()
  const referencedScenes = new Set<string>()

  for (const [si, scene] of sceneList.entries()) {
    const scenePath = `scenes[${si}]`
    if (!isObj(scene)) {
      c.error('E_SCENE_SHAPE', scenePath, '场景必须是对象')
      continue
    }
    if (!isStr(scene.id) || !scene.id.trim()) {
      c.warn('W_SCENE_ID_MISSING', `${scenePath}.id`, '场景缺少 id', '导入时会补一个随机 id')
    } else {
      if (sceneIds.has(scene.id))
        c.error('E_DUP_SCENE_ID', `${scenePath}.id`, `场景 id 重复：${scene.id}`)
      sceneIds.add(scene.id)
    }
    if (scene.name != null && !isStr(scene.name))
      c.warn('W_SCENE_NAME', `${scenePath}.name`, '场景名建议用字符串')
    if (!Array.isArray(scene.frames)) {
      c.error('E_SCENE_SHAPE', `${scenePath}.frames`, 'frames 必须是数组')
      continue
    }
    if (scene.frames.length === 0)
      c.warn('W_EMPTY_SCENE', `${scenePath}.frames`, '场景没有任何帧', '进入后会直接显示占位结局')

    for (const [fi, frame] of scene.frames.entries()) {
      if (isObj(frame)) frames += 1
      const path = `${scenePath}.frames[${fi}]`
      if (!isObj(frame)) {
        c.error('E_FRAME_SHAPE', path, '帧必须是对象')
        continue
      }
      if (!isStr(frame.id) || !frame.id.trim()) {
        c.error('E_FRAME_ID_MISSING', `${path}.id`, '帧缺少 id')
      } else {
        if (frameIds.has(frame.id))
          c.error('E_DUP_FRAME_ID', `${path}.id`, `帧 id 全局重复：${frame.id}`)
        frameIds.add(frame.id)
      }

      switch (frame.type) {
        case 'line': {
          const speaker = frame.speaker
          if (speaker != null && !isObj(speaker)) {
            c.error('E_BAD_SPEAKER', `${path}.speaker`, 'speaker 必须是 { characterId, name }')
          } else if (isObj(speaker) && isStr(speaker.characterId) && speaker.characterId) {
            if (!characterById.has(speaker.characterId))
              c.warn(
                'W_SPEAKER_MISSING',
                `${path}.speaker.characterId`,
                `说话人角色不存在：${speaker.characterId}`,
                '播放器会退回到 speaker.name',
              )
          }
          if (frame.text != null && !isStr(frame.text))
            c.error('E_BAD_TEXT', `${path}.text`, 'text 必须是字符串')
          expectAsset(frame.bg, 'background', `${path}.bg`)
          expectAsset(frame.bgm, 'bgm', `${path}.bgm`)
          expectAsset(frame.sfx, 'sfx', `${path}.sfx`)
          expectAsset(frame.voice, 'voice', `${path}.voice`)
          if (
            frame.transition != null &&
            (typeof frame.transition !== 'string' || !TRANSITIONS.includes(frame.transition))
          )
            c.error(
              'E_BAD_ENUM',
              `${path}.transition`,
              `transition 必须是 ${TRANSITIONS.join(' / ')}`,
            )
          checkCast(frame.cast, `${path}.cast`)
          break
        }
        case 'choice': {
          if (frame.prompt != null && !isStr(frame.prompt))
            c.error('E_BAD_TEXT', `${path}.prompt`, 'prompt 必须是字符串')
          const options = Array.isArray(frame.options) ? frame.options : []
          if (!Array.isArray(frame.options)) {
            c.error('E_CHOICE_EMPTY', `${path}.options`, 'options 必须是数组')
            break
          }
          if (options.length === 0) {
            c.error(
              'E_CHOICE_EMPTY',
              `${path}.options`,
              '选择帧没有任何选项',
              '播放器会停在这里无法继续',
            )
            break
          }
          let unconditional = 0
          for (const [oi, option] of options.entries()) {
            const optPath = `${path}.options[${oi}]`
            if (!isObj(option)) {
              c.error('E_CHOICE_OPTION', optPath, '选项必须是对象')
              continue
            }
            if (option.text != null && !isStr(option.text))
              c.error('E_BAD_TEXT', `${optPath}.text`, '选项文本必须是字符串')
            if (!isObj(option.requires) || !isStr(option.requires.key) || !option.requires.key)
              unconditional += 1
            checkCondition(option.requires, `${optPath}.requires`)
            if (isObj(option.setFlags)) {
              for (const key of Object.keys(option.setFlags)) {
                if (!flagKeys.has(key))
                  c.warn(
                    'W_FLAG_UNDECLARED',
                    `${optPath}.setFlags.${key}`,
                    `写入了未声明的 flag：${key}`,
                  )
              }
            } else if (option.setFlags != null) {
              c.error('E_CHOICE_OPTION', `${optPath}.setFlags`, 'setFlags 必须是对象')
            }
            expectScene(option.target, `${optPath}.target`)
            if (isStr(option.target)) referencedScenes.add(option.target)
          }
          if (unconditional === 0)
            c.error(
              'E_CHOICE_DEADLOCK',
              `${path}.options`,
              '所有选项都带 requires，一旦条件都不成立就会卡死',
              '至少保留一个无条件选项，或确保至少一个条件在流程中一定成立',
            )
          break
        }
        case 'jump': {
          checkCondition(frame.requires, `${path}.requires`)
          if (frame.target == null) {
            c.warn(
              'W_JUMP_NULL_TARGET',
              `${path}.target`,
              '跳跃帧没有目标场景',
              '运行时会顺延到下一帧，通常是漏填',
            )
          } else {
            expectScene(frame.target, `${path}.target`)
            if (isStr(frame.target)) referencedScenes.add(frame.target)
          }
          break
        }
        case 'end': {
          if (frame.kind != null && frame.kind !== 'chapter' && frame.kind !== 'ending')
            c.error('E_BAD_ENUM', `${path}.kind`, 'end.kind 必须是 chapter / ending')
          if (frame.title != null && !isStr(frame.title))
            c.error('E_BAD_TEXT', `${path}.title`, 'title 必须是字符串')
          if (frame.subtitle != null && !isStr(frame.subtitle))
            c.error('E_BAD_TEXT', `${path}.subtitle`, 'subtitle 必须是字符串')
          expectScene(frame.next, `${path}.next`)
          if (isStr(frame.next)) referencedScenes.add(frame.next)
          break
        }
        default:
          c.error(
            'E_BAD_FRAME_TYPE',
            `${path}.type`,
            `未知帧类型：${JSON.stringify(frame.type)}`,
            '只支持 line / choice / jump / end',
          )
      }
    }
  }

  /* ---- 标题背景 / 未插槽的立绘引用 ---- */
  if (isObj(meta.title)) expectAsset(meta.title.background, 'background', 'meta.title.background')
  for (const [characterId, character] of characterById) {
    if (!isObj(character.sprites)) continue
    const i = characterIndexById.get(characterId) ?? 0
    for (const [expression, assetId] of Object.entries(character.sprites)) {
      if (!isStr(assetId) || !assetId) continue
      referencedAssets.add(assetId)
      const asset = assetById.get(assetId)
      if (!asset)
        c.error(
          'E_ASSET_UNKNOWN',
          `characters[${i}].sprites.${expression}`,
          `表情引用了不存在的素材：${assetId}`,
        )
      else if (asset.kind !== 'sprite')
        c.error(
          'E_ASSET_KIND_MISMATCH',
          `characters[${i}].sprites.${expression}`,
          `表情必须指向 sprite 素材，${assetId} 是 ${String(asset.kind)}`,
        )
    }
  }

  /* ---- 可达性 / 无用素材 ---- */
  if (sceneList.length > 0) {
    const entry = sceneList.find((scene) => isObj(scene) && isStr(scene.id) && scene.id.trim())
    if (entry && isObj(entry) && isStr(entry.id)) {
      const reachable = new Set<string>([entry.id])
      const queue = [entry.id]
      while (queue.length) {
        const id = queue.shift()!
        const scene = sceneList.find((s) => isObj(s) && s.id === id)
        if (!isObj(scene) || !Array.isArray(scene.frames)) continue
        const push = (target: unknown) => {
          if (isStr(target) && sceneIdSetForCheck.has(target) && !reachable.has(target)) {
            reachable.add(target)
            queue.push(target)
          }
        }
        for (const frame of scene.frames) {
          if (!isObj(frame)) continue
          if (frame.type === 'jump') push(frame.target)
          else if (frame.type === 'end') push(frame.next)
          else if (frame.type === 'choice' && Array.isArray(frame.options)) {
            for (const option of frame.options) if (isObj(option)) push(option.target)
          }
        }
      }
      for (const [i, scene] of sceneList.entries()) {
        if (!isObj(scene) || !isStr(scene.id) || !scene.id) continue
        if (!reachable.has(scene.id))
          c.warn(
            'W_UNREACHABLE_SCENE',
            `scenes[${i}]`,
            `场景无法从起点到达：${scene.id}`,
            '检查 jump / choice / end.next 是否指向了它',
          )
      }
    }
  }
  for (const [i, asset] of assetList.entries()) {
    if (isObj(asset) && isStr(asset.id) && !referencedAssets.has(asset.id))
      c.warn('W_UNUSED_ASSET', `assets[${i}]`, `素材没有被任何地方引用：${String(asset.fileName)}`)
  }

  return finish(c, maxIssues, { scenes, frames, assets })
}

function finish(
  c: Collector,
  maxIssues: number,
  summary: { scenes: number; frames: number; assets: number },
): ValidateResult {
  const all = c.issues
  const issues = all.slice(0, maxIssues)
  return {
    issues,
    truncated: all.length > maxIssues,
    summary: {
      ...summary,
      errors: all.filter((issue) => issue.severity === 'error').length,
      warnings: all.filter((issue) => issue.severity === 'warning').length,
    },
  }
}

import type { Message } from '../types'

/** 项目设置与导出 */
export const settingsZh = {
  'settings.title': '项目设置',
  'settings.description': '这些信息会写进导出作品的标题界面与关于页。',
  'settings.name': '作品名',
  'settings.author': '作者',
  'settings.authorPlaceholder': '署名会显示在标题界面',
  'settings.summary': '简介',
  'settings.summaryHint': '显示在播放器「关于作品」面板里',
  'settings.version': '版本号',
  'settings.accent': '主题色',
  'settings.accentHint': '「夜航」皮肤与编辑器高亮都跟随它',
  'settings.skin': '界面皮肤',
  'settings.skinHint': '决定玩家看到的画面长什么样，改完舞台立刻更新',
  'settings.skin.pgf': 'PGF 经典',
  'settings.skin.night': '夜航',
  'settings.language': '界面语言',
  'settings.languageHint': '播放器与标题界面的文案；预览与导出保持一致',
  'settings.titleScreen': '标题界面',
  'settings.titleScreenHint': '开启后玩家先看到标题，再选择开始或继续',
  'settings.subtitle': '副标题',
  'settings.subtitlePlaceholder': '一行短句，显示在作品名下方',
  'settings.titleBackground': '标题背景',
  'settings.flags': '标记变量',
  'settings.flagsHint': '选项写入、条件读取，用来做分歧与好感度',
  'settings.initialValue': '初始值',
  'settings.newFlagPlaceholder': '新标记名，如 affection',
  'settings.addFlag': '添加',
  'settings.tip': '提示：每一帧都保存完整的舞台状态。改背景不必回头改前一帧，播放器按帧直接切换。',
  'settings.done': '完成',

  'export.title': '导出作品',
  'export.description': '生成的文件完全离线运行，解压后双击 start.html 即可游玩。',
  'export.web.title': 'Web 作品包',
  'export.web.desc': '玩家拿到的最终产物：start.html + 播放器 + 素材。双击即玩，无需联网。',
  'export.web.meta': '{n} 个素材 · 约 {size}',
  'export.web.button': '导出并下载',
  'export.archive.title': '工程备份包',
  'export.archive.desc': '含 project.json 与全部素材，用于换设备继续编辑或备份存档。',
  'export.archive.meta': '.galastar',
  'export.archive.button': '导出工程',
  'export.busy': '打包中…',
  'export.preparing': '准备中…',
  'export.result.web': '可游玩 Web Zip',
  'export.result.archive': '工程备份包',
  'export.result.generated': '{label}已生成：{name}（{size}）',
  'export.structure': '压缩包结构',
  'export.structureBody': `start.html        ← 双击打开
galastar.js       ← 播放器运行时（与编辑器预览同一份代码）
galastar.css
data.js           ← 剧本与素材索引（script 注入，file:// 也能读）
media/            ← 背景、立绘、音乐、语音、音效`,
  'export.toast.done': '打包完成，已开始下载',
  'export.toast.failed': '打包失败',
} as const

export const settingsEn: Record<keyof typeof settingsZh, Message> = {
  'settings.title': 'Project settings',
  'settings.description':
    'These details appear in the exported work’s title screen and about panel.',
  'settings.name': 'Title',
  'settings.author': 'Author',
  'settings.authorPlaceholder': 'Shown on the title screen',
  'settings.summary': 'Description',
  'settings.summaryHint': 'Shown in the player’s About panel',
  'settings.version': 'Version',
  'settings.accent': 'Accent color',
  'settings.accentHint': 'Used by the Nightfall skin and editor highlights',
  'settings.skin': 'Player skin',
  'settings.skinHint': 'Decides what players see — the stage updates immediately',
  'settings.skin.pgf': 'PGF Classic',
  'settings.skin.night': 'Nightfall',
  'settings.language': 'Player language',
  'settings.languageHint': 'Wording of the player and title screen; the preview matches the export',
  'settings.titleScreen': 'Title screen',
  'settings.titleScreenHint': 'Players see a title first, then choose to start or continue',
  'settings.subtitle': 'Subtitle',
  'settings.subtitlePlaceholder': 'A short line under the title',
  'settings.titleBackground': 'Title background',
  'settings.flags': 'Flags',
  'settings.flagsHint': 'Written by choices, read by conditions — branching and affection',
  'settings.initialValue': 'Initial',
  'settings.newFlagPlaceholder': 'New flag, e.g. affection',
  'settings.addFlag': 'Add',
  'settings.tip':
    'Tip: every frame stores a complete stage snapshot. Change a background without editing earlier frames — the player switches frames directly.',
  'settings.done': 'Done',

  'export.title': 'Export work',
  'export.description':
    'The exported files run fully offline. Unzip and double-click start.html to play.',
  'export.web.title': 'Playable web build',
  'export.web.desc':
    'The build your players get: start.html + player + assets. Double-click to play, no network needed.',
  'export.web.meta': { one: '{n} asset · about {size}', other: '{n} assets · about {size}' },
  'export.web.button': 'Export & download',
  'export.archive.title': 'Project archive',
  'export.archive.desc':
    'project.json plus every asset — for editing on another machine or keeping a backup.',
  'export.archive.meta': '.galastar',
  'export.archive.button': 'Export project',
  'export.busy': 'Packaging…',
  'export.preparing': 'Preparing…',
  'export.result.web': 'Playable web zip',
  'export.result.archive': 'Project archive',
  'export.result.generated': '{label} ready: {name} ({size})',
  'export.structure': 'Archive layout',
  'export.structureBody': `start.html        ← double-click to play
galastar.js       ← player runtime (the same code as the editor preview)
galastar.css
data.js           ← script + asset index (injected as <script>, works over file://)
media/            ← backgrounds, sprites, music, voice, SFX`,
  'export.toast.done': 'Packaged — download started',
  'export.toast.failed': 'Export failed',
}

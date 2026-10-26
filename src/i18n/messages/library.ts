import type { Message } from '../types'

/** 作品库 */
export const libraryZh = {
  'library.hero.before': '把故事放进',
  'library.hero.highlight': '星空',
  'library.hero.after': '里',
  'library.github': '在 GitHub 上查看项目',
  'library.import': '导入工程',
  'library.new': '新建作品',
  'library.mine': '我的作品',
  'library.stats': '{works} 部 · {scenes} 幕 · {frames} 帧 · {assets} 素材',
  'library.loading': '正在读取本地作品…',
  'library.empty.title': '还没有作品',
  'library.empty.hint': '点右上角「新建作品」写下第一幕，或导入一份已有的工程包。',

  'library.create.title': '新建作品',
  'library.create.description': '之后可以随时在项目设置里修改。',
  'library.create.submit': '创建并开始',
  'library.field.name': '作品名',
  'library.field.namePlaceholder': '例如：星のかけら',
  'library.field.author': '作者',
  'library.field.authorPlaceholder': '署名，可留空',

  'library.delete.title': '删除作品',
  'library.delete.description':
    '该操作会同时清除作品的剧本与全部素材，无法撤销。建议先导出工程备份。',
  'library.delete.confirm': '确认删除',
  'library.delete.prompt': '确定删除《{name}》吗？',
  'library.delete.meta': '{scenes} 个场景 · {assets} 个素材',

  'library.card.scenes': '{n} 幕',
  'library.card.frames': '{n} 帧',
  'library.cardMenu': '作品操作',
  'library.authorFallback': '未署名',
  'library.updatedAt': '更新于 {time}',
  'library.duplicate': '创建副本',
  'library.copySuffix': '{name} 副本',

  'library.toast.imported': '已导入《{name}》',
  'library.toast.importFailed': '导入失败',
  'library.toast.duplicated': '已复制作品',
  'library.toast.deleted': '作品已删除',
} as const

export const libraryEn: Record<keyof typeof libraryZh, Message> = {
  'library.hero.before': 'Put your story ',
  'library.hero.highlight': 'among the stars',
  'library.hero.after': '',
  'library.github': 'View the project on GitHub',
  'library.import': 'Import project',
  'library.new': 'New work',
  'library.mine': 'My works',
  'library.stats': 'Works {works} · Scenes {scenes} · Frames {frames} · Assets {assets}',
  'library.loading': 'Loading local works…',
  'library.empty.title': 'No works yet',
  'library.empty.hint':
    'Hit “New work” in the corner to write your first scene, or import an existing archive.',

  'library.create.title': 'New work',
  'library.create.description': 'You can change these later in Project settings.',
  'library.create.submit': 'Create & start',
  'library.field.name': 'Title',
  'library.field.namePlaceholder': 'e.g. Hoshi no Kakera',
  'library.field.author': 'Author',
  'library.field.authorPlaceholder': 'Credit line, optional',

  'library.delete.title': 'Delete work',
  'library.delete.description':
    'This clears the script and every asset for good. Export a backup first if unsure.',
  'library.delete.confirm': 'Delete',
  'library.delete.prompt': 'Delete “{name}”?',
  'library.delete.meta': 'Scenes {scenes} · Assets {assets}',

  'library.card.scenes': { one: '{n} act', other: '{n} acts' },
  'library.card.frames': { one: '{n} frame', other: '{n} frames' },
  'library.cardMenu': 'Work actions',
  'library.authorFallback': 'Uncredited',
  'library.updatedAt': 'Updated {time}',
  'library.duplicate': 'Duplicate',
  'library.copySuffix': '{name} copy',

  'library.toast.imported': 'Imported “{name}”',
  'library.toast.importFailed': 'Import failed',
  'library.toast.duplicated': 'Work duplicated',
  'library.toast.deleted': 'Work deleted',
}

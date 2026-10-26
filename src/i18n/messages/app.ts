import type { Message } from '../types'

/** 应用层：编辑器 store 的提示、打包进度与错误 */
export const appZh = {
  'store.newSceneName': '新场景 {n}',
  'store.opening': '正在打开作品…',
  'pack.progress.player': '读取播放器',
  'pack.progress.assets': '收集素材',
  'pack.progress.zip': '压缩打包',
  'pack.progress.done': '完成',
  'pack.error.playerFile': '无法读取播放器文件：{url}',
  'pack.error.noProject': '压缩包里没有 project.json，可能不是 Galastar 工程包',
  'project.firstScene': '第一幕',
  'project.importedWork': '导入的作品',
  'project.chapterEndTitle': '本章完',
  'pack.error.invalidProject': '不是有效的 Galastar 作品文件',
} as const

export const appEn: Record<keyof typeof appZh, Message> = {
  'store.newSceneName': 'Scene {n}',
  'store.opening': 'Opening project…',
  'pack.progress.player': 'Reading player',
  'pack.progress.assets': 'Collecting assets',
  'pack.progress.zip': 'Compressing',
  'pack.progress.done': 'Done',
  'pack.error.playerFile': 'Could not read the player file: {url}',
  'pack.error.noProject': 'No project.json in the archive — this may not be a Galastar project.',
  'project.firstScene': 'Act one',
  'project.importedWork': 'Imported work',
  'project.chapterEndTitle': 'End of chapter',
  'pack.error.invalidProject': 'This is not a valid Galastar project file.',
}

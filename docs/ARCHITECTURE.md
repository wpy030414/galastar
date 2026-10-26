# 架构

Galastar 是一个**没有服务端**的纯前端应用。它由三个各自独立、通过约定接口拼在一起的部分组成：

```
┌──────────────────────────── 浏览器 ────────────────────────────┐
│                                                                │
│  ① 编辑器 SPA（React 19 + Tailwind）                            │
│     ├─ 作品库 Library                                           │
│     └─ 编辑器 Editor                                            │
│         ├─ LeftRail   场景 / 素材 / 角色                         │
│         ├─ StagePreview ──postMessage──► ② 预览 iframe           │
│         ├─ FrameStrip 帧列表                                    │
│         └─ Inspector  帧检视器                                  │
│                                                                │
│  ② 播放器运行时 public/engine/runtime.js（classic script）       │
│     与导出产物完全同源：同一个文件、同一份 CSS                    │
│                                                                │
│  ③ 本地存储 IndexedDB                                          │
│     projects（作品 JSON） + blobs（素材二进制） + localStorage    │
└────────────────────────────────────────────────────────────────┘
                                  │ 打包 (JSZip, 客户端)
                                  ▼
                        作品.zip → start.html
```

## 1. 为什么运行时是"另一份代码"

编辑器里的预览必须和玩家看到的一模一样，否则"设计稿"没有意义。最省事也最可靠的做法是：**让它们跑同一份运行时**。

- 编辑器用 `<iframe src="/engine/preview.html">` 加载运行时；
- 导出时把同一个 `runtime.js` / `runtime.css` 原样写进 zip。

于是不存在"预览效果和实际效果不一致"的可能——它们物理上就是同一段代码。代价是运行时不能用 TS / JSX 写，也不能 `import` 编辑器里的类型；这部分约束由 `public/engine/runtime.js` 的注释和 `docs/DECISIONS.md` 记录。

### 预览桥协议

`preview.html` 只做转发，真正的渲染在 `runtime.js` 的 `Stage` 实例里。

| 方向            | 消息                                 | 说明                                                                     |
| --------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| 编辑器 → iframe | `payload`                            | 完整数据包 + `mode`（`edit` / `play`）+ 可选的 `seek` / `play` / `title` |
| 编辑器 → iframe | `show`                               | 只切换定格帧，不重载数据（避免编辑时闪烁）                               |
| iframe → 编辑器 | `ready` / `mounted`                  | 握手完成，可以发数据了                                                   |
| iframe → 编辑器 | `frame` / `typed` / `save` / `title` | 播放进度事件（目前用于调试与后续扩展）                                   |

两个容易踩的坑，已在本项目里修掉：

1. **不要在 iframe `onLoad` 里重置 ready**。`postMessage` 是宏任务，可能早于 `load` 派发，先收 `ready` 再被 `onLoad` 打回 false，就会永远卡在 loading。切换模式用 `key={mode}` 重建 iframe，靠 `useEffect([mode])` 重置。
2. **编辑态不要真的执行跳转**。`jump` 帧在编辑态保持上一句台词的舞台，否则选中跳转帧时预览会跑到目标场景，编辑对象和画面就对不上了。

## 2. 数据模型

`src/lib/types.ts` 是唯一事实来源，运行时的 `data.js` 与之同构（`RuntimePayload`）。

```
Project
├── meta      { id, name, author, version, stage, theme, title }
├── scenes    Scene[]   { id, name, frames }
├── characters Character[] { id, name, color, sprites: { 表情: assetId } }
├── flags     FlagDef[] { key, initial }
└── assets    AssetRecord[] { id, kind, name, fileName, mime, size, width, height }
```

关键约束：

- **帧是完整快照**。`bg` / `bgm` / `cast` 每帧都写全，不做增量合并（理由见 `DECISIONS.md` D1）。
- **立绘摆放存在帧里**。`cast.***.transform = { scale, offsetX, offsetY }`（单位：站位高度百分比 / 舞台像素），随帧快照一起继承与复制。理由见 `DECISIONS.md` D12。
- **资产只存元信息**，二进制在 IndexedDB 的 `blobs` 表，键为 `${projectId}:${assetId}`。
- **运行时看到的资产是 `path`**：预览时是 `blob:` URL，导出时是 `media/<fileName>`。`buildPayload(project, resolvePath)` 负责这一步映射，两处调用方各自提供解析函数。

旧作品可能缺字段（2.0 前没有 `theme.skin`，2.0.1 前没有 `cast.***.transform`），统一在 `db.ts` 的 `hydrate()` 读取入口补齐；播放器 `runtime.js` 的 `readTransform()` 独立兜底，因为导出的 `data.js` 是手工可改的外部输入，两处都不能假设字段一定存在。

## 3. 编辑器状态

`src/store/editor.tsx` 用一个 Context 暴露全部操作，实现上刻意保持简单：

- **`mutate(recipe)`**：`structuredClone` 出草稿 → 就地改 → 更新 `updatedAt` → 推入撤销栈 → 换引用。一个作品通常几百帧、几十 KB，这个成本可以忽略，换来的是"任何变更都不会漏掉不可变更新"。
- **撤销栈**：`past` / `future` 两个 ref 存整个 `Project` 快照，上限 80 步。命令模式（每个操作写 undo）在这里性价比太低。
- **连续输入合并为一步**：`mutate(recipe, coalesceKey)` 带同一个 key 的连续变更只压一次栈。滑杆（立绘缩放 / 偏移）拖动时一次产生上百个值，不合并就会吃满 80 步历史且撤销一次退不回原位。key 含帧、槽位与字段（`transform:{frameId}:{slot}:{field}`），所以换字段、换槽位、换帧都会开新的一步；撤销 / 重做后 key 清空。
- **自动保存**：`project` 变化 → 650ms 防抖 → 写 IndexedDB。`dirty` 控制顶栏状态，`Ctrl+S` 立即落盘。
- **选中状态**：`sceneId` / `frameId` 独立于作品数据；撤销后如果选中的帧不存在，自动回落到该幕第一帧。

## 4. 打包流水线

`src/lib/pack.ts`：

```
读取 runtime.js / runtime.css   ← fetch(BASE_URL + 'engine/...')
        │
收集 IndexedDB 里的素材 Blob    ← getProjectBlobs(projectId)
        │
buildPayload(project, id => `media/${fileName}`)
        │
JSZip：start.html / galastar.js / galastar.css / data.js / media/* / README.txt
        │
generateAsync(blob) → <a download> 触发保存
```

`data.js` 写成 `window.GALASTAR_DATA = {...}`，并把 `</` 转义成 `<\/` 防止提前闭合 script 标签。

## 5. 播放器运行时

`runtime.js` 是一个 IIFE，只暴露 `window.Galastar = { version, create, boot }`。

- **`Stage`** 类持有 DOM、音频通道、逐字机、存档读写。
- **`render()`** 按帧类型分派：`line` 走 `applyLineFrame`，`choice` 走 `applyChoiceFrame`，`jump` 在执行态递归/跳转，`end` 打开结局层。
- **缩放**：舞台固定 1280×720，用 `transform: translate(-50%,-50%) scale(n)` 适配容器，`ResizeObserver` 驱动。
- **存档**：`localStorage`，键 `galastar:save:<projectId>`，值是一张表（6 个槽位）；设置存 `galastar:config:<...>`。
- **无 `eval`**：分支是"目标场景 + 标记条件"，不是任意 JS。这是 v1 → v2 的安全与稳定性改进。

## 6. 容量与已知限制

| 项       | 现状                                                                                          |
| -------- | --------------------------------------------------------------------------------------------- |
| 素材体积 | 受浏览器 IndexedDB 配额限制（通常为磁盘余量的百分比），作品库不设上限                         |
| 打包     | 全内存构建 zip，几百 MB 的作品会有明显卡顿                                                    |
| 帧数     | 单幕数百帧无压力；每帧都会整包 `structuredClone`，上万帧时编辑会变慢                          |
| 兼容     | 目标为现代常青浏览器；导出产物无 polyfill，`file://` 下不支持 `fetch`/modules，已按此约束设计 |

## 7. 编辑器偏好与双语

**偏好**（`src/store/prefs.tsx`）只有两项：主题与语言。它存 `localStorage` 的 `galastar.prefs`，并在首帧之前由 `main.tsx` 同步落到 `<html>` 上——主题写 `class="dark|light"` 与 `color-scheme`，语言写 `lang`。这样刷新时不会先闪一下深色。

**主题**靠 CSS 变量而不是两套样式表：`:root` 是深色，`.light` 只覆盖同名变量。所有界面色——包括工具栏渐变、滚动条、面板投影、星空底纹——都必须走变量或 `bg-foreground/[0.04]` 这类相对色；组件里写死 `hsl(...)` 会在切主题时留下一块不听话的深色。舞台预览区是例外：它是作品的画布，两套主题下都保持暗色。

**语言**分两层，刻意不合并：

| 层       | 存在哪儿                | 谁切换                     | 作用范围                     |
| -------- | ----------------------- | -------------------------- | ---------------------------- |
| 编辑器   | `galastar.prefs`        | 首选项                     | 顶栏、左栏、检查器、作品库   |
| 作品     | `project.meta.locale`   | 项目设置                   | 播放器、标题界面、导出 README |

编辑器词典在 `src/i18n/messages/*.ts`，中文是事实来源，`en` 的类型是 `Record<MessageKey, …>`，漏一条编译不过。`translate()` 是纯函数，所以 `lib/` 里的非组件代码（导入校验、打包 README）也能用。播放器运行时是 classic script，不能 import 词典，自带一份 `STRINGS` 表，语言取自 `payload.meta.locale`，切换时靠 `data-i18n` 节点整批刷新。

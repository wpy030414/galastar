# project.json 完整结构

一个 Galastar 工程就是两样东西：

```
my-story/
├── project.json          作品的全部结构、文本与素材索引
├── assets/               本地素材本体，文件名与 project.json 里的 fileName 一致
└── .gitignore            dist/ 与 .galastar/
```

新工程默认建在 `~/Documents/GalastarWorks/<proj_name>`；CLI 的 `init` 会把裸名字解析到
这个工作区，带 `/` 的路径则按路径创建。

`assets/` 只放本地素材；填了 `url` 的远程素材没有本地文件，只在 `project.json` 里保留链接。

`project.json` 是**唯一事实来源**。编辑器把它存进 IndexedDB，CLI 直接读写这个文件；
两者用同一套类型（`src/lib/types.ts`）。

---

## 顶层

```jsonc
{
  "meta": {/* 作品信息 */},
  "scenes": [/* 场景，至少一个；播放从 scenes[0] 第 0 帧开始 */],
  "characters": [/* 角色与表情映射 */],
  "flags": [/* 剧情变量 */],
  "assets": [/* 素材索引 */],
}
```

---

## meta

| 字段                      | 类型                | 说明                                            |
| ------------------------- | ------------------- | ----------------------------------------------- |
| `id`                      | string              | 作品 id，用于本地存档键。CLI 新建时生成 `p_...` |
| `name`                    | string              | 作品名，出现在标题界面、导出文件名              |
| `author`                  | string              | 作者，可空                                      |
| `description`             | string              | 简介，可空                                      |
| `version`                 | string              | 默认 `"1.0.0"`                                  |
| `createdAt` / `updatedAt` | number              | 毫秒时间戳                                      |
| `stage`                   | `{ width, height }` | **固定 1280×720**，写别的会被编辑器重置         |
| `theme.accent`            | `#rrggbb`           | 主色，播放器按钮与高亮用它                      |
| `theme.skin`              | `"pgf" \| "night"`  | 播放器皮肤，默认 `pgf`                          |
| `locale`                  | `"zh-CN" \| "en"`   | 作品语言：播放器界面、导出 README 跟随它        |
| `title`                   | object              | 标题界面，见下                                  |

```jsonc
"title": {
  "enabled": true,              // false 则直接从第一个场景开始
  "subtitle": "A tiny demo",    // 标题下方的小字
  "background": "a_bg_hall"     // background 素材 id，或 null
}
```

---

## Scene

```jsonc
{
  "id": "scene-hall", // 唯一；跳转目标就是它
  "name": "第一幕 · 贵宾席", // 只用于编辑器列表
  "frames": [/* 播放顺序 */],
}
```

- `scenes[0]` 是默认起点；标题界面关闭时直接从这里开始。
- `frames` 可以为空，但进入后会立刻显示占位结局——校验器会给出 `W_EMPTY_SCENE`。

---

## Frame（帧）

四种类型：`line` / `choice` / `jump` / `end`。
**帧 id 必须在整部作品内唯一**（编辑器按 id 跨场景定位）。

每一帧是**完整舞台快照**，不是差量。新建下一句时，`bg` / `bgm` / `cast` /
`transition` 必须重复写一遍。

### line：一句台词

| 字段         | 类型                                                 | 默认            | 说明                                                            |
| ------------ | ---------------------------------------------------- | --------------- | --------------------------------------------------------------- |
| `id`         | string                                               | —               | 全局唯一                                                        |
| `type`       | `"line"`                                             | —               |                                                                 |
| `speaker`    | `{ characterId, name }`                              | `{null, ""}`    | `characterId` 命中角色时显示角色名；否则用 `name`；都为空即旁白 |
| `innerVoice` | boolean                                              | false           | 心理活动：不显示名牌。有 `characterId` 只亮那人，没有则全场压暗 |
| `text`       | string                                               | `""`            | 台词正文，支持换行                                              |
| `bg`         | string \| null                                       | 上一句的 bg     | 背景素材 id（图片 / GIF / 动态 WebP / 视频都行）                                                     |
| `bgm`        | string \| null                                       | 上一句的 bgm    | 音乐素材 id                                                     |
| `sfx`        | string \| null                                       | null            | 本句点击时播放一次的音效                                        |
| `voice`      | string \| null                                       | null            | 本句语音                                                        |
| `cast`       | CastMap                                              | 上一帧的 cast   | 三个槽位的立绘                                                  |
| `transition` | `"cut" \| "fade" \| "dissolve" \| "flash" \| "rise"` | 上一句或 `fade` | 画面切换方式                                                    |
| `shake`      | boolean                                              | false           | 轻微震屏                                                        |

```jsonc
{
  "id": "line-1",
  "type": "line",
  "speaker": { "characterId": "char_sakiko", "name": "祥子" },
  "text": "爸爸，请入座吧。",
  "bg": "a_bg_hall",
  "bgm": null,
  "sfx": null,
  "voice": null,
  "cast": {
    "left": null,
    "center": {
      "characterId": "char_sakiko",
      "expression": "normal",
      "transform": { "scale": 100, "offsetX": 0, "offsetY": 0 },
    },
    "right": null,
  },
  "transition": "fade",
  "shake": false,
}
```

### choice：分支

| 字段      | 类型           | 说明                           |
| --------- | -------------- | ------------------------------ |
| `prompt`  | string         | 选项上方的提示，可空           |
| `options` | ChoiceOption[] | 至少一个，且**至少一个无条件** |

```jsonc
{
  "id": "choice-1",
  "type": "choice",
  "prompt": "要怎么回答？",
  "options": [
    {
      "id": "opt-stay",
      "text": "坐下，听她把话说完",
      "target": "scene-stay", // null = 继续本场景下一帧
      "setFlags": { "invited": "true" },
      "requires": null, // null = 始终可见
    },
    {
      "id": "opt-leave",
      "text": "先离开",
      "target": "scene-leave",
      "setFlags": {},
      "requires": { "key": "invited", "op": "==", "value": "false" },
    },
  ],
}
```

规则：

- `requires` 为 `null` 或 `key` 为空串 → 始终显示。
- 所有选项都被条件过滤掉时，播放器会停住、点不动 → 校验器给 `E_CHOICE_DEADLOCK`。
- `setFlags` 在跳转前写入；未声明的 key 也能写，但建议先声明（`W_FLAG_UNDECLARED`）。

### jump：条件跳转

```jsonc
{
  "id": "jump-1",
  "type": "jump",
  "requires": { "key": "invited", "op": "==", "value": "true" },
  "target": "scene-stay",
}
```

- 条件成立（或 `requires` 为空）且 `target` 是有效场景 → 跳到该场景第 0 帧。
- 否则顺延到下一帧。`target: null` 等价于「不跳」，校验器会提醒 `W_JUMP_NULL_TARGET`。

### end：章节 / 结局

```jsonc
{
  "id": "end-1",
  "type": "end",
  "kind": "chapter", // "chapter" | "ending"
  "title": "第一幕 完",
  "subtitle": "—— 幕间 ——",
  "next": "scene-two", // null = 全线终点，只给「回到标题」
}
```

`next` 指向下一幕时，幕末卡不出现任何按钮：玩家点击任意位置就交叉渐变到下一幕的幕名开场帧，再点一下进入该幕第一句。`next` 为 `null`（或指向不存在的场景）时，只提供「回到标题」。

---

## CastMap：三个立绘槽位

```ts
type CastMap = {
  left: CastSlot | null
  center: CastSlot | null
  right: CastSlot | null
}
interface CastSlot {
  characterId: string // 必须存在于 characters
  expression: string // 必须是 character.sprites 的键
  transform: { scale: number; offsetX: number; offsetY: number }
}
```

- 三个键必须齐全，不用的槽位写 `null`。
- `scale`：站位高度百分比，`100` = 占满舞台高度（720px）。范围 20–300。
- `offsetX`：舞台像素，向右为正，范围 ±640。
- `offsetY`：舞台像素，向下为正（正数把人往下推，底部被画面裁掉），范围 ±400。
- 超范围不会报错，运行时会夹取；校验器给 `W_TRANSFORM_CLAMPED`。
- 缩放原点是**脚底中点**：改 `scale` 只变大小，人物不会离地，放大先从头顶开始裁；上下取景只能靠 `offsetY`。
  全身素材靠放大 + 正 `offsetY` 取景，半身素材靠正 `offsetY` 把切口压出画面，见
  [recipes.md](recipes.md) 的「画幅适配」。
- `expression` 找不到 → 该槽位不显示（校验器给 `E_EXPRESSION_MISSING`）。

---

## Character

```jsonc
{
  "id": "char_sakiko",
  "name": "祥子",
  "color": "#e0a8c8", // 名字牌颜色
  "sprites": {
    "normal": "a_sprite_sakiko",
    "smile": "a_sprite_sakiko",
    "angry": "a_sprite_angry",
  },
}
```

`sprites` 的每个值都必须是 `kind: "sprite"` 的素材 id。
多个表情可以指向同一个素材（demo 就是这么做的）。

---

## FlagDef 与 Condition

```jsonc
"flags": [
  { "key": "invited", "initial": "false" }
]
```

```ts
interface Condition {
  key: string
  op: '==' | '!=' | '>' | '>=' | '<' | '<='
  value: string
}
```

比较规则：两边都能解析成数字时按数字比，否则按字符串比。
**所有值都是字符串**——写 `"true"`、`"false"`、`"3"`，不要写裸布尔或数字。

---

## AssetRecord

```jsonc
{
  "id": "a_bg_hall",
  "kind": "background", // background | sprite | bgm | voice | sfx
  "name": "hall.svg", // 原始文件名，仅展示
  "fileName": "bg-hall.svg", // 打包后的文件名，必须与 assets/ 里的文件一致
  "mime": "image/svg+xml",
  "size": 1973, // 字节
  "width": 600, // 仅图片，可省略
  "height": 1100,
  "createdAt": 1735689600000,
  "url": "https://example.com/hall.svg", // 可选：远程素材，见下
}
```

- `fileName` 必须唯一，且不能含 `/`、`\`、`..`、盘符或控制字符。
- 命名规则（`src/lib/asset-names.ts`）：`<前缀>-<slug>.<ext>`，
  前缀分别是 `bg-` / `sprite-` / `bgm-` / `voice-` / `sfx-`；重名依次加 `-2`、`-3`。
- 运行时只读 `mime`（判断背景是图片还是视频）；`size` / `width` / `height` 只服务编辑器与排错。
- 引用关系（必须成立）：
  - `bg` → `background`，`bgm` → `bgm`，`sfx` → `sfx`，`voice` → `voice`
  - `meta.title.background` → `background`
  - `character.sprites.*`、`cast.*.expression` 指向的素材 → `sprite`
- 视频（mp4 / m4v / mov / webm / ogv）只能配 `background`，其余 kind 会报 `E_ASSET_MEDIA_UNSUPPORTED`。

### 远程素材（`url`）

填了 `url` 就不用把文件放进 `assets/`：

```jsonc
{
  "id": "a_bg_worldend",
  "kind": "background",
  "name": "Avg_bg_76_g13_worldend.png",
  "fileName": "bg-worldend.png",
  "mime": "image/png",
  "size": 0,
  "width": 1280,
  "height": 720,
  "url": "https://media.prts.wiki/8/85/Avg_bg_76_g13_worldend.png",
  "createdAt": 1735689600000,
}
```

- 只支持 `http://` / `https://`；`javascript:` / `data:` / `file:` 会被校验器拒绝
  （`E_ASSET_URL_INVALID`）。
- 有 `url` 时不检查本地文件；播放器与导出产物直接引用该链接。
- 打包不会把它复制进 `media/`，zip 更小，但**播放需要联网**，链接也必须长期可用。
- `fileName` 仍要唯一、安全；`size` 写 0 即可，`width` / `height` 不知道可以省略。
- CLI 添加：`galastar asset add --url <链接> --kind background --project my-story`。

---

## 会被 normalize 改写的字段

`normalizeProject` 负责导入容错，它**不报错，只悄悄修正**。CLI 会先校验再 normalize，
所以下面这些最好一开始就写对：

| 情况                              | 结果                                                               |
| --------------------------------- | ------------------------------------------------------------------ |
| `meta` 缺失                       | 直接报错，无法导入                                                 |
| `meta.id` 缺失                    | 生成随机 `p_...`（存档键会变）                                     |
| `meta.stage` 不是 1280×720        | 强制重置为 1280×720                                                |
| `meta.locale` 不是 `en` / `zh-CN` | 一律变 `zh-CN`                                                     |
| `theme.skin` 不是 `night`         | 一律变 `pgf`                                                       |
| `theme.accent` 缺失               | `#9d8cff`                                                          |
| `title` 字段缺失                  | `enabled:true`、`subtitle:""`、`background:null`                   |
| `scenes` 为空                     | 回落到一个默认场景（CLI 校验会先拦下 `E_NO_SCENES`）               |
| `scene.id` 缺失                   | 生成随机 id                                                        |
| `scene.name` 缺失                 | `未命名` / `Untitled`                                              |
| `line` 帧缺字段                   | 补默认值；`cast` 缺 transform 补 `100/0/0`                         |
| 未知 `frame.type`                 | 保留原 type；运行时会当 `line` 处理（校验器给 `E_BAD_FRAME_TYPE`） |
| `assets` 记录                     | **不做任何归一化**，原样保留                                       |
| `assets[].url` 不是 http(s)       | 不被改写；校验器直接报 `E_ASSET_URL_INVALID`                       |

---

## 完整最小示例

`bin/templates/demo/project.json` 是一份可运行、可校验、可截图的完整工程：
三幕、三个素材（全部为远程链接）、一个分支、两个结局。最快的上手方式是：

```bash
node bin/galastar.mjs init demo --template demo
node bin/galastar.mjs validate demo
node bin/galastar.mjs shot demo --scene scene-hall --frame 0 --json
```

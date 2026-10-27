# galastar CLI / SKILL 契约

> 状态：v1 · 与 `bin/cli.ts` 同步维护。命令行为、JSON 字段、退出码与错误码以本文为准；
> `SKILL.md` 只教流程，不重复这里的细节。

## 1. 目的

让 Agent 不打开浏览器编辑器，也能在终端里完成 GalGame 的创作闭环：

```
写 project.json  →  validate  →  build  →  serve / shot  →  迭代
```

硬性语义：

- **产物一致**：CLI 与 GUI 共用 `src/lib/pack-core.ts`，同一工程打出的 zip
  在文件清单、`start.html`、`data.js`、`README.txt`、`media/*` 上一致。
- **不依赖浏览器**：CLI 不读 IndexedDB，只认 `project.json` + `assets/` 或 `.galastar` 工程包。
- **可复现**：`--source-date` / `SOURCE_DATE_EPOCH` 固定时间戳后，重复构建字节一致。

## 2. 工程布局

```
my-story/
├── project.json
├── assets/<fileName>     # 与 AssetRecord.fileName 一致
├── .gitignore            # dist/ 与 .galastar/
├── dist/                 # build 的默认输出目录
└── .galastar/            # serve / shot 的预览缓存与截图
```

输入也可以是 `.galastar` / `.zip` 工程包（内部为 `project.json` + `assets/`，
兼容 `media/` 与根目录布局）。

## 3. 调用方式

```bash
node bin/galastar.mjs <command> [...]     # 仓库内
galastar <command> [...]                  # pnpm link --global 之后
```

CLI 用 Node 原生类型擦除执行 `bin/cli.ts`，由 `bin/galastar.mjs` 注册 `@/` 与
无扩展名导入的解析钩子。**要求 Node ≥ 24**；更低版本会以退出码 2 明确拒绝。

## 4. 全局参数

| 参数               | 作用                                                   |
| ------------------ | ------------------------------------------------------ |
| `--json`           | stdout 只输出一个 JSON 信封；人类可读日志全部走 stderr |
| `--help` / `-h`    | 帮助                                                   |
| `--version` / `-v` | 版本                                                   |

所有命令默认输出简洁中文，一屏可读，不使用 ANSI 颜色。

## 5. 命令

### `doctor`

自检 Node、类型擦除、播放器目录、可用浏览器。失败仍输出结构，便于诊断。

### `init [名字 | 路径]`

| 参数                               | 说明                                               |
| ---------------------------------- | -------------------------------------------------- |
| `--template blank\|demo`           | 默认 `blank`；`demo` 含背景、立绘、分支与两个结局  |
| `--name` / `--author` / `--locale` | 覆盖 `meta` 对应字段；locale 只接受 `zh-CN` / `en` |
| `--workspace <dir>`                | 覆盖默认工作区                                     |
| `--force`                          | 目录已有 `project.json` 时覆盖（否则退出码 3）     |

默认工作区是 `~/Documents/GalastarWorks`（`~` 会展开），优先级：
`--workspace` > `GALASTAR_WORKSPACE` > 默认位置。工程目录的解析规则：

| 位置参数                       | 结果                                                            |
| ------------------------------ | --------------------------------------------------------------- |
| 省略                           | `<工作区>/<--name 的安全化名字>`，没有 `--name` 时用 `untitled` |
| 裸名字（`my-story`，无分隔符） | `<工作区>/my-story`                                             |
| 带 `/` 或 `\` 的路径           | 相对当前目录解析                                                |
| 绝对路径                       | 原样使用                                                        |

生成 `project.json`、`assets/`、`.gitignore`。demo 模板来自 `bin/templates/demo/`。
输出里的 `data.dir` 是最终绝对路径，`data.workspace` 是工作区根目录。

### `asset add <文件... | --url <链接>>`

| 参数                                         | 说明                                      |
| -------------------------------------------- | ----------------------------------------- |
| `--kind background\|sprite\|bgm\|voice\|sfx` | 缺省时按 MIME 推断：图片→sprite，音频→bgm |
| `--project <dir>`                            | 工程目录，默认当前目录                    |
| `--assets-dir <dir>`                         | 素材目录，默认 `<工程>/assets`            |
| `--url <http(s)>`                            | 添加远程素材：只存链接，不复制文件        |
| `--name <name>`                              | 远程素材的显示名，默认取链接里的文件名    |
| `--mime <mime>`                              | 覆盖 MIME 推断                            |
| `--id <id>`                                  | 只对单个文件 / 单个链接生效               |
| `--dry-run`                                  | 只计算，不复制、不写回                    |

本地文件：复制到 `assets/`、按 `<前缀>-<slug>.<ext>` 命名（重名加 `-2`）、写入
`AssetRecord`、原子写回 `project.json`。`id` 取内容 sha256 前 8 位（`a_xxxxxxxx`），
**重复添加同一文件是幂等的**，返回既有记录。

远程素材（`--url`）：只支持 `http://` / `https://`，写入 `AssetRecord.url`，
`size` 记 0，不复制文件，也不创建 `assets/` 下的条目。播放器与导出产物直接引用该链接；
`data.js` 里 `assets[id].path` 就是这条 URL，zip 里不会出现 `media/` 下对应的文件。
**重复添加同一链接是幂等的**。远程素材需要联网才能播放，`build` 不会因它缺少本地文件而失败。

### `validate [project]`

| 参数                 | 说明                     |
| -------------------- | ------------------------ |
| `--assets-dir <dir>` | 素材目录                 |
| `--strict`           | 警告也视为不通过         |
| `--max-issues <n>`   | 最多返回多少条，默认 200 |

检查分两层：结构/引用错误（阻断打包）与警告（不阻断）。素材缺失在 `validate`
里是警告，在 `build` 里升级为错误。

### `build [project]`

| 参数                          | 说明                                                                  |
| ----------------------------- | --------------------------------------------------------------------- |
| `--format web\|archive\|both` | 默认 `web`                                                            |
| `--out <path>`                | 以 `.zip`/`.galastar` 结尾视为文件，否则视为目录；默认 `<工程>/dist/` |
| `--assets-dir <dir>`          | 素材目录                                                              |
| `--engine <dir>`              | 播放器目录，默认 `public/engine`                                      |
| `--allow-missing`             | 缺素材只告警并跳过（不推荐）                                          |
| `--source-date <iso\|epoch>`  | 固定打包时间与 zip 条目时间                                           |

流程：校验原始 JSON → 归一化 → 读取素材 → 载入播放器 → 生成条目 → 压缩 → 原子写入。
缺素材且未 `--allow-missing` 时以退出码 1 失败。

### `serve [project|dir]`

| 参数                                              | 说明                            |
| ------------------------------------------------- | ------------------------------- |
| `--port <n>`                                      | 默认 `0`（随机空闲端口）        |
| `--host <addr>`                                   | 默认 `127.0.0.1`                |
| `--scene <id\|index>` / `--frame <n>` / `--title` | 定格到指定画面                  |
| `--no-build`                                      | 复用已有的 `.galastar/preview/` |
| `--engine` / `--assets-dir`                       | 同 build                        |

工程目录会先构建到 `<工程>/.galastar/preview/`；若输入目录本身已有 `start.html`
且没有 `project.json`，则直接服务该目录。服务只读、只绑回环地址、拒绝目录穿越。

### `shot [project|dir]`

| 参数                                                   | 说明                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `--out <png>`                                          | 默认 `<工程>/.galastar/preview.png`（已构建目录则为 `<目录>/.galastar/preview.png`） |
| `--scene` / `--frame` / `--title`                      | 同 serve；缺省时标题开启则截标题，否则截第一帧                                       |
| `--size 1280x720`                                      | 视口尺寸                                                                             |
| `--wait <ms>`                                          | 虚拟时间预算，默认 4000                                                              |
| `--browser auto\|chrome\|edge\|headless-shell\|<path>` | 浏览器选择                                                                           |
| `--no-sandbox`                                         | 传给 Chromium                                                                        |
| `--engine` / `--assets-dir`                            | 同 build                                                                             |

流程：构建 → 起临时服务 → 打开 `/__shot.html`（用 `Galastar.create` +
`showTitle` / `showFrame` 定格）→ `--dump-dom` 断言 `data-galastar-ready` →
`--screenshot` → 统计 404。任一环节失败都不会返回成功的截图。

浏览器发现顺序：`--browser` → `GALASTAR_CHROME` → 系统 Chrome/Edge →
Playwright 缓存（`%LOCALAPPDATA%/ms-playwright` 等）。找不到时退出码 2。

## 6. JSON 信封

成功：

```jsonc
{
  "ok": true,
  "command": "build",
  "schema": 1,
  "version": "26.10.26",
  "durationMs": 812,
  "data": {/* 命令结果 */},
  "issues": [/* validate 的问题清单 */],
  "warnings": [/* 其他非阻断提醒 */],
}
```

失败：

```jsonc
{
  "ok": false,
  "command": "build",
  "schema": 1,
  "version": "26.10.26",
  "durationMs": 12,
  "error": { "code": "E_VALIDATE_FAILED", "message": "…", "hint": "…", "path": "…" },
  "data": { "issues": [/* … */] },
}
```

`data` 按命令：

| 命令        | 字段                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `doctor`    | `node` `typescript` `platform` `repoRoot` `workspace{root,exists}` `engine` `browser`                                          |
| `init`      | `dir` `template` `files`                                                                                                       |
| `asset add` | `added[]` `reused[]` `dir` `dryRun` `remote`                                                                                   |
| `validate`  | `valid` `project` `scenes` `frames` `assets` `errors` `warnings` `truncated`                                                   |
| `build`     | `project` `artifacts[{kind,path,bytes,sha256}]` `assets{included,remote,missing,missingFiles}` `engine{version,dir}` `builtAt` |
| `serve`     | `url` `port` `dir` `scene`                                                                                                     |
| `shot`      | `image` `width` `height` `bytes` `scene` `checks{ready,appMounted,browser,notFound}`                                           |

## 7. 退出码

| 码  | 含义                                                            |
| --- | --------------------------------------------------------------- |
| `0` | 成功                                                            |
| `1` | 业务失败：校验不通过、构建失败、截图失败、预览 404              |
| `2` | 用法或环境问题：参数错误、Node/播放器/浏览器缺失、JSON 无法解析 |
| `3` | 需要用户决策：覆盖已有工程等破坏性操作                          |

## 8. 校验错误码

错误（阻断打包）：

| code                                                                                                 | 含义                                            |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `E_PROJECT_SHAPE`                                                                                    | 顶层结构不对，或缺 `meta`                       |
| `E_NO_SCENES`                                                                                        | `scenes` 为空                                   |
| `E_SCENE_SHAPE` / `E_FRAME_SHAPE`                                                                    | 场景/帧不是期望的结构                           |
| `E_DUP_SCENE_ID` / `E_DUP_FRAME_ID`                                                                  | id 重复（帧 id 全局唯一）                       |
| `E_DUP_CHARACTER_ID` / `E_DUP_ASSET_ID` / `E_DUP_FLAG_KEY`                                           | 其余 id / key 重复                              |
| `E_FRAME_ID_MISSING` / `E_ASSET_ID_MISSING` / `E_CHARACTER_ID_MISSING`                               | 必填 id 缺失                                    |
| `E_BAD_FRAME_TYPE`                                                                                   | 不是 `line/choice/jump/end`                     |
| `E_BAD_TARGET`                                                                                       | 跳转目标场景不存在                              |
| `E_CHOICE_EMPTY` / `E_CHOICE_DEADLOCK`                                                               | 无选项 / 全部带条件                             |
| `E_ASSET_UNKNOWN`                                                                                    | 引用了不存在的素材                              |
| `E_ASSET_KIND_MISMATCH`                                                                              | 素材类型与引用位置不符                          |
| `E_ASSET_MEDIA_UNSUPPORTED`                                                                          | 文件媒体与 kind 不匹配（视频只能当 background） |
| `E_CHARACTER_MISSING` / `E_EXPRESSION_MISSING`                                                       | 立绘槽位断链                                    |
| `E_ASSET_FILENAME_UNSAFE` / `E_ASSET_FILENAME_DUP`                                                   | 文件名不安全 / 重复                             |
| `E_ASSET_FILE_MISSING`                                                                               | 本地素材在 `assets/` 里没有文件（远程素材跳过） |
| `E_ASSET_URL_INVALID`                                                                                | `url` 不是 http(s) 链接                         |
| `E_BAD_ENUM` / `E_BAD_CONDITION` / `E_BAD_TRANSFORM` / `E_BAD_CAST` / `E_BAD_SPEAKER` / `E_BAD_TEXT` | 字段取值非法                                    |

警告（不阻断）：

`W_META_ID_MISSING` `W_LOCALE` `W_STAGE` `W_SKIN` `W_ACCENT` `W_TITLE_ENABLED`
`W_SCENE_ID_MISSING` `W_EMPTY_SCENE` `W_UNREACHABLE_SCENE` `W_SPEAKER_MISSING`
`W_FLAG_UNDECLARED` `W_TRANSFORM_CLAMPED` `W_JUMP_NULL_TARGET` `W_UNUSED_ASSET`
`W_ASSET_FILE_MISSING` `W_FLAG_INITIAL` `W_SCENE_NAME`

## 9. 产物契约

`--format web`：

```
start.html / galastar.js / galastar.css / data.js / README.txt / media/<fileName>
```

`--format archive`：

```
project.json / README.txt / assets/<fileName>
```

- 文本条目 DEFLATE，媒体条目 STORE。
- 远程素材（`AssetRecord.url`）**不写入** `media/` 或 `assets/`；`data.js` 里对应
  的 `assets[id].path` 就是那条绝对 URL，工程包只在 `project.json` 里保留链接。
- 所有条目共用同一个时间戳。
- `data.js` 为 `window.GALASTAR_DATA = <RuntimePayload>;`，并转义 `</`。

## 10. 环境变量

| 变量                  | 作用                                                       |
| --------------------- | ---------------------------------------------------------- |
| `GALASTAR_ENGINE_DIR` | 覆盖播放器目录                                             |
| `GALASTAR_CHROME`     | 指定浏览器可执行文件                                       |
| `GALASTAR_WORKSPACE`  | 覆盖新作品的默认工作区（默认 `~/Documents/GalastarWorks`） |
| `SOURCE_DATE_EPOCH`   | 覆盖构建时间戳（秒）                                       |

## 11. 非目标

- 不提供剧本 DSL / Markdown 编译：输入就是 `project.json`。
- 不读写 IndexedDB，不做浏览器自动化以外的 GUI 操作。
- 不在 CLI 内执行播放器 JS：`runtime.js` 只按字节复制。

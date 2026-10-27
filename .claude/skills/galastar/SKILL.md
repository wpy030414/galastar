---
name: galastar
description: 用 Galastar CLI 制作、校验、打包与预览 GalGame（视觉小说）。当用户要求写一部 GalGame / Galgame、续写或修改剧情、生成可游玩的网页作品，或需要改动本仓库的 project.json 工程格式与 galastar 命令行时使用。
---

# Galastar：在终端里写完一部 GalGame

Galastar 是一个浏览器里的 GalGame IDE。这个 skill 让 Agent 不打开 GUI，也能用
`project.json` + `assets/` 完成从创作到可玩产物的全过程，并能截图自检。

CLI 与编辑器共用同一份打包核心，所以 **终端打出来的包与 GUI 导出的包结构一致**，
产物也可以随时导回编辑器继续改。

## 使用时机

- 用户要把一个故事、一段对话、一个分支剧情做成可游玩的 GalGame。
- 用户要续写、改台词、加分支、加结局、换立绘或背景。
- 用户要检查一个 Galastar 工程为什么打不开、为什么黑屏、为什么选项点不动。
- 需要改动 `project.json` 的字段、CLI 命令或打包产物时。

## 硬约束（先记住，再动手）

1. **每一帧是完整舞台快照，不是增量补丁。** 每个 `line` 帧都要写全 `bg` / `bgm` /
   `cast` / `transition`；只改 `speaker` / `text` / `sfx` / `voice` 会让画面回退到空舞台。
2. **id 必须唯一**：`scene.id`、`frame.id`（全局唯一）、`character.id`、`asset.id`、
   `flag.key`、`asset.fileName`。可读 id（`scene-hall`、`line-1`）比随机串更好维护。
3. **素材两种来源**：本地文件放 `<工程目录>/assets/`，文件名必须与 `project.json`
   里的 `fileName` 完全一致；也可以在素材记录里填 `url`（仅 http/https），
   远程素材不落盘、不复制进 zip，但**播放需要联网**。添加优先用 `galastar asset add`。
4. **选择帧至少保留一个无条件选项**（`requires: null`），否则条件都不成立时游戏会卡死。
5. **`target` / `next` 只能指向已存在的场景 id**；`jump` 没有目标就留 `null` 或删掉这一帧。
6. **立绘的表情必须先在 `character.sprites` 里登记**：`"微笑": "a_sprite_xxx"`，
   再在 `cast` 里用同一个键名。
7. **不要手改 `public/engine/*` 或已打包的 zip**。要改播放器行为，改源码后重新打包。
8. **作品语言**写在 `meta.locale`（`zh-CN` / `en`），它决定播放器界面与导出 README；
   编辑器自身的语言是另一回事，别混用。
9. **立绘按画幅摆**：全身立绘通常要放大并下移（`scale` 110–150、`offsetY` 200–400），别让人物缩在画面正中；
   半身立绘的底部切口必须贴住或越过画面底边，`offsetY` 不要用负值。同屏混用时用 `scale` 对齐视觉身高。
   详见 [references/recipes.md](references/recipes.md) 的「画幅适配」。
10. **结束帧是稀有演出**：`end` 帧会全屏盖住画面并停掉播放，量级上约每 1000 帧一个。
    每条线路的终点仍必须有一张 `kind: "ending"`（否则只会兜底显示一张「预览」占位卡），但中途别拿幕间卡当转场。

## 工作流

```bash
# 0. 仓库内用 node 直接跑；pnpm link --global 之后可以直接写 galastar
node bin/galastar.mjs <命令> ...
```

### 1. 起一个工程

```bash
node bin/galastar.mjs init my-story --template demo --name "星之扉" --author "我"
```

裸名字会建在默认工作区：`~/Documents/GalastarWorks/my-story`。带 `/` 或 `\` 的路径
按路径理解（相对当前目录），`--workspace <dir>` 或 `GALASTAR_WORKSPACE` 可换工作区。
输出里的 `dir` 就是最终位置。

`--template demo` 会复制一个含标题、立绘、分支与两个结局的最小作品；
先 `Read` 它的 `project.json`，照着结构改，比从空白开始更省事。
注意 demo 的立绘取景偏保守（`scale: 88`，全身显得很远），结构照抄，画幅按硬约束 9 重调。
`--template blank` 只给一个空场景。

### 2. 写故事

- 直接编辑 `my-story/project.json`。完整字段见
  [references/project-json.md](references/project-json.md)，常用写法见
  [references/recipes.md](references/recipes.md)。
- 加图片 / 音频：

  ```bash
  node bin/galastar.mjs asset add ./art/hall.png --kind background --project my-story
  node bin/galastar.mjs asset add ./art/sakiko-smile.png --kind sprite --project my-story
  node bin/galastar.mjs asset add ./audio/theme.mp3 --kind bgm --project my-story
  # 素材已经在 CDN 上：只写链接，不复制文件
  node bin/galastar.mjs asset add --url https://cdn.example.com/bg/hall.png --kind background --project my-story
  ```

  命令会复制文件、按规则命名、写回 `project.json`，并输出素材 id（JSON 在 stdout）。

### 3. 校验

```bash
node bin/galastar.mjs validate my-story --json
```

`ok:true` 且 `data.valid:true` 才能打包。每条问题都带稳定的 `code`
（如 `E_CHOICE_DEADLOCK`、`E_BAD_TARGET`、`E_ASSET_FILE_MISSING`），按 code 修，
不要靠猜。素材还没画完时，`W_ASSET_FILE_MISSING` 只是警告。

### 4. 打包

```bash
node bin/galastar.mjs build my-story                 # dist/<作品名>-web.zip
node bin/galastar.mjs build my-story --format both   # 同时产出 .galastar 工程包
```

产物清单：`start.html / galastar.js / galastar.css / data.js / README.txt / media/*`。
`--source-date` 可固定时间戳，得到可复现的字节级一致产物。

### 5. 看画面（关键步骤，不要跳过）

```bash
node bin/galastar.mjs shot my-story --json
node bin/galastar.mjs shot my-story --scene scene-hall --frame 0 --out my-story/.galastar/scene.png --json
```

`shot` 会构建、起临时服务、用 headless 浏览器定格到指定画面，并先断言页面
真的就绪（`data-galastar-ready`）再截图。拿到 `data.image` 后 **用 Read 打开确认**：
标题、台词、立绘、背景是否都在。看不到画面就等于没做完。

需要人来看时用 `serve`：

```bash
node bin/galastar.mjs serve my-story --port 4173
```

## 命令速查

| 命令                     | 用途                        | 常用参数                                                                        |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------- |
| `init [名字\|路径]`      | 新建工程（默认进工作区）    | `--template blank\|demo` `--name` `--author` `--locale` `--workspace` `--force` |
| `asset add <文件...>`    | 添加本地素材并写回工程      | `--kind background\|sprite\|bgm\|voice\|sfx` `--project` `--id` `--dry-run`     |
| `asset add --url <链接>` | 添加远程素材（只存链接）    | `--kind` `--name` `--mime` `--project`                                          |
| `validate [dir]`         | 校验结构、引用与素材文件    | `--strict` `--max-issues` `--assets-dir`                                        |
| `build [dir]`            | 打包                        | `--format web\|archive\|both` `--out` `--allow-missing` `--source-date`         |
| `serve [dir]`            | 构建并起本地服务            | `--port` `--host` `--scene` `--frame` `--title` `--no-build`                    |
| `shot [dir]`             | 构建 + 定格截图             | `--scene` `--frame` `--title` `--size 1280x720` `--wait` `--browser`            |
| `doctor`                 | 自检 Node / 播放器 / 浏览器 | —                                                                               |

所有命令都支持 `--json`：stdout 只有一个 JSON 对象，日志走 stderr。
退出码：`0` 成功、`1` 业务失败（校验/构建/截图）、`2` 用法或环境问题、
`3` 需要用户决策（如覆盖非空目录）。输入既可以是工程目录，也可以是 `.galastar` 工程包。

## 验收标准

- `validate` 零错误（警告要么修掉，要么明确知道原因）。
- `build` 产出 zip，解压后 `start.html`、`data.js`、`media/` 齐全。
- `shot` 的截图里能看到预期的背景、立绘与台词；换场景再截一张，确认分支确实走到了。
- 截图里的立绘站得住：全身立绘头顶有留白、人物有存在感；半身立绘底部切口贴住画面底边，不悬空；两侧没有被裁掉。
- 结束帧没有超标：数量与「每 1000 帧一个」同量级，且每条能玩到头的线路都有 `kind: "ending"` 收口。
- 若用户还在用编辑器：把 `.galastar` 工程包交给用户在首页「导入工程」，能继续编辑。

## 边界

- 不引入剧本 DSL：故事的事实来源就是 `project.json`。
- 不碰 `src/lib/db.ts`（IndexedDB）与浏览器存储；CLI 只认文件。
- 远程素材只写 URL，不下载、不打包；离线可玩的作品请用本地素材。
- 背景可以是图片、GIF / 动态图，也可以是视频（mp4 / m4v / mov / webm / ogv）：视频挂在
  背景层的 `<video>` 上，静音循环自动播放，同一背景跨帧推进不重播。视频只能当背景，
  其它 kind 会被 `E_ASSET_MEDIA_UNSUPPORTED` 拦下。
- 不把 `dist/`、`.galastar/`、截图提交进仓库（`init` 已写好 `.gitignore`）。
- 播放器运行时是 `public/engine/runtime.js`，零依赖 classic script；改它要单独评估兼容性。

## 需要更细的规则时

- 所有字段、默认值、会被归一化改写的项 → [references/project-json.md](references/project-json.md)
- 分支、flag、多结局、立绘站位、标题界面、常见错误 → [references/recipes.md](references/recipes.md)
- 命令与 JSON 字段的正式契约 → `docs/specs/galastar-cli.md`

# 常见写法与坑

这份文档只讲「怎么写」；字段的完整定义见 [project-json.md](project-json.md)。

---

## 1. 线性对话：快照要重复

每一帧都是完整舞台。第二句不会自动继承第一句的舞台——除非你写上去。

```jsonc
// ✅ 正确：两句都写全 bg / cast
{ "id": "line-1", "type": "line", "speaker": {"characterId":"char_a","name":"A"},
  "text": "第一句", "bg": "a_bg_room", "bgm": null, "sfx": null, "voice": null,
  "cast": {"left":null,"center":{"characterId":"char_a","expression":"normal","transform":{"scale":100,"offsetX":0,"offsetY":0}},"right":null},
  "transition": "fade", "shake": false },

{ "id": "line-2", "type": "line", "speaker": {"characterId":"char_a","name":"A"},
  "text": "第二句", "bg": "a_bg_room", "bgm": null, "sfx": null, "voice": null,
  "cast": {"left":null,"center":{"characterId":"char_a","expression":"smile","transform":{"scale":100,"offsetX":0,"offsetY":0}},"right":null},
  "transition": "cut", "shake": false }
```

在编辑器里新建下一句时会自动继承，手写 JSON 时没有这层照顾。

---

## 2. 分支与 flag

```jsonc
{
  "id": "choice-1",
  "type": "choice",
  "prompt": "要留下吗？",
  "options": [
    {
      "id": "opt-yes",
      "text": "留下",
      "target": "scene-stay",
      "setFlags": { "invited": "true" },
      "requires": null,
    },
    { "id": "opt-no", "text": "离开", "target": "scene-leave", "setFlags": {}, "requires": null },
  ],
}
```

- 先在最外层声明变量：`"flags": [{ "key": "invited", "initial": "false" }]`。
- 值一律是字符串。要布尔语义就写 `"true"` / `"false"`，比较时也用字符串。
- **始终保留一个 `requires: null` 的选项**，否则条件都不成立时玩家会卡在空白选择界面。
- `target` 写成 `null` 表示「选完继续本场景下一帧」，适合只改 flag 不影响流向的选项。

---

## 3. 条件跳转

```jsonc
{ "id": "jump-1", "type": "jump",
  "requires": { "key": "invited", "op": "==", "value": "true" },
  "target": "scene-stay" },
{ "id": "line-fallback", "type": "line", "speaker": {"characterId":null,"name":""},
  "text": "她什么也没说。", "bg": "a_bg_room", "bgm": null, "sfx": null, "voice": null,
  "cast": {"left":null,"center":null,"right":null}, "transition": "cut", "shake": false }
```

条件不成立时顺延到下一帧——所以 jump 后面要写「没跳成」时该看到的内容。
`target: null` 的 jump 没有意义，校验器会给 `W_JUMP_NULL_TARGET`，建议删掉。

---

## 4. 多结局

结局帧有两种：

```jsonc
{ "id": "end-good", "type": "end", "kind": "ending",
  "title": "结局 · 贵宾席", "subtitle": "灯亮起时，她还坐在那里。", "next": null }

{ "id": "end-chapter", "type": "end", "kind": "chapter",
  "title": "第一幕 完", "subtitle": "", "next": "scene-two" }
```

- `kind: "ending"` 用于收尾；`kind: "chapter"` 用于幕间。
- `next` 指向下一幕 → 显示「继续」；`null` → 只显示「回到标题 / 再来一次」。

---

## 5. 立绘：站位与表情

```jsonc
"characters": [
  { "id": "char_a", "name": "A", "color": "#e0a8c8",
    "sprites": { "normal": "a_sprite_normal", "smile": "a_sprite_smile" } }
]
```

```jsonc
"cast": {
  "left":   { "characterId": "char_b", "expression": "normal", "transform": { "scale": 84, "offsetX": -260, "offsetY": 30 } },
  "center": { "characterId": "char_a", "expression": "smile",  "transform": { "scale": 100, "offsetX": 0, "offsetY": 0 } },
  "right":  null
}
```

- 槽位是固定的左 / 中 / 右；同一角色不能同时站两个槽位。
- `offsetX` 向右为正，`offsetY` 向下为正，单位是 1280×720 舞台像素。
- 想让角色看起来更远：`scale` 调小（如 80–90），并适当加 `offsetY`。
- 换表情只改 `expression`，但整个 `cast` 仍要完整写出。
- 想让某人退场：把对应槽位写成 `null`。

---

## 6. 标题界面

```jsonc
"title": { "enabled": true, "subtitle": "A tiny demo", "background": "a_bg_hall" }
```

- `enabled: false` → 打开作品直接进第一个场景，没有标题层。
- `background` 用 `background` 类型的素材；也可以用 `null`（纯色底）。
- 标题上的作品名 / 作者 / 版本来自 `meta.name` / `meta.author` / `meta.version`。

---

## 7. 音频

- `bgm`：进入该帧时切换背景音乐；`null` 表示停止。
- `sfx`：本帧点击推进时播放一次。
- `voice`：本句语音，通常跟随台词自动播放。
- 素材类型必须是 `bgm` / `sfx` / `voice`，否则校验器报 `E_ASSET_KIND_MISMATCH`。

---

## 8. 远程素材

素材已经在 CDN / 图床上时，不必下载到 `assets/`：

```bash
galastar asset add --url https://cdn.example.com/bg/hall.png --kind background --project my-story
```

它会写入一条带 `url` 的素材记录：

```jsonc
{
  "id": "a_xxxxxxxx",
  "kind": "background",
  "fileName": "bg-hall.png",
  "size": 0,
  "url": "https://cdn.example.com/bg/hall.png",
  "createdAt": 1735689600000,
}
```

注意：

- 只支持 `http://` / `https://`；`data:` / `file:` / `javascript:` 会被拒绝
  （`E_ASSET_URL_INVALID`）。
- 打包时不会复制进 `media/`，zip 更小；但**播放必须联网**，链接要长期可用。
- 编辑器里也可以「素材库 → 从链接添加」直接填链接；卡片上会标「远程」。
- 同一个链接重复添加是幂等的，远程与本地素材可以混用。
- `validate` 只检查格式与引用，不联网；链接是否真的可访问，要靠 `shot` 或 `serve` 看画面。

## 9. 常见错误对照表

| 校验 code                 | 常见原因                                 | 怎么修                          |
| ------------------------- | ---------------------------------------- | ------------------------------- |
| `E_NO_SCENES`             | `scenes` 空 / 写成了对象                 | 至少一个场景                    |
| `E_DUP_FRAME_ID`          | 复制粘贴后忘了改 id                      | 帧 id 全局唯一                  |
| `E_BAD_TARGET`            | `target` / `next` 指向不存在的场景       | 对照 `scenes[].id`              |
| `E_CHOICE_DEADLOCK`       | 所有选项都带 `requires`                  | 留一个 `requires: null`         |
| `E_EXPRESSION_MISSING`    | `cast` 用了 `sprites` 里没有的表情       | 先在角色上登记表情              |
| `E_CHARACTER_MISSING`     | 角色 id 拼错 / 角色被删                  | 对照 `characters[].id`          |
| `E_ASSET_UNKNOWN`         | 引用了不存在的素材 id                    | 对照 `assets[].id`              |
| `E_ASSET_KIND_MISMATCH`   | 背景用了 sprite，或反过来                | 改素材 kind 或换素材            |
| `E_ASSET_FILE_MISSING`    | `assets/` 里没有对应文件                 | 把文件放进去，或 `asset add`    |
| `E_ASSET_FILENAME_UNSAFE` | fileName 带路径 / 中文标点以外的特殊字符 | 用 `asset add` 生成             |
| `E_ASSET_URL_INVALID`     | 远程链接不是 http(s)                     | 改成 `http://` / `https://`     |
| `W_ASSET_FILE_MISSING`    | 还没画素材，先写了引用                   | 打包前补上，否则 `build` 会失败 |
| `W_FLAG_UNDECLARED`       | `requires` 用了没声明的变量              | 在 `flags` 里声明初始值         |
| `W_TRANSFORM_CLAMPED`     | scale / offset 超出范围                  | 缩回 20–300 / ±640 / ±400       |
| `W_UNREACHABLE_SCENE`     | 场景没有任何入口                         | 加 jump / choice / end.next     |

---

## 10. 写作与校验节奏

1. 先写 3–5 帧，`validate` 一次——早期修结构比写完 200 帧再修便宜。
2. 每加一个场景就补一条入口（choice / jump / end.next），避免 `W_UNREACHABLE_SCENE`。
3. 台词帧不必一句一帧；一段独白可以拆成 2–4 帧来控制节奏。
4. 用 `shot --scene <id> --frame <n>` 抽查关键画面，比通读 JSON 更快发现「立绘跑出画外」。
5. 分支务必两条都截一次图，确认 flag 与 target 真的走到了预期场景。

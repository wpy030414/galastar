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

## 4. 结局与幕间

结局帧有两种：

```jsonc
{ "id": "end-good", "type": "end", "kind": "ending",
  "title": "结局 · 贵宾席", "subtitle": "灯亮起时，她还坐在那里。", "next": null }

{ "id": "end-chapter", "type": "end", "kind": "chapter",
  "title": "第一幕 完", "subtitle": "", "next": "scene-two" }
```

- `kind: "ending"` 用于收尾；`kind: "chapter"` 用于幕间。
- `next` 指向下一幕 → 幕末卡任意处点击，交叉渐变到下一幕的幕名开场帧；`null` → 全线终点，只给「回到标题」。

### 结束帧的用量：它是稀有演出

`end` 帧会盖一层全屏卡片、停掉自动播放与逐字，把玩家从故事里拽出来一次。用得对是仪式感，用密了就是打断。

- **每条能玩到头的线路，终点必须有一张 `kind: "ending"`。** 场景走到最后一帧还没有 end 帧时，播放器只会兜底显示一张带「预览」角标的占位卡（标题「已到达剧本尽头」）——玩家看到的就是作品没做完。
- **密度按「每 1000 帧一个」估**：几十帧的小品只在结尾留一张；几百帧的中篇两三个；上千帧的长篇才铺得开幕间。多分支的每条终点各要一张 ending，这是结构必需；真正该克制的是同一条路线上反复出现的幕间。
- `kind: "chapter"` 留给「一系列事件收束」的幕间，不是段落分隔符。
- 想让时间跳过（「三小时后」「翌日」），优先用一帧 `line` 直接叙述，或换背景配 `transition`，别插幕间卡。
- 提前终止的支线（错过、放弃）能合流回主线就合流，少造一个终点卡。
- `--template demo` 里的两个 ending 只是为了演示分支收尾，**不是节奏样板**。

---

## 5. 立绘：站位与表情

```jsonc
"characters": [
  { "id": "char_a", "name": "A", "color": "#e0a8c8",
    "sprites": { "normal": "a_sprite_normal", "smile": "a_sprite_smile" } }
]
```

```jsonc
// 按全身素材举例；半身素材的取景见下面的「画幅适配」
"cast": {
  "left":   { "characterId": "char_b", "expression": "normal", "transform": { "scale": 115, "offsetX": -140, "offsetY": 300 } },
  "center": { "characterId": "char_a", "expression": "smile",  "transform": { "scale": 130, "offsetX": 0, "offsetY": 300 } },
  "right":  null
}
```

- 槽位是固定的左 / 中 / 右；同一角色不能同时站两个槽位。
- `offsetX` 向右为正，`offsetY` 向下为正，单位是 1280×720 舞台像素。
- `scale` 以**脚底中点**为原点缩放：改大小不会让人物离地。远景靠 `scale` 取小值，并保持同一个 `offsetY`（站在同一条脚下基准线上），别用负 `offsetY` 把人提起来。
- 换表情只改 `expression`，但整个 `cast` 仍要完整写出。
- 想让某人退场：把对应槽位写成 `null`。

### 画幅适配：全身立绘和半身立绘不是一种摆法

放大时人物从头顶开始被裁、脚不会离开地面，`offsetY` 决定她整张画挂在多高。先看素材是**从头到脚完整**，还是**腰以上截断**，两者的取景方式相反。最快的判断方式是直接 `Read` 素材文件——图片会以画面形式呈现，一眼就能看出构图和透明留白。

**全身立绘**——`scale: 100` 只是让整张画占满舞台高度，全身构图下脸会小得像站在远处。要放大并往下压，让头顶留白、膝盖以下自然出画：

```jsonc
"cast": {
  "left":   null,
  "center": { "characterId": "char_a", "expression": "smile",
              "transform": { "scale": 130, "offsetX": 0, "offsetY": 300 } },
  "right":  null
}
```

- 经验区间：`scale` 110–150、`offsetY` 200–400（400 是上限，再大运行时会夹取并报 `W_TRANSFORM_CLAMPED`）。
- 判断标准是眼睛落在画面中上部、人物有存在感，而不是全身端端正正缩在中间。

**半身立绘**——底边是一刀切的硬口，悬空就会瞬间出戏：

- `offsetY` 只用 `0` 或正值，**绝不要用负值**把人提起来；切口要贴住画面底边，或干脆压到画面外。
- 素材下方有透明留白时，用正 `offsetY` 填掉，或者先把透明边裁掉。
- 想放大必须同步下移：原点在脚底，`scale` 每加 10，头顶就多出约 72px 会被裁，要用差不多大小的正 `offsetY` 补回来。`scale 120 / offsetY 120` 才是「更大且头顶不丢」；`scale` 过了 100 却不加偏移，先没的是她的头顶。

**同屏混用两种素材**时，用 `scale` 把两张脸对齐到接近的视觉高度；`left` / `right` 通常比 `center` 再小 10–20，做出前后层次。

调完一定用 `shot` 截图复核：头顶有没有留白、半身切口贴不贴底、两侧有没有被裁掉。舞台是固定 1280×720 等比缩放（`min(w/1280, h/720)`，多余部分留黑边），构图不随窗口变化，所以 1280×720 的截图就代表所有分辨率——不用再换 `--size` 复核。

### 心理活动：名牌消失，亮暗看归因

`innerVoice: true` 表示这句话是想法而不是声音，播放器会隐掉说话人名牌。台光不要再加字段，由 `speaker.characterId` 决定：

```jsonc
// 场上某个人的内心：名牌消失，只亮她自己
{ "id": "line-iso-1", "type": "line",
  "speaker": { "characterId": "char_a", "name": "A" }, "innerVoice": true,
  "text": "……他大概还不知道。", "bg": "a_bg_hall", "bgm": null, "sfx": null, "voice": null,
  "cast": { "left": { "characterId": "char_a", "expression": "normal", "transform": { "scale": 100, "offsetX": 0, "offsetY": 0 } }, "center": null, "right": null },
  "transition": "cut", "shake": false }

// 第一人称「我」在想：没有角色归因，全场立绘一起压暗
{ "id": "line-iso-2", "type": "line",
  "speaker": { "characterId": null, "name": "" }, "innerVoice": true,
  "text": "我大概永远不会说出口。", "bg": "a_bg_hall", "bgm": null, "sfx": null, "voice": null,
  "cast": { "left": { "characterId": "char_a", "expression": "normal", "transform": { "scale": 100, "offsetX": 0, "offsetY": 0 } }, "center": null, "right": null },
  "transition": "cut", "shake": false }
```

- 字段可省略，缺省等价于 `false`；旧工程不用改。
- 归因不会因为隐掉名牌而丢失：回看记录里仍然记着这句归谁。
- 想让「我」的独白仍然亮着某个人，就把 `characterId` 填上——语义会变成「那个人的内心」，不是「我」。

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

## 8. 背景素材：静态、动态与视频

背景是一层 CSS `background-image`（`background-size: cover`，舞台 1280×720）。能用什么、不能用什么，都由这一条决定：

- **静态图**：png / jpg / webp / avif / svg，最常用。
- **动态图**：GIF、动态 WebP / AVIF 直接可用，浏览器自己循环。画面按 `cover` 裁切，所以也按 16:9 出画最稳。
- **视频**：mp4 / m4v / mov / webm / ogv 也能当背景。播放器会在背景层里挂一个 `<video>`（静音 + 循环 + `playsinline`），自动播放、按 `object-fit: cover` 裁切；`asset add clip.mp4 --kind background` 即可。
- **视频只能当背景**。塞给立绘（`sprite`）或音频（`bgm` / `sfx` / `voice`）会被 `E_ASSET_MEDIA_UNSUPPORTED` 拦下——立绘走 `<img>`、声音走 `<audio>`，视频进去只会是空的。
- **同一背景跨帧推进不会重播**：播放器只在背景 id 真的变了的时候才重写图层，动图和视频都接着走；换背景才从头来。编辑器里定格、读档同理。
- 没有暂停、只播一次、跟语音对齐这类控制，动态素材会一直循环——别把它当成「一次性演出」。
- 体积上 GIF 通常比动态 WebP 大好几倍，能转就转；视频更大，注意首屏加载。
- 编码要浏览器认：H.264 的 mp4 与 VP8 / VP9 的 webm 最稳，HEVC、部分 AV1 组合可能放不出来。
- `serve` 是本机亲眼看动态素材的方式。`shot` 在 headless 里定格：实测动图不会往前走、视频能停在某一帧，所以截图只代表「那一刻」，不能拿来验收动态效果。

---

## 9. 远程素材

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

## 10. 常见错误对照表

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
| `E_ASSET_MEDIA_UNSUPPORTED` | 视频塞给了立绘 / 音频，或音频当背景    | 改 `kind`，或换素材             |
| `W_ASSET_FILE_MISSING`    | 还没画素材，先写了引用                   | 打包前补上，否则 `build` 会失败 |
| `W_FLAG_UNDECLARED`       | `requires` 用了没声明的变量              | 在 `flags` 里声明初始值         |
| `W_TRANSFORM_CLAMPED`     | scale / offset 超出范围                  | 缩回 20–300 / ±640 / ±400       |
| `W_UNREACHABLE_SCENE`     | 场景没有任何入口                         | 加 jump / choice / end.next     |

---

## 11. 写作与校验节奏

1. 先写 3–5 帧，`validate` 一次——早期修结构比写完 200 帧再修便宜。
2. 每加一个场景就补一条入口（choice / jump / end.next），避免 `W_UNREACHABLE_SCENE`。
3. 台词帧不必一句一帧；一段独白可以拆成 2–4 帧来控制节奏。
4. 用 `shot --scene <id> --frame <n>` 抽查关键画面，比通读 JSON 更快发现「立绘跑出画外」。
5. 分支务必两条都截一次图，确认 flag 与 target 真的走到了预期场景。
6. 定稿前数一遍 `"type": "end"` 的个数：超出「每 1000 帧一个」的量级，就把中场的幕间卡换回普通台词帧。
7. 立绘首次登场、换人、换画幅（全身 ↔ 半身）时都要 `shot` 定点确认——缩放与位移是 JSON 里看不出来、画面上却最扎眼的问题。

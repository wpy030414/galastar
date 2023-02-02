# 欢迎使用 PGF

> Can't recogonize Simplified Chinese? Go to read [English version](README.md).

**PGF**（Penyo Gal Framework）提供了一种完全基于 Web 的朴素办法，显示文字、图片在同一画面，业界中常称其为 GalGame。这也是我们打算入手的第一类 Video Game，因为技术上实现比较简单。
与市面上普遍的 GalGame 相比，本项目计划具备较为完善的数据管理机制、交互机制。初期预备设计开始界面、游戏界面、设置界面、背景介绍界面四大分支。
**Penyo 对 PGF 全部内容保有权利**：没有引用任何商业或强制开源许可项目，且 PGF 并不打算在短期内开源。基于 PGF 创作的艺术型项目，版权总是属于 Penyo，除非额外书面商议。您一旦使用了 PGF 就视为您同意这一切。

## PGF 数据管理标准

为了规范化数据和媒体文件，您需要了解数据的管理标准。

### 剧本标准

剧本统一存放在*data*文件夹中。

若剧本是无分支的，其名称应当类似于 `chapter-章数-幕数.json`。如*第四章第一幕*：

```text
chapter-4-1.json
```

若剧本有分支，则剧本的每一个分支都应该作为独立文件出现，其名称应当类似于 `chapter-章数-幕数+分支代号.json`。如*第四章第二幕第一分支*：

```text
chapter-4-2a.json
```

多分支中，剧本重复的部分只需要视为一个无分支的剧本，分支剧本中只需要包含其专有的内容。如*第四章第三幕*一开始是没有分支的，后来才出现了两个分支，那么就应该有三个文件存在：

```text
chapter-4-3.json
chapter-4-3a.json
chapter-4-3b.json
```

### 帧标准

剧本文件的基本单位是**帧**，有**普通帧**和**分支选择帧**两种。它们的构造分别如下：

```json
{
    "type": "normal",
    "bg": {
        "pic": null,
        "music": null,
        "effect": null
    },
    "roleL": {
        "pic": null,
        "vocal": null,
        "effect": null
    },
    "roleR": {
        "pic": null,
        "vocal": null,
        "effect": null
    },
    "text": {
        "speaker": null,
        "body": ""
    },
    "soundEffect": null,
    "isFinalFrame": false
}
```

```json
{
    "type": "choicer",
    "choices": [
        {
            "name": "",
            "operation": ""
        },
        {
            "name": "",
            "operation": ""
        }
    ],
    "isFinalFrame": false
}
```

其中键值对具体含义请私询 Penyo。

### 媒体标准

媒体统一存放在*assets*文件夹中。

背景图片一律裁切为1280\*720像素的JPEG文件，其名称应当类似于 `bgi-场景名称.jpeg`。如*学校夜晚场景*：

```text
bgi-school_evening.jpeg
```

人物立绘一律裁切为正方形的PNG文件，但必须是全身像，且人物的头顶和脚跟刚好抵住图片边界，其名称应当类似于 `img-角色名-状态.png`。如*东海帝王生气的样子*：

```text
img-tokai_teio-angry.png
```

人物语音一律为16bit起的WAV文件，其名称应当类似于 `voc-角色名-台词概要.wav`。如*特别周呼喊无声铃鹿*：

```text
voc-special_week-calling_silence_suzuka.wav
```

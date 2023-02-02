# Welcome to Use PGF

> 看不懂英语？去阅读[简体中文版本](README-zh_CN.md)。

**PGF** (Penyo Gal Framework) provides a completely web-based simple way to display text and pictures on the same screen, often called GalGame in the industry. This is also the first type of video game we intend to start with, because the technical implementation is relatively simple.
Compared with GalGame on the market, this project plans to have a relatively complete data management mechanism and interaction mechanism. The initial preparation design of four branches: the start interface, the game interface, the setting interface, and the background introduction interface.
**Penyo retains rights to all contents of PGF**: it does not cite any commercial or mandatory open source licensing projects, and PGF does not intend to open source anytime soon. For artistic projects based on PGF, copyright always belongs to Penyo unless otherwise agreed upon in writing. By using PGF, you agree to all this.

## PGF Data Management Standards

In order to normalize data and media files, you need to understand the standards for managing your data.

### Script Standards

The scripts are stored in the *data* folder.

If the script is unbranched, its name should be something like `chapter-chapter-act.json`. For example, *Chapter IV, Act I*:

```text
chapter-4-1.json
```

If the script has branches, each branch of the script should appear as a separate file, with a name similar to `chapter-chapter-acting+branch.json`. For example, *Chapter IV, Act II, Branch I*:

```text
chapter-4-2a.json
```

In branches, the repeating parts of the script only need to be treated as an unbranched script, and the branched script only needs to contain its proprietary content. If *Chapter IV, Act III* starts without branches, and only later two branches appear, then there should be three files:

```text
chapter-4-3.json
chapter-4-3a.json
chapter-4-3b.json
```

### Frame Standard

The basic unit of a script file is a **frame**, and there are two types: **normal frame** and **branch selection frame**. They are constructed as follows:

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

For the specific meaning of key-value pairs, please consult Penyo privately.

### Media Standard

The media is stored in the *assets* folder.

Background images are always cropped to 1280\*720 pixel JPEG files with names similar to `bgi-sceneName.jpeg`. For example, *school evening scene*:

```text
bgi-school_evening.jpeg
```

Character drawings are always cropped into square PNG files, but they must be full-body portraits, and the top of the person's head and heels are just against the boundary of the image, and its name should be similar to `img-characterName-status.png`. For example, *Tokai Teio looks angry*:

```text
img-tokai_teio-angry.png
```

All WAV files with character voices starting from 16 bits should have names similar to `voc-characterNames-lineSynopsis.wav`. For example, *Special Week is calling Silent Suzuka*:

```text
voc-special_week-calling_silence_suzuka.wav
```

/*!
 * Galastar Runtime 2.0
 * 零依赖、可直接用 file:// 打开的 Galgame 播放器。
 *
 * 这份文件同时服务两个场景：
 *   1. 编辑器内嵌预览（public/engine/preview.html 通过 postMessage 驱动）
 *   2. 导出的作品包（start.html 直接 <script src> 引入）
 * 因此它必须是 **classic script**：没有 import / export，也不使用 fetch，
 * 播放所需数据全部由外部以 window.GALASTAR_DATA 或 API 注入。
 */
;(function (global) {
  'use strict'

  var VERSION = '2.1.0'
  var SLOTS = ['left', 'center', 'right']
  /* 立绘摆放的兜底值：v2.0.1 之前的作品没有 transform 字段 */
  var DEFAULT_TRANSFORM = { scale: 100, offsetX: 0, offsetY: 0 }
  var TRANSFORM_RANGE = { scale: [20, 300], offsetX: [-640, 640], offsetY: [-400, 400] }
  var STORE_SAVE = 'galastar:save:'
  var STORE_CONFIG = 'galastar:config:'

  /* ------------------------------------------------------------------ *
   * 工具
   * ------------------------------------------------------------------ */

  function el(tag, cls, text) {
    var node = document.createElement(tag)
    if (cls) node.className = cls
    if (text != null) node.textContent = text
    return node
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild)
  }

  function readJSON(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch (e) {
      return fallback
    }
  }

  function writeJSON(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      /* 无痕模式或配额溢出：静默降级，不影响播放 */
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max)
  }

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n
  }

  function stamp(ts) {
    var d = new Date(ts)
    return (
      d.getFullYear() +
      '-' +
      pad2(d.getMonth() + 1) +
      '-' +
      pad2(d.getDate()) +
      ' ' +
      pad2(d.getHours()) +
      ':' +
      pad2(d.getMinutes())
    )
  }

  function compare(left, op, right) {
    var a = left == null ? '' : left
    var b = right == null ? '' : right
    var na = parseFloat(a)
    var nb = parseFloat(b)
    var numeric = !isNaN(na) && !isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== ''
    if (numeric) {
      a = na
      b = nb
    } else {
      a = String(a)
      b = String(b)
    }
    switch (op) {
      case '==':
        return a == b // eslint-disable-line eqeqeq
      case '!=':
        return a != b // eslint-disable-line eqeqeq
      case '>':
        return a > b
      case '>=':
        return a >= b
      case '<':
        return a < b
      case '<=':
        return a <= b
      default:
        return false
    }
  }

  /* ------------------------------------------------------------------ *
   * 文案：播放器界面跟随作品语言（meta.locale），而不是打开它的浏览器
   * ------------------------------------------------------------------ */

  var STRINGS = {
    'zh-CN': {
      'player.auto': '自动',
      'player.log': '记录',
      'player.save': '存档',
      'player.config': '设置',
      'player.hint': '点击任意位置继续',
      'player.endingTitle': '已到达剧本尽头',
      'player.endingSubtitle': '这一场景没有更多内容了',
      'player.choicePrompt': '做出你的选择',
      'player.unnamedOption': '未命名选项',
      'player.start': '开始游戏',
      'player.continue': '继续游戏',
      'player.about': '关于作品',
      'player.untitledWork': '未命名作品',
      'player.kickerPreview': '预览',
      'player.kickerEnding': '结局',
      'player.kickerChapter': '本章完',
      'player.kickerNext': '下一幕',
      'player.backToTitle': '回到标题',
      'player.backlog': '回看',
      'player.aboutAuthor': '作者',
      'player.aboutVersion': '版本',
      'player.aboutEngine': '引擎',
      'player.aboutScenes': '场景',
      'player.scenesCount': '{n} 个',
      'player.unknown': '未知',
      'player.noHistory': '还没有台词记录',
      'player.saveLoad': '存档 / 读档',
      'player.tabSave': '存档',
      'player.tabLoad': '读档',
      'player.saveFallbackScene': '存档',
      'player.noExcerpt': '（无台词）',
      'player.emptySlot': '空存档位',
      'player.settings': '设置',
      'player.textSpeed': '文字速度',
      'player.autoDelay': '自动等待',
      'player.bgmVolume': '音乐音量',
      'player.voiceVolume': '语音音量',
      'player.sfxVolume': '音效音量',
      'player.speedFastest': '极快',
      'player.speedFast': '快',
      'player.speedNormal': '标准',
      'player.speedSlow': '慢',
      'player.toggleFullscreen': '切换全屏',
      'player.slotLabel': 'SLOT ',
    },
    en: {
      'player.auto': 'Auto',
      'player.log': 'Log',
      'player.save': 'Save',
      'player.config': 'Settings',
      'player.hint': 'Click anywhere to continue',
      'player.endingTitle': 'End of the script',
      'player.endingSubtitle': 'There is nothing more in this scene',
      'player.choicePrompt': 'Make your choice',
      'player.unnamedOption': 'Untitled option',
      'player.start': 'Start',
      'player.continue': 'Continue',
      'player.about': 'About',
      'player.untitledWork': 'Untitled work',
      'player.kickerPreview': 'Preview',
      'player.kickerEnding': 'Ending',
      'player.kickerChapter': 'End of chapter',
      'player.kickerNext': 'Next act',
      'player.backToTitle': 'Title screen',
      'player.backlog': 'Backlog',
      'player.aboutAuthor': 'Author',
      'player.aboutVersion': 'Version',
      'player.aboutEngine': 'Engine',
      'player.aboutScenes': 'Scenes',
      'player.scenesCount': '{n}',
      'player.unknown': 'Unknown',
      'player.noHistory': 'No lines yet',
      'player.saveLoad': 'Save / Load',
      'player.tabSave': 'Save',
      'player.tabLoad': 'Load',
      'player.saveFallbackScene': 'Save',
      'player.noExcerpt': '(no line)',
      'player.emptySlot': 'Empty slot',
      'player.settings': 'Settings',
      'player.textSpeed': 'Text speed',
      'player.autoDelay': 'Auto delay',
      'player.bgmVolume': 'Music volume',
      'player.voiceVolume': 'Voice volume',
      'player.sfxVolume': 'SFX volume',
      'player.speedFastest': 'Fastest',
      'player.speedFast': 'Fast',
      'player.speedNormal': 'Normal',
      'player.speedSlow': 'Slow',
      'player.toggleFullscreen': 'Toggle fullscreen',
      'player.slotLabel': 'SLOT ',
    },
  }

  /** 作品语言优先；数据没带 locale 时才看浏览器 */
  function detectLang(payload) {
    var locale = payload && payload.meta ? payload.meta.locale : null
    if (locale === 'en' || locale === 'zh-CN') return locale
    var nav = (global.navigator && global.navigator.language) || ''
    return /^zh\b/i.test(nav) ? 'zh-CN' : 'en'
  }

  function textFor(lang, key, vars) {
    var table = STRINGS[lang] || STRINGS['zh-CN']
    var template = table[key] != null ? table[key] : STRINGS['zh-CN'][key]
    if (template == null) return key
    if (!vars) return template
    return template.replace(/\{(\w+)\}/g, function (match, name) {
      return vars[name] != null ? String(vars[name]) : match
    })
  }

  var DEFAULT_CONFIG = {
    textSpeed: 42, // 每字毫秒
    autoDelay: 1800, // 自动播放下句等待
    bgmVolume: 0.6,
    sfxVolume: 0.8,
    voiceVolume: 1,
  }

  /* ------------------------------------------------------------------ *
   * Stage：一个播放器实例
   * ------------------------------------------------------------------ */

  function Stage(root, payload, options) {
    options = options || {}
    this.root = root
    this.mode = options.mode === 'edit' ? 'edit' : 'play'
    this.onEvent = typeof options.onEvent === 'function' ? options.onEvent : null
    this.payload = null
    this.sceneMap = {}
    this.config = Object.assign({}, DEFAULT_CONFIG, readJSON(STORE_CONFIG, {}))

    this.view = {
      sceneId: null,
      index: 0,
      flags: {},
      running: false,
      waiting: false,
      typing: false,
      auto: false,
      skip: false,
      history: [],
      historyScene: null,
      frame: null,
      /* 幕末卡 / 幕名开场帧 / 换幕动画期间的状态 */
      endCard: false,
      endNext: null,
      opening: null,
      busy: false,
      /* 已经在幕名卡背后摆好、但还没开始逐字的台词 */
      held: false,
    }

    this.timers = { type: null, auto: null, transition: null, fade: null }
    this.typeState = { full: '', shown: 0, done: true }
    this.bgActive = 'a'
    this.disposers = []
    /* 语言在 build 之前定下来：标题、工具栏这些只建一次的节点才能一次写对 */
    this.lang = detectLang(payload)

    this.build()
    this.bind()
    if (payload) this.setPayload(payload)
  }

  Stage.prototype.build = function () {
    var self = this
    var app = el('div', 'gs-app gs-mode-' + this.mode)
    var frame = el('div', 'gs-frame')

    this.bgA = el('div', 'gs-bg gs-bg-a')
    this.bgB = el('div', 'gs-bg gs-bg-b')
    this.bgB.style.opacity = '0'

    var cast = el('div', 'gs-cast')
    this.slots = {}
    SLOTS.forEach(function (slot) {
      var wrap = el('div', 'gs-slot gs-slot-' + slot)
      var img = el('img')
      img.alt = ''
      img.draggable = false
      wrap.appendChild(img)
      cast.appendChild(wrap)
      self.slots[slot] = { wrap: wrap, img: img }
    })

    var vignette = el('div', 'gs-vignette')

    /* 对话框 */
    this.dialog = el('div', 'gs-dialog')
    this.nameBox = el('div', 'gs-name')
    this.nameText = el('span', 'gs-name-text')
    this.nameBox.appendChild(this.nameText)
    this.textBox = el('div', 'gs-text')
    this.nextMark = el('div', 'gs-next', '▼')
    this.toolbar = el('div', 'gs-toolbar')

    var tools = [
      { key: 'auto', labelKey: 'player.auto' },
      { key: 'log', labelKey: 'player.log' },
      { key: 'save', labelKey: 'player.save' },
      { key: 'config', labelKey: 'player.config' },
    ]
    this.toolButtons = {}
    tools.forEach(function (t) {
      var btn = self.label('button', 'gs-tool', t.labelKey)
      btn.type = 'button'
      btn.dataset.key = t.key
      self.toolButtons[t.key] = btn
      self.toolbar.appendChild(btn)
    })

    this.dialog.appendChild(this.nameBox)
    this.dialog.appendChild(this.textBox)
    this.dialog.appendChild(this.nextMark)

    this.choices = el('div', 'gs-choices')
    this.flash = el('div', 'gs-flash')
    this.hint = this.label('div', 'gs-hint', 'player.hint')

    var plate = el('div', 'gs-plate')
    plate.appendChild(this.bgA)
    plate.appendChild(this.bgB)
    plate.appendChild(cast)
    plate.appendChild(vignette)
    this.plate = plate
    frame.appendChild(plate)
    frame.appendChild(this.dialog)
    frame.appendChild(this.toolbar)
    frame.appendChild(this.choices)
    frame.appendChild(this.hint)
    frame.appendChild(this.flash)

    /* 覆盖层：标题 / 记录 / 存档 / 设置 / 结局 */
    this.titleLayer = el('div', 'gs-layer gs-title')
    this.logLayer = el('div', 'gs-layer gs-log')
    this.saveLayer = el('div', 'gs-layer gs-save')
    this.configLayer = el('div', 'gs-layer gs-config')
    this.endLayer = el('div', 'gs-layer gs-end')

    ;[this.titleLayer, this.logLayer, this.saveLayer, this.configLayer, this.endLayer].forEach(
      function (layer) {
        layer.style.display = 'none'
        frame.appendChild(layer)
      },
    )

    /*
     * 幕名开场帧：跨幕时先给新的一幕一张专属卡片，再进入它的第一句。
     * 它必须排在幕末卡之后，才能叠在幕末卡上方做交叉渐变。
     */
    this.openingLayer = el('div', 'gs-layer gs-opening')
    this.openingBg = el('div', 'gs-opening-bg')
    var openingBox = el('div', 'gs-opening-inner')
    this.openingKicker = this.label('div', 'gs-opening-kicker', 'player.kickerNext')
    this.openingTitle = el('div', 'gs-opening-title')
    this.openingHint = this.label('div', 'gs-opening-hint', 'player.hint')
    openingBox.appendChild(this.openingKicker)
    openingBox.appendChild(this.openingTitle)
    openingBox.appendChild(this.openingHint)
    this.openingLayer.appendChild(this.openingBg)
    this.openingLayer.appendChild(openingBox)
    this.openingLayer.style.display = 'none'
    frame.appendChild(this.openingLayer)

    app.appendChild(frame)
    clear(this.root)
    this.root.appendChild(app)

    this.app = app
    this.frame = frame

    /* 音频通道 */
    this.audio = {
      bgm: el('audio'),
      sfx: el('audio'),
      voice: el('audio'),
    }
    this.audio.bgm.loop = true
    Object.keys(this.audio).forEach(function (k) {
      self.audio[k].preload = 'auto'
      frame.appendChild(self.audio[k])
    })

    this.buildTitle()
    this.buildSave()
    this.buildConfig()
    this.bindResize()
  }

  Stage.prototype.bindResize = function () {
    var self = this
    var apply = function () {
      var rect = self.root.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      var scale = Math.min(rect.width / 1280, rect.height / 720)
      self.frame.style.transform = 'translate(-50%, -50%) scale(' + scale + ')'
      self.app.style.setProperty('--gs-scale', String(scale))
    }
    apply()
    if (typeof global.ResizeObserver === 'function') {
      var ro = new global.ResizeObserver(apply)
      ro.observe(this.root)
      this.disposers.push(function () {
        ro.disconnect()
      })
    } else {
      global.addEventListener('resize', apply)
      this.disposers.push(function () {
        global.removeEventListener('resize', apply)
      })
    }
    this.applyScale = apply
  }

  /* ------------------------------------------------------------------ *
   * 数据
   * ------------------------------------------------------------------ */

  Stage.prototype.setPayload = function (payload) {
    var self = this
    this.payload = payload
    this.resetActCards()
    this.setLang(detectLang(payload))
    this.sceneMap = {}
    ;(payload.scenes || []).forEach(function (scene) {
      self.sceneMap[scene.id] = scene
    })
    var stage = (payload.meta && payload.meta.stage) || { width: 1280, height: 720 }
    this.frame.style.setProperty('--stage-w', stage.width + 'px')
    this.frame.style.setProperty('--stage-h', stage.height + 'px')
    if (payload.meta && payload.meta.accent)
      this.app.style.setProperty('--gs-accent', payload.meta.accent)
    /* 皮肤：pgf 是老界面（默认），night 是暗底衬版 */
    this.setSkin((payload.meta && payload.meta.skin) || 'pgf')

    if (this.view.sceneId && this.sceneMap[this.view.sceneId]) {
      this.render({ instant: true, keepAudio: true })
    } else {
      var first = (payload.scenes || [])[0]
      this.view.sceneId = first ? first.id : null
      this.view.index = 0
      this.resetFlags()
      if (first) this.render({ instant: true })
    }
    this.updateTitleState()
  }

  Stage.prototype.text = function (key, vars) {
    return textFor(this.lang, key, vars)
  }

  /** 建一个带 data-i18n 的节点：作品语言变了可以整批刷新 */
  Stage.prototype.label = function (tag, cls, key) {
    var node = el(tag, cls, this.text(key))
    node.dataset.i18n = key
    return node
  }

  Stage.prototype.setLang = function (lang) {
    if (!lang || lang === this.lang) return
    this.lang = lang
    if (!this.app) return
    /* 只刷新纯文案节点；带变量的（如「N 个场景」）在重开面板时按当前数据重算 */
    var nodes = this.app.querySelectorAll('[data-i18n]')
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = this.text(nodes[i].getAttribute('data-i18n'))
    }
  }

  Stage.prototype.setSkin = function (skin) {
    this.app.dataset.theme = skin === 'night' ? 'night' : 'pgf'
  }

  Stage.prototype.resetFlags = function () {
    var flags = {}
    ;(this.payload.flags || []).forEach(function (def) {
      flags[def.key] = def.initial
    })
    this.view.flags = flags
  }

  Stage.prototype.assetPath = function (id) {
    if (!id) return ''
    var asset = this.payload.assets && this.payload.assets[id]
    return asset ? asset.path : ''
  }

  Stage.prototype.sceneName = function (id) {
    var scene = this.sceneMap[id]
    return scene ? scene.name : ''
  }

  Stage.prototype.currentFrame = function () {
    var scene = this.sceneMap[this.view.sceneId]
    if (!scene) return null
    return scene.frames[this.view.index] || null
  }

  /* ------------------------------------------------------------------ *
   * 渲染一帧（编辑态 instant = true，播放态走动画与逐字）
   * ------------------------------------------------------------------ */

  Stage.prototype.render = function (opts) {
    opts = opts || {}
    var frame = this.currentFrame()
    var self = this

    this.view.frame = frame
    this.stopAuto()
    this.setHint(false)

    if (!frame) {
      this.showEnd(
        {
          kind: 'ending',
          title: this.text('player.endingTitle'),
          subtitle: this.text('player.endingSubtitle'),
        },
        true,
      )
      return
    }

    if (frame.type === 'jump') {
      /* 编辑态不真的跳走：把上一句台词留在舞台上，方便对着目标场景改参数 */
      if (this.mode === 'edit') {
        var prev = this.prevLine()
        if (prev) this.applyLineFrame(prev, { instant: true })
        this.emit('frame', { sceneId: this.view.sceneId, index: this.view.index, type: 'jump' })
        return
      }
      var pass = this.testCondition(frame.requires)
      if (pass && frame.target && this.sceneMap[frame.target]) {
        this.gotoScene(frame.target, 0, opts)
      } else {
        this.view.index += 1
        this.render(opts)
      }
      return
    }

    if (frame.type === 'choice') {
      this.applyChoiceFrame(frame, opts)
      this.emit('frame', { sceneId: this.view.sceneId, index: this.view.index, type: 'choice' })
      return
    }

    if (frame.type === 'end') {
      this.showEnd(frame, false)
      this.pushHistory('', frame.subtitle || frame.title, '')
      this.emit('frame', { sceneId: this.view.sceneId, index: this.view.index, type: 'end' })
      return
    }

    this.applyLineFrame(frame, opts)
    this.emit('frame', { sceneId: this.view.sceneId, index: this.view.index, type: 'line' })
  }

  /** 当前场景中、选中帧之前最近的一句台词 */
  Stage.prototype.prevLine = function () {
    var scene = this.sceneMap[this.view.sceneId]
    if (!scene) return null
    for (var i = this.view.index - 1; i >= 0; i--) {
      var f = scene.frames[i]
      if (f && f.type === 'line') return f
    }
    return null
  }

  Stage.prototype.testCondition = function (cond) {
    if (!cond || !cond.key) return true
    return compare(this.view.flags[cond.key], cond.op, cond.value)
  }

  Stage.prototype.applyLineFrame = function (frame, opts) {
    var self = this
    var instant = !!opts.instant
    /* hold：换幕时先把舞台摆好、但不开始逐字，等幕名卡淡出后再开口 */
    var hold = !!opts.hold
    var transition = instant || hold ? 'cut' : frame.transition || 'fade'

    this.hideLayers(!!opts.keepOpening)
    this.choices.style.display = 'none'
    this.app.classList.remove('gs-choosing')
    this.dialog.style.display = ''

    /* 背景 */
    var bgPath = this.assetPath(frame.bg)
    if (this.currentBg !== frame.bg || instant) {
      this.currentBg = frame.bg
      this.swapBackground(bgPath, transition, instant)
    }

    /* 立绘 */
    this.applyCast(frame, transition, instant)

    /* 名字与台词 */
    var speaker = frame.speaker || { characterId: null, name: '' }
    var char = speaker.characterId && this.payload.characters[speaker.characterId]
    var displayName = char ? char.name : speaker.name || ''
    /*
     * 心理活动：名字牌不上台。归因没有丢，只是不写出来——
     * 立绘的亮暗（见 applyCast）与回看记录仍然按说话人走。
     */
    if (displayName && !frame.innerVoice) {
      this.dialog.dataset.hasName = 'true'
      this.nameText.textContent = displayName
      /* 写在整条名字栏上而不是字上：night 皮肤那根主题色 bar 是 .gs-name::before，
       * 只有变量落在外层，bar 才跟得上角色自己的颜色 */
      this.nameBox.style.setProperty('--gs-name-color', (char && char.color) || 'var(--gs-accent)')
    } else {
      this.dialog.dataset.hasName = 'false'
      this.nameText.textContent = ''
    }

    if (this.mode !== 'edit' && !hold)
      this.pushHistory(displayName, frame.text, (char && char.color) || '')

    if (hold) this.holdType(frame.text)
    else this.setTypewriter(frame.text, instant)

    /* 声音 */
    if (!opts.keepAudio && !instant) {
      /* 音乐换幕时就该起，音效与语音等卡片掀开再放 */
      this.setBgm(this.assetPath(frame.bgm), frame.bgm)
      if (!hold && frame.sfx) this.playOneShot('sfx', this.assetPath(frame.sfx))
      if (!hold && frame.voice) this.playOneShot('voice', this.assetPath(frame.voice))
    } else if (!opts.keepAudio && instant) {
      this.setBgm(null, null, true)
    }

    /* 演出：震屏 */
    this.plate.classList.toggle('gs-shake', !!frame.shake && !instant && transition !== 'cut')
    if (frame.shake && !instant) {
      global.setTimeout(function () {
        self.plate.classList.remove('gs-shake')
      }, 420)
    }

    if (transition === 'flash' && !instant) {
      this.flash.classList.add('gs-flash-run')
      global.setTimeout(function () {
        self.flash.classList.remove('gs-flash-run')
      }, 360)
    }

    this.view.waiting = true
    this.view.held = hold
    this.applySkipState()
    if (!instant && !hold && this.view.auto) this.scheduleAuto()
  }

  Stage.prototype.applyChoiceFrame = function (frame, opts) {
    var self = this
    var instant = !!opts.instant
    var scene = this.sceneMap[this.view.sceneId]
    var prev = null
    for (var i = this.view.index - 1; i >= 0; i--) {
      if (scene.frames[i] && scene.frames[i].type === 'line') {
        prev = scene.frames[i]
        break
      }
    }
    /*
     * 选择支没有说话人。名字栏只能通过 data-has-name 关掉，不能内联 display: none：
     * 内联样式会一直留着，切回台词帧时名字栏就再也不出现了。
     */
    this.dialog.dataset.hasName = 'false'
    /* 选择支沿用上一帧的舞台，避免黑屏 */
    if (prev) {
      this.currentBg = prev.bg
      this.swapBackground(this.assetPath(prev.bg), 'cut', true)
      this.applyCast(prev, 'cut', true)
      this.dialog.style.display = ''
      this.textBox.textContent = frame.prompt || ''
      this.textBox.classList.remove('gs-typing', 'gs-done')
    } else {
      this.textBox.textContent = frame.prompt || ''
      this.textBox.classList.remove('gs-typing', 'gs-done')
      this.dialog.style.display = frame.prompt ? '' : 'none'
    }

    clear(this.choices)
    var title = el('div', 'gs-choice-title', frame.prompt || this.text('player.choicePrompt'))
    if (frame.prompt) title.style.display = 'none'
    this.choices.appendChild(title)

    var visible = (frame.options || []).filter(function (opt) {
      return self.testCondition(opt.requires)
    })

    visible.forEach(function (opt, i) {
      var btn = el('button', 'gs-choice')
      btn.type = 'button'
      var num = el('span', 'gs-choice-index', String(i + 1).padStart(2, '0'))
      var label = el('span', 'gs-choice-text', opt.text || self.text('player.unnamedOption'))
      btn.appendChild(num)
      btn.appendChild(label)
      btn.style.animationDelay = i * 60 + 'ms'
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation()
        if (self.mode === 'edit') return
        self.pickChoice(opt, btn)
      })
      self.choices.appendChild(btn)
    })

    this.choices.style.display = 'flex'
    this.app.classList.add('gs-choosing')
    this.view.waiting = false
    if (!instant) this.stopAuto()
  }

  Stage.prototype.pickChoice = function (opt, btn) {
    var self = this
    this.exitAuto()
    if (btn) btn.classList.add('gs-choice-picked')
    this.choices.classList.add('gs-choice-locked')
    global.setTimeout(function () {
      self.choices.classList.remove('gs-choice-locked')
      if (opt.setFlags) {
        Object.keys(opt.setFlags).forEach(function (key) {
          self.view.flags[key] = opt.setFlags[key]
        })
      }
      if (opt.target && self.sceneMap[opt.target]) {
        self.gotoScene(opt.target, 0, {})
      } else {
        self.view.index += 1
        self.render({})
      }
    }, 430)
  }

  /**
   * 读取一帧里某个槽位的摆放。
   * 数值可能来自旧作品或手工改过的 data.js，一律收敛到合法范围，
   * 否则一个 NaN 就能让立绘从画面里消失。
   */
  function readTransform(raw) {
    var out = {}
    Object.keys(DEFAULT_TRANSFORM).forEach(function (key) {
      var value = Number(raw && raw[key])
      var range = TRANSFORM_RANGE[key]
      var safe = Number.isFinite(value) ? Math.min(range[1], Math.max(range[0], value)) : null
      out[key] = safe === null ? DEFAULT_TRANSFORM[key] : safe
    })
    return out
  }

  Stage.prototype.applyCast = function (frame, transition, instant) {
    var self = this
    var speakerId = frame.speaker && frame.speaker.characterId
    /*
     * 心理活动的两种台光：
     *  · 归因到某个角色 —— 是他一个人的内心，照旧只亮他（名字牌不出现而已）
     *  · 归因是空的 —— 第一人称的「我」在想，台上没有人开口，全体压暗
     */
    var allDim = !!frame.innerVoice && !speakerId
    SLOTS.forEach(function (slot) {
      var target = frame.cast ? frame.cast[slot] : null
      var node = self.slots[slot]
      if (!target) {
        node.wrap.classList.remove('gs-slot-on', 'gs-slot-speaker')
        node.img.removeAttribute('src')
        node.wrap.style.opacity = '0'
        return
      }
      var ch = self.payload.characters[target.characterId]
      var spriteId = ch && ch.sprites ? ch.sprites[target.expression] : null
      var path = self.assetPath(spriteId)
      if (!path) {
        node.wrap.classList.remove('gs-slot-on', 'gs-slot-speaker')
        node.wrap.style.opacity = '0'
        return
      }
      var changed = node.img.getAttribute('src') !== path
      if (changed) node.img.setAttribute('src', path)
      /*
       * 摆放写在 img 上，不是 wrap 上：wrap 的 transform 由 CSS 负责
       * 站位（中位要 translateX(-50%)）和进场动画，内联覆盖会把它们一起抹掉。
       * img 以脚底为原点缩放，偏移量用舞台坐标 px，跟着 .gs-frame 一起缩放。
       */
      var tf = readTransform(target.transform)
      node.img.style.transform =
        'translate(' + tf.offsetX + 'px, ' + tf.offsetY + 'px) scale(' + tf.scale / 100 + ')'
      /* 换人换图时摆放直接落位，不要把上一个人的位置「滑」成新人的 */
      node.img.style.transition = instant || changed ? 'none' : ''
      node.wrap.style.opacity = '1'
      node.wrap.classList.add('gs-slot-on')
      var speaking = !allDim && speakerId && target.characterId === speakerId
      node.wrap.classList.toggle('gs-slot-speaker', !!speaking)
      node.wrap.classList.toggle('gs-slot-dim', !speaking && (allDim || !!speakerId))
      node.wrap.dataset.char = target.characterId
      if (instant) node.wrap.style.transition = 'none'
      else node.wrap.style.transition = ''
    })
  }

  Stage.prototype.swapBackground = function (path, transition, instant) {
    var self = this
    var next = this.bgActive === 'a' ? this.bgB : this.bgA
    var prev = this.bgActive === 'a' ? this.bgA : this.bgB

    if (instant || !path || transition === 'cut') {
      next.style.transition = 'none'
      next.style.backgroundImage = path ? 'url("' + path + '")' : 'none'
      next.style.opacity = path ? '1' : '0'
      next.style.transform = 'none'
      prev.style.opacity = '0'
      this.bgActive = this.bgActive === 'a' ? 'b' : 'a'
      return
    }

    next.style.transition = 'none'
    next.style.backgroundImage = 'url("' + path + '")'
    next.style.opacity = '0'
    next.style.transform =
      transition === 'rise'
        ? 'translateY(14px) scale(1.02)'
        : transition === 'dissolve'
          ? 'scale(1.06)'
          : 'scale(1)'

    /* 强制回流，保证过渡触发 */
    void next.offsetWidth

    next.style.transition =
      transition === 'dissolve'
        ? 'opacity 900ms ease, transform 6000ms ease-out'
        : 'opacity 480ms ease, transform 480ms ease'
    next.style.opacity = '1'
    next.style.transform = 'scale(1)'
    prev.style.transition = 'opacity 480ms ease'
    prev.style.opacity = '0'
    this.bgActive = this.bgActive === 'a' ? 'b' : 'a'
    this.emit('bg', { path: path })
  }

  /* ------------------------------------------------------------------ *
   * 逐字机
   * ------------------------------------------------------------------ */

  Stage.prototype.setTypewriter = function (text, instant) {
    var self = this
    this.clearTimer('type')
    this.textBox.textContent = ''
    this.textBox.classList.remove('gs-typing', 'gs-done')
    this.typeState.full = text || ''
    this.typeState.shown = 0
    this.typeState.done = false
    this.nextMark.style.opacity = '0'

    if (instant || this.mode === 'edit') {
      this.textBox.textContent = this.typeState.full
      this.finishTyping(true)
      return
    }

    this.view.typing = true
    this.textBox.classList.add('gs-typing')
    var speed = this.view.skip ? 4 : Math.max(4, this.config.textSpeed)
    var i = 0
    var full = this.typeState.full
    this.timers.type = global.setInterval(function () {
      i += 1
      self.textBox.textContent = full.slice(0, i)
      if (i >= full.length) {
        self.clearTimer('type')
        self.finishTyping(false)
      }
    }, speed)
  }

  Stage.prototype.finishTyping = function (silent) {
    this.view.typing = false
    this.typeState.done = true
    this.typeState.shown = this.typeState.full.length
    this.textBox.classList.remove('gs-typing')
    this.textBox.classList.add('gs-done')
    this.nextMark.style.opacity = '1'
    if (!silent) {
      this.emit('typed', {})
      if (this.view.auto && !this.view.skip) this.scheduleAuto()
    }
  }

  Stage.prototype.clearTimer = function (key) {
    if (this.timers[key]) {
      global.clearInterval(this.timers[key])
      global.clearTimeout(this.timers[key])
      this.timers[key] = null
    }
  }

  Stage.prototype.scheduleAuto = function () {
    var self = this
    this.clearTimer('auto')
    var voice = this.audio.voice
    var wait = this.config.autoDelay
    if (voice && !voice.paused && voice.duration && isFinite(voice.duration)) {
      wait = Math.max(wait, (voice.duration - (voice.currentTime || 0)) * 1000 + 320)
    }
    this.timers.auto = global.setTimeout(function () {
      /* 出字还没完就不推进：停留时长从滚动结束算起，由 finishTyping 重新计时 */
      if (self.view.typing) return
      if (!self.view.auto || !self.view.waiting) return
      self.advance()
    }, wait)
  }

  Stage.prototype.stopAuto = function () {
    this.clearTimer('auto')
  }

  /**
   * 退出自动播放。自动模式下任何手动操作——点击跳过当前句、看记录、
   * 开设置、点选项——都要走这里。
   */
  Stage.prototype.exitAuto = function () {
    this.view.auto = false
    this.stopAuto()
    this.syncToolButtons()
  }

  /* ------------------------------------------------------------------ *
   * 声音
   * ------------------------------------------------------------------ */

  Stage.prototype.setBgm = function (path, id, silent) {
    if (silent) {
      this.audio.bgm.pause()
      this.audio.bgm.removeAttribute('src')
      this.currentBgm = null
      return
    }
    if (this.currentBgm === id) return
    this.currentBgm = id
    var bgm = this.audio.bgm
    if (!path) {
      bgm.pause()
      bgm.removeAttribute('src')
      return
    }
    bgm.src = path
    bgm.volume = this.config.bgmVolume
    var p = bgm.play()
    if (p && p.catch) p.catch(function () {})
  }

  Stage.prototype.playOneShot = function (channel, path) {
    var audio = this.audio[channel]
    if (!audio || !path) return
    audio.pause()
    audio.src = path
    audio.volume = channel === 'voice' ? this.config.voiceVolume : this.config.sfxVolume
    audio.currentTime = 0
    var p = audio.play()
    if (p && p.catch) p.catch(function () {})
  }

  /* ------------------------------------------------------------------ *
   * 流程控制
   * ------------------------------------------------------------------ */

  Stage.prototype.startFrom = function (sceneId, index) {
    this.hideLayers()
    this.resetActCards()
    this.app.classList.remove('gs-choosing')
    this.resetFlags()
    this.view.history = []
    this.view.historyScene = null
    this.view.running = true
    this.view.auto = false
    this.view.skip = false
    this.currentBg = undefined
    this.currentBgm = undefined
    this.setScene(sceneId, index || 0)
    this.syncToolButtons()
  }

  Stage.prototype.setScene = function (sceneId, index) {
    if (!this.sceneMap[sceneId]) {
      var first = (this.payload.scenes || [])[0]
      sceneId = first ? first.id : null
    }
    this.view.sceneId = sceneId
    this.view.index = index || 0
    this.render({})
  }

  Stage.prototype.gotoScene = function (sceneId, index, opts) {
    this.view.endCard = false
    this.view.endNext = null
    this.view.opening = null
    this.view.sceneId = sceneId
    this.view.index = index || 0
    this.render(opts || {})
  }

  Stage.prototype.showFrame = function (sceneId, index) {
    if (!this.sceneMap[sceneId]) return
    this.resetActCards()
    this.view.sceneId = sceneId
    this.view.index = index
    this.view.running = false
    this.setBgm(null, null, true)
    this.render({ instant: true })
  }

  Stage.prototype.advance = function () {
    if (this.mode === 'edit') return
    if (this.view.busy) return
    /* 幕名卡：点击掀开卡片，进入新的一幕 */
    if (this.view.opening) {
      this.dismissOpening()
      return
    }
    /* 幕末卡：点击交叉渐变到下一幕，而不是停在按钮上 */
    if (this.view.endNext) {
      this.leaveAct()
      return
    }
    if (!this.view.running) return
    var frame = this.currentFrame()
    if (!frame) return
    if (frame.type === 'choice' || frame.type === 'end') return
    if (this.view.typing) {
      this.clearTimer('type')
      this.textBox.textContent = this.typeState.full
      this.finishTyping(false)
      return
    }
    if (this.view.waiting && this.view.guardUntil && Date.now() < this.view.guardUntil) return
    this.view.index += 1
    this.view.guardUntil = Date.now() + (this.view.skip ? 20 : 60)
    this.render({})
  }

  Stage.prototype.back = function () {
    if (this.view.index <= 0) return
    this.view.index -= 1
    this.render({ instant: false })
  }

  Stage.prototype.applySkipState = function () {
    this.app.classList.toggle('gs-skipping', this.view.skip)
  }

  Stage.prototype.syncToolButtons = function () {
    var auto = this.toolButtons.auto
    if (auto) auto.classList.toggle('gs-tool-on', !!this.view.auto)
  }

  Stage.prototype.setHint = function (on) {
    if (this.hint) this.hint.style.opacity = on ? '1' : '0'
  }

  /* ------------------------------------------------------------------ *
   * 覆盖层
   * ------------------------------------------------------------------ */

  Stage.prototype.hideLayers = function (keepOpening) {
    ;[this.titleLayer, this.logLayer, this.saveLayer, this.configLayer, this.endLayer].forEach(
      function (layer) {
        layer.style.display = 'none'
      },
    )
    if (!keepOpening && this.openingLayer) {
      this.view.opening = null
      this.openingLayer.style.display = 'none'
      this.resetLayerFx(this.openingLayer)
    }
    this.app.classList.remove('gs-layer-open')
  }

  Stage.prototype.openLayer = function (layer, keepTitle) {
    if (keepTitle) {
      /* 标题界面的「关于作品」：面板叠在标题上，标题本身要留在后面当背景 */
      ;[this.logLayer, this.saveLayer, this.configLayer, this.endLayer].forEach(function (other) {
        if (other !== layer) other.style.display = 'none'
      })
      if (this.openingLayer) {
        this.openingLayer.style.display = 'none'
        this.resetLayerFx(this.openingLayer)
      }
      this.view.opening = null
    } else {
      this.hideLayers()
    }
    layer.style.display = 'flex'
    this.app.classList.add('gs-layer-open')
  }

  /** 关掉盖在标题上的面板；标题没在台前时退回原来的整层收起 */
  Stage.prototype.closeLayers = function () {
    if (this.titleLayer.style.display !== 'none') {
      ;[this.logLayer, this.saveLayer, this.configLayer].forEach(function (layer) {
        layer.style.display = 'none'
      })
      this.app.classList.remove('gs-layer-open')
      return
    }
    this.hideLayers()
  }

  Stage.prototype.buildTitle = function () {
    var self = this
    var layer = this.titleLayer
    var box = el('div', 'gs-title-inner')
    this.titleBg = el('div', 'gs-title-bg')
    var name = el('h1', 'gs-title-name')
    var sub = el('p', 'gs-title-sub')
    var menu = el('div', 'gs-title-menu')
    this.btnStart = this.label('button', 'gs-title-btn gs-title-btn-primary', 'player.start')
    this.btnContinue = this.label('button', 'gs-title-btn', 'player.continue')
    var btnAbout = this.label('button', 'gs-title-btn', 'player.about')
    ;[this.btnStart, this.btnContinue, btnAbout].forEach(function (b) {
      b.type = 'button'
      menu.appendChild(b)
    })
    var foot = el('div', 'gs-title-foot')
    this.titleFoot = foot
    box.appendChild(name)
    box.appendChild(sub)
    box.appendChild(menu)
    box.appendChild(foot)
    layer.appendChild(this.titleBg)
    layer.appendChild(box)
    this.titleName = name
    this.titleSub = sub

    this.btnStart.addEventListener('click', function (ev) {
      ev.stopPropagation()
      var first = (self.payload.scenes || [])[0]
      if (first) self.startFrom(first.id, 0)
    })
    this.btnContinue.addEventListener('click', function (ev) {
      ev.stopPropagation()
      self.loadSlot('auto')
    })
    btnAbout.addEventListener('click', function (ev) {
      ev.stopPropagation()
      self.openLog(true)
    })
  }

  Stage.prototype.updateTitleState = function () {
    if (!this.payload) return
    var meta = this.payload.meta
    this.titleName.textContent = meta.name || this.text('player.untitledWork')
    this.titleSub.textContent = (meta.title && meta.title.subtitle) || ''
    this.titleFoot.textContent = [meta.author, meta.version].filter(Boolean).join(' · ')
    var bg = meta.title && meta.title.background ? this.assetPath(meta.title.background) : ''
    this.titleBg.style.backgroundImage = bg ? 'url("' + bg + '")' : 'none'
    var saves = this.readSaves()
    this.btnContinue.style.display = saves.length ? '' : 'none'
  }

  Stage.prototype.showTitle = function () {
    if (this.mode === 'edit') return
    this.exitAuto()
    this.audio.bgm.pause()
    this.resetActCards()
    this.view.running = false
    this.updateTitleState()
    this.openLayer(this.titleLayer)
    this.emit('title', {})
  }

  Stage.prototype.showEnd = function (frame, placeholder) {
    var self = this
    this.stopAuto()
    this.view.running = false
    this.view.endNext = null
    var layer = this.endLayer
    clear(layer)
    this.resetLayerFx(layer)
    var box = el('div', 'gs-end-inner')
    var kicker = el(
      'div',
      'gs-end-kicker',
      placeholder
        ? this.text('player.kickerPreview')
        : frame.kind === 'ending'
          ? this.text('player.kickerEnding')
          : this.text('player.kickerChapter'),
    )
    var title = el('h2', 'gs-end-title', frame.title || '—')
    var sub = el('p', 'gs-end-sub', frame.subtitle || '')

    if (!placeholder && this.payload.meta.name && this.payload.meta.name !== frame.title) {
      var brand = el('div', 'gs-end-brand', this.payload.meta.name)
      box.appendChild(brand)
    }
    box.appendChild(kicker)
    box.appendChild(title)
    box.appendChild(sub)

    /*
     * 幕末卡只做两件事：
     *  - 有下一幕：不给按钮，任意处点击交叉渐变过去；
     *  - 全线的最后：只留「回到标题」。
     * 编辑态只把这一帧画出来，不提供任何动作。
     */
    if (this.mode !== 'edit') {
      var next = !placeholder && frame.next && this.sceneMap[frame.next] ? frame.next : null
      if (next) {
        this.view.endNext = next
        box.appendChild(this.label('div', 'gs-end-hint', 'player.hint'))
      } else {
        var menu = el('div', 'gs-end-menu')
        var btnTitle = this.label('button', 'gs-title-btn', 'player.backToTitle')
        btnTitle.type = 'button'
        btnTitle.addEventListener('click', function (ev) {
          ev.stopPropagation()
          self.showTitle()
        })
        menu.appendChild(btnTitle)
        box.appendChild(menu)
      }
    }

    layer.appendChild(box)
    this.openLayer(layer)
    this.view.endCard = this.mode !== 'edit'
  }

  /* ---------------------------------------------------------------- 跨幕 */

  Stage.prototype.firstLineOf = function (scene) {
    if (!scene) return null
    for (var i = 0; i < scene.frames.length; i++) {
      if (scene.frames[i] && scene.frames[i].type === 'line') return scene.frames[i]
    }
    return null
  }

  Stage.prototype.resetLayerFx = function (layer) {
    if (!layer) return
    layer.style.opacity = ''
    layer.style.transition = ''
  }

  /** 清掉幕末卡 / 幕名卡残留的一切状态，回到干净的播放态 */
  Stage.prototype.resetActCards = function () {
    this.view.endCard = false
    this.view.endNext = null
    this.view.opening = null
    this.view.busy = false
    this.view.held = false
    this.clearTimer('fade')
    if (this.openingLayer) {
      this.openingLayer.style.display = 'none'
      this.resetLayerFx(this.openingLayer)
    }
    if (this.endLayer) this.resetLayerFx(this.endLayer)
  }

  /**
   * 幕末卡 → 下一幕幕名卡。
   * 两张卡上下叠着，幕名卡淡入、幕末卡同时淡出，这就是交叉渐变；
   * 舞台本身不动，等幕名卡退场时才切到新的一幕。
   */
  Stage.prototype.leaveAct = function () {
    var self = this
    var nextId = this.view.endNext
    if (!nextId || this.view.busy || this.mode === 'edit') return
    var scene = this.sceneMap[nextId]
    if (!scene) {
      this.view.endNext = null
      return
    }

    this.view.endNext = null
    this.view.endCard = false
    this.view.busy = true
    /* 换幕不是结束：后面的点击必须继续能推动剧情 */
    this.view.running = true

    var first = this.firstLineOf(scene)
    var bg = first ? this.assetPath(first.bg) : ''
    this.openingTitle.textContent = scene.name || ''
    this.openingBg.style.backgroundImage = bg ? 'url("' + bg + '")' : 'none'

    this.openingLayer.style.display = 'flex'
    this.openingLayer.style.transition = 'none'
    this.openingLayer.style.opacity = '0'
    void this.openingLayer.offsetWidth
    this.openingLayer.style.transition = 'opacity 640ms ease'
    this.openingLayer.style.opacity = '1'
    this.endLayer.style.transition = 'opacity 640ms ease'
    this.endLayer.style.opacity = '0'
    this.view.opening = nextId

    this.timers.fade = global.setTimeout(function () {
      self.resetLayerFx(self.endLayer)
      self.endLayer.style.display = 'none'
      self.view.busy = false
    }, 660)
  }

  /**
   * 幕名卡 → 新的一幕。
   * 卡片还在淡出时，先在它背后把背景、立绘、音乐与名字都摆好；
   * 等卡片完全退场，再让第一句开始逐字。这样看到的才是同一张背景的交叉渐变，
   * 而不是先露出上一幕、再突然换景。
   */
  Stage.prototype.dismissOpening = function () {
    var self = this
    var nextId = this.view.opening
    if (!nextId || this.view.busy || this.mode === 'edit') return
    if (!this.sceneMap[nextId]) {
      this.view.opening = null
      return
    }

    this.view.busy = true
    this.view.sceneId = nextId
    this.view.index = 0
    this.render({ hold: true, keepOpening: true })

    this.openingLayer.style.transition = 'opacity 560ms ease'
    this.openingLayer.style.opacity = '0'
    this.timers.fade = global.setTimeout(function () {
      self.openingLayer.style.display = 'none'
      self.resetLayerFx(self.openingLayer)
      self.view.opening = null
      self.view.busy = false
      self.releaseHeld()
    }, 580)
  }

  /** 卡片掀开后再开口：补上逐字、音效、语音与台词记录 */
  Stage.prototype.releaseHeld = function () {
    if (!this.view.held) return
    this.view.held = false
    var frame = this.currentFrame()
    if (!frame || frame.type !== 'line') {
      /* 选择支之类的帧在 hold 时已经完整渲染好了，不需要补 */
      this.view.waiting = true
      return
    }
    var speaker = frame.speaker || { characterId: null, name: '' }
    var char = speaker.characterId && this.payload.characters[speaker.characterId]
    var displayName = char ? char.name : speaker.name || ''
    this.pushHistory(displayName, frame.text, (char && char.color) || '')
    this.setTypewriter(frame.text, false)
    if (frame.sfx) this.playOneShot('sfx', this.assetPath(frame.sfx))
    if (frame.voice) this.playOneShot('voice', this.assetPath(frame.voice))
    this.view.waiting = true
    this.applySkipState()
  }

  /** 只摆台、不开口：台词留到幕名卡退场之后 */
  Stage.prototype.holdType = function (text) {
    this.clearTimer('type')
    this.textBox.textContent = ''
    this.textBox.classList.remove('gs-typing', 'gs-done')
    this.nextMark.style.opacity = '0'
    this.typeState.full = text || ''
    this.typeState.shown = 0
    this.typeState.done = false
    this.view.typing = false
  }

  Stage.prototype.openLog = function (aboutMode) {
    var self = this
    var layer = this.logLayer
    /* 标题界面的「关于作品」：标题在场时，面板要叠在标题上，而不是把标题藏掉露出游戏画面 */
    var overTitle = !!aboutMode && this.titleLayer.style.display !== 'none'
    clear(layer)
    var panel = el('div', 'gs-sheet gs-log-sheet')
    var head = el('div', 'gs-sheet-head')
    var title = el(
      'h3',
      'gs-sheet-title',
      aboutMode ? this.text('player.about') : this.text('player.backlog'),
    )
    var close = el('button', 'gs-close', '✕')
    close.type = 'button'
    head.appendChild(title)
    head.appendChild(close)
    panel.appendChild(head)

    if (aboutMode) {
      var about = el('div', 'gs-about')
      about.appendChild(el('h4', '', this.payload.meta.name || this.text('player.untitledWork')))
      about.appendChild(el('p', 'gs-about-sub', this.payload.meta.description || ''))
      var rows = [
        ['player.aboutAuthor', this.payload.meta.author || this.text('player.unknown')],
        ['player.aboutVersion', this.payload.meta.version || '1.0.0'],
        ['player.aboutEngine', 'Galastar Runtime ' + VERSION],
        [
          'player.aboutScenes',
          this.text('player.scenesCount', { n: (this.payload.scenes || []).length }),
        ],
      ]
      var table = el('div', 'gs-about-table')
      rows.forEach(function (row) {
        var line = el('div', 'gs-about-row')
        line.appendChild(el('span', 'gs-about-key', self.text(row[0])))
        line.appendChild(el('span', 'gs-about-val', row[1]))
        table.appendChild(line)
      })
      about.appendChild(table)
      panel.appendChild(about)
    } else {
      var body = el('div', 'gs-log-body')
      if (!this.view.history.length)
        body.appendChild(el('p', 'gs-empty', this.text('player.noHistory')))
      this.view.history.forEach(function (item) {
        var row = el('div', 'gs-log-row')
        if (item.name) {
          var nameNode = el('span', 'gs-log-name', item.name)
          if (item.color && self.app.dataset.theme === 'night') nameNode.style.color = item.color
          row.appendChild(nameNode)
        }
        row.appendChild(el('span', 'gs-log-text', item.text))
        body.appendChild(row)
      })
      panel.appendChild(body)
      global.setTimeout(function () {
        body.scrollTop = body.scrollHeight
      }, 0)
    }
    close.addEventListener('click', function (ev) {
      ev.stopPropagation()
      self.closeLayers()
    })
    layer.appendChild(panel)
    this.openLayer(layer, overTitle)
  }

  /* ---------------------------- 存档 ---------------------------- */

  Stage.prototype.saveKey = function () {
    var id = this.payload && this.payload.meta ? this.payload.meta.id : 'draft'
    return STORE_SAVE + (id || 'default')
  }

  Stage.prototype.readSaves = function () {
    var all = readJSON(this.saveKey(), {})
    return Object.keys(all)
      .map(function (k) {
        return all[k]
      })
      .sort(function (a, b) {
        return b.savedAt - a.savedAt
      })
  }

  Stage.prototype.writeSave = function (slot) {
    var all = readJSON(this.saveKey(), {})
    var frame = this.currentFrame()
    var scene = this.sceneMap[this.view.sceneId]
    all[slot] = {
      slot: slot,
      savedAt: Date.now(),
      sceneId: this.view.sceneId,
      sceneName: scene ? scene.name : '',
      index: this.view.index,
      flags: this.view.flags,
      /* 记录只属于本幕：读档时据此判断这批台词还能不能用 */
      historyScene: this.view.sceneId,
      history: this.view.history.slice(-60),
      excerpt: frame && frame.type === 'line' ? frame.text.slice(0, 40) : '',
    }
    writeJSON(this.saveKey(), all)
    this.emit('save', { slot: slot })
  }

  Stage.prototype.loadSlot = function (slot) {
    var all = readJSON(this.saveKey(), {})
    var data = slot === 'auto' ? this.readSaves()[0] : all[slot]
    if (!data) return
    this.resetActCards()
    this.hideLayers()
    this.view.running = true
    this.view.sceneId = data.sceneId
    this.view.index = data.index
    this.view.flags = Object.assign({}, data.flags)
    /* 记录只保留本幕的台词；旧存档没有 historyScene，跨幕的直接清空 */
    this.view.history = data.historyScene === data.sceneId ? data.history || [] : []
    this.view.historyScene = data.sceneId
    this.currentBg = undefined
    this.currentBgm = undefined
    this.render({})
  }

  Stage.prototype.buildSave = function () {
    var self = this
    var layer = this.saveLayer
    var panel = el('div', 'gs-sheet gs-save-sheet')
    var head = el('div', 'gs-sheet-head')
    head.appendChild(el('h3', 'gs-sheet-title', this.text('player.saveLoad')))
    var close = el('button', 'gs-close', '✕')
    close.type = 'button'
    head.appendChild(close)
    panel.appendChild(head)

    var tabs = el('div', 'gs-tabs')
    var tabSave = this.label('button', 'gs-tab gs-tab-on', 'player.tabSave')
    var tabLoad = this.label('button', 'gs-tab', 'player.tabLoad')
    tabSave.type = 'button'
    tabLoad.type = 'button'
    tabs.appendChild(tabSave)
    tabs.appendChild(tabLoad)
    panel.appendChild(tabs)

    var grid = el('div', 'gs-save-grid')
    panel.appendChild(grid)
    this.saveGrid = grid

    var mode = { value: 'save' }
    var paint = function () {
      clear(grid)
      var saves = {}
      self.readSaves().forEach(function (s) {
        saves[s.slot] = s
      })
      tabSave.classList.toggle('gs-tab-on', mode.value === 'save')
      tabLoad.classList.toggle('gs-tab-on', mode.value === 'load')
      for (var i = 1; i <= 6; i++) {
        ;(function (slotNo) {
          var s = saves['s' + slotNo]
          var card = el('button', 'gs-save-slot')
          card.type = 'button'
          var no = el('div', 'gs-save-no', self.text('player.slotLabel') + pad2(slotNo))
          var main = el('div', 'gs-save-main')
          if (s) {
            main.appendChild(
              el('div', 'gs-save-scene', s.sceneName || self.text('player.saveFallbackScene')),
            )
            main.appendChild(
              el('div', 'gs-save-excerpt', s.excerpt || self.text('player.noExcerpt')),
            )
            main.appendChild(el('div', 'gs-save-time', stamp(s.savedAt)))
          } else {
            main.appendChild(el('div', 'gs-save-empty', self.text('player.emptySlot')))
          }
          card.appendChild(no)
          card.appendChild(main)
          if (mode.value === 'load' && !s) card.disabled = true
          card.addEventListener('click', function (ev) {
            ev.stopPropagation()
            if (mode.value === 'save') {
              self.writeSave('s' + slotNo)
              paint()
            } else if (s) {
              self.loadSlot('s' + slotNo)
            }
          })
          grid.appendChild(card)
        })(i)
      }
    }
    tabSave.addEventListener('click', function (ev) {
      ev.stopPropagation()
      mode.value = 'save'
      paint()
    })
    tabLoad.addEventListener('click', function (ev) {
      ev.stopPropagation()
      mode.value = 'load'
      paint()
    })
    close.addEventListener('click', function (ev) {
      ev.stopPropagation()
      self.closeLayers()
    })
    layer.appendChild(panel)
    this.paintSaves = paint
    paint()
  }

  Stage.prototype.buildConfig = function () {
    var self = this
    var layer = this.configLayer
    var panel = el('div', 'gs-sheet gs-config-sheet')
    var head = el('div', 'gs-sheet-head')
    head.appendChild(el('h3', 'gs-sheet-title', this.text('player.settings')))
    var close = el('button', 'gs-close', '✕')
    close.type = 'button'
    head.appendChild(close)
    panel.appendChild(head)

    var body = el('div', 'gs-config-body')
    var fields = [
      {
        key: 'textSpeed',
        labelKey: 'player.textSpeed',
        min: 8,
        max: 90,
        step: 2,
        invert: true,
        fmt: function (v) {
          return v <= 12
            ? self.text('player.speedFastest')
            : v <= 30
              ? self.text('player.speedFast')
              : v <= 55
                ? self.text('player.speedNormal')
                : self.text('player.speedSlow')
        },
      },
      {
        key: 'autoDelay',
        labelKey: 'player.autoDelay',
        min: 200,
        max: 4000,
        step: 100,
        fmt: function (v) {
          return (v / 1000).toFixed(1) + ' s'
        },
      },
      {
        key: 'bgmVolume',
        labelKey: 'player.bgmVolume',
        min: 0,
        max: 1,
        step: 0.05,
        fmt: function (v) {
          return Math.round(v * 100) + '%'
        },
      },
      {
        key: 'voiceVolume',
        labelKey: 'player.voiceVolume',
        min: 0,
        max: 1,
        step: 0.05,
        fmt: function (v) {
          return Math.round(v * 100) + '%'
        },
      },
      {
        key: 'sfxVolume',
        labelKey: 'player.sfxVolume',
        min: 0,
        max: 1,
        step: 0.05,
        fmt: function (v) {
          return Math.round(v * 100) + '%'
        },
      },
    ]
    fields.forEach(function (f) {
      var row = el('label', 'gs-config-row')
      var label = el('span', 'gs-config-label', self.text(f.labelKey))
      var value = el('span', 'gs-config-value', f.fmt(self.config[f.key]))
      var input = el('input', 'gs-range')
      input.type = 'range'
      input.min = String(f.min)
      input.max = String(f.max)
      input.step = String(f.step)
      input.value = String(self.config[f.key])
      input.addEventListener('input', function () {
        var v = parseFloat(input.value)
        self.config[f.key] = v
        value.textContent = f.fmt(v)
        self.audio.bgm.volume = self.config.bgmVolume
        self.audio.sfx.volume = self.config.sfxVolume
        self.audio.voice.volume = self.config.voiceVolume
        writeJSON(STORE_CONFIG, self.config)
      })
      input.addEventListener('click', function (ev) {
        ev.stopPropagation()
      })
      var top = el('div', 'gs-config-top')
      top.appendChild(label)
      top.appendChild(value)
      row.appendChild(top)
      row.appendChild(input)
      body.appendChild(row)
    })

    var actions = el('div', 'gs-config-actions')
    var btnFs = this.label('button', 'gs-title-btn', 'player.toggleFullscreen')
    btnFs.type = 'button'
    btnFs.addEventListener('click', function (ev) {
      ev.stopPropagation()
      self.toggleFullscreen()
    })
    var btnBack = this.label('button', 'gs-title-btn', 'player.backToTitle')
    btnBack.type = 'button'
    btnBack.addEventListener('click', function (ev) {
      ev.stopPropagation()
      self.showTitle()
    })
    actions.appendChild(btnFs)
    actions.appendChild(btnBack)
    body.appendChild(actions)
    panel.appendChild(body)
    close.addEventListener('click', function (ev) {
      ev.stopPropagation()
      self.closeLayers()
    })
    layer.appendChild(panel)
  }

  Stage.prototype.toggleFullscreen = function () {
    var doc = global.document
    if (!doc.fullscreenElement) {
      var target = doc.documentElement
      if (target.requestFullscreen) target.requestFullscreen()
    } else if (doc.exitFullscreen) {
      doc.exitFullscreen()
    }
  }

  /* ------------------------------------------------------------------ *
   * 事件绑定
   * ------------------------------------------------------------------ */

  Stage.prototype.bind = function () {
    var self = this
    var onFrameClick = function (ev) {
      if (self.mode === 'edit') return
      if (
        ev.target.closest('.gs-toolbar') ||
        ev.target.closest('.gs-choice') ||
        ev.target.closest('.gs-layer')
      )
        return
      if (self.app.classList.contains('gs-layer-open')) return
      self.exitAuto()
      self.advance()
    }
    this.frame.addEventListener('click', onFrameClick)
    this.onFrameClick = onFrameClick

    /*
     * 幕末卡与幕名卡自己就是按钮：整张卡任意处点击都算继续。
     * 它们盖住了舞台，所以不会和上面的 onFrameClick 抢事件。
     */
    this.endLayer.addEventListener('click', function (ev) {
      if (self.mode === 'edit' || self.view.busy || !self.view.endNext) return
      ev.stopPropagation()
      self.exitAuto()
      self.leaveAct()
    })
    this.openingLayer.addEventListener('click', function (ev) {
      if (self.mode === 'edit' || self.view.busy) return
      ev.stopPropagation()
      self.exitAuto()
      self.dismissOpening()
    })

    this.toolButtons.auto.addEventListener('click', function (ev) {
      ev.stopPropagation()
      self.view.auto = !self.view.auto
      if (!self.view.auto) self.stopAuto()
      self.syncToolButtons()
      if (self.view.auto && self.typeState.done && self.view.running) self.scheduleAuto()
    })
    this.toolButtons.log.addEventListener('click', function (ev) {
      ev.stopPropagation()
      self.exitAuto()
      self.openLog(false)
    })
    this.toolButtons.save.addEventListener('click', function (ev) {
      ev.stopPropagation()
      self.exitAuto()
      self.openLayer(self.saveLayer)
      if (self.paintSaves) self.paintSaves()
    })
    this.toolButtons.config.addEventListener('click', function (ev) {
      ev.stopPropagation()
      self.exitAuto()
      self.openLayer(self.configLayer)
    })

    this.onKey = function (ev) {
      if (self.mode === 'edit') return
      if (ev.target && /input|textarea|select/i.test(ev.target.tagName)) return
      var key = ev.key
      if (key === 'Escape') {
        /* 幕末卡 / 幕名卡不能被设置面板顶掉 */
        if (self.view.endCard || self.view.opening) return
        if (self.app.classList.contains('gs-layer-open')) self.closeLayers()
        else {
          self.exitAuto()
          self.openLayer(self.configLayer)
        }
        return
      }
      if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
        ev.preventDefault()
        if (
          self.app.classList.contains('gs-layer-open') &&
          !self.view.endNext &&
          !self.view.opening
        )
          return
        self.exitAuto()
        self.advance()
        return
      }
      /* 卡片在台前时，其余快捷键让位给「点击继续」 */
      if (self.view.endCard || self.view.opening) return
      if (key === 'l' || key === 'L') {
        self.exitAuto()
        self.openLog(false)
      }
      if (key === 's' || key === 'S') {
        self.exitAuto()
        self.openLayer(self.saveLayer)
        if (self.paintSaves) self.paintSaves()
      }
      if (key === 'a' || key === 'A') {
        self.view.auto = !self.view.auto
        if (!self.view.auto) self.stopAuto()
        self.syncToolButtons()
        if (self.view.auto && self.typeState.done && self.view.running) self.scheduleAuto()
      }
      if (key === 'f' || key === 'F') self.toggleFullscreen()
      if (key === 'Control') {
        self.exitAuto()
        self.view.skip = true
        self.syncToolButtons()
        self.applySkipState()
        self.fastForward()
      }
    }
    this.onKeyUp = function (ev) {
      if (ev.key === 'Control') {
        self.view.skip = false
        self.syncToolButtons()
        self.applySkipState()
      }
    }
    global.addEventListener('keydown', this.onKey)
    global.addEventListener('keyup', this.onKeyUp)
    this.disposers.push(function () {
      global.removeEventListener('keydown', self.onKey)
      global.removeEventListener('keyup', self.onKeyUp)
    })
  }

  Stage.prototype.fastForward = function () {
    var self = this
    if (!this.view.running) return
    var guard = 0
    var tick = function () {
      if (!self.view.skip || !self.view.running || guard++ > 2000) return
      var frame = self.currentFrame()
      /* 撞上选择或结局就自动停下，避免空转 */
      if (frame && (frame.type === 'choice' || frame.type === 'end')) {
        self.view.skip = false
        self.syncToolButtons()
        self.applySkipState()
        return
      }
      self.advance()
      if (self.view.skip) global.setTimeout(tick, 16)
    }
    tick()
  }

  /* ------------------------------------------------------------------ *
   * 其他
   * ------------------------------------------------------------------ */

  Stage.prototype.pushHistory = function (name, text, color) {
    if (!text) return
    /* 记录只属于当前这一幕：换幕后从第一句重新开始记 */
    if (this.view.historyScene !== this.view.sceneId) {
      this.view.history = []
      this.view.historyScene = this.view.sceneId
    }
    var last = this.view.history[this.view.history.length - 1]
    if (last && last.text === text && last.name === name) return
    this.view.history.push({ name: name, text: text, color: color || '' })
    if (this.view.history.length > 300) this.view.history.shift()
  }

  Stage.prototype.emit = function (type, detail) {
    if (this.onEvent) this.onEvent(type, detail, this)
  }

  Stage.prototype.dispose = function () {
    this.clearTimer('type')
    this.clearTimer('auto')
    this.clearTimer('fade')
    this.stopAuto()
    Object.keys(this.audio || {}).forEach(function (k) {
      var a = this.audio[k]
      if (a) {
        a.pause()
        a.removeAttribute('src')
      }
    }, this)
    ;(this.disposers || []).forEach(function (fn) {
      try {
        fn()
      } catch (e) {
        /* noop */
      }
    })
    this.disposers = []
    clear(this.root)
  }

  /* ------------------------------------------------------------------ *
   * 对外接口
   * ------------------------------------------------------------------ */

  function create(root, payload, options) {
    return new Stage(root, payload, options)
  }

  function boot(payload, options) {
    options = options || {}
    var root =
      options.root || global.document.getElementById('galastar-root') || global.document.body
    var stage = new Stage(root, payload, options)
    if (options.autostart !== false) {
      var meta = payload.meta || {}
      if (meta.title && meta.title.enabled) stage.showTitle()
      else {
        var first = (payload.scenes || [])[0]
        if (first) stage.startFrom(first.id, 0)
      }
    }
    global.GALASTAR_STAGE = stage
    return stage
  }

  global.Galastar = {
    version: VERSION,
    create: create,
    boot: boot,
  }
})(typeof window !== 'undefined' ? window : this)

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AssetKind, AssetRecord, Frame, FrameType, Project, Scene } from '@/lib/types'
import {
  createChoiceFrame,
  createEndFrame,
  createJumpFrame,
  createLineFrame,
  createScene,
  previousLineFrame,
} from '@/lib/project'
import { deleteBlob, readProject, writeProject } from '@/lib/db'
import { importAssetFile, loadAssetUrls, revokeAssetUrls } from '@/lib/assets'
import { uid } from '@/lib/utils'

export type PreviewMode = 'edit' | 'play' | 'title'

interface EditorApi {
  project: Project
  assetUrls: Record<string, string>
  scene: Scene
  sceneId: string
  frameId: string | null
  frame: Frame | null
  mode: PreviewMode
  dirty: boolean
  saving: boolean

  selectScene: (id: string) => void
  selectFrame: (id: string | null) => void
  setMode: (mode: PreviewMode) => void

  mutate: (change: (draft: Project) => void, coalesceKey?: string) => void
  patchMeta: (patch: Partial<Project['meta']>) => void
  patchFrame: (id: string, patch: Partial<Frame>, coalesceKey?: string) => void
  addFrame: (type: FrameType) => void
  removeFrame: (id: string) => void
  duplicateFrame: (id: string) => void
  moveFrame: (id: string, delta: number) => void

  addScene: () => void
  patchScene: (id: string, patch: Partial<Scene>) => void
  removeScene: (id: string) => void
  moveScene: (id: string, delta: number) => void

  addAssets: (files: File[], kind: AssetKind) => Promise<void>
  removeAsset: (id: string) => void

  saveNow: () => Promise<void>
  close: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

const EditorContext = createContext<EditorApi | null>(null)

export function useEditor(): EditorApi {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor 必须在 EditorProvider 内使用')
  return ctx
}

export function EditorProvider({
  projectId,
  onExit,
  children,
}: {
  projectId: string
  onExit: () => void
  children: ReactNode
}) {
  const [project, setProject] = useState<Project | null>(null)
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const [sceneId, setSceneId] = useState('')
  const [frameId, setFrameId] = useState<string | null>(null)
  const [mode, setMode] = useState<PreviewMode>('edit')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const urlsRef = useRef<Record<string, string>>({})
  const saveTimer = useRef<number | null>(null)
  const latest = useRef<Project | null>(null)

  /* ------------------------------- 载入 ------------------------------- */

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const loaded = await readProject(projectId)
      if (cancelled) return
      if (!loaded) {
        onExit()
        return
      }
      const urls = await loadAssetUrls(projectId, loaded.assets)
      if (cancelled) {
        revokeAssetUrls(urls)
        return
      }
      revokeAssetUrls(urlsRef.current)
      urlsRef.current = urls
      setAssetUrls(urls)
      setProject(loaded)
      latest.current = loaded
      setSceneId(loaded.scenes[0]?.id ?? '')
      setFrameId(loaded.scenes[0]?.frames[0]?.id ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, onExit])

  useEffect(
    () => () => {
      revokeAssetUrls(urlsRef.current)
      urlsRef.current = {}
    },
    [],
  )

  /* ------------------------------ 自动保存 ------------------------------ */

  const flush = useCallback(async () => {
    const current = latest.current
    if (!current) return
    setSaving(true)
    try {
      await writeProject(current)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }, [])

  useEffect(() => {
    if (!project || !dirty) return
    latest.current = project
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => void flush(), 650)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [project, dirty, flush])

  /* ------------------------------- 变更 ------------------------------- */

  /** 撤销栈：每次变更把旧快照压栈，最多保留 80 步 */
  const past = useRef<Project[]>([])
  const future = useRef<Project[]>([])
  const [historyTick, setHistoryTick] = useState(0)
  /**
   * 连续输入（拖滑杆、按住微调）会在一瞬间产生上百次变更，
   * 逐次压栈会把 80 步历史全部吃掉，撤销一次也退不回原位。
   * 带同一个 key 的连续变更只压第一次，其余并入同一步。
   */
  const coalesceKey = useRef<string | null>(null)

  const mutate = useCallback((change: (draft: Project) => void, key?: string) => {
    const prev = latest.current
    if (!prev) return
    const draft = structuredClone(prev)
    change(draft)
    draft.meta.updatedAt = Date.now()
    if (!key || key !== coalesceKey.current) {
      past.current.push(prev)
      if (past.current.length > 80) past.current.shift()
    }
    coalesceKey.current = key ?? null
    future.current = []
    latest.current = draft
    setProject(draft)
    setDirty(true)
    setHistoryTick((t) => t + 1)
  }, [])

  const restore = useCallback(
    (target: Project) => {
      latest.current = target
      setProject(target)
      setDirty(true)
      // 撤销 / 重做后，下一次同 key 的输入应该开新的一步
      coalesceKey.current = null
      setHistoryTick((t) => t + 1)
      const scene = target.scenes.find((s) => s.id === sceneId) ?? target.scenes[0] ?? null
      if (!scene) return
      if (scene.id !== sceneId) setSceneId(scene.id)
      const hasFrame = scene.frames.some((f) => f.id === frameId)
      if (!hasFrame) setFrameId(scene.frames[0]?.id ?? null)
    },
    [sceneId, frameId],
  )

  const undo = useCallback(() => {
    const prev = past.current.pop()
    if (!prev) return
    if (latest.current) future.current.push(latest.current)
    restore(prev)
  }, [restore])

  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next) return
    if (latest.current) past.current.push(latest.current)
    restore(next)
  }, [restore])

  const scene = useMemo(() => {
    if (!project) return null
    return project.scenes.find((s) => s.id === sceneId) ?? project.scenes[0] ?? null
  }, [project, sceneId])

  const frame = useMemo(() => {
    if (!scene) return null
    return scene.frames.find((f) => f.id === frameId) ?? null
  }, [scene, frameId])

  const patchMeta = useCallback(
    (patch: Partial<Project['meta']>) => {
      mutate((draft) => {
        Object.assign(draft.meta, patch)
      })
    },
    [mutate],
  )

  const patchFrame = useCallback(
    (id: string, patch: Partial<Frame>, key?: string) => {
      mutate((draft) => {
        for (const sc of draft.scenes) {
          const target = sc.frames.find((f) => f.id === id)
          if (target) {
            Object.assign(target, patch)
            return
          }
        }
      }, key)
    },
    [mutate],
  )

  const addFrame = useCallback(
    (type: FrameType) => {
      if (!scene) return
      const index = frameId
        ? scene.frames.findIndex((f) => f.id === frameId)
        : scene.frames.length - 1
      const at = index < 0 ? scene.frames.length : index + 1
      const prevLine = previousLineFrame(scene, at)
      const next: Frame =
        type === 'line'
          ? createLineFrame(prevLine)
          : type === 'choice'
            ? createChoiceFrame()
            : type === 'jump'
              ? createJumpFrame()
              : createEndFrame()
      mutate((draft) => {
        const sc = draft.scenes.find((s) => s.id === scene.id)
        if (!sc) return
        sc.frames.splice(at, 0, next)
      })
      setFrameId(next.id)
    },
    [mutate, scene, frameId],
  )

  const removeFrame = useCallback(
    (id: string) => {
      if (!scene) return
      const index = scene.frames.findIndex((f) => f.id === id)
      const neighbour = scene.frames[index + 1] ?? scene.frames[index - 1] ?? null
      mutate((draft) => {
        const sc = draft.scenes.find((s) => s.id === scene.id)
        if (!sc) return
        sc.frames = sc.frames.filter((f) => f.id !== id)
      })
      setFrameId(neighbour ? neighbour.id : null)
    },
    [mutate, scene],
  )

  const duplicateFrame = useCallback(
    (id: string) => {
      if (!scene) return
      const index = scene.frames.findIndex((f) => f.id === id)
      if (index < 0) return
      const clone = structuredClone(scene.frames[index]) as Frame
      clone.id = uid('f')
      if (clone.type === 'choice') {
        clone.options = clone.options.map((o) => ({ ...o, id: uid('o') }))
      }
      mutate((draft) => {
        const sc = draft.scenes.find((s) => s.id === scene.id)
        if (!sc) return
        sc.frames.splice(index + 1, 0, clone)
      })
      setFrameId(clone.id)
    },
    [mutate, scene],
  )

  const moveFrame = useCallback(
    (id: string, delta: number) => {
      if (!scene) return
      const index = scene.frames.findIndex((f) => f.id === id)
      const to = index + delta
      if (index < 0 || to < 0 || to >= scene.frames.length) return
      mutate((draft) => {
        const sc = draft.scenes.find((s) => s.id === scene.id)
        if (!sc) return
        const [item] = sc.frames.splice(index, 1)
        sc.frames.splice(to, 0, item)
      })
    },
    [mutate, scene],
  )

  const addScene = useCallback(() => {
    const next = createScene(`新场景 ${(project?.scenes.length ?? 0) + 1}`)
    mutate((draft) => {
      draft.scenes.push(next)
    })
    setSceneId(next.id)
    setFrameId(next.frames[0]?.id ?? null)
  }, [mutate, project?.scenes.length])

  const patchScene = useCallback(
    (id: string, patch: Partial<Scene>) => {
      mutate((draft) => {
        const target = draft.scenes.find((s) => s.id === id)
        if (target) Object.assign(target, patch)
      })
    },
    [mutate],
  )

  const removeScene = useCallback(
    (id: string) => {
      if (!project) return
      const remaining = project.scenes.filter((s) => s.id !== id)
      if (!remaining.length) return
      mutate((draft) => {
        draft.scenes = draft.scenes.filter((s) => s.id !== id)
        /* 清理指向被删场景的死链 */
        for (const sc of draft.scenes) {
          for (const f of sc.frames) {
            if (f.type === 'choice') {
              for (const o of f.options) if (o.target === id) o.target = null
            }
            if (f.type === 'jump' && f.target === id) f.target = null
            if (f.type === 'end' && f.next === id) f.next = null
          }
        }
      })
      if (sceneId === id) {
        setSceneId(remaining[0].id)
        setFrameId(remaining[0].frames[0]?.id ?? null)
      }
    },
    [mutate, project, sceneId],
  )

  const moveScene = useCallback(
    (id: string, delta: number) => {
      if (!project) return
      const index = project.scenes.findIndex((s) => s.id === id)
      const to = index + delta
      if (index < 0 || to < 0 || to >= project.scenes.length) return
      mutate((draft) => {
        const [item] = draft.scenes.splice(index, 1)
        draft.scenes.splice(to, 0, item)
      })
    },
    [mutate, project],
  )

  /* ------------------------------- 素材 ------------------------------- */

  const addAssets = useCallback(
    async (files: File[], kind: AssetKind) => {
      if (!project) return
      const records: AssetRecord[] = []
      const urls: Record<string, string> = {}
      let existing = [...project.assets]
      for (const file of files) {
        const record = await importAssetFile(project.meta.id, file, kind, existing)
        existing = [...existing, record]
        records.push(record)
        urls[record.id] = URL.createObjectURL(file)
      }
      urlsRef.current = { ...urlsRef.current, ...urls }
      setAssetUrls((prev) => ({ ...prev, ...urls }))
      mutate((draft) => {
        draft.assets.push(...records)
      })
    },
    [mutate, project],
  )

  const removeAsset = useCallback(
    (id: string) => {
      if (!project) return
      void deleteBlob(project.meta.id, id)
      const url = urlsRef.current[id]
      if (url) {
        URL.revokeObjectURL(url)
        const next = { ...urlsRef.current }
        delete next[id]
        urlsRef.current = next
        setAssetUrls(next)
      }
      mutate((draft) => {
        draft.assets = draft.assets.filter((a) => a.id !== id)
        draft.characters.forEach((c) => {
          Object.keys(c.sprites).forEach((expr) => {
            if (c.sprites[expr] === id) delete c.sprites[expr]
          })
        })
        if (draft.meta.title.background === id) draft.meta.title.background = null
        for (const sc of draft.scenes) {
          for (const f of sc.frames) {
            if (f.type !== 'line') continue
            if (f.bg === id) f.bg = null
            if (f.bgm === id) f.bgm = null
            if (f.sfx === id) f.sfx = null
            if (f.voice === id) f.voice = null
            for (const slot of ['left', 'center', 'right'] as const) {
              const used = f.cast[slot]
              if (!used) continue
              const ch = draft.characters.find((c) => c.id === used.characterId)
              if (!ch || !ch.sprites[used.expression]) f.cast[slot] = null
            }
          }
        }
      })
    },
    [mutate, project],
  )

  const saveNow = useCallback(async () => {
    latest.current = project
    await flush()
  }, [flush, project])

  const value = useMemo<EditorApi | null>(() => {
    if (!project || !scene) return null
    return {
      project,
      assetUrls,
      scene,
      sceneId: scene.id,
      frameId,
      frame,
      mode,
      dirty,
      saving,
      selectScene: (id: string) => {
        const target = project.scenes.find((s) => s.id === id)
        setSceneId(id)
        setFrameId(target?.frames[0]?.id ?? null)
      },
      selectFrame: setFrameId,
      setMode,
      mutate,
      patchMeta,
      patchFrame,
      addFrame,
      removeFrame,
      duplicateFrame,
      moveFrame,
      addScene,
      patchScene,
      removeScene,
      moveScene,
      addAssets,
      removeAsset,
      saveNow,
      close: () => {
        void saveNow().then(onExit)
      },
      undo,
      redo,
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
    }
  }, [
    project,
    scene,
    assetUrls,
    frameId,
    frame,
    mode,
    dirty,
    saving,
    mutate,
    patchMeta,
    patchFrame,
    addFrame,
    removeFrame,
    duplicateFrame,
    moveFrame,
    addScene,
    patchScene,
    removeScene,
    moveScene,
    addAssets,
    removeAsset,
    saveNow,
    onExit,
    undo,
    redo,
    historyTick,
  ])

  if (!value) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <span className="animate-pulse">正在打开作品…</span>
      </div>
    )
  }

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

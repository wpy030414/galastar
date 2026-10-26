import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Play, Sparkles, Square } from 'lucide-react'
import { buildPayload } from '@/lib/project'
import { useI18n } from '@/i18n'
import { useEditor } from '@/store/editor'
import { Button } from '@/components/ui'

const PREVIEW_URL = `${import.meta.env.BASE_URL}engine/preview.html`

export function StagePreview() {
  const { project, assetUrls, scene, frameId, mode, setMode, selectFrame } = useEditor()
  const { t } = useI18n()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)

  const payload = useMemo(
    () => buildPayload(project, (assetId) => assetUrls[assetId] ?? ''),
    [project, assetUrls],
  )
  const payloadKey = useMemo(() => JSON.stringify(payload), [payload])

  const sceneIndex = Math.max(
    0,
    scene.frames.findIndex((f) => f.id === frameId),
  )

  const post = (message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage({ source: 'galastar-editor', ...message }, '*')
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string }
      if (data?.source !== 'galastar-preview') return
      if (data.type === 'ready' || data.type === 'mounted') setReady(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  /* 切换模式会换一个干净的 iframe，等它重新握手 */
  useEffect(() => {
    setReady(false)
  }, [mode])

  /* 载入 / 切换模式：重新挂载一个干净的舞台 */
  useEffect(() => {
    if (!ready) return
    if (mode === 'play') {
      post({ type: 'payload', payload, mode: 'play', play: { sceneId: scene.id, index: 0 } })
    } else if (mode === 'title') {
      post({ type: 'payload', payload, mode: 'play', title: true })
    } else {
      post({
        type: 'payload',
        payload,
        mode: 'edit',
        seek: { sceneId: scene.id, index: sceneIndex },
      })
    }
    // 只在挂载完成或模式切换时重建舞台
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mode])

  /* 换肤不需要重载数据，直接改舞台的 data-theme */
  useEffect(() => {
    if (!ready) return
    post({ type: 'skin', skin: project.meta.theme.skin })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, project.meta.theme.skin])

  /* 编辑态：内容变化后重新注入数据并定格到当前帧 */
  const lastPayload = useRef('')
  useEffect(() => {
    if (!ready || mode !== 'edit') return
    if (lastPayload.current === payloadKey) return
    lastPayload.current = payloadKey
    const timer = window.setTimeout(() => {
      post({
        type: 'payload',
        payload,
        mode: 'edit',
        seek: { sceneId: scene.id, index: sceneIndex },
      })
    }, 140)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey, ready, mode])

  /* 编辑态：仅切换选中帧时，不重载数据 */
  useEffect(() => {
    if (!ready || mode !== 'edit') return
    post({ type: 'show', sceneId: scene.id, index: sceneIndex })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameId, scene.id, ready, mode])

  const step = (delta: number) => {
    const next = scene.frames[sceneIndex + delta]
    if (next) selectFrame(next.id)
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[radial-gradient(90%_70%_at_50%_42%,#0c0a16_0%,#05050a_70%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-end p-3">
        <div className="pointer-events-auto flex items-center gap-1.5">
          {mode === 'edit' ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => step(-1)}
                disabled={sceneIndex <= 0}
                title={t('stage.prevFrame')}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
              <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] text-white/60 backdrop-blur">
                {sceneIndex + 1} / {scene.frames.length}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => step(1)}
                disabled={sceneIndex >= scene.frames.length - 1}
                title={t('stage.nextFrame')}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            </>
          ) : null}
          <div className="mx-1 h-4 w-px bg-white/10" />
          <Button
            variant={mode === 'title' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode(mode === 'title' ? 'edit' : 'title')}
            title={t('stage.titleTip')}
            className="backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('stage.titleBtn')}
          </Button>
          <Button
            variant={mode === 'play' ? 'star' : 'ghost'}
            size="sm"
            onClick={() => setMode(mode === 'play' ? 'edit' : 'play')}
            className="backdrop-blur"
          >
            {mode === 'play' ? (
              <Square className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {mode === 'play' ? t('stage.stop') : t('stage.play')}
          </Button>
        </div>
      </div>

      <div className="relative flex-1">
        <iframe
          key={mode}
          ref={iframeRef}
          title={t('stage.iframeTitle')}
          src={PREVIEW_URL}
          className="h-full w-full border-0"
        />
        {!ready ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#05050a]">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}
      </div>

      {mode !== 'edit' ? (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] text-white/55 backdrop-blur">
          {t('stage.hintPlay')}
        </div>
      ) : null}
    </div>
  )
}

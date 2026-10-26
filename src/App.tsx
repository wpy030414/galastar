import { useCallback, useState } from 'react'
import { ToastProvider } from '@/components/ui'
import { LibraryView } from '@/features/library/LibraryView'
import { EditorView } from '@/features/editor/EditorView'
import { EditorProvider } from '@/store/editor'

export function App() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const backToLibrary = useCallback(() => setProjectId(null), [])

  return (
    <ToastProvider>
      <div className="h-full">
        {projectId ? (
          <EditorProvider key={projectId} projectId={projectId} onExit={backToLibrary}>
            <EditorView />
          </EditorProvider>
        ) : (
          <LibraryView onOpen={setProjectId} />
        )}
      </div>
    </ToastProvider>
  )
}

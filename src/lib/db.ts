import type { Project } from './types'

/**
 * 本地存储层。
 * 作品 JSON 与媒体二进制都放在 IndexedDB：容量远大于 localStorage，
 * 且可以直接存 Blob，不需要 base64 膨胀。整个产品没有服务端。
 */

const DB_NAME = 'galastar'
const DB_VERSION = 1
const STORE_PROJECTS = 'projects'
const STORE_BLOBS = 'blobs'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'meta.id' }).createIndex(
          'updatedAt',
          'meta.updatedAt',
        )
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = run(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

const blobKey = (projectId: string, assetId: string) => `${projectId}:${assetId}`

/* ------------------------------- 作品 ------------------------------- */

export async function listProjects(): Promise<Project[]> {
  const all = await tx<Project[]>(
    STORE_PROJECTS,
    'readonly',
    (s) => s.getAll() as IDBRequest<Project[]>,
  )
  return all.sort((a, b) => b.meta.updatedAt - a.meta.updatedAt)
}

/**
 * 旧作品可能没有 meta.theme.skin（2.0 之前存的），读出来补齐默认值。
 * 放在读入口而不是渲染处，避免每个消费方都要判空。
 */
function hydrate(project: Project): Project {
  const theme = project.meta.theme as { accent?: string; skin?: string } | undefined
  if (!theme || !theme.skin) {
    project.meta.theme = { accent: theme?.accent || '#9d8cff', skin: 'pgf' }
  }
  return project
}

export async function readProject(id: string): Promise<Project | undefined> {
  const project = await tx<Project | undefined>(
    STORE_PROJECTS,
    'readonly',
    (s) => s.get(id) as IDBRequest<Project | undefined>,
  )
  return project ? hydrate(project) : project
}

export async function writeProject(project: Project): Promise<void> {
  await tx(STORE_PROJECTS, 'readwrite', (s) => s.put(project))
}

export async function removeProject(id: string): Promise<void> {
  await tx(STORE_PROJECTS, 'readwrite', (s) => s.delete(id))
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE_BLOBS, 'readwrite')
    const store = t.objectStore(STORE_BLOBS)
    const req = store.openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        resolve()
        return
      }
      const value = cursor.value as { key: string }
      if (value.key.startsWith(`${id}:`)) cursor.delete()
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

/* ------------------------------- 媒体 ------------------------------- */

export async function putBlob(projectId: string, assetId: string, blob: Blob): Promise<void> {
  await tx(STORE_BLOBS, 'readwrite', (s) => s.put({ key: blobKey(projectId, assetId), blob }))
}

export async function getBlob(projectId: string, assetId: string): Promise<Blob | undefined> {
  const row = await tx<{ key: string; blob: Blob } | undefined>(
    STORE_BLOBS,
    'readonly',
    (s) =>
      s.get(blobKey(projectId, assetId)) as IDBRequest<{ key: string; blob: Blob } | undefined>,
  )
  return row?.blob
}

export async function deleteBlob(projectId: string, assetId: string): Promise<void> {
  await tx(STORE_BLOBS, 'readwrite', (s) => s.delete(blobKey(projectId, assetId)))
}

export async function getProjectBlobs(projectId: string): Promise<Map<string, Blob>> {
  const db = await openDB()
  const prefix = `${projectId}:`
  const map = new Map<string, Blob>()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE_BLOBS, 'readonly')
    const req = t.objectStore(STORE_BLOBS).openCursor(IDBKeyRange.bound(prefix, `${prefix}\uffff`))
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        resolve()
        return
      }
      const value = cursor.value as { key: string; blob: Blob }
      map.set(value.key.slice(prefix.length), value.blob)
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
  return map
}

/** 估算已用空间（IndexedDB 的 usage 包含全部站点数据，仅作参考） */
export async function estimateUsage(): Promise<{ usage: number; quota: number }> {
  if (!navigator.storage?.estimate) return { usage: 0, quota: 0 }
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usage, quota }
}

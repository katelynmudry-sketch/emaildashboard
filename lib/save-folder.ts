/**
 * Per-account save folder — backed by IndexedDB so the FileSystemDirectoryHandle
 * survives page reloads. Users pick a folder once; subsequent saves go there silently.
 *
 * Falls back to a normal browser download if:
 *   - No folder has been configured
 *   - The user revoked permission
 *   - The browser doesn't support the File System Access API
 */

const DB_NAME = "inbox-ai-fs"
const DB_VERSION = 1
const STORE = "save-folders"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      (e.target as IDBOpenDBRequest).result.createObjectStore(STORE)
    }
    req.onsuccess = e => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror = () => reject(req.error)
  })
}

export async function getSaveFolderHandle(account: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDb()
    return new Promise(resolve => {
      const tx = db.transaction(STORE, "readonly")
      const req = tx.objectStore(STORE).get(account)
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle | undefined) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function setSaveFolderHandle(account: string, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(handle, account)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearSaveFolderHandle(account: string): Promise<void> {
  try {
    const db = await openDb()
    return new Promise(resolve => {
      const tx = db.transaction(STORE, "readwrite")
      tx.objectStore(STORE).delete(account)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // ignore
  }
}

/** Open the OS folder picker and store the result. Returns the handle or null if cancelled. */
export async function pickSaveFolder(account: string): Promise<FileSystemDirectoryHandle | null> {
  if (!("showDirectoryPicker" in window)) return null
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" })
    await setSaveFolderHandle(account, handle)
    return handle
  } catch {
    // User cancelled or permission denied
    return null
  }
}

/** Returns true if the handle still has (or can re-request) readwrite permission. */
export async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    // queryPermission / requestPermission are part of the File System Access API
    // but not yet in TypeScript's built-in lib — cast to any to call them.
    const h = handle as any
    const current = await h.queryPermission({ mode: "readwrite" })
    if (current === "granted") return true
    const requested = await h.requestPermission({ mode: "readwrite" })
    return requested === "granted"
  } catch {
    return false
  }
}

/** Write a Blob directly into the configured folder. Returns true on success. */
export async function saveToFolder(
  handle: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob
): Promise<boolean> {
  try {
    const ok = await ensurePermission(handle)
    if (!ok) return false
    const fileHandle = await handle.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
    return true
  } catch {
    return false
  }
}

/** True if the browser supports the File System Access API. */
export function isFsaSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window
}

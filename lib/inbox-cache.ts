"use client"

import type { Email, Category } from "./types"

const STORAGE_KEY = "inbox-ai-inbox"

export interface InboxCache {
  account: string
  emails: Email[]
  categories: Category[]
  fetchedAt: string // ISO string
  /** Gmail `messages.list` resultSizeEstimate for the unread-inbox query (approximate). */
  totalUnreadEstimate?: number
  /** Max messages requested on the last full inbox fetch (30 / 50 / 100). */
  importBatchSize?: number
}

function storageKey(account: string): string {
  return `${STORAGE_KEY}:${account}`
}

export function getCachedInbox(account: string): InboxCache | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(storageKey(account))
    if (!raw) return null
    return JSON.parse(raw) as InboxCache
  } catch {
    return null
  }
}

export function saveCachedInbox(
  account: string,
  emails: Email[],
  categories: Category[],
  opts?: {
    fetchedAt?: string
    totalUnreadEstimate?: number
    importBatchSize?: number
  }
): void {
  if (typeof window === "undefined") return
  const prev = getCachedInbox(account)
  const cache: InboxCache = {
    account,
    emails,
    categories,
    fetchedAt: opts?.fetchedAt ?? prev?.fetchedAt ?? new Date().toISOString(),
    totalUnreadEstimate: opts?.totalUnreadEstimate !== undefined ? opts.totalUnreadEstimate : prev?.totalUnreadEstimate,
    importBatchSize: opts?.importBatchSize !== undefined ? opts.importBatchSize : prev?.importBatchSize,
  }
  try {
    localStorage.setItem(storageKey(account), JSON.stringify(cache))
  } catch {
    // Storage quota exceeded — skip silently
  }
}

export function clearCachedInbox(account: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(storageKey(account))
}

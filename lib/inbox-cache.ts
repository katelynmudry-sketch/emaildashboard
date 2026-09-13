"use client"

import type { Email, Category, EmailKeyPoint } from "./types"

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
  /** AI-extracted Daily Briefing key points (one per email with something concrete) — cached so it survives reloads. */
  briefingSummary?: EmailKeyPoint[]
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
    briefingSummary?: EmailKeyPoint[]
  }
): void {
  if (typeof window === "undefined") return
  const prev = getCachedInbox(account)
  // htmlBody is kept here (not stripped) so a page reload can render an
  // email instantly from cache instead of re-fetching it from Gmail on
  // every click. This write is called off the render path (see
  // Dashboard's writeInboxCache, which defers it via setTimeout), so its
  // size no longer blocks the UI the way it used to.
  const cache: InboxCache = {
    account,
    emails,
    categories,
    fetchedAt: opts?.fetchedAt ?? prev?.fetchedAt ?? new Date().toISOString(),
    totalUnreadEstimate: opts?.totalUnreadEstimate !== undefined ? opts.totalUnreadEstimate : prev?.totalUnreadEstimate,
    importBatchSize: opts?.importBatchSize !== undefined ? opts.importBatchSize : prev?.importBatchSize,
    briefingSummary: opts?.briefingSummary !== undefined ? opts.briefingSummary : prev?.briefingSummary,
  }
  try {
    localStorage.setItem(storageKey(account), JSON.stringify(cache))
  } catch {
    // Quota exceeded — a 100-email batch with inline images can easily blow
    // past the ~5-10MB per-origin localStorage limit. Retry without
    // htmlBody: it's the bulk of the size and EmailModal/DetailPanel always
    // re-fetch it from /api/gmail/html anyway, so losing it just means an
    // extra fetch on next open — much better than silently freezing the
    // whole cached snapshot (categories included) on a stale write.
    try {
      const slim = { ...cache, emails: cache.emails.map(({ htmlBody: _htmlBody, ...rest }) => rest) }
      localStorage.setItem(storageKey(account), JSON.stringify(slim))
    } catch {
      // Still too big — skip silently rather than throw.
    }
  }
}

export function clearCachedInbox(account: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(storageKey(account))
}

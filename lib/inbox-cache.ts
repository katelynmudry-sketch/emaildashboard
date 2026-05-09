"use client"

import type { Email, Category } from "./types"

const STORAGE_KEY = "inbox-ai-inbox"

export interface InboxCache {
  account: string
  emails: Email[]
  categories: Category[]
  fetchedAt: string // ISO string
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

export function saveCachedInbox(account: string, emails: Email[], categories: Category[]): void {
  if (typeof window === "undefined") return
  const cache: InboxCache = { account, emails, categories, fetchedAt: new Date().toISOString() }
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

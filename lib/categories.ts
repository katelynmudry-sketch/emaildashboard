"use client"

import type { Category, CategoryConfig } from "./types"

const STORAGE_KEY = "inbox-ai-categories"

function storageKey(account: string): string {
  return `${STORAGE_KEY}:${account}`
}

export function getCategories(account: string): Category[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(storageKey(account))
    if (!raw) return null
    const config: CategoryConfig = JSON.parse(raw)
    return config.categories
  } catch {
    return null
  }
}

export function saveCategories(account: string, categories: Category[]): void {
  if (typeof window === "undefined") return
  const config: CategoryConfig = {
    account,
    categories,
    proposedAt: new Date().toISOString(),
  }
  localStorage.setItem(storageKey(account), JSON.stringify(config))
}

export function clearCategories(account: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(storageKey(account))
}

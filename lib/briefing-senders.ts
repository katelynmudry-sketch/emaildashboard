"use client"

const STORAGE_PREFIX = "inbox-ai:briefing-senders"

function storageKey(account: string): string {
  return `${STORAGE_PREFIX}:${account}`
}

export function getBriefingSenders(account: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(storageKey(account))
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function addBriefingSender(account: string, emailAddress: string): void {
  if (typeof window === "undefined") return
  const normalized = emailAddress.toLowerCase()
  const current = getBriefingSenders(account)
  if (current.includes(normalized)) return
  try {
    localStorage.setItem(storageKey(account), JSON.stringify([...current, normalized]))
  } catch {}
}

export function removeBriefingSender(account: string, emailAddress: string): void {
  if (typeof window === "undefined") return
  const normalized = emailAddress.toLowerCase()
  const current = getBriefingSenders(account)
  try {
    localStorage.setItem(storageKey(account), JSON.stringify(current.filter(e => e !== normalized)))
  } catch {}
}

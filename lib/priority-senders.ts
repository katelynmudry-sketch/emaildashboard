"use client"

import type { RawEmail } from "./types"

const STORAGE_PREFIX = "inbox-ai:priority-senders"

function storageKey(account: string): string {
  return `${STORAGE_PREFIX}:${account}`
}

export function getPrioritySenders(account: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(storageKey(account))
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function addPrioritySender(account: string, email: string): void {
  if (typeof window === "undefined") return
  const normalized = email.toLowerCase()
  const current = getPrioritySenders(account)
  if (current.includes(normalized)) return
  try {
    localStorage.setItem(storageKey(account), JSON.stringify([...current, normalized]))
  } catch {}
}

export function isPrioritySender(account: string, email: string): boolean {
  return getPrioritySenders(account).includes(email.toLowerCase())
}

// ── Detecting candidates from inbox + sent mail ───────────────────────────────

export interface PrioritySenderCandidate {
  email: string
  name: string
  receivedCount: number
  sentCount: number
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g

function extractEmails(headerValue: string): string[] {
  return (headerValue.match(EMAIL_RE) ?? []).map(e => e.toLowerCase())
}

// Skip automated/no-reply addresses — never good "priority person" candidates.
const GENERIC_LOCAL_PART = /^(no-?reply|do-?not-?reply|notifications?|support|info|hello|news(letter)?|mailer|alerts?|updates?|automated|bounce|postmaster)[.\-_]?/i

const MIN_RECEIVED_COUNT = 3

/**
 * Find frequent senders the user also emails back — a strong "I care about
 * this person" signal. Returns up to `limit` candidates, sorted by combined
 * frequency, excluding senders already marked as priority.
 */
export function detectPrioritySenderCandidates(
  emails: RawEmail[],
  sentToHeaders: string[],
  account: string,
  limit = 1,
): PrioritySenderCandidate[] {
  const alreadyPriority = new Set(getPrioritySenders(account))

  const sentCounts = new Map<string, number>()
  for (const header of sentToHeaders) {
    for (const email of extractEmails(header)) {
      sentCounts.set(email, (sentCounts.get(email) ?? 0) + 1)
    }
  }

  const received = new Map<string, { name: string; receivedCount: number }>()
  for (const e of emails) {
    const key = e.fromEmail.toLowerCase()
    if (!key || GENERIC_LOCAL_PART.test(key.split("@")[0])) continue
    const existing = received.get(key)
    if (existing) existing.receivedCount++
    else received.set(key, { name: e.from, receivedCount: 1 })
  }

  const candidates: PrioritySenderCandidate[] = []
  for (const [email, { name, receivedCount }] of received) {
    if (alreadyPriority.has(email)) continue
    if (receivedCount < MIN_RECEIVED_COUNT) continue
    const sentCount = sentCounts.get(email) ?? 0
    if (sentCount === 0) continue
    candidates.push({ email, name, receivedCount, sentCount })
  }

  return candidates
    .sort((a, b) => (b.receivedCount + b.sentCount) - (a.receivedCount + a.sentCount))
    .slice(0, limit)
}

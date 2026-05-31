// lib/settings-storage.ts
// All inbox-ai user settings — stored in localStorage, passed in API request bodies.
// Server stays stateless; this works identically on localhost and Vercel.

const STORAGE_KEY = "inbox-ai:settings"

export interface InboxSettings {
  personalRules: string
  workRules: string
  systemContext: string // overrides CLINIC_CONTEXT if non-empty
  aiPastEventDelete: boolean    // suggest deleting calendar event emails after the event has passed
  aiDeliveryChainCleanup: boolean // suggest deleting shipping emails once a package is delivered
}

const DEFAULTS: InboxSettings = {
  personalRules: "",
  workRules: "",
  systemContext: "",
  aiPastEventDelete: true,
  aiDeliveryChainCleanup: true,
}

export function loadSettings(): InboxSettings {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

export function saveSettings(patch: Partial<InboxSettings>): InboxSettings {
  const current = loadSettings()
  const next: InboxSettings = { ...current, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage unavailable (SSR, private mode quota)
  }
  return next
}

/** Seed settings from server defaults if localStorage is empty (first run). */
export function seedIfEmpty(defaults: Partial<InboxSettings>): void {
  if (typeof window === "undefined") return
  const current = loadSettings()
  const patch: Partial<InboxSettings> = {}
  if (!current.personalRules && defaults.personalRules) patch.personalRules = defaults.personalRules
  if (!current.workRules     && defaults.workRules)     patch.workRules = defaults.workRules
  if (!current.systemContext && defaults.systemContext) patch.systemContext = defaults.systemContext
  if (Object.keys(patch).length > 0) saveSettings(patch)
}

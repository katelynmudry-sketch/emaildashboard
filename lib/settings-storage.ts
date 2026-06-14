// lib/settings-storage.ts
// All inbox-ai user settings — stored in localStorage, passed in API request bodies.
// Server stays stateless; this works identically on localhost and Vercel.

const STORAGE_KEY = "inbox-ai:settings"

export interface InboxSettings {
  personalRules: string
  workRules: string
  systemContext: string // overrides CLINIC_CONTEXT if non-empty
  aboutYouContext: string          // "About You" reference doc, included in every AI prompt
  aiPastEventDelete: boolean    // suggest deleting calendar event emails after the event has passed
  aiDeliveryChainCleanup: boolean // suggest deleting shipping emails once a package is delivered
  todoExportEnabled: boolean  // beta: append TODO-flagged emails to a Google Doc
  todoExportDocIdPersonal: string  // Google Doc ID to append personal-account TODOs to
  todoExportDocIdWork: string      // Google Doc ID to append work-account TODOs to
  showUnreadOnly: boolean   // when true, only show unread inbox messages (default behavior today)
  showArchived: boolean     // when true, include archived (non-inbox) messages
  sortOrder: "newest" | "oldest"  // email list sort order
  onboardingComplete: boolean      // true once the first-run onboarding wizard has been completed
  accountLabelPersonal: string  // custom display name for the "personal" account slot; empty = default "Personal"
  accountLabelWork: string      // custom display name for the "work" account slot; empty = default "Work"
}

const DEFAULTS: InboxSettings = {
  personalRules: "",
  workRules: "",
  systemContext: "",
  aboutYouContext: "",
  aiPastEventDelete: true,
  aiDeliveryChainCleanup: true,
  todoExportEnabled: false,
  todoExportDocIdPersonal: "",
  todoExportDocIdWork: "",
  showUnreadOnly: true,
  showArchived: false,
  sortOrder: "newest",
  onboardingComplete: false,
  accountLabelPersonal: "",
  accountLabelWork: "",
}

export function loadSettings(): InboxSettings {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<InboxSettings> & { todoExportDocId?: string }

    // Migration: old single todoExportDocId -> todoExportDocIdPersonal
    if (parsed.todoExportDocId && !parsed.todoExportDocIdPersonal) {
      parsed.todoExportDocIdPersonal = parsed.todoExportDocId
      delete parsed.todoExportDocId
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
    }

    return { ...DEFAULTS, ...parsed }
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

import type { DashboardPrefs, DashboardTheme } from "./types"

const PREFS_KEY = "inbox-ai:dashboard-prefs"
const DHARMA_CACHE_KEY = "inbox-ai:dharma-cache"
const CALENDAR_CACHE_KEY = "inbox-ai:calendar-cache"

const DEFAULTS: DashboardPrefs = {
  theme: "morning-altar",
  dharmaTeacherId: "thich-nhat-hanh",
  dashboardOpen: true,
}

export function getDashboardPrefs(): DashboardPrefs {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) } as DashboardPrefs
  } catch {
    return DEFAULTS
  }
}

export function saveDashboardPrefs(prefs: Partial<DashboardPrefs>): void {
  if (typeof window === "undefined") return
  const current = getDashboardPrefs()
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }))
}

export function setDashboardTheme(theme: DashboardTheme): void {
  saveDashboardPrefs({ theme })
}

export function setDharmaTeacher(id: string): void {
  saveDashboardPrefs({ dharmaTeacherId: id })
}

export function setDashboardOpen(open: boolean): void {
  saveDashboardPrefs({ dashboardOpen: open })
}

// ── Daily dharma cache — avoids re-calling Claude for the reflection on same day ──

export interface DharmaCache {
  date: string // YYYY-MM-DD
  teacher: string
  quote: string
  source: string | null
  reflection: string
  teacherName: string
  teacherTradition: string
}

export function getDharmaCache(teacherId: string): DharmaCache | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(DHARMA_CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as DharmaCache
    const today = new Date().toISOString().slice(0, 10)
    if (cached.date !== today || cached.teacher !== teacherId) return null
    return cached
  } catch {
    return null
  }
}

export function saveDharmaCache(data: DharmaCache): void {
  if (typeof window === "undefined") return
  localStorage.setItem(DHARMA_CACHE_KEY, JSON.stringify(data))
}

// ── 15-min calendar cache ──────────────────────────────────────────────────────

export interface CalendarCache {
  fetchedAt: number // ms timestamp
  events: import("./types").CalendarEvent[]
}

const CALENDAR_TTL_MS = 15 * 60 * 1000 // 15 minutes

export function getCalendarCache(account: string): CalendarCache | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(`${CALENDAR_CACHE_KEY}:${account}`)
    if (!raw) return null
    const cached = JSON.parse(raw) as CalendarCache
    if (Date.now() - cached.fetchedAt > CALENDAR_TTL_MS) return null
    return cached
  } catch {
    return null
  }
}

export function saveCalendarCache(account: string, events: import("./types").CalendarEvent[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(`${CALENDAR_CACHE_KEY}:${account}`, JSON.stringify({ fetchedAt: Date.now(), events }))
}

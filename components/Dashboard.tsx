"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import type { Email, Category, AccountId, RawEmail, Attachment } from "@/lib/types"
import { ACCOUNTS } from "@/lib/types"
import { getCategories, saveCategories } from "@/lib/categories"
import { recordAction, getKarmaLevel } from "@/lib/stats"
import { getPartyMode, setPartyMode, hasSeenGate, type PartyMode } from "@/lib/party-mode"
import { getCachedInbox, saveCachedInbox, type InboxCache } from "@/lib/inbox-cache"
import { snoozeEmail } from "@/lib/todo-snooze"
import { loadSettings } from "@/lib/settings-storage"
import AccountToggle from "./AccountToggle"
import BriefingSection from "./BriefingSection"
import CategoryBlock from "./CategoryBlock"
import CategoryProposal from "./CategoryProposal"
import EmailModal from "./EmailModal"
import EmailRow from "./EmailRow"
import PlantHeader from "./PlantHeader"
import DashboardPanel from "./dashboard/DashboardPanel"
import ComposeModal from "./ComposeModal"
import SnoozeModal from "./SnoozeModal"
import ConfettiBlast from "./ConfettiBlast"
import InstructionsPanel from "./InstructionsPanel"
import QuoteGate from "./QuoteGate"

type AppState = "idle" | "fetching" | "proposing" | "categorizing" | "ready" | "error"

const IMPORT_BATCH_OPTIONS = [30, 50, 100] as const
type ImportBatchSize = (typeof IMPORT_BATCH_OPTIONS)[number]
const BATCH_PREF_KEY = "inbox-ai:import-batch-size"

function readStoredBatchSize(): ImportBatchSize {
  if (typeof window === "undefined") return 30
  const raw = localStorage.getItem(BATCH_PREF_KEY)
  const n = raw ? parseInt(raw, 10) : NaN
  return IMPORT_BATCH_OPTIONS.includes(n as ImportBatchSize) ? (n as ImportBatchSize) : 30
}

type InboxFetchMeta = { totalUnreadEstimate: number; importBatchSize: ImportBatchSize }

function formatFetchedAt(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
}

// ── Stat sub-components (mode-aware) ─────────────────────────────────────────

function MiniStat({ value, label, color, mode }: { value: number; label: string; color: string; mode: PartyMode }) {
  const isZen = mode === "zen"
  return (
    <div style={{
      border: mode === "wabi-sabi" ? "1px solid rgba(17,17,17,0.18)" : isZen ? `1px solid ${color}33` : `1px solid ${color}44`,
      borderRadius: 8,
      padding: "5px 10px",
      background: mode === "wabi-sabi" ? "transparent" : isZen ? `${color}0d` : `${color}14`,
      textAlign: "center",
    }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", lineHeight: 1, color: mode === "wabi-sabi" ? "#111" : color }}>
        {value}
      </div>
      <div style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(26,10,53,0.60)", marginTop: 1 }}>
        {label}
      </div>
    </div>
  )
}

function TallyTicket({ loaded, total, mode }: { loaded: number; total: number; mode: PartyMode }) {
  const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
  const allLoaded = total > 0 && loaded >= total
  const isBasicAF = mode === "wabi-sabi"
  const isZen = mode === "zen"
  const accentColor = isZen ? "#C8960C" : isBasicAF ? "#111111" : "#FF1F6E"
  const accentAlpha = "25"
  const accentBg = isZen ? "rgba(200,150,12,0.06)" : isBasicAF ? "transparent" : "rgba(255,31,110,0.07)"

  return (
    <div style={{
      border: isBasicAF ? "1px solid rgba(17,17,17,0.18)" : `1px solid ${accentColor}${accentAlpha}`,
      borderRadius: 10,
      padding: "8px 16px",
      background: accentBg,
      minWidth: 160,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", lineHeight: 1, color: accentColor }}>
          {loaded}
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", lineHeight: 1, color: "rgba(26,10,53,0.30)" }}>
          /
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", lineHeight: 1, color: "rgba(26,10,53,0.55)" }}>
          {total}
        </span>
      </div>
      <div style={{ fontSize: "0.70rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(26,10,53,0.55)", marginTop: 3 }}>
        {allLoaded ? "✓ all loaded" : "emails loaded"}
      </div>
      <div style={{ marginTop: 6, height: 3, borderRadius: 99, background: "rgba(26,10,53,0.10)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 99,
          background: allLoaded
            ? "linear-gradient(90deg, #00E5C4, #00C4A7)"
            : isZen
              ? "linear-gradient(90deg, #C8960C, #B07B0A)"
              : isBasicAF
                ? "linear-gradient(90deg, #1A0A35, rgba(26,10,53,0.55))"
                : "linear-gradient(90deg, #FF1F6E, #FF6B1A)",
          transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
    </div>
  )
}

// ── Karma pill sub-component ─────────────────────────────────────────────────

function KarmaPill({
  emoji, label, xp, nextThreshold, toast, mode,
}: {
  emoji: string; label: string; xp: number; nextThreshold: number
  toast: string | null; mode: PartyMode
}) {
  const prevThreshold = (() => {
    const thresholds = [0, 25, 75, 150, 300, 9999]
    const idx = thresholds.findIndex(t => t === nextThreshold)
    return idx > 0 ? thresholds[idx - 1] : 0
  })()
  const pct = nextThreshold > prevThreshold
    ? Math.min(100, ((xp - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
    : 100

  const isParty = mode === "party"
  const isZen = mode === "zen"
  const isBasicAF = mode === "wabi-sabi"
  const xpColor = isParty ? "#FFD000" : isZen ? "#C8960C" : isBasicAF ? "#111" : "#FFD000"
  const labelColor = isParty ? "#FF6B1A" : isZen ? "rgba(200,150,12,0.65)" : isBasicAF ? "rgba(17,17,17,0.55)" : "#FF6B1A"
  const barFill = isParty
    ? "linear-gradient(90deg, #FFD000, #FF6B1A)"
    : isZen
      ? "linear-gradient(90deg, #C8960C, #B07B0A)"
      : isBasicAF
        ? "linear-gradient(90deg, #111, rgba(17,17,17,0.50))"
        : "linear-gradient(90deg, #FFD000, #FF6B1A)"
  const pillBg = isParty
    ? "linear-gradient(135deg, rgba(255,208,0,0.14), rgba(139,63,216,0.10))"
    : isZen
      ? "rgba(200,150,12,0.07)"
      : isBasicAF
        ? "transparent"
        : "rgba(200,150,12,0.07)"
  const pillBorder = isParty
    ? "1px solid rgba(255,208,0,0.35)"
    : isZen
      ? "1px solid rgba(200,150,12,0.22)"
      : isBasicAF
        ? "1.5px solid rgba(17,17,17,0.22)"
        : "1px solid rgba(255,208,0,0.35)"

  return (
    <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 14px", borderRadius: 999,
        background: pillBg, border: pillBorder, position: "relative",
      }}>
        <span style={{ fontSize: "1.3rem", lineHeight: 1, filter: isParty ? "drop-shadow(0 0 5px rgba(255,208,0,0.5))" : "none" }}>
          {emoji}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: "1.1rem", fontWeight: 800, lineHeight: 1, color: xpColor, fontFamily: "var(--font-display)" }}>
              {xp}
            </span>
            <span style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(26,10,53,0.40)" }}>
              Karma
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.65rem", color: labelColor, fontWeight: 700 }}>{label}</span>
            <div style={{ width: 44, height: 3, background: "rgba(26,10,53,0.10)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 99, width: `${pct}%`, background: barFill, transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)" }} />
            </div>
          </div>
        </div>
        {toast && isParty && (
          <div className="karma-toast-anim" style={{
            position: "absolute", top: -26, left: "50%", transform: "translateX(-50%)",
            background: "#FFD000", color: "#1A0A35",
            fontSize: "0.75rem", fontWeight: 800, padding: "2px 8px", borderRadius: 6,
            whiteSpace: "nowrap", pointerEvents: "none",
          }}>
            {toast} Karma
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main dashboard component ─────────────────────────────────────────────────

export default function Dashboard() {
  const { data: session } = useSession()
  const [activeAccount, setActiveAccount] = useState<AccountId>("personal")
  const [emails, setEmails] = useState<Email[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [appState, setAppState] = useState<AppState>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [proposedCategories, setProposedCategories] = useState<{ name: string; color: string }[] | null>(null)
  const [existingLabelNames, setExistingLabelNames] = useState<string[]>([])
  const [pendingRawEmails, setPendingRawEmails] = useState<RawEmail[]>([])
  const [packageCleanup, setPackageCleanup] = useState<{ emails: { id: string; subject: string; date: string; snippet: string }[]; sender: string } | null>(null)
  const [cleanupExpanded, setCleanupExpanded] = useState(false)
  const [cleanupChecked, setCleanupChecked] = useState<Set<string>>(new Set())
  const [cleanupPreview, setCleanupPreview] = useState<{ id: string; subject: string } | null>(null)
  const [cleanupPreviewHtml, setCleanupPreviewHtml] = useState<string | null>(null)
  const [expandedEmail, setExpandedEmail] = useState<Email | null>(null)
  const [expandedComposeMode, setExpandedComposeMode] = useState<"ai" | "reply" | "forward" | null>(null)
  const [totalEmailsAtLoad, setTotalEmailsAtLoad] = useState(0)
  const [totalUnreadInbox, setTotalUnreadInbox] = useState(0)
  const [importBatchSize, setImportBatchSize] = useState<ImportBatchSize>(() => readStoredBatchSize())
  const [pendingImportMeta, setPendingImportMeta] = useState<InboxFetchMeta | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [snoozeTarget, setSnoozeTarget] = useState<Email | null>(null)
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [roast, setRoast] = useState<string | null>(null)
  const [roasting, setRoasting] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [todoLabelId, setTodoLabelId] = useState<string | null>(null)
  const prevEmailCount = useRef<number | null>(null)

  // ── Priority category pin ─────────────────────────────────────────────────
  const [priorityCategory, setPriorityCategory] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return localStorage.getItem("inbox-ai:priority-category")
  })

  function handleTogglePriority(categoryName: string) {
    const next = priorityCategory === categoryName ? null : categoryName
    setPriorityCategory(next)
    if (next) localStorage.setItem("inbox-ai:priority-category", next)
    else localStorage.removeItem("inbox-ai:priority-category")
  }

  // ── Email Party state ─────────────────────────────────────────────────────
  const [mode, setMode] = useState<PartyMode>("party")
  const [showGate, setShowGate] = useState(false)
  const [karmaEmoji, setKarmaEmoji] = useState("🌱")
  const [karmaLabel, setKarmaLabel] = useState("Seed")
  const [karmaXp, setKarmaXp] = useState(0)
  const [karmaNextThreshold, setKarmaNextThreshold] = useState(25)
  const [karmaToast, setKarmaToast] = useState<string | null>(null)
  const [mindfulPurge, setMindfulPurge] = useState<Email[]>([])
  const [purgeShattered, setPurgeShattered] = useState(false)
  const [purgeDismissed, setPurgeDismissed] = useState(false)
  const [lotusQuote, setLotusQuote] = useState<string | null>(null)
  const [showLotusBloom, setShowLotusBloom] = useState(false)

  // In-memory cache for fast account switching within a session
  const sessionCache = useRef<Map<string, InboxCache>>(new Map())

  // ── Email Party init ─────────────────────────────────────────────────────
  useEffect(() => {
    const stored = getPartyMode()
    setMode(stored)
    if (!hasSeenGate()) setShowGate(true)
    syncKarma()

    function syncKarma() {
      const lvl = getKarmaLevel()
      setKarmaEmoji(lvl.emoji)
      setKarmaLabel(lvl.label)
      setKarmaXp(lvl.xp)
      setKarmaNextThreshold(lvl.nextThreshold)
    }

    function onStats() {
      const lvl = getKarmaLevel()
      const prev = karmaXp
      setKarmaEmoji(lvl.emoji)
      setKarmaLabel(lvl.label)
      setKarmaXp(lvl.xp)
      setKarmaNextThreshold(lvl.nextThreshold)
      const gained = lvl.xp - prev
      if (gained > 0) {
        setKarmaToast(`+${gained}`)
        setTimeout(() => setKarmaToast(null), 1400)
      }
    }

    function onModeChange(e: Event) {
      const detail = (e as CustomEvent<PartyMode>).detail
      setMode(detail)
    }

    window.addEventListener("inbox-stats-updated", onStats)
    window.addEventListener("inbox-mode-changed", onModeChange)
    return () => {
      window.removeEventListener("inbox-stats-updated", onStats)
      window.removeEventListener("inbox-mode-changed", onModeChange)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeAccountConfig = ACCOUNTS.find(a => a.id === activeAccount)!
  const gmailAccountQuery = `account=${activeAccount}`
  const workNeedsLink = activeAccount === "work" && !session?.workAccountLinked

  // Annotate emails with live todo/snooze state from localStorage
  const annotatedEmails = emails.map(email => ({
    ...email,
    todo: email.todo ?? false,
    snoozedUntil: email.snoozedUntil,
  }))

  const visibleEmails = annotatedEmails.filter(email => {
    if (!email.snoozedUntil) return true
    const today = new Date().toISOString().slice(0, 10)
    return email.snoozedUntil <= today
  })

  const deletableEmails = visibleEmails.filter(email => email.deletable && !email.todo)

  // Synthetic category for the delete tile — appears in the grid when there are deletable emails
  const DELETE_CATEGORY: Category = {
    id: "__delete__",
    name: "🗑️ Delete",
    color: "#888888",
    gmailLabelId: "",
  }

  const todoEmails = visibleEmails.filter(email => email.todo)

  const isPersonalAccount = activeAccount === "personal"

  const briefingEmails = visibleEmails
    .filter(email => !email.todo && (!email.deletable || email.todo))
    .filter(email => {
      const isNewsletter = email.actionFlag === "read"

      if (isNewsletter) {
        // Personal: newsletters never in briefing
        if (isPersonalAccount) return false
        // Work: only if has a clear savings offer AND an expiry within the week
        const text = ((email.summary ?? "") + " " + email.subject).toLowerCase()
        const hasSavings = /\b(off|save|discount|deal|sale|promo|coupon|savings|\$\d|\d+%)\b/.test(text)
        const hasExpiry = /\b(expir|ends?\s+\w|until\s+\w|by\s+(mon|tue|wed|thu|fri|today|tomorrow)|this\s+week|last\s+(chance|day)|hours?\s+left|today\s+only)\b/.test(text)
        return hasSavings && hasExpiry
      }

      // Non-newsletters: existing logic
      return (
        email.priority !== "fyi" ||
        email.actionFlag === "confirm" ||
        /expire|expir|due|deadline|ends?/i.test(email.summary ?? "")
      )
    })
    .sort((a, b) => {
      const rank = (e: Email) => e.priority === "urgent" ? 0 : e.priority === "today" ? 1 : 2
      const diff = rank(a) - rank(b)
      return diff !== 0 ? diff : a.internalDate - b.internalDate
    })

  const urgentCount = emails.filter(email => email.priority === "urgent").length
  const todayCount  = emails.filter(email => email.priority === "today").length
  const fyiCount    = emails.filter(email => email.priority === "fyi").length
  const unreadLeftApprox = Math.max(0, totalUnreadInbox - emails.length)

  function updateImportBatchSize(n: ImportBatchSize) {
    setImportBatchSize(n)
    try { localStorage.setItem(BATCH_PREF_KEY, String(n)) } catch { /* ignore */ }
  }

  // ── Restore cached data ──────────────────────────────────────────────────────

  function rehydrateEmails(rawEmails: Email[]): Email[] {
    const today = new Date().toISOString().slice(0, 10)
    return rawEmails.map(e => ({
      ...e,
      snoozedUntil: e.snoozedUntil && e.snoozedUntil > today ? e.snoozedUntil : undefined,
    }))
  }

  function restoreCache(accountEmail: string) {
    const sess = sessionCache.current.get(accountEmail)
    if (sess) {
      setEmails(rehydrateEmails(sess.emails))
      setCategories(sess.categories)
      setFetchedAt(sess.fetchedAt)
      setTotalEmailsAtLoad(sess.emails.length)
      setTotalUnreadInbox(sess.totalUnreadEstimate ?? sess.emails.length)
      setAppState("ready")
      return true
    }
    const stored = getCachedInbox(accountEmail)
    if (stored) {
      setEmails(rehydrateEmails(stored.emails))
      setCategories(stored.categories)
      setFetchedAt(stored.fetchedAt)
      setTotalEmailsAtLoad(stored.emails.length)
      setTotalUnreadInbox(stored.totalUnreadEstimate ?? stored.emails.length)
      sessionCache.current.set(accountEmail, stored)
      setAppState("ready")
      return true
    }
    return false
  }

  function restoreCategories(accountEmail: string) {
    const saved = getCategories(accountEmail)
    if (saved && saved.length > 0) {
      setCategories(saved)
      setAppState("idle")
      return true
    }
    return false
  }

  // ── Inbox zero: confetti + lotus bloom ──────────────────────────────────────

  useEffect(() => {
    if (appState !== "ready") return
    const count = visibleEmails.filter(e => !e.deletable && !e.snoozedUntil).length
    if (prevEmailCount.current !== null && prevEmailCount.current > 0 && count === 0) {
      if (mode === "party") setConfetti(true)
      setShowLotusBloom(true)
      const LOTUS_QUOTES = [
        "Peace comes from within. Do not seek it without.",
        "The present moment is the only moment available to us.",
        "You yourself, as much as anybody in the entire universe, deserve your love.",
        "Wherever you are, be there totally.",
        "Let go of the past. Let go of the future. Let go of the present.",
      ]
      setLotusQuote(LOTUS_QUOTES[Math.floor(Math.random() * LOTUS_QUOTES.length)])
    }
    prevEmailCount.current = count
  }, [visibleEmails, appState, mode])

  // ── On mount: restore last active account's data ─────────────────────────────

  useEffect(() => {
    const restoredInbox = restoreCache(activeAccountConfig.email)
    if (!restoredInbox) {
      restoreCategories(activeAccountConfig.email)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load inbox ──────────────────────────────────────────────────────────────

  async function loadInbox() {
    setAppState("fetching")
    setErrorMsg("")
    setSelectedEmail(null)
    setEmails([])
    setPendingImportMeta(null)

    try {
      const inboxParams = new URLSearchParams({ account: activeAccount, max: String(importBatchSize) })
      const msgRes = await fetch(`/api/gmail/messages?${inboxParams}`, {
        cache: "no-store",
        credentials: "same-origin",
      })
      if (msgRes.status === 403) {
        const j = (await msgRes.json()) as { code?: string }
        if (j.code === "ACCOUNT_NOT_LINKED") {
          throw new Error(
            `This inbox is not connected yet. Use "Connect work Gmail" in the header, sign in with your work Google account, then click Refresh.`,
          )
        }
      }
      if (msgRes.status === 401) {
        await signIn("google")
        return
      }
      if (!msgRes.ok) throw new Error("Failed to fetch Gmail messages")
      const data = await msgRes.json()
      const rawEmails: RawEmail[] = data.emails
      const totalUnread = typeof data.totalUnread === "number" ? data.totalUnread : rawEmails.length
      const capRaw = data.maxResults
      if (data.todoLabelId) setTodoLabelId(data.todoLabelId)
      const batchCap: ImportBatchSize =
        capRaw === 30 || capRaw === 50 || capRaw === 100 ? capRaw : importBatchSize
      const fetchMeta: InboxFetchMeta = { totalUnreadEstimate: totalUnread, importBatchSize: batchCap }
      setTotalUnreadInbox(totalUnread)

      const saved = getCategories(activeAccountConfig.email)
      if (saved && saved.length > 0) {
        await runCategorization(rawEmails, saved, fetchMeta)
      } else {
        setAppState("proposing")
        setPendingImportMeta(fetchMeta)
        setPendingRawEmails(rawEmails)

        const existingLabelsRes = await fetch(`/api/gmail/labels?${gmailAccountQuery}`, {
          cache: "no-store",
          credentials: "same-origin",
        })
        const fetchedLabelNames: string[] = existingLabelsRes.ok
          ? (await existingLabelsRes.json()).map((l: { name: string }) => l.name)
          : []
        setExistingLabelNames(fetchedLabelNames)

        const proposeSettings = loadSettings()
        const proposeRes = await fetch("/api/ai/propose", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emails: rawEmails,
            existingLabelNames: fetchedLabelNames,
            account: activeAccountConfig.email,
            customContext: activeAccount === "work" ? proposeSettings.workRules : proposeSettings.personalRules,
            systemContext: proposeSettings.systemContext || undefined,
          }),
        })
        if (!proposeRes.ok) {
          const body = await proposeRes.text()
          throw new Error(body || "Failed to propose categories")
        }
        const { categories: proposed } = await proposeRes.json()
        setProposedCategories(proposed)
      }
    } catch (err) {
      setAppState("error")
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong")
      setPendingImportMeta(null)
    }
  }

  // ── Confirm proposed categories ─────────────────────────────────────────────

  async function handleConfirmCategories(proposed: { name: string; color: string }[]) {
    setProposedCategories(null)
    setAppState("categorizing")
    setErrorMsg("")

    try {
      const confirmed: Category[] = []
      for (const cat of proposed) {
        const res = await fetch("/api/gmail/ensure-label", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cat.name, account: activeAccount }),
        })
        if (!res.ok) throw new Error(`Failed to create Gmail label: ${cat.name}`)
        const { id } = await res.json()
        confirmed.push({ id, name: cat.name, color: cat.color, gmailLabelId: id })
      }

      saveCategories(activeAccountConfig.email, confirmed)
      setCategories(confirmed)
      const fetchMeta: InboxFetchMeta = pendingImportMeta ?? {
        totalUnreadEstimate: pendingRawEmails.length,
        importBatchSize: importBatchSize,
      }
      setPendingImportMeta(null)
      await runCategorization(pendingRawEmails, confirmed, fetchMeta)
    } catch (err) {
      setAppState("error")
      setErrorMsg(err instanceof Error ? err.message : "Failed to set up categories")
    }
  }

  // ── Run Claude categorization ────────────────────────────────────────────────

  const runCategorization = useCallback(async (rawEmails: RawEmail[], cats: Category[], fetchMeta: InboxFetchMeta) => {
    setAppState("categorizing")
    setCategories(cats)

    // Strip htmlBody and attachments before sending to Claude (not needed for categorization)
    const emailsForApi = rawEmails.map(({ htmlBody: _, attachments: __, ...rest }) => rest)
    const catSettings = loadSettings()
    const catRes = await fetch("/api/ai/categorize", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emails: emailsForApi,
        categories: cats,
        account: activeAccountConfig.email,
        customContext: activeAccount === "work" ? catSettings.workRules : catSettings.personalRules,
        systemContext: catSettings.systemContext || undefined,
        aiPastEventDelete: catSettings.aiPastEventDelete !== false,
      }),
    })
    if (!catRes.ok) {
      const body = await catRes.text()
      let message = "Failed to categorize emails"
      try {
        const json = JSON.parse(body)
        if (json?.error) message = json.error
      } catch {
        if (body) message = body
      }
      throw new Error(message)
    }
    const categorized: Email[] = await catRes.json()

    const htmlBodyMap    = new Map(rawEmails.map(e => [e.id, e.htmlBody]))
    const attachmentsMap = new Map(rawEmails.map(e => [e.id, e.attachments]))
    const labelIdMap     = new Map(rawEmails.map(e => [e.id, e.labelIds]))
    categorized.forEach(email => {
      email.htmlBody    = htmlBodyMap.get(email.id)
      email.attachments = attachmentsMap.get(email.id)
      const labelIds = labelIdMap.get(email.id) ?? []
      if (todoLabelId && labelIds.includes(todoLabelId)) email.todo = true
    })

    categorized.forEach(email => {
      const cat = cats.find(c => c.name === email.category)
      if (cat?.gmailLabelId) {
        fetch("/api/gmail/label", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: email.id, gmailLabelId: cat.gmailLabelId, account: activeAccount }),
        }).catch(() => {})
      }
    })

    const now = new Date().toISOString()
    setEmails(categorized)
    setTotalEmailsAtLoad(categorized.length)
    setFetchedAt(now)
    setAppState("ready")

    // Mindful Purge: find old promo/newsletter emails
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const purgeableCandidates = categorized.filter(e =>
      e.actionFlag === "read" &&
      e.internalDate < sevenDaysAgo &&
      !e.todo &&
      !e.snoozedUntil
    )
    if (purgeableCandidates.length >= 5) {
      setMindfulPurge(purgeableCandidates)
      setPurgeDismissed(false)
      setPurgeShattered(false)
    }

    const cache: InboxCache = {
      account: activeAccountConfig.email,
      emails: categorized,
      categories: cats,
      fetchedAt: now,
      totalUnreadEstimate: fetchMeta.totalUnreadEstimate,
      importBatchSize: fetchMeta.importBatchSize,
    }
    sessionCache.current.set(activeAccountConfig.email, cache)
    saveCachedInbox(activeAccountConfig.email, categorized, cats, {
      fetchedAt: now,
      totalUnreadEstimate: fetchMeta.totalUnreadEstimate,
      importBatchSize: fetchMeta.importBatchSize,
    })

    // ── Delivery chain cleanup (AI action — off via settings) ─────────────────
    const deliveryCleanupEnabled = loadSettings().aiDeliveryChainCleanup !== false
    if (deliveryCleanupEnabled) {
      const deliveredFromInbox = categorized.find(e => e.packageDelivered && e.orderSender)
      if (deliveredFromInbox?.orderSender) {
        fetch("/api/ai/package-cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliveredEmailId: deliveredFromInbox.id,
            orderSender: deliveredFromInbox.orderSender,
            account: activeAccount,
          }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.emails?.length > 0) {
              setPackageCleanup({ emails: data.emails, sender: deliveredFromInbox.orderSender! })
              setCleanupChecked(new Set(data.emails.map((e: { id: string }) => e.id)))
            }
          })
          .catch(() => {})
      } else {
        fetch(`/api/gmail/recent-deliveries?${gmailAccountQuery}`)
          .then(r => r.json())
          .then((deliveries: { id: string; subject: string; from: string; sender: string }[]) => {
            if (!deliveries?.length) return
            const first = deliveries[0]
            if (!first) return
            fetch("/api/ai/package-cleanup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deliveredEmailId: first.id, orderSender: first.sender, account: activeAccount }),
            })
              .then(r => r.json())
              .then(data => {
                if (data.emails?.length > 0) {
                  setPackageCleanup({ emails: data.emails, sender: first.sender })
                  setCleanupChecked(new Set(data.emails.map((e: { id: string }) => e.id)))
                }
              })
              .catch(() => {})
          })
          .catch(() => {})
      }
    }
  }, [activeAccount, activeAccountConfig.email, gmailAccountQuery])

  const writeInboxCache = useCallback((next: Email[], cats: Category[], opt?: { totalUnreadEstimate?: number }) => {
    const sess = sessionCache.current.get(activeAccountConfig.email)
    const ft = fetchedAt ?? sess?.fetchedAt ?? new Date().toISOString()
    const totalUnreadEstimate = opt?.totalUnreadEstimate !== undefined ? opt.totalUnreadEstimate : sess?.totalUnreadEstimate
    const ib = sess?.importBatchSize
    saveCachedInbox(activeAccountConfig.email, next, cats, {
      fetchedAt: ft,
      ...(totalUnreadEstimate !== undefined && { totalUnreadEstimate }),
      ...(ib !== undefined && { importBatchSize: ib }),
    })
    sessionCache.current.set(activeAccountConfig.email, {
      account: activeAccountConfig.email,
      emails: next,
      categories: cats,
      fetchedAt: ft,
      totalUnreadEstimate,
      importBatchSize: ib,
    })
  }, [activeAccountConfig.email, fetchedAt])

  // ── Account switch ───────────────────────────────────────────────────────────

  function handleAccountSwitch(id: AccountId) {
    setActiveAccount(id)
    setSelectedEmail(null)
    setProposedCategories(null)
    setErrorMsg("")

    const accountEmail = ACCOUNTS.find(a => a.id === id)!.email
    const restoredInbox = restoreCache(accountEmail)
    if (!restoredInbox) {
      const restoredCategories = restoreCategories(accountEmail)
      setEmails([])
      setFetchedAt(null)
      setTotalUnreadInbox(0)
      if (!restoredCategories) {
        setCategories([])
      }
    }
  }

  // ── Email actions ────────────────────────────────────────────────────────────

  function handleArchive(email: Email) {
    recordAction("archive")
    setEmails(prev => {
      const next = prev.filter(e => e.id !== email.id)
      const sess = sessionCache.current.get(activeAccountConfig.email)
      const base = sess?.totalUnreadEstimate ?? totalUnreadInbox
      const nu = Math.max(0, base - 1)
      setTotalUnreadInbox(nu)
      writeInboxCache(next, categories, { totalUnreadEstimate: nu })
      return next
    })
    setSelectedEmail(null)
    fetch("/api/gmail/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: email.id, account: activeAccount }),
    }).catch(() => {})
  }

  function handleMarkRead(email: Email) {
    setEmails(prev => {
      const next = prev.filter(e => e.id !== email.id)
      const sess = sessionCache.current.get(activeAccountConfig.email)
      const base = sess?.totalUnreadEstimate ?? totalUnreadInbox
      const nu = Math.max(0, base - 1)
      setTotalUnreadInbox(nu)
      writeInboxCache(next, categories, { totalUnreadEstimate: nu })
      return next
    })
    if (selectedEmail?.id === email.id) setSelectedEmail(null)
    fetch("/api/gmail/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: email.id, account: activeAccount }),
    }).catch(() => {})
  }

  async function handleSaveDraft(email: Email, body: string, attachments: Attachment[], forwardTo?: string) {
    const isForward = Boolean(forwardTo)
    await fetch("/api/gmail/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: isForward ? forwardTo : email.fromEmail,
        subject: isForward
          ? (email.subject.toLowerCase().startsWith("fwd:") ? email.subject : `Fwd: ${email.subject}`)
          : email.subject,
        body,
        threadId: isForward ? undefined : email.threadId,
        inReplyTo: isForward ? undefined : email.messageId,
        messageId: isForward ? undefined : email.messageId,
        account: activeAccount,
        attachments: attachments.length > 0 ? attachments : undefined,
      }),
    })
    recordAction("saveDraft", { emailId: email.id, subject: email.subject, mode: isForward ? "forward" : "reply" })
  }

  function handleSendMessage(email: Email, mode: "reply" | "forward", body: string, attachments: Attachment[], forwardTo?: string) {
    const to = mode === "forward" ? forwardTo?.trim() ?? "" : email.fromEmail
    if (mode === "forward" && !to) throw new Error("Forward recipient is required")
    if (!to) throw new Error("Recipient email address is missing")

    const subject = mode === "forward"
      ? (email.subject.toLowerCase().startsWith("fwd:") ? email.subject : `Fwd: ${email.subject}`)
      : email.subject

    setEmails(prev => prev.map(e =>
      e.id === email.id
        ? { ...e, replied: mode === "reply" ? true : e.replied, forwarded: mode === "forward" ? true : e.forwarded }
        : e
    ))
    recordAction(mode === "forward" ? "forwardSent" : "replySent", { emailId: email.id, subject: email.subject, mode })
    handleMarkRead(email)

    fetch("/api/gmail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject,
        body,
        threadId: email.threadId,
        inReplyTo: mode === "reply" ? email.messageId : undefined,
        messageId: mode === "reply" ? email.messageId : undefined,
        account: activeAccount,
        attachments: attachments.length > 0 ? attachments : undefined,
      }),
    }).catch(() => {})
  }

  function handleStar(email: Email) {
    recordAction("star")
    setEmails(prev => {
      const next = prev.filter(e => e.id !== email.id)
      writeInboxCache(next, categories)
      return next
    })
    if (selectedEmail?.id === email.id) setSelectedEmail(null)
    fetch("/api/gmail/star", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: email.id, account: activeAccount }),
    }).catch(() => {})
  }

  function handleDelete(email: Email) {
    recordAction("delete")
    setEmails(prev => {
      const next = prev.filter(e => e.id !== email.id)
      const sess = sessionCache.current.get(activeAccountConfig.email)
      const base = sess?.totalUnreadEstimate ?? totalUnreadInbox
      const nu = Math.max(0, base - 1)
      setTotalUnreadInbox(nu)
      writeInboxCache(next, categories, { totalUnreadEstimate: nu })
      return next
    })
    if (selectedEmail?.id === email.id) setSelectedEmail(null)
    fetch("/api/gmail/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: email.id, account: activeAccount }),
    }).catch(() => {})
  }

  function handleToggleTodo(email: Email) {
    const next = !email.todo
    setEmails(prev => {
      const updated = prev.map(e => e.id === email.id ? { ...e, todo: next } : e)
      writeInboxCache(updated, categories)
      return updated
    })
    if (selectedEmail?.id === email.id) setSelectedEmail(prev => prev ? { ...prev, todo: next } : null)
    fetch("/api/gmail/todo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: email.id, value: next, account: activeAccount }),
    })
      .then(r => r.json())
      .then(data => { if (data.labelId) setTodoLabelId(data.labelId) })
      .catch(() => {})
  }

  function handleSnooze(email: Email, until: string) {
    snoozeEmail(email.id, until)
    setEmails(prev => {
      const updated = prev.map(e => e.id === email.id ? { ...e, snoozedUntil: until } : e)
      writeInboxCache(updated, categories)
      return updated
    })
    setSnoozeTarget(null)
    if (selectedEmail?.id === email.id) setSelectedEmail(null)
  }

  function handleMarkDeletable(email: Email) {
    setEmails(prev => {
      const updated = prev.map(e => e.id === email.id ? { ...e, deletable: true } : e)
      writeInboxCache(updated, categories)
      return updated
    })
    if (selectedEmail?.id === email.id) setSelectedEmail(null)
  }

  async function handleNewCategory(name: string, color: string): Promise<string> {
    const res = await fetch("/api/gmail/ensure-label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, account: activeAccount }),
    })
    const { id } = await res.json() as { id: string }
    const newCat: Category = { id, name, color, gmailLabelId: id }
    const updated = [...categories, newCat]
    setCategories(updated)
    saveCategories(activeAccountConfig.email, updated)
    return id
  }

  function handleMarkReplied(email: Email) {
    setEmails(prev => {
      const updated = prev.map(e => e.id === email.id ? { ...e, replied: true } : e)
      writeInboxCache(updated, categories)
      return updated
    })
    if (selectedEmail?.id === email.id) setSelectedEmail(prev => prev ? { ...prev, replied: true } : null)
  }

  async function handleRecategorize(email: Email, newCategory: string, teachClaude: boolean) {
    const cat = categories.find(c => c.name === newCategory)
    setEmails(prev => {
      const updated = prev.map(e => e.id === email.id ? { ...e, category: newCategory } : e)
      writeInboxCache(updated, categories)
      return updated
    })
    if (selectedEmail?.id === email.id) setSelectedEmail(prev => prev ? { ...prev, category: newCategory } : null)
    if (cat?.gmailLabelId) {
      await fetch("/api/gmail/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: email.id, gmailLabelId: cat.gmailLabelId, account: activeAccount }),
      }).catch(() => {})
    }
    if (teachClaude && newCategory) {
      const rule = {
        id: `${email.fromEmail}->${newCategory}`.toLowerCase().replace(/[^a-z0-9@.\-_>]/g, "-"),
        description: `${email.from} → ${newCategory}`,
        fromPattern: email.fromEmail,
        category: newCategory,
        createdAt: new Date().toISOString(),
      }
      await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      }).catch(() => {})
    }
  }

  async function handleRoast() {
    if (roasting || emails.length === 0) return
    setRoasting(true)
    setRoast(null)
    try {
      const payload = emails.map(e => ({ from: e.from, subject: e.subject, category: e.category, priority: e.priority }))
      const res = await fetch("/api/ai/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: payload, mode }),
      })
      const data = await res.json()
      setRoast(data.roast ?? null)
    } catch {
      const fallbacks: Record<PartyMode, string> = {
        party: "Claude took one look at your inbox and had nothing to say.",
        zen: "The inbox, like the mind, resists summary.",
        "wabi-sabi": "Roast failed. Your inbox remains.",
      }
      setRoast(fallbacks[mode])
    } finally {
      setRoasting(false)
    }
  }

  const isLoading = appState === "fetching" || appState === "categorizing" || appState === "proposing"

  function handleToggleMode() {
    const cycle: PartyMode[] = ["zen", "party", "wabi-sabi"]
    const next = cycle[(cycle.indexOf(mode) + 1) % cycle.length]
    setPartyMode(next)
    setMode(next)
    setRoast(null)
  }

  async function handleMindfulPurge() {
    setPurgeShattered(true)
    const toDelete = [...mindfulPurge]
    await Promise.all(
      toDelete.map(email =>
        fetch("/api/gmail/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: email.id, account: activeAccount }),
        }).catch(() => {})
      )
    )
    setEmails(prev => prev.filter(e => !toDelete.some(d => d.id === e.id)))
    for (const _ of toDelete) recordAction("delete")
    setTimeout(() => {
      setMindfulPurge([])
      setPurgeDismissed(true)
    }, 600)
  }

  // ── Quote Gate ───────────────────────────────────────────────────────────────

  if (showGate) {
    return (
      <QuoteGate onEnter={(m) => {
        setMode(m)
        setShowGate(false)
      }} />
    )
  }

  // ── Category proposal screen ─────────────────────────────────────────────────

  if (proposedCategories) {
    return (
      <CategoryProposal
        proposed={proposedCategories}
        account={activeAccountConfig.email}
        existingLabelNames={existingLabelNames}
        onConfirm={handleConfirmCategories}
      />
    )
  }

  // ── Theme accent — use everywhere instead of hardcoded #FF1F6E ──────────────
  const themeAccent = mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "#111111" : "#FF1F6E"

  // ── FESTIVAL RENDER ──────────────────────────────────────────────────────────

  const pageBg = mode === "zen"
    ? "#FAF6EE"
    : mode === "wabi-sabi"
      ? "#FFFFFF"
      : "#EEE4FF"

  const ambientGlow = mode === "zen"
    ? `radial-gradient(ellipse 90% 55% at 8% 0%, rgba(200,150,12,0.06) 0%, transparent 55%),
       radial-gradient(ellipse 70% 50% at 92% 100%, rgba(0,200,160,0.04) 0%, transparent 55%),
       radial-gradient(ellipse 50% 40% at 55% 55%, rgba(200,150,12,0.02) 0%, transparent 60%)`
    : mode === "wabi-sabi"
      ? `radial-gradient(ellipse 90% 55% at 8% 0%, rgba(26,10,53,0.03) 0%, transparent 55%),
         radial-gradient(ellipse 70% 50% at 92% 100%, rgba(26,10,53,0.02) 0%, transparent 55%),
         radial-gradient(ellipse 50% 40% at 55% 55%, rgba(26,10,53,0.01) 0%, transparent 60%)`
      : `radial-gradient(ellipse 90% 55% at 8% 0%, rgba(255,31,110,0.07) 0%, transparent 55%),
         radial-gradient(ellipse 70% 50% at 92% 100%, rgba(0,229,196,0.05) 0%, transparent 55%),
         radial-gradient(ellipse 50% 40% at 55% 55%, rgba(255,208,0,0.03) 0%, transparent 60%)`

  return (
    <div className={`relative min-h-screen mode-${mode}`} style={{ background: pageBg, color: "#1A0A35" }}>

      {/* Ambient background glows */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: ambientGlow }}
      />

      <div className="relative z-10 flex flex-col">

        {/* ══════════════════ HEADER ══════════════════════════════════════════ */}
        <header style={{ padding: "24px 28px 20px", borderBottom: "1px solid rgba(26,10,53,0.08)" }}>

          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">

            {/* Left: Logo + stats */}
            <div className="flex flex-col gap-5">

              {/* Logo row + mode selector */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div style={{
                    width: 52, height: 52, flexShrink: 0,
                    borderRadius: 14,
                    background: mode === "zen"
                      ? "linear-gradient(135deg, #C8960C 0%, #B07B0A 100%)"
                      : mode === "wabi-sabi"
                        ? "transparent"
                        : "linear-gradient(135deg, #FF1F6E 0%, #FF6B1A 100%)",
                    border: mode === "wabi-sabi" ? "2px solid #111" : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 26,
                    boxShadow: mode === "zen"
                      ? "0 8px 32px rgba(200,150,12,0.30)"
                      : mode === "wabi-sabi"
                        ? "none"
                        : "0 8px 32px rgba(255,31,110,0.38)",
                    transition: "all 0.3s ease",
                  }}>
                    ✉️
                  </div>
                  <div>
                    <h1 style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "clamp(2rem, 5vw, 3.2rem)",
                      lineHeight: 1,
                      color: mode === "zen" ? "#3D2800" : "#1A0A35",
                      margin: 0,
                      transition: "color 0.3s ease",
                    }}>
                      EMAIL PARTY
                    </h1>
                    <p style={{
                      fontSize: "0.78rem",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: mode === "zen" ? "rgba(61,40,0,0.40)" : "rgba(26,10,53,0.35)",
                      margin: "5px 0 0",
                      transition: "color 0.3s ease",
                    }}>
                      {mode === "zen" ? "Your Mindful Inbox" : mode === "wabi-sabi" ? "ur inbox bestie ✨" : "Your AI-Powered Inbox"}
                    </p>
                  </div>
                </div>

                {/* ── 3-way mode selector + Settings + Sign out ── */}
                <div className="flex items-center gap-2">
                  {([
                    { id: "party",     emoji: "🎉", label: "Party",    activeBg: "#FF1F6E", activeText: "#1A0A35", accentHex: "#FF1F6E" },
                    { id: "wabi-sabi", emoji: "☕", label: "Basic AF", activeBg: "transparent", activeText: "#111", accentHex: "#111" },
                    { id: "zen",       emoji: "🧘", label: "Zen",      activeBg: "#C8960C", activeText: "#3D2800", accentHex: "#C8960C" },
                  ] as { id: PartyMode; emoji: string; label: string; activeBg: string; activeText: string; accentHex: string }[]).map(m => {
                    const isActive = mode === m.id
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setPartyMode(m.id); setMode(m.id); setRoast(null) }}
                        style={{
                          padding: "7px 16px", borderRadius: 999, cursor: "pointer",
                          border: isActive
                            ? (m.id === "party" ? `1.5px solid ${m.activeBg}` : `1.5px solid ${m.accentHex}55`)
                            : `1px solid ${m.accentHex}44`,
                          background: isActive
                            ? (m.id === "party" ? m.activeBg : "#FFFFFF")
                            : "transparent",
                          color: isActive ? m.accentHex : m.accentHex,
                          fontSize: "0.82rem", fontWeight: isActive ? 700 : 500,
                          letterSpacing: "0.04em",
                          display: "flex", alignItems: "center", gap: 5,
                          transition: "all 0.18s ease",
                          opacity: isActive ? 1 : 0.6,
                          boxShadow: isActive
                            ? (m.id === "party" ? `0 2px 12px ${m.activeBg}33` : "0 1px 4px rgba(0,0,0,0.08)")
                            : "none",
                        }}
                      >
                        {m.emoji} {m.label}
                      </button>
                    )
                  })}
                  <div style={{ width: 1, height: 20, background: "rgba(26,10,53,0.12)", margin: "0 2px" }} />
                  <button
                    type="button"
                    onClick={() => setInstructionsOpen(true)}
                    title="Settings & AI Instructions"
                    style={{
                      width: 34, height: 34, borderRadius: 9,
                      border: mode === "zen" ? "1px solid rgba(200,150,12,0.28)" : mode === "wabi-sabi" ? "1.5px solid rgba(26,10,53,0.18)" : "1px solid rgba(139,63,216,0.30)",
                      background: mode === "zen" ? "rgba(200,150,12,0.06)" : mode === "wabi-sabi" ? "#FFFFFF" : "rgba(139,63,216,0.08)",
                      color: mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "#1A0A35" : "#8B3FD8",
                      fontSize: "1rem", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    ⚙️
                  </button>
                  <button
                    type="button"
                    onClick={() => signOut({ redirectTo: "/" })}
                    style={{
                      padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                      border: mode === "zen" ? "1px solid rgba(200,150,12,0.28)" : mode === "wabi-sabi" ? "1.5px solid rgba(26,10,53,0.18)" : "1px solid rgba(139,63,216,0.30)",
                      background: "transparent",
                      color: mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "#1A0A35" : "#8B3FD8",
                      fontSize: "0.82rem", fontWeight: 500,
                      opacity: 0.7,
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </div>

              {/* Stats — only when ready */}
              {appState === "ready" && (
                <div className="flex flex-col gap-3">

                  {/* Ticket stats */}
                  <div className="flex flex-wrap items-stretch gap-2">
                    <TallyTicket loaded={emails.length} total={totalUnreadInbox} mode={mode} />
                    <div className="flex items-stretch gap-1">
                      <MiniStat value={urgentCount} label="urgent" color={mode === "party" ? "#FF1F6E" : themeAccent} mode={mode} />
                      <MiniStat value={todayCount}  label="today"  color={mode === "party" ? "#FFD000" : themeAccent} mode={mode} />
                      <MiniStat value={fyiCount}    label="fyi"    color={mode === "party" ? "#00E5C4" : themeAccent} mode={mode} />
                    </div>
                    <div className="flex items-center">
                      <AccountToggle
                        active={activeAccount}
                        onChange={handleAccountSwitch}
                        loading={isLoading}
                      />
                    </div>
                  </div>

                  {/* Controls row */}
                  {!workNeedsLink && (
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Batch size picker + Refresh */}
                      <div className="flex items-end gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span style={{ fontSize: "0.70rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(26,10,53,0.56)" }}>
                          Per refresh
                        </span>
                        <div className="flex rounded-full p-0.5" style={{ border: "1px solid rgba(26,10,53,0.10)", background: "rgba(26,10,53,0.03)" }}>
                          {IMPORT_BATCH_OPTIONS.map(n => (
                            <button
                              key={n}
                              type="button"
                              disabled={isLoading}
                              onClick={() => updateImportBatchSize(n)}
                              className="min-w-9 px-2 py-1 rounded-full transition-colors disabled:opacity-40"
                              style={{
                                background: mode === "wabi-sabi" ? "transparent" : (importBatchSize === n ? themeAccent : "transparent"),
                                color: mode === "wabi-sabi"
                                  ? (importBatchSize === n ? "#111" : "rgba(17,17,17,0.38)")
                                  : (importBatchSize === n ? (mode === "zen" ? "#3D2800" : "#1A0A35") : "rgba(26,10,53,0.42)"),
                                fontSize: "0.84rem",
                                fontWeight: mode === "wabi-sabi" && importBatchSize === n ? 800 : 600,
                                border: mode === "wabi-sabi" && importBatchSize === n ? "1.5px solid #111" : "none",
                                cursor: "pointer",
                              }}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={loadInbox}
                        disabled={isLoading || workNeedsLink}
                        style={{
                          padding: "6px 18px", borderRadius: 999,
                          background: isLoading
                            ? (mode === "zen" ? "rgba(200,150,12,0.30)" : "rgba(255,31,110,0.3)")
                            : (mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "transparent" : "#FF1F6E"),
                          color: mode === "zen" ? "#FFF8E0" : mode === "wabi-sabi" ? "#111" : "#1A0A35",
                          fontSize: "0.82rem", fontWeight: mode === "wabi-sabi" ? 800 : 700,
                          letterSpacing: "0.07em", textTransform: "uppercase",
                          cursor: isLoading ? "not-allowed" : "pointer",
                          border: mode === "wabi-sabi" ? "1.5px solid rgba(17,17,17,0.25)" : "none",
                          fontFamily: "var(--font-body)",
                          boxShadow: isLoading ? "none"
                            : mode === "zen" ? "0 4px 20px rgba(200,150,12,0.30)"
                            : mode === "wabi-sabi" ? "none"
                            : "0 4px 20px rgba(255,31,110,0.45)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {appState === "fetching" ? "Fetching…"
                          : appState === "proposing" ? "Analyzing…"
                          : appState === "categorizing" ? "Sorting…"
                          : "Refresh"}
                      </button>
                      </div>

                      {/* Roast button — theme-aware */}
                      {(() => {
                        const roastConfig = mode === "zen"
                          ? { border: "1px solid rgba(200,150,12,0.35)", bg: "rgba(200,150,12,0.07)", color: "#C8960C", idle: "🪷 Read my inbox", busy: "Reading…" }
                          : mode === "wabi-sabi"
                            ? { border: "1px solid rgba(26,10,53,0.22)", bg: "rgba(26,10,53,0.05)", color: "#1A0A35", idle: "☕ Spill the tea", busy: "Spilling…" }
                            : { border: "1px solid rgba(255,107,26,0.40)", bg: "rgba(255,107,26,0.09)", color: "#FF6B1A", idle: "🔥 Roast my inbox", busy: "Roasting…" }
                        return (
                          <button
                            onClick={handleRoast}
                            disabled={roasting || emails.length === 0}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "6px 14px", borderRadius: 999,
                              border: roastConfig.border,
                              background: roastConfig.bg,
                              color: roastConfig.color,
                              fontSize: "0.84rem", fontWeight: 600,
                              cursor: "pointer",
                              opacity: roasting || emails.length === 0 ? 0.4 : 1,
                            }}
                          >
                            {roasting ? roastConfig.busy : roastConfig.idle}
                          </button>
                        )
                      })()}
                    </div>
                  )}

                  {/* Roast text — theme-aware */}
                  {roast && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, maxWidth: 500 }}>
                      <span style={{
                        fontSize: "0.85rem",
                        fontStyle: "italic",
                        color: mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "#1A0A35" : "#FF6B1A",
                        flex: 1,
                        letterSpacing: mode === "wabi-sabi" ? "0.02em" : undefined,
                      }}>
                        &ldquo;{roast}&rdquo;
                      </span>
                      <button
                        onClick={() => setRoast(null)}
                        style={{ color: "rgba(26,10,53,0.56)", fontSize: "1rem", background: "none", border: "none", cursor: "pointer", lineHeight: 1, flexShrink: 0, marginTop: 1 }}
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {/* Muted footnote */}
                  <p style={{ fontSize: "0.78rem", color: "rgba(26,10,53,0.52)", maxWidth: 480, lineHeight: 1.5, margin: 0 }}>
                    Fetching {importBatchSize} at a time.
                    {unreadLeftApprox > 0
                      ? ` ~${unreadLeftApprox} more unread waiting — refresh to load the next batch.`
                      : emails.length >= importBatchSize
                        ? " Hit batch cap — refresh to check for more."
                        : " You're all caught up with this batch!"}
                  </p>
                </div>
              )}
            </div>

            {/* Right: Karma + Mode Toggle + Action buttons + TODO widget */}
            <div className="flex items-start gap-3 flex-wrap">
              <KarmaPill
                emoji={karmaEmoji}
                label={karmaLabel}
                xp={karmaXp}
                nextThreshold={karmaNextThreshold}
                toast={karmaToast}
                mode={mode}
              />
              <div className="flex items-center gap-2 flex-wrap">
                {workNeedsLink && activeAccountConfig.email && (
                  <button
                    type="button"
                    onClick={() =>
                      signIn(
                        "google",
                        { redirectTo: typeof window !== "undefined" ? window.location.pathname : "/" },
                        { login_hint: activeAccountConfig.email, prompt: "select_account consent" },
                      )
                    }
                    style={{
                      padding: "9px 20px", borderRadius: 999,
                      border: "1px solid rgba(255,208,0,0.5)",
                      background: "rgba(255,208,0,0.10)",
                      color: "#FFD000",
                      fontSize: "0.8rem", fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Connect work Gmail
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setComposeOpen(true)}
                  disabled={workNeedsLink}
                  style={{
                    padding: "9px 20px", borderRadius: 999,
                    border: mode === "zen"
                      ? "1px solid rgba(200,150,12,0.35)"
                      : mode === "wabi-sabi"
                        ? "1.5px solid rgba(26,10,53,0.18)"
                        : "1px solid rgba(0,229,196,0.40)",
                    background: mode === "wabi-sabi" ? "transparent" : mode === "zen" ? "rgba(200,150,12,0.07)" : "rgba(0,229,196,0.08)",
                    color: mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "#111" : "#00E5C4",
                    fontSize: "0.8rem", fontWeight: 600,
                    cursor: "pointer",
                    opacity: workNeedsLink ? 0.4 : 1,
                    boxShadow: "none",
                  }}
                >
                  Compose
                </button>
                {appState !== "ready" && (
                  <button
                    onClick={loadInbox}
                    disabled={isLoading || workNeedsLink}
                    style={{
                      padding: "9px 24px", borderRadius: 999,
                      background: mode === "wabi-sabi"
                        ? "transparent"
                        : isLoading || workNeedsLink
                          ? (mode === "zen" ? "rgba(200,150,12,0.30)" : "rgba(255,31,110,0.3)")
                          : (mode === "zen" ? "#C8960C" : "#FF1F6E"),
                      color: mode === "zen" ? "#FFF8E0" : mode === "wabi-sabi" ? "#111" : "#1A0A35",
                      fontSize: "0.82rem", fontWeight: mode === "wabi-sabi" ? 800 : 700,
                      letterSpacing: "0.07em", textTransform: "uppercase",
                      cursor: isLoading || workNeedsLink ? "not-allowed" : "pointer",
                      border: mode === "wabi-sabi" ? "1.5px solid rgba(17,17,17,0.25)" : "none",
                      fontFamily: "var(--font-body)",
                      boxShadow: isLoading || workNeedsLink ? "none"
                        : mode === "zen" ? "0 4px 20px rgba(200,150,12,0.30)"
                        : mode === "wabi-sabi" ? "none"
                        : "0 4px 20px rgba(255,31,110,0.45)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {appState === "fetching" ? "Fetching…"
                      : appState === "proposing" ? "Analyzing…"
                      : appState === "categorizing" ? "Sorting…"
                      : "Load Inbox"}
                  </button>
                )}
              </div>

              {/* TODO widget */}
              {appState === "ready" && todoEmails.length > 0 && (
                <div
                  className="sticky top-4 self-start overflow-hidden"
                  style={{
                    background: mode === "zen" ? "#FFFEF9" : "#FFFFFF",
                    border: "1px solid rgba(255,208,0,0.28)",
                    borderRadius: 14,
                    boxShadow: mode === "wabi-sabi" ? "none" : "0 4px 24px rgba(255,208,0,0.08)",
                    minWidth: 220, maxWidth: 290,
                  }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{
                      background: "rgba(255,208,0,0.08)",
                      borderBottom: "1px solid rgba(255,208,0,0.12)",
                    }}
                  >
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#FFD000" }}>★ TODO</span>
                    <span style={{
                      fontSize: "0.82rem", fontWeight: 700,
                      background: "rgba(255,208,0,0.18)",
                      border: "none",
                      color: "#FFD000",
                      borderRadius: 99, padding: "1px 8px",
                    }}>
                      {todoEmails.length}
                    </span>
                  </div>
                  <div className="px-2 py-1 space-y-0.5 overflow-y-auto" style={{ maxHeight: 240 }}>
                    {todoEmails.map(email => (
                      <EmailRow
                        key={email.id}
                        email={email}
                        selected={email.id === selectedEmail?.id}
                        isSelected={false}
                        selectionMode={false}
                        mode={mode}
                        onClick={() => { setExpandedEmail(email); setExpandedComposeMode("ai") }}
                        onDoubleClick={() => { setExpandedEmail(email); setExpandedComposeMode(null) }}
                        onMarkRead={() => handleMarkRead(email)}
                        onDelete={() => handleDelete(email)}
                        onReply={() => { setExpandedEmail(email); setExpandedComposeMode("reply") }}
                        onForward={() => { setExpandedEmail(email); setExpandedComposeMode("forward") }}
                        onToggleTodo={() => handleToggleTodo(email)}
                        onSnooze={() => setSnoozeTarget(email)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ══════════════════ MORNING DASHBOARD ══════════════════════════════ */}
        <DashboardPanel emails={emails} mode={mode} />

        {/* ══════════════════ LEGEND BAR ══════════════════════════════════════ */}
        <div
          className="flex flex-wrap items-center gap-3 px-7 py-2"
          style={{ borderBottom: "1px solid rgba(26,10,53,0.05)" }}
        >
          <span style={{ fontSize: "0.84rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(26,10,53,0.60)" }}>
            Priority:
          </span>
          {[
            { color: "#FF1F6E", label: "urgent" },
            { color: "#FFD000", label: "today" },
            { color: "#00E5C4", label: "fyi" },
          ].map(({ color, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              {mode === "wabi-sabi"
                ? <span style={{ width: 7, height: 7, borderRadius: "50%", border: `1.5px solid ${color}`, display: "inline-block", flexShrink: 0 }} />
                : mode === "zen"
                  ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: `${color}55`, border: `1px solid ${color}88`, display: "inline-block", flexShrink: 0 }} />
                  : <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
              }
              <span style={{ fontSize: "0.85rem", color: "rgba(26,10,53,0.60)" }}>{label}</span>
            </span>
          ))}
        </div>

        {/* ══════════════════ MAIN CONTENT ════════════════════════════════════ */}
        <div className="flex">
          <div className="flex-1 min-w-0 p-5">

            {/* ── Idle ── */}
            {appState === "idle" && (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <p style={{ fontSize: "4rem", marginBottom: 14 }}>📬</p>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", color: "rgba(26,10,53,0.45)", margin: "0 0 10px" }}>
                    {mode === "zen" ? "Ready when you are." : mode === "wabi-sabi" ? "ok bestie let's get into it 💅" : "Ready to sort?"}
                  </p>
                  <p style={{ fontSize: "0.78rem", color: "rgba(26,10,53,0.60)", margin: 0 }}>
                    Hit &ldquo;Load Inbox&rdquo; to fetch and sort your emails.
                  </p>
                </div>
              </div>
            )}

            {/* ── Loading ── */}
            {isLoading && (
              <div className="h-64 flex items-center justify-center">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
                  <div className="fiesta-spinner" />
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", color: themeAccent, margin: "0 0 6px", letterSpacing: "0.04em" }}>
                      {appState === "fetching"
                        ? mode === "zen" ? "Receiving your letters…" : mode === "wabi-sabi" ? "OMFG LOADING ✨" : "FETCHING YOUR MAIL"
                        : appState === "proposing"
                          ? mode === "zen" ? "Reading the patterns…" : mode === "wabi-sabi" ? "FIGURING IT OUT 💅" : "ANALYZING PATTERNS"
                          : mode === "zen" ? "Arranging with care…" : mode === "wabi-sabi" ? "ORGANIZING YOUR LIFE ☕" : "SORTING YOUR MAIL"}
                    </p>
                    <p style={{ fontSize: "0.84rem", color: "rgba(26,10,53,0.56)", margin: 0 }}>
                      {appState === "fetching"
                        ? mode === "zen" ? "Gathering your inbox with care." : mode === "wabi-sabi" ? "hang on bestie, getting your emails rn…" : "Checking your inbox…"
                        : appState === "proposing"
                          ? mode === "zen" ? "Observing the shape of your correspondence." : mode === "wabi-sabi" ? "literally analyzing your vibe rn, so exciting…" : "Analyzing your email patterns…"
                          : mode === "zen" ? "Placing each email where it belongs." : mode === "wabi-sabi" ? "Claude is sorting your whole life, you're doing amazing sweetie…" : "Claude is categorizing your emails…"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Error ── */}
            {appState === "error" && (
              <div className="h-64 flex items-center justify-center">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", color: themeAccent, margin: 0 }}>
                    {mode === "wabi-sabi" ? "ok something broke bestie 😬" : "Something went wrong"}
                  </p>
                  <p style={{ fontSize: "0.82rem", color: "rgba(26,10,53,0.48)", margin: 0, maxWidth: 420 }}>{errorMsg}</p>
                  <button
                    onClick={loadInbox}
                    style={{ color: themeAccent, fontSize: "0.8rem", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginTop: 4 }}
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            {/* ── Package cleanup banner ── */}
            {appState === "ready" && packageCleanup && (
              <div className="mb-4 overflow-hidden" style={{
                background: "rgba(255,107,26,0.07)",
                border: "1px solid rgba(255,107,26,0.28)",
                borderRadius: 12,
              }}>
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span style={{ fontSize: "0.8rem", color: "rgba(26,10,53,0.78)" }}>
                    📦 Package from{" "}
                    <span style={{ fontWeight: 700, color: "#FF6B1A" }}>{packageCleanup.sender}</span>
                    {" "}arrived — {packageCleanup.emails.length} shipping email{packageCleanup.emails.length !== 1 ? "s" : ""} found.
                  </span>
                  <button
                    onClick={() => setCleanupExpanded(v => !v)}
                    style={{
                      fontSize: "0.80rem", fontWeight: 600,
                      padding: "3px 10px", borderRadius: 6,
                      border: "1px solid rgba(255,107,26,0.35)",
                      background: "rgba(255,107,26,0.12)",
                      color: "#FF6B1A", cursor: "pointer",
                    }}
                  >
                    {cleanupExpanded ? "▲ Hide" : "▼ Review"}
                  </button>
                  <button
                    onClick={async () => {
                      const toDelete = [...cleanupChecked]
                      await Promise.all(
                        toDelete.map(id =>
                          fetch("/api/gmail/delete", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ messageId: id, account: activeAccount }),
                          }).catch(() => {})
                        )
                      )
                      setEmails(prev => prev.filter(e => !cleanupChecked.has(e.id)))
                      recordAction("cleanupDelete", { details: `Deleted ${toDelete.length} cleanup email${toDelete.length === 1 ? "" : "s"}` })
                      setPackageCleanup(null)
                      setCleanupExpanded(false)
                    }}
                    disabled={cleanupChecked.size === 0}
                    style={{
                      marginLeft: "auto", flexShrink: 0,
                      padding: "4px 12px", borderRadius: 6,
                      background: cleanupChecked.size === 0 ? "rgba(255,107,26,0.2)" : "#FF6B1A",
                      color: "#1A0A35",
                      fontSize: "0.84rem", fontWeight: 700,
                      border: "none", cursor: "pointer",
                      opacity: cleanupChecked.size === 0 ? 0.4 : 1,
                    }}
                  >
                    Delete {cleanupChecked.size > 0 ? `${cleanupChecked.size} ` : ""}selected
                  </button>
                  <button
                    onClick={() => {
                      setPackageCleanup(null)
                      setCleanupExpanded(false)
                    }}
                    style={{
                      flexShrink: 0,
                      padding: "4px 12px", borderRadius: 6,
                      background: "transparent",
                      color: "rgba(26,10,53,0.4)",
                      fontSize: "0.84rem", fontWeight: 600,
                      border: "1px solid rgba(26,10,53,0.10)",
                      cursor: "pointer",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
                {cleanupExpanded && (
                  <div className="divide-y max-h-64 overflow-y-auto" style={{ borderTop: "1px solid rgba(255,107,26,0.18)" }}>
                    {packageCleanup.emails.map(email => {
                      const trackingMatch = email.snippet.match(
                        /(?:tracking(?:\s*(?:number|#|no\.?)?)?[\s:]+|order(?:\s*(?:number|#|no\.?)?)?[\s:]+|#)([A-Z0-9][-A-Z0-9]{5,30})/i
                      )
                      const trackingInfo = trackingMatch ? trackingMatch[0].trim() : null
                      return (
                        <div key={email.id} className="flex items-center gap-3 px-4 py-2" style={{ borderColor: "rgba(26,10,53,0.05)" }}>
                          <input
                            type="checkbox"
                            checked={cleanupChecked.has(email.id)}
                            onChange={e => {
                              setCleanupChecked(prev => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(email.id)
                                else next.delete(email.id)
                                return next
                              })
                            }}
                            style={{ accentColor: "#FF6B1A", flexShrink: 0 }}
                          />
                          <button
                            onClick={() => {
                              setCleanupPreview({ id: email.id, subject: email.subject })
                              setCleanupPreviewHtml(null)
                              fetch(`/api/gmail/html?id=${encodeURIComponent(email.id)}&${gmailAccountQuery}`)
                                .then(r => r.json())
                                .then(d => setCleanupPreviewHtml(d.htmlBody ?? "<p>No content</p>"))
                                .catch(() => setCleanupPreviewHtml("<p>Failed to load</p>"))
                            }}
                            className="flex-1 flex items-center gap-3 text-left min-w-0"
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                          >
                            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "rgba(26,10,53,0.78)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {email.subject}
                            </span>
                            {trackingInfo && (
                              <span style={{ fontSize: "0.80rem", color: "#FF6B1A", fontFamily: "monospace", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                                {trackingInfo}
                              </span>
                            )}
                            {email.date && (
                              <span style={{ fontSize: "0.80rem", color: "rgba(26,10,53,0.60)", marginLeft: "auto", flexShrink: 0 }}>
                                {email.date}
                              </span>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Inbox zero / Lotus Bloom ── */}
            {appState === "ready" && visibleEmails.filter(e => !e.deletable).length === 0 && totalEmailsAtLoad > 0 && showLotusBloom && (
              <div className="mb-4 text-center" style={{
                background: mode === "party"
                  ? "linear-gradient(135deg, rgba(0,229,196,0.12), rgba(184,240,0,0.08))"
                  : "linear-gradient(135deg, rgba(147,197,253,0.10), rgba(0,229,196,0.07))",
                border: `1px solid ${mode === "party" ? "rgba(0,229,196,0.28)" : "rgba(147,197,253,0.25)"}`,
                borderRadius: 20,
                padding: "40px 24px",
                boxShadow: "0 4px 40px rgba(0,229,196,0.07)",
              }}>
                <div className="lotus-bloom-anim" style={{ fontSize: "4rem", marginBottom: 12, display: "inline-block" }}>🪷</div>
                <p style={{
                  fontFamily: "var(--font-display)",
                  fontSize: mode === "party" ? "2.4rem" : "1.8rem",
                  color: "#00E5C4", margin: "0 0 12px", letterSpacing: "0.04em",
                }}>
                  {mode === "party" ? "🎉 INBOX ZERO!" : "Inbox Clear"}
                </p>
                {lotusQuote && (
                  <p style={{
                    fontStyle: "italic", fontSize: "0.88rem",
                    color: "rgba(26,10,53,0.55)", maxWidth: 420, margin: "0 auto 10px",
                    lineHeight: 1.6,
                  }}>
                    &ldquo;{lotusQuote}&rdquo;
                  </p>
                )}
                <p style={{ fontSize: "0.75rem", color: "rgba(26,10,53,0.45)", margin: 0 }}>
                  You triaged everything in this batch. Refresh to load more.
                </p>
              </div>
            )}

            {/* ── Daily Briefing ── */}
            {appState === "ready" && briefingEmails.length > 0 && (
              <div className="mb-6">
              <BriefingSection
                mode={mode}
                emails={briefingEmails}
                categories={categories}
                selectedEmail={selectedEmail}
                onSelect={email => setSelectedEmail(prev => prev?.id === email.id ? null : email)}
                onExpand={(email, composeMode) => {
                  setExpandedEmail(email)
                  setExpandedComposeMode(composeMode ?? null)
                }}
                onClose={() => setSelectedEmail(null)}
                onMarkRead={handleMarkRead}
                onArchive={handleArchive}
                onSaveDraft={handleSaveDraft}
                onSend={handleSendMessage}
                onStar={handleStar}
                onDelete={handleDelete}
                onRecategorize={handleRecategorize}
                onMarkReplied={handleMarkReplied}
                onMarkDeletable={handleMarkDeletable}
                onNewCategory={handleNewCategory}
                onToggleTodo={handleToggleTodo}
                onSnooze={email => setSnoozeTarget(email)}
                gmailAccount={activeAccount}
              />
              </div>
            )}

            {/* ── Mindful Purge boulder ── */}
            {appState === "ready" && mindfulPurge.length >= 5 && !purgeDismissed && (
              <div className="mb-4 overflow-hidden" style={{
                background: "linear-gradient(135deg, rgba(139,63,216,0.09), rgba(255,31,110,0.06))",
                border: "1px solid rgba(139,63,216,0.28)",
                borderRadius: 14,
                transition: "opacity 0.4s ease",
                opacity: purgeShattered ? 0 : 1,
              }}>
                <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
                  <span style={{
                    fontSize: "2rem", lineHeight: 1, flexShrink: 0,
                    display: "inline-block",
                    animation: purgeShattered ? "none" : "boulder-rock 2s ease-in-out infinite",
                  }}>🪨</span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#8B3FD8" }}>
                      Mindful Purge — The Boulder
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "rgba(26,10,53,0.55)", marginTop: 2 }}>
                      {mindfulPurge.length} old newsletter{mindfulPurge.length !== 1 ? "s" : ""} &amp; promos (7+ days). One tap clears the clutter.
                    </div>
                  </div>
                  <button
                    onClick={handleMindfulPurge}
                    disabled={purgeShattered}
                    style={{
                      padding: "8px 20px", borderRadius: 999,
                      background: purgeShattered ? "rgba(139,63,216,0.3)" : "#8B3FD8",
                      color: "white", fontSize: "0.82rem", fontWeight: 700,
                      border: "none", cursor: purgeShattered ? "not-allowed" : "pointer",
                      boxShadow: purgeShattered ? "none" : "0 4px 16px rgba(139,63,216,0.30)",
                      transition: "all 0.2s",
                    }}
                  >
                    ⚡ Shatter It
                  </button>
                  <button
                    onClick={() => setPurgeDismissed(true)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "rgba(26,10,53,0.35)", fontSize: "0.78rem", padding: "4px 8px",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* ── Category grid ── */}
            {appState === "ready" && categories.length > 0 && (() => {
              // Sort: priority at index 1, non-empty first, empty to bottom
              const emailCount = (cat: Category) => emails.filter(e => e.category === cat.name).length
              const priorityCat = categories.find(c => c.name === priorityCategory)
              const nonPriority = categories.filter(c => c.name !== priorityCategory)
              const withEmails = nonPriority.filter(c => emailCount(c) > 0)
              const withoutEmails = nonPriority.filter(c => emailCount(c) === 0)

              let sorted: Category[]
              if (!priorityCat) {
                sorted = [...withEmails, ...withoutEmails]
              } else if (withEmails.length >= 1) {
                sorted = [withEmails[0], priorityCat, ...withEmails.slice(1), ...withoutEmails]
              } else {
                sorted = [priorityCat, ...withoutEmails]
              }

              const allCats: Category[] = [
                ...sorted,
                ...(deletableEmails.length > 0 ? [DELETE_CATEGORY] : []),
              ]

              return (
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  style={{ alignItems: "start" }}
                >
                  {allCats.map(cat => (
                    <CategoryBlock
                      key={cat.id}
                      category={cat}
                      categories={categories}
                      mode={mode}
                      emails={cat.id === "__delete__"
                        ? deletableEmails
                        : emails.filter(e => e.category === cat.name)}
                      selectedEmail={
                        cat.id === "__delete__"
                          ? (selectedEmail?.deletable ? selectedEmail : null)
                          : (selectedEmail?.category === cat.name ? selectedEmail : null)
                      }
                      onSelect={email => setSelectedEmail(prev => prev?.id === email.id ? null : email)}
                      onExpand={(email, composeMode) => {
                        setExpandedEmail(email)
                        setExpandedComposeMode(composeMode ?? null)
                      }}
                      onClose={() => setSelectedEmail(null)}
                      onMarkRead={handleMarkRead}
                      onArchive={handleArchive}
                      onSaveDraft={handleSaveDraft}
                      onSend={handleSendMessage}
                      onStar={handleStar}
                      onDelete={handleDelete}
                      onRecategorize={handleRecategorize}
                      onMarkReplied={handleMarkReplied}
                      onMarkDeletable={handleMarkDeletable}
                      onNewCategory={handleNewCategory}
                      onToggleTodo={handleToggleTodo}
                      onSnooze={email => setSnoozeTarget(email)}
                      gmailAccount={activeAccount}
                      isPriority={cat.name === priorityCategory}
                      onTogglePriority={cat.id !== "__delete__" ? () => handleTogglePriority(cat.name) : undefined}
                    />
                  ))}
                </div>
              )
            })()}


          </div>
        </div>

        {/* ══════════════════ MODALS ══════════════════════════════════════════ */}

        {expandedEmail && (
          <EmailModal
            email={expandedEmail}
            initialComposeMode={expandedComposeMode}
            gmailAccount={activeAccount}
            onClose={() => { setExpandedEmail(null); setExpandedComposeMode(null) }}
            onMarkRead={handleMarkRead}
            onStar={handleStar}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onSaveDraft={handleSaveDraft}
            onSend={handleSendMessage}
            onToggleTodo={handleToggleTodo}
            onSnooze={email => setSnoozeTarget(email)}
          />
        )}

        <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} gmailAccount={activeAccount} />

        <InstructionsPanel open={instructionsOpen} onClose={() => setInstructionsOpen(false)} />

        {snoozeTarget && (
          <SnoozeModal
            email={snoozeTarget}
            onSnooze={handleSnooze}
            onClose={() => setSnoozeTarget(null)}
          />
        )}

        {confetti && <ConfettiBlast onDone={() => setConfetti(false)} />}

        {/* Cleanup preview modal */}
        {cleanupPreview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(26,10,53,0.62)", backdropFilter: "blur(4px)" }}
            onClick={() => setCleanupPreview(null)}
          >
            <div
              className="flex flex-col"
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(26,10,53,0.10)",
                borderRadius: 16,
                boxShadow: "0 24px 80px rgba(26,10,53,0.45)",
                width: 720, maxWidth: "95vw", maxHeight: "85vh",
                overflow: "hidden",
              }}
              onClick={e => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between px-5 py-3 shrink-0"
                style={{ borderBottom: "1px solid rgba(26,10,53,0.08)" }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "rgba(26,10,53,0.82)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 16 }}>
                  {cleanupPreview.subject}
                </span>
                <button
                  onClick={() => setCleanupPreview(null)}
                  style={{ color: "rgba(26,10,53,0.38)", fontSize: "1.2rem", background: "none", border: "none", cursor: "pointer", lineHeight: 1, flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {cleanupPreviewHtml === null
                  ? <div className="flex items-center justify-center h-40" style={{ fontSize: "0.8rem", color: "rgba(26,10,53,0.60)" }}>Loading…</div>
                  : <iframe srcDoc={cleanupPreviewHtml} className="w-full h-full border-0" sandbox="allow-same-origin" style={{ background: "white" }} />
                }
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}




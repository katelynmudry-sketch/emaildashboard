"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useSession, signIn } from "next-auth/react"
import type { Email, Category, AccountId, RawEmail } from "@/lib/types"
import { ACCOUNTS } from "@/lib/types"
import { getCategories, saveCategories } from "@/lib/categories"
import { recordAction } from "@/lib/stats"
import { getCachedInbox, saveCachedInbox, type InboxCache } from "@/lib/inbox-cache"
import AccountToggle from "./AccountToggle"
import CategoryBlock from "./CategoryBlock"
import CategoryProposal from "./CategoryProposal"
import EmailModal from "./EmailModal"
import EmailRow from "./EmailRow"
import PlantHeader from "./PlantHeader"
import ComposeModal from "./ComposeModal"

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

  // In-memory cache for fast account switching within a session
  const sessionCache = useRef<Map<string, InboxCache>>(new Map())

  const activeAccountConfig = ACCOUNTS.find(a => a.id === activeAccount)!
  const gmailAccountQuery = `account=${activeAccount}`
  const workNeedsLink = activeAccount === "work" && !session?.workAccountLinked
  const deletableEmails = emails.filter(email => email.deletable)
  const briefingEmails = emails
    .filter(email => !email.deletable && (
      email.priority !== "fyi" ||
      email.actionFlag === "confirm" ||
      /expire|expir|due|deadline|ends?/i.test(email.summary ?? "")
    ))
    .sort((a, b) => {
      const rank = (email: Email) => email.priority === "urgent" ? 0 : email.priority === "today" ? 1 : 2
      const diff = rank(a) - rank(b)
      return diff !== 0 ? diff : a.internalDate - b.internalDate
    })

  const urgentCount = emails.filter(email => email.priority === "urgent").length
  const todayCount = emails.filter(email => email.priority === "today").length
  const fyiCount = emails.filter(email => email.priority === "fyi").length
  const unreadLeftApprox = Math.max(0, totalUnreadInbox - emails.length)

  function updateImportBatchSize(n: ImportBatchSize) {
    setImportBatchSize(n)
    try {
      localStorage.setItem(BATCH_PREF_KEY, String(n))
    } catch {
      // ignore
    }
  }

  // ── Restore cached data ──────────────────────────────────────────────────────

  function restoreCache(accountEmail: string) {
    // Check in-memory session cache first (faster)
    const session = sessionCache.current.get(accountEmail)
    if (session) {
      setEmails(session.emails)
      setCategories(session.categories)
      setFetchedAt(session.fetchedAt)
      setTotalEmailsAtLoad(session.emails.length)
      setTotalUnreadInbox(session.totalUnreadEstimate ?? session.emails.length)
      setAppState("ready")
      return true
    }
    // Fall back to localStorage
    const stored = getCachedInbox(accountEmail)
    if (stored) {
      setEmails(stored.emails)
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
            `This inbox is not connected yet. Use “Connect work Gmail” in the header, sign in with your work Google account, then click Refresh.`,
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

        const proposeRes = await fetch("/api/ai/propose", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: rawEmails, existingLabelNames: fetchedLabelNames, account: activeAccountConfig.email }),
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

    // Strip htmlBody before sending to API — it's large and not needed for categorization
    const emailsForApi = rawEmails.map(({ htmlBody: _, ...rest }) => rest)
    const catRes = await fetch("/api/ai/categorize", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: emailsForApi, categories: cats, account: activeAccountConfig.email }),
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

    // Reattach htmlBody from original rawEmails
    const htmlBodyMap = new Map(rawEmails.map(e => [e.id, e.htmlBody]))
    categorized.forEach(email => { email.htmlBody = htmlBodyMap.get(email.id) })

    // Apply Gmail labels in the background
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

    // Persist to both caches
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

    // Debug: log parcel-related emails
    const parcelEmails = categorized.filter(e => e.category === "Orders" || e.packageDelivered || /parcel|ship|deliver|tracking/i.test(e.subject + " " + e.microSummary))
    console.log("[inbox-ai] parcel candidates:", parcelEmails.map(e => ({ from: e.from, subject: e.subject, microSummary: e.microSummary, packageDelivered: e.packageDelivered, orderSender: e.orderSender, actionFlag: e.actionFlag })))

    // Check unread inbox for delivery confirmations
    const deliveredFromInbox = categorized.find(e => e.packageDelivered && e.orderSender)
    if (deliveredFromInbox?.orderSender) {
      const dismissed: string[] = JSON.parse(localStorage.getItem("inbox-ai:dismissed-cleanups") ?? "[]")
      console.log("[inbox-ai] about to fetch cleanup, id:", deliveredFromInbox.id, "dismissed:", dismissed)
      if (!dismissed.includes(deliveredFromInbox.id)) {
        console.log("[inbox-ai] firing package-cleanup fetch")
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
            console.log("[inbox-ai] package-cleanup response:", data)
            if (data.emails?.length > 0) {
              setPackageCleanup({ emails: data.emails, sender: deliveredFromInbox.orderSender! })
              setCleanupChecked(new Set(data.emails.map((e: { id: string }) => e.id)))
            }
          })
          .catch(err => console.error("[inbox-ai] package-cleanup error:", err))
        return
      }
    }

    // Also check for recent deliveries that may already be read
    fetch(`/api/gmail/recent-deliveries?${gmailAccountQuery}`)
      .then(r => r.json())
      .then((deliveries: { id: string; subject: string; from: string; sender: string }[]) => {
        if (!deliveries?.length) return
        const dismissed: string[] = JSON.parse(localStorage.getItem("inbox-ai:dismissed-cleanups") ?? "[]")
        const first = deliveries.find(d => !dismissed.includes(d.id))
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
  }, [activeAccount, activeAccountConfig.email, gmailAccountQuery])

  const writeInboxCache = useCallback((next: Email[], cats: Category[], opt?: { totalUnreadEstimate?: number }) => {
    const sess = sessionCache.current.get(activeAccountConfig.email)
    const ft = fetchedAt ?? sess?.fetchedAt ?? new Date().toISOString()
    const totalUnreadEstimate =
      opt?.totalUnreadEstimate !== undefined ? opt.totalUnreadEstimate : sess?.totalUnreadEstimate
    const importBatchSize = sess?.importBatchSize
    saveCachedInbox(activeAccountConfig.email, next, cats, {
      fetchedAt: ft,
      ...(totalUnreadEstimate !== undefined && { totalUnreadEstimate }),
      ...(importBatchSize !== undefined && { importBatchSize }),
    })
    sessionCache.current.set(activeAccountConfig.email, {
      account: activeAccountConfig.email,
      emails: next,
      categories: cats,
      fetchedAt: ft,
      totalUnreadEstimate,
      importBatchSize,
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

  async function handleArchive(email: Email) {
    await fetch("/api/gmail/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: email.id, account: activeAccount }),
    })
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
  }

  async function handleMarkRead(email: Email) {
    await fetch("/api/gmail/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: email.id, account: activeAccount }),
    })
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
  }

  async function handleSaveDraft(email: Email, body: string) {
    await fetch("/api/gmail/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: email.fromEmail,
        subject: email.subject,
        body,
        threadId: email.threadId,
        inReplyTo: email.messageId,
        messageId: email.messageId,
        account: activeAccount,
      }),
    })
    recordAction("saveDraft", { emailId: email.id, subject: email.subject, mode: "reply" })
  }

  async function handleSendMessage(
    email: Email,
    mode: "reply" | "forward",
    body: string,
    forwardTo?: string
  ) {
    const to = mode === "forward" ? forwardTo?.trim() ?? "" : email.fromEmail
    if (mode === "forward" && !to) {
      throw new Error("Forward recipient is required")
    }
    if (!to) {
      throw new Error("Recipient email address is missing")
    }

    const subject = mode === "forward" ? `Fwd: ${email.subject}` : email.subject

    const res = await fetch("/api/gmail/send", {
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
      }),
    })

    if (!res.ok) {
      try {
        const error = await res.json()
        throw new Error(error.error || `Failed to send: ${res.status}`)
      } catch {
        throw new Error(`Failed to send: ${res.status}`)
      }
    }

    setEmails(prev => prev.map(e =>
      e.id === email.id
        ? { ...e, replied: mode === "reply" ? true : e.replied, forwarded: mode === "forward" ? true : e.forwarded }
        : e
    ))

    recordAction(mode === "forward" ? "forwardSent" : "replySent", {
      emailId: email.id,
      subject: email.subject,
      mode,
    })

    await handleMarkRead(email)
  }

  async function handleStar(email: Email) {
    await fetch("/api/gmail/star", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: email.id, account: activeAccount }),
    })
    recordAction("star")
    setEmails(prev => {
      const next = prev.filter(e => e.id !== email.id)
      writeInboxCache(next, categories)
      return next
    })
    if (selectedEmail?.id === email.id) setSelectedEmail(null)
  }

  async function handleDelete(email: Email) {
    await fetch("/api/gmail/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: email.id, account: activeAccount }),
    })
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
  }

  const isLoading = appState === "fetching" || appState === "categorizing" || appState === "proposing"

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

  // ── Main layout ──────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-[#f0ebf8]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle,rgba(124,77,255,0.055)_1px,transparent_1px)] bg-[length:28px_28px]" />
      <div className="relative z-10 flex flex-col">
        <header className="px-6 pt-6 pb-4">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-cyan-500 text-white shadow-[0_18px_40px_rgba(124,77,255,0.22)]">
                  <span className="text-xl">📬</span>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-zinc-950">Inbox AI</h1>
                  <p className="text-sm text-zinc-500">A gamified AI inbox experience with quick unread insight.</p>
                </div>
              </div>
              {appState === "ready" && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[#ddd5ea] bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm">
                      <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                      ~{totalUnreadInbox} unread in Gmail
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#f0ecff] px-3 py-2 text-xs font-semibold text-violet-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#7c4dff]" />
                      {emails.length} imported
                    </span>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm ${
                        unreadLeftApprox > 0
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-[#ddd5ea] bg-white text-zinc-600"
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${unreadLeftApprox > 0 ? "bg-amber-500" : "bg-zinc-300"}`} />
                      ~{unreadLeftApprox} left to load
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 max-w-xl leading-relaxed">
                    Estimates come from Gmail. This workspace only holds the current batch (up to {importBatchSize} per refresh).
                    {unreadLeftApprox > 0
                      ? " Refresh after you work through these to fetch and analyze the next chunk."
                      : emails.length >= importBatchSize
                        ? " You hit the batch cap; refresh to see if more unread are available."
                        : " No extra unread estimated beyond this import."}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-3 justify-end">
              {!workNeedsLink && (
                <div className="flex flex-col items-end gap-1 mr-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Per refresh</span>
                  <div className="flex rounded-full border border-zinc-200 bg-zinc-50 p-0.5 shadow-sm">
                    {IMPORT_BATCH_OPTIONS.map(n => (
                      <button
                        key={n}
                        type="button"
                        disabled={isLoading}
                        onClick={() => updateImportBatchSize(n)}
                        className={`min-w-[2.25rem] px-2 py-1 text-xs font-semibold rounded-full transition-colors disabled:opacity-50 ${
                          importBatchSize === n
                            ? "bg-white text-violet-700 shadow-sm"
                            : "text-zinc-600 hover:text-zinc-900"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <AccountToggle
                active={activeAccount}
                onChange={handleAccountSwitch}
                loading={isLoading}
              />
              {workNeedsLink && activeAccountConfig.email && (
                <button
                  type="button"
                  onClick={() =>
                    signIn(
                      "google",
                      { redirectTo: typeof window !== "undefined" ? window.location.pathname : "/" },
                      {
                        login_hint: activeAccountConfig.email,
                        prompt: "select_account consent",
                      },
                    )
                  }
                  className="border border-amber-300 bg-amber-50 text-amber-900 text-sm font-medium px-4 py-2 rounded-full hover:bg-amber-100 transition-colors"
                >
                  Connect work Gmail
                </button>
              )}
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                disabled={workNeedsLink}
                className="bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 text-sm font-medium px-4 py-2 rounded-full transition-colors shadow-sm disabled:opacity-50"
              >
                Compose
              </button>
              <button
                onClick={loadInbox}
                disabled={isLoading || workNeedsLink}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
              >
                {appState === "fetching" ? "Fetching…"
                  : appState === "proposing" ? "Analyzing…"
                  : appState === "categorizing" ? "Sorting…"
                  : appState === "ready" ? "Refresh"
                  : "Load inbox"}
              </button>
            </div>
          </div>
        </header>

        <div className="px-6 py-2 bg-transparent border-b border-[#e6dff6] text-[11px] text-zinc-500 flex flex-wrap items-center gap-2">
          <span className="font-semibold text-zinc-700">Legend:</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#e6dff6] bg-white px-2 py-0.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> urgent
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#e6dff6] bg-white px-2 py-0.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> today
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#e6dff6] bg-white px-2 py-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> fyi
          </span>
        </div>

      {/* Main area */}
      <div className="flex">
        {/* Block grid */}
        <div className="flex-1 min-w-0 p-5">
          {appState === "idle" && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-4xl mb-3">📬</p>
                <p className="text-zinc-500 text-sm">Click "Load inbox" to fetch and sort your emails.</p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-zinc-500">
                  {appState === "fetching" ? "Fetching your inbox…"
                    : appState === "proposing" ? "Analyzing your email patterns…"
                    : "Claude is sorting your emails…"}
                </p>
              </div>
            </div>
          )}

          {appState === "error" && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <p className="text-zinc-700 font-medium">Something went wrong</p>
                <p className="text-sm text-zinc-500">{errorMsg}</p>
                <button onClick={loadInbox} className="text-sm text-violet-600 hover:underline">
                  Try again
                </button>
              </div>
            </div>
          )}

          {appState === "ready" && packageCleanup && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span>📦 Package from <span className="font-medium">{packageCleanup.sender}</span> arrived — {packageCleanup.emails.length} shipping email{packageCleanup.emails.length !== 1 ? "s" : ""} found.</span>
                <button
                  onClick={() => setCleanupExpanded(v => !v)}
                  className="text-amber-700 hover:text-amber-900 text-xs font-medium px-2 py-1 rounded hover:bg-amber-100 transition-colors"
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
                    recordAction("cleanupDelete", {
                      details: `Deleted ${toDelete.length} cleanup email${toDelete.length === 1 ? "" : "s"}`,
                    })
                    setPackageCleanup(null)
                    setCleanupExpanded(false)
                  }}
                  disabled={cleanupChecked.size === 0}
                  className="ml-auto shrink-0 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                >
                  Delete {cleanupChecked.size > 0 ? `${cleanupChecked.size} ` : ""}selected
                </button>
                <button
                  onClick={() => {
                    const dismissed: string[] = JSON.parse(localStorage.getItem("inbox-ai:dismissed-cleanups") ?? "[]")
                    const deliveredEmail = emails.find(e => e.packageDelivered && e.orderSender === packageCleanup.sender)
                    if (deliveredEmail) {
                      localStorage.setItem("inbox-ai:dismissed-cleanups", JSON.stringify([...dismissed, deliveredEmail.id]))
                      recordAction("cleanupDismiss", {
                        emailId: deliveredEmail.id,
                        subject: deliveredEmail.subject,
                      })
                    }
                    setPackageCleanup(null)
                    setCleanupExpanded(false)
                  }}
                  className="shrink-0 text-amber-700 hover:text-amber-900 text-xs font-medium px-2 py-1.5 rounded-md hover:bg-amber-100 transition-colors"
                >
                  Dismiss
                </button>
              </div>
              {cleanupExpanded && (
                <div className="border-t border-amber-200 divide-y divide-amber-100 max-h-64 overflow-y-auto">
                  {packageCleanup.emails.map(email => {
                    const trackingMatch = email.snippet.match(
                      /(?:tracking(?:\s*(?:number|#|no\.?)?)?[\s:]+|order(?:\s*(?:number|#|no\.?)?)?[\s:]+|#)([A-Z0-9][-A-Z0-9]{5,30})/i
                    )
                    const trackingInfo = trackingMatch ? trackingMatch[0].trim() : null
                    return (
                      <div key={email.id} className="flex items-center gap-3 px-4 py-2 hover:bg-amber-100 transition-colors">
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
                          className="accent-amber-600 shrink-0"
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
                        >
                          <span className="text-xs font-medium text-amber-900 truncate">{email.subject}</span>
                          {trackingInfo && <span className="text-xs text-amber-600 font-mono shrink-0 truncate max-w-[160px]">{trackingInfo}</span>}
                          {email.date && <span className="text-xs text-amber-400 shrink-0 ml-auto">{email.date}</span>}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {appState === "ready" && briefingEmails.length > 0 && (
            <div className="mb-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Daily briefing</p>
                  <p className="text-xs text-zinc-500">Requires a response or is expiring soon.</p>
                </div>
                <span className="text-xs text-zinc-500">{briefingEmails.length} items</span>
              </div>
              <div className="mt-2 space-y-1">
                {briefingEmails.map(email => (
                  <EmailRow
                    key={email.id}
                    email={email}
                    selected={email.id === selectedEmail?.id}
                    isSelected={false}
                    selectionMode={false}
                    onClick={() => {
                      setExpandedEmail(email)
                      setExpandedComposeMode("ai")
                    }}
                    onDoubleClick={() => {
                      setExpandedEmail(email)
                      setExpandedComposeMode(null)
                    }}
                    onMarkRead={() => { void handleMarkRead(email) }}
                    onDelete={() => { void handleDelete(email) }}
                    onReply={() => {
                      setExpandedEmail(email)
                      setExpandedComposeMode("reply")
                    }}
                    onForward={() => {
                      setExpandedEmail(email)
                      setExpandedComposeMode("forward")
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {appState === "ready" && categories.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categories.map(cat => (
                <CategoryBlock
                  key={cat.id}
                  category={cat}
                  emails={emails.filter(e => e.category === cat.name)}
                  selectedEmail={selectedEmail?.category === cat.name ? selectedEmail : null}
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
                  gmailAccount={activeAccount}
                />
              ))}
            </div>
          )}

          {appState === "ready" && deletableEmails.length > 0 && (
            <div className="mt-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Delete candidates</p>
                  <p className="text-xs text-zinc-500">Emails likely safe to remove — old offers, expired links, OTPs, or delivery confirmations.</p>
                </div>
                <span className="text-xs text-zinc-500">{deletableEmails.length} emails</span>
              </div>
              <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                {deletableEmails.map(email => (
                  <EmailRow
                    key={email.id}
                    email={email}
                    selected={email.id === selectedEmail?.id}
                    isSelected={false}
                    selectionMode={false}
                    onClick={() => setSelectedEmail(prev => prev?.id === email.id ? null : email)}
                    onDoubleClick={() => {
                      setExpandedEmail(email)
                      setExpandedComposeMode(null)
                    }}
                    onMarkRead={() => { void handleMarkRead(email) }}
                    onDelete={() => { void handleDelete(email) }}
                    onReply={() => {
                      setExpandedEmail(email)
                      setExpandedComposeMode("reply")
                    }}
                    onForward={() => {
                      setExpandedEmail(email)
                      setExpandedComposeMode("forward")
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {expandedEmail && (
        <EmailModal
          email={expandedEmail}
          initialComposeMode={expandedComposeMode}
          gmailAccount={activeAccount}
          onClose={() => {
            setExpandedEmail(null)
            setExpandedComposeMode(null)
          }}
          onMarkRead={handleMarkRead}
          onStar={handleStar}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onSaveDraft={handleSaveDraft}
          onSend={handleSendMessage}
        />
      )}

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} gmailAccount={activeAccount} />

      {cleanupPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCleanupPreview(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-[720px] max-w-[95vw] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 shrink-0">
              <span className="text-sm font-medium text-zinc-800 truncate pr-4">{cleanupPreview.subject}</span>
              <button onClick={() => setCleanupPreview(null)} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none shrink-0">✕</button>
            </div>
            <div className="flex-1 overflow-hidden">
              {cleanupPreviewHtml === null
                ? <div className="flex items-center justify-center h-40 text-sm text-zinc-400">Loading…</div>
                : <iframe srcDoc={cleanupPreviewHtml} className="w-full h-full border-0" sandbox="allow-same-origin" />
              }
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

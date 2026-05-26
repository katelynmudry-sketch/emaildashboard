"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useSession, signIn } from "next-auth/react"
import type { Email, Category, AccountId, RawEmail } from "@/lib/types"
import { ACCOUNTS } from "@/lib/types"
import { getCategories, saveCategories } from "@/lib/categories"
import { recordAction } from "@/lib/stats"
import { getCachedInbox, saveCachedInbox, type InboxCache } from "@/lib/inbox-cache"
import { snoozeEmail } from "@/lib/todo-snooze"
import AccountToggle from "./AccountToggle"
import CategoryBlock from "./CategoryBlock"
import CategoryProposal from "./CategoryProposal"
import DetailPanel from "./DetailPanel"
import EmailModal from "./EmailModal"
import EmailRow from "./EmailRow"
import PlantHeader from "./PlantHeader"
import ComposeModal from "./ComposeModal"
import SnoozeModal from "./SnoozeModal"
import ConfettiBlast from "./ConfettiBlast"

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

// ── Festival stat sub-components ────────────────────────────────────────────

function StatTicket({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{
      border: `1px solid ${color}55`,
      borderRadius: 10,
      padding: "8px 16px",
      background: `${color}14`,
      minWidth: 72,
    }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", lineHeight: 1, color }}>
        {value}
      </div>
      <div style={{ fontSize: "0.56rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(26,10,53,0.40)", marginTop: 3 }}>
        {label}
      </div>
    </div>
  )
}

function MiniStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      border: `1px solid ${color}44`,
      borderRadius: 8,
      padding: "5px 10px",
      background: `${color}14`,
      textAlign: "center",
    }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", lineHeight: 1, color }}>
        {value}
      </div>
      <div style={{ fontSize: "0.53rem", textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(26,10,53,0.36)", marginTop: 1 }}>
        {label}
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
  const [roast, setRoast] = useState<string | null>(null)
  const [roasting, setRoasting] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [todoLabelId, setTodoLabelId] = useState<string | null>(null)
  const prevEmailCount = useRef<number | null>(null)

  // In-memory cache for fast account switching within a session
  const sessionCache = useRef<Map<string, InboxCache>>(new Map())

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

  const todoEmails = visibleEmails.filter(email => email.todo)

  const briefingEmails = visibleEmails
    .filter(email => !email.todo && (!email.deletable || email.todo))
    .filter(email =>
      email.priority !== "fyi" ||
      email.actionFlag === "confirm" ||
      /expire|expir|due|deadline|ends?/i.test(email.summary ?? "")
    )
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

  // ── Confetti on inbox zero ───────────────────────────────────────────────────

  useEffect(() => {
    if (appState !== "ready") return
    const count = visibleEmails.filter(e => !e.deletable && !e.snoozedUntil).length
    if (prevEmailCount.current !== null && prevEmailCount.current > 0 && count === 0) {
      setConfetti(true)
    }
    prevEmailCount.current = count
  }, [visibleEmails, appState])

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

    const htmlBodyMap = new Map(rawEmails.map(e => [e.id, e.htmlBody]))
    const labelIdMap  = new Map(rawEmails.map(e => [e.id, e.labelIds]))
    categorized.forEach(email => {
      email.htmlBody = htmlBodyMap.get(email.id)
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

    const parcelEmails = categorized.filter(e => e.category === "Orders" || e.packageDelivered || /parcel|ship|deliver|tracking/i.test(e.subject + " " + e.microSummary))
    console.log("[inbox-ai] parcel candidates:", parcelEmails.map(e => ({ from: e.from, subject: e.subject, microSummary: e.microSummary, packageDelivered: e.packageDelivered, orderSender: e.orderSender, actionFlag: e.actionFlag })))

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

  async function handleSendMessage(email: Email, mode: "reply" | "forward", body: string, forwardTo?: string) {
    const to = mode === "forward" ? forwardTo?.trim() ?? "" : email.fromEmail
    if (mode === "forward" && !to) throw new Error("Forward recipient is required")
    if (!to) throw new Error("Recipient email address is missing")

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
    recordAction(mode === "forward" ? "forwardSent" : "replySent", { emailId: email.id, subject: email.subject, mode })
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
        body: JSON.stringify({ emails: payload }),
      })
      const data = await res.json()
      setRoast(data.roast ?? null)
    } catch {
      setRoast("Claude took one look at your inbox and had nothing to say.")
    } finally {
      setRoasting(false)
    }
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

  // ── FESTIVAL RENDER ──────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen" style={{ background: "#EEE4FF", color: "#1A0A35" }}>

      {/* Ambient background glows */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: `
            radial-gradient(ellipse 90% 55% at 8% 0%,   rgba(255,31,110,0.07)  0%, transparent 55%),
            radial-gradient(ellipse 70% 50% at 92% 100%, rgba(0,229,196,0.05)   0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 55% 55%, rgba(255,208,0,0.03)   0%, transparent 60%)
          `,
        }}
      />

      <div className="relative z-10 flex flex-col">

        {/* ══════════════════ HEADER ══════════════════════════════════════════ */}
        <header style={{ padding: "24px 28px 20px", borderBottom: "1px solid rgba(26,10,53,0.08)" }}>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">

            {/* Left: Logo + stats */}
            <div className="flex flex-col gap-5">

              {/* Logo row */}
              <div className="flex items-center gap-4">
                <div style={{
                  width: 52, height: 52, flexShrink: 0,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #FF1F6E 0%, #FF6B1A 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26,
                  boxShadow: "0 8px 32px rgba(255,31,110,0.38)",
                }}>
                  ✉️
                </div>
                <div>
                  <h1 style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(2rem, 5vw, 3.2rem)",
                    lineHeight: 1,
                    color: "#1A0A35",
                    margin: 0,
                  }}>
                    INBOX AI
                  </h1>
                  <p style={{
                    fontSize: "0.6rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(26,10,53,0.35)",
                    margin: "5px 0 0",
                  }}>
                    Your AI-Powered Mail Fiesta
                  </p>
                </div>
              </div>

              {/* Stats — only when ready */}
              {appState === "ready" && (
                <div className="flex flex-col gap-3">

                  {/* Ticket stats */}
                  <div className="flex flex-wrap items-stretch gap-2">
                    <StatTicket value={`~${totalUnreadInbox}`} label="unread"      color="#FF1F6E" />
                    <StatTicket value={String(emails.length)}  label="imported"    color="#FFD000" />
                    {unreadLeftApprox > 0 && (
                      <StatTicket value={`~${unreadLeftApprox}`} label="left to load" color="#FF6B1A" />
                    )}
                    <div className="flex items-stretch gap-1">
                      <MiniStat value={urgentCount} label="urgent" color="#FF1F6E" />
                      <MiniStat value={todayCount}  label="today"  color="#FFD000" />
                      <MiniStat value={fyiCount}    label="fyi"    color="#00E5C4" />
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
                      {/* Batch size picker */}
                      <div className="flex flex-col gap-0.5">
                        <span style={{ fontSize: "0.54rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(26,10,53,0.32)" }}>
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
                                background: importBatchSize === n ? "#FF1F6E" : "transparent",
                                color: importBatchSize === n ? "#1A0A35" : "rgba(26,10,53,0.42)",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                border: "none",
                                cursor: "pointer",
                              }}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Roast button */}
                      <button
                        onClick={handleRoast}
                        disabled={roasting || emails.length === 0}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "6px 14px", borderRadius: 999,
                          border: "1px solid rgba(255,107,26,0.40)",
                          background: "rgba(255,107,26,0.09)",
                          color: "#FF6B1A",
                          fontSize: "0.72rem", fontWeight: 600,
                          cursor: "pointer",
                          opacity: roasting || emails.length === 0 ? 0.4 : 1,
                        }}
                      >
                        {roasting ? "Roasting…" : "🔥 Roast my inbox"}
                      </button>
                    </div>
                  )}

                  {/* Roast text */}
                  {roast && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, maxWidth: 500 }}>
                      <span style={{ fontSize: "0.73rem", fontStyle: "italic", color: "#FF6B1A", flex: 1 }}>
                        &ldquo;{roast}&rdquo;
                      </span>
                      <button
                        onClick={() => setRoast(null)}
                        style={{ color: "rgba(26,10,53,0.32)", fontSize: "1rem", background: "none", border: "none", cursor: "pointer", lineHeight: 1, flexShrink: 0, marginTop: 1 }}
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {/* Muted footnote */}
                  <p style={{ fontSize: "0.62rem", color: "rgba(26,10,53,0.22)", maxWidth: 480, lineHeight: 1.5, margin: 0 }}>
                    Gmail estimates. Batch: up to {importBatchSize} per refresh.
                    {unreadLeftApprox > 0
                      ? " Refresh after this batch to fetch the next chunk."
                      : emails.length >= importBatchSize
                        ? " Hit batch cap — refresh to check for more."
                        : " No extra unread beyond this import."}
                  </p>
                </div>
              )}
            </div>

            {/* Right: Action buttons + TODO widget */}
            <div className="flex items-start gap-3 flex-wrap">
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
                    border: "1px solid rgba(0,229,196,0.40)",
                    background: "rgba(0,229,196,0.08)",
                    color: "#00E5C4",
                    fontSize: "0.8rem", fontWeight: 600,
                    cursor: "pointer",
                    opacity: workNeedsLink ? 0.4 : 1,
                  }}
                >
                  Compose
                </button>
                <button
                  onClick={loadInbox}
                  disabled={isLoading || workNeedsLink}
                  style={{
                    padding: "9px 24px", borderRadius: 999,
                    background: isLoading || workNeedsLink ? "rgba(255,31,110,0.3)" : "#FF1F6E",
                    color: "#1A0A35",
                    fontSize: "0.82rem", fontWeight: 700,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    cursor: isLoading || workNeedsLink ? "not-allowed" : "pointer",
                    border: "none",
                    fontFamily: "var(--font-body)",
                    boxShadow: isLoading || workNeedsLink ? "none" : "0 4px 20px rgba(255,31,110,0.45)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {appState === "fetching"     ? "Fetching…"
                    : appState === "proposing"   ? "Analyzing…"
                    : appState === "categorizing"? "Sorting…"
                    : appState === "ready"       ? "Refresh"
                    : "Load Inbox"}
                </button>
              </div>

              {/* TODO widget */}
              {appState === "ready" && todoEmails.length > 0 && (
                <div
                  className="sticky top-4 self-start overflow-hidden"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(255,208,0,0.28)",
                    borderRadius: 14,
                    boxShadow: "0 4px 24px rgba(255,208,0,0.08)",
                    minWidth: 220, maxWidth: 290,
                  }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-2.5"
                    style={{ background: "rgba(255,208,0,0.08)", borderBottom: "1px solid rgba(255,208,0,0.12)" }}
                  >
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#FFD000" }}>★ TODO</span>
                    <span style={{
                      fontSize: "0.68rem", fontWeight: 700,
                      background: "rgba(255,208,0,0.18)",
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
                        onClick={() => { setExpandedEmail(email); setExpandedComposeMode("ai") }}
                        onDoubleClick={() => { setExpandedEmail(email); setExpandedComposeMode(null) }}
                        onMarkRead={() => { void handleMarkRead(email) }}
                        onDelete={() => { void handleDelete(email) }}
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

        {/* ══════════════════ LEGEND BAR ══════════════════════════════════════ */}
        <div
          className="flex flex-wrap items-center gap-3 px-7 py-2"
          style={{ borderBottom: "1px solid rgba(26,10,53,0.05)" }}
        >
          <span style={{ fontSize: "0.57rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(26,10,53,0.28)" }}>
            Priority:
          </span>
          {[
            { color: "#FF1F6E", label: "urgent" },
            { color: "#FFD000", label: "today" },
            { color: "#00E5C4", label: "fyi" },
          ].map(({ color, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: "0.58rem", color: "rgba(26,10,53,0.28)" }}>{label}</span>
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
                    Ready for the fiesta?
                  </p>
                  <p style={{ fontSize: "0.78rem", color: "rgba(26,10,53,0.28)", margin: 0 }}>
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
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", color: "#FF1F6E", margin: "0 0 6px", letterSpacing: "0.04em" }}>
                      {appState === "fetching"      ? "FETCHING YOUR MAIL"
                        : appState === "proposing"  ? "ANALYZING PATTERNS"
                        : "SORTING THE FIESTA"}
                    </p>
                    <p style={{ fontSize: "0.7rem", color: "rgba(26,10,53,0.32)", margin: 0 }}>
                      {appState === "fetching"      ? "Checking your inbox…"
                        : appState === "proposing"  ? "Analyzing your email patterns…"
                        : "Claude is categorizing your emails…"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Error ── */}
            {appState === "error" && (
              <div className="h-64 flex items-center justify-center">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", color: "#FF1F6E", margin: 0 }}>
                    ¡Ay, Caramba!
                  </p>
                  <p style={{ fontSize: "0.82rem", color: "rgba(26,10,53,0.48)", margin: 0, maxWidth: 420 }}>{errorMsg}</p>
                  <button
                    onClick={loadInbox}
                    style={{ color: "#FF1F6E", fontSize: "0.8rem", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginTop: 4 }}
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
                      fontSize: "0.67rem", fontWeight: 600,
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
                      fontSize: "0.7rem", fontWeight: 700,
                      border: "none", cursor: "pointer",
                      opacity: cleanupChecked.size === 0 ? 0.4 : 1,
                    }}
                  >
                    Delete {cleanupChecked.size > 0 ? `${cleanupChecked.size} ` : ""}selected
                  </button>
                  <button
                    onClick={() => {
                      const dismissed: string[] = JSON.parse(localStorage.getItem("inbox-ai:dismissed-cleanups") ?? "[]")
                      const deliveredEmail = emails.find(e => e.packageDelivered && e.orderSender === packageCleanup.sender)
                      if (deliveredEmail) {
                        localStorage.setItem("inbox-ai:dismissed-cleanups", JSON.stringify([...dismissed, deliveredEmail.id]))
                        recordAction("cleanupDismiss", { emailId: deliveredEmail.id, subject: deliveredEmail.subject })
                      }
                      setPackageCleanup(null)
                      setCleanupExpanded(false)
                    }}
                    style={{
                      flexShrink: 0,
                      padding: "4px 12px", borderRadius: 6,
                      background: "transparent",
                      color: "rgba(26,10,53,0.4)",
                      fontSize: "0.7rem", fontWeight: 600,
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
                            <span style={{ fontSize: "0.73rem", fontWeight: 600, color: "rgba(26,10,53,0.78)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {email.subject}
                            </span>
                            {trackingInfo && (
                              <span style={{ fontSize: "0.65rem", color: "#FF6B1A", fontFamily: "monospace", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                                {trackingInfo}
                              </span>
                            )}
                            {email.date && (
                              <span style={{ fontSize: "0.65rem", color: "rgba(26,10,53,0.28)", marginLeft: "auto", flexShrink: 0 }}>
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

            {/* ── Inbox zero ── */}
            {appState === "ready" && visibleEmails.filter(e => !e.deletable).length === 0 && totalEmailsAtLoad > 0 && (
              <div className="mb-4 text-center" style={{
                background: "linear-gradient(135deg, rgba(0,229,196,0.10), rgba(184,240,0,0.07))",
                border: "1px solid rgba(0,229,196,0.28)",
                borderRadius: 20,
                padding: "36px 24px",
                boxShadow: "0 4px 40px rgba(0,229,196,0.07)",
              }}>
                <p style={{ fontSize: "3.5rem", marginBottom: 14 }}>🎉</p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem", color: "#00E5C4", margin: "0 0 10px", letterSpacing: "0.04em" }}>
                  ¡INBOX ZERO!
                </p>
                <p style={{ fontSize: "0.78rem", color: "rgba(26,10,53,0.40)", margin: 0 }}>
                  You triaged everything in this batch. Refresh to load more.
                </p>
              </div>
            )}

            {/* ── Daily Briefing ── */}
            {appState === "ready" && briefingEmails.length > 0 && (
              <div className="mb-4 flex flex-col overflow-hidden" style={{
                background: "#FFFFFF",
                border: "1px solid rgba(255,31,110,0.22)",
                borderRadius: 16,
                boxShadow: "0 4px 28px rgba(255,31,110,0.08)",
              }}>
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ background: "rgba(255,31,110,0.11)", borderBottom: "1px solid rgba(255,31,110,0.13)" }}
                >
                  <div className="flex items-center gap-2.5">
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF1F6E", display: "inline-block", boxShadow: "0 0 10px rgba(255,31,110,0.9)", flexShrink: 0 }} />
                    <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "#1A0A35", margin: 0, letterSpacing: "0.05em" }}>
                      DAILY BRIEFING
                    </h2>
                  </div>
                  <span style={{
                    fontSize: "0.7rem", fontWeight: 700,
                    background: "rgba(255,31,110,0.20)",
                    color: "#FF1F6E",
                    borderRadius: 99, padding: "2px 10px",
                  }}>
                    {briefingEmails.length}
                  </span>
                </div>
                <div className="px-2 py-2 space-y-0.5 min-h-[80px]">
                  {briefingEmails.map(email => (
                    <div key={email.id}>
                      <EmailRow
                        email={email}
                        selected={email.id === selectedEmail?.id}
                        isSelected={false}
                        selectionMode={false}
                        onClick={() => setSelectedEmail(prev => prev?.id === email.id ? null : email)}
                        onDoubleClick={() => { setExpandedEmail(email); setExpandedComposeMode(null) }}
                        onMarkRead={() => { void handleMarkRead(email) }}
                        onDelete={() => { void handleDelete(email) }}
                        onReply={() => { setExpandedEmail(email); setExpandedComposeMode("reply") }}
                        onForward={() => { setExpandedEmail(email); setExpandedComposeMode("forward") }}
                        onToggleTodo={() => handleToggleTodo(email)}
                        onSnooze={() => setSnoozeTarget(email)}
                      />
                      {email.id === selectedEmail?.id && (
                        <div className="mt-1 mb-2">
                          <DetailPanel
                            email={selectedEmail}
                            gmailAccount={activeAccount}
                            categories={categories}
                            onClose={() => setSelectedEmail(null)}
                            onArchive={handleArchive}
                            onMarkRead={handleMarkRead}
                            onSaveDraft={handleSaveDraft}
                            onSend={handleSendMessage}
                            onStar={handleStar}
                            onDelete={handleDelete}
                            onRecategorize={handleRecategorize}
                            onMarkReplied={handleMarkReplied}
                            onMarkDeletable={handleMarkDeletable}
                            onNewCategory={handleNewCategory}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Category grid ── */}
            {appState === "ready" && categories.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {categories.map(cat => (
                  <CategoryBlock
                    key={cat.id}
                    category={cat}
                    categories={categories}
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
                    onRecategorize={handleRecategorize}
                    onMarkReplied={handleMarkReplied}
                    onMarkDeletable={handleMarkDeletable}
                    onNewCategory={handleNewCategory}
                    gmailAccount={activeAccount}
                  />
                ))}
              </div>
            )}

            {/* ── Delete candidates ── */}
            {appState === "ready" && deletableEmails.length > 0 && (
              <div className="mt-4 overflow-hidden" style={{
                background: "#FFFFFF",
                border: "1px solid rgba(26,10,53,0.07)",
                borderRadius: 16,
              }}>
                <div
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  style={{ borderBottom: "1px solid rgba(26,10,53,0.06)" }}
                >
                  <div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: "0.92rem", color: "rgba(26,10,53,0.62)", margin: "0 0 2px", letterSpacing: "0.05em" }}>
                      DELETE CANDIDATES
                    </p>
                    <p style={{ fontSize: "0.64rem", color: "rgba(26,10,53,0.28)", margin: 0 }}>
                      Old offers, expired links, OTPs, or delivery confirmations.
                    </p>
                  </div>
                  <span style={{ fontSize: "0.66rem", color: "rgba(26,10,53,0.30)" }}>
                    {deletableEmails.length} emails
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 px-2 pb-2 max-h-72 overflow-y-auto">
                  {deletableEmails.map(email => (
                    <EmailRow
                      key={email.id}
                      email={email}
                      selected={email.id === selectedEmail?.id}
                      isSelected={false}
                      selectionMode={false}
                      onClick={() => setSelectedEmail(prev => prev?.id === email.id ? null : email)}
                      onDoubleClick={() => { setExpandedEmail(email); setExpandedComposeMode(null) }}
                      onMarkRead={() => { void handleMarkRead(email) }}
                      onDelete={() => { void handleDelete(email) }}
                      onReply={() => { setExpandedEmail(email); setExpandedComposeMode("reply") }}
                      onForward={() => { setExpandedEmail(email); setExpandedComposeMode("forward") }}
                    />
                  ))}
                </div>
              </div>
            )}

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
                  ? <div className="flex items-center justify-center h-40" style={{ fontSize: "0.8rem", color: "rgba(26,10,53,0.28)" }}>Loading…</div>
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


"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import type { Email, Category, AccountId, RawEmail } from "@/lib/types"
import { ACCOUNTS } from "@/lib/types"
import { getCategories, saveCategories } from "@/lib/categories"
import { recordAction } from "@/lib/stats"
import { getCachedInbox, saveCachedInbox, type InboxCache } from "@/lib/inbox-cache"
import AccountToggle from "./AccountToggle"
import CategoryBlock from "./CategoryBlock"
import CategoryProposal from "./CategoryProposal"
import EmailModal from "./EmailModal"
import PlantHeader from "./PlantHeader"

type AppState = "idle" | "fetching" | "proposing" | "categorizing" | "ready" | "error"

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
  const [totalEmailsAtLoad, setTotalEmailsAtLoad] = useState(0)

  // In-memory cache for fast account switching within a session
  const sessionCache = useRef<Map<string, InboxCache>>(new Map())

  const activeAccountConfig = ACCOUNTS.find(a => a.id === activeAccount)!

  // ── Restore cached data ──────────────────────────────────────────────────────

  function restoreCache(accountEmail: string) {
    // Check in-memory session cache first (faster)
    const session = sessionCache.current.get(accountEmail)
    if (session) {
      setEmails(session.emails)
      setCategories(session.categories)
      setFetchedAt(session.fetchedAt)
      setAppState("ready")
      return true
    }
    // Fall back to localStorage
    const stored = getCachedInbox(accountEmail)
    if (stored) {
      setEmails(stored.emails)
      setCategories(stored.categories)
      setFetchedAt(stored.fetchedAt)
      sessionCache.current.set(accountEmail, stored)
      setAppState("ready")
      return true
    }
    return false
  }

  // ── On mount: restore last active account's data ─────────────────────────────

  useEffect(() => {
    restoreCache(activeAccountConfig.email)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load inbox ──────────────────────────────────────────────────────────────

  async function loadInbox() {
    setAppState("fetching")
    setErrorMsg("")
    setSelectedEmail(null)
    setEmails([])

    try {
      const msgRes = await fetch("/api/gmail/messages")
      if (!msgRes.ok) throw new Error("Failed to fetch Gmail messages")
      const rawEmails: RawEmail[] = await msgRes.json()

      const saved = getCategories(activeAccountConfig.email)
      if (saved && saved.length > 0) {
        await runCategorization(rawEmails, saved)
      } else {
        setAppState("proposing")
        setPendingRawEmails(rawEmails)

        const existingLabelsRes = await fetch("/api/gmail/labels")
        const fetchedLabelNames: string[] = existingLabelsRes.ok
          ? (await existingLabelsRes.json()).map((l: { name: string }) => l.name)
          : []
        setExistingLabelNames(fetchedLabelNames)

        const proposeRes = await fetch("/api/ai/propose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: rawEmails, existingLabelNames: fetchedLabelNames, account: activeAccountConfig.email }),
        })
        if (!proposeRes.ok) throw new Error("Failed to propose categories")
        const { categories: proposed } = await proposeRes.json()
        setProposedCategories(proposed)
      }
    } catch (err) {
      setAppState("error")
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong")
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
          body: JSON.stringify({ name: cat.name }),
        })
        if (!res.ok) throw new Error(`Failed to create Gmail label: ${cat.name}`)
        const { id } = await res.json()
        confirmed.push({ id, name: cat.name, color: cat.color, gmailLabelId: id })
      }

      saveCategories(activeAccountConfig.email, confirmed)
      setCategories(confirmed)
      await runCategorization(pendingRawEmails, confirmed)
    } catch (err) {
      setAppState("error")
      setErrorMsg(err instanceof Error ? err.message : "Failed to set up categories")
    }
  }

  // ── Run Claude categorization ────────────────────────────────────────────────

  const runCategorization = useCallback(async (rawEmails: RawEmail[], cats: Category[]) => {
    setAppState("categorizing")
    setCategories(cats)

    // Strip htmlBody before sending to API — it's large and not needed for categorization
    const emailsForApi = rawEmails.map(({ htmlBody: _, ...rest }) => rest)
    const catRes = await fetch("/api/ai/categorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: emailsForApi, categories: cats, account: activeAccountConfig.email }),
    })
    if (!catRes.ok) throw new Error("Failed to categorize emails")
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
          body: JSON.stringify({ messageId: email.id, gmailLabelId: cat.gmailLabelId }),
        }).catch(() => {})
      }
    })

    const now = new Date().toISOString()
    setEmails(categorized)
    setTotalEmailsAtLoad(categorized.length)
    setFetchedAt(now)
    setAppState("ready")

    // Persist to both caches
    const cache: InboxCache = { account: activeAccountConfig.email, emails: categorized, categories: cats, fetchedAt: now }
    sessionCache.current.set(activeAccountConfig.email, cache)
    saveCachedInbox(activeAccountConfig.email, categorized, cats)

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
          body: JSON.stringify({ deliveredEmailId: deliveredFromInbox.id, orderSender: deliveredFromInbox.orderSender }),
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
    fetch("/api/gmail/recent-deliveries")
      .then(r => r.json())
      .then((deliveries: { id: string; subject: string; from: string; sender: string }[]) => {
        if (!deliveries?.length) return
        const dismissed: string[] = JSON.parse(localStorage.getItem("inbox-ai:dismissed-cleanups") ?? "[]")
        const first = deliveries.find(d => !dismissed.includes(d.id))
        if (!first) return
        fetch("/api/ai/package-cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliveredEmailId: first.id, orderSender: first.sender }),
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
  }, [activeAccountConfig.email])

  // ── Account switch ───────────────────────────────────────────────────────────

  function handleAccountSwitch(id: AccountId) {
    setActiveAccount(id)
    setSelectedEmail(null)
    setProposedCategories(null)
    setErrorMsg("")

    const accountEmail = ACCOUNTS.find(a => a.id === id)!.email
    const restored = restoreCache(accountEmail)
    if (!restored) {
      setEmails([])
      setCategories([])
      setFetchedAt(null)
      setAppState("idle")
    }
  }

  // ── Email actions ────────────────────────────────────────────────────────────

  async function handleArchive(email: Email) {
    await fetch("/api/gmail/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: email.id }),
    })
    recordAction("archive")
    setEmails(prev => {
      const next = prev.filter(e => e.id !== email.id)
      saveCachedInbox(activeAccountConfig.email, next, categories)
      sessionCache.current.set(activeAccountConfig.email, {
        account: activeAccountConfig.email, emails: next, categories, fetchedAt: fetchedAt ?? new Date().toISOString()
      })
      return next
    })
    setSelectedEmail(null)
  }

  async function handleMarkRead(email: Email) {
    await fetch("/api/gmail/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: email.id }),
    })
    setEmails(prev => {
      const next = prev.filter(e => e.id !== email.id)
      saveCachedInbox(activeAccountConfig.email, next, categories)
      sessionCache.current.set(activeAccountConfig.email, {
        account: activeAccountConfig.email, emails: next, categories, fetchedAt: fetchedAt ?? new Date().toISOString()
      })
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
        inReplyTo: email.inReplyTo,
        messageId: email.messageId,
      }),
    })
    recordAction("reply")
  }

  async function handleStar(email: Email) {
    await fetch("/api/gmail/star", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: email.id }),
    })
    recordAction("star")
    setEmails(prev => {
      const next = prev.filter(e => e.id !== email.id)
      saveCachedInbox(activeAccountConfig.email, next, categories)
      sessionCache.current.set(activeAccountConfig.email, {
        account: activeAccountConfig.email, emails: next, categories, fetchedAt: fetchedAt ?? new Date().toISOString()
      })
      return next
    })
    if (selectedEmail?.id === email.id) setSelectedEmail(null)
  }

  async function handleDelete(email: Email) {
    await fetch("/api/gmail/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: email.id }),
    })
    recordAction("delete")
    setEmails(prev => {
      const next = prev.filter(e => e.id !== email.id)
      saveCachedInbox(activeAccountConfig.email, next, categories)
      sessionCache.current.set(activeAccountConfig.email, {
        account: activeAccountConfig.email, emails: next, categories, fetchedAt: fetchedAt ?? new Date().toISOString()
      })
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
    <div className="h-screen bg-zinc-50 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="grid grid-cols-3 items-center px-6 py-3 bg-white border-b border-zinc-200 shrink-0">
        {/* Left — logo + unread badge */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📬</span>
            <h1 className="text-base font-semibold text-zinc-900">Inbox AI</h1>
          </div>
          {appState === "ready" && fetchedAt && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-zinc-100 text-zinc-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                {emails.length} unread
              </span>
              <span className="text-xs text-zinc-400">{formatFetchedAt(fetchedAt)}</span>
            </div>
          )}
        </div>

        {/* Center — plant */}
        <div className="flex justify-center">
          <PlantHeader remaining={emails.length} total={totalEmailsAtLoad} />
        </div>

        {/* Right — account toggle + refresh */}
        <div className="flex items-center justify-end gap-3">
          <AccountToggle
            active={activeAccount}
            onChange={handleAccountSwitch}
            loading={isLoading}
          />
          <button
            onClick={loadInbox}
            disabled={isLoading}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {appState === "fetching" ? "Fetching…"
              : appState === "proposing" ? "Analyzing…"
              : appState === "categorizing" ? "Sorting…"
              : appState === "ready" ? "Refresh"
              : "Load inbox"}
          </button>
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Block grid */}
        <div className="flex-1 min-w-0 p-5 overflow-y-auto">
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
                          body: JSON.stringify({ messageId: id }),
                        }).catch(() => {})
                      )
                    )
                    setEmails(prev => prev.filter(e => !cleanupChecked.has(e.id)))
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
                            fetch(`/api/gmail/html?id=${email.id}`)
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

          {appState === "ready" && categories.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {categories.map(cat => (
                <CategoryBlock
                  key={cat.id}
                  category={cat}
                  emails={emails.filter(e => e.category === cat.name)}
                  selectedEmail={selectedEmail?.category === cat.name ? selectedEmail : null}
                  onSelect={email => setSelectedEmail(prev => prev?.id === email.id ? null : email)}
                  onExpand={email => setExpandedEmail(email)}
                  onClose={() => setSelectedEmail(null)}
                  onMarkRead={handleMarkRead}
                  onArchive={handleArchive}
                  onSaveDraft={handleSaveDraft}
                  onStar={handleStar}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {expandedEmail && (
        <EmailModal
          email={expandedEmail}
          onClose={() => setExpandedEmail(null)}
          onMarkRead={handleMarkRead}
          onStar={handleStar}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onSaveDraft={handleSaveDraft}
        />
      )}

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
  )
}

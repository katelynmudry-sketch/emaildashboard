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
  const [pendingRawEmails, setPendingRawEmails] = useState<RawEmail[]>([])
  const [packageCleanup, setPackageCleanup] = useState<{ emailIds: string[]; sender: string } | null>(null)

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
        const existingLabelNames: string[] = existingLabelsRes.ok
          ? (await existingLabelsRes.json()).map((l: { name: string }) => l.name)
          : []

        const proposeRes = await fetch("/api/ai/propose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: rawEmails, existingLabelNames, account: activeAccountConfig.email }),
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
    setFetchedAt(now)
    setAppState("ready")

    // Persist to both caches
    const cache: InboxCache = { account: activeAccountConfig.email, emails: categorized, categories: cats, fetchedAt: now }
    sessionCache.current.set(activeAccountConfig.email, cache)
    saveCachedInbox(activeAccountConfig.email, categorized, cats)

    const delivered = categorized.find(e => e.packageDelivered && e.orderSender)
    if (delivered?.orderSender) {
      const dismissed: string[] = JSON.parse(localStorage.getItem("inbox-ai:dismissed-cleanups") ?? "[]")
      if (!dismissed.includes(delivered.id)) {
        fetch("/api/ai/package-cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliveredEmailId: delivered.id, orderSender: delivered.orderSender }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.emailIds?.length > 0) {
              setPackageCleanup({ emailIds: data.emailIds, sender: delivered.orderSender! })
            }
          })
          .catch(() => {})
      }
    }
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
        onConfirm={handleConfirmCategories}
      />
    )
  }

  // ── Main layout ──────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-zinc-50 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg">📬</span>
          <h1 className="text-base font-semibold text-zinc-900">Inbox AI</h1>
        </div>
        <AccountToggle
          active={activeAccount}
          onChange={handleAccountSwitch}
          loading={isLoading}
        />
        <PlantHeader />
        <div className="flex items-center gap-3">
          {appState === "ready" && fetchedAt && (
            <span className="text-xs text-zinc-400">
              {emails.length} unread · {formatFetchedAt(fetchedAt)}
            </span>
          )}
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
            <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
              <span>📦 Package from <span className="font-medium">{packageCleanup.sender}</span> arrived — {packageCleanup.emailIds.length} shipping email{packageCleanup.emailIds.length !== 1 ? "s" : ""} found.</span>
              <button
                onClick={async () => {
                  await Promise.all(
                    packageCleanup.emailIds.map(id =>
                      fetch("/api/gmail/delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ messageId: id }),
                      }).catch(() => {})
                    )
                  )
                  setEmails(prev => prev.filter(e => !packageCleanup.emailIds.includes(e.id)))
                  setPackageCleanup(null)
                }}
                className="ml-auto shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
              >
                Delete chain
              </button>
              <button
                onClick={() => {
                  const dismissed: string[] = JSON.parse(localStorage.getItem("inbox-ai:dismissed-cleanups") ?? "[]")
                  const deliveredEmail = emails.find(e => e.packageDelivered && e.orderSender === packageCleanup.sender)
                  if (deliveredEmail) {
                    localStorage.setItem("inbox-ai:dismissed-cleanups", JSON.stringify([...dismissed, deliveredEmail.id]))
                  }
                  setPackageCleanup(null)
                }}
                className="shrink-0 text-amber-700 hover:text-amber-900 text-xs font-medium px-2 py-1.5 rounded-md hover:bg-amber-100 transition-colors"
              >
                Dismiss
              </button>
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
    </div>
  )
}

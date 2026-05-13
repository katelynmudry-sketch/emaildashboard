"use client"

import { useState, useEffect } from "react"
import type { AccountId, Email } from "@/lib/types"
import { recordAction } from "@/lib/stats"

interface Props {
  email: Email
  gmailAccount: AccountId
  onClose: () => void
  onMarkRead: (email: Email) => Promise<void>
  onStar: (email: Email) => Promise<void>
  onArchive: (email: Email) => Promise<void>
  onDelete: (email: Email) => Promise<void>
  onSaveDraft: (email: Email, body: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, forwardTo?: string) => Promise<void>
  initialComposeMode?: "ai" | "reply" | "forward" | null
}

function injectStyles(html: string): string {
  const inject = '<base target="_blank"><style>html{zoom:0.9}</style>'
  return /<head>/i.test(html)
    ? html.replace(/<head>/i, `<head>${inject}`)
    : `${inject}${html}`
}

const btn = "text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-700 shadow-[0_2px_0_0_#d1d5db] hover:shadow-[0_1px_0_0_#d1d5db] hover:translate-y-px active:shadow-none active:translate-y-0.5 transition-all duration-75"

export default function EmailModal({ email, gmailAccount, onClose, onMarkRead, onStar, onArchive, onDelete, onSaveDraft, onSend, initialComposeMode }: Props) {
  const [htmlBody, setHtmlBody] = useState<string | null>(email.htmlBody ?? null)
  const [loading, setLoading] = useState(!email.htmlBody)
  const [composeMode, setComposeMode] = useState<"ai" | "reply" | "forward" | null>(null)
  const [draftBody, setDraftBody] = useState("")
  const [forwardTo, setForwardTo] = useState("")
  const [aiDraftLoading, setAiDraftLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    if (email.htmlBody) { setHtmlBody(email.htmlBody); return }
    setLoading(true)
    fetch(`/api/gmail/html?id=${encodeURIComponent(email.id)}&account=${gmailAccount}`)
      .then(r => r.json())
      .then(data => setHtmlBody(data.htmlBody ?? null))
      .catch(() => setHtmlBody(null))
      .finally(() => setLoading(false))
  }, [email.id, gmailAccount])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    if (!initialComposeMode) return
    openCompose(initialComposeMode)
  }, [initialComposeMode, email.id])

  async function openCompose(mode: "ai" | "reply" | "forward") {
    if (mode === "forward") {
      setDraftBody(`\n\n---------- Forwarded message ----------\nFrom: ${email.from} <${email.fromEmail}>\nSubject: ${email.subject}\n\n${email.body}`)
      setForwardTo("")
      setComposeMode("forward")
      return
    }
    if (mode === "reply") {
      setDraftBody("")
      setComposeMode("reply")
      return
    }
    // AI Draft — call Claude
    recordAction("aiDraft", { emailId: email.id, subject: email.subject, mode: "reply" })
    setAiDraftLoading(true)
    setComposeMode("ai")
    // Snapshot any user-typed/pasted content before clearing so we can append it after
    const userContent = draftBody.trim()
    setDraftBody("")
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: { from: email.from, fromEmail: email.fromEmail, subject: email.subject, body: email.body } }),
      })
      const data = await res.json()
      const draftText = data.draft ?? ""
      setDraftBody(userContent ? `${draftText}\n\n${userContent}` : draftText)
    } finally {
      setAiDraftLoading(false)
    }
  }

  function closeCompose() {
    setComposeMode(null)
    setDraftBody("")
    setForwardTo("")
    setSendError(null)
  }

  async function handleSaveDraft() {
    setSavingDraft(true)
    try { await onSaveDraft(email, draftBody) } finally { setSavingDraft(false) }
    closeCompose()
  }

  async function handleSend() {
    setSending(true)
    setSendError(null)
    try {
      await onSend(
        email,
        composeMode === "forward" ? "forward" : "reply",
        draftBody,
        composeMode === "forward" ? forwardTo : undefined
      )
      closeCompose()
      onClose()
    } catch (err) {
      setSending(false)
      setSendError(err instanceof Error ? err.message : "Failed to send email")
    }
  }


  async function handleMarkRead() {
    await onMarkRead(email)
  }

  async function handleArchive() {
    await onArchive(email)
    onClose()
  }

  async function handleDelete() {
    await onDelete(email)
    onClose()
  }

  async function handleStar() {
    await onStar(email)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
          <div className="min-w-0 pr-4">
            <p className="text-xs text-zinc-400 mb-0.5">{email.from} · {email.fromEmail}</p>
            <h2 className="text-sm font-semibold text-zinc-900 leading-snug">{email.subject}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-zinc-400 hover:text-zinc-700 text-xl leading-none mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-zinc-100 shrink-0">
          <button onClick={handleMarkRead} className={btn}>Mark read</button>
          <button onClick={handleArchive} className={`${btn} text-zinc-900 font-semibold`}>Archive</button>
          <button onClick={handleStar} className={btn}>Star</button>
          <button onClick={handleDelete} className={`${btn} text-rose-600`}>Delete</button>
          <div className="flex-1" />
          <button onClick={() => openCompose("ai")} disabled={aiDraftLoading} className={`${btn} disabled:opacity-50`}>
            {aiDraftLoading ? "Drafting…" : "AI Draft"}
          </button>
          <button onClick={() => openCompose("reply")} className={btn}>Reply</button>
          <button onClick={() => openCompose("forward")} className={btn}>Forward</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-2 text-sm text-zinc-400">
              <div className="w-4 h-4 border-2 border-violet-300 border-t-transparent rounded-full animate-spin" />
              Loading email…
            </div>
          ) : htmlBody ? (
            <iframe
              srcDoc={injectStyles(htmlBody)}
              sandbox="allow-same-origin allow-popups"
              className="w-full border-0"
              style={{ minHeight: "500px" }}
              onLoad={e => {
                const iframe = e.currentTarget
                const height = iframe.contentDocument?.body?.scrollHeight
                if (height) iframe.style.height = height + 32 + "px"
              }}
              title="Email content"
            />
          ) : (
            <div className="p-5 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
              {email.body || email.snippet}
            </div>
          )}
        </div>

        {/* Compose area */}
        {composeMode && (
          <div className="border-t border-zinc-100 px-5 py-4 shrink-0 flex flex-col gap-3">
            {composeMode === "forward" && (
              <input
                type="email"
                value={forwardTo}
                onChange={e => setForwardTo(e.target.value)}
                placeholder="To: email address"
                className="w-full text-sm text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            )}
            {aiDraftLoading && (
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <div className="w-3 h-3 border-2 border-violet-300 border-t-transparent rounded-full animate-spin" />
                Claude is writing your draft…
              </div>
            )}
            <textarea
              rows={6}
              value={draftBody}
              onChange={e => setDraftBody(e.target.value)}
              className="w-full text-sm text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="Write your reply…"
              autoFocus
            />
            {sendError && (
              <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                <p className="font-medium">Send failed:</p>
                <p className="mt-0.5">{sendError}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveDraft}
                disabled={savingDraft || sending}
                className={btn}
              >
                {savingDraft ? "Saving…" : "Save to Drafts"}
              </button>
              <button
                onClick={handleSend}
                disabled={sending || savingDraft || (composeMode === "forward" && !forwardTo.trim())}
                className={`${btn} disabled:opacity-50`}
              >
                {sending ? "Sending…" : "Send"}
              </button>
              <button onClick={closeCompose} className={`${btn} text-zinc-500`}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

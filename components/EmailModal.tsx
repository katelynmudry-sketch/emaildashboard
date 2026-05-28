"use client"

import { useState, useEffect } from "react"
import type { AccountId, Email, Attachment } from "@/lib/types"
import { recordAction } from "@/lib/stats"
import { loadSettings } from "@/lib/settings-storage"
import { downloadAttachment } from "@/lib/attachment-download"
import ComposeArea from "./ComposeArea"

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  email: Email
  gmailAccount: AccountId
  onClose: () => void
  onMarkRead: (email: Email) => Promise<void>
  onStar: (email: Email) => Promise<void>
  onArchive: (email: Email) => Promise<void>
  onDelete: (email: Email) => Promise<void>
  onSaveDraft: (email: Email, body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onToggleTodo?: (email: Email) => void
  onSnooze?: (email: Email) => void
  initialComposeMode?: "ai" | "reply" | "forward" | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractUnsubscribeUrl(html: string | null, body: string): string | null {
  if (html) {
    const linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi
    let m: RegExpExecArray | null
    while ((m = linkRe.exec(html)) !== null) {
      const href = m[1]
      const text = m[2].toLowerCase()
      if (/unsubscribe|opt.?out|manage.*pref|email.*pref/i.test(text) || /unsubscribe/i.test(href)) {
        if (href.startsWith("http")) return href
      }
    }
  }
  const plainRe = /https?:\/\/[^\s<>"]+unsubscribe[^\s<>"]+/i
  const match = body.match(plainRe)
  return match ? match[0] : null
}

function injectStyles(html: string): string {
  const inject = '<base target="_blank"><style>html{zoom:0.9}</style>'
  return /<head>/i.test(html)
    ? html.replace(/<head>/i, `<head>${inject}`)
    : `${inject}${html}`
}

function forwardBody(email: Email): string {
  const subject = email.subject.toLowerCase().startsWith("fwd:")
    ? email.subject
    : `Fwd: ${email.subject}`
  return `\n\n---------- Forwarded message ----------\nFrom: ${email.from} <${email.fromEmail}>\nSubject: ${subject}\n\n${email.body}`
}

// ── Shared button class ───────────────────────────────────────────────────────

const btn = "text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-700 shadow-[0_2px_0_0_#d1d5db] hover:shadow-[0_1px_0_0_#d1d5db] hover:translate-y-px active:shadow-none active:translate-y-0.5 transition-all duration-75"

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmailModal({ email, gmailAccount, onClose, onMarkRead, onStar, onArchive, onDelete, onSaveDraft, onSend, onToggleTodo, onSnooze, initialComposeMode }: Props) {
  const [htmlBody, setHtmlBody] = useState<string | null>(email.htmlBody ?? null)
  const [loading, setLoading] = useState(!email.htmlBody)
  const [unsubscribeUrl, setUnsubscribeUrl] = useState<string | null>(() =>
    extractUnsubscribeUrl(email.htmlBody ?? null, email.body)
  )
  const [composeMode, setComposeMode] = useState<"reply" | "forward" | null>(null)
  const [initialBody, setInitialBody] = useState<string | undefined>(undefined)
  const [aiDraftLoading, setAiDraftLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // ── Load HTML body ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (email.htmlBody) {
      setHtmlBody(email.htmlBody)
      setUnsubscribeUrl(extractUnsubscribeUrl(email.htmlBody, email.body))
      return
    }
    setLoading(true)
    fetch(`/api/gmail/html?id=${encodeURIComponent(email.id)}&account=${gmailAccount}`)
      .then(r => r.json())
      .then(data => {
        setHtmlBody(data.htmlBody ?? null)
        setUnsubscribeUrl(extractUnsubscribeUrl(data.htmlBody ?? null, email.body))
      })
      .catch(() => setHtmlBody(null))
      .finally(() => setLoading(false))
  }, [email.id, gmailAccount])

  // ── Esc to close ────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // ── Auto-open compose when launched with a mode ─────────────────────────────

  useEffect(() => {
    if (!initialComposeMode) return
    void openCompose(initialComposeMode)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialComposeMode, email.id])

  // ── Compose helpers ─────────────────────────────────────────────────────────

  async function openCompose(mode: "ai" | "reply" | "forward") {
    if (mode === "forward") {
      setInitialBody(forwardBody(email))
      setComposeMode("forward")
      return
    }
    if (mode === "reply") {
      setInitialBody(undefined)
      setComposeMode("reply")
      return
    }
    // AI Draft — fetch first, then open compose with pre-filled body
    recordAction("aiDraft", { emailId: email.id, subject: email.subject, mode: "reply" })
    setAiDraftLoading(true)
    try {
      const settings = loadSettings()
      const isWork = gmailAccount === "work"
      const customContext = isWork ? settings.workRules : settings.personalRules
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: { from: email.from, fromEmail: email.fromEmail, subject: email.subject, body: email.body },
          systemContext: settings.systemContext || undefined,
          customContext: customContext || undefined,
        }),
      })
      const data = await res.json()
      setInitialBody(data.draft ?? "")
      setComposeMode("reply")
    } finally {
      setAiDraftLoading(false)
    }
  }

  function closeCompose() {
    setComposeMode(null)
    setInitialBody(undefined)
  }

  async function handleAiDraftInCompose(partialBody: string): Promise<string> {
    const settings = loadSettings()
    const isWork = gmailAccount === "work"
    const customContext = isWork ? settings.workRules : settings.personalRules
    const res = await fetch("/api/ai/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: { from: email.from, fromEmail: email.fromEmail, subject: email.subject, body: email.body },
        partialDraft: partialBody,
        systemContext: settings.systemContext || undefined,
        customContext: customContext || undefined,
      }),
    })
    const data = await res.json()
    return data.draft ?? ""
  }

  // ── Email actions ───────────────────────────────────────────────────────────

  async function handleMarkRead() { await onMarkRead(email) }
  async function handleArchive() { await onArchive(email); onClose() }
  async function handleDelete() { await onDelete(email); onClose() }
  async function handleStar() { await onStar(email) }

  // ── Attachment download ──────────────────────────────────────────────────────

  async function handleDownloadAttachment(att: { filename: string; mimeType: string; attachmentId: string }) {
    setDownloadingId(att.attachmentId)
    try {
      await downloadAttachment(email.id, att, gmailAccount)
    } finally {
      setDownloadingId(null)
    }
  }

  async function downloadAllAttachments() {
    if (!email.attachments?.length) return
    for (const att of email.attachments) {
      await handleDownloadAttachment(att)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

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
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-zinc-100 shrink-0 flex-wrap">
          <button onClick={handleMarkRead} className={btn}>Mark read</button>
          <button onClick={handleArchive} className={`${btn} text-zinc-900 font-semibold`}>Archive</button>
          <button onClick={handleStar} className={btn}>Star</button>
          <button onClick={handleDelete} className={`${btn} text-rose-600`}>Delete</button>
          {onToggleTodo && (
            <button
              onClick={() => onToggleTodo(email)}
              className={`${btn} ${email.todo ? "text-amber-800 bg-amber-100 border-amber-300" : ""}`}
            >
              {email.todo ? "★ TODO" : "☆ TODO"}
            </button>
          )}
          {onSnooze && (
            <button onClick={() => onSnooze(email)} className={btn}>💤 Snooze</button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => void openCompose("ai")}
            disabled={aiDraftLoading}
            className={`${btn} disabled:opacity-50`}
          >
            {aiDraftLoading ? "Drafting…" : "AI Draft"}
          </button>
          <button onClick={() => void openCompose("reply")} className={btn}>Reply</button>
          <button onClick={() => void openCompose("forward")} className={btn}>Forward</button>
        </div>

        {/* Unsubscribe banner */}
        {unsubscribeUrl && (
          <div className="flex items-center gap-3 px-5 py-2 bg-rose-50 border-b border-rose-100 shrink-0">
            <span className="text-xs text-rose-700 flex-1">📭 This email has an unsubscribe link.</span>
            <a
              href={unsubscribeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-rose-700 border border-rose-300 bg-white hover:bg-rose-50 px-3 py-1 rounded-full transition-colors"
            >
              Unsubscribe
            </a>
            <button
              onClick={() => setUnsubscribeUrl(null)}
              className="text-rose-400 hover:text-rose-600 text-sm leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

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

        {/* Attachments bar */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="border-t border-zinc-100 px-5 py-3 shrink-0 bg-zinc-50">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mr-1">
                📎 {email.attachments.length} attachment{email.attachments.length !== 1 ? "s" : ""}
              </span>

              {email.attachments.map(att => {
                const isDownloading = downloadingId === att.attachmentId
                const emoji = att.mimeType.startsWith("image/") ? "🖼" :
                  att.mimeType === "application/pdf" ? "📄" :
                  att.mimeType.startsWith("video/") ? "🎥" :
                  att.mimeType.startsWith("audio/") ? "🎵" : "📎"
                const kb = att.size > 0 ? (att.size < 1024 * 1024
                  ? `${Math.round(att.size / 1024)} KB`
                  : `${(att.size / (1024 * 1024)).toFixed(1)} MB`) : ""
                return (
                  <button
                    key={att.attachmentId}
                    type="button"
                    disabled={isDownloading}
                    onClick={() => void handleDownloadAttachment(att)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
                  >
                    <span>{emoji}</span>
                    <span className="max-w-[140px] truncate">{att.filename}</span>
                    {kb && <span className="opacity-60">{kb}</span>}
                    {isDownloading
                      ? <span className="opacity-60">↓…</span>
                      : <span className="opacity-40">↓</span>
                    }
                  </button>
                )
              })}

              {/* Work-only: Save all attachments to admin */}
              {gmailAccount === "work" && email.attachments.length > 1 && (
                <button
                  type="button"
                  disabled={downloadingId !== null}
                  onClick={() => void downloadAllAttachments()}
                  className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                >
                  {downloadingId !== null ? "Saving…" : "💾 Save all to admin"}
                </button>
              )}

              {/* Work-only: Save single attachment with admin label */}
              {gmailAccount === "work" && email.attachments.length === 1 && (
                <button
                  type="button"
                  disabled={downloadingId !== null}
                  onClick={() => void handleDownloadAttachment(email.attachments![0])}
                  className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                >
                  {downloadingId !== null ? "Saving…" : "💾 Save to admin"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Compose area */}
        {composeMode && (
          <div className="border-t border-zinc-100 px-5 py-4 shrink-0">
            <ComposeArea
              mode={composeMode}
              initialBody={initialBody}
              onAiDraft={composeMode === "reply" ? handleAiDraftInCompose : undefined}
              showUploadButton={gmailAccount === "work"}
              onSaveDraft={async (body, attachments, forwardTo) => {
                await onSaveDraft(email, body, attachments, forwardTo)
                closeCompose()
              }}
              onSend={async (body, attachments, forwardTo) => {
                await onSend(email, composeMode, body, attachments, forwardTo)
                closeCompose()
                onClose()
              }}
              onCancel={closeCompose}
            />
          </div>
        )}
      </div>
    </div>
  )
}

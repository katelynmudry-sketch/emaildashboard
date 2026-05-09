"use client"

import { useState, useEffect } from "react"
import type { Email } from "@/lib/types"
import DraftEditor from "./DraftEditor"

interface Props {
  email: Email | null
  onClose: () => void
  onArchive: (email: Email) => Promise<void>
  onMarkRead: (email: Email) => Promise<void>
  onSaveDraft: (email: Email, body: string) => Promise<void>
  onStar: (email: Email) => Promise<void>
  onDelete: (email: Email) => Promise<void>
}

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-rose-100 text-rose-700",
  today:  "bg-amber-100 text-amber-700",
  fyi:    "bg-emerald-100 text-emerald-700",
}

export default function DetailPanel({ email, onClose, onArchive, onMarkRead, onSaveDraft, onStar, onDelete }: Props) {
  const [showDraft, setShowDraft] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [archived, setArchived] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [htmlBody, setHtmlBody] = useState<string | null>(email?.htmlBody ?? null)
  const [htmlLoading, setHtmlLoading] = useState(false)

  useEffect(() => {
    if (!email) return
    if (email.htmlBody) {
      setHtmlBody(email.htmlBody)
      return
    }
    // Fetch HTML body on demand for cached emails that don't have it
    setHtmlBody(null)
    setHtmlLoading(true)
    fetch(`/api/gmail/html?id=${email.id}`)
      .then(r => r.json())
      .then(data => { setHtmlBody(data.htmlBody ?? null) })
      .catch(() => { setHtmlBody(null) })
      .finally(() => setHtmlLoading(false))
  }, [email?.id])

  if (!email) return null

  async function handleArchive() {
    if (!email) return
    setArchiving(true)
    await onArchive(email)
    setArchiving(false)
    setArchived(true)
  }

  return (
    <div className="flex flex-col bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-zinc-100">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_BADGE[email.priority]}`}>
              {email.priority}
            </span>
            <span className="text-xs text-zinc-400">{email.timeAgo}</span>
          </div>
          <h2 className="text-sm font-semibold text-zinc-900 leading-snug">{email.subject}</h2>
          {email.deletable && (
            <p className="text-xs text-zinc-400 mt-1">
              🗑 {email.deletableReason ?? "Safe to delete"}
            </p>
          )}
          <p className="text-xs text-zinc-500 mt-0.5">{email.from} · {email.fromEmail}</p>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 text-xl leading-none shrink-0 mt-0.5"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="max-h-[520px] overflow-y-auto p-4 space-y-3">
        {/* AI summary — only shown when present */}
        {email.summary && (
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">AI Summary</p>
            <p className="text-sm text-zinc-700 leading-relaxed">{email.summary}</p>
          </div>
        )}

        {/* Email body */}
        {htmlLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-zinc-400">
            <div className="w-4 h-4 border-2 border-violet-300 border-t-transparent rounded-full animate-spin" />
            Loading email…
          </div>
        ) : htmlBody ? (
          <iframe
            srcDoc={htmlBody}
            sandbox="allow-same-origin"
            className="w-full border-0 rounded"
            style={{ minHeight: "200px" }}
            onLoad={e => {
              const iframe = e.currentTarget
              const height = iframe.contentDocument?.body?.scrollHeight
              if (height) iframe.style.height = height + 32 + "px"
            }}
            title="Email content"
          />
        ) : (
          <div className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap break-words">
            {email.body || email.snippet}
          </div>
        )}

        {/* Draft editor */}
        {showDraft && (
          <DraftEditor
            email={email}
            onApprove={async body => {
              await onSaveDraft(email, body)
              setShowDraft(false)
            }}
            onCancel={() => setShowDraft(false)}
          />
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-zinc-100 space-y-2">
        {archived ? (
          <p className="text-sm text-emerald-600 text-center font-medium">Archived ✓</p>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { onMarkRead(email) }}
              className="flex-1 text-sm py-1.5 border border-zinc-200 text-zinc-600 hover:text-zinc-800 hover:bg-zinc-50 rounded-lg transition-colors"
            >
              Mark read
            </button>
            <button
              onClick={() => setShowDraft(v => !v)}
              className="flex-1 text-sm py-1.5 bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100 rounded-lg transition-colors font-medium"
            >
              {showDraft ? "Hide draft" : "Reply"}
            </button>
            <button
              onClick={() => onStar(email)}
              className="flex-1 text-sm py-1.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors font-medium"
            >
              Star
            </button>
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="flex-1 text-sm py-1.5 bg-zinc-800 hover:bg-zinc-900 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
            >
              {archiving ? "…" : "Archive"}
            </button>
            <button
              onClick={async () => {
                setDeleting(true)
                await onDelete(email)
                setDeleting(false)
              }}
              disabled={deleting}
              className="flex-1 text-sm py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 disabled:opacity-50 rounded-lg transition-colors font-medium"
            >
              {deleting ? "…" : "Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

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

const btnBase =
  "text-[11px] font-medium px-2 py-1 rounded-md bg-white border border-zinc-300 text-zinc-700 shadow-[0_2px_0_0_#d1d5db] hover:shadow-[0_1px_0_0_#d1d5db] hover:translate-y-px active:shadow-none active:translate-y-0.5 transition-all duration-75 whitespace-nowrap"

export default function DetailPanel({ email, onClose, onArchive, onMarkRead, onSaveDraft, onStar, onDelete }: Props) {
  const [draftMode, setDraftMode] = useState<"ai" | "manual" | "forward" | null>(null)
  const [aiDraftBody, setAiDraftBody] = useState<string | null>(null)
  const [aiDraftLoading, setAiDraftLoading] = useState(false)
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
        {email.summary && (
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">AI Summary</p>
            <p className="text-sm text-zinc-700 leading-relaxed">{email.summary}</p>
          </div>
        )}

        {htmlLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-zinc-400">
            <div className="w-4 h-4 border-2 border-violet-300 border-t-transparent rounded-full animate-spin" />
            Loading email…
          </div>
        ) : htmlBody ? (
          <iframe
            srcDoc={(() => {
              const inject = '<base target="_blank"><style>html{zoom:0.85}</style>'
              return /<head>/i.test(htmlBody)
                ? htmlBody.replace(/<head>/i, `<head>${inject}`)
                : `${inject}${htmlBody}`
            })()}
            sandbox="allow-same-origin allow-popups"
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

        {draftMode && (
          <DraftEditor
            email={email}
            mode={draftMode === "forward" ? "forward" : "reply"}
            initialBody={draftMode === "ai" ? (aiDraftBody ?? "") : ""}
            onSaveDraft={async body => {
              await onSaveDraft(email, body)
              setDraftMode(null)
            }}
            onCancel={() => setDraftMode(null)}
          />
        )}
      </div>

      {/* Actions */}
      <div className="px-3 py-2.5 border-t border-zinc-100 space-y-1.5">
        {archived ? (
          <p className="text-xs text-emerald-600 text-center font-medium">Archived ✓</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => onMarkRead(email)}
              className={btnBase}
            >
              Mark read
            </button>
            <button
              disabled={aiDraftLoading}
              onClick={async () => {
                if (draftMode === "ai") { setDraftMode(null); return }
                setAiDraftLoading(true)
                setDraftMode(null)
                try {
                  const res = await fetch("/api/ai/draft", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: { from: email.from, fromEmail: email.fromEmail, subject: email.subject, body: email.body } }),
                  })
                  const data = await res.json()
                  setAiDraftBody(data.draft ?? "")
                } finally {
                  setAiDraftLoading(false)
                  setDraftMode("ai")
                }
              }}
              className={`${btnBase} disabled:opacity-50`}
            >
              {aiDraftLoading ? "Drafting…" : "AI Draft"}
            </button>
            <button
              onClick={() => setDraftMode(m => m === "manual" ? null : "manual")}
              className={btnBase}
            >
              Reply
            </button>
            <button
              onClick={() => setDraftMode(m => m === "forward" ? null : "forward")}
              className={btnBase}
            >
              Forward
            </button>
            <button
              onClick={() => onStar(email)}
              className={btnBase}
            >
              Star
            </button>
            <button
              onClick={handleArchive}
              disabled={archiving}
              className={`${btnBase} disabled:opacity-50`}
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
              className={`${btnBase} text-rose-600 disabled:opacity-50`}
            >
              {deleting ? "…" : "Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

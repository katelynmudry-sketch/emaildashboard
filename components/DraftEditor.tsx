"use client"

import { useState } from "react"
import type { Email } from "@/lib/types"

interface Props {
  email: Email
  mode?: "reply" | "forward"
  initialBody?: string
  onSaveDraft: (body: string) => Promise<void>
  onSend: (body: string, forwardTo?: string) => Promise<void>
  onCancel: () => void
}

const btnBase =
  "text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-700 shadow-[0_2px_0_0_#d1d5db] hover:shadow-[0_1px_0_0_#d1d5db] hover:translate-y-px active:shadow-none active:translate-y-0.5 transition-all duration-75"

function forwardBody(email: Email): string {
  return `\n\n---------- Forwarded message ----------\nFrom: ${email.from} <${email.fromEmail}>\nSubject: ${email.subject}\n\n${email.body}`
}

export default function DraftEditor({ email, mode = "reply", initialBody, onSaveDraft, onSend, onCancel }: Props) {
  const [body, setBody] = useState(initialBody ?? (mode === "forward" ? forwardBody(email) : ""))
  const [forwardTo, setForwardTo] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [aiCompleting, setAiCompleting] = useState(false)

  async function handleAiComplete() {
    setAiCompleting(true)
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: { from: email.from, fromEmail: email.fromEmail, subject: email.subject, body: email.body },
          partialDraft: body,
        }),
      })
      const data = await res.json()
      if (data.draft) setBody(data.draft)
    } finally {
      setAiCompleting(false)
    }
  }

  const to = mode === "forward" ? forwardTo : email.fromEmail
  const subject = mode === "forward" ? `Fwd: ${email.subject}` : email.subject

  async function handleSaveDraft() {
    setSaving(true)
    await onSaveDraft(body)
    setSaving(false)
    setSaved(true)
  }

  async function handleSend() {
    setSending(true)
    setSendError(null)
    try {
      await onSend(body, mode === "forward" ? forwardTo : undefined)
      setSent(true)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send")
    } finally {
      setSending(false)
    }
  }

  if (saved) {
    return (
      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
        Draft saved to Gmail ✓
      </div>
    )
  }

  if (sent) {
    return (
      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
        Sent ✓
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        {mode === "forward" ? "Forward" : "Draft reply"}
      </p>
      {mode === "forward" && (
        <input
          type="email"
          value={forwardTo}
          onChange={e => setForwardTo(e.target.value)}
          placeholder="To: email address"
          className="w-full text-sm text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
        />
      )}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={6}
        className="w-full text-sm text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
        placeholder="Write your reply..."
      />
      {sendError && (
        <p className="text-xs text-rose-600">{sendError}</p>
      )}
      <div className="flex gap-2 flex-wrap">
        {mode === "reply" && (
          <button
            onClick={handleAiComplete}
            disabled={aiCompleting}
            className={`${btnBase} text-violet-700 border-violet-300 bg-violet-50 hover:bg-violet-100 disabled:opacity-50`}
          >
            {aiCompleting ? "Writing…" : body.trim() ? "AI complete" : "AI draft"}
          </button>
        )}
        <button
          onClick={handleSaveDraft}
          disabled={saving || !body.trim() || (mode === "forward" && !forwardTo.trim())}
          className={`${btnBase} disabled:opacity-50`}
        >
          {saving ? "Saving…" : "Save to Drafts"}
        </button>
        <button
          onClick={handleSend}
          disabled={sending || !body.trim() || (mode === "forward" && !forwardTo.trim())}
          className={`${btnBase} disabled:opacity-50`}
        >
          {sending ? "Sending…" : "Send"}
        </button>
        <button onClick={onCancel} className={btnBase}>
          Cancel
        </button>
      </div>
    </div>
  )
}

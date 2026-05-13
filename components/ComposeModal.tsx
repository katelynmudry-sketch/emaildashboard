"use client"

import { useEffect, useState } from "react"
import { recordAction } from "@/lib/stats"
import type { AccountId } from "@/lib/types"

interface Props {
  open: boolean
  onClose: () => void
  gmailAccount: AccountId
}

const btnBase =
  "text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-700 shadow-[0_2px_0_0_#d1d5db] hover:shadow-[0_1px_0_0_#d1d5db] hover:translate-y-px active:shadow-none active:translate-y-0.5 transition-all duration-75"

const inputClass =
  "w-full text-sm text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"

export default function ComposeModal({ open, onClose, gmailAccount }: Props) {
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<"sent" | "draft" | null>(null)

  useEffect(() => {
    if (!open) return
    setTo("")
    setSubject("")
    setBody("")
    setError(null)
    setDone(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const canSubmit = to.trim() && body.trim()

  async function handleSaveDraft() {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/gmail/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim() || "(no subject)",
          body,
          account: gmailAccount,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.error === "string" ? data.error : await res.text())
      }
      recordAction("saveDraft", { subject: subject.trim() || "(no subject)" })
      setDone("draft")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save draft")
    } finally {
      setSaving(false)
    }
  }

  async function handleSend() {
    if (!canSubmit) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim() || "(no subject)",
          body,
          account: gmailAccount,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.error === "string" ? data.error : await res.text())
      }
      recordAction("composeSent", { subject: subject.trim() || "(no subject)", details: "new message" })
      setDone("sent")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send")
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="compose-title"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h2 id="compose-title" className="text-sm font-semibold text-zinc-900">
            New message
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-3">
          {done === "sent" && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              Message sent.
            </p>
          )}
          {done === "draft" && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              Draft saved in Gmail.
            </p>
          )}

          {done === null && (
            <>
              <input
                type="email"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="To"
                className={inputClass}
                autoComplete="email"
              />
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Subject"
                className={inputClass}
              />
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={8}
                placeholder="Message"
                className={`${inputClass} resize-none py-3`}
              />
            </>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex flex-wrap gap-2 pt-1">
            {done === null ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending || !canSubmit}
                  className={`${btnBase} disabled:opacity-50`}
                >
                  {sending ? "Sending…" : "Send"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveDraft()}
                  disabled={saving || !canSubmit}
                  className={`${btnBase} disabled:opacity-50`}
                >
                  {saving ? "Saving…" : "Save draft"}
                </button>
                <button type="button" onClick={onClose} className={btnBase}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={onClose} className={btnBase}>
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

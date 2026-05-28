"use client"

import { useEffect, useState } from "react"
import { recordAction } from "@/lib/stats"
import type { AccountId, Attachment } from "@/lib/types"
import ComposeArea from "./ComposeArea"

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  gmailAccount: AccountId
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const btnBase =
  "text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-700 shadow-[0_2px_0_0_#d1d5db] hover:shadow-[0_1px_0_0_#d1d5db] hover:translate-y-px active:shadow-none active:translate-y-0.5 transition-all duration-75"

const inputClass =
  "w-full text-sm text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"

// ── Component ─────────────────────────────────────────────────────────────────

export default function ComposeModal({ open, onClose, gmailAccount }: Props) {
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [done, setDone] = useState<"sent" | "draft" | null>(null)
  // Key forces ComposeArea to remount (reset its body/attachments) each time the modal opens
  const [composeKey, setComposeKey] = useState(0)

  useEffect(() => {
    if (!open) return
    setTo("")
    setSubject("")
    setDone(null)
    setComposeKey(k => k + 1)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  async function handleSend(body: string, attachments: Attachment[]) {
    if (!to.trim()) throw new Error("Recipient email address is required")
    const res = await fetch("/api/gmail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: to.trim(),
        subject: subject.trim() || "(no subject)",
        body,
        account: gmailAccount,
        attachments: attachments.length > 0 ? attachments : undefined,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(typeof data.error === "string" ? data.error : `Send failed: ${res.status}`)
    }
    recordAction("composeSent", { subject: subject.trim() || "(no subject)", details: "new message" })
    setDone("sent")
  }

  async function handleSaveDraft(body: string, attachments: Attachment[]) {
    if (!to.trim()) throw new Error("Recipient email address is required")
    const res = await fetch("/api/gmail/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: to.trim(),
        subject: subject.trim() || "(no subject)",
        body,
        account: gmailAccount,
        attachments: attachments.length > 0 ? attachments : undefined,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(typeof data.error === "string" ? data.error : `Draft save failed: ${res.status}`)
    }
    recordAction("saveDraft", { subject: subject.trim() || "(no subject)" })
    setDone("draft")
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
        {/* Modal header */}
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
          {/* Success states */}
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
              {/* To / Subject fields */}
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

              {/* Shared compose area (body + attachments + buttons) */}
              <ComposeArea
                key={composeKey}
                mode="compose"
                onSend={handleSend}
                onSaveDraft={handleSaveDraft}
                onCancel={onClose}
                sendLabel="Send"
                cancelLabel="Cancel"
              />
            </>
          )}

          {/* Close button after success */}
          {done !== null && (
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className={btnBase}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

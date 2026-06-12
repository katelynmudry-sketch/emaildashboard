"use client"

import { useState, useEffect } from "react"
import type { AccountId, Email, Attachment } from "@/lib/types"
import { useAiDraft } from "@/lib/hooks/useAiDraft"
import ComposeArea from "./ComposeArea"

export type ComposeMode = "new" | "reply" | "forward"
export type ComposePresentation = "modal" | "inline"

interface Props {
  mode: ComposeMode
  presentation: ComposePresentation
  gmailAccount: AccountId
  /** Required for reply/forward, omit for new message */
  email?: Email
  /** Auto-trigger AI draft generation on mount (for the "AI Draft" action button flow) */
  autoAiDraft?: boolean
  /** reply/forward: (body, att, forwardTo?) | new: (body, att, toAddress, subject) */
  onSend: (body: string, attachments: Attachment[], forwardToOrTo?: string, subject?: string) => void
  onSaveDraft: (body: string, attachments: Attachment[], forwardToOrTo?: string, subject?: string) => Promise<void>
  onClose: () => void
  showUploadButton?: boolean
}

function makeForwardBody(email: Email): string {
  const subject = email.subject.toLowerCase().startsWith("fwd:")
    ? email.subject
    : `Fwd: ${email.subject}`
  return `\n\n---------- Forwarded message ----------\nFrom: ${email.from} <${email.fromEmail}>\nSubject: ${subject}\n\n${email.body}`
}

const inputCls =
  "w-full text-sm text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"

const btnSm =
  "text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-700 shadow-[0_2px_0_0_#d1d5db] hover:shadow-[0_1px_0_0_#d1d5db] hover:translate-y-px active:shadow-none active:translate-y-0.5 transition-all duration-75"

export default function ComposeWindow({
  mode, presentation, gmailAccount, email, autoAiDraft = false,
  onSend, onSaveDraft, onClose, showUploadButton,
}: Props) {
  // "new" mode fields
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")

  // Remounting key + seeded body for AI draft / forward boilerplate
  const [bodyKey, setBodyKey] = useState(0)
  const [seededBody, setSeededBody] = useState<string | undefined>(
    mode === "forward" && email ? makeForwardBody(email) : undefined
  )

  // "sent" / "draft" confirmation — only used in modal presentation
  const [done, setDone] = useState<"sent" | "draft" | null>(null)

  const emailCtx = email
    ? { id: email.id, from: email.from, fromEmail: email.fromEmail, subject: email.subject, body: email.body }
    : null

  const { loading: aiLoading, error: aiError, generateDraft, fetchDraft } = useAiDraft(emailCtx, gmailAccount)

  // Auto-generate draft on mount when requested (e.g. "AI Draft" button in parent)
  useEffect(() => {
    if (!autoAiDraft || !emailCtx) return
    generateDraft(draft => {
      setSeededBody(draft)
      setBodyKey(k => k + 1)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Esc closes when displayed as a modal
  useEffect(() => {
    if (presentation !== "modal") return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [presentation, onClose])

  function handleSend(body: string, attachments: Attachment[], forwardTo?: string) {
    if (mode === "new") {
      onSend(body, attachments, to.trim() || undefined, subject.trim() || undefined)
    } else {
      onSend(body, attachments, forwardTo, undefined)
    }
    if (presentation === "modal") setDone("sent")
  }

  async function handleSaveDraft(body: string, attachments: Attachment[], forwardTo?: string) {
    if (mode === "new") {
      await onSaveDraft(body, attachments, to.trim() || undefined, subject.trim() || undefined)
    } else {
      await onSaveDraft(body, attachments, forwardTo, undefined)
    }
    if (presentation === "modal") setDone("draft")
  }

  function handleAiDraft() {
    generateDraft(draft => {
      setSeededBody(draft)
      setBodyKey(k => k + 1)
    })
  }

  const body = (
    <div className={presentation === "modal" ? "p-5 space-y-3" : "space-y-3"}>
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
          {mode === "new" && (
            <>
              <input
                type="email"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="To"
                className={inputCls}
                autoComplete="email"
              />
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Subject"
                className={inputCls}
              />
            </>
          )}

          {mode !== "new" && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={aiLoading}
                onClick={handleAiDraft}
                className={`${btnSm} disabled:opacity-50`}
              >
                {aiLoading ? "Drafting…" : "AI Draft"}
              </button>
              {aiError && (
                <p className="text-xs text-rose-600">{aiError}</p>
              )}
            </div>
          )}

          <ComposeArea
            key={bodyKey}
            mode={mode === "new" ? "compose" : mode}
            initialBody={seededBody}
            onAiDraft={mode !== "new" ? fetchDraft : undefined}
            showUploadButton={showUploadButton ?? gmailAccount === "work"}
            onSend={handleSend}
            onSaveDraft={handleSaveDraft}
            onCancel={onClose}
            sendLabel="Send"
            cancelLabel={presentation === "modal" ? "Cancel" : "Discard"}
          />
        </>
      )}

      {done !== null && (
        <button type="button" onClick={onClose} className={btnSm}>
          Close
        </button>
      )}
    </div>
  )

  if (presentation === "modal") {
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
          aria-modal="true"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              {mode === "new" ? "New message" : mode === "reply" ? "Reply" : "Forward"}
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
          {body}
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-zinc-100 px-5 py-4">
      {body}
    </div>
  )
}

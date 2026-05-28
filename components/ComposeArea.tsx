"use client"

import { useState, useRef } from "react"
import type { Attachment } from "@/lib/types"

// ── Local attachment (before converting to API format) ────────────────────────

interface LocalAttachment {
  id: string
  file: File
  base64: string
  name: string
  size: number
  mimeType: string
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ComposeAreaProps {
  mode: "reply" | "forward" | "compose"
  initialBody?: string
  /** Pre-populate the forward-to field (forward mode only) */
  initialForwardTo?: string
  onSend: (body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSaveDraft: (body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onCancel: () => void
  /** Called when AI Draft/Complete button is clicked; receives current body, returns new body */
  onAiDraft?: (partialBody: string) => Promise<string>
  sendLabel?: string
  cancelLabel?: string
  /** Show a prominent "Upload file" button (work email only) */
  showUploadButton?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GMAIL_MAX_BYTES = 25 * 1024 * 1024

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileEmoji(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼"
  if (mimeType === "application/pdf") return "📄"
  if (mimeType.startsWith("video/")) return "🎥"
  if (mimeType.startsWith("audio/")) return "🎵"
  return "📎"
}

// ── Shared button class ───────────────────────────────────────────────────────

const btnBase =
  "text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-700 shadow-[0_2px_0_0_#d1d5db] hover:shadow-[0_1px_0_0_#d1d5db] hover:translate-y-px active:shadow-none active:translate-y-0.5 transition-all duration-75"

const inputCls =
  "w-full text-sm text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"

// ── Component ─────────────────────────────────────────────────────────────────

export default function ComposeArea({
  mode,
  initialBody,
  initialForwardTo,
  onSend,
  onSaveDraft,
  onCancel,
  onAiDraft,
  sendLabel = "Send",
  cancelLabel = "Cancel",
  showUploadButton = false,
}: ComposeAreaProps) {
  const [body, setBody] = useState(initialBody ?? "")
  const [forwardTo, setForwardTo] = useState(initialForwardTo ?? "")
  const [attachments, setAttachments] = useState<LocalAttachment[]>([])
  const [encoding, setEncoding] = useState(false)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totalBytes = attachments.reduce((s, a) => s + a.size, 0)
  const overLimit = totalBytes > GMAIL_MAX_BYTES
  const forwardMissingTo = mode === "forward" && !forwardTo.trim()
  const canSend = !sending && !saving && !encoding && !overLimit && !forwardMissingTo && body.trim().length > 0

  function toApiAttachments(): Attachment[] {
    return attachments.map(a => ({
      filename: a.name,
      mimeType: a.mimeType,
      data: a.base64,
      size: a.size,
    }))
  }

  // ── File handling ───────────────────────────────────────────────────────────

  function handleFilePick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ""

    setEncoding(true)
    let pending = files.length
    const incoming: LocalAttachment[] = []

    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Strip "data:<mime>;base64," prefix
        const base64 = result.split(",")[1] ?? ""
        incoming.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          base64,
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        })
        pending--
        if (pending === 0) {
          setAttachments(prev => {
            const existingNames = new Set(prev.map(a => a.name))
            return [...prev, ...incoming.filter(a => !existingNames.has(a.name))]
          })
          setEncoding(false)
        }
      }
      reader.readAsDataURL(file)
    })
  }

  function removeAttachment(id: string) {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleAiDraftClick() {
    if (!onAiDraft) return
    setAiLoading(true)
    try {
      const draft = await onAiDraft(body)
      if (draft) setBody(draft)
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSend() {
    if (!canSend) return
    setSending(true)
    setError(null)
    try {
      await onSend(body, toApiAttachments(), mode === "forward" ? forwardTo : undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send")
    } finally {
      setSending(false)
    }
  }

  async function handleSaveDraft() {
    if (saving || encoding) return
    setSaving(true)
    setError(null)
    try {
      await onSaveDraft(body, toApiAttachments(), mode === "forward" ? forwardTo : undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft")
    } finally {
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">

      {/* Forward-to field (forward mode only) */}
      {mode === "forward" && (
        <input
          type="email"
          value={forwardTo}
          onChange={e => setForwardTo(e.target.value)}
          placeholder="To: email address"
          className={inputCls}
        />
      )}

      {/* Body textarea */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={mode === "forward" ? 6 : 5}
        placeholder={mode === "forward" ? "Add a message (optional)…" : "Write your reply…"}
        className={`${inputCls} resize-none`}
      />

      {/* Work-only prominent upload button */}
      {showUploadButton && (
        <button
          type="button"
          onClick={handleFilePick}
          disabled={encoding}
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors w-full justify-center"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {encoding ? "Reading file…" : "📎 Upload file for patient / admin"}
        </button>
      )}

      {/* Attachment strip */}
      <div className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
        attachments.length > 0
          ? "border-zinc-300 bg-zinc-50"
          : "border-dashed border-zinc-200 bg-transparent"
      }`}>
        {/* Attach button */}
        <button
          type="button"
          onClick={handleFilePick}
          disabled={encoding}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-violet-600 disabled:opacity-40 transition-colors"
        >
          {/* Paperclip icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
          {encoding ? "Reading…" : attachments.length > 0 ? "Add more" : "Attach file"}
        </button>

        {/* File chips */}
        {attachments.map(att => {
          const mb = att.size / (1024 * 1024)
          const isWarn = mb > 10 && mb <= 25
          const isErr = mb > 25
          return (
            <span
              key={att.id}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${
                isErr
                  ? "bg-rose-50 border-rose-200 text-rose-700"
                  : isWarn
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-violet-50 border-violet-200 text-violet-700"
              }`}
            >
              <span>{isErr ? "🚫" : isWarn ? "⚠️" : fileEmoji(att.mimeType)}</span>
              <span className="max-w-[120px] truncate">{att.name}</span>
              <span className="opacity-60">{formatSize(att.size)}</span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="ml-0.5 opacity-50 hover:opacity-100 leading-none"
                aria-label={`Remove ${att.name}`}
              >
                ×
              </button>
            </span>
          )
        })}

        {/* Total size when multiple files */}
        {attachments.length > 1 && (
          <span className={`ml-auto text-xs ${
            overLimit ? "text-rose-600 font-medium" : totalBytes > 10 * 1024 * 1024 ? "text-amber-600" : "text-zinc-400"
          }`}>
            {formatSize(totalBytes)} / 25 MB
          </span>
        )}
      </div>

      {/* Over-limit warning */}
      {overLimit && (
        <p className="text-xs text-rose-600">
          Total attachment size exceeds Gmail&apos;s 25 MB limit. Remove some files to send.
        </p>
      )}

      {/* Error */}
      {error && <p className="text-xs text-rose-600">{error}</p>}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {onAiDraft && mode !== "forward" && (
          <button
            type="button"
            onClick={() => void handleAiDraftClick()}
            disabled={aiLoading}
            className={`${btnBase} text-violet-700 border-violet-300 bg-violet-50 hover:bg-violet-100 disabled:opacity-50`}
          >
            {aiLoading ? "Writing…" : body.trim() ? "AI complete" : "AI draft"}
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          className={`${btnBase} disabled:opacity-50`}
        >
          {sending ? "Sending…" : sendLabel}
        </button>
        <button
          type="button"
          onClick={() => void handleSaveDraft()}
          disabled={saving || encoding || forwardMissingTo}
          className={`${btnBase} disabled:opacity-50`}
        >
          {saving ? "Saving…" : "Save to Drafts"}
        </button>
        <button type="button" onClick={onCancel} className={btnBase}>
          {cancelLabel}
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}

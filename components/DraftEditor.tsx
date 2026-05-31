"use client"

import { useState } from "react"
import type { AccountId, Email, Attachment } from "@/lib/types"
import { loadSettings } from "@/lib/settings-storage"
import ComposeArea from "./ComposeArea"

// ── Helpers ───────────────────────────────────────────────────────────────────

function forwardBody(email: Email): string {
  return `\n\n---------- Forwarded message ----------\nFrom: ${email.from} <${email.fromEmail}>\nSubject: ${email.subject}\n\n${email.body}`
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  email: Email
  gmailAccount?: AccountId
  mode?: "reply" | "forward"
  initialBody?: string
  onSaveDraft: (body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSend: (body: string, attachments: Attachment[], forwardTo?: string) => void
  onCancel: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DraftEditor({ email, gmailAccount, mode = "reply", initialBody, onSaveDraft, onSend, onCancel }: Props) {
  const [saved, setSaved] = useState(false)
  const [sent, setSent] = useState(false)

  const computedInitialBody = initialBody ?? (mode === "forward" ? forwardBody(email) : undefined)

  async function handleAiDraft(partialBody: string): Promise<string> {
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
      <ComposeArea
        mode={mode}
        initialBody={computedInitialBody}
        onAiDraft={mode === "reply" ? handleAiDraft : undefined}
        showUploadButton={gmailAccount === "work"}
        onSaveDraft={async (body, attachments, forwardTo) => {
          await onSaveDraft(body, attachments, forwardTo)
          setSaved(true)
        }}
        onSend={(body, attachments, forwardTo) => {
          onSend(body, attachments, forwardTo)
          setSent(true)
        }}
        onCancel={onCancel}
      />
    </div>
  )
}

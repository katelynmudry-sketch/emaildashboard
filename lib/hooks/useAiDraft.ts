"use client"

import { useState } from "react"
import type { AccountId } from "@/lib/types"
import { loadSettings } from "@/lib/settings-storage"
import { recordAction } from "@/lib/stats"

interface EmailContext {
  id: string
  from: string
  fromEmail: string
  subject: string
  body: string
}

export function useAiDraft(emailCtx: EmailContext | null, gmailAccount: AccountId) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchDraft(partialBody?: string): Promise<string> {
    if (!emailCtx) return ""
    const settings = loadSettings()
    const isWork = gmailAccount === "work"
    const customContext = isWork ? settings.workRules : settings.personalRules
    const res = await fetch("/api/ai/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: { from: emailCtx.from, fromEmail: emailCtx.fromEmail, subject: emailCtx.subject, body: emailCtx.body },
        partialDraft: partialBody,
        systemContext: settings.systemContext || undefined,
        customContext: customContext || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `AI draft failed (${res.status})`)
    return data.draft ?? ""
  }

  async function generateDraft(onDone: (draft: string) => void) {
    if (!emailCtx) return
    recordAction("aiDraft", { emailId: emailCtx.id, subject: emailCtx.subject, mode: "reply" })
    setLoading(true)
    setError(null)
    try {
      const draft = await fetchDraft()
      onDone(draft)
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI draft failed")
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, generateDraft, fetchDraft }
}

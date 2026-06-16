"use client"

import type { AccountId, Attachment } from "@/lib/types"
import { recordAction } from "@/lib/stats"
import ComposeWindow from "./ComposeWindow"

interface Props {
  open: boolean
  onClose: () => void
  gmailAccount: AccountId
}

export default function ComposeModal({ open, onClose, gmailAccount }: Props) {
  if (!open) return null

  async function handleSend(body: string, attachments: Attachment[], to?: string, subject?: string): Promise<void> {
    if (!to) throw new Error("Recipient email address is required")
    const res = await fetch("/api/gmail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject: subject || "(no subject)",
        body,
        account: gmailAccount,
        attachments: attachments.length > 0 ? attachments : undefined,
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(typeof d.error === "string" ? d.error : `Send failed: ${res.status}`)
    }
    recordAction("composeSent", { subject: subject || "(no subject)", details: "new message" })
  }

  async function handleSaveDraft(body: string, attachments: Attachment[], to?: string, subject?: string) {
    if (!to) throw new Error("Recipient email address is required")
    const res = await fetch("/api/gmail/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject: subject || "(no subject)",
        body,
        account: gmailAccount,
        attachments: attachments.length > 0 ? attachments : undefined,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(typeof data.error === "string" ? data.error : `Draft save failed: ${res.status}`)
    }
    recordAction("saveDraft", { subject: subject || "(no subject)" })
  }

  return (
    <ComposeWindow
      mode="new"
      presentation="modal"
      gmailAccount={gmailAccount}
      onSend={handleSend}
      onSaveDraft={handleSaveDraft}
      onClose={onClose}
    />
  )
}

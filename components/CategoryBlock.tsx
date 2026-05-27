"use client"

import type { AccountId, Email, Category, Attachment } from "@/lib/types"
import LabelSection from "./LabelSection"

interface Props {
  category: Category
  categories: Category[]
  emails: Email[]
  selectedEmail: Email | null
  onSelect: (email: Email) => void
  onExpand: (email: Email, composeMode?: "reply" | "forward") => void
  onClose: () => void
  onMarkRead: (email: Email) => Promise<void>
  onArchive: (email: Email) => Promise<void>
  onSaveDraft: (email: Email, body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onStar: (email: Email) => Promise<void>
  onDelete: (email: Email) => Promise<void>
  onRecategorize: (email: Email, newCategory: string, teachClaude: boolean) => Promise<void>
  onMarkReplied: (email: Email) => void
  onMarkDeletable: (email: Email) => void
  onNewCategory: (name: string, color: string) => Promise<string>
  onToggleTodo: (email: Email) => void
  onSnooze: (email: Email) => void
  gmailAccount: AccountId
}

/** Deterministic festival accent from category name */
function getCategoryAccent(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  const accents = [
    { header: "#FF1F6E", text: "#FFF5E0", border: "rgba(255,31,110,0.30)",  glow: "rgba(255,31,110,0.10)" },
    { header: "#FFD000", text: "#0D0821", border: "rgba(255,208,0,0.30)",   glow: "rgba(255,208,0,0.10)" },
    { header: "#00E5C4", text: "#0D0821", border: "rgba(0,229,196,0.30)",   glow: "rgba(0,229,196,0.10)" },
    { header: "#FF6B1A", text: "#FFF5E0", border: "rgba(255,107,26,0.30)",  glow: "rgba(255,107,26,0.10)" },
    { header: "#C084FC", text: "#0D0821", border: "rgba(192,132,252,0.30)", glow: "rgba(192,132,252,0.10)" },
    { header: "#B8F000", text: "#0D0821", border: "rgba(184,240,0,0.30)",   glow: "rgba(184,240,0,0.10)" },
  ]
  return accents[Math.abs(hash) % accents.length]
}

export default function CategoryBlock({
  category, categories, emails, selectedEmail,
  onSelect, onExpand, onClose,
  onMarkRead, onArchive, onSaveDraft, onSend,
  onStar, onDelete, onRecategorize, onMarkReplied,
  onMarkDeletable, onNewCategory,
  onToggleTodo, onSnooze, gmailAccount,
}: Props) {
  const sorted = [...emails].sort((a, b) => a.internalDate - b.internalDate)
  const accent = getCategoryAccent(category.name)

  return (
    <LabelSection
      title={category.name.toUpperCase()}
      headerBg={accent.header}
      headerTextColor={accent.text}
      border={accent.border}
      boxShadow={`0 4px 28px ${accent.glow}`}
      emails={sorted}
      categories={categories}
      selectedEmail={selectedEmail}
      bulkActions={[
        { label: "Mark read", handler: async (targets) => { for (const e of targets) await onMarkRead(e) } },
        { label: "Archive",   handler: async (targets) => { for (const e of targets) await onArchive(e) } },
        { label: "Delete",    handler: async (targets) => { for (const e of targets) await onDelete(e) }, danger: true },
      ]}
      onSelect={onSelect}
      onExpand={onExpand}
      onClose={onClose}
      onMarkRead={onMarkRead}
      onArchive={onArchive}
      onSaveDraft={onSaveDraft}
      onSend={onSend}
      onStar={onStar}
      onDelete={onDelete}
      onRecategorize={onRecategorize}
      onMarkReplied={onMarkReplied}
      onMarkDeletable={onMarkDeletable}
      onNewCategory={onNewCategory}
      onToggleTodo={onToggleTodo}
      onSnooze={onSnooze}
      gmailAccount={gmailAccount}
    />
  )
}

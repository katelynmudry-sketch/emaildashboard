"use client"

import type { AccountId, Email, Category, Attachment } from "@/lib/types"
import LabelSection from "./LabelSection"

interface Props {
  emails: Email[]
  categories: Category[]
  selectedEmail: Email | null
  /** Optional AI-generated summary paragraph shown between header and email list */
  summary?: string
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

export default function BriefingSection({
  emails, categories, selectedEmail, summary,
  onSelect, onExpand, onClose,
  onMarkRead, onArchive, onSaveDraft, onSend,
  onStar, onDelete, onRecategorize, onMarkReplied,
  onMarkDeletable, onNewCategory,
  onToggleTodo, onSnooze, gmailAccount,
}: Props) {
  return (
    <LabelSection
      title="DAILY BRIEFING"
      headerBg="#FF1F6E"
      headerTextColor="#FFF5E0"
      border="rgba(255,31,110,0.22)"
      boxShadow="0 4px 28px rgba(255,31,110,0.08)"
      emails={emails}
      categories={categories}
      selectedEmail={selectedEmail}
      bulkActions={[
        { label: "Mark read", handler: async (targets) => { for (const e of targets) await onMarkRead(e) } },
        { label: "Archive",   handler: async (targets) => { for (const e of targets) await onArchive(e) } },
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
    >
      {/* Summary slot — pass summary={text} from Dashboard when AI generation is ready */}
      {summary && (
        <div style={{
          padding: "10px 16px 8px",
          fontSize: "0.84rem",
          lineHeight: 1.55,
          color: "rgba(26,10,53,0.68)",
          borderBottom: "1px solid rgba(26,10,53,0.06)",
        }}>
          {summary}
        </div>
      )}
    </LabelSection>
  )
}

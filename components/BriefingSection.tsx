"use client"

import type { AccountId, Email, Category, Attachment } from "@/lib/types"
import type { PartyMode } from "@/lib/party-mode"
import LabelSection from "./LabelSection"

interface Props {
  emails: Email[]
  categories: Category[]
  selectedEmail: Email | null
  mode?: PartyMode
  /** Optional AI-generated summary paragraph shown between header and email list */
  summary?: string
  onSelect: (email: Email) => void
  onExpand: (email: Email, composeMode?: "reply" | "forward") => void
  onClose: () => void
  onMarkRead: (email: Email) => void
  onArchive: (email: Email) => void
  onSaveDraft: (email: Email, body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onStar: (email: Email) => void
  onDelete: (email: Email) => void
  onRecategorize: (email: Email, newCategory: string, teachClaude: boolean) => Promise<void>
  onMarkReplied: (email: Email) => void
  onMarkDeletable: (email: Email) => void
  onNewCategory: (name: string, color: string) => Promise<string>
  onToggleTodo: (email: Email) => void
  onTodo?: (email: Email) => void
  onToggleBriefing?: (email: Email) => void
  onSnooze: (email: Email) => void
  onUnsubscribe: (email: Email) => void
  gmailAccount: AccountId
}

export default function BriefingSection({
  emails, categories, selectedEmail, summary, mode = "party",
  onSelect, onExpand, onClose,
  onMarkRead, onArchive, onSaveDraft, onSend,
  onStar, onDelete, onRecategorize, onMarkReplied,
  onMarkDeletable, onNewCategory,
  onToggleTodo, onTodo, onToggleBriefing, onSnooze, onUnsubscribe, gmailAccount,
}: Props) {
  const headerBg    = mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "#FFFFFF" : "#FF1F6E"
  const headerText  = mode === "zen" ? "#3D2800" : mode === "wabi-sabi" ? "#111111" : "#FFFFFF"
  const borderColor = mode === "zen" ? "rgba(200,150,12,0.22)" : mode === "wabi-sabi" ? "rgba(17,17,17,0.13)" : "rgba(255,31,110,0.22)"
  const shadow      = mode === "zen" ? "0 4px 28px rgba(200,150,12,0.08)" : mode === "wabi-sabi" ? "none" : "0 4px 28px rgba(255,31,110,0.08)"

  return (
    <LabelSection
      title="DAILY BRIEFING"
      headerBg={headerBg}
      headerTextColor={headerText}
      border={borderColor}
      boxShadow={shadow}
      emails={emails}
      categories={categories}
      selectedEmail={selectedEmail}
      bulkActions={[
        { label: "Mark read", handler: async (targets) => { for (const e of targets) await onMarkRead(e) } },
        { label: "Archive",   handler: async (targets) => { for (const e of targets) await onArchive(e) } },
        {
          label: "Unsubscribe",
          handler: async (targets) => {
            for (const e of targets.filter(e => e.unsubscribeOneClick && e.unsubscribeUrl)) {
              await onUnsubscribe(e)
            }
          },
        },
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
      onTodo={onTodo}
      onToggleBriefing={onToggleBriefing}
      onSnooze={onSnooze}
      onUnsubscribe={onUnsubscribe}
      mode={mode}
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

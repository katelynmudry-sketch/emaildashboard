"use client"

import { useState } from "react"
import type { AccountId, Email, Category, Attachment, EmailKeyPoint } from "@/lib/types"
import type { PartyMode } from "@/lib/party-mode"
import LabelSection from "./LabelSection"

// Defensive strip in case the model slips markdown into a point despite being told not to.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
}

interface Props {
  emails: Email[]
  categories: Category[]
  selectedEmail: Email | null
  mode?: PartyMode
  /** Per-email extracted key points shown between header and email list, ordered to match the email list */
  summary?: EmailKeyPoint[]
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

  const gamePlanTitle  = mode === "zen" ? "Today's Focus" : mode === "wabi-sabi" ? "The Tea" : "GAME PLAN"
  const gamePlanAccent = mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "#C17D3C" : "#FF1F6E"

  const [summaryCollapsed, setSummaryCollapsed] = useState(false)

  // Order points to match the email list order, dropping any with no extracted point.
  // (Array.isArray guards against stale cached data from before this became a list.)
  const orderedPoints = Array.isArray(summary) && summary.length > 0
    ? emails
        .map(e => ({ email: e, point: summary.find(p => p.id === e.id)?.point }))
        .filter((row): row is { email: Email; point: string } => !!row.point)
    : []

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
      {/* Summary slot — pass summary={items} from Dashboard when AI generation is ready */}
      {orderedPoints.length > 0 && (
        <div style={{
          padding: summaryCollapsed ? "10px 16px" : "10px 16px 8px",
          borderBottom: "1px solid rgba(26,10,53,0.06)",
        }}>
          <button
            onClick={() => setSummaryCollapsed(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer", padding: 0,
              margin: summaryCollapsed ? 0 : "0 0 6px",
            }}
            aria-expanded={!summaryCollapsed}
            aria-label={summaryCollapsed ? `Expand ${gamePlanTitle}` : `Collapse ${gamePlanTitle}`}
          >
            <span style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: gamePlanAccent,
            }}>
              {gamePlanTitle}
            </span>
            <span style={{
              fontSize: "0.6rem",
              color: gamePlanAccent,
              opacity: 0.7,
              transition: "transform 0.2s",
              transform: summaryCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
              display: "inline-block",
            }}>
              ▼
            </span>
          </button>
          {!summaryCollapsed && (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
              {orderedPoints.map(({ email, point }) => (
                <li key={email.id} style={{ fontSize: "0.84rem", lineHeight: 1.45, color: "rgba(26,10,53,0.75)" }}>
                  <span style={{ fontWeight: 600, color: "rgba(26,10,53,0.9)" }}>{email.from.split("<")[0].trim() || email.from}</span>
                  {" — "}
                  {stripMarkdown(point)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </LabelSection>
  )
}

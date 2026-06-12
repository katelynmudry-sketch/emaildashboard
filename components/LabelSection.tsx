"use client"

import { useState } from "react"
import type { AccountId, Email, Category, Attachment } from "@/lib/types"
import type { PartyMode } from "@/lib/party-mode"
import EmailRow from "./EmailRow"
import DetailPanel from "./DetailPanel"

export interface BulkAction {
  label: string
  danger?: boolean
  handler: (selectedEmails: Email[]) => Promise<void>
}

export interface LabelSectionProps {
  // Header appearance
  title: string
  headerBg: string
  headerTextColor: string
  border?: string
  boxShadow?: string
  headerOverlay?: string

  // Collapse state (controlled externally by CategoryBlock)
  collapsed?: boolean

  // Optional controls rendered at the far right of the header (pin, collapse toggle)
  headerSuffix?: React.ReactNode

  // Data
  emails: Email[]
  categories: Category[]
  selectedEmail: Email | null

  cardBg?: string

  // Optional slot between header and email list (e.g. briefing summary)
  children?: React.ReactNode

  // Configurable bulk actions — handler receives the currently-selected Email[]
  bulkActions?: BulkAction[]

  // Email action handlers
  onSelect: (email: Email) => void
  onExpand: (email: Email, composeMode?: "reply" | "forward") => void
  onClose: () => void
  onMarkRead: (email: Email) => void
  onArchive: (email: Email) => void
  onSaveDraft: (email: Email, body: string, attachments: Attachment[], forwardTo?: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, attachments: Attachment[], forwardTo?: string) => void
  onStar: (email: Email) => void
  onDelete: (email: Email) => void
  onRecategorize: (email: Email, newCategory: string, teachClaude: boolean) => Promise<void>
  onMarkReplied: (email: Email) => void
  onMarkDeletable: (email: Email) => void
  onNewCategory: (name: string, color: string) => Promise<string>
  onToggleTodo: (email: Email) => void
  onSnooze: (email: Email) => void
  onUnsubscribe?: (email: Email) => void
  gmailAccount: AccountId

  emptyText?: string
  className?: string
  mode?: PartyMode
}

export default function LabelSection({
  title, headerBg, headerTextColor,
  border = "rgba(26,10,53,0.10)",
  boxShadow = "0 4px 28px rgba(26,10,53,0.05)",
  headerOverlay,
  collapsed = false,
  headerSuffix,
  cardBg = "#FFFFFF",
  emails, categories, selectedEmail,
  children,
  bulkActions = [],
  onSelect, onExpand, onClose,
  onMarkRead, onArchive, onSaveDraft, onSend,
  onStar, onDelete, onRecategorize, onMarkReplied,
  onMarkDeletable, onNewCategory,
  onToggleTodo, onSnooze, onUnsubscribe, gmailAccount,
  emptyText = "All clear ✓",
  className = "",
  mode = "party",
}: LabelSectionProps) {
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [moveToOpen, setMoveToOpen] = useState(false)

  const selectionMode = bulkSelected.size > 0
  const allSelected = emails.length > 0 && bulkSelected.size === emails.length

  function toggleSelectAll() {
    setBulkSelected(allSelected ? new Set() : new Set(emails.map(e => e.id)))
  }

  function toggleEmail(id: string) {
    setBulkSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function fireBulkAction(action: BulkAction) {
    const targets = emails.filter(e => bulkSelected.has(e.id))
    setBulkSelected(new Set())
    await action.handler(targets)
  }

  async function handleMoveTo(categoryName: string) {
    const targets = emails.filter(e => bulkSelected.has(e.id))
    setBulkSelected(new Set())
    setMoveToOpen(false)
    for (const email of targets) await onRecategorize(email, categoryName, false)
  }

  return (
    <div
      className={`flex flex-col overflow-hidden ${className}`}
      style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: 16,
        boxShadow,
      }}
    >
      {/* ── Header band ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          background: headerBg,
          position: "relative",
        }}
      >
        {headerOverlay && (
          <div style={{
            position: "absolute", inset: 0,
            background: headerOverlay,
            borderRadius: "inherit",
            pointerEvents: "none",
          }} />
        )}
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.92rem",
          letterSpacing: "0.06em",
          color: headerTextColor,
          margin: 0,
        }}>
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {emails.length > 0 && (
            <span style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              background: "rgba(0,0,0,0.22)",
              color: headerTextColor,
              borderRadius: 99,
              padding: "1px 9px",
            }}>
              {emails.length}
            </span>
          )}
          {emails.length > 0 && (
            <button
              onClick={toggleSelectAll}
              style={{
                fontSize: "0.62rem",
                color: headerTextColor,
                opacity: 0.72,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          )}
          {headerSuffix}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selectionMode && (
        <div
          className="flex items-center gap-1.5 px-3 py-2"
          style={{
            background: "rgba(26,10,53,0.04)",
            borderBottom: "1px solid rgba(26,10,53,0.07)",
          }}
        >
          <span style={{ fontSize: "0.68rem", color: "rgba(26,10,53,0.65)", marginRight: 4 }}>
            {bulkSelected.size} selected
          </span>

          {/* Configured bulk actions (Mark read, Archive, Delete…) */}
          {bulkActions.map(action => (
            <button
              key={action.label}
              onClick={() => fireBulkAction(action)}
              style={{
                fontSize: "0.66rem",
                padding: "2px 8px",
                borderRadius: 5,
                border: `1px solid ${action.danger ? "rgba(255,31,110,0.35)" : "rgba(26,10,53,0.14)"}`,
                background: action.danger ? "rgba(255,31,110,0.10)" : "rgba(26,10,53,0.05)",
                color: action.danger ? "#FF1F6E" : "rgba(26,10,53,0.72)",
                cursor: "pointer",
              }}
            >
              {action.label}
            </button>
          ))}

          {/* Move to tag dropdown */}
          {categories.length > 0 && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setMoveToOpen(v => !v)}
                style={{
                  fontSize: "0.66rem",
                  padding: "2px 8px",
                  borderRadius: 5,
                  border: "1px solid rgba(139,63,216,0.30)",
                  background: moveToOpen ? "rgba(139,63,216,0.12)" : "rgba(139,63,216,0.06)",
                  color: "#8B3FD8",
                  cursor: "pointer",
                }}
              >
                Move to ▾
              </button>
              {moveToOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    zIndex: 50,
                    background: "#FFFFFF",
                    border: "1px solid rgba(26,10,53,0.12)",
                    borderRadius: 8,
                    boxShadow: "0 4px 20px rgba(26,10,53,0.14)",
                    minWidth: 150,
                    overflow: "hidden",
                  }}
                >
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleMoveTo(cat.name)}
                      className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-black/[0.04] transition-colors"
                      style={{
                        fontSize: "0.72rem",
                        color: "rgba(26,10,53,0.80)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                      }}
                    >
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: cat.color || "#888",
                      }} />
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => { setBulkSelected(new Set()); setMoveToOpen(false) }}
            style={{
              marginLeft: "auto",
              fontSize: "0.66rem",
              color: "rgba(26,10,53,0.56)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Collapsible body ── */}
      <div style={{
        overflow: "hidden",
        maxHeight: collapsed ? 0 : "2000px",
        transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      }}>

      {/* ── Optional children slot (e.g. summary paragraph) ── */}
      {children}

      {/* ── Email list ── */}
      <div className="px-2 py-2 space-y-0.5 min-h-[80px]">
        {emails.length === 0 ? (
          <p style={{
            fontSize: "0.7rem",
            color: "rgba(26,10,53,0.72)",
            textAlign: "center",
            padding: "16px 0",
            margin: 0,
          }}>
            {emptyText}
          </p>
        ) : (
          emails.map(email => (
            <div key={email.id}>
              <EmailRow
                email={email}
                selected={!selectionMode && email.id === selectedEmail?.id}
                isSelected={bulkSelected.has(email.id)}
                selectionMode={selectionMode}
                mode={mode}
                onClick={selectionMode ? () => toggleEmail(email.id) : () => onSelect(email)}
                onDoubleClick={selectionMode ? undefined : () => onExpand(email)}
                onMarkRead={() => onMarkRead(email)}
                onDelete={() => onDelete(email)}
                onReply={() => onExpand(email, "reply")}
                onForward={() => onExpand(email, "forward")}
                onToggleTodo={() => onToggleTodo(email)}
                onSnooze={() => onSnooze(email)}
                onUnsubscribe={onUnsubscribe ? () => onUnsubscribe(email) : undefined}
              />
              {!selectionMode && email.id === selectedEmail?.id && (
                <div className="mt-1 mb-2">
                  <DetailPanel
                    email={selectedEmail}
                    gmailAccount={gmailAccount}
                    categories={categories}
                    onClose={onClose}
                    onArchive={onArchive}
                    onMarkRead={onMarkRead}
                    onSaveDraft={onSaveDraft}
                    onSend={onSend}
                    onStar={onStar}
                    onDelete={onDelete}
                    onRecategorize={onRecategorize}
                    onMarkReplied={onMarkReplied}
                    onMarkDeletable={onMarkDeletable}
                    onNewCategory={onNewCategory}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      </div>{/* end collapsible body */}
    </div>
  )
}

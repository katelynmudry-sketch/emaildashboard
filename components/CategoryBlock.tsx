"use client"

import { useState } from "react"
import type { AccountId, Email, Category } from "@/lib/types"
import EmailRow from "./EmailRow"
import DetailPanel from "./DetailPanel"

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
  onSaveDraft: (email: Email, body: string) => Promise<void>
  onSend: (email: Email, mode: "reply" | "forward", body: string, forwardTo?: string) => Promise<void>
  onStar: (email: Email) => Promise<void>
  onDelete: (email: Email) => Promise<void>
  onRecategorize: (email: Email, newCategory: string, teachClaude: boolean) => Promise<void>
  onMarkReplied: (email: Email) => void
  onMarkDeletable: (email: Email) => void
  onNewCategory: (name: string, color: string) => Promise<string>
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
  onMarkDeletable, onNewCategory, gmailAccount,
}: Props) {
  const sorted = [...emails].sort((a, b) => a.internalDate - b.internalDate)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())

  const selectionMode = bulkSelected.size > 0
  const allSelected = sorted.length > 0 && bulkSelected.size === sorted.length
  const accent = getCategoryAccent(category.name)

  function toggleSelectAll() {
    setBulkSelected(allSelected ? new Set() : new Set(sorted.map(e => e.id)))
  }

  function toggleEmail(id: string) {
    setBulkSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleBulkMarkRead() {
    const targets = sorted.filter(e => bulkSelected.has(e.id))
    setBulkSelected(new Set())
    targets.forEach(e => onMarkRead(e))
  }

  async function handleBulkArchive() {
    const targets = sorted.filter(e => bulkSelected.has(e.id))
    setBulkSelected(new Set())
    for (const e of targets) await onArchive(e)
  }

  async function handleBulkDelete() {
    const targets = sorted.filter(e => bulkSelected.has(e.id))
    setBulkSelected(new Set())
    for (const e of targets) await onDelete(e)
  }

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        background: "#160B30",
        border: `1px solid ${accent.border}`,
        borderRadius: 16,
        boxShadow: `0 4px 28px ${accent.glow}`,
      }}
    >
      {/* ── Header band ──────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: accent.header }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.92rem",
            letterSpacing: "0.06em",
            color: accent.text,
            margin: 0,
          }}
        >
          {category.name.toUpperCase()}
        </h2>
        <div className="flex items-center gap-2">
          {emails.length > 0 && (
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                background: "rgba(0,0,0,0.22)",
                color: accent.text,
                borderRadius: 99,
                padding: "1px 9px",
              }}
            >
              {emails.length}
            </span>
          )}
          {emails.length > 0 && (
            <button
              onClick={toggleSelectAll}
              style={{
                fontSize: "0.62rem",
                color: accent.text,
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
        </div>
      </div>

      {/* ── Bulk action bar ───────────────────────────── */}
      {selectionMode && (
        <div
          className="flex items-center gap-1.5 px-3 py-2"
          style={{
            background: "rgba(255,245,224,0.04)",
            borderBottom: "1px solid rgba(255,245,224,0.07)",
          }}
        >
          <span style={{ fontSize: "0.68rem", color: "rgba(255,245,224,0.45)", marginRight: 4 }}>
            {bulkSelected.size} selected
          </span>
          {[
            { label: "Mark read", handler: handleBulkMarkRead, danger: false },
            { label: "Archive",   handler: handleBulkArchive,  danger: false },
            { label: "Delete",    handler: handleBulkDelete,   danger: true  },
          ].map(({ label, handler, danger }) => (
            <button
              key={label}
              onClick={handler}
              style={{
                fontSize: "0.66rem",
                padding: "2px 8px",
                borderRadius: 5,
                border: `1px solid ${danger ? "rgba(255,31,110,0.35)" : "rgba(255,245,224,0.14)"}`,
                background: danger ? "rgba(255,31,110,0.10)" : "rgba(255,245,224,0.05)",
                color: danger ? "#FF1F6E" : "rgba(255,245,224,0.58)",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setBulkSelected(new Set())}
            style={{
              marginLeft: "auto",
              fontSize: "0.66rem",
              color: "rgba(255,245,224,0.32)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Email list ────────────────────────────────── */}
      <div className="px-2 py-2 space-y-0.5 min-h-[80px]">
        {sorted.length === 0 ? (
          <p style={{ fontSize: "0.7rem", color: "rgba(255,245,224,0.28)", textAlign: "center", padding: "16px 0", margin: 0 }}>
            All clear ✓
          </p>
        ) : (
          sorted.map(email => (
            <div key={email.id}>
              <EmailRow
                email={email}
                selected={!selectionMode && email.id === selectedEmail?.id}
                isSelected={bulkSelected.has(email.id)}
                selectionMode={selectionMode}
                onClick={selectionMode ? () => toggleEmail(email.id) : () => onSelect(email)}
                onDoubleClick={selectionMode ? undefined : () => onExpand(email)}
                onMarkRead={() => onMarkRead(email)}
                onDelete={() => onDelete(email)}
                onReply={() => onExpand(email, "reply")}
                onForward={() => onExpand(email, "forward")}
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
    </div>
  )
}

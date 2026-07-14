"use client"

import type { PartyMode } from "@/lib/party-mode"
import { getTheme } from "@/lib/theme"

interface Props {
  mode: PartyMode
  count: number
  busy?: boolean
  onDelete: () => void
  onArchive: () => void
  onMarkRead: () => void
  onCancel: () => void
}

/**
 * Floating bulk-action bar — shared by Mindful Purge, Deep Clean, and the
 * other theme-unique purges. Only the count/labels above it differ per flow;
 * this bar's chrome and actions are the same everywhere, themed via getTheme().
 */
export default function BulkActionBar({ mode, count, busy, onDelete, onArchive, onMarkRead, onCancel }: Props) {
  const theme = getTheme(mode)
  if (count === 0) return null

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3"
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        background: theme.cardBg,
        border: theme.cardBorder,
        boxShadow: theme.cardShadow,
      }}
    >
      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: theme.headingColor, padding: "0 4px" }}>
        {count} selected
      </span>

      <button
        type="button"
        onClick={onMarkRead}
        disabled={busy}
        style={{
          padding: "6px 14px", borderRadius: 999,
          border: theme.buttonSecondaryBorder,
          background: "transparent",
          color: theme.buttonSecondaryText,
          fontSize: "0.82rem", fontWeight: 600,
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.5 : 1,
        }}
      >
        Mark read
      </button>

      <button
        type="button"
        onClick={onArchive}
        disabled={busy}
        style={{
          padding: "6px 14px", borderRadius: 999,
          border: theme.buttonSecondaryBorder,
          background: "transparent",
          color: theme.buttonSecondaryText,
          fontSize: "0.82rem", fontWeight: 600,
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.5 : 1,
        }}
      >
        Archive
      </button>

      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        style={{
          padding: "6px 16px", borderRadius: 999,
          border: "none",
          background: theme.buttonPrimaryBg,
          color: theme.buttonPrimaryText,
          fontSize: "0.82rem", fontWeight: 700,
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.5 : 1,
        }}
      >
        Delete
      </button>

      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        style={{
          background: "none", border: "none",
          color: theme.textMuted,
          fontSize: "1rem", lineHeight: 1,
          cursor: busy ? "not-allowed" : "pointer",
          padding: "0 4px",
        }}
      >
        ×
      </button>
    </div>
  )
}

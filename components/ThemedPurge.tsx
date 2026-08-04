"use client"

import { useEffect, useState } from "react"
import type { Email } from "@/lib/types"
import type { PartyMode } from "@/lib/party-mode"
import { getTheme } from "@/lib/theme"
import { useBulkSelection } from "@/lib/hooks/useBulkSelection"

interface Props {
  mode: PartyMode
  icon: string
  title: (count: number) => string
  description: string
  candidates: Email[]
  releaseLabel?: string
  minToShow?: number
  onRelease: (selectedIds: Set<string>) => void | Promise<void>
}

/**
 * Shared shell for the theme-unique bulk purges (Mindful Purge / Purge Party /
 * Declutter Era). Same selection engine and chrome everywhere — each theme
 * only supplies a different candidate list, icon, and copy. See
 * docs/plans/2026-07-14-bulk-cleanup-suite.md Phase 2b.
 */
export default function ThemedPurge({
  mode, icon, title, description, candidates, releaseLabel = "Release", minToShow = 1, onRelease,
}: Props) {
  const theme = getTheme(mode)
  const [dismissed, setDismissed] = useState(false)
  const [shattered, setShattered] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const bulk = useBulkSelection(candidates.map(e => e.id))

  // Whenever a fresh candidate set arrives (new refresh), pre-select
  // everything and reset dismissed/shattered so the card can reappear —
  // this component owns its full show/hide lifecycle; the parent never
  // needs to clear its pool array to make the card go away.
  useEffect(() => {
    bulk.selectOnly(candidates.map(e => e.id))
    setDismissed(false)
    setShattered(false)
    setExpanded(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates])

  if (dismissed || candidates.length < minToShow) return null

  const wash = (alpha: number) => `rgba(${theme.purgeWashRgb},${alpha})`

  async function handleRelease() {
    if (bulk.count === 0) return
    setShattered(true)
    await onRelease(bulk.selected)
    setTimeout(() => {
      setDismissed(true)
    }, 600)
  }

  return (
    <div className="mb-4 overflow-hidden" style={{
      background: wash(0.05),
      border: `1px solid ${wash(0.25)}`,
      borderRadius: 14,
      transition: "opacity 0.4s ease",
      opacity: shattered ? 0 : 1,
    }}>
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3">
        <div className="flex items-start gap-3 w-full sm:w-auto sm:flex-1 sm:min-w-0">
          <span style={{ fontSize: "1.4rem", lineHeight: 1, flexShrink: 0 }}>{icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: theme.roastBtnText }}>
              {title(candidates.length)}
            </div>
            <div style={{ fontSize: "0.74rem", color: theme.textMuted, marginTop: 1 }}>
              {description}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              flexShrink: 0,
              padding: "4px 12px", borderRadius: 6,
              background: wash(0.10),
              border: `1px solid ${wash(0.30)}`,
              color: theme.roastBtnText, fontSize: "0.78rem", fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {expanded ? "▲ Hide" : "▼ Review"}
          </button>
          <button
            onClick={handleRelease}
            disabled={bulk.count === 0 || shattered}
            style={{
              flexShrink: 0,
              padding: "4px 14px", borderRadius: 6,
              background: bulk.count === 0 ? wash(0.15) : theme.buttonPrimaryBg,
              color: bulk.count === 0 ? theme.textMuted : theme.buttonPrimaryText,
              fontSize: "0.78rem", fontWeight: 700,
              border: "none", cursor: bulk.count === 0 ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {releaseLabel} {bulk.count > 0 ? `${bulk.count} ` : ""}selected
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              flexShrink: 0,
              background: "none", border: "none", cursor: "pointer",
              color: theme.textMuted, fontSize: "0.76rem", padding: "4px 6px",
            }}
          >
            ×
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${wash(0.18)}` }}>
          <div className="flex items-center gap-2 px-4 py-1.5" style={{ borderBottom: `1px solid ${wash(0.10)}` }}>
            <button
              onClick={bulk.toggleAll}
              style={{
                fontSize: "0.72rem", color: theme.roastBtnText, fontWeight: 600,
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              {bulk.allSelected ? "Deselect all" : "Select all"}
            </button>
            <span style={{ fontSize: "0.70rem", color: theme.textMuted }}>
              · {bulk.count} of {candidates.length} selected
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y" style={{ borderColor: wash(0.08) }}>
            {candidates.map(email => (
              <div
                key={email.id}
                className="flex items-center gap-3 px-4 py-2"
                style={{ borderColor: wash(0.08) }}
              >
                <input
                  type="checkbox"
                  checked={bulk.isSelected(email.id)}
                  onChange={() => bulk.toggle(email.id)}
                  style={{ accentColor: theme.accent, flexShrink: 0, width: 15, height: 15 }}
                />
                <div className="min-w-0 flex-1">
                  <div style={{
                    fontSize: "0.82rem", fontWeight: 500, color: "rgba(26,10,53,0.78)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {email.subject}
                  </div>
                  <div style={{ fontSize: "0.70rem", color: "rgba(26,10,53,0.42)", marginTop: 1 }}>
                    {(email.from?.split("<")[0] ?? email.from ?? "").trim()} · {email.timeAgo}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

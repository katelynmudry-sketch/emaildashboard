"use client"

import { useEffect, useState } from "react"
import type { PartyMode } from "@/lib/party-mode"
import type { ActionType, LogEntry } from "@/lib/action-log"

interface Props {
  open: boolean
  onClose: () => void
  entries: LogEntry[]
  onUndo: (id: string) => void
  mode: PartyMode
}

const UNDO_WINDOW_MS = 10 * 60 * 1000

const HEADER_GRADIENT: Record<PartyMode, string> = {
  party: "linear-gradient(135deg, #8B3FD8 0%, #FF1F6E 100%)",
  zen: "linear-gradient(135deg, #C8960C 0%, #8B6914 100%)",
  "wabi-sabi": "linear-gradient(135deg, #D4A96A 0%, #C17D3C 100%)",
}

const HEADER_TITLE: Record<PartyMode, string> = {
  party: "ACTION LOG",
  zen: "SESSION LOG",
  "wabi-sabi": "WHAT YOU DID",
}

const ACCENT: Record<PartyMode, string> = {
  party: "#8B3FD8",
  zen: "#C8960C",
  "wabi-sabi": "#C17D3C",
}

const ACTION_LABELS: Record<PartyMode, Record<ActionType, string>> = {
  party: {
    archive: "Archived",
    delete: "Deleted",
    snooze: "Snoozed",
    label: "Labeled",
    move: "Moved",
    "todo-add": "Added to todo",
    "todo-remove": "Removed from todo",
  },
  zen: {
    archive: "Released",
    delete: "Let go",
    snooze: "Rested until",
    label: "Placed gently",
    move: "Moved",
    "todo-add": "Noted",
    "todo-remove": "Released",
  },
  "wabi-sabi": {
    archive: "Archived bestie",
    delete: "Deleted lol",
    snooze: "Snoozed ok",
    label: "Labeled serving",
    move: "Moved",
    "todo-add": "Noted",
    "todo-remove": "Done",
  },
}

const EMPTY_COPY: Record<PartyMode, string> = {
  party: "Nothing yet. Start triaging!",
  zen: "No actions this session.",
  "wabi-sabi": "you haven't done anything yet bestie",
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export default function LogDrawer({ open, onClose, entries, onUndo, mode }: Props) {
  // Re-render periodically so Undo buttons disappear once entries age past the window.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [open])

  if (!open) return null

  const accent = ACCENT[mode]

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(26,10,53,0.35)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(480px, 96vw)",
        zIndex: 201,
        background: "#FFFFFF",
        boxShadow: "-8px 0 40px rgba(26,10,53,0.18)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "slideInRight 0.32s cubic-bezier(0.16,1,0.3,1) both",
      }}>

        {/* Header */}
        <div style={{
          padding: "18px 22px 14px",
          borderBottom: "1px solid rgba(26,10,53,0.08)",
          background: HEADER_GRADIENT[mode],
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h2 style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem", color: "#FFF5E0",
              margin: 0, lineHeight: 1,
            }}>
              {HEADER_TITLE[mode]}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,245,224,0.18)", border: "none", borderRadius: 8,
                color: "#FFF5E0", width: 32, height: 32, cursor: "pointer",
                fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 22px" }}>
          {entries.length === 0 && (
            <p style={{ textAlign: "center", padding: "40px 0", color: "rgba(26,10,53,0.40)", fontSize: "0.82rem" }}>
              {EMPTY_COPY[mode]}
            </p>
          )}

          {entries.map(entry => {
            const canUndo = Boolean(entry.undoFn) && !entry.undone && (Date.now() - entry.timestamp < UNDO_WINDOW_MS)
            return (
              <div
                key={entry.id}
                style={{
                  display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(26,10,53,0.06)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.70rem", color: "rgba(26,10,53,0.40)", marginBottom: 2 }}>
                    {formatTime(entry.timestamp)} · {ACTION_LABELS[mode][entry.type]}
                    {entry.detail ? ` ${entry.detail}` : ""}
                  </div>
                  <div style={{
                    fontSize: "0.82rem", color: "#1A0A35", fontWeight: 600,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {entry.emailSubject || "(no subject)"}
                  </div>
                </div>

                {entry.undone ? (
                  <span style={{
                    flexShrink: 0, fontSize: "0.72rem", fontWeight: 700,
                    color: "#00A88A", whiteSpace: "nowrap", paddingTop: 2,
                  }}>
                    ✓ Undone
                  </span>
                ) : canUndo ? (
                  <button
                    onClick={() => onUndo(entry.id)}
                    style={{
                      flexShrink: 0, padding: "4px 12px", borderRadius: 999,
                      background: "transparent", color: accent,
                      border: `1px solid ${accent}66`,
                      fontSize: "0.72rem", fontWeight: 700,
                      cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                    }}
                  >
                    Undo
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

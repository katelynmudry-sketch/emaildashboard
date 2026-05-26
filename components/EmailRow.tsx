"use client"

import type { Email } from "@/lib/types"

function formatEmailDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
}

interface Props {
  email: Email
  selected: boolean
  isSelected?: boolean
  selectionMode?: boolean
  onClick: () => void
  onDoubleClick?: () => void
  onMarkRead: () => void
  onDelete?: () => void
  onReply?: () => void
  onForward?: () => void
  onToggleTodo?: () => void
  onSnooze?: () => void
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#FF1F6E",
  today:  "#FFD000",
  fyi:    "#00E5C4",
}

export default function EmailRow({
  email, selected, isSelected, selectionMode,
  onClick, onDoubleClick, onMarkRead, onDelete,
  onReply, onForward, onToggleTodo, onSnooze,
}: Props) {
  const priorityColor = PRIORITY_COLOR[email.priority ?? "fyi"] ?? "#00E5C4"

  const bgColor = isSelected
    ? "rgba(255,208,0,0.10)"
    : selected
    ? "rgba(0,229,196,0.08)"
    : email.deletable
    ? "rgba(26,10,53,0.03)"
    : "transparent"

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onClick() }}
      className="w-full text-left cursor-pointer group transition-all duration-100"
      style={{
        borderRadius: 7,
        borderLeft: `3px solid ${priorityColor}`,
        paddingLeft: 10,
        paddingRight: 8,
        paddingTop: 6,
        paddingBottom: 6,
        background: bgColor,
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">

        {/* Selection checkbox */}
        {selectionMode && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onClick() }}
            className="shrink-0 flex items-center justify-center rounded-full border-2 transition-colors"
            style={{
              width: 16, height: 16,
              borderColor: isSelected ? "#FFD000" : "rgba(26,10,53,0.25)",
              background: isSelected ? "#FFD000" : "transparent",
            }}
          >
            {isSelected && (
              <span style={{ fontSize: 9, color: "#0D0821", fontWeight: 700, lineHeight: 1 }}>✓</span>
            )}
          </button>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span
              className="font-semibold shrink-0 truncate"
              style={{ fontSize: "0.75rem", color: "#1A0A35", maxWidth: 120 }}
            >
              {(email.from?.split("<")[0] ?? email.from ?? "").trim()}
            </span>
            <span
              className="truncate flex-1 min-w-0"
              style={{ fontSize: "0.72rem", color: "rgba(26,10,53,0.55)" }}
            >
              {email.subject}
            </span>
          </div>
          {email.microSummary && (
            <p
              className="truncate mt-0.5"
              style={{ fontSize: "0.65rem", color: "rgba(26,10,53,0.32)", margin: "2px 0 0" }}
            >
              {email.microSummary}
            </p>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1 shrink-0">
          {email.todo && (
            <span style={{ fontSize: "0.6rem", color: "#FFD000" }}>★</span>
          )}
          {email.replied && (
            <span style={{ fontSize: "0.62rem", color: "rgba(26,10,53,0.28)" }}>↩</span>
          )}
          <span style={{ fontSize: "0.62rem", color: "rgba(26,10,53,0.28)" }}>
            {email.date ? formatEmailDate(email.date) : ""}
          </span>

          {/* Hover actions */}
          {!selectionMode && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
              <button
                type="button"
                title="Mark read"
                onClick={e => { e.stopPropagation(); onMarkRead() }}
                style={{
                  padding: "2px 6px", borderRadius: 5,
                  background: "rgba(26,10,53,0.09)",
                  color: "rgba(26,10,53,0.65)",
                  fontSize: "0.6rem", border: "none", cursor: "pointer",
                }}
              >
                ✓
              </button>
              {onDelete && (
                <button
                  type="button"
                  title="Delete"
                  onClick={e => { e.stopPropagation(); onDelete() }}
                  style={{
                    padding: "2px 6px", borderRadius: 5,
                    background: "rgba(255,31,110,0.12)",
                    color: "#FF1F6E",
                    fontSize: "0.6rem", border: "none", cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              )}
              {onToggleTodo && (
                <button
                  type="button"
                  title={email.todo ? "Remove TODO" : "Add TODO"}
                  onClick={e => { e.stopPropagation(); onToggleTodo() }}
                  style={{
                    padding: "2px 6px", borderRadius: 5,
                    background: email.todo ? "rgba(255,208,0,0.18)" : "rgba(26,10,53,0.07)",
                    color: email.todo ? "#FFD000" : "rgba(26,10,53,0.38)",
                    fontSize: "0.6rem", border: "none", cursor: "pointer",
                  }}
                >
                  ★
                </button>
              )}
              {onSnooze && (
                <button
                  type="button"
                  title="Snooze"
                  onClick={e => { e.stopPropagation(); onSnooze() }}
                  style={{
                    padding: "2px 6px", borderRadius: 5,
                    background: "rgba(26,10,53,0.07)",
                    color: "rgba(26,10,53,0.38)",
                    fontSize: "0.6rem", border: "none", cursor: "pointer",
                  }}
                >
                  💤
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


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

function actionBtn(bg?: string, color?: string): React.CSSProperties {
  return {
    padding: "3px 8px",
    borderRadius: 5,
    background: bg ?? "rgba(26,10,53,0.08)",
    color: color ?? "rgba(26,10,53,0.70)",
    fontSize: "0.72rem",
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    lineHeight: 1.4,
  }
}

export default function EmailRow({
  email, selected, isSelected, selectionMode,
  onClick, onDoubleClick, onMarkRead, onDelete,
  onReply, onForward, onToggleTodo, onSnooze,
}: Props) {
  const priorityColor = PRIORITY_COLOR[email.priority ?? "fyi"] ?? "#00E5C4"

  const bgColor = isSelected
    ? "rgba(255,208,0,0.12)"
    : selected
    ? "rgba(0,229,196,0.10)"
    : email.deletable
    ? "rgba(26,10,53,0.04)"
    : "transparent"

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onClick() }}
      className="w-full text-left cursor-pointer group transition-all duration-100 hover:bg-black/[0.03]"
      style={{
        position: "relative",
        borderRadius: 7,
        borderLeft: `3px solid ${priorityColor}`,
        paddingLeft: 10,
        paddingRight: 8,
        paddingTop: 7,
        paddingBottom: 7,
        background: bgColor,
      }}
    >
      {/* ── Main row content — always full width ── */}
      <div className="flex items-center gap-2.5 min-w-0">

        {selectionMode && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onClick() }}
            className="shrink-0 flex items-center justify-center rounded-full border-2 transition-colors"
            style={{
              width: 18, height: 18,
              borderColor: isSelected ? "#FFD000" : "rgba(26,10,53,0.30)",
              background: isSelected ? "#FFD000" : "transparent",
            }}
          >
            {isSelected && (
              <span style={{ fontSize: 10, color: "#1A0A35", fontWeight: 700, lineHeight: 1 }}>✓</span>
            )}
          </button>
        )}

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span
              className="font-semibold shrink-0 truncate"
              style={{ fontSize: "0.85rem", color: "#1A0A35", maxWidth: 140 }}
            >
              {(email.from?.split("<")[0] ?? email.from ?? "").trim()}
            </span>
            <span
              className="truncate flex-1 min-w-0"
              style={{ fontSize: "0.82rem", color: "rgba(26,10,53,0.65)" }}
            >
              {email.subject}
            </span>
          </div>
          {email.microSummary && (
            <p className="truncate" style={{ fontSize: "0.75rem", color: "rgba(26,10,53,0.50)", margin: "2px 0 0" }}>
              {email.microSummary}
            </p>
          )}
        </div>

        {/* Badges + date — always visible, never pushed */}
        <div className="flex items-center gap-1 shrink-0">
          {email.todo && <span style={{ fontSize: "0.75rem", color: "#B8860B" }}>★</span>}
          {email.replied && <span style={{ fontSize: "0.75rem", color: "rgba(26,10,53,0.40)" }}>↩</span>}
          {email.attachments && email.attachments.length > 0 && (
            <span title={`${email.attachments.length} attachment${email.attachments.length !== 1 ? "s" : ""}`} style={{ fontSize: "0.78rem", color: "rgba(26,10,53,0.45)", lineHeight: 1 }}>
              📎
              {email.attachments.length > 1 && (
                <span style={{ fontSize: "0.68rem", marginLeft: 1 }}>{email.attachments.length}</span>
              )}
            </span>
          )}
          <span style={{ fontSize: "0.75rem", color: "rgba(26,10,53,0.48)" }}>
            {email.date ? formatEmailDate(email.date) : ""}
          </span>
        </div>
      </div>

      {/* ── Hover action pill — absolutely overlays the row ── */}
      {!selectionMode && (
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto"
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 3,
            background: "rgba(242,236,255,0.97)",
            backdropFilter: "blur(6px)",
            borderRadius: 8,
            padding: "3px 5px",
            boxShadow: "0 2px 12px rgba(26,10,53,0.14), 0 0 0 1px rgba(26,10,53,0.07)",
            zIndex: 10,
          }}
        >
          <button type="button" title="Mark read"
            onClick={e => { e.stopPropagation(); onMarkRead() }}
            style={actionBtn()}>
            ✓
          </button>

          {onReply && (
            <button type="button" title="Reply"
              onClick={e => { e.stopPropagation(); onReply() }}
              style={actionBtn()}>
              ↩
            </button>
          )}

          {onForward && (
            <button type="button" title="Forward"
              onClick={e => { e.stopPropagation(); onForward() }}
              style={actionBtn()}>
              ↪
            </button>
          )}

          {onToggleTodo && (
            <button type="button" title={email.todo ? "Remove TODO" : "Add TODO"}
              onClick={e => { e.stopPropagation(); onToggleTodo() }}
              style={actionBtn(
                email.todo ? "rgba(255,208,0,0.25)" : undefined,
                email.todo ? "#92660A" : undefined,
              )}>
              ★
            </button>
          )}

          {onSnooze && (
            <button type="button" title="Snooze"
              onClick={e => { e.stopPropagation(); onSnooze() }}
              style={actionBtn()}>
              💤
            </button>
          )}

          {onDelete && (
            <button type="button" title="Delete"
              onClick={e => { e.stopPropagation(); onDelete() }}
              style={actionBtn("rgba(255,31,110,0.12)", "#D4005A")}>
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  )
}

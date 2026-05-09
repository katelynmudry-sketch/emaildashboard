"use client"

import type { Email } from "@/lib/types"

interface Props {
  email: Email
  selected: boolean
  isSelected?: boolean
  selectionMode?: boolean
  onClick: () => void
  onMarkRead: () => void
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-rose-500",
  today:  "bg-amber-400",
  fyi:    "bg-emerald-400",
}

const ACTION_FLAG: Record<string, { label: string; className: string } | null> = {
  reply:   { label: "REPLY",  className: "bg-blue-50 text-blue-600" },
  confirm: { label: "ACTION", className: "bg-amber-50 text-amber-600" },
  receipt: { label: "KEEP",   className: "bg-emerald-50 text-emerald-700" },
  read:    null,
}

export default function EmailRow({ email, selected, isSelected, selectionMode, onClick, onMarkRead }: Props) {
  const flag = ACTION_FLAG[email.actionFlag] ?? null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onClick() }}
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors duration-100 group cursor-pointer ${
        isSelected
          ? "bg-violet-50 border border-violet-300"
          : selected
          ? "bg-violet-50 border border-violet-200"
          : "hover:bg-zinc-50 border border-transparent"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {selectionMode ? (
          <span className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
            isSelected ? "bg-violet-500 border-violet-500" : "border-zinc-300"
          }`}>
            {isSelected && (
              <svg viewBox="0 0 8 8" fill="none" className="w-2.5 h-2.5">
                <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
        ) : (
          <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[email.priority] ?? "bg-zinc-300"}`} />
        )}

        {/* Sender · micro-summary */}
        <div className="text-xs min-w-0 flex-1 truncate">
          <span className="font-semibold text-zinc-800">{email.from}</span>
          <span className="text-zinc-400 mx-1">·</span>
          <span className="text-zinc-500">{email.microSummary}</span>
        </div>

        {/* Action flag */}
        {flag && (
          <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${flag.className}`}>
            {flag.label}
          </span>
        )}

        {/* Mark as read button */}
        {!selectionMode && <button
          onClick={e => {
            e.stopPropagation()
            onMarkRead()
          }}
          title="Mark as read"
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
          </svg>
        </button>}
      </div>
    </div>
  )
}

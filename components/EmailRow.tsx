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
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-rose-500",
  today:  "bg-amber-400",
  fyi:    "bg-emerald-400",
}

export default function EmailRow({ email, selected, isSelected, selectionMode, onClick, onDoubleClick, onMarkRead, onDelete, onReply, onForward }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onClick() }}
      className={`w-full text-left px-3 py-2 rounded-lg transition-colors duration-100 group cursor-pointer ${
        isSelected
          ? "bg-violet-50 border border-violet-300"
          : selected
          ? "bg-violet-50 border border-violet-200"
          : email.deletable
          ? "bg-zinc-50 border border-zinc-200 hover:bg-zinc-100"
          : "hover:bg-zinc-50 border border-transparent"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center shrink-0">
          {selectionMode ? (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onClick()
              }}
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                isSelected ? "bg-violet-500 border-violet-500" : "border-zinc-300 bg-white"
              }`}
              aria-pressed={isSelected}
            >
              {isSelected ? (
                <svg viewBox="0 0 8 8" fill="none" className="w-2.5 h-2.5">
                  <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : null}
            </button>
          ) : (
            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[email.priority] ?? "bg-zinc-300"}`} />
          )}
        </div>

        <div className="text-xs min-w-0 flex-1">
          <div className="font-semibold text-zinc-800 truncate">{email.subject}</div>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            {email.replied && (
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 rounded-full px-2 py-0.5">
                Replied
              </span>
            )}
            {email.forwarded && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                Forwarded
              </span>
            )}
          </div>
          <div className="text-zinc-500 flex items-center gap-1 truncate">
            <span className="truncate">{email.from}</span>
            <span className="text-zinc-400">·</span>
            <span className="truncate">{email.microSummary}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!selectionMode && (
            <div className="hidden items-center gap-1 shrink-0 group-hover:flex transition-all duration-150">
              <button
                onClick={e => {
                  e.stopPropagation()
                  onMarkRead()
                }}
                title="Mark as read"
                className="shrink-0 min-w-[38px] h-7 px-2 flex items-center justify-center rounded-full text-[10px] font-semibold text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
              >
                Read
              </button>
              {onReply && (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    onReply()
                  }}
                  title="Reply"
                  className="shrink-0 min-w-[38px] h-7 px-2 flex items-center justify-center rounded-full text-[10px] font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50"
                >
                  Reply
                </button>
              )}
              {onForward && (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    onForward()
                  }}
                  title="Forward"
                  className="shrink-0 min-w-[38px] h-7 px-2 flex items-center justify-center rounded-full text-[10px] font-semibold text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
                >
                  Fwd
                </button>
              )}
              {onDelete && (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    onDelete()
                  }}
                  title="Delete email"
                  className="shrink-0 min-w-[38px] h-7 px-2 flex items-center justify-center rounded-full text-[10px] font-semibold text-rose-600 border border-rose-200 hover:bg-rose-50"
                >
                  Del
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0 text-[10px] text-zinc-400 uppercase tracking-[0.02em] whitespace-nowrap">
            <span className="whitespace-nowrap">{formatEmailDate(email.date)}</span>
          </div>
        </div>
      </div>

    </div>
  )
}

"use client"

import type { Email, Category } from "@/lib/types"
import EmailRow from "./EmailRow"
import DetailPanel from "./DetailPanel"

interface Props {
  category: Category
  emails: Email[]
  selectedEmail: Email | null
  onSelect: (email: Email) => void
  onClose: () => void
  onMarkRead: (email: Email) => void
  onArchive: (email: Email) => Promise<void>
  onSaveDraft: (email: Email, body: string) => Promise<void>
}

export default function CategoryBlock({ category, emails, selectedEmail, onSelect, onClose, onMarkRead, onArchive, onSaveDraft }: Props) {
  const sorted = [...emails].sort((a, b) => a.internalDate - b.internalDate)

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 flex flex-col shadow-sm">
      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-3">
        <div className={`absolute inset-0 -z-0 ${category.color} opacity-10 rounded-t-2xl`} />
        <div className="relative flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${category.color}`} />
          <h2 className="text-sm font-semibold text-zinc-800">{category.name}</h2>
        </div>
        <div className="relative flex items-center gap-2">
          {emails.length > 0 && (
            <span className="text-xs font-medium bg-white/70 text-zinc-600 rounded-full px-2 py-0.5">
              {emails.length}
            </span>
          )}
          {emails.length > 0 && (
            <button
              onClick={() => emails.forEach(e => onMarkRead(e))}
              className="text-xs text-zinc-400 hover:text-zinc-700 hover:bg-white/80 px-2 py-0.5 rounded-full transition-colors"
              title="Mark all as read"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Email list */}
      <div className="px-2 py-2 space-y-0.5 min-h-[80px]">
        {sorted.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-4">All clear ✓</p>
        ) : (
          sorted.map(email => (
            <div key={email.id}>
              <EmailRow
                email={email}
                selected={email.id === selectedEmail?.id}
                onClick={() => onSelect(email)}
                onMarkRead={() => onMarkRead(email)}
              />
              {email.id === selectedEmail?.id && (
                <div className="mt-1 mb-2">
                  <DetailPanel
                    email={selectedEmail}
                    onClose={onClose}
                    onArchive={onArchive}
                    onMarkRead={onMarkRead}
                    onSaveDraft={onSaveDraft}
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

"use client"

import { useState } from "react"
import type { AccountId, Email, Category } from "@/lib/types"
import EmailRow from "./EmailRow"
import DetailPanel from "./DetailPanel"

interface Props {
  category: Category
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
  gmailAccount: AccountId
}

export default function CategoryBlock({ category, emails, selectedEmail, onSelect, onExpand, onClose, onMarkRead, onArchive, onSaveDraft, onSend, onStar, onDelete, gmailAccount }: Props) {
  const sorted = [...emails].sort((a, b) => a.internalDate - b.internalDate)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())

  const selectionMode = bulkSelected.size > 0
  const allSelected = sorted.length > 0 && bulkSelected.size === sorted.length

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
              onClick={toggleSelectAll}
              className="text-xs text-zinc-400 hover:text-zinc-700 hover:bg-white/80 px-2 py-0.5 rounded-full transition-colors"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectionMode && (
        <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-50 border-b border-zinc-100">
          <span className="text-xs text-zinc-400 mr-1">{bulkSelected.size} selected</span>
          <button
            onClick={handleBulkMarkRead}
            className="text-xs px-2 py-1 rounded border border-zinc-200 text-zinc-600 hover:bg-white transition-colors"
          >
            Mark read
          </button>
          <button
            onClick={handleBulkArchive}
            className="text-xs px-2 py-1 rounded border border-zinc-200 text-zinc-600 hover:bg-white transition-colors"
          >
            Archive
          </button>
          <button
            onClick={handleBulkDelete}
            className="text-xs px-2 py-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => setBulkSelected(new Set())}
            className="text-xs text-zinc-400 hover:text-zinc-600 ml-auto transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Email list */}
      <div className="px-2 py-2 space-y-0.5 min-h-[80px]">
        {sorted.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-4">All clear ✓</p>
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
                    onClose={onClose}
                    onArchive={onArchive}
                    onMarkRead={onMarkRead}
                    onSaveDraft={onSaveDraft}
                    onSend={onSend}
                    onStar={onStar}
                    onDelete={onDelete}
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

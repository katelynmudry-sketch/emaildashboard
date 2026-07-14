"use client"

import { useState } from "react"
import type { Email } from "@/lib/types"

interface Props {
  email: Email
  onConfirm: (note: string, includeLink: boolean, markRead: boolean, archive: boolean) => void
  onClose: () => void
}

export default function TodoNoteModal({ email, onConfirm, onClose }: Props) {
  const fromName = (email.from?.split("<")[0] ?? email.from ?? "").trim()
  const [note, setNote] = useState(`${email.subject} — ${fromName}`)
  const [includeLink, setIncludeLink] = useState(true)
  const [markRead, setMarkRead] = useState(false)
  const [archive, setArchive] = useState(false)

  function submit() {
    const trimmed = note.trim()
    if (!trimmed) return
    onConfirm(trimmed, includeLink, markRead, archive)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-96 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-900">📋 Add to TODO list</p>
            <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[280px]">{email.subject}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">What&apos;s the action item?</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            autoFocus
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 cursor-pointer">
            <input
              type="checkbox"
              checked={includeLink}
              onChange={e => setIncludeLink(e.target.checked)}
              className="rounded border-zinc-300 text-violet-600 focus:ring-violet-300"
            />
            Include link back to this email
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 cursor-pointer">
            <input
              type="checkbox"
              checked={markRead}
              onChange={e => setMarkRead(e.target.checked)}
              className="rounded border-zinc-300 text-violet-600 focus:ring-violet-300"
            />
            Mark as read
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 cursor-pointer">
            <input
              type="checkbox"
              checked={archive}
              onChange={e => setArchive(e.target.checked)}
              className="rounded border-zinc-300 text-violet-600 focus:ring-violet-300"
            />
            Archive this email
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm font-medium rounded-lg text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={submit}
            disabled={!note.trim()}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            Add to TODO
          </button>
        </div>
      </div>
    </div>
  )
}

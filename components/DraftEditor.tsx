"use client"

import { useState } from "react"
import type { Email } from "@/lib/types"

interface Props {
  email: Email
  onApprove: (body: string) => Promise<void>
  onCancel: () => void
}

export default function DraftEditor({ email, onApprove, onCancel }: Props) {
  const [body, setBody] = useState(email.draftReply ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleApprove() {
    setSaving(true)
    await onApprove(body)
    setSaving(false)
    setSaved(true)
  }

  if (saved) {
    return (
      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
        Draft saved to Gmail ✓
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Draft reply</p>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={6}
        className="w-full text-sm text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
        placeholder="Write your reply..."
      />
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={saving || !body.trim()}
          className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {saving ? "Saving…" : "Save to Gmail Drafts"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 text-sm text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

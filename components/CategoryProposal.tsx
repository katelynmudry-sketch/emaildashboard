"use client"

import { useState } from "react"
import type { Category } from "@/lib/types"

interface ProposedCategory {
  name: string
  color: string
}

interface Props {
  proposed: ProposedCategory[]
  account: string
  onConfirm: (categories: Omit<Category, "id" | "gmailLabelId">[]) => Promise<void>
}

export default function CategoryProposal({ proposed, account, onConfirm }: Props) {
  const [categories, setCategories] = useState<ProposedCategory[]>(proposed)
  const [saving, setSaving] = useState(false)

  function updateName(index: number, name: string) {
    setCategories(prev => prev.map((c, i) => i === index ? { ...c, name } : c))
  }

  async function handleConfirm() {
    setSaving(true)
    await onConfirm(categories)
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900">Set up your inbox</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Claude looked at your {account} inbox and suggested these 6 categories.
            Rename any that don't feel right, then confirm.
          </p>
        </div>

        <div className="space-y-2 mb-6">
          {categories.map((cat, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full shrink-0 ${cat.color}`} />
              <input
                type="text"
                value={cat.name}
                onChange={e => updateName(i, e.target.value)}
                className="flex-1 text-sm text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={saving || categories.some(c => !c.name.trim())}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
        >
          {saving ? "Creating Gmail labels…" : "Confirm categories"}
        </button>

        <p className="text-xs text-zinc-400 text-center mt-3">
          These labels will be created in your Gmail account.
        </p>
      </div>
    </div>
  )
}

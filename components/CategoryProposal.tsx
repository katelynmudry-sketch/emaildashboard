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
  existingLabelNames: string[]
  onConfirm: (categories: Omit<Category, "id" | "gmailLabelId">[]) => Promise<void>
}

const COLOR_OPTIONS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-pink-500",
  "bg-teal-500", "bg-indigo-500",
]

function nextColor(existing: ProposedCategory[]): string {
  const used = new Set(existing.map(c => c.color))
  return COLOR_OPTIONS.find(c => !used.has(c)) ?? COLOR_OPTIONS[existing.length % COLOR_OPTIONS.length]
}

export default function CategoryProposal({ proposed, account, existingLabelNames, onConfirm }: Props) {
  // Sort: existing Gmail labels first, then new suggestions
  const sorted = [
    ...proposed.filter(c => existingLabelNames.some(n => n.toLowerCase() === c.name.toLowerCase())),
    ...proposed.filter(c => !existingLabelNames.some(n => n.toLowerCase() === c.name.toLowerCase())),
  ]

  const [categories, setCategories] = useState<ProposedCategory[]>(sorted)
  const [saving, setSaving] = useState(false)

  function updateName(index: number, name: string) {
    setCategories(prev => prev.map((c, i) => i === index ? { ...c, name } : c))
  }

  function removeCategory(index: number) {
    setCategories(prev => prev.filter((_, i) => i !== index))
  }

  function addCategory() {
    setCategories(prev => [...prev, { name: "", color: nextColor(prev) }])
  }

  function isExisting(name: string) {
    return existingLabelNames.some(n => n.toLowerCase() === name.toLowerCase())
  }

  async function handleConfirm() {
    setSaving(true)
    await onConfirm(categories)
    setSaving(false)
  }

  const canConfirm = !saving && categories.length >= 1 && categories.every(c => c.name.trim())

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-900">Set up your inbox</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Claude suggested categories based on your {account} inbox
            {existingLabelNames.length > 0 && " and your existing Gmail labels"}.
            Add, remove, or rename any — then confirm.
          </p>
        </div>

        {existingLabelNames.length > 0 && (
          <p className="text-xs text-zinc-400 mb-3">
            Labels marked with a check already exist in Gmail and won't be recreated.
          </p>
        )}

        <div className="space-y-2 mb-4">
          {categories.map((cat, i) => {
            const existing = isExisting(cat.name)
            return (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full shrink-0 ${cat.color}`} />
                <input
                  type="text"
                  value={cat.name}
                  onChange={e => updateName(i, e.target.value)}
                  className="flex-1 text-sm text-zinc-800 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
                />
                {existing && (
                  <span title="Already exists in Gmail" className="text-emerald-500 text-xs font-medium shrink-0">
                    existing
                  </span>
                )}
                <button
                  onClick={() => removeCategory(i)}
                  disabled={categories.length <= 1}
                  className="text-zinc-300 hover:text-red-400 disabled:opacity-20 transition-colors shrink-0 text-lg leading-none"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>

        <button
          onClick={addCategory}
          className="w-full text-sm text-violet-600 hover:text-violet-700 border border-dashed border-violet-300 hover:border-violet-400 rounded-lg py-2 transition-colors mb-6"
        >
          + Add category
        </button>

        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
        >
          {saving ? "Creating Gmail labels…" : `Confirm ${categories.length} categor${categories.length === 1 ? "y" : "ies"}`}
        </button>

        <p className="text-xs text-zinc-400 text-center mt-3">
          New labels will be created in Gmail. Existing ones will be reused.
        </p>
      </div>
    </div>
  )
}

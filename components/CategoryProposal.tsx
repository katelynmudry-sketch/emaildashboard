"use client"

import { useState } from "react"
import type { Category } from "@/lib/types"
import { categoryNoun, type PartyMode } from "@/lib/party-mode"
import type { PrioritySenderCandidate } from "@/lib/priority-senders"

interface ProposedCategory {
  name: string
  color: string
}

interface Props {
  proposed: ProposedCategory[]
  account: string
  existingLabelNames: string[]
  mode: PartyMode
  prioritySenderCandidate?: PrioritySenderCandidate | null
  onConfirm: (categories: Omit<Category, "id" | "gmailLabelId">[], prioritySenderEmail?: string) => Promise<void>
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

const THEME: Record<PartyMode, { pageBg: string; cardBg: string; border: string; accent: string; text: string; sub: string }> = {
  party: {
    pageBg: "linear-gradient(145deg, #F4ECFF 0%, #FFE8F2 100%)",
    cardBg: "#FFFFFF",
    border: "rgba(139,63,216,0.18)",
    accent: "#8B3FD8",
    text: "#1A0A35",
    sub: "#6B5B8A",
  },
  zen: {
    pageBg: "linear-gradient(145deg, #FFF8E8 0%, #FFF0CC 100%)",
    cardBg: "#FFFEF9",
    border: "rgba(200,150,12,0.18)",
    accent: "#C8960C",
    text: "#3A2E10",
    sub: "#8A7A50",
  },
  "wabi-sabi": {
    pageBg: "linear-gradient(145deg, #FFF5E8 0%, #FCE8D5 100%)",
    cardBg: "#FFFBF6",
    border: "rgba(193,125,60,0.22)",
    accent: "#C17D3C",
    text: "#3A2410",
    sub: "#A6826A",
  },
}

export default function CategoryProposal({ proposed, account, existingLabelNames, mode, prioritySenderCandidate, onConfirm }: Props) {
  // Sort: existing Gmail labels first, then new suggestions
  const sorted = [
    ...proposed.filter(c => existingLabelNames.some(n => n.toLowerCase() === c.name.toLowerCase())),
    ...proposed.filter(c => !existingLabelNames.some(n => n.toLowerCase() === c.name.toLowerCase())),
  ]

  const [categories, setCategories] = useState<ProposedCategory[]>(sorted)
  const [saving, setSaving] = useState(false)
  const [prioritySenderChoice, setPrioritySenderChoice] = useState<"accepted" | "declined" | null>(null)

  const theme = THEME[mode]
  const { singular, plural } = categoryNoun(mode)

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
    const prioritySenderEmail = prioritySenderChoice === "accepted" ? prioritySenderCandidate?.email : undefined
    await onConfirm(categories, prioritySenderEmail)
    setSaving(false)
  }

  const canConfirm = !saving && categories.length >= 1 && categories.every(c => c.name.trim())

  // ── Mode-aware copy ─────────────────────────────────────────────────────────

  const existingNote = existingLabelNames.length > 0
    ? mode === "zen"
      ? " and the Gmail labels you already had"
      : mode === "wabi-sabi"
        ? " plus the Gmail labels u already had going"
        : " and your existing Gmail labels"
    : ""

  const title = mode === "zen"
    ? `Name your ${plural.toLowerCase()}`
    : mode === "wabi-sabi"
      ? `let's set up ur ${plural.toLowerCase()} ✨`
      : `Set up your ${plural} 🎉`

  const description = mode === "zen"
    ? `Claude noticed these patterns in your ${account} inbox${existingNote} and suggests these ${plural.toLowerCase()} to hold them. Rename, add, or remove anything that doesn't fit — then confirm.`
    : mode === "wabi-sabi"
      ? `ok so Claude looked at ur ${account} inbox${existingNote} and came up with these ${plural.toLowerCase()} — rename, add, or delete whatever, totally up to u bestie.`
      : `Claude suggested these ${plural} based on your ${account} inbox${existingNote}. Add, remove, or rename any — then confirm.`

  const existingHint = mode === "zen"
    ? `Anything marked already exists as a Gmail label and won't be recreated.`
    : mode === "wabi-sabi"
      ? `the ones marked "existing" are already real Gmail labels, so we're just reusing them`
      : `Labels marked with a check already exist in Gmail and won't be recreated.`

  const addLabel = mode === "zen"
    ? `+ Add another ${singular.toLowerCase()}`
    : mode === "wabi-sabi"
      ? `+ add another ${singular.toLowerCase()}, why not`
      : `+ Add ${singular}`

  const countWord = (n: number) => n === 1 ? singular : plural

  const confirmLabel = saving
    ? (mode === "zen"
        ? `Creating your ${plural.toLowerCase()}…`
        : mode === "wabi-sabi"
          ? `setting up ur ${plural.toLowerCase()}…`
          : "Creating Gmail labels…")
    : (mode === "zen"
        ? `Confirm ${categories.length} ${countWord(categories.length).toLowerCase()}`
        : mode === "wabi-sabi"
          ? `confirm ${categories.length} ${countWord(categories.length).toLowerCase()}, let's gooo`
          : `CONFIRM ${categories.length} ${countWord(categories.length).toUpperCase()} 🎉`)

  const footerNote = mode === "zen"
    ? "New labels are created in Gmail; anything that already exists is reused as-is."
    : mode === "wabi-sabi"
      ? "new labels get made in Gmail, existing ones just get reused, easy"
      : "New labels will be created in Gmail. Existing ones will be reused."

  // ── Priority sender suggestion copy ─────────────────────────────────────────

  const senderName = prioritySenderCandidate?.name || prioritySenderCandidate?.email || ""

  const prioritySenderPrompt = mode === "zen"
    ? `${senderName} writes to you often, and you write back just as often. Want to give them a permanent home in your priority ${singular.toLowerCase()}?`
    : mode === "wabi-sabi"
      ? `omg ${senderName} is LITERALLY always in ur inbox and u always reply — give them VIP access to ur priority ${singular.toLowerCase()}?`
      : `${senderName} emails you a lot — and you reply just as much. Always put them in your priority ${singular}?`

  const yesLabel = mode === "zen" ? "Yes, always" : mode === "wabi-sabi" ? "yes bestie, always" : "Yes, always! 🎉"
  const noLabel = mode === "zen" ? "Not now" : mode === "wabi-sabi" ? "nah, maybe later" : "Not now"

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: theme.pageBg }}>
      <div className="rounded-2xl shadow-sm p-8 w-full max-w-lg" style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}>
        <div className="mb-6">
          <h1 className="text-xl font-semibold" style={{ color: theme.text, fontFamily: mode === "party" ? "var(--font-display)" : undefined }}>{title}</h1>
          <p className="text-sm mt-1" style={{ color: theme.sub }}>{description}</p>
        </div>

        {existingLabelNames.length > 0 && (
          <p className="text-xs mb-3" style={{ color: theme.sub }}>{existingHint}</p>
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
                  className="flex-1 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ color: theme.text, border: `1px solid ${theme.border}`, background: "transparent" }}
                />
                {existing && (
                  <span title="Already exists in Gmail" className="text-xs font-medium shrink-0" style={{ color: "#10A37F" }}>
                    existing
                  </span>
                )}
                <button
                  onClick={() => removeCategory(i)}
                  disabled={categories.length <= 1}
                  className="hover:text-red-400 disabled:opacity-20 transition-colors shrink-0 text-lg leading-none"
                  style={{ color: theme.border }}
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
          className="w-full text-sm rounded-lg py-2 transition-colors mb-6"
          style={{ color: theme.accent, border: `1px dashed ${theme.border}` }}
        >
          {addLabel}
        </button>

        {prioritySenderCandidate && prioritySenderChoice === null && (
          <div className="mb-6 rounded-xl p-4" style={{ border: `1px solid ${theme.border}`, background: "rgba(255,255,255,0.4)" }}>
            <p className="text-sm mb-3" style={{ color: theme.text }}>📌 {prioritySenderPrompt}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPrioritySenderChoice("accepted")}
                className="flex-1 text-sm font-medium py-2 rounded-lg transition-colors"
                style={{ background: theme.accent, color: "#FFFFFF" }}
              >
                {yesLabel}
              </button>
              <button
                onClick={() => setPrioritySenderChoice("declined")}
                className="flex-1 text-sm py-2 rounded-lg transition-colors"
                style={{ color: theme.sub, border: `1px solid ${theme.border}` }}
              >
                {noLabel}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
          style={{ background: theme.accent, color: "#FFFFFF" }}
        >
          {confirmLabel}
        </button>

        <p className="text-xs text-center mt-3" style={{ color: theme.sub }}>
          {footerNote}
        </p>
      </div>
    </div>
  )
}

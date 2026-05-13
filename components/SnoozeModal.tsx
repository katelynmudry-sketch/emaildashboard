"use client"

import { useState } from "react"
import type { Email } from "@/lib/types"

interface Props {
  email: Email
  onSnooze: (email: Email, until: string) => void
  onClose: () => void
}

function nextWeekday(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const QUICK_OPTIONS = [
  { label: "Tomorrow", value: () => nextWeekday(1) },
  { label: "In 3 days", value: () => nextWeekday(3) },
  { label: "Next week", value: () => nextWeekday(7) },
  { label: "In 2 weeks", value: () => nextWeekday(14) },
]

export default function SnoozeModal({ email, onSnooze, onClose }: Props) {
  const [custom, setCustom] = useState("")

  function pick(until: string) {
    if (!until) return
    onSnooze(email, until)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-80 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-900">💤 Snooze until…</p>
            <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[220px]">{email.subject}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {QUICK_OPTIONS.map(opt => (
            <button
              key={opt.label}
              onClick={() => pick(opt.value())}
              className="rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-violet-50 hover:border-violet-300 px-3 py-2.5 text-sm font-medium text-zinc-700 hover:text-violet-700 transition-colors text-left"
            >
              {opt.label}
              <span className="block text-[10px] text-zinc-400 mt-0.5 font-normal">{opt.value()}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">Custom date</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={custom}
              min={nextWeekday(1)}
              onChange={e => setCustom(e.target.value)}
              className="flex-1 text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
            <button
              onClick={() => pick(custom)}
              disabled={!custom}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              Set
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import type { AccountId } from "@/lib/types"
import { ACCOUNTS } from "@/lib/types"

interface Props {
  active: AccountId
  onChange: (id: AccountId) => void
  loading: boolean
}

export default function AccountToggle({ active, onChange, loading }: Props) {
  return (
    <div className="flex items-center gap-1 bg-zinc-100 rounded-full p-1">
      {ACCOUNTS.map(account => (
        <button
          key={account.id}
          onClick={() => !loading && onChange(account.id)}
          disabled={loading}
          className={`px-2.5 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
            active === account.id
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          {account.label}
        </button>
      ))}
    </div>
  )
}

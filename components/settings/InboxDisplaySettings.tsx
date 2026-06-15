"use client"

import { useState, useEffect } from "react"
import { loadSettings, saveSettings } from "@/lib/settings-storage"
import { Hint, SectionLabel, ToggleSwitch } from "./shared"

export default function InboxDisplaySettings() {
  const [showUnreadOnly, setShowUnreadOnly] = useState(true)
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")

  useEffect(() => {
    const stored = loadSettings()
    setShowUnreadOnly(stored.showUnreadOnly !== false)
    setSortOrder(stored.sortOrder === "oldest" ? "oldest" : "newest")
  }, [])

  function toggleUnreadOnly() {
    const next = !showUnreadOnly
    setShowUnreadOnly(next)
    saveSettings({ showUnreadOnly: next })
  }

  function setOrder(order: "newest" | "oldest") {
    setSortOrder(order)
    saveSettings({ sortOrder: order })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Hint>
        These control what your inbox grid shows and how it&apos;s sorted. Changes apply on the next refresh.
      </Hint>

      {/* ── Show unread only ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <ToggleSwitch checked={showUnreadOnly} onChange={toggleUnreadOnly} activeColor="#8B3FD8" />
        <div>
          <div style={{ fontSize: "0.80rem", fontWeight: 600, color: "#1A0A35", lineHeight: 1.3 }}>
            Show unread only
          </div>
          <div style={{ fontSize: "0.72rem", color: "rgba(26,10,53,0.50)", marginTop: 1 }}>
            When OFF, read emails still in your inbox are included too — each email shows a read/unread dot so you can tell them apart. Archived emails never appear here either way.
          </div>
        </div>
      </div>

      {/* ── Sort order ── */}
      <div>
        <SectionLabel color="#8B3FD8">Sort order</SectionLabel>
        <div className="flex rounded-full p-0.5" style={{
          display: "inline-flex",
          border: "1px solid rgba(26,10,53,0.10)",
          background: "rgba(26,10,53,0.03)",
        }}>
          {(
            [
              { id: "newest" as const, label: "Newest first" },
              { id: "oldest" as const, label: "Oldest first" },
            ]
          ).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setOrder(opt.id)}
              style={{
                padding: "6px 16px", borderRadius: 999,
                background: sortOrder === opt.id ? "#8B3FD8" : "transparent",
                color: sortOrder === opt.id ? "#FFF5E0" : "rgba(26,10,53,0.55)",
                fontSize: "0.78rem",
                fontWeight: sortOrder === opt.id ? 700 : 500,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                transition: "all 0.15s ease",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

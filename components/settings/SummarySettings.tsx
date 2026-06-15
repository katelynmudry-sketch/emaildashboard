"use client"

import { useState, useEffect } from "react"
import { loadSettings, saveSettings } from "@/lib/settings-storage"
import { Hint, ToggleSwitch } from "./shared"

export default function SummarySettings() {
  const [expandedSummariesForAll, setExpandedSummariesForAll] = useState(false)

  useEffect(() => {
    const stored = loadSettings()
    setExpandedSummariesForAll(!!stored.expandedSummariesForAll)
  }, [])

  function toggleExpandedSummaries() {
    const next = !expandedSummariesForAll
    setExpandedSummariesForAll(next)
    saveSettings({ expandedSummariesForAll: next })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Hint>
        Urgent and today-priority emails already get a richer, more detailed AI summary
        in your Daily Briefing.
      </Hint>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <ToggleSwitch checked={expandedSummariesForAll} onChange={toggleExpandedSummaries} activeColor="#8B3FD8" />
        <div>
          <div style={{ fontSize: "0.80rem", fontWeight: 600, color: "#1A0A35", lineHeight: 1.3 }}>
            Detailed summaries for every email
          </div>
          <div style={{ fontSize: "0.72rem", color: "rgba(26,10,53,0.50)", marginTop: 1 }}>
            When ON, every email gets that same level of detail. When OFF, lower-priority
            emails keep a short summary (or none at all for brief emails).
          </div>
        </div>
      </div>
    </div>
  )
}

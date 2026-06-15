"use client"

import { useState, useEffect } from "react"
import { loadSettings, saveSettings } from "@/lib/settings-storage"
import { Hint, SectionLabel, SaveOk, TEXTAREA_STYLE } from "./shared"
import AiCleanupSettings from "./AiCleanupSettings"

export default function AiRulesSettings() {
  const [personalText, setPersonalText] = useState("")
  const [workText, setWorkText] = useState("")
  const [saveOk, setSaveOk] = useState(false)

  useEffect(() => {
    const stored = loadSettings()
    setPersonalText(stored.personalRules)
    setWorkText(stored.workRules)
  }, [])

  function flashSaveOk() {
    setSaveOk(true)
    setTimeout(() => setSaveOk(false), 2500)
  }

  function handleSaveCustomRules() {
    saveSettings({ personalRules: personalText, workRules: workText })
    flashSaveOk()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Hint>
        Short rules injected into Claude&apos;s prompt on every refresh. Changes apply on the next load.
      </Hint>

      {/* ── AI Actions ── */}
      <AiCleanupSettings />

      <div>
        <SectionLabel color="#FF1F6E">Personal inbox rules</SectionLabel>
        <textarea
          value={personalText}
          onChange={e => setPersonalText(e.target.value)}
          rows={5}
          placeholder="e.g. Do not show newsletters in the briefing."
          style={TEXTAREA_STYLE}
        />
      </div>

      <div>
        <SectionLabel color="#FF6B1A">Work inbox rules</SectionLabel>
        <textarea
          value={workText}
          onChange={e => setWorkText(e.target.value)}
          rows={5}
          placeholder="e.g. Only show newsletters if they have a discount expiring within 7 days."
          style={TEXTAREA_STYLE}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={handleSaveCustomRules} style={{
          padding: "9px 24px", borderRadius: 999,
          background: "#FF1F6E", color: "#1A0A35", border: "none",
          fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
          cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
          boxShadow: "0 4px 16px rgba(255,31,110,0.30)",
        }}>
          Save Rules
        </button>
        <SaveOk show={saveOk} />
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useRef } from "react"
import { loadSettings, saveSettings } from "@/lib/settings-storage"
import { Hint, SectionLabel, SaveOk, TEXTAREA_STYLE, ToggleSwitch } from "./shared"

export default function AiRulesSettings() {
  const [personalText, setPersonalText] = useState("")
  const [workText, setWorkText] = useState("")
  const [aboutYouText, setAboutYouText] = useState("")
  const [saveOk, setSaveOk] = useState(false)

  const [aiPastEventDelete, setAiPastEventDelete] = useState(true)
  const [aiDeliveryChainCleanup, setAiDeliveryChainCleanup] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = loadSettings()
    setPersonalText(stored.personalRules)
    setWorkText(stored.workRules)
    setAboutYouText(stored.aboutYouContext)
    setAiPastEventDelete(stored.aiPastEventDelete !== false)
    setAiDeliveryChainCleanup(stored.aiDeliveryChainCleanup !== false)
  }, [])

  function flashSaveOk() {
    setSaveOk(true)
    setTimeout(() => setSaveOk(false), 2500)
  }

  function handleSaveCustomRules() {
    saveSettings({ personalRules: personalText, workRules: workText, aboutYouContext: aboutYouText })
    flashSaveOk()
  }

  function handleAboutYouFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") setAboutYouText(reader.result)
    }
    reader.readAsText(file)
    // Reset so the same file can be re-selected later
    e.target.value = ""
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Hint>
        Short rules injected into Claude&apos;s prompt on every refresh. Changes apply on the next load.
        Saved in your browser — works on Vercel too.
      </Hint>

      {/* ── AI Actions ── */}
      <div style={{ background: "rgba(139,63,216,0.04)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(139,63,216,0.12)" }}>
        <SectionLabel color="#8B3FD8">AI Actions</SectionLabel>
        <p style={{ fontSize: "0.75rem", color: "rgba(26,10,53,0.50)", margin: "0 0 10px", lineHeight: 1.5 }}>
          Automatic suggestions Claude surfaces after every inbox load. On by default.
        </p>
        {(
          [
            {
              key: "aiPastEventDelete" as const,
              label: "Flag past calendar events for deletion",
              desc: "Marks event invitation emails as deletable once the event date has passed.",
              value: aiPastEventDelete,
              set: setAiPastEventDelete,
            },
            {
              key: "aiDeliveryChainCleanup" as const,
              label: "Suggest deleting shipping email chains",
              desc: "After a package arrives, finds the full shipping/tracking thread and offers to delete it.",
              value: aiDeliveryChainCleanup,
              set: setAiDeliveryChainCleanup,
            },
          ] as const
        ).map(({ key, label, desc, value, set }) => (
          <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
            <ToggleSwitch
              checked={value}
              activeColor="#8B3FD8"
              onChange={() => {
                const next = !value
                set(next)
                saveSettings({ [key]: next })
              }}
            />
            <div>
              <div style={{ fontSize: "0.80rem", fontWeight: 600, color: "#1A0A35", lineHeight: 1.3 }}>{label}</div>
              <div style={{ fontSize: "0.72rem", color: "rgba(26,10,53,0.50)", marginTop: 1 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

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

      {/* ── About You ── */}
      <div>
        <SectionLabel color="#8B3FD8">About You</SectionLabel>
        <Hint>
          A free-text reference doc describing who you are. Claude uses this as context when drafting
          replies and categorizing email — e.g. &ldquo;I&apos;m a naturopathic doctor with a private practice...&rdquo;
          or &ldquo;I&apos;m a software engineer who freelances on the side...&rdquo;
        </Hint>
        <div style={{ marginTop: 8 }}>
          <textarea
            value={aboutYouText}
            onChange={e => setAboutYouText(e.target.value)}
            rows={6}
            placeholder="e.g. I'm a naturopathic doctor running a small private practice. I see patients Tues-Thurs and handle admin on Mondays..."
            style={TEXTAREA_STYLE}
          />
        </div>
        <div style={{ marginTop: 6 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: "none", border: "none", padding: 0,
              color: "#8B3FD8", fontSize: "0.76rem", fontWeight: 600,
              cursor: "pointer", textDecoration: "underline",
              fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
            }}
          >
            Load from .txt or .md file…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.markdown"
            onChange={handleAboutYouFile}
            style={{ display: "none" }}
          />
        </div>
      </div>

      <div style={{
        background: "rgba(0,229,196,0.08)", border: "1px solid rgba(0,229,196,0.25)",
        borderRadius: 8, padding: "10px 12px",
        fontSize: "0.76rem", color: "rgba(26,10,53,0.72)", lineHeight: 1.6,
      }}>
        <strong style={{ color: "#00A88A" }}>✓ Works on Vercel &amp; local:</strong>{" "}
        Rules are saved in your browser and sent with each refresh — no server writes needed.
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

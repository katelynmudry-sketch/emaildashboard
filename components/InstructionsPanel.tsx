"use client"

import { useState, useEffect } from "react"
import { loadSettings, seedIfEmpty } from "@/lib/settings-storage"
import InboxDisplaySettings from "@/components/settings/InboxDisplaySettings"
import AiRulesSettings from "@/components/settings/AiRulesSettings"
import AiSystemPromptSettings from "@/components/settings/AiSystemPromptSettings"
import FullPromptPreview from "@/components/settings/FullPromptPreview"
import AccountsSettings from "@/components/settings/AccountsSettings"

interface ContextData {
  systemContext: string
  categorizeInstructions: string
  seedCustom: { personal: string; work: string }
}

interface Props {
  open: boolean
  onClose: () => void
}

type Tab = "display" | "rules" | "prompt" | "preview" | "accounts"

const tabs: { id: Tab; label: string }[] = [
  { id: "display",  label: "📥 Inbox Display" },
  { id: "rules",    label: "✏️ AI Rules" },
  { id: "prompt",   label: "🧠 AI System Prompt" },
  { id: "preview",  label: "📋 Full Prompt" },
  { id: "accounts", label: "🔗 Accounts & Storage" },
]

export default function InstructionsPanel({ open, onClose }: Props) {
  const [data, setData] = useState<ContextData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>("display")

  // Load on open
  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch("/api/ai/context")
      .then(r => r.json())
      .then((d: ContextData) => {
        setData(d)
        // Seed localStorage from server defaults on first run
        seedIfEmpty({
          personalRules: d.seedCustom.personal,
          workRules: d.seedCustom.work,
        })
        // Touch loadSettings so localStorage migration runs before tabs mount
        loadSettings()
      })
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(26,10,53,0.35)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(600px, 96vw)",
        zIndex: 201,
        background: "#FFFFFF",
        boxShadow: "-8px 0 40px rgba(26,10,53,0.18)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "slideInRight 0.32s cubic-bezier(0.16,1,0.3,1) both",
      }}>

        {/* Header */}
        <div style={{
          padding: "18px 22px 14px",
          borderBottom: "1px solid rgba(26,10,53,0.08)",
          background: "linear-gradient(135deg, #8B3FD8 0%, #FF1F6E 100%)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.5rem", color: "#FFF5E0",
                margin: 0, lineHeight: 1,
              }}>
                SETTINGS
              </h2>
              <p style={{
                fontSize: "0.72rem", color: "rgba(255,245,224,0.70)",
                margin: "5px 0 0", letterSpacing: "0.08em", textTransform: "uppercase",
              }}>
                AI instructions &amp; account rules
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,245,224,0.18)", border: "none", borderRadius: 8,
                color: "#FFF5E0", width: 32, height: 32, cursor: "pointer",
                fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(26,10,53,0.08)", flexShrink: 0 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: "10px 4px",
                fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.03em",
                border: "none", cursor: "pointer",
                background: tab === t.id ? "#FFFFFF" : "rgba(26,10,53,0.03)",
                color: tab === t.id ? "#8B3FD8" : "rgba(26,10,53,0.55)",
                borderBottom: tab === t.id ? "2px solid #8B3FD8" : "2px solid transparent",
                transition: "all 0.15s ease",
                fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>

          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(26,10,53,0.40)", fontSize: "0.82rem" }}>
              Loading…
            </div>
          )}

          {!loading && tab === "display" && <InboxDisplaySettings />}
          {!loading && tab === "rules" && <AiRulesSettings />}
          {!loading && tab === "prompt" && <AiSystemPromptSettings data={data} />}
          {!loading && tab === "preview" && <FullPromptPreview data={data} />}
          {!loading && tab === "accounts" && <AccountsSettings />}

        </div>
      </div>

      {/* Panel slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

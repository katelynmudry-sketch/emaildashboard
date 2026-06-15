"use client"

import { useState, useEffect } from "react"
import { loadSettings } from "@/lib/settings-storage"
import { Hint, SectionLabel, CODE_STYLE } from "./shared"

interface ContextData {
  systemContext: string
  categorizeInstructions: string
  seedCustom: { personal: string; work: string }
}

interface Props {
  data: ContextData | null
}

type AccountChoice = "personal" | "work"

export default function FullPromptPreview({ data }: Props) {
  const [account, setAccount] = useState<AccountChoice>("personal")
  const [personalRules, setPersonalRules] = useState("")
  const [workRules, setWorkRules] = useState("")
  const [systemContext, setSystemContext] = useState("")
  const [aboutYouContext, setAboutYouContext] = useState("")
  const [dreamInboxContext, setDreamInboxContext] = useState("")
  const [personalDraftTone, setPersonalDraftTone] = useState("")
  const [workDraftTone, setWorkDraftTone] = useState("")

  useEffect(() => {
    const stored = loadSettings()
    setPersonalRules(stored.personalRules)
    setWorkRules(stored.workRules)
    setSystemContext(stored.systemContext)
    setAboutYouContext(stored.aboutYouContext)
    setDreamInboxContext(stored.dreamInboxContext)
    setPersonalDraftTone(stored.personalDraftTone)
    setWorkDraftTone(stored.workDraftTone)
  }, [])

  if (!data) return null

  const effectiveSystemContext = systemContext || data.systemContext
  const aboutYouSection = aboutYouContext.trim()
    ? `\n\n## About the user\n${aboutYouContext.trim()}`
    : ""
  const draftTone = account === "personal" ? personalDraftTone : workDraftTone
  const draftToneSection = draftTone.trim()
    ? `\n\n## Tone for replies from this account\n${draftTone.trim()}`
    : ""
  const dreamInboxSection = dreamInboxContext.trim()
    ? `\n\n## What this user needs from their inbox\n${dreamInboxContext.trim()}`
    : ""
  const customRules = account === "personal" ? personalRules : workRules
  const customContextSection = customRules.trim()
    ? `\n## Custom instructions for this account\n${customRules.trim()}`
    : ""

  // ── Inbox categorization prompt ──
  const categorizeSystem = effectiveSystemContext + aboutYouSection + draftToneSection + dreamInboxSection
  const categorizeUser = [
    customContextSection.trim(),
    data.categorizeInstructions,
    "[EMAIL LIST]\n<your emails are appended here at runtime>",
  ].filter(Boolean).join("\n\n")

  const categorizePrompt = [
    "[SYSTEM PROMPT]",
    categorizeSystem,
    "\n[USER MESSAGE]",
    categorizeUser,
  ].join("\n")

  // ── Email draft prompt ──
  const draftSystem = effectiveSystemContext + customContextSection + aboutYouSection + draftToneSection + dreamInboxSection
  const draftUser = `Write a friendly, concise reply to this email. 2-4 sentences. Return only the reply text.

From: <sender name> <sender@example.com>
Subject: <email subject>
Message: <email body>`

  const draftPrompt = [
    "[SYSTEM PROMPT]",
    draftSystem,
    "\n[USER MESSAGE]",
    draftUser,
  ].join("\n")

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Hint>
        This is exactly what Claude reads before categorizing your inbox or drafting a reply.
      </Hint>

      {/* Personal/Work toggle */}
      <div style={{ display: "flex", gap: 8 }}>
        {(
          [
            { id: "personal" as const, label: "Personal", color: "#FF1F6E" },
            { id: "work" as const, label: "Work", color: "#FF6B1A" },
          ]
        ).map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setAccount(opt.id)}
            style={{
              padding: "6px 16px", borderRadius: 999,
              background: account === opt.id ? opt.color : "transparent",
              color: account === opt.id ? "#FFFFFF" : opt.color,
              border: `1.5px solid ${opt.color}`,
              fontSize: "0.78rem",
              fontWeight: account === opt.id ? 700 : 500,
              cursor: "pointer",
              fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
              transition: "all 0.15s ease",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div>
        <SectionLabel color="#8B3FD8">Inbox categorization prompt</SectionLabel>
        <pre style={CODE_STYLE}>{categorizePrompt}</pre>
      </div>

      <div>
        <SectionLabel color="#8B3FD8">Email draft prompt</SectionLabel>
        <pre style={CODE_STYLE}>{draftPrompt}</pre>
      </div>
    </div>
  )
}

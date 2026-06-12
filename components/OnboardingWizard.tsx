"use client"

import { useState, useEffect } from "react"
import type { PartyMode } from "@/lib/party-mode"
import { markGateSeen } from "@/lib/party-mode"
import { loadSettings, saveSettings, seedIfEmpty } from "@/lib/settings-storage"
import QuoteGate from "./QuoteGate"
import AccountsSettings from "./settings/AccountsSettings"
import InboxDisplaySettings from "./settings/InboxDisplaySettings"
import AiRulesSettings from "./settings/AiRulesSettings"
import AiSystemPromptSettings from "./settings/AiSystemPromptSettings"
import FullPromptPreview from "./settings/FullPromptPreview"

interface ContextData {
  systemContext: string
  categorizeInstructions: string
  seedCustom: { personal: string; work: string }
}

interface OnboardingWizardProps {
  onComplete: (mode: PartyMode) => void
}

const TOTAL_STEPS = 6

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [mode, setMode] = useState<PartyMode | null>(null)
  const [step, setStep] = useState(1)
  const [contextData, setContextData] = useState<ContextData | null>(null)

  // Fetch AI context data once we reach (or approach) the prompt-preview step,
  // mirroring InstructionsPanel's pattern.
  useEffect(() => {
    if (mode === null) return
    fetch("/api/ai/context")
      .then(r => r.json())
      .then((d: ContextData) => {
        setContextData(d)
        seedIfEmpty({
          personalRules: d.seedCustom.personal,
          workRules: d.seedCustom.work,
        })
        loadSettings()
      })
      .catch(() => {})
  }, [mode])

  // ── Step 1: vibe picker (full-screen QuoteGate) ─────────────────────────
  if (mode === null) {
    return (
      <QuoteGate onEnter={(m) => {
        setMode(m)
        setStep(2)
      }} />
    )
  }

  function finish() {
    saveSettings({ onboardingComplete: true })
    markGateSeen()
    onComplete(mode!)
  }

  function goNext() {
    if (step >= TOTAL_STEPS) {
      finish()
    } else {
      setStep(s => Math.min(s + 1, TOTAL_STEPS))
    }
  }

  function goBack() {
    setStep(s => Math.max(s - 1, 2))
  }

  // ── Theme-aware shared button labels ────────────────────────────────────
  const labels = {
    next: mode === "zen" ? "Continue" : mode === "wabi-sabi" ? "Next bestie →" : "NEXT →",
    back: mode === "zen" ? "Back" : mode === "wabi-sabi" ? "← back" : "← BACK",
    skip: mode === "zen" ? "Skip — defaults are fine" : mode === "wabi-sabi" ? "skip, it's giving optional" : "SKIP FOR NOW",
    finish: mode === "zen" ? "Begin" : mode === "wabi-sabi" ? "let's gooo ✨" : "LET'S GO! 🎉",
  }

  // ── Per-step theme-aware copy ────────────────────────────────────────────
  const stepCopy: Record<number, { title: string; description: string }> = {
    2: {
      title: mode === "zen"
        ? "Connect your inboxes"
        : mode === "wabi-sabi"
          ? "ok bestie let's connect ur inboxes"
          : "CONNECT YOUR ACCOUNTS",
      description: mode === "zen"
        ? "Link your personal Gmail to begin. A second \"work\" account is optional — add it now or whenever you're ready."
        : mode === "wabi-sabi"
          ? "Connect your personal Gmail to get started. Adding a work account is totally optional, no pressure, do what feels right for you."
          : "Link your personal Gmail to start sorting. Got a work inbox too? Connect a second account — totally optional.",
    },
    3: {
      title: mode === "zen"
        ? "Shape your view"
        : mode === "wabi-sabi"
          ? "make ur inbox look cute"
          : "SET UP YOUR INBOX VIEW",
      description: mode === "zen"
        ? "Choose what appears in your grid — unread only or everything, archived or not, newest or oldest first. You can always adjust this later."
        : mode === "wabi-sabi"
          ? "Pick your vibe: unread only or all of it, archived emails in or out, newest or oldest first. Whatever feels right, you can change it later, it's giving customizable."
          : "Choose what shows up in your inbox grid — unread vs. all, archived in or out, newest or oldest first. Tweak it anytime in Settings.",
    },
    4: {
      title: mode === "zen"
        ? "Teach Claude about you"
        : mode === "wabi-sabi"
          ? "tell claude ur whole personality"
          : "AI RULES & ABOUT YOU",
      description: mode === "zen"
        ? "Optional, and skippable — the defaults work fine. If you'd like, add custom rules per account, a short note about who you are, and your own system prompt (write it, upload a file, or ask Claude to draft one)."
        : mode === "wabi-sabi"
          ? "This step is literally optional, the defaults are already great. But if you want, tell Claude a lil bit about yourself, ur rules, and even upload ur own system prompt so it gets your whole vibe, bestie."
          : "Totally optional — defaults work great out of the box. Add custom per-account rules, a quick \"About You\" note, and your own system prompt — type it, upload a file, or ask Claude to write it for you.",
    },
    5: {
      title: mode === "zen"
        ? "See how the prompts work"
        : mode === "wabi-sabi"
          ? "the receipts: how ur AI prompts work"
          : "HOW AI PROMPTS WORK",
      description: mode === "zen"
        ? "This is the exact text Claude reads before sorting your inbox or drafting a reply — built from your settings and rules. You can always revisit it from Settings → Full Prompt."
        : mode === "wabi-sabi"
          ? "Here's literally everything Claude sees before it sorts ur inbox or drafts a reply, made from ur settings. You can always come back to this in Settings → Full Prompt, it's giving transparency."
          : "This is the exact prompt Claude uses to sort your inbox and write replies, assembled from your settings. Find it anytime under Settings → Full Prompt.",
    },
    6: {
      title: mode === "zen"
        ? "You're ready"
        : mode === "wabi-sabi"
          ? "bestie ur literally all set"
          : "YOU'RE ALL SET!",
      description: mode === "zen"
        ? "Everything is in place. Take a breath — your inbox will be waiting, exactly as it is, until you're ready to sort it."
        : mode === "wabi-sabi"
          ? "Setup is complete and it's serving organized inbox energy. You did that. Time to go be amazing."
          : "Setup complete — your inbox is connected and ready to sort. Let's turn that chaos into a game you're winning.",
    },
  }

  const current = stepCopy[step]

  // ── Step indicator dots (steps 2-6 = positions 2-6 of 6) ────────────────
  const dotColor = mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "#C17D3C" : "#8B3FD8"

  // ── Wizard shell background / accents per theme ──────────────────────────
  const wizardBg = mode === "zen"
    ? "linear-gradient(145deg, #FFF8E8 0%, #FFF0CC 100%)"
    : mode === "wabi-sabi"
      ? "linear-gradient(145deg, #FFF5E8 0%, #FCE8D5 100%)"
      : "linear-gradient(145deg, #F4ECFF 0%, #FFE8F2 100%)"

  const accent = mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "#C17D3C" : "#8B3FD8"

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: wizardBg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
      overflowY: "auto",
    }}>
      <div style={{
        width: "100%", maxWidth: 640,
        maxHeight: "calc(100vh - 48px)",
        overflowY: "auto",
        background: "#FFFFFF",
        borderRadius: 20,
        boxShadow: "0 20px 60px rgba(26,10,53,0.18)",
        display: "flex", flexDirection: "column",
        padding: "28px 28px 24px",
        fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
      }}>

        {/* Step dots */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, justifyContent: "center" }}>
          {[2, 3, 4, 5, 6].map(n => (
            <span key={n} style={{
              width: n === step ? 22 : 8, height: 8, borderRadius: 999,
              background: n === step ? accent : "rgba(26,10,53,0.12)",
              transition: "all 0.2s ease",
            }} />
          ))}
        </div>

        {/* Title + description */}
        <div style={{ marginBottom: 18, textAlign: "center" }}>
          <div style={{
            fontSize: "0.70rem", letterSpacing: "0.18em", textTransform: "uppercase",
            color: "rgba(26,10,53,0.35)", marginBottom: 6,
          }}>
            Step {step} of {TOTAL_STEPS}
          </div>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem", color: "#1A0A35",
            margin: "0 0 8px", lineHeight: 1.2,
          }}>
            {current.title}
          </h2>
          <p style={{
            fontSize: "0.86rem", color: "rgba(26,10,53,0.60)",
            lineHeight: 1.6, margin: "0 auto", maxWidth: 480,
          }}>
            {current.description}
          </p>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, overflowY: "auto",
          background: "#FFFFFF",
          border: "1px solid rgba(26,10,53,0.06)",
          borderRadius: 14,
          padding: 16,
          marginBottom: 20,
        }}>
          {step === 2 && <AccountsSettings />}
          {step === 3 && <InboxDisplaySettings />}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <AiRulesSettings />
              <div style={{ borderTop: "1px solid rgba(26,10,53,0.08)" }} />
              <AiSystemPromptSettings data={contextData} />
            </div>
          )}
          {step === 5 && (
            <FullPromptPreview data={contextData} />
          )}
          {step === 6 && (
            <div style={{ textAlign: "center", padding: "24px 8px" }}>
              <div style={{ fontSize: "3rem", marginBottom: 8 }}>
                {mode === "zen" ? "🪷" : mode === "wabi-sabi" ? "✨" : "🎉"}
              </div>
              <p style={{ fontSize: "0.88rem", color: "rgba(26,10,53,0.65)", lineHeight: 1.6, margin: 0 }}>
                {mode === "zen"
                  ? "Your settings are saved. Whenever you're ready, your inbox awaits — sort one email, or none at all."
                  : mode === "wabi-sabi"
                    ? "Everything's saved bestie. Go check ur inbox, it's giving fresh start energy and honestly we love that for you."
                    : "Your settings are saved. Time to dive in and start racking up that inbox karma!"}
              </p>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={goBack}
            disabled={step === 2}
            style={{
              padding: "10px 18px", borderRadius: 999,
              background: "transparent",
              color: step === 2 ? "rgba(26,10,53,0.25)" : "rgba(26,10,53,0.55)",
              border: "1px solid rgba(26,10,53,0.14)",
              fontSize: "0.80rem", fontWeight: 600,
              cursor: step === 2 ? "not-allowed" : "pointer",
              fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
            }}
          >
            {labels.back}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {(step === 2 || step === 4) && (
              <button
                type="button"
                onClick={goNext}
                style={{
                  padding: "10px 18px", borderRadius: 999,
                  background: "transparent",
                  color: "rgba(26,10,53,0.45)",
                  border: "none",
                  fontSize: "0.78rem", fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                }}
              >
                {labels.skip}
              </button>
            )}

            <button
              type="button"
              onClick={goNext}
              style={{
                padding: "10px 26px", borderRadius: 999,
                background: accent, color: "#FFF5E0", border: "none",
                fontSize: "0.84rem", fontWeight: 700, letterSpacing: "0.06em",
                cursor: "pointer",
                boxShadow: `0 4px 16px ${accent}40`,
                fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
              }}
            >
              {step === TOTAL_STEPS ? labels.finish : labels.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

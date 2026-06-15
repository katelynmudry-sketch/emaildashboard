"use client"

import { useState, useEffect } from "react"
import type { PartyMode } from "@/lib/party-mode"
import { markGateSeen } from "@/lib/party-mode"
import { loadSettings, saveSettings, seedIfEmpty } from "@/lib/settings-storage"
import QuoteGate from "./QuoteGate"
import AccountsSettings from "./settings/AccountsSettings"
import InboxDisplaySettings from "./settings/InboxDisplaySettings"
import AiCleanupSettings from "./settings/AiCleanupSettings"
import AiRulesSettings from "./settings/AiRulesSettings"
import AboutYouSettings from "./settings/AboutYouSettings"
import ConnectorsSettings from "./settings/ConnectorsSettings"

interface ContextData {
  systemContext: string
  categorizeInstructions: string
  seedCustom: { personal: string; work: string }
}

interface OnboardingWizardProps {
  onComplete: (mode: PartyMode) => void
}

const TOTAL_STEPS = 5

// Decorative preview of the "inbox as a map of your life" pitch on step 1.
const LIFE_CATEGORIES = [
  { label: "Finances", color: "#00B894" },
  { label: "Family", color: "#FF6B1A" },
  { label: "School", color: "#3B82F6" },
  { label: "Work", color: "#8B3FD8" },
  { label: "Security", color: "#FF1F6E" },
]

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [mode, setMode] = useState<PartyMode | null>(null)
  const [step, setStep] = useState(1)
  const [mounted, setMounted] = useState(false)

  // Seed localStorage with server defaults once a vibe is chosen.
  useEffect(() => {
    if (mode === null) return
    fetch("/api/ai/context")
      .then(r => r.json())
      .then((d: ContextData) => {
        seedIfEmpty({
          personalRules: d.seedCustom.personal,
          workRules: d.seedCustom.work,
        })
        loadSettings()
      })
      .catch(() => {})
  }, [mode])

  // Fade the wizard card in once a vibe is chosen, instead of a hard cut
  // from the dark QuoteGate to the white card.
  useEffect(() => {
    if (mode === null) return
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [mode])

  // ── Vibe picker (full-screen QuoteGate) ─────────────────────────────────
  if (mode === null) {
    return (
      <QuoteGate onEnter={(m) => {
        setMode(m)
        setStep(1)
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
    if (step <= 1) {
      // Back out of the wizard entirely, to the vibe picker.
      setMounted(false)
      setMode(null)
    } else {
      setStep(s => Math.max(s - 1, 1))
    }
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
    1: {
      title: mode === "zen"
        ? "Your inbox, mapped"
        : mode === "wabi-sabi"
          ? "bestie ur inbox is literally everything"
          : "YOUR INBOX = YOUR LIFE",
      description: mode === "zen"
        ? "Your inbox holds more than you think — bills, school notes, family updates, work threads, the quiet logistics of a life. Claude sorts it all into a calm visual map, so you always know where things stand. Find what matters today — a permission slip, a transfer that cleared — and let everything else rest until you're ready. AI-drafted replies are there if you want them, never required."
        : mode === "wabi-sabi"
          ? "Ur inbox is literally running ur whole life rn — money, family group chat, work, AND that school newsletter u definitely skimmed. Claude sorts it ALL into a cute vibe map so u know what's going on — did the field trip form go out? did the e-transfer land? Find whatever ur in the mood for and deal with the rest whenever, no rush. AI can write replies too if u want, total bonus, optional, we love options."
          : "Your inbox is basically your whole life on autopilot — money, family, work, AND those school emails you swear you'll read later. Claude sorts EVERYTHING into a visual map so you never miss the field trip form or the e-transfer that landed. Zoom in on what you care about right now, clear the rest whenever. AI can draft replies too — bonus power-up, totally optional!",
    },
    2: {
      title: mode === "zen"
        ? "Connect & shape your inbox"
        : mode === "wabi-sabi"
          ? "connect ur inboxes & make it cute"
          : "CONNECT & SET UP YOUR INBOX",
      description: mode === "zen"
        ? "Link your personal Gmail to begin — a work account is optional, add it anytime. Then choose what appears in your grid: unread only or everything, archived or not, newest or oldest first. Turn on a few AI cleanup actions if you'd like Claude to quietly flag things like expired promo codes and old security alerts. You can adjust any of this later."
        : mode === "wabi-sabi"
          ? "Connect ur personal Gmail to get started — a work account is totally optional, no pressure, do what feels right. Then pick your vibe: unread only or all of it, archived in or out, newest or oldest first. Also peep the AI cleanup toggles below — they quietly clear out expired codes and old alerts so ur inbox stays cute. Change any of this later, it's giving customizable."
          : "Link your personal Gmail to start sorting — a work inbox is optional, connect it whenever. Choose what shows up in your grid (unread vs. all, archived in or out, newest/oldest), and flip on AI cleanup actions to auto-flag the noise — expired codes, old alerts, delivered packages. Tweak it all anytime in Settings.",
    },
    3: {
      title: mode === "zen"
        ? "More ways in"
        : mode === "wabi-sabi"
          ? "plug in ur connectors bestie"
          : "CONNECT YOUR WORKFLOW",
      description: mode === "zen"
        ? "Connectors automate the small steps after sorting — set a download folder for attachments, or send flagged to-dos to a Google Doc as you read. Optional, and skippable — more connectors are on their way."
        : mode === "wabi-sabi"
          ? "Connectors automate ur whole workflow and ur day — get ur to-do list written as u read ur emails. totally optional, skip if ur not feeling it rn, more connectors coming soon bestie."
          : "Connectors automate your workflow and your day — get your to-do list written as you read your emails. Totally optional, skip for now — more connectors are coming soon!",
    },
    4: {
      title: mode === "zen"
        ? "About you & your dream inbox"
        : mode === "wabi-sabi"
          ? "tell claude ur whole personality"
          : "ABOUT YOU & YOUR DREAM INBOX",
      description: mode === "zen"
        ? "Claude — the AI that quietly sorts and drafts for you — works best when it knows a bit about you and what you'd want your inbox to feel like. Optional, and skippable — the defaults work fine. Let Claude draft an About You from your inbox, describe your dream inbox, and add any per-account rules."
        : mode === "wabi-sabi"
          ? "Claude = the AI doing ur sorting and replies, and it gets way better when it knows ur whole vibe and what ur dream inbox looks like. This step is literally optional, the defaults are already great. Let Claude draft ur About You from ur inbox, describe ur dream inbox, and add any per-account rules, bestie."
          : "Claude is the AI doing all the sorting and drafting — tell it about you and what your dream inbox looks like and it gets even better! Totally optional — defaults work great out of the box. Let Claude draft your About You from your inbox, describe your dream inbox, and add any per-account rules.",
    },
    5: {
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
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}>

        {/* Progress bar */}
        <div style={{
          height: 4, borderRadius: 999, background: "rgba(26,10,53,0.08)",
          marginBottom: 18, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 999,
            width: `${(step / TOTAL_STEPS) * 100}%`,
            background: accent,
            transition: "width 0.3s ease",
          }} />
        </div>

        {/* Title + description */}
        <div style={{ marginBottom: 18, textAlign: "center" }}>
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
          {step === 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", padding: "12px 4px" }}>
              {LIFE_CATEGORIES.map(cat => (
                <div key={cat.label} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 999,
                  border: `1.5px solid ${cat.color}55`,
                  background: `${cat.color}14`,
                  color: "#1A0A35",
                  fontSize: "0.85rem", fontWeight: 600,
                }}>
                  {cat.label}
                </div>
              ))}
            </div>
          )}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <AccountsSettings />
              <div style={{ borderTop: "1px solid rgba(26,10,53,0.08)" }} />
              <InboxDisplaySettings />
              <div style={{ borderTop: "1px solid rgba(26,10,53,0.08)" }} />
              <AiCleanupSettings accentColor={accent} />
            </div>
          )}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <ConnectorsSettings />
            </div>
          )}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <AboutYouSettings />
              <div style={{ borderTop: "1px solid rgba(26,10,53,0.08)" }} />
              <AiRulesSettings />
            </div>
          )}
          {step === 5 && (
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
            style={{
              padding: "10px 18px", borderRadius: 999,
              background: "transparent",
              color: "rgba(26,10,53,0.55)",
              border: "1px solid rgba(26,10,53,0.14)",
              fontSize: "0.80rem", fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
            }}
          >
            {labels.back}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {(step === 2 || step === 3 || step === 4) && (
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

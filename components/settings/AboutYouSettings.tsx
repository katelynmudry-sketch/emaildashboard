"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { getAccounts, type AccountId } from "@/lib/types"
import { loadSettings, saveSettings } from "@/lib/settings-storage"
import { Hint, SectionLabel, SaveOk, TEXTAREA_STYLE } from "./shared"

const SAMPLE_EMAIL = {
  from: "Jamie",
  fromEmail: "jamie@example.com",
  subject: "Quick question about next week",
  body: "Hey! Just wondering if you're free to chat sometime next week — no rush, whenever works for you. Let me know what days are good!",
}

export default function AboutYouSettings() {
  const { data: session } = useSession()
  const accounts = getAccounts(session)
  const hasWork = !!accounts.find(a => a.id === "work")?.email

  const [aboutYouText, setAboutYouText] = useState("")
  const [dreamInboxText, setDreamInboxText] = useState("")
  const [personalDraftTone, setPersonalDraftTone] = useState("")
  const [workDraftTone, setWorkDraftTone] = useState("")
  const [draftToneAccount, setDraftToneAccount] = useState<AccountId>("personal")
  const [saveOk, setSaveOk] = useState(false)

  const [draftingAboutYou, setDraftingAboutYou] = useState(false)
  const [aboutYouError, setAboutYouError] = useState<string | null>(null)

  const [draftingTone, setDraftingTone] = useState(false)
  const [draftToneError, setDraftToneError] = useState<string | null>(null)

  const [demoLoading, setDemoLoading] = useState(false)
  const [demoDraft, setDemoDraft] = useState<string | null>(null)
  const [demoError, setDemoError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = loadSettings()
    setAboutYouText(stored.aboutYouContext)
    setDreamInboxText(stored.dreamInboxContext)
    setPersonalDraftTone(stored.personalDraftTone)
    setWorkDraftTone(stored.workDraftTone)
  }, [])

  function flashSaveOk() {
    setSaveOk(true)
    setTimeout(() => setSaveOk(false), 2500)
  }

  function handleSave() {
    saveSettings({
      aboutYouContext: aboutYouText,
      dreamInboxContext: dreamInboxText,
      personalDraftTone,
      workDraftTone,
    })
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
    e.target.value = ""
  }

  async function handleDraftAboutYou() {
    setDraftingAboutYou(true)
    setAboutYouError(null)
    try {
      const res = await fetch("/api/ai/about-you", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: draftToneAccount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to draft About You")
      if (data.aboutYou) setAboutYouText(data.aboutYou)
    } catch (err) {
      setAboutYouError(err instanceof Error ? err.message : "Failed to draft About You")
    } finally {
      setDraftingAboutYou(false)
    }
  }

  async function handleDraftTone() {
    setDraftingTone(true)
    setDraftToneError(null)
    try {
      const res = await fetch("/api/ai/about-you", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: draftToneAccount, target: "draftTone" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to draft reply tone")
      if (data.draftTone) {
        if (draftToneAccount === "work") setWorkDraftTone(data.draftTone)
        else setPersonalDraftTone(data.draftTone)
      }
    } catch (err) {
      setDraftToneError(err instanceof Error ? err.message : "Failed to draft reply tone")
    } finally {
      setDraftingTone(false)
    }
  }

  async function handleDemoDraft() {
    setDemoLoading(true)
    setDemoError(null)
    setDemoDraft(null)
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: SAMPLE_EMAIL,
          systemContext: loadSettings().systemContext || undefined,
          aboutYouContext: aboutYouText || undefined,
          dreamInboxContext: dreamInboxText || undefined,
          draftTone: (draftToneAccount === "work" ? workDraftTone : personalDraftTone) || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to generate demo draft")
      setDemoDraft(data.draft ?? "")
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "Failed to generate demo draft")
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Hint>
        This context is sent to Claude on every refresh — it shapes how emails are categorized,
        sorted, and drafted.
      </Hint>

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
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleDraftAboutYou}
            disabled={draftingAboutYou}
            style={{
              padding: "7px 16px", borderRadius: 999,
              background: "rgba(139,63,216,0.10)", color: "#8B3FD8",
              border: "1px solid rgba(139,63,216,0.30)",
              fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.04em",
              cursor: draftingAboutYou ? "default" : "pointer",
              opacity: draftingAboutYou ? 0.6 : 1,
              fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
            }}
          >
            {draftingAboutYou ? "Reading your inbox…" : "✨ Let Claude draft this from my inbox"}
          </button>
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
        {aboutYouError && (
          <p style={{ fontSize: "0.76rem", color: "#E1306C", marginTop: 6 }}>{aboutYouError}</p>
        )}
      </div>

      {/* ── Dream Inbox ── */}
      <div>
        <SectionLabel color="#FF6B1A">Describe your Dream Inbox</SectionLabel>
        <Hint>
          What do you NEED to see? What do you often miss? Which people or companies are priority?
          This feeds how categories are proposed and what gets flagged as urgent.
          (Tip: try voice-to-text for this one.)
        </Hint>
        <div style={{ marginTop: 8 }}>
          <textarea
            value={dreamInboxText}
            onChange={e => setDreamInboxText(e.target.value)}
            rows={5}
            placeholder="e.g. I never want to miss an email from my accountant or my landlord. I usually miss appointment reminders — flag those as urgent. I don't care about marketing emails at all."
            style={TEXTAREA_STYLE}
          />
        </div>
      </div>

      {/* ── Draft tone (per account) ── */}
      <div>
        <SectionLabel color="#00C4A7">Reply tone</SectionLabel>
        <Hint>
          Optional — describe how you want AI-drafted replies to sound for this account
          (e.g. &ldquo;casual and short, sign off with just my first name&rdquo; or
          &ldquo;professional but warm, sign off with my full name and title&rdquo;).
        </Hint>

        {hasWork && (
          <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 8 }}>
            {accounts.map(acc => (
              <button
                key={acc.id}
                type="button"
                onClick={() => setDraftToneAccount(acc.id)}
                style={{
                  padding: "5px 14px", borderRadius: 999,
                  border: draftToneAccount === acc.id ? "1px solid #00C4A7" : "1px solid rgba(26,10,53,0.14)",
                  background: draftToneAccount === acc.id ? "rgba(0,196,167,0.10)" : "transparent",
                  color: draftToneAccount === acc.id ? "#00A88A" : "rgba(26,10,53,0.55)",
                  fontSize: "0.74rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "capitalize",
                  cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                }}
              >
                {acc.id === "work" ? "Work" : "Personal"}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: hasWork ? 0 : 8 }}>
          <textarea
            value={draftToneAccount === "work" ? workDraftTone : personalDraftTone}
            onChange={e => draftToneAccount === "work" ? setWorkDraftTone(e.target.value) : setPersonalDraftTone(e.target.value)}
            rows={3}
            placeholder="e.g. Friendly and brief — a sentence or two is fine. I usually sign off with 'Thanks, Kate'."
            style={TEXTAREA_STYLE}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={handleDraftTone}
            disabled={draftingTone}
            style={{
              padding: "7px 16px", borderRadius: 999,
              background: "rgba(0,196,167,0.10)", color: "#00A88A",
              border: "1px solid rgba(0,196,167,0.30)",
              fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.04em",
              cursor: draftingTone ? "default" : "pointer",
              opacity: draftingTone ? 0.6 : 1,
              fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
            }}
          >
            {draftingTone ? "Reading your sent mail…" : "✨ Let Claude draft this from my sent emails"}
          </button>
        </div>
        {draftToneError && (
          <p style={{ fontSize: "0.76rem", color: "#E1306C", marginTop: 6 }}>{draftToneError}</p>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={handleSave} style={{
          padding: "9px 24px", borderRadius: 999,
          background: "#FF1F6E", color: "#1A0A35", border: "none",
          fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
          cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
          boxShadow: "0 4px 16px rgba(255,31,110,0.30)",
        }}>
          Save
        </button>
        <SaveOk show={saveOk} />
      </div>

      {/* ── Demo draft ── */}
      <div style={{ borderTop: "1px solid rgba(26,10,53,0.08)", paddingTop: 16 }}>
        <SectionLabel color="#8B3FD8">See it in action</SectionLabel>
        <Hint>
          Save your About You / Dream Inbox / tone above, then preview a sample AI-drafted reply
          using that context.
        </Hint>
        <button
          type="button"
          onClick={handleDemoDraft}
          disabled={demoLoading}
          style={{
            marginTop: 8,
            padding: "7px 16px", borderRadius: 999,
            background: "rgba(139,63,216,0.10)", color: "#8B3FD8",
            border: "1px solid rgba(139,63,216,0.30)",
            fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.04em",
            cursor: demoLoading ? "default" : "pointer",
            opacity: demoLoading ? 0.6 : 1,
            fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
          }}
        >
          {demoLoading ? "Drafting…" : "✨ Show me a sample reply"}
        </button>

        {demoError && (
          <p style={{ fontSize: "0.76rem", color: "#E1306C", marginTop: 6 }}>{demoError}</p>
        )}

        {demoDraft !== null && (
          <div style={{ marginTop: 12 }}>
            <div style={{
              borderRadius: 8, border: "1px solid rgba(26,10,53,0.10)",
              background: "rgba(26,10,53,0.03)", padding: "10px 12px",
              fontSize: "0.78rem", color: "rgba(26,10,53,0.50)", marginBottom: 6,
            }}>
              <strong>Sample email</strong> — From: {SAMPLE_EMAIL.from} · Subject: {SAMPLE_EMAIL.subject}
              <div style={{ marginTop: 4, fontStyle: "italic" }}>&ldquo;{SAMPLE_EMAIL.body}&rdquo;</div>
            </div>
            <div style={{
              borderRadius: 8, border: "1px solid rgba(0,196,167,0.25)",
              background: "rgba(0,229,196,0.06)", padding: "10px 12px",
              fontSize: "0.82rem", color: "#1A0A35", lineHeight: 1.6, whiteSpace: "pre-wrap",
            }}>
              {demoDraft || "(empty draft)"}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

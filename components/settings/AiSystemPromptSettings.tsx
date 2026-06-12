"use client"

import { useState, useEffect, useRef } from "react"
import { loadSettings, saveSettings } from "@/lib/settings-storage"
import { Hint, SectionLabel, SaveOk, TEXTAREA_STYLE } from "./shared"

interface ContextData {
  systemContext: string
  categorizeInstructions: string
  seedCustom: { personal: string; work: string }
}

interface SuggestedChange {
  section: "personalRules" | "workRules" | "systemContext" | "aboutYouContext"
  label: string
  newText: string
  applied?: boolean
  discarded?: boolean
}

interface ChatMsg {
  role: "user" | "claude" | "error"
  text: string
  changes?: SuggestedChange[]
}

interface Props {
  data: ContextData | null
}

export default function AiSystemPromptSettings({ data }: Props) {
  // System prompt state — blank until the user writes or uploads their own.
  // Never pre-filled from the server default, which is shared across all accounts.
  const [systemContextText, setSystemContextText] = useState("")
  const [saveOk, setSaveOk] = useState(false)

  // Chat state
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = loadSettings()
    setSystemContextText(stored.systemContext || "")
  }, [data])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMsgs, chatLoading])

  function flashSaveOk() {
    setSaveOk(true)
    setTimeout(() => setSaveOk(false), 2500)
  }

  function handleSaveSystemContext() {
    saveSettings({ systemContext: systemContextText })
    flashSaveOk()
  }

  function handleLoadDefault() {
    if (!data) return
    setSystemContextText(data.systemContext)
  }

  function handleClearSystemContext() {
    setSystemContextText("")
    saveSettings({ systemContext: "" })
    flashSaveOk()
  }

  function handleContextFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") setSystemContextText(reader.result)
    }
    reader.readAsText(file)
    // Reset so the same file can be re-selected later
    e.target.value = ""
  }

  // Apply a suggested change from the chat editor
  function applyChange(msgIdx: number, changeIdx: number) {
    const change = chatMsgs[msgIdx]?.changes?.[changeIdx]
    if (!change) return

    if (change.section === "personalRules") {
      saveSettings({ personalRules: change.newText })
    } else if (change.section === "workRules") {
      saveSettings({ workRules: change.newText })
    } else if (change.section === "systemContext") {
      setSystemContextText(change.newText)
      saveSettings({ systemContext: change.newText })
    } else if (change.section === "aboutYouContext") {
      saveSettings({ aboutYouContext: change.newText })
    }

    setChatMsgs(prev => {
      const msgs = [...prev]
      const msg = { ...msgs[msgIdx] }
      const changes = msg.changes ? [...msg.changes] : []
      changes[changeIdx] = { ...changes[changeIdx], applied: true }
      msg.changes = changes
      msgs[msgIdx] = msg
      return msgs
    })
  }

  function discardChange(msgIdx: number, changeIdx: number) {
    setChatMsgs(prev => {
      const msgs = [...prev]
      const msg = { ...msgs[msgIdx] }
      const changes = msg.changes ? [...msg.changes] : []
      changes[changeIdx] = { ...changes[changeIdx], discarded: true }
      msg.changes = changes
      msgs[msgIdx] = msg
      return msgs
    })
  }

  async function sendChatMessage() {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    setChatInput("")
    setChatMsgs(prev => [...prev, { role: "user", text }])
    setChatLoading(true)

    try {
      const stored = loadSettings()
      const res = await fetch("/api/ai/edit-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userRequest: text,
          currentPersonalRules: stored.personalRules,
          currentWorkRules: stored.workRules,
          currentSystemContext: stored.systemContext || systemContextText,
          currentAboutYouContext: stored.aboutYouContext,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }))
        setChatMsgs(prev => [...prev, { role: "error", text: err.error ?? "Something went wrong" }])
        return
      }

      const result = await res.json() as { explanation: string; changes: SuggestedChange[] }
      setChatMsgs(prev => [...prev, {
        role: "claude",
        text: result.explanation,
        changes: result.changes,
      }])
    } catch {
      setChatMsgs(prev => [...prev, { role: "error", text: "Network error — please try again" }])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── System prompt editor ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Hint>
          The full system prompt Claude receives — tone, summary style, group logic. This is empty by
          default (a generic prompt is used). Write your own, upload a file, or ask Claude to draft one
          in the <strong>Chat Editor</strong> below. Your version is saved only in your browser and is
          never shared with other accounts.
        </Hint>

        <div>
          <SectionLabel color="#8B3FD8">Your system prompt</SectionLabel>
          <textarea
            value={systemContextText}
            onChange={e => setSystemContextText(e.target.value)}
            rows={16}
            placeholder="Leave blank to use the generic default, or describe how you'd like Claude to triage your inbox — tone, summary style, anything personal it should know…"
            style={TEXTAREA_STYLE}
          />
          <div style={{ marginTop: 6, display: "flex", gap: 14 }}>
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
              onChange={handleContextFile}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={handleLoadDefault}
              style={{
                background: "none", border: "none", padding: 0,
                color: "rgba(26,10,53,0.50)", fontSize: "0.76rem", fontWeight: 600,
                cursor: "pointer", textDecoration: "underline",
                fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
              }}
            >
              Load generic default as a starting point
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={handleSaveSystemContext} style={{
            padding: "9px 24px", borderRadius: 999,
            background: "#8B3FD8", color: "#FFF5E0", border: "none",
            fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
            cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
            boxShadow: "0 4px 16px rgba(139,63,216,0.30)",
          }}>
            Save Context
          </button>
          <button onClick={handleClearSystemContext} style={{
            padding: "9px 16px", borderRadius: 999,
            background: "rgba(26,10,53,0.06)", color: "rgba(26,10,53,0.65)",
            border: "1px solid rgba(26,10,53,0.14)",
            fontSize: "0.82rem", fontWeight: 600,
            cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
          }}>
            Clear
          </button>
          <SaveOk show={saveOk} />
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ borderTop: "1px solid rgba(26,10,53,0.08)" }} />

      {/* ── Chat editor ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SectionLabel color="#8B3FD8">Chat Editor</SectionLabel>
        <Hint>
          Describe what you want changed in plain English. Claude will suggest the exact edit — review it,
          then <strong>Apply</strong> or <strong>Discard</strong> before anything is saved.
        </Hint>

        {/* Chat window */}
        <div style={{
          borderRadius: 12,
          border: "1px solid rgba(139,63,216,0.20)",
          background: "rgba(139,63,216,0.03)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          {/* Chat history */}
          <div style={{
            padding: "12px 14px",
            display: "flex", flexDirection: "column", gap: 12,
            minHeight: 120, maxHeight: 420, overflowY: "auto",
          }}>
            {chatMsgs.length === 0 && (
              <p style={{ fontSize: "0.78rem", color: "rgba(26,10,53,0.38)", fontStyle: "italic", margin: 0 }}>
                Try: &ldquo;Always flag emails from Dr. Aishwarya as urgent&rdquo; or &ldquo;Add a rule that patient appointment requests go in Confirmed Appointments&rdquo;
              </p>
            )}

            {chatMsgs.map((msg, msgIdx) => (
              <div key={msgIdx} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                {/* Avatar */}
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.7rem", fontWeight: 700,
                  background: msg.role === "user"
                    ? "rgba(255,208,0,0.25)"
                    : msg.role === "error"
                    ? "rgba(255,31,110,0.15)"
                    : "rgba(139,63,216,0.20)",
                  color: msg.role === "user" ? "#92660A" : msg.role === "error" ? "#D4005A" : "#8B3FD8",
                }}>
                  {msg.role === "user" ? "K" : msg.role === "error" ? "!" : "AI"}
                </div>

                {/* Bubble */}
                <div style={{
                  padding: "8px 10px", borderRadius: 8,
                  fontSize: "0.80rem", lineHeight: 1.55,
                  maxWidth: "calc(100% - 36px)",
                  background: msg.role === "user"
                    ? "rgba(255,208,0,0.14)"
                    : msg.role === "error"
                    ? "rgba(255,31,110,0.08)"
                    : "rgba(139,63,216,0.10)",
                  color: msg.role === "error" ? "#D4005A" : "#1A0A35",
                }}>
                  <p style={{ margin: 0 }}>{msg.text}</p>

                  {/* Diff cards */}
                  {msg.changes && msg.changes.map((change, changeIdx) => (
                    <div
                      key={changeIdx}
                      style={{
                        marginTop: 10,
                        borderRadius: 8,
                        border: change.applied
                          ? "1px solid rgba(0,196,167,0.50)"
                          : change.discarded
                          ? "1px solid rgba(26,10,53,0.10)"
                          : "1px solid rgba(0,196,167,0.30)",
                        background: change.applied
                          ? "rgba(0,196,167,0.10)"
                          : change.discarded
                          ? "rgba(26,10,53,0.03)"
                          : "rgba(0,196,167,0.06)",
                        overflow: "hidden",
                        opacity: change.discarded ? 0.5 : 1,
                      }}
                    >
                      {/* Diff header */}
                      <div style={{
                        padding: "5px 10px",
                        fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                        color: change.applied ? "#00A88A" : change.discarded ? "rgba(26,10,53,0.45)" : "#00C4A7",
                        background: change.applied ? "rgba(0,196,167,0.14)" : "rgba(0,196,167,0.10)",
                        display: "flex", justifyContent: "space-between",
                      }}>
                        <span>
                          {change.applied ? "✓ Applied — " : change.discarded ? "✕ Discarded — " : "Suggested — "}
                          {change.label}
                        </span>
                      </div>

                      {/* New text preview */}
                      <div style={{
                        padding: "8px 10px",
                        fontSize: "0.75rem", fontFamily: "ui-monospace, Consolas, monospace",
                        whiteSpace: "pre-wrap", color: "rgba(26,10,53,0.80)", lineHeight: 1.55,
                        maxHeight: 160, overflowY: "auto",
                      }}>
                        {change.newText}
                      </div>

                      {/* Apply / Discard */}
                      {!change.applied && !change.discarded && (
                        <div style={{
                          padding: "7px 10px",
                          display: "flex", gap: 6,
                          borderTop: "1px solid rgba(0,196,167,0.15)",
                        }}>
                          <button
                            onClick={() => applyChange(msgIdx, changeIdx)}
                            style={{
                              padding: "4px 14px", borderRadius: 99,
                              background: "#00C4A7", color: "#fff",
                              border: "none", fontSize: "0.72rem", fontWeight: 700,
                              cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                            }}
                          >
                            ✓ Apply
                          </button>
                          <button
                            onClick={() => discardChange(msgIdx, changeIdx)}
                            style={{
                              padding: "4px 14px", borderRadius: 99,
                              background: "rgba(26,10,53,0.07)", color: "rgba(26,10,53,0.65)",
                              border: "none", fontSize: "0.72rem", fontWeight: 600,
                              cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                            }}
                          >
                            ✕ Discard
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {chatLoading && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: "rgba(139,63,216,0.20)", color: "#8B3FD8",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
                }}>AI</div>
                <div style={{
                  padding: "10px 12px", borderRadius: "8px 8px 2px 8px",
                  background: "rgba(139,63,216,0.10)",
                  display: "flex", gap: 4, alignItems: "center",
                }}>
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: "rgba(139,63,216,0.50)",
                      display: "inline-block",
                      animation: `bounce 1.2s ${delay}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input row */}
          <div style={{
            display: "flex", gap: 6, padding: "8px 10px",
            borderTop: "1px solid rgba(139,63,216,0.12)",
            background: "rgba(26,10,53,0.02)",
          }}>
            <textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
              placeholder="e.g. Add a rule to always flag patient replies as urgent…"
              rows={2}
              style={{
                flex: 1, border: "1px solid rgba(26,10,53,0.14)",
                borderRadius: 8, padding: "7px 10px",
                fontSize: "0.80rem", color: "#1A0A35",
                background: "#fff", resize: "none", outline: "none",
                fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
              }}
            />
            <button
              onClick={sendChatMessage}
              disabled={chatLoading || !chatInput.trim()}
              style={{
                padding: "8px 14px", borderRadius: 8,
                background: chatLoading || !chatInput.trim() ? "rgba(139,63,216,0.30)" : "#8B3FD8",
                color: "#FFF5E0", border: "none",
                fontSize: "0.78rem", fontWeight: 700,
                cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                alignSelf: "flex-end",
                fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                transition: "background 0.15s",
              }}
            >
              {chatLoading ? "…" : "Send →"}
            </button>
          </div>
        </div>
      </div>

      {/* Bounce animation for typing indicator */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  )
}

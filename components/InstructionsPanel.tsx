"use client"

import { useState, useEffect, useRef } from "react"
import { loadSettings, saveSettings, seedIfEmpty } from "@/lib/settings-storage"
import {
  getSaveFolderHandle,
  pickSaveFolder,
  clearSaveFolderHandle,
  isFsaSupported,
} from "@/lib/save-folder"

interface ContextData {
  systemContext: string
  categorizeInstructions: string
  seedCustom: { personal: string; work: string }
}

interface SuggestedChange {
  section: "personalRules" | "workRules" | "systemContext"
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
  open: boolean
  onClose: () => void
}

type Tab = "custom" | "context" | "chat" | "raw"

// ── Shared style constants ────────────────────────────────────────────────────

const TEXTAREA_STYLE: React.CSSProperties = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid rgba(26,10,53,0.14)",
  background: "rgba(26,10,53,0.03)",
  padding: "10px 12px",
  fontSize: "0.82rem",
  lineHeight: 1.65,
  color: "#1A0A35",
  fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
  resize: "vertical",
  outline: "none",
  transition: "border-color 0.15s",
}

const CODE_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  borderRadius: 8,
  border: "1px solid rgba(26,10,53,0.10)",
  background: "rgba(26,10,53,0.03)",
  padding: "12px 14px",
  fontSize: "0.76rem",
  lineHeight: 1.7,
  color: "rgba(26,10,53,0.80)",
  fontFamily: "ui-monospace, 'Cascadia Code', Consolas, monospace",
  whiteSpace: "pre-wrap",
  overflowY: "auto",
  maxHeight: 420,
  userSelect: "all",
}

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      display: "block",
      fontSize: "0.72rem", fontWeight: 700,
      letterSpacing: "0.10em", textTransform: "uppercase",
      color, marginBottom: 6,
    }}>
      {children}
    </span>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "0.78rem", color: "rgba(26,10,53,0.55)", lineHeight: 1.6, margin: 0 }}>
      {children}
    </p>
  )
}

function SaveOk({ show }: { show: boolean }) {
  if (!show) return null
  return <span style={{ fontSize: "0.78rem", color: "#00C4A7", fontWeight: 600 }}>✓ Saved!</span>
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InstructionsPanel({ open, onClose }: Props) {
  const [data, setData] = useState<ContextData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>("custom")

  // Custom rules state
  const [personalText, setPersonalText] = useState("")
  const [workText, setWorkText] = useState("")
  const [saveOk, setSaveOk] = useState<Tab | null>(null)

  // AI action toggles
  const [aiPastEventDelete, setAiPastEventDelete] = useState(true)
  const [aiDeliveryChainCleanup, setAiDeliveryChainCleanup] = useState(true)

  // TODO export (beta)
  const [todoExportEnabled, setTodoExportEnabled] = useState(false)
  const [todoExportDocName, setTodoExportDocName] = useState("")
  const [todoExportUrlInput, setTodoExportUrlInput] = useState("")
  const [todoExportSaveOk, setTodoExportSaveOk] = useState(false)

  // System context state
  const [systemContextText, setSystemContextText] = useState("")

  // Save folder state (per account)
  const [personalFolderName, setPersonalFolderName] = useState<string | null>(null)
  const [workFolderName, setWorkFolderName] = useState<string | null>(null)
  const [folderPickBusy, setFolderPickBusy] = useState<"personal" | "work" | null>(null)
  const fsaSupported = isFsaSupported()

  // Chat state
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load on open
  useEffect(() => {
    if (!open) return
    // Load save folder names from IndexedDB
    getSaveFolderHandle("personal").then(h => setPersonalFolderName(h?.name ?? null)).catch(() => {})
    getSaveFolderHandle("work").then(h => setWorkFolderName(h?.name ?? null)).catch(() => {})
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
        // Load from localStorage (source of truth)
        const stored = loadSettings()
        setPersonalText(stored.personalRules)
        setWorkText(stored.workRules)
        setSystemContextText(stored.systemContext || d.systemContext)
        setAiPastEventDelete(stored.aiPastEventDelete !== false)
        setAiDeliveryChainCleanup(stored.aiDeliveryChainCleanup !== false)
        setTodoExportEnabled(stored.todoExportEnabled === true)
        setTodoExportDocName(stored.todoExportDocName)
        setTodoExportUrlInput(stored.todoExportDocName ? stored.todoExportDocId : "")
      })
      .finally(() => setLoading(false))
  }, [open])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMsgs, chatLoading])

  function flashSaveOk(t: Tab) {
    setSaveOk(t)
    setTimeout(() => setSaveOk(null), 2500)
  }

  function handleSaveCustomRules() {
    saveSettings({ personalRules: personalText, workRules: workText })
    flashSaveOk("custom")
  }

  function handleSaveTodoExportDoc() {
    const input = todoExportUrlInput.trim()
    const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/)
    const docId = match ? match[1] : input
    if (!docId) return
    setTodoExportDocName(docId)
    saveSettings({ todoExportDocId: docId, todoExportDocName: docId })
    setTodoExportSaveOk(true)
    setTimeout(() => setTodoExportSaveOk(false), 2500)
  }

  function handleToggleTodoExport() {
    const next = !todoExportEnabled
    setTodoExportEnabled(next)
    saveSettings({ todoExportEnabled: next })
  }

  function handleSaveSystemContext() {
    saveSettings({ systemContext: systemContextText })
    flashSaveOk("context")
  }

  function handleResetSystemContext() {
    if (!data) return
    setSystemContextText(data.systemContext)
    saveSettings({ systemContext: "" })
    flashSaveOk("context")
  }

  async function handlePickFolder(account: "personal" | "work") {
    setFolderPickBusy(account)
    try {
      const handle = await pickSaveFolder(account)
      if (handle) {
        if (account === "personal") setPersonalFolderName(handle.name)
        else setWorkFolderName(handle.name)
      }
    } finally {
      setFolderPickBusy(null)
    }
  }

  async function handleClearFolder(account: "personal" | "work") {
    await clearSaveFolderHandle(account)
    if (account === "personal") setPersonalFolderName(null)
    else setWorkFolderName(null)
  }

  // Apply a suggested change from the chat editor
  function applyChange(msgIdx: number, changeIdx: number) {
    // 1. Read the change before mutating state
    const change = chatMsgs[msgIdx]?.changes?.[changeIdx]
    if (!change) return

    // 2. Persist to localStorage and sync textarea state (side-effects outside updater)
    if (change.section === "personalRules") {
      setPersonalText(change.newText)
      saveSettings({ personalRules: change.newText })
    } else if (change.section === "workRules") {
      setWorkText(change.newText)
      saveSettings({ workRules: change.newText })
    } else if (change.section === "systemContext") {
      setSystemContextText(change.newText)
      saveSettings({ systemContext: change.newText })
    }

    // 3. Mark applied in chat history (pure state update, no side-effects)
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
          currentPersonalRules: stored.personalRules || personalText,
          currentWorkRules: stored.workRules || workText,
          currentSystemContext: stored.systemContext || systemContextText,
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

  if (!open) return null

  const tabs: { id: Tab; label: string }[] = [
    { id: "custom",  label: "✏️ Custom Rules" },
    { id: "context", label: "🧠 AI Context" },
    { id: "chat",    label: "💬 Chat Editor" },
    { id: "raw",     label: "📋 Full Prompt" },
  ]

  const assembled = data ? [
    "[SYSTEM CONTEXT]\n" + (systemContextText || data.systemContext),
    personalText ? `[PERSONAL RULES]\n${personalText}` : null,
    workText ? `[WORK RULES]\n${workText}` : null,
    `[CATEGORIZE INSTRUCTIONS]\n${data.categorizeInstructions}`,
    "\n[EMAIL LIST]\n<your emails are appended here at runtime>",
  ].filter(Boolean).join("\n\n---\n\n") : ""

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

          {/* ── Tab: Custom Rules ── */}
          {!loading && tab === "custom" && (
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
                    <button
                      type="button"
                      onClick={() => {
                        const next = !value
                        set(next)
                        saveSettings({ [key]: next })
                      }}
                      style={{
                        flexShrink: 0,
                        width: 36, height: 20, borderRadius: 99,
                        background: value ? "#8B3FD8" : "rgba(26,10,53,0.15)",
                        border: "none", cursor: "pointer", padding: 0,
                        position: "relative", transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute", top: 2,
                        left: value ? 18 : 2,
                        width: 16, height: 16, borderRadius: "50%",
                        background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                        transition: "left 0.2s",
                        display: "block",
                      }} />
                    </button>
                    <div>
                      <div style={{ fontSize: "0.80rem", fontWeight: 600, color: "#1A0A35", lineHeight: 1.3 }}>{label}</div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(26,10,53,0.50)", marginTop: 1 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── TODO Export (beta) ── */}
              <div style={{ background: "rgba(0,196,167,0.04)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(0,196,167,0.12)" }}>
                <SectionLabel color="#00A88A">TODO Export (beta)</SectionLabel>
                <p style={{ fontSize: "0.75rem", color: "rgba(26,10,53,0.50)", margin: "0 0 10px", lineHeight: 1.5 }}>
                  When you flag an email as a TODO, append a line to a Google Doc with the subject, sender, and a link back to the email.
                </p>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={handleToggleTodoExport}
                    style={{
                      flexShrink: 0,
                      width: 36, height: 20, borderRadius: 99,
                      background: todoExportEnabled ? "#00C4A7" : "rgba(26,10,53,0.15)",
                      border: "none", cursor: "pointer", padding: 0,
                      position: "relative", transition: "background 0.2s",
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 2,
                      left: todoExportEnabled ? 18 : 2,
                      width: 16, height: 16, borderRadius: "50%",
                      background: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                      transition: "left 0.2s",
                      display: "block",
                    }} />
                  </button>
                  <div>
                    <div style={{ fontSize: "0.80rem", fontWeight: 600, color: "#1A0A35", lineHeight: 1.3 }}>Enable TODO export</div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(26,10,53,0.50)", marginTop: 1 }}>
                      {todoExportDocName ? `Currently exporting to doc: ${todoExportDocName}` : "No doc selected yet — paste a Google Doc link below."}
                    </div>
                  </div>
                </div>
                {todoExportEnabled && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <input
                      type="text"
                      value={todoExportUrlInput}
                      onChange={e => setTodoExportUrlInput(e.target.value)}
                      placeholder="Paste Google Doc URL or ID"
                      style={{
                        flex: "1 1 240px",
                        borderRadius: 8,
                        border: "1px solid rgba(26,10,53,0.14)",
                        background: "rgba(26,10,53,0.03)",
                        padding: "8px 10px",
                        fontSize: "0.78rem",
                        color: "#1A0A35",
                        fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                        outline: "none",
                      }}
                    />
                    <button onClick={handleSaveTodoExportDoc} style={{
                      padding: "8px 18px", borderRadius: 999,
                      background: "#00C4A7", color: "#0D0821", border: "none",
                      fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                      cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                    }}>
                      Save Doc
                    </button>
                    {todoExportSaveOk && <SaveOk show />}
                  </div>
                )}
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
                <SaveOk show={saveOk === "custom"} />
              </div>

              {/* ── Save folder settings ── */}
              <div style={{
                borderTop: "1px solid rgba(26,10,53,0.08)",
                paddingTop: 18,
                display: "flex", flexDirection: "column", gap: 12,
              }}>
                <div>
                  <SectionLabel color="#8B3FD8">📁 Download save location</SectionLabel>
                  <Hint>
                    Pick a folder for each account. Attachments will save there automatically — no browser prompt each time.
                    Leave blank to use the standard browser download instead.
                  </Hint>
                </div>

                {!fsaSupported && (
                  <div style={{
                    background: "rgba(255,165,0,0.08)", border: "1px solid rgba(255,165,0,0.30)",
                    borderRadius: 8, padding: "9px 12px",
                    fontSize: "0.76rem", color: "rgba(26,10,53,0.72)", lineHeight: 1.6,
                  }}>
                    ⚠️ Your browser doesn&apos;t support the File System Access API. Use Chrome or Edge for automatic folder saving.
                  </div>
                )}

                {fsaSupported && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Personal folder row */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 8,
                      background: "rgba(255,31,110,0.04)", border: "1px solid rgba(255,31,110,0.12)",
                    }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#FF1F6E", minWidth: 72 }}>
                        Personal
                      </span>
                      <span style={{
                        flex: 1, fontSize: "0.80rem",
                        color: personalFolderName ? "#1A0A35" : "rgba(26,10,53,0.38)",
                        fontFamily: personalFolderName ? "ui-monospace, Consolas, monospace" : "inherit",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {personalFolderName ? `📁 ${personalFolderName}` : "No folder set — uses browser download"}
                      </span>
                      <button
                        onClick={() => handlePickFolder("personal")}
                        disabled={folderPickBusy !== null}
                        style={{
                          padding: "5px 14px", borderRadius: 999, flexShrink: 0,
                          background: folderPickBusy === "personal" ? "rgba(255,31,110,0.30)" : "#FF1F6E",
                          color: "#fff", border: "none",
                          fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                          cursor: folderPickBusy !== null ? "not-allowed" : "pointer",
                          fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                        }}
                      >
                        {folderPickBusy === "personal" ? "…" : "Set folder"}
                      </button>
                      {personalFolderName && (
                        <button
                          onClick={() => handleClearFolder("personal")}
                          style={{
                            padding: "5px 10px", borderRadius: 999, flexShrink: 0,
                            background: "rgba(26,10,53,0.06)", color: "rgba(26,10,53,0.55)",
                            border: "1px solid rgba(26,10,53,0.14)",
                            fontSize: "0.72rem", fontWeight: 600,
                            cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Work folder row */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 8,
                      background: "rgba(255,107,26,0.04)", border: "1px solid rgba(255,107,26,0.12)",
                    }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#FF6B1A", minWidth: 72 }}>
                        Work
                      </span>
                      <span style={{
                        flex: 1, fontSize: "0.80rem",
                        color: workFolderName ? "#1A0A35" : "rgba(26,10,53,0.38)",
                        fontFamily: workFolderName ? "ui-monospace, Consolas, monospace" : "inherit",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {workFolderName ? `📁 ${workFolderName}` : "No folder set — uses browser download"}
                      </span>
                      <button
                        onClick={() => handlePickFolder("work")}
                        disabled={folderPickBusy !== null}
                        style={{
                          padding: "5px 14px", borderRadius: 999, flexShrink: 0,
                          background: folderPickBusy === "work" ? "rgba(255,107,26,0.30)" : "#FF6B1A",
                          color: "#fff", border: "none",
                          fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                          cursor: folderPickBusy !== null ? "not-allowed" : "pointer",
                          fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                        }}
                      >
                        {folderPickBusy === "work" ? "…" : "Set folder"}
                      </button>
                      {workFolderName && (
                        <button
                          onClick={() => handleClearFolder("work")}
                          style={{
                            padding: "5px 10px", borderRadius: 999, flexShrink: 0,
                            background: "rgba(26,10,53,0.06)", color: "rgba(26,10,53,0.55)",
                            border: "1px solid rgba(26,10,53,0.14)",
                            fontSize: "0.72rem", fontWeight: 600,
                            cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: AI Context ── */}
          {!loading && tab === "context" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Hint>
                The full system prompt Claude receives — tone, summary style, group logic. Your edits override
                the default on every refresh and are saved in your browser.
                Or ask Claude to edit it in the <strong>💬 Chat Editor</strong> tab.
              </Hint>

              <div>
                <SectionLabel color="#8B3FD8">System prompt (CLINIC_CONTEXT)</SectionLabel>
                <textarea
                  value={systemContextText}
                  onChange={e => setSystemContextText(e.target.value)}
                  rows={16}
                  style={TEXTAREA_STYLE}
                />
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
                <button onClick={handleResetSystemContext} style={{
                  padding: "9px 16px", borderRadius: 999,
                  background: "rgba(26,10,53,0.06)", color: "rgba(26,10,53,0.65)",
                  border: "1px solid rgba(26,10,53,0.14)",
                  fontSize: "0.82rem", fontWeight: 600,
                  cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                }}>
                  Reset to default
                </button>
                <SaveOk show={saveOk === "context"} />
              </div>
            </div>
          )}

          {/* ── Tab: Chat Editor ── */}
          {!loading && tab === "chat" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
          )}

          {/* ── Tab: Full Prompt ── */}
          {!loading && tab === "raw" && data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Hint>
                The complete prompt assembled for Claude — system context + your rules + categorize instructions.
                The email list is appended at runtime. Read-only; edit in the other tabs.
              </Hint>
              <SectionLabel color="#8B3FD8">Assembled prompt (preview)</SectionLabel>
              <pre style={CODE_STYLE}>{assembled}</pre>
            </div>
          )}

        </div>
      </div>

      {/* Bounce animation for typing indicator */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

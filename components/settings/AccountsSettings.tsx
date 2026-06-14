"use client"

import { useState, useEffect } from "react"
import { useSession, signIn } from "next-auth/react"
import { getAccounts } from "@/lib/types"
import type { AccountId, AccountConfig } from "@/lib/types"
import { loadSettings, saveSettings } from "@/lib/settings-storage"
import {
  getSaveFolderHandle,
  pickSaveFolder,
  clearSaveFolderHandle,
  isFsaSupported,
} from "@/lib/save-folder"
import { Hint, SectionLabel, SaveOk, ToggleSwitch } from "./shared"

export default function AccountsSettings() {
  const { data: session, update } = useSession()
  const accounts = getAccounts(session)
  const [swapping, setSwapping] = useState(false)

  // Editable account labels (click a label below to rename — defaults to "Personal"/"Work")
  const [editingLabelId, setEditingLabelId] = useState<AccountId | null>(null)
  const [labelDraft, setLabelDraft] = useState("")

  // TODO export (beta)
  const [todoExportEnabled, setTodoExportEnabled] = useState(false)
  const [todoExportUrlInput, setTodoExportUrlInput] = useState("")
  const [todoExportUrlInputWork, setTodoExportUrlInputWork] = useState("")
  const [todoExportSaveOk, setTodoExportSaveOk] = useState(false)
  const [todoExportSaveOkWork, setTodoExportSaveOkWork] = useState(false)

  // Save folder state (per account)
  const [personalFolderName, setPersonalFolderName] = useState<string | null>(null)
  const [workFolderName, setWorkFolderName] = useState<string | null>(null)
  const [folderPickBusy, setFolderPickBusy] = useState<"personal" | "work" | null>(null)
  const fsaSupported = isFsaSupported()

  useEffect(() => {
    const stored = loadSettings()
    setTodoExportEnabled(stored.todoExportEnabled === true)
    setTodoExportUrlInput(stored.todoExportDocIdPersonal)
    setTodoExportUrlInputWork(stored.todoExportDocIdWork)

    getSaveFolderHandle("personal").then(h => setPersonalFolderName(h?.name ?? null)).catch(() => {})
    getSaveFolderHandle("work").then(h => setWorkFolderName(h?.name ?? null)).catch(() => {})
  }, [])

  function parseDocId(input: string): string {
    const trimmed = input.trim()
    const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : trimmed
  }

  function handleSaveTodoExportDoc() {
    const docId = parseDocId(todoExportUrlInput)
    if (!docId) return
    saveSettings({ todoExportDocIdPersonal: docId })
    setTodoExportSaveOk(true)
    setTimeout(() => setTodoExportSaveOk(false), 2500)
  }

  function handleSaveTodoExportDocWork() {
    const docId = parseDocId(todoExportUrlInputWork)
    if (!docId) return
    saveSettings({ todoExportDocIdWork: docId })
    setTodoExportSaveOkWork(true)
    setTimeout(() => setTodoExportSaveOkWork(false), 2500)
  }

  function handleToggleTodoExport() {
    const next = !todoExportEnabled
    setTodoExportEnabled(next)
    saveSettings({ todoExportEnabled: next })
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

  function handleRerunSetupWizard() {
    saveSettings({ onboardingComplete: false })
    window.location.reload()
  }

  function startEditingLabel(acc: AccountConfig) {
    setLabelDraft(acc.label)
    setEditingLabelId(acc.id)
  }

  function commitLabel(id: AccountId) {
    const trimmed = labelDraft.trim()
    if (id === "personal") saveSettings({ accountLabelPersonal: trimmed })
    else saveSettings({ accountLabelWork: trimmed })
    setEditingLabelId(null)
  }

  async function handleSwapAccounts() {
    setSwapping(true)
    try {
      await update({ swapAccounts: true })
      window.location.reload()
    } catch {
      setSwapping(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Connect accounts ── */}
      <div>
        <SectionLabel color="#8B3FD8">Connect accounts</SectionLabel>
        <Hint>Click a name below to rename it — defaults to &quot;Personal&quot; and &quot;Work&quot;.</Hint>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 8,
              background: acc.id === "personal" ? "rgba(255,31,110,0.04)" : "rgba(255,107,26,0.04)",
              border: `1px solid ${acc.id === "personal" ? "rgba(255,31,110,0.12)" : "rgba(255,107,26,0.12)"}`,
            }}>
              {editingLabelId === acc.id ? (
                <input
                  type="text"
                  autoFocus
                  value={labelDraft}
                  onChange={e => setLabelDraft(e.target.value)}
                  onBlur={() => commitLabel(acc.id)}
                  onKeyDown={e => {
                    if (e.key === "Enter") commitLabel(acc.id)
                    if (e.key === "Escape") setEditingLabelId(null)
                  }}
                  maxLength={24}
                  style={{
                    fontSize: "0.78rem", fontWeight: 600,
                    color: acc.id === "personal" ? "#FF1F6E" : "#FF6B1A",
                    minWidth: 60, width: 100,
                    border: `1px solid ${acc.id === "personal" ? "rgba(255,31,110,0.30)" : "rgba(255,107,26,0.30)"}`,
                    borderRadius: 6, padding: "2px 6px",
                    background: "#fff", outline: "none",
                    fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEditingLabel(acc)}
                  title="Click to rename this account"
                  style={{
                    fontSize: "0.78rem", fontWeight: 600,
                    color: acc.id === "personal" ? "#FF1F6E" : "#FF6B1A",
                    minWidth: 60, textAlign: "left",
                    background: "none", border: "none", padding: 0,
                    cursor: "pointer",
                    fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                  }}
                >
                  {acc.label}
                </button>
              )}
              <span style={{
                flex: 1, fontSize: "0.80rem",
                color: acc.email ? "#1A0A35" : "rgba(26,10,53,0.38)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {acc.email || "Not connected"}
              </span>
            </div>
          ))}
        </div>

        {!session?.workAccountLinked && (
          <button
            type="button"
            onClick={() =>
              signIn(
                "google",
                { redirectTo: typeof window !== "undefined" ? window.location.pathname : "/" },
                { prompt: "select_account consent" },
              )
            }
            style={{
              marginTop: 10,
              padding: "9px 24px", borderRadius: 999,
              background: "#8B3FD8", color: "#FFF5E0", border: "none",
              fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
              cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
              boxShadow: "0 4px 16px rgba(139,63,216,0.30)",
            }}
          >
            Connect second Gmail
          </button>
        )}

        {session?.workAccountLinked && (
          <>
            <button
              type="button"
              onClick={handleSwapAccounts}
              disabled={swapping}
              style={{
                marginTop: 10,
                padding: "9px 24px", borderRadius: 999,
                background: "rgba(139,63,216,0.08)", color: "#8B3FD8",
                border: "1px solid rgba(139,63,216,0.30)",
                fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
                cursor: swapping ? "wait" : "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                opacity: swapping ? 0.6 : 1,
              }}
            >
              {swapping ? "Swapping…" : "⇄ Swap personal & work"}
            </button>
            <Hint>
              Picked the wrong one as &quot;personal&quot; during setup? This swaps which account is which everywhere in the app — including per-account rules, save folders, and TODO docs.
            </Hint>
          </>
        )}
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

      {/* ── TODO Export (beta) ── */}
      <div style={{
        borderTop: "1px solid rgba(26,10,53,0.08)",
        paddingTop: 18,
      }}>
        <div style={{ background: "rgba(0,196,167,0.04)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(0,196,167,0.12)" }}>
          <SectionLabel color="#00A88A">TODO Export (beta)</SectionLabel>
          <p style={{ fontSize: "0.75rem", color: "rgba(26,10,53,0.50)", margin: "0 0 10px", lineHeight: 1.5 }}>
            When you flag an email as a TODO, append a line to a Google Doc with the subject, sender, and a link back to the email.
          </p>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
            <ToggleSwitch checked={todoExportEnabled} onChange={handleToggleTodoExport} activeColor="#00C4A7" />
            <div>
              <div style={{ fontSize: "0.80rem", fontWeight: 600, color: "#1A0A35", lineHeight: 1.3 }}>Enable TODO export</div>
              <div style={{ fontSize: "0.72rem", color: "rgba(26,10,53,0.50)", marginTop: 1 }}>
                Each account exports to its own Google Doc — set them below.
              </div>
            </div>
          </div>
          {todoExportEnabled && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#FF1F6E", minWidth: 72 }}>
                  Personal
                </span>
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
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#FF6B1A", minWidth: 72 }}>
                  Work
                </span>
                <input
                  type="text"
                  value={todoExportUrlInputWork}
                  onChange={e => setTodoExportUrlInputWork(e.target.value)}
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
                <button onClick={handleSaveTodoExportDocWork} style={{
                  padding: "8px 18px", borderRadius: 999,
                  background: "#00C4A7", color: "#0D0821", border: "none",
                  fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                  cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
                }}>
                  Save Doc
                </button>
                {todoExportSaveOkWork && <SaveOk show />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Re-run setup wizard ── */}
      <div style={{
        borderTop: "1px solid rgba(26,10,53,0.08)",
        paddingTop: 18,
      }}>
        <button
          type="button"
          onClick={handleRerunSetupWizard}
          style={{
            padding: "9px 16px", borderRadius: 999,
            background: "rgba(26,10,53,0.06)", color: "rgba(26,10,53,0.65)",
            border: "1px solid rgba(26,10,53,0.14)",
            fontSize: "0.82rem", fontWeight: 600,
            cursor: "pointer", fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
          }}
        >
          ↻ Re-run setup wizard
        </button>
      </div>
    </div>
  )
}

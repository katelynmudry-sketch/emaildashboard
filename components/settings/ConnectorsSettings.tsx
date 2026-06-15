"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { loadSettings, saveSettings } from "@/lib/settings-storage"
import { openDocPicker } from "@/lib/google-picker"
import {
  getSaveFolderHandle,
  pickSaveFolder,
  clearSaveFolderHandle,
  isFsaSupported,
} from "@/lib/save-folder"
import { Hint, SectionLabel, ToggleSwitch } from "./shared"

type AccountId = "personal" | "work"

const RECONNECT_HINT = "Couldn't access Google Drive — reconnect this account in Settings → Accounts."

interface DocRowProps {
  account: AccountId
  label: string
  color: string
  docId: string
  docName: string
  busy: boolean
  error?: string
  disabled?: boolean
  disabledHint?: string
  onChoose: (account: AccountId) => void
  onCreate: (account: AccountId) => void
  onClear: (account: AccountId) => void
}

function DocRow({ account, label, color, docId, docName, busy, error, disabled, disabledHint, onChoose, onCreate, onClear }: DocRowProps) {
  const buttonBase = {
    padding: "8px 16px", borderRadius: 999, border: "none",
    fontSize: "0.74rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" as const,
    fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
    cursor: disabled || busy ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 600, color, minWidth: 72 }}>{label}</span>
        {docId ? (
          <>
            <a
              href={`https://docs.google.com/document/d/${docId}/edit`}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: "1 1 180px", fontSize: "0.80rem", color: "#1A0A35",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                textDecoration: "none",
              }}
            >
              📄 {docName || "Untitled document"}
            </a>
            <button
              type="button"
              onClick={() => onChoose(account)}
              disabled={busy || disabled}
              style={{ ...buttonBase, background: "rgba(26,10,53,0.06)", color: "rgba(26,10,53,0.65)", border: "1px solid rgba(26,10,53,0.14)" }}
            >
              {busy ? "…" : "Change"}
            </button>
            <button
              type="button"
              onClick={() => onClear(account)}
              disabled={busy || disabled}
              style={{ ...buttonBase, background: "rgba(26,10,53,0.06)", color: "rgba(26,10,53,0.65)", border: "1px solid rgba(26,10,53,0.14)" }}
            >
              Clear
            </button>
          </>
        ) : (
          <>
            <span style={{ flex: "1 1 140px", fontSize: "0.80rem", color: "rgba(26,10,53,0.38)" }}>
              No document selected
            </span>
            <button
              type="button"
              onClick={() => onChoose(account)}
              disabled={busy || disabled}
              style={{ ...buttonBase, background: "#00C4A7", color: "#0D0821" }}
            >
              {busy ? "…" : "📂 Choose from Drive"}
            </button>
            <button
              type="button"
              onClick={() => onCreate(account)}
              disabled={busy || disabled}
              style={{ ...buttonBase, background: "rgba(0,196,167,0.12)", color: "#00A88A", border: "1px solid rgba(0,196,167,0.30)" }}
            >
              {busy ? "…" : "+ New Doc"}
            </button>
          </>
        )}
      </div>
      {disabled && disabledHint && <Hint>{disabledHint}</Hint>}
      {error && (
        <div style={{ fontSize: "0.72rem", color: "#FF1F6E", lineHeight: 1.4 }}>{error}</div>
      )}
    </div>
  )
}

export default function ConnectorsSettings() {
  const { data: session } = useSession()

  // TODO export (beta)
  const [todoExportEnabled, setTodoExportEnabled] = useState(false)
  const [docIdPersonal, setDocIdPersonal] = useState("")
  const [docNamePersonal, setDocNamePersonal] = useState("")
  const [docIdWork, setDocIdWork] = useState("")
  const [docNameWork, setDocNameWork] = useState("")
  const [docBusy, setDocBusy] = useState<AccountId | null>(null)
  const [docError, setDocError] = useState<Partial<Record<AccountId, string>>>({})

  // Save folder state (per account)
  const [personalFolderName, setPersonalFolderName] = useState<string | null>(null)
  const [workFolderName, setWorkFolderName] = useState<string | null>(null)
  const [folderPickBusy, setFolderPickBusy] = useState<"personal" | "work" | null>(null)
  const fsaSupported = isFsaSupported()

  useEffect(() => {
    const stored = loadSettings()
    setTodoExportEnabled(stored.todoExportEnabled === true)
    setDocIdPersonal(stored.todoExportDocIdPersonal)
    setDocNamePersonal(stored.todoExportDocNamePersonal)
    setDocIdWork(stored.todoExportDocIdWork)
    setDocNameWork(stored.todoExportDocNameWork)

    getSaveFolderHandle("personal").then(h => setPersonalFolderName(h?.name ?? null)).catch(() => {})
    getSaveFolderHandle("work").then(h => setWorkFolderName(h?.name ?? null)).catch(() => {})
  }, [])

  function handleToggleTodoExport() {
    const next = !todoExportEnabled
    setTodoExportEnabled(next)
    saveSettings({ todoExportEnabled: next })
  }

  function accessTokenFor(account: AccountId): string | undefined {
    return account === "work" ? session?.work_access_token : session?.access_token
  }

  function saveDoc(account: AccountId, id: string, name: string) {
    if (account === "personal") {
      setDocIdPersonal(id)
      setDocNamePersonal(name)
      saveSettings({ todoExportDocIdPersonal: id, todoExportDocNamePersonal: name })
    } else {
      setDocIdWork(id)
      setDocNameWork(name)
      saveSettings({ todoExportDocIdWork: id, todoExportDocNameWork: name })
    }
  }

  function handleClearDoc(account: AccountId) {
    saveDoc(account, "", "")
  }

  async function handleChooseDoc(account: AccountId) {
    const accessToken = accessTokenFor(account)
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY
    if (!accessToken || !apiKey) {
      setDocError(prev => ({ ...prev, [account]: RECONNECT_HINT }))
      return
    }

    setDocBusy(account)
    setDocError(prev => ({ ...prev, [account]: undefined }))
    try {
      const picked = await openDocPicker(accessToken, apiKey)
      if (picked) saveDoc(account, picked.id, picked.name)
    } catch {
      setDocError(prev => ({ ...prev, [account]: RECONNECT_HINT }))
    } finally {
      setDocBusy(null)
    }
  }

  async function handleCreateDoc(account: AccountId) {
    const accessToken = accessTokenFor(account)
    if (!accessToken) {
      setDocError(prev => ({ ...prev, [account]: RECONNECT_HINT }))
      return
    }

    setDocBusy(account)
    setDocError(prev => ({ ...prev, [account]: undefined }))
    try {
      const label = account === "personal" ? "Personal" : "Work"
      const res = await fetch("/api/docs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, name: `Email Party TODOs — ${label}` }),
      })
      if (!res.ok) throw new Error("Create failed")
      const data = (await res.json()) as { id: string; name: string }
      saveDoc(account, data.id, data.name)
    } catch {
      setDocError(prev => ({ ...prev, [account]: RECONNECT_HINT }))
    } finally {
      setDocBusy(null)
    }
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Hint>
        Connectors automate your workflow and your day — get your to-do list written as you read your emails.
      </Hint>

      {/* ── Save folder settings ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
      <div style={{ borderTop: "1px solid rgba(26,10,53,0.08)", paddingTop: 18 }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <DocRow
                account="personal"
                label="Personal"
                color="#FF1F6E"
                docId={docIdPersonal}
                docName={docNamePersonal}
                busy={docBusy === "personal"}
                error={docError.personal}
                onChoose={handleChooseDoc}
                onCreate={handleCreateDoc}
                onClear={handleClearDoc}
              />
              <DocRow
                account="work"
                label="Work"
                color="#FF6B1A"
                docId={docIdWork}
                docName={docNameWork}
                busy={docBusy === "work"}
                error={docError.work}
                disabled={!session?.workAccountLinked}
                disabledHint="Connect a work account first."
                onChoose={handleChooseDoc}
                onCreate={handleCreateDoc}
                onClear={handleClearDoc}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Coming soon ── */}
      <div style={{ borderTop: "1px solid rgba(26,10,53,0.08)", paddingTop: 18 }}>
        <SectionLabel color="rgba(26,10,53,0.45)">More connectors</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { icon: "📓", name: "Notion", desc: "Send TODOs and summaries to a Notion database." },
            { icon: "📅", name: "Calendar", desc: "Auto-add events detected in your inbox." },
          ].map(c => (
            <div key={c.name} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(26,10,53,0.03)", border: "1px solid rgba(26,10,53,0.08)",
              opacity: 0.65,
            }}>
              <span style={{ fontSize: "1.2rem" }}>{c.icon}</span>
              <div>
                <div style={{ fontSize: "0.80rem", fontWeight: 600, color: "#1A0A35" }}>{c.name}</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(26,10,53,0.50)" }}>{c.desc}</div>
              </div>
              <span style={{
                marginLeft: "auto", fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: "rgba(26,10,53,0.40)",
                border: "1px solid rgba(26,10,53,0.14)", borderRadius: 999, padding: "3px 8px",
              }}>
                Coming soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

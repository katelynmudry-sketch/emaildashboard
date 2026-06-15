"use client"

import { useState } from "react"
import { useSession, signIn } from "next-auth/react"
import { getAccounts } from "@/lib/types"
import type { AccountId, AccountConfig } from "@/lib/types"
import { saveSettings } from "@/lib/settings-storage"
import { Hint, SectionLabel } from "./shared"

export default function AccountsSettings() {
  const { data: session, update } = useSession()
  const accounts = getAccounts(session)
  const [swapping, setSwapping] = useState(false)

  // Editable account labels (click a label below to rename — defaults to "Personal"/"Work")
  const [editingLabelId, setEditingLabelId] = useState<AccountId | null>(null)
  const [labelDraft, setLabelDraft] = useState("")

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

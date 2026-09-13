"use client"

import { useState, useEffect } from "react"
import { loadSettings, saveSettings } from "@/lib/settings-storage"
import { Hint, SectionLabel, SaveOk, TEXTAREA_STYLE } from "./shared"
import AiCleanupSettings from "./AiCleanupSettings"

interface CategorizationRule {
  id: string
  description: string
  fromPattern?: string
  subjectPattern?: string
  category: string
  createdAt: string
}

interface Props {
  showCleanupActions?: boolean
}

export default function AiRulesSettings({ showCleanupActions = true }: Props) {
  const [personalText, setPersonalText] = useState("")
  const [workText, setWorkText] = useState("")
  const [saveOk, setSaveOk] = useState(false)

  const [keywordRules, setKeywordRules] = useState<CategorizationRule[]>([])
  const [newKeyword, setNewKeyword] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [rulesLoading, setRulesLoading] = useState(true)
  const [addingRule, setAddingRule] = useState(false)

  useEffect(() => {
    const stored = loadSettings()
    setPersonalText(stored.personalRules)
    setWorkText(stored.workRules)

    fetch("/api/rules")
      .then(r => r.json())
      .then((data: { rules: CategorizationRule[] }) => {
        setKeywordRules((data.rules ?? []).filter(r => !!r.subjectPattern))
      })
      .catch(() => {})
      .finally(() => setRulesLoading(false))
  }, [])

  function flashSaveOk() {
    setSaveOk(true)
    setTimeout(() => setSaveOk(false), 2500)
  }

  function handleSaveCustomRules() {
    saveSettings({ personalRules: personalText, workRules: workText })
    flashSaveOk()
  }

  async function handleAddKeywordRule() {
    const keyword = newKeyword.trim()
    const category = newCategory.trim()
    if (!keyword || !category) return

    setAddingRule(true)
    const rule: CategorizationRule = {
      id: `keyword:${keyword.toLowerCase()}->${category.toLowerCase()}`,
      description: `Subject contains "${keyword}" → ${category}`,
      subjectPattern: keyword,
      category,
      createdAt: new Date().toISOString(),
    }
    try {
      await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      })
      setKeywordRules(prev => [...prev.filter(r => r.id !== rule.id), rule])
      setNewKeyword("")
      setNewCategory("")
    } finally {
      setAddingRule(false)
    }
  }

  async function handleDeleteKeywordRule(id: string) {
    setKeywordRules(prev => prev.filter(r => r.id !== id))
    await fetch("/api/rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Hint>
        Short rules injected into Claude&apos;s prompt on every refresh. Changes apply on the next load.
      </Hint>

      {/* ── AI Actions ── */}
      {showCleanupActions && <AiCleanupSettings />}

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
        <SaveOk show={saveOk} />
      </div>

      <div>
        <SectionLabel color="#7C3AED">Keyword rules (applies to both accounts, always)</SectionLabel>
        <Hint>
          Pin a subject keyword to a category so it always wins over the AI&apos;s own judgment —
          e.g. any subject containing &quot;horoscope&quot; goes to Astrology instead of Newsletters.
          Works for any category, not just this example.
        </Hint>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {rulesLoading ? (
            <Hint>Loading rules…</Hint>
          ) : keywordRules.length === 0 ? (
            <Hint>No keyword rules yet.</Hint>
          ) : (
            keywordRules.map(rule => (
              <div key={rule.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                padding: "8px 12px", borderRadius: 8,
                background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.14)",
              }}>
                <span style={{ fontSize: "0.80rem", color: "#1A0A35" }}>
                  Subject contains <strong>&quot;{rule.subjectPattern}&quot;</strong> → <strong>{rule.category}</strong>
                </span>
                <button
                  onClick={() => handleDeleteKeywordRule(rule.id)}
                  aria-label="Delete rule"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(26,10,53,0.45)", fontSize: "0.9rem", lineHeight: 1, padding: 4,
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={newKeyword}
            onChange={e => setNewKeyword(e.target.value)}
            placeholder="keyword, e.g. horoscope"
            style={{ ...TEXTAREA_STYLE, width: "auto", flex: "1 1 160px", padding: "8px 10px" }}
          />
          <input
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            placeholder="category, e.g. Astrology"
            style={{ ...TEXTAREA_STYLE, width: "auto", flex: "1 1 160px", padding: "8px 10px" }}
          />
          <button
            onClick={handleAddKeywordRule}
            disabled={addingRule || !newKeyword.trim() || !newCategory.trim()}
            style={{
              padding: "8px 18px", borderRadius: 999,
              background: "#7C3AED", color: "#fff", border: "none",
              fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
              cursor: addingRule ? "not-allowed" : "pointer",
              opacity: addingRule || !newKeyword.trim() || !newCategory.trim() ? 0.5 : 1,
              fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
            }}
          >
            Add rule
          </button>
        </div>
      </div>
    </div>
  )
}

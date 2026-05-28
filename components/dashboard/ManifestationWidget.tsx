"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ManifestationContent } from "@/lib/types"
import type { ThemeConfig } from "./theme-config"

const COLOR_MAP: Record<string, string> = {
  "--gold":   "#C8960C",
  "--rose":   "#FF1F6E",
  "--teal":   "#00C4A7",
  "--purple": "#8B3FD8",
  "--orange": "#FF6B1A",
  "--lime":   "#8FC900",
}

interface ManifestationContent_WithMoon extends ManifestationContent {
  moonPhase?: string
}

interface ManifestationWidgetProps {
  theme: ThemeConfig
}

export default function ManifestationWidget({ theme }: ManifestationWidgetProps) {
  const [content, setContent] = useState<ManifestationContent_WithMoon | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<ManifestationContent | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const isAltar = theme.id === "morning-altar"
  const isFestival = theme.id === "festival-stage"
  const isWabi = theme.id === "wabi-sabi-studio"

  useEffect(() => {
    fetch("/api/dashboard/manifestation")
      .then(r => r.json())
      .then(d => { setContent(d); setDraft(d) })
      .catch(err => console.error("[ManifestationWidget]", err))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = useCallback(async () => {
    if (!draft) return
    setSaving(true)
    try {
      await fetch("/api/dashboard/manifestation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      setContent(prev => ({ ...draft, moonPhase: prev?.moonPhase }))
      setEditMode(false)
    } catch (err) {
      console.error("[ManifestationWidget] save:", err)
    } finally {
      setSaving(false)
    }
  }, [draft])

  const handlePhotoUpload = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(",")[1]
        const mediaType = file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif"
        const res = await fetch("/api/dashboard/manifestation/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        })
        if (!res.ok) throw new Error("extraction failed")
        const extracted = await res.json() as ManifestationContent
        setContent(prev => ({ ...extracted, moonPhase: prev?.moonPhase }))
        setDraft(extracted)
        setEditMode(false)
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error("[ManifestationWidget] upload:", err)
      setUploading(false)
    }
  }, [])

  const isEmpty = !content?.yearIntention && (!content?.callingIn || content.callingIn.every(c => !c.text))

  // Moon phase display
  const moon = content?.moonPhase
  const moonEmoji = getMoonEmoji(moon ?? "")

  return (
    <div style={{
      background: theme.cardBg,
      border: theme.cardBorder,
      borderRadius: theme.cardRadius,
      boxShadow: theme.cardShadow,
      padding: theme.cardPadding,
      minHeight: "220px",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "14px",
        paddingBottom: "12px",
        borderBottom: theme.sectionDivider,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ ...theme.labelStyle }}>
            {isFestival ? "INTENTIONS" : "Intentions"}
          </div>
          {moon && (
            <span title={moon} style={{
              fontSize: "0.95rem",
              opacity: 0.7,
              cursor: "help",
            }}>{moonEmoji}</span>
          )}
        </div>
        {/* Action buttons */}
        <div style={{ display: "flex", gap: "5px" }}>
          {!editMode && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={chipBtn(theme.accentColor, isFestival, uploading, theme.bodyFont)}
              >
                {uploading ? "reading…" : "📷"}
              </button>
              <button
                onClick={() => { setDraft(content); setEditMode(true) }}
                style={chipBtn(theme.accentColor, isFestival, false, theme.bodyFont)}
              >
                ✏️
              </button>
            </>
          )}
          {editMode && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: theme.accentColor,
                  border: "none",
                  borderRadius: isFestival ? "4px" : "20px",
                  padding: "3px 12px",
                  fontSize: "0.72rem",
                  cursor: saving ? "wait" : "pointer",
                  color: "#FFFFFF",
                  fontFamily: isFestival ? "'Bebas Neue', sans-serif" : theme.bodyFont,
                  letterSpacing: isFestival ? "0.1em" : undefined,
                }}
              >
                {saving ? "saving…" : isFestival ? "SAVE" : "save"}
              </button>
              <button
                onClick={() => { setDraft(content); setEditMode(false) }}
                style={chipBtn("rgba(0,0,0,0.35)", isFestival, false, theme.bodyFont)}
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }}
      />

      {/* Loading skeleton */}
      {loading && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "9px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: "22px", borderRadius: theme.cardRadius,
              background: "linear-gradient(90deg, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.025) 50%, rgba(0,0,0,0.05) 75%)",
              backgroundSize: "200% 100%", animation: "db-shimmer 1.4s infinite",
            }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && isEmpty && !editMode && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          {isAltar ? (
            <>
              <div style={{ fontSize: "2.2rem", opacity: 0.5 }}>✦</div>
              <p style={{
                textAlign: "center", color: "#1A0A35", opacity: 0.38,
                fontSize: "0.95rem", fontStyle: "italic",
                fontFamily: theme.titleFont, margin: 0, lineHeight: 1.5,
              }}>
                Upload a journal page<br />to illuminate your intentions
              </p>
            </>
          ) : isFestival ? (
            <>
              <div style={{ fontSize: "1.8rem" }}>📋</div>
              <p style={{
                textAlign: "center", color: "#1A0A35", opacity: 0.38,
                fontSize: "0.78rem", fontFamily: theme.bodyFont, margin: 0,
                letterSpacing: "0.08em", textTransform: "uppercase",
              }}>
                Upload a journal photo<br />or type your intentions
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: "1.8rem", opacity: 0.4 }}>○</div>
              <p style={{
                textAlign: "center", color: "#1A0A35", opacity: 0.38,
                fontSize: "0.8rem", fontFamily: theme.bodyFont, margin: 0,
              }}>
                Upload a journal photo or type<br />your intentions to begin
              </p>
            </>
          )}
        </div>
      )}

      {/* View mode */}
      {!loading && !isEmpty && !editMode && content && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
          {content.yearIntention && (
            <div style={{
              fontFamily: theme.titleFont,
              fontSize: isAltar ? "1.05rem" : isFestival ? "0.95rem" : "0.9rem",
              color: "#1A0A35",
              fontStyle: isAltar ? "italic" : "normal",
              lineHeight: 1.45,
              borderLeft: `2px solid ${theme.accentColor}55`,
              paddingLeft: "12px",
            }}>
              {isAltar ? `"${content.yearIntention}"` : content.yearIntention}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {content.callingIn.filter(c => c.text).map((item, i) => {
              const color = COLOR_MAP[item.color] ?? "#8B3FD8"
              return (
                <div key={i} style={{
                  padding: isFestival ? "3px 10px" : "4px 12px",
                  borderRadius: isFestival ? "4px" : "20px",
                  background: `${color}15`,
                  border: isFestival ? `1.5px solid ${color}` : `1px solid ${color}35`,
                  fontSize: "0.78rem",
                  fontFamily: theme.bodyFont,
                  color: "#1A0A35",
                  letterSpacing: isFestival ? "0.06em" : undefined,
                }}>
                  <span style={{ color, fontWeight: 700, marginRight: "4px" }}>
                    {isFestival ? item.tag.toUpperCase() : item.tag}
                  </span>
                  {item.text}
                </div>
              )
            })}
          </div>
          {/* Moon phase line if set */}
          {moon && (
            <div style={{
              fontSize: "0.73rem",
              fontFamily: theme.bodyFont,
              color: "#1A0A35",
              opacity: 0.4,
              fontStyle: isAltar ? "italic" : "normal",
              marginTop: "auto",
              paddingTop: "8px",
              borderTop: theme.sectionDivider,
            }}>
              {moonEmoji} {moon}
            </div>
          )}
        </div>
      )}

      {/* Edit mode */}
      {!loading && editMode && draft && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "9px" }}>
          <input
            value={draft.yearIntention}
            onChange={e => setDraft(d => d ? { ...d, yearIntention: e.target.value } : d)}
            placeholder={isAltar ? "Your year intention or affirmation…" : "Year intention…"}
            style={{
              width: "100%", padding: "8px 10px",
              border: `1px solid ${theme.accentColor}40`,
              borderRadius: isFestival ? "4px" : "8px",
              fontSize: isAltar ? "0.92rem" : "0.88rem",
              fontFamily: theme.titleFont,
              fontStyle: isAltar ? "italic" : "normal",
              color: "#1A0A35", background: "transparent",
              outline: "none", boxSizing: "border-box",
            }}
          />
          {draft.callingIn.map((item, i) => {
            const color = COLOR_MAP[item.color] ?? "#8B3FD8"
            return (
              <div key={i} style={{ display: "flex", gap: "7px", alignItems: "center" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0, background: color }} />
                <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#1A0A35", minWidth: "68px", fontFamily: theme.bodyFont }}>
                  {item.tag}
                </span>
                <input
                  value={item.text}
                  onChange={e => setDraft(d => {
                    if (!d) return d
                    const ci = [...d.callingIn]
                    ci[i] = { ...ci[i], text: e.target.value }
                    return { ...d, callingIn: ci }
                  })}
                  placeholder={`${item.tag}…`}
                  style={{
                    flex: 1, padding: "5px 8px",
                    border: `1px solid rgba(0,0,0,0.10)`,
                    borderRadius: isFestival ? "4px" : "6px",
                    fontSize: "0.81rem",
                    color: "#1A0A35", background: "transparent",
                    outline: "none", fontFamily: theme.bodyFont,
                  }}
                />
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes db-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}

function chipBtn(color: string, isFestival: boolean, disabled: boolean, font: string): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${color}50`,
    borderRadius: isFestival ? "4px" : "20px",
    padding: "3px 9px",
    fontSize: "0.72rem",
    cursor: disabled ? "wait" : "pointer",
    color,
    fontFamily: font,
    opacity: disabled ? 0.5 : 1,
  }
}

function getMoonEmoji(phase: string): string {
  const p = phase.toLowerCase()
  if (p.includes("new"))             return "🌑"
  if (p.includes("waxing crescent")) return "🌒"
  if (p.includes("first quarter"))   return "🌓"
  if (p.includes("waxing gibbous"))  return "🌔"
  if (p.includes("full"))            return "🌕"
  if (p.includes("waning gibbous"))  return "🌖"
  if (p.includes("last quarter") || p.includes("third quarter")) return "🌗"
  if (p.includes("waning crescent")) return "🌘"
  return "🌙"
}

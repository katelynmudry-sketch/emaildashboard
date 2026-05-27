"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ManifestationContent } from "@/lib/types"
import type { ThemeConfig } from "./theme-config"

const COLOR_MAP: Record<string, string> = {
  "--gold": "#C8960C",
  "--rose": "#FF1F6E",
  "--teal": "#00C4A7",
  "--purple": "#8B3FD8",
  "--orange": "#FF6B1A",
  "--lime": "#8FC900",
}

interface ManifestationWidgetProps {
  theme: ThemeConfig
}

export default function ManifestationWidget({ theme }: ManifestationWidgetProps) {
  const [content, setContent] = useState<ManifestationContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<ManifestationContent | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/dashboard/manifestation")
      .then(r => r.json())
      .then(d => {
        setContent(d)
        setDraft(d)
      })
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
      setContent(draft)
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
        const extracted = await res.json() as ManifestationContent
        if (!res.ok) throw new Error("extraction failed")
        setContent(extracted)
        setDraft(extracted)
        setEditMode(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error("[ManifestationWidget] upload:", err)
    } finally {
      setUploading(false)
    }
  }, [])

  const isEmpty = !content?.yearIntention && (!content?.callingIn || content.callingIn.every(c => !c.text))

  return (
    <div style={{
      background: theme.cardBg,
      border: theme.cardBorder,
      borderRadius: theme.cardRadius,
      boxShadow: theme.cardShadow,
      padding: "20px",
      minHeight: "220px",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div style={theme.labelStyle}>Intentions</div>
        <div style={{ display: "flex", gap: "6px" }}>
          {!editMode && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{
                  background: "transparent",
                  border: `1px solid ${theme.accentColor}40`,
                  borderRadius: "20px",
                  padding: "3px 10px",
                  fontSize: "0.72rem",
                  cursor: uploading ? "wait" : "pointer",
                  color: theme.accentColor,
                  fontFamily: "inherit",
                }}
              >
                {uploading ? "reading…" : "📷 upload"}
              </button>
              <button
                onClick={() => { setDraft(content); setEditMode(true) }}
                style={{
                  background: "transparent",
                  border: `1px solid ${theme.accentColor}40`,
                  borderRadius: "20px",
                  padding: "3px 10px",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                  color: theme.accentColor,
                  fontFamily: "inherit",
                }}
              >
                ✏️ edit
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
                  borderRadius: "20px",
                  padding: "3px 12px",
                  fontSize: "0.72rem",
                  cursor: saving ? "wait" : "pointer",
                  color: "#FFFFFF",
                  fontFamily: "inherit",
                }}
              >
                {saving ? "saving…" : "save"}
              </button>
              <button
                onClick={() => { setDraft(content); setEditMode(false) }}
                style={{
                  background: "transparent",
                  border: `1px solid rgba(0,0,0,0.15)`,
                  borderRadius: "20px",
                  padding: "3px 10px",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                  color: "#1A0A35",
                  opacity: 0.6,
                  fontFamily: "inherit",
                }}
              >
                cancel
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
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handlePhotoUpload(f)
        }}
      />

      {loading && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: "24px", borderRadius: "8px",
              background: "linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.03) 50%, rgba(0,0,0,0.06) 75%)",
              backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
            }} />
          ))}
        </div>
      )}

      {!loading && isEmpty && !editMode && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          <div style={{ fontSize: "2rem" }}>✨</div>
          <p style={{ textAlign: "center", color: "#1A0A35", opacity: 0.45, fontSize: "0.85rem", fontStyle: "italic", margin: 0 }}>
            Upload a journal photo or type<br />your intentions to get started
          </p>
        </div>
      )}

      {/* View mode */}
      {!loading && !isEmpty && !editMode && content && (
        <div style={{ flex: 1 }}>
          {content.yearIntention && (
            <div style={{
              fontFamily: theme.titleFont,
              fontSize: "1.05rem",
              color: "#1A0A35",
              fontStyle: "italic",
              marginBottom: "12px",
              lineHeight: 1.4,
            }}>
              "{content.yearIntention}"
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {content.callingIn.filter(c => c.text).map((item, i) => (
              <div key={i} style={{
                padding: "4px 12px",
                borderRadius: "20px",
                background: `${COLOR_MAP[item.color] ?? "#8B3FD8"}18`,
                border: `1px solid ${COLOR_MAP[item.color] ?? "#8B3FD8"}40`,
                fontSize: "0.8rem",
                color: "#1A0A35",
              }}>
                <span style={{ color: COLOR_MAP[item.color] ?? "#8B3FD8", fontWeight: 600, marginRight: "4px" }}>{item.tag}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit mode */}
      {!loading && editMode && draft && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            value={draft.yearIntention}
            onChange={e => setDraft(d => d ? { ...d, yearIntention: e.target.value } : d)}
            placeholder="Year intention / main affirmation…"
            style={{
              width: "100%", padding: "8px 10px",
              border: `1px solid ${theme.accentColor}40`,
              borderRadius: "8px", fontSize: "0.88rem",
              fontFamily: theme.titleFont, fontStyle: "italic",
              color: "#1A0A35", background: "transparent",
              outline: "none", boxSizing: "border-box",
            }}
          />
          {draft.callingIn.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div style={{
                width: "12px", height: "12px", borderRadius: "50%", flexShrink: 0,
                background: COLOR_MAP[item.color] ?? "#8B3FD8",
              }} />
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#1A0A35", minWidth: "70px" }}>{item.tag}</span>
              <input
                value={item.text}
                onChange={e => setDraft(d => {
                  if (!d) return d
                  const ci = [...d.callingIn]
                  ci[i] = { ...ci[i], text: e.target.value }
                  return { ...d, callingIn: ci }
                })}
                placeholder={`${item.tag} intention…`}
                style={{
                  flex: 1, padding: "5px 8px",
                  border: `1px solid rgba(0,0,0,0.12)`,
                  borderRadius: "6px", fontSize: "0.82rem",
                  color: "#1A0A35", background: "transparent",
                  outline: "none", fontFamily: "inherit",
                }}
              />
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}

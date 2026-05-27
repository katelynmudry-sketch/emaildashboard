"use client"

import { useEffect, useState } from "react"
import type { ThemeConfig } from "./theme-config"
import { getDharmaCache, saveDharmaCache, getDashboardPrefs, setDharmaTeacher, type DharmaCache } from "@/lib/dashboard-prefs"

interface Teacher {
  id: string
  name: string
  tradition: string
  description: string
}

interface DharmaWidgetProps {
  theme: ThemeConfig
}

export default function DharmaWidget({ theme }: DharmaWidgetProps) {
  const [data, setData] = useState<DharmaCache | null>(null)
  const [loading, setLoading] = useState(true)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedTeacher, setSelectedTeacher] = useState<string>("")
  const [showTeachers, setShowTeachers] = useState(false)

  // Load teachers list
  useEffect(() => {
    fetch("/api/dashboard/dharma/teachers")
      .then(r => r.json())
      .then(d => setTeachers(d.teachers ?? []))
      .catch(err => console.error("[DharmaWidget] teachers load failed:", err))
  }, [])

  // Load dharma data (cache-first)
  useEffect(() => {
    const prefs = getDashboardPrefs()
    const teacherId = prefs.dharmaTeacherId
    setSelectedTeacher(teacherId)

    const cached = getDharmaCache(teacherId)
    if (cached) {
      setData(cached)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    fetch(`/api/dashboard/dharma?teacher=${teacherId}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        const cache: DharmaCache = {
          date: d.cacheKey,
          teacher: d.teacher.id,
          quote: d.quote,
          source: d.source,
          reflection: d.reflection,
          teacherName: d.teacher.name,
          teacherTradition: d.teacher.tradition,
        }
        saveDharmaCache(cache)
        setData(cache)
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          console.error("[DharmaWidget]", err)
          // Show fallback
          setData({
            date: new Date().toISOString().slice(0, 10),
            teacher: teacherId,
            quote: "The present moment is the only moment available to us.",
            source: null,
            reflection: "What is alive in you right now?",
            teacherName: "Thich Nhat Hanh",
            teacherTradition: "Zen / Plum Village",
          })
        }
      })
      .finally(() => setLoading(false))
    return () => { clearTimeout(timer); controller.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacher])

  function handleTeacherChange(id: string) {
    setSelectedTeacher(id)
    setDharmaTeacher(id)
    setShowTeachers(false)
    setLoading(true)
    setData(null)
  }

  const currentTeacher = teachers.find(t => t.id === selectedTeacher)

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
      position: "relative",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
        <div>
          <div style={{ ...theme.labelStyle, marginBottom: "2px" }}>Dharma</div>
          {currentTeacher && (
            <div style={{ fontSize: "0.78rem", color: "#1A0A35", opacity: 0.55 }}>{currentTeacher.tradition}</div>
          )}
        </div>
        {/* Teacher selector */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowTeachers(v => !v)}
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
            {currentTeacher?.name.split(" ").pop() ?? "Teacher"} ▾
          </button>
          {showTeachers && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50,
              background: "#FFFEF9",
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: "12px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              minWidth: "180px",
              overflow: "hidden",
            }}>
              {teachers.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTeacherChange(t.id)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "9px 14px",
                    background: t.id === selectedTeacher ? `${theme.accentColor}12` : "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    color: "#1A0A35",
                    fontFamily: "inherit",
                    borderBottom: "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div style={{ opacity: 0.5, fontSize: "0.72rem" }}>{t.tradition}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quote */}
      {loading && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: "16px", borderRadius: "6px",
              background: "linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.03) 50%, rgba(0,0,0,0.06) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.4s infinite",
              width: i === 3 ? "60%" : "100%",
            }} />
          ))}
        </div>
      )}
      {!loading && data && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <blockquote style={{
            margin: 0,
            fontFamily: theme.titleFont,
            fontSize: "1.05rem",
            fontStyle: "italic",
            lineHeight: 1.55,
            color: "#1A0A35",
            borderLeft: `3px solid ${theme.accentColor}`,
            paddingLeft: "14px",
          }}>
            "{data.quote}"
          </blockquote>
          {data.source && (
            <div style={{ fontSize: "0.73rem", color: "#1A0A35", opacity: 0.5, marginTop: "8px", paddingLeft: "17px" }}>
              — {data.teacherName}, {data.source}
            </div>
          )}
          {/* Reflection */}
          <div style={{
            marginTop: "14px",
            padding: "10px 12px",
            background: `${theme.accentColor}0D`,
            borderRadius: "10px",
            fontSize: "0.83rem",
            color: "#1A0A35",
            fontStyle: "italic",
          }}>
            🌿 {data.reflection}
          </div>
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

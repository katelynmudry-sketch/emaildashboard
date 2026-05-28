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

  useEffect(() => {
    fetch("/api/dashboard/dharma/teachers")
      .then(r => r.json())
      .then(d => setTeachers(d.teachers ?? []))
      .catch(err => console.error("[DharmaWidget] teachers:", err))
  }, [])

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
  const isAltar = theme.id === "morning-altar"
  const isFestival = theme.id === "festival-stage"

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
      position: "relative",
    }}>
      {/* Header row */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "14px",
        paddingBottom: "12px",
        borderBottom: theme.sectionDivider,
      }}>
        <div>
          <div style={{ ...theme.labelStyle, marginBottom: "4px" }}>
            {isFestival ? "DHARMA" : "Dharma"}
          </div>
          {currentTeacher && (
            <div style={{
              fontFamily: theme.bodyFont,
              fontSize: "0.76rem",
              color: "#1A0A35",
              opacity: 0.5,
              fontStyle: isAltar ? "italic" : "normal",
            }}>
              {currentTeacher.tradition}
            </div>
          )}
        </div>

        {/* Teacher picker */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowTeachers(v => !v)}
            style={{
              background: "transparent",
              border: `1px solid ${theme.accentColor}50`,
              borderRadius: isFestival ? "4px" : "20px",
              padding: "3px 10px",
              fontSize: isFestival ? "0.75rem" : "0.72rem",
              cursor: "pointer",
              color: theme.accentColor,
              fontFamily: isFestival ? "'Bebas Neue', sans-serif" : theme.bodyFont,
              letterSpacing: isFestival ? "0.1em" : undefined,
            }}
          >
            {currentTeacher?.name.split(" ").pop() ?? "Teacher"} ▾
          </button>
          {showTeachers && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50,
              background: theme.cardBg,
              border: theme.cardBorder,
              borderRadius: theme.cardRadius,
              boxShadow: isFestival ? "4px 4px 0 #1A0A35" : "0 4px 24px rgba(0,0,0,0.10)",
              minWidth: "190px",
              overflow: "hidden",
            }}>
              {teachers.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTeacherChange(t.id)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: isFestival ? "8px 14px" : "10px 14px",
                    background: t.id === selectedTeacher ? `${theme.accentColor}12` : "transparent",
                    border: "none",
                    borderBottom: theme.sectionDivider,
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    color: "#1A0A35",
                    fontFamily: theme.bodyFont,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: isFestival ? "0.78rem" : "0.82rem" }}>{t.name}</div>
                  <div style={{ opacity: 0.45, fontSize: "0.7rem" }}>{t.tradition}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "9px" }}>
          {[100, 100, 70].map((w, i) => (
            <div key={i} style={{
              height: "14px", borderRadius: "6px", width: `${w}%`,
              background: "linear-gradient(90deg, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.025) 50%, rgba(0,0,0,0.05) 75%)",
              backgroundSize: "200% 100%",
              animation: "db-shimmer 1.4s infinite",
            }} />
          ))}
        </div>
      )}

      {!loading && data && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px" }}>
          {/* Quote */}
          <blockquote style={{
            margin: 0,
            fontFamily: theme.titleFont,
            fontSize: theme.quoteFontSize,
            fontStyle: isAltar ? "italic" : isFestival ? "normal" : "italic",
            fontWeight: isAltar ? 300 : isFestival ? 400 : 400,
            lineHeight: isAltar ? 1.65 : 1.5,
            color: "#1A0A35",
            borderLeft: isFestival
              ? `3px solid ${theme.accentColor}`
              : `2px solid ${theme.accentColor}60`,
            paddingLeft: "14px",
            letterSpacing: isFestival ? "0.01em" : undefined,
          }}>
            {isAltar ? `"${data.quote}"` : data.quote}
          </blockquote>

          {/* Attribution */}
          {data.source && (
            <div style={{
              fontFamily: theme.bodyFont,
              fontSize: "0.72rem",
              color: "#1A0A35",
              opacity: 0.45,
              paddingLeft: "17px",
              fontStyle: isAltar ? "italic" : "normal",
            }}>
              {isFestival ? `— ${data.teacherName.toUpperCase()} / ${data.source.toUpperCase()}` : `— ${data.teacherName}, ${data.source}`}
            </div>
          )}

          {/* Reflection prompt */}
          <div style={{
            marginTop: "4px",
            padding: isAltar ? "12px 14px" : "9px 12px",
            background: `${theme.accentColor}0E`,
            borderRadius: isAltar ? "12px" : isFestival ? "6px" : "10px",
            border: isFestival ? `1px dashed ${theme.accentColor}50` : undefined,
            fontSize: isAltar ? "0.9rem" : "0.82rem",
            fontFamily: theme.bodyFont,
            fontStyle: isAltar ? "italic" : "normal",
            color: "#1A0A35",
            lineHeight: 1.45,
          }}>
            {isAltar ? `✦ ${data.reflection}` : isFestival ? `▸ ${data.reflection}` : `· ${data.reflection}`}
          </div>
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

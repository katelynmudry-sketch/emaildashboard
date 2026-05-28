"use client"

import type { Email, CalendarEvent } from "@/lib/types"
import type { ThemeConfig } from "./theme-config"

const FIESTA_COLORS = ["#FF1F6E", "#FFD000", "#FF6B1A", "#00C4A7", "#8FC900", "#8B3FD8"]

function bucketEvent(title: string): string {
  const t = title.toLowerCase()
  if (/call|meet|zoom|sync|standup|huddle|debrief|check.?in/.test(t)) return "Calls"
  if (/class|workshop|training|course|lesson|session/.test(t)) return "Learning"
  if (/gym|yoga|walk|run|hike|swim|workout|pilates|stretch/.test(t)) return "Movement"
  if (/creative|studio|design|write|draw|paint|record|create/.test(t)) return "Creative"
  if (/dinner|lunch|coffee|brunch|breakfast|drinks/.test(t)) return "Social"
  if (/drive|pickup|drop|commute|travel/.test(t)) return "Transit"
  return "Personal"
}

function parseTimeToMin(str: string): number {
  if (!str || str === "All day") return 0
  const match = str.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return 0
  let h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const ampm = match[3].toUpperCase()
  if (ampm === "PM" && h !== 12) h += 12
  if (ampm === "AM" && h === 12) h = 0
  return h * 60 + m
}

interface InsightWidgetProps {
  emails: Email[]
  calendarEvents: CalendarEvent[]
  theme: ThemeConfig
}

export default function InsightWidget({ emails, calendarEvents, theme }: InsightWidgetProps) {
  const today = new Date()
  const dateStr = today.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

  const isAltar = theme.id === "morning-altar"
  const isFestival = theme.id === "festival-stage"
  const isWabi = theme.id === "wabi-sabi-studio"

  // ── Inbox breakdown ───────────────────────────────────────────────────────
  const categoryMap: Record<string, number> = {}
  for (const email of emails) {
    const cat = email.category || "Other"
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1
  }
  const sorted = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])
  const top5 = sorted.slice(0, 5)
  const otherCount = sorted.slice(5).reduce((s, [, n]) => s + n, 0)
  if (otherCount > 0) top5.push(["Other", otherCount])
  const totalEmails = emails.length || 1

  // ── Calendar breakdown ────────────────────────────────────────────────────
  let bookedMins = 0
  const calBuckets: Record<string, number> = {}
  for (const evt of calendarEvents) {
    const startMin = parseTimeToMin(evt.startTime)
    const endMin = evt.endTime ? parseTimeToMin(evt.endTime) : startMin + 60
    const dur = Math.max(endMin - startMin, 0)
    bookedMins += dur
    const bucket = bucketEvent(evt.title)
    calBuckets[bucket] = (calBuckets[bucket] ?? 0) + dur
  }
  const freeMins = Math.max(16 * 60 - bookedMins, 0)
  if (freeMins > 0) calBuckets["Free"] = freeMins
  const calSorted = Object.entries(calBuckets).sort((a, b) => b[1] - a[1])
  const totalCalMins = calSorted.reduce((s, [, m]) => s + m, 0) || 1

  const barH = theme.insightBarHeight
  const barRadius = isFestival ? "3px" : isWabi ? "2px" : "6px"

  return (
    <div style={{
      background: theme.cardBg,
      border: theme.cardBorder,
      borderRadius: theme.cardRadius,
      boxShadow: theme.cardShadow,
      padding: theme.cardPadding,
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: "16px",
        paddingBottom: "12px",
        borderBottom: theme.sectionDivider,
      }}>
        <div style={{ ...theme.labelStyle }}>
          {isFestival ? "DAY AT A GLANCE" : "Day at a Glance"}
        </div>
        <div style={{
          fontFamily: theme.bodyFont,
          fontSize: "0.72rem",
          color: "#1A0A35",
          opacity: 0.4,
          letterSpacing: isWabi ? "0.1em" : undefined,
        }}>{dateStr}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>

        {/* ── Inbox split ── */}
        <div>
          <div style={{
            fontFamily: theme.bodyFont,
            fontSize: isFestival ? "0.82rem" : "0.76rem",
            fontWeight: 600,
            color: "#1A0A35",
            opacity: 0.55,
            marginBottom: "10px",
            letterSpacing: isFestival ? "0.08em" : undefined,
            textTransform: isFestival ? "uppercase" : undefined,
          }}>
            📬 Inbox{emails.length > 0 ? ` · ${emails.length}` : ""}
          </div>

          {emails.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "#1A0A35", opacity: 0.3, fontStyle: isAltar ? "italic" : "normal", margin: 0, fontFamily: theme.bodyFont }}>
              No emails loaded
            </p>
          ) : (
            <>
              {/* Stacked bar */}
              <div style={{
                display: "flex",
                height: barH,
                borderRadius: barRadius,
                overflow: "hidden",
                marginBottom: "12px",
                border: isFestival ? "1.5px solid #1A0A35" : undefined,
                gap: isFestival ? "2px" : undefined,
              }}>
                {top5.map(([, count], i) => (
                  <div key={i} style={{
                    width: `${(count / totalEmails) * 100}%`,
                    background: FIESTA_COLORS[i % FIESTA_COLORS.length],
                    transition: "width 0.6s ease",
                    flexShrink: 0,
                  }} />
                ))}
              </div>
              {/* Legend */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {top5.map(([cat, count], i) => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <div style={{
                      width: isFestival ? "10px" : "8px",
                      height: isFestival ? "10px" : "8px",
                      borderRadius: isFestival ? "2px" : "3px",
                      background: FIESTA_COLORS[i % FIESTA_COLORS.length],
                      flexShrink: 0,
                    }} />
                    <span style={{
                      flex: 1,
                      fontFamily: theme.bodyFont,
                      fontSize: "0.76rem",
                      color: "#1A0A35",
                      opacity: 0.75,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      textTransform: isFestival ? "uppercase" : undefined,
                      letterSpacing: isFestival ? "0.06em" : undefined,
                    }}>{cat}</span>
                    <span style={{
                      fontFamily: theme.bodyFont,
                      fontSize: "0.72rem",
                      color: "#1A0A35",
                      opacity: 0.4,
                      fontVariantNumeric: "tabular-nums",
                    }}>{Math.round((count / totalEmails) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Calendar split ── */}
        <div>
          <div style={{
            fontFamily: theme.bodyFont,
            fontSize: isFestival ? "0.82rem" : "0.76rem",
            fontWeight: 600,
            color: "#1A0A35",
            opacity: 0.55,
            marginBottom: "10px",
            letterSpacing: isFestival ? "0.08em" : undefined,
            textTransform: isFestival ? "uppercase" : undefined,
          }}>
            📅 Day{calendarEvents.length > 0
              ? ` · ${Math.round(bookedMins / 60 * 10) / 10}h booked`
              : ""}
          </div>

          {calSorted.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "#1A0A35", opacity: 0.3, fontStyle: isAltar ? "italic" : "normal", margin: 0, fontFamily: theme.bodyFont }}>
              {isAltar ? "Your day unfolds freely" : "No events loaded"}
            </p>
          ) : (
            <>
              {/* Stacked bar */}
              <div style={{
                display: "flex",
                height: barH,
                borderRadius: barRadius,
                overflow: "hidden",
                marginBottom: "12px",
                border: isFestival ? "1.5px solid #1A0A35" : undefined,
                gap: isFestival ? "2px" : undefined,
              }}>
                {calSorted.map(([cat, mins], i) => (
                  <div key={cat} style={{
                    width: `${(mins / totalCalMins) * 100}%`,
                    background: cat === "Free"
                      ? `${FIESTA_COLORS[i % FIESTA_COLORS.length]}38`
                      : FIESTA_COLORS[i % FIESTA_COLORS.length],
                    transition: "width 0.6s ease",
                    flexShrink: 0,
                    border: cat === "Free" && isFestival
                      ? `1px dashed ${FIESTA_COLORS[i % FIESTA_COLORS.length]}`
                      : undefined,
                    boxSizing: "border-box",
                  }} />
                ))}
              </div>
              {/* Legend */}
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {calSorted.map(([cat, mins], i) => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <div style={{
                      width: isFestival ? "10px" : "8px",
                      height: isFestival ? "10px" : "8px",
                      borderRadius: isFestival ? "2px" : "3px",
                      background: cat === "Free"
                        ? `${FIESTA_COLORS[i % FIESTA_COLORS.length]}38`
                        : FIESTA_COLORS[i % FIESTA_COLORS.length],
                      border: cat === "Free" ? `1px solid ${FIESTA_COLORS[i % FIESTA_COLORS.length]}60` : "none",
                      flexShrink: 0,
                    }} />
                    <span style={{
                      flex: 1,
                      fontFamily: theme.bodyFont,
                      fontSize: "0.76rem",
                      color: "#1A0A35",
                      opacity: cat === "Free" ? 0.45 : 0.75,
                      textTransform: isFestival ? "uppercase" : undefined,
                      letterSpacing: isFestival ? "0.06em" : undefined,
                    }}>{cat}</span>
                    <span style={{
                      fontFamily: theme.bodyFont,
                      fontSize: "0.72rem",
                      color: "#1A0A35",
                      opacity: 0.4,
                      fontVariantNumeric: "tabular-nums",
                    }}>{Math.round((mins / totalCalMins) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

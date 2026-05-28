import type { DashboardTheme } from "@/lib/types"
import type { CSSProperties } from "react"

export interface ThemeConfig {
  id: DashboardTheme
  name: string
  emoji: string
  description: string

  // Card chrome
  cardBg: string
  cardBorder: string
  cardRadius: string
  cardShadow: string
  cardPadding: string

  // Panel
  panelBg: string           // the full dashboard panel background
  panelPaddingTop: string   // extra breathing room at top of panel

  // Toggle bar (the show/hide strip)
  toggleBarBg: string
  toggleBarTextColor: string
  toggleBarBorderBottom: string

  // Typography
  titleFont: string         // display / heading font
  bodyFont: string          // secondary body font within cards
  accentColor: string       // hex — ring, highlights, borders
  labelStyle: CSSProperties // section label chip style

  // Widget-specific sizes
  dayNameSize: string       // CalendarWidget day-of-week size
  quoteFontSize: string     // DharmaWidget quote text size
  insightBarHeight: string  // InsightWidget stacked bar height

  // Dividers
  sectionDivider: string    // border-bottom value between sections inside a card

  // Font import
  fontImport: string
  bodyFontImport?: string   // optional second font
}

export const THEMES: Record<DashboardTheme, ThemeConfig> = {

  // ── 🕯️ Morning Altar ─────────────────────────────────────────────────────
  // Mood: candlelit temple, spa retreat, golden quiet
  "morning-altar": {
    id: "morning-altar",
    name: "Morning Altar",
    emoji: "🕯️",
    description: "Sacred, contemplative",

    cardBg: "#FFFEF9",
    cardBorder: "1px solid rgba(200,150,12,0.18)",
    cardRadius: "20px",
    cardShadow: "0 4px 32px rgba(200,150,12,0.08), 0 1px 4px rgba(200,150,12,0.06)",
    cardPadding: "24px",

    panelBg: "linear-gradient(180deg, #FAF6EE 0%, #FDF9F2 100%)",
    panelPaddingTop: "8px",

    toggleBarBg: "#FAF5E8",
    toggleBarTextColor: "#7A5A0A",
    toggleBarBorderBottom: "1px solid rgba(200,150,12,0.15)",

    titleFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'Cormorant Garamond', Georgia, serif",
    accentColor: "#C8960C",
    labelStyle: {
      fontFamily: "'Cormorant Garamond', serif",
      letterSpacing: "0.28em",
      textTransform: "uppercase",
      fontSize: "0.68rem",
      fontWeight: 600,
      color: "#C8960C",
      opacity: 0.9,
    },

    dayNameSize: "1.9rem",
    quoteFontSize: "1.1rem",
    insightBarHeight: "10px",

    sectionDivider: "1px solid rgba(200,150,12,0.12)",

    fontImport:
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap",
  },

  // ── 🎪 Festival Stage ─────────────────────────────────────────────────────
  // Mood: concert ticket, day-of-show energy, bold & loud
  "festival-stage": {
    id: "festival-stage",
    name: "Festival Stage",
    emoji: "🎪",
    description: "Bold, joyful",

    cardBg: "#FFFFFF",
    cardBorder: "2px solid #1A0A35",
    cardRadius: "10px",
    cardShadow: "5px 5px 0 #1A0A35",
    cardPadding: "20px",

    panelBg: "#FFFFFF",
    panelPaddingTop: "0px",

    toggleBarBg: "#1A0A35",
    toggleBarTextColor: "#FFFFFF",
    toggleBarBorderBottom: "none",

    titleFont: "'Bebas Neue', 'Arial Narrow', sans-serif",
    bodyFont: "'DM Sans', sans-serif",
    accentColor: "#FF1F6E",
    labelStyle: {
      fontFamily: "'Bebas Neue', sans-serif",
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      fontSize: "1.05rem",
      fontWeight: 400,
      color: "#1A0A35",
    },

    dayNameSize: "2.8rem",
    quoteFontSize: "0.97rem",
    insightBarHeight: "16px",

    sectionDivider: "2px dashed rgba(26,10,53,0.12)",

    fontImport:
      "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap",
  },

  // ── 🎴 Wabi-Sabi Studio ───────────────────────────────────────────────────
  // Mood: Tokyo design studio, precise, airy, intentional whitespace
  "wabi-sabi-studio": {
    id: "wabi-sabi-studio",
    name: "Wabi-Sabi",
    emoji: "🎴",
    description: "Precise, editorial",

    cardBg: "#FFFFFF",
    cardBorder: "1px solid rgba(26,10,53,0.08)",
    cardRadius: "14px",
    cardShadow: "none",
    cardPadding: "22px",

    panelBg: "#FAFAFA",
    panelPaddingTop: "4px",

    toggleBarBg: "#FAFAFA",
    toggleBarTextColor: "#1A0A35",
    toggleBarBorderBottom: "1px solid rgba(26,10,53,0.08)",

    titleFont: "'Syne', sans-serif",
    bodyFont: "'Syne', sans-serif",
    accentColor: "#8B3FD8",
    labelStyle: {
      fontFamily: "'Syne', sans-serif",
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      fontSize: "0.65rem",
      fontWeight: 700,
      color: "#8B3FD8",
    },

    dayNameSize: "1.65rem",
    quoteFontSize: "0.92rem",
    insightBarHeight: "8px",

    sectionDivider: "1px solid rgba(26,10,53,0.06)",

    fontImport:
      "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap",
  },
}

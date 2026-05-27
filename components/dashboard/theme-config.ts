import type { DashboardTheme } from "@/lib/types"
import type { CSSProperties } from "react"

export interface ThemeConfig {
  id: DashboardTheme
  name: string
  emoji: string
  description: string
  panelBg: string
  cardBg: string
  cardBorder: string
  cardRadius: string
  cardShadow: string
  titleFont: string
  accentColor: string   // hex — for breathwork ring, highlights
  labelStyle: CSSProperties
  fontImport: string
}

export const THEMES: Record<DashboardTheme, ThemeConfig> = {
  "morning-altar": {
    id: "morning-altar",
    name: "Morning Altar",
    emoji: "🕯️",
    description: "Sacred, contemplative",
    panelBg: "transparent",
    cardBg: "#FFFEF9",
    cardBorder: "1px solid rgba(200,150,12,0.20)",
    cardRadius: "18px",
    cardShadow: "0 2px 24px rgba(200,150,12,0.07)",
    titleFont: "'Cormorant Garamond', Georgia, serif",
    accentColor: "#C8960C",
    labelStyle: {
      fontFamily: "'Cormorant Garamond', serif",
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      fontSize: "0.72rem",
      fontWeight: 600,
      color: "#C8960C",
    },
    fontImport:
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&display=swap",
  },
  "festival-stage": {
    id: "festival-stage",
    name: "Festival Stage",
    emoji: "🎪",
    description: "Bold, joyful",
    panelBg: "transparent",
    cardBg: "#FFFFFF",
    cardBorder: "2px solid #1A0A35",
    cardRadius: "12px",
    cardShadow: "4px 4px 0 #1A0A35",
    titleFont: "'Bebas Neue', sans-serif",
    accentColor: "#FF1F6E",
    labelStyle: {
      fontFamily: "'Bebas Neue', sans-serif",
      letterSpacing: "0.12em",
      fontSize: "1.1rem",
      color: "#1A0A35",
    },
    fontImport:
      "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap",
  },
  "wabi-sabi-studio": {
    id: "wabi-sabi-studio",
    name: "Wabi-Sabi",
    emoji: "🎴",
    description: "Precise, editorial",
    panelBg: "transparent",
    cardBg: "#FFFFFF",
    cardBorder: "1px solid rgba(26,10,53,0.10)",
    cardRadius: "14px",
    cardShadow: "0 2px 16px rgba(26,10,53,0.05)",
    titleFont: "'Syne', sans-serif",
    accentColor: "#8B3FD8",
    labelStyle: {
      fontFamily: "'Syne', sans-serif",
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      fontSize: "0.68rem",
      fontWeight: 700,
      color: "#8B3FD8",
    },
    fontImport:
      "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap",
  },
}

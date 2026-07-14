import type { PartyMode } from "./party-mode"

/**
 * Page-level visual tokens for the 3-theme system, read by Dashboard.tsx's
 * header/hero region. Values here are byte-identical to the inline
 * `mode === "zen" ? … : mode === "wabi-sabi" ? … : …` ternaries they replace —
 * this is a lookup-table refactor, not a redesign. See THEME_EXCLUSIVE below
 * for elements that intentionally differ in kind (not just color) per theme.
 */
export interface ThemeTokens {
  accent: string
  pageBg: string
  ambientGlow: string

  headingColor: string
  subtitleColor: string

  iconBg: string
  iconBorder: string
  iconShadow: string

  connectWorkGmailColor: string

  batchPillActiveBg: string
  batchPillActiveText: string
  batchPillInactiveText: string
  batchPillActiveBorder: string
  batchPillActiveWeight: number

  refreshBtnBg: string
  refreshBtnBgLoading: string
  refreshBtnText: string
  refreshBtnBorder: string
  refreshBtnShadow: string
  refreshBtnWeight: number

  composeBtnBorder: string
  composeBtnBg: string
  composeBtnText: string

  roastBtnBorder: string
  roastBtnBg: string
  roastBtnText: string

  todoCardBg: string
  todoCardShadow: string

  priorityDotStyle: "outline" | "soft-fill" | "solid"
}

export function getTheme(mode: PartyMode): ThemeTokens {
  if (mode === "zen") {
    return {
      accent: "#C8960C",
      pageBg: "#FAF6EE",
      ambientGlow: `radial-gradient(ellipse 90% 55% at 8% 0%, rgba(200,150,12,0.06) 0%, transparent 55%),
       radial-gradient(ellipse 70% 50% at 92% 100%, rgba(0,200,160,0.04) 0%, transparent 55%),
       radial-gradient(ellipse 50% 40% at 55% 55%, rgba(200,150,12,0.02) 0%, transparent 60%)`,

      headingColor: "#3D2800",
      subtitleColor: "rgba(61,40,0,0.40)",

      iconBg: "linear-gradient(135deg, #C8960C 0%, #B07B0A 100%)",
      iconBorder: "none",
      iconShadow: "0 8px 32px rgba(200,150,12,0.30)",

      connectWorkGmailColor: "#C8960C",

      batchPillActiveBg: "#C8960C",
      batchPillActiveText: "#3D2800",
      batchPillInactiveText: "rgba(26,10,53,0.42)",
      batchPillActiveBorder: "none",
      batchPillActiveWeight: 600,

      refreshBtnBg: "#C8960C",
      refreshBtnBgLoading: "rgba(200,150,12,0.30)",
      refreshBtnText: "#FFF8E0",
      refreshBtnBorder: "none",
      refreshBtnShadow: "0 4px 20px rgba(200,150,12,0.30)",
      refreshBtnWeight: 700,

      composeBtnBorder: "1px solid rgba(200,150,12,0.35)",
      composeBtnBg: "rgba(200,150,12,0.07)",
      composeBtnText: "#C8960C",

      roastBtnBorder: "1px solid rgba(200,150,12,0.35)",
      roastBtnBg: "rgba(200,150,12,0.07)",
      roastBtnText: "#C8960C",

      todoCardBg: "#FFFEF9",
      todoCardShadow: "0 4px 24px rgba(255,208,0,0.08)",

      priorityDotStyle: "soft-fill",
    }
  }

  if (mode === "wabi-sabi") {
    return {
      accent: "#111111",
      pageBg: "#FFFFFF",
      ambientGlow: `radial-gradient(ellipse 90% 55% at 8% 0%, rgba(26,10,53,0.03) 0%, transparent 55%),
         radial-gradient(ellipse 70% 50% at 92% 100%, rgba(26,10,53,0.02) 0%, transparent 55%),
         radial-gradient(ellipse 50% 40% at 55% 55%, rgba(26,10,53,0.01) 0%, transparent 60%)`,

      headingColor: "#1A0A35",
      subtitleColor: "rgba(26,10,53,0.35)",

      iconBg: "transparent",
      iconBorder: "2px solid #111",
      iconShadow: "none",

      connectWorkGmailColor: "#111",

      batchPillActiveBg: "transparent",
      batchPillActiveText: "#111",
      batchPillInactiveText: "rgba(17,17,17,0.38)",
      batchPillActiveBorder: "1.5px solid #111",
      batchPillActiveWeight: 800,

      refreshBtnBg: "transparent",
      refreshBtnBgLoading: "rgba(255,31,110,0.3)",
      refreshBtnText: "#111",
      refreshBtnBorder: "1.5px solid rgba(17,17,17,0.25)",
      refreshBtnShadow: "none",
      refreshBtnWeight: 800,

      composeBtnBorder: "1.5px solid rgba(26,10,53,0.18)",
      composeBtnBg: "transparent",
      composeBtnText: "#111",

      roastBtnBorder: "1px solid rgba(26,10,53,0.22)",
      roastBtnBg: "rgba(26,10,53,0.05)",
      roastBtnText: "#1A0A35",

      todoCardBg: "#FFFFFF",
      todoCardShadow: "none",

      priorityDotStyle: "outline",
    }
  }

  // party (default)
  return {
    accent: "#FF1F6E",
    pageBg: "#EEE4FF",
    ambientGlow: `radial-gradient(ellipse 90% 55% at 8% 0%, rgba(255,31,110,0.07) 0%, transparent 55%),
         radial-gradient(ellipse 70% 50% at 92% 100%, rgba(0,229,196,0.05) 0%, transparent 55%),
         radial-gradient(ellipse 50% 40% at 55% 55%, rgba(255,208,0,0.03) 0%, transparent 60%)`,

    headingColor: "#1A0A35",
    subtitleColor: "rgba(26,10,53,0.35)",

    iconBg: "linear-gradient(135deg, #FF1F6E 0%, #FF6B1A 100%)",
    iconBorder: "none",
    iconShadow: "0 8px 32px rgba(255,31,110,0.38)",

    connectWorkGmailColor: "#FF1F6E",

    batchPillActiveBg: "#FF1F6E",
    batchPillActiveText: "#1A0A35",
    batchPillInactiveText: "rgba(26,10,53,0.42)",
    batchPillActiveBorder: "none",
    batchPillActiveWeight: 600,

    refreshBtnBg: "#FF1F6E",
    refreshBtnBgLoading: "rgba(255,31,110,0.3)",
    refreshBtnText: "#1A0A35",
    refreshBtnBorder: "none",
    refreshBtnShadow: "0 4px 20px rgba(255,31,110,0.45)",
    refreshBtnWeight: 700,

    composeBtnBorder: "1px solid rgba(0,229,196,0.40)",
    composeBtnBg: "rgba(0,229,196,0.08)",
    composeBtnText: "#00E5C4",

    roastBtnBorder: "1px solid rgba(255,107,26,0.40)",
    roastBtnBg: "rgba(255,107,26,0.09)",
    roastBtnText: "#FF6B1A",

    todoCardBg: "#FFFFFF",
    todoCardShadow: "0 4px 24px rgba(255,208,0,0.08)",

    priorityDotStyle: "solid",
  }
}

/**
 * THEME_EXCLUSIVE — elements deliberately shown in only one theme, not
 * candidates for token unification because the *kind* of element differs,
 * not just its color:
 * - Mindful Purge (zen-only entry point into the bulk-cleanup flow)
 * - Roast copy/voice (dharma-teacher wisdom vs. hype-man vs. Basic AF bestie —
 *   see SYSTEM_PROMPTS in app/api/ai/roast/route.ts)
 * - Dharma/Breathwork morning-dashboard widgets (see theme-config.ts + DashboardPanel.tsx)
 */

"use client"

import type { PartyMode } from "@/lib/party-mode"
import { categoryNoun } from "@/lib/party-mode"

interface Props {
  mode: PartyMode
}

interface Section {
  emoji: string
  title: string
  body: string
}

function buildSections(mode: PartyMode): Section[] {
  const noun = categoryNoun(mode)

  return [
    {
      emoji: "🗂️",
      title: `Moving emails between ${noun.plural.toLowerCase()}`,
      body: mode === "zen"
        ? `Select one or more emails in any ${noun.singular.toLowerCase()} and use "Move to" in the bulk action bar to re-file them. Claude quietly learns from the move, so future emails like it land in the right place on their own.`
        : mode === "wabi-sabi"
          ? `Select emails in any ${noun.singular.toLowerCase()}, hit "Move to," and pick a new home — it's giving organized. Claude remembers the move so it sorts similar emails there next time, no extra work bestie.`
          : `Select emails in any ${noun.singular.toLowerCase()}, then use "Move to" in the bulk action bar to re-file them anywhere. Claude learns from every move, so it gets better at sorting your inbox automatically.`,
    },
    {
      emoji: "📌",
      title: `Priority pin`,
      body: mode === "zen"
        ? `Pin one ${noun.singular.toLowerCase()} as your priority with the 📌 button in its header. It always settles into the top-center spot, so the thing that matters most is never buried.`
        : mode === "wabi-sabi"
          ? `Pin ur most important ${noun.singular.toLowerCase()} with the 📌 button and it stays front and center, top of the grid, always. Main character energy for ur inbox.`
          : `Pin your most important ${noun.singular.toLowerCase()} with the 📌 button — it locks into the top-center slot of the grid so it's always front and center.`,
    },
    {
      emoji: "🔌",
      title: "One-click unsubscribe",
      body: mode === "zen"
        ? "When a sender supports it, an Unsubscribe action appears — on a single email or as a bulk action across several at once. One click, and the noise is gone for good."
        : mode === "wabi-sabi"
          ? "If a sender supports it, you'll see an Unsubscribe button — solo or as a bulk action on a whole batch. One tap and that newsletter is OUT, no more cluttering ur vibe."
          : "When a sender supports it, an Unsubscribe button shows up — on one email or as a bulk action across many. One click and that sender is gone for good.",
    },
    {
      emoji: "🌱",
      title: "Karma, XP & your inbox plant",
      body: mode === "zen"
        ? "Every action — archiving, replying, unsubscribing, clearing your inbox — earns a small amount of karma. Watch it grow a plant through its stages, a quiet reflection of the care you've put in."
        : mode === "wabi-sabi"
          ? "Literally every move you make — archive, reply, unsubscribe, whatever — earns XP and grows ur little plant through its stages. It's a whole glow-up arc for ur inbox and we are HERE for it."
          : "Every action you take — archiving, replying, unsubscribing, clearing a category — earns XP and grows your inbox plant through its stages. It's a game, and you're winning it.",
    },
    {
      emoji: "💤",
      title: "Snooze",
      body: mode === "zen"
        ? "Not ready for an email yet? Snooze it to tomorrow, in a few days, or a custom date — it disappears from view and quietly reappears when it's time."
        : mode === "wabi-sabi"
          ? "Not dealing with this rn? Snooze it — tomorrow, next week, whenever — and it vanishes until it's actually time to deal with it. Future you's problem now."
          : "Not ready to deal with an email? Snooze it for a day, a week, or a custom date — it vanishes from your inbox and pops back up exactly when it should.",
    },
    {
      emoji: "⭐",
      title: "Todo flags",
      body: mode === "zen"
        ? "Star any email to add it to a running to-do list — a gentle reminder that lives separately from the noise of your full inbox."
        : mode === "wabi-sabi"
          ? "Star an email to throw it on ur to-do list — keeps the stuff you actually need to act on separate from everything else cluttering ur inbox."
          : "Star an email to flag it onto your running to-do list, separate from the rest of your inbox, so nothing important slips through.",
    },
    {
      emoji: "🌅",
      title: "Daily Briefing",
      body: mode === "zen"
        ? "A dedicated space surfacing only what's urgent or flagged today, with an optional AI summary — so you can start with what matters most, before anything else."
        : mode === "wabi-sabi"
          ? "Its own little section just for what's urgent or flagged today, with an AI summary if you want one. Start ur day knowing what actually matters, very main character."
          : "A dedicated section that pulls together what's urgent or flagged today, with an optional AI-written summary — your power-up for starting the day strong.",
    },
    {
      emoji: "☀️",
      title: "Morning dashboard",
      body: mode === "zen"
        ? "Beyond email, a quiet morning view: today's calendar, a reflective quote, a space for intention-setting, a guided breath, and a look at your inbox's progress over time."
        : mode === "wabi-sabi"
          ? "There's a whole morning vibe check dashboard too — today's calendar, a daily quote, manifestation space, breathwork timer, and stats on ur inbox progress. Self care AND productivity, we love multitasking."
          : "Beyond your inbox, there's a morning dashboard: today's calendar, a daily quote, a manifestation prompt, a guided breathing timer, and stats tracking your inbox progress over time.",
    },
    {
      emoji: "✉️",
      title: "Reply & compose — and what's NOT saved here",
      body: mode === "zen"
        ? "This is a triage tool first: replying and drafting on existing threads is the core flow. You can compose a brand-new email too, but that's a secondary feature, not the main purpose. Nothing here is stored uniquely — every send and draft goes straight to Gmail, which stays the one true home for your mail."
        : mode === "wabi-sabi"
          ? "This app is for sorting and triaging, that's the whole point — replying on real threads is the main move. You CAN compose a totally new email but that's more of a bonus feature, not really what this is for. Also nothing is saved here uniquely — everything goes straight to Gmail, Gmail is the real owner of ur inbox always."
          : "This app's main job is triage and sorting — replying to existing threads is the core feature. You can compose brand-new emails too, but think of that as a bonus, not the main event. And nothing unique gets saved here — every send or draft goes straight to Gmail, which stays the single source of truth for your mail.",
    },
  ]
}

export default function HelpGuide({ mode }: Props) {
  const sections = buildSections(mode)

  const accent = mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "#C17D3C" : "#8B3FD8"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h3 style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.1rem", color: "#1A0A35",
          margin: "0 0 6px",
        }}>
          {mode === "zen" ? "How it all works" : mode === "wabi-sabi" ? "how this app actually works" : "HOW THIS APP WORKS"}
        </h3>
        <p style={{ fontSize: "0.82rem", color: "rgba(26,10,53,0.55)", lineHeight: 1.5, margin: 0 }}>
          {mode === "zen"
            ? "A quick tour of what makes this inbox different from a normal one."
            : mode === "wabi-sabi"
              ? "everything that makes this inbox different from a regular one, real quick."
              : "A quick rundown of everything that makes this inbox different from a normal one."}
        </p>
      </div>

      {sections.map(section => (
        <div key={section.title} style={{
          padding: "14px 16px",
          borderRadius: 12,
          border: "1px solid rgba(26,10,53,0.08)",
          background: "rgba(26,10,53,0.02)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: "1.1rem" }}>{section.emoji}</span>
            <h4 style={{
              fontSize: "0.88rem", fontWeight: 700, margin: 0,
              color: accent,
            }}>
              {section.title}
            </h4>
          </div>
          <p style={{ fontSize: "0.82rem", color: "rgba(26,10,53,0.70)", lineHeight: 1.55, margin: 0 }}>
            {section.body}
          </p>
        </div>
      ))}
    </div>
  )
}

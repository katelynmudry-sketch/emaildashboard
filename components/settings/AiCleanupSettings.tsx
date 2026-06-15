"use client"

import { useState, useEffect } from "react"
import { loadSettings, saveSettings, type InboxSettings } from "@/lib/settings-storage"
import { SectionLabel, ToggleSwitch } from "./shared"

type CleanupKey =
  | "aiPastEventDelete"
  | "aiDeliveryChainCleanup"
  | "aiSecurityAlertCleanup"
  | "aiSocialNotificationCleanup"
  | "aiExpiredPromoCleanup"
  | "aiOldNewsletterCleanup"
  | "aiLargeAttachmentCleanup"

const TOGGLES: { key: CleanupKey; label: string; desc: string }[] = [
  {
    key: "aiPastEventDelete",
    label: "Flag past calendar events for deletion",
    desc: "Marks event invitation emails as deletable once the event date has passed.",
  },
  {
    key: "aiDeliveryChainCleanup",
    label: "Suggest deleting shipping email chains",
    desc: "After a package arrives, finds the full shipping/tracking thread and offers to delete it.",
  },
  {
    key: "aiSecurityAlertCleanup",
    label: "Flag security & login alerts",
    desc: "OTP codes, login alerts, and security notifications are marked deletable.",
  },
  {
    key: "aiSocialNotificationCleanup",
    label: "Flag social media notifications",
    desc: "Likes, follows, and friend-request emails are marked deletable.",
  },
  {
    key: "aiExpiredPromoCleanup",
    label: "Flag expired promo codes",
    desc: "Single-use discount codes and coupons that have already expired are marked deletable.",
  },
  {
    key: "aiOldNewsletterCleanup",
    label: "Clean up old, read newsletters",
    desc: "Newsletters and digests older than 2 weeks that you've already read are marked deletable.",
  },
  {
    key: "aiLargeAttachmentCleanup",
    label: "Flag large attachments as storage hogs",
    desc: "Emails older than a month with attachments over 2MB are marked deletable.",
  },
]

interface Props {
  accentColor?: string
  title?: string
  description?: string
}

export default function AiCleanupSettings({
  accentColor = "#8B3FD8",
  title = "AI Actions",
  description = "Automatic suggestions Claude surfaces after every inbox load. On by default.",
}: Props) {
  const [values, setValues] = useState<Record<CleanupKey, boolean> | null>(null)

  useEffect(() => {
    const stored = loadSettings()
    setValues({
      aiPastEventDelete: stored.aiPastEventDelete !== false,
      aiDeliveryChainCleanup: stored.aiDeliveryChainCleanup !== false,
      aiSecurityAlertCleanup: stored.aiSecurityAlertCleanup !== false,
      aiSocialNotificationCleanup: stored.aiSocialNotificationCleanup !== false,
      aiExpiredPromoCleanup: stored.aiExpiredPromoCleanup !== false,
      aiOldNewsletterCleanup: !!stored.aiOldNewsletterCleanup,
      aiLargeAttachmentCleanup: !!stored.aiLargeAttachmentCleanup,
    })
  }, [])

  if (!values) return null

  return (
    <div style={{ background: "rgba(139,63,216,0.04)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(139,63,216,0.12)" }}>
      <SectionLabel color={accentColor}>{title}</SectionLabel>
      <p style={{ fontSize: "0.75rem", color: "rgba(26,10,53,0.50)", margin: "0 0 10px", lineHeight: 1.5 }}>
        {description}
      </p>
      {TOGGLES.map(({ key, label, desc }) => (
        <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
          <ToggleSwitch
            checked={values[key]}
            activeColor={accentColor}
            onChange={() => {
              const next = !values[key]
              setValues(v => v && { ...v, [key]: next })
              saveSettings({ [key]: next } as Partial<InboxSettings>)
            }}
          />
          <div>
            <div style={{ fontSize: "0.80rem", fontWeight: 600, color: "#1A0A35", lineHeight: 1.3 }}>{label}</div>
            <div style={{ fontSize: "0.72rem", color: "rgba(26,10,53,0.50)", marginTop: 1 }}>{desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

"use client"

import { useEffect } from "react"
import type { PartyMode } from "@/lib/party-mode"
import { getTheme } from "@/lib/theme"

interface Props {
  mode: PartyMode
  message: string
  onUndo: () => void
  onDismiss: () => void
  durationMs?: number
}

/** Transient bottom toast with an Undo action — auto-dismisses after durationMs. */
export default function UndoToast({ mode, message, onUndo, onDismiss, durationMs = 6000 }: Props) {
  const theme = getTheme(mode)

  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message])

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3"
      style={{
        padding: "10px 16px",
        borderRadius: 12,
        background: theme.headingColor,
        color: theme.pageBg,
        boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        fontSize: "0.85rem",
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={() => { onUndo(); onDismiss() }}
        style={{
          background: "none", border: "none",
          color: theme.accent,
          fontWeight: 700, fontSize: "0.85rem",
          cursor: "pointer", textDecoration: "underline",
        }}
      >
        Undo
      </button>
    </div>
  )
}

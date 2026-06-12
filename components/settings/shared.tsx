// components/settings/shared.tsx
// Shared style constants and small components used across Settings panel tabs.

export const TEXTAREA_STYLE: React.CSSProperties = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid rgba(26,10,53,0.14)",
  background: "rgba(26,10,53,0.03)",
  padding: "10px 12px",
  fontSize: "0.82rem",
  lineHeight: 1.65,
  color: "#1A0A35",
  fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
  resize: "vertical",
  outline: "none",
  transition: "border-color 0.15s",
}

export const CODE_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  borderRadius: 8,
  border: "1px solid rgba(26,10,53,0.10)",
  background: "rgba(26,10,53,0.03)",
  padding: "12px 14px",
  fontSize: "0.76rem",
  lineHeight: 1.7,
  color: "rgba(26,10,53,0.80)",
  fontFamily: "ui-monospace, 'Cascadia Code', Consolas, monospace",
  whiteSpace: "pre-wrap",
  overflowY: "auto",
  maxHeight: 420,
  userSelect: "all",
}

export function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      display: "block",
      fontSize: "0.72rem", fontWeight: 700,
      letterSpacing: "0.10em", textTransform: "uppercase",
      color, marginBottom: 6,
    }}>
      {children}
    </span>
  )
}

export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "0.78rem", color: "rgba(26,10,53,0.55)", lineHeight: 1.6, margin: 0 }}>
      {children}
    </p>
  )
}

export function SaveOk({ show }: { show: boolean }) {
  if (!show) return null
  return <span style={{ fontSize: "0.78rem", color: "#00C4A7", fontWeight: 600 }}>✓ Saved!</span>
}

/** Pill-shaped toggle switch — used for all on/off settings in this panel. */
export function ToggleSwitch({
  checked,
  onChange,
  activeColor,
}: {
  checked: boolean
  onChange: () => void
  activeColor: string
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        flexShrink: 0,
        width: 36, height: 20, borderRadius: 99,
        background: checked ? activeColor : "rgba(26,10,53,0.15)",
        border: "none", cursor: "pointer", padding: 0,
        position: "relative", transition: "background 0.2s",
      }}
    >
      <span style={{
        position: "absolute", top: 2,
        left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
        transition: "left 0.2s",
        display: "block",
      }} />
    </button>
  )
}

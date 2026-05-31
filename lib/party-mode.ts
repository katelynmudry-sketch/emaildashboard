export type PartyMode = "zen" | "party" | "wabi-sabi"

const MODE_KEY = "inbox-ai:party-mode"
const GATE_KEY = "inbox-ai:gate-seen"

export function getPartyMode(): PartyMode {
  try {
    const stored = localStorage.getItem(MODE_KEY) as PartyMode | null
    return stored === "zen" || stored === "party" || stored === "wabi-sabi" ? stored : "party"
  } catch {
    return "party"
  }
}

export function setPartyMode(mode: PartyMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode)
    window.dispatchEvent(new CustomEvent("inbox-mode-changed", { detail: mode }))
  } catch {}
}

export function hasSeenGate(): boolean {
  try {
    return sessionStorage.getItem(GATE_KEY) === "1"
  } catch {
    return false
  }
}

export function markGateSeen(): void {
  try {
    sessionStorage.setItem(GATE_KEY, "1")
  } catch {}
}

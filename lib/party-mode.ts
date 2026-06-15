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

const ONBOARDING_PROGRESS_KEY = "inbox-ai:onboarding-progress"

export interface OnboardingProgress {
  mode: PartyMode
  step: number
}

// Persists onboarding wizard progress across the full-page redirect caused by
// "Connect second Gmail" (signIn) so the wizard resumes where it left off
// instead of restarting at the vibe-picker splash gate.
export function getOnboardingProgress(): OnboardingProgress | null {
  try {
    const raw = sessionStorage.getItem(ONBOARDING_PROGRESS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OnboardingProgress
    if (parsed.mode !== "zen" && parsed.mode !== "party" && parsed.mode !== "wabi-sabi") return null
    if (typeof parsed.step !== "number") return null
    return parsed
  } catch {
    return null
  }
}

export function setOnboardingProgress(progress: OnboardingProgress): void {
  try {
    sessionStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress))
  } catch {}
}

export function clearOnboardingProgress(): void {
  try {
    sessionStorage.removeItem(ONBOARDING_PROGRESS_KEY)
  } catch {}
}

// ── Mode-aware category naming ────────────────────────────────────────────────
// Party = Arenas, Zen = Gardens, Basic AF = Eras. Used anywhere "categories"
// or "labels" would otherwise be shown to the user.

export interface CategoryNoun {
  singular: string
  plural: string
}

export function categoryNoun(mode: PartyMode): CategoryNoun {
  switch (mode) {
    case "zen":
      return { singular: "Garden", plural: "Gardens" }
    case "wabi-sabi":
      return { singular: "Era", plural: "Eras" }
    default:
      return { singular: "Arena", plural: "Arenas" }
  }
}

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

// ── Marketing email opt-in ──────────────────────────────────────────────────
// Tracks whether the user has already answered (yes or no) the "want updates
// about other apps?" prompt, so it's only ever shown once per browser.

const EMAIL_OPTIN_KEY = "inbox-ai:email-optin-answered"

export function hasAnsweredEmailOptIn(): boolean {
  try {
    return localStorage.getItem(EMAIL_OPTIN_KEY) === "1"
  } catch {
    return false
  }
}

export function markEmailOptInAnswered(): void {
  try {
    localStorage.setItem(EMAIL_OPTIN_KEY, "1")
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

// ── Mode-aware header/hero copy ───────────────────────────────────────────────
// Values are byte-identical to the inline mode ternaries they replace in
// Dashboard.tsx — a lookup-table refactor, not a copy rewrite.

export interface HeaderCopy {
  subtitle: string
  idleTitle: string
  fetchingTitle: string
  proposingTitle: string
  categorizingTitle: string
  fetchingSubtitle: string
  proposingSubtitle: string
  categorizingSubtitle: string
  errorTitle: string
  roastButtonIdle: string
  roastButtonLoading: string
  savedLabel: string
}

export function getCopy(mode: PartyMode): HeaderCopy {
  if (mode === "zen") {
    return {
      subtitle: "Your Mindful Inbox",
      idleTitle: "Ready when you are.",
      fetchingTitle: "Receiving your letters…",
      proposingTitle: "Reading the patterns…",
      categorizingTitle: "Arranging with care…",
      fetchingSubtitle: "Gathering your inbox with care.",
      proposingSubtitle: "Observing the shape of your correspondence.",
      categorizingSubtitle: "Placing each email where it belongs.",
      errorTitle: "Something went wrong",
      roastButtonIdle: "Read my inbox",
      roastButtonLoading: "Reading",
      savedLabel: "☆ Saved",
    }
  }

  if (mode === "wabi-sabi") {
    return {
      subtitle: "ur inbox bestie",
      idleTitle: "ok bestie let's get into it 💅",
      fetchingTitle: "OMFG LOADING ✨",
      proposingTitle: "FIGURING IT OUT 💅",
      categorizingTitle: "ORGANIZING YOUR LIFE ☕",
      fetchingSubtitle: "hang on bestie, getting your emails rn…",
      proposingSubtitle: "literally analyzing your vibe rn, so exciting…",
      categorizingSubtitle: "Claude is sorting your whole life, you're doing amazing sweetie…",
      errorTitle: "ok something broke bestie 😬",
      roastButtonIdle: "Spill the tea",
      roastButtonLoading: "Spilling",
      savedLabel: "☆ Saved",
    }
  }

  // party (default)
  return {
    subtitle: "Your AI-Powered Inbox",
    idleTitle: "Ready to sort?",
    fetchingTitle: "FETCHING YOUR MAIL",
    proposingTitle: "ANALYZING PATTERNS",
    categorizingTitle: "SORTING YOUR MAIL",
    fetchingSubtitle: "Checking your inbox…",
    proposingSubtitle: "Analyzing your email patterns…",
    categorizingSubtitle: `Claude is sorting your emails into ${categoryNoun(mode).plural}…`,
    errorTitle: "Something went wrong",
    roastButtonIdle: "Roast my inbox",
    roastButtonLoading: "Roasting",
    savedLabel: "★ Starred",
  }
}

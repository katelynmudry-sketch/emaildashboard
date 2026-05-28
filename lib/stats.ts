const STORAGE_KEY = "inbox-ai:stats";
const MAX_ACTION_HISTORY = 200;

type ActionKind =
  | "archive"
  | "star"
  | "delete"
  | "replySent"
  | "forwardSent"
  | "composeSent"
  | "saveDraft"
  | "markRead"
  | "aiDraft"
  | "cleanupDelete"
  | "cleanupDismiss";

export interface ActionEvent {
  action: ActionKind;
  emailId?: string;
  subject?: string;
  mode?: "reply" | "forward";
  timestamp: string;
  details?: string;
}

interface Stats {
  xp: number;
  totalArchived: number;
  totalStarred: number;
  totalDeleted: number;
  totalReplied: number;
  totalRepliesSent: number;
  totalForwardsSent: number;
  totalDraftsSaved: number;
  totalRead: number;
  totalAiDrafts: number;
  totalCleanupDeleted: number;
  totalCleanupDismissed: number;
  lastActionDate: string | null;
  currentStreak: number;
  longestStreak: number;
  history: ActionEvent[];
}

const DEFAULT_STATS: Stats = {
  xp: 0,
  totalArchived: 0,
  totalStarred: 0,
  totalDeleted: 0,
  totalReplied: 0,
  totalRepliesSent: 0,
  totalForwardsSent: 0,
  totalDraftsSaved: 0,
  totalRead: 0,
  totalAiDrafts: 0,
  totalCleanupDeleted: 0,
  totalCleanupDismissed: 0,
  lastActionDate: null,
  currentStreak: 0,
  longestStreak: 0,
  history: [],
};

const XP_VALUES: Record<ActionKind, number> = {
  archive: 2,
  star: 2,
  delete: 3,
  replySent: 5,
  forwardSent: 4,
  composeSent: 5,
  saveDraft: 1,
  markRead: 1,
  aiDraft: 1,
  cleanupDelete: 2,
  cleanupDismiss: 0,
};

function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

function daysBetween(dateA: string, dateB: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round(
    (new Date(dateB).getTime() - new Date(dateA).getTime()) / msPerDay
  );
}

function saveStats(stats: Stats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // localStorage unavailable or quota exceeded — silently ignore
  }
}

export function getStats(): Stats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    const parsed = JSON.parse(raw) as Partial<Stats>;
    return { ...DEFAULT_STATS, ...parsed };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function recordAction(
  action: ActionKind,
  meta: {
    emailId?: string;
    subject?: string;
    mode?: "reply" | "forward";
    details?: string;
  } = {}
): Stats {
  const stats = getStats();
  const todayStr = today();
  const xpGain = XP_VALUES[action] ?? 0;

  stats.xp += xpGain;

  if (action === "archive") stats.totalArchived += 1;
  if (action === "star") stats.totalStarred += 1;
  if (action === "delete") stats.totalDeleted += 1;
  if (action === "replySent") {
    stats.totalReplied += 1;
    stats.totalRepliesSent += 1;
  }
  if (action === "forwardSent") stats.totalForwardsSent += 1;
  if (action === "saveDraft") stats.totalDraftsSaved += 1;
  if (action === "markRead") stats.totalRead += 1;
  if (action === "aiDraft") stats.totalAiDrafts += 1;
  if (action === "cleanupDelete") stats.totalCleanupDeleted += 1;
  if (action === "cleanupDismiss") stats.totalCleanupDismissed += 1;

  if (stats.lastActionDate === null) {
    stats.currentStreak = 1;
  } else if (stats.lastActionDate === todayStr) {
    // same day — streak unchanged
  } else {
    const diff = daysBetween(stats.lastActionDate, todayStr);
    if (diff === 1) {
      stats.currentStreak += 1;
    } else {
      // 2+ days since last action — streak resets
      stats.currentStreak = 1;
    }
  }

  if (stats.currentStreak > stats.longestStreak) {
    stats.longestStreak = stats.currentStreak;
  }

  stats.lastActionDate = todayStr;

  stats.history.unshift({
    action,
    emailId: meta.emailId,
    subject: meta.subject,
    mode: meta.mode,
    timestamp: new Date().toISOString(),
    details: meta.details,
  });

  if (stats.history.length > MAX_ACTION_HISTORY) {
    stats.history = stats.history.slice(0, MAX_ACTION_HISTORY);
  }

  saveStats(stats);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("inbox-stats-updated"));
  }

  return stats;
}

export interface KarmaLevel {
  emoji: string;
  stage: string;
  label: string;
  xp: number;
  nextThreshold: number;
}

export const KARMA_THRESHOLDS = [
  { min: 300, emoji: "🪷", stage: "lotus",  label: "Lotus"  },
  { min: 150, emoji: "🌳", stage: "tree",   label: "Tree"   },
  { min: 75,  emoji: "🪴", stage: "potted", label: "Potted" },
  { min: 25,  emoji: "🌿", stage: "sprout", label: "Sprout" },
  { min: 0,   emoji: "🌱", stage: "seed",   label: "Seed"   },
] as const;

export function getKarmaLevel(): KarmaLevel {
  const stats = getStats();
  const { xp } = stats;

  if (isWilted()) {
    return { emoji: "🥀", stage: "wilted", label: "Wilting", xp, nextThreshold: 25 };
  }

  for (let i = 0; i < KARMA_THRESHOLDS.length; i++) {
    const t = KARMA_THRESHOLDS[i];
    if (xp >= t.min) {
      const nextThreshold = i > 0 ? KARMA_THRESHOLDS[i - 1].min : 9999;
      return { emoji: t.emoji, stage: t.stage, label: t.label, xp, nextThreshold };
    }
  }
  return { emoji: "🌱", stage: "seed", label: "Seed", xp, nextThreshold: 25 };
}

export function getPlantStage(): { emoji: string; stage: string; xp: number } {
  const { emoji, stage, xp } = getKarmaLevel();
  return { emoji, stage, xp };
}

export function isWilted(): boolean {
  try {
    const stats = getStats();
    if (!stats.lastActionDate || stats.currentStreak === 0) return false;
    const diff = daysBetween(stats.lastActionDate, today());
    return diff === 1;
  } catch {
    return false;
  }
}

export function checkAndUpdateStreak(): void {
  const stats = getStats();
  if (!stats.lastActionDate) return;

  const diff = daysBetween(stats.lastActionDate, today());
  if (diff >= 2) {
    stats.currentStreak = 0;
    saveStats(stats);
  }
}

const STORAGE_KEY = "inbox-ai:stats";

interface Stats {
  xp: number;
  totalArchived: number;
  totalStarred: number;
  totalDeleted: number;
  totalReplied: number;
  lastActionDate: string | null;
  currentStreak: number;
  longestStreak: number;
}

const DEFAULT_STATS: Stats = {
  xp: 0,
  totalArchived: 0,
  totalStarred: 0,
  totalDeleted: 0,
  totalReplied: 0,
  lastActionDate: null,
  currentStreak: 0,
  longestStreak: 0,
};

const XP_VALUES: Record<"archive" | "star" | "delete" | "reply", number> = {
  archive: 2,
  star: 2,
  delete: 3,
  reply: 5,
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
  action: "archive" | "star" | "delete" | "reply"
): Stats {
  const stats = getStats();
  const todayStr = today();
  const xpGain = XP_VALUES[action];

  stats.xp += xpGain;

  if (action === "archive") stats.totalArchived += 1;
  if (action === "star") stats.totalStarred += 1;
  if (action === "delete") stats.totalDeleted += 1;
  if (action === "reply") stats.totalReplied += 1;

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

  saveStats(stats);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("inbox-stats-updated"));
  }

  return stats;
}

export function getPlantStage(): { emoji: string; stage: string; xp: number } {
  const stats = getStats();
  const { xp } = stats;

  if (isWilted()) {
    return { emoji: "🥀", stage: "wilted", xp };
  }
  if (xp >= 150) return { emoji: "🌳", stage: "tree", xp };
  if (xp >= 75) return { emoji: "🪴", stage: "potted", xp };
  if (xp >= 25) return { emoji: "🌿", stage: "sprout", xp };
  return { emoji: "🌱", stage: "seed", xp };
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

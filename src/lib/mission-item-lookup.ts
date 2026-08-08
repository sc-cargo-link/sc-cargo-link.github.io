import missionItemsRaw from "@/data/mission_item.txt?raw";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const MISSION_ITEMS = [
  ...new Set(
    missionItemsRaw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  ),
];

const NORMALIZED_INDEX = MISSION_ITEMS.map((name) => ({
  name,
  norm: normalize(name),
  compact: normalize(name).replace(/\s/g, ""),
}));

const ITEM_ALIASES: Record<string, string> = {
  "sunset berries": "Sunset Berry",
  diamond: "Diamonds",
};

function fuzzySubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i += 1;
    if (i === needle.length) return true;
  }
  return false;
}

/** Bounded Levenshtein — returns distance or maxDist+1 if worse. */
function editDistance(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const cur = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

function scoreItem(query: string, itemNorm: string, itemCompact: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const qCompact = q.replace(/\s/g, "");
  const words = q.split(" ").filter(Boolean);

  let score = 0;

  if (itemNorm === q) return 1000;
  if (itemNorm.startsWith(q)) score = Math.max(score, 800);
  if (itemNorm.split(" ").some((w) => w.startsWith(q))) score = Math.max(score, 700);
  if (itemNorm.includes(q)) score = Math.max(score, 500);
  if (itemCompact.includes(qCompact) && qCompact.length >= 2) score = Math.max(score, 450);

  const wordHits = words.reduce((acc, w) => {
    if (itemNorm.split(" ").some((iw) => iw.startsWith(w))) return acc + 140;
    if (itemNorm.includes(w)) return acc + 100;
    return acc;
  }, 0);
  if (wordHits > 0) score = Math.max(score, wordHits);

  if (score === 0 && fuzzySubsequence(qCompact, itemCompact)) score = 200;

  // Typo tolerance for short queries / near-miss names
  if (score === 0 && qCompact.length >= 3) {
    const maxDist = qCompact.length <= 4 ? 1 : 2;
    const dist = editDistance(qCompact, itemCompact, maxDist);
    if (dist <= maxDist) score = Math.max(score, 180 - dist * 40);
    else {
      for (const w of itemNorm.split(" ")) {
        if (w.length < 3) continue;
        const wd = editDistance(qCompact, w, maxDist);
        if (wd <= maxDist) {
          score = Math.max(score, 160 - wd * 40);
          break;
        }
      }
    }
  }

  return score;
}

export function getMissionItems(): string[] {
  return MISSION_ITEMS;
}

function resolveItemAlias(query: string): string {
  const q = normalize(query);
  return ITEM_ALIASES[q] ?? query;
}

export function findMissionItem(query: string): string | null {
  const aliased = resolveItemAlias(query);
  const q = normalize(aliased);
  if (!q) return null;
  const exact = NORMALIZED_INDEX.find((item) => item.norm === q);
  return exact?.name ?? null;
}

export function searchMissionItems(query: string, limit = 8): string[] {
  const q = normalize(query);
  if (!q) return [];

  return NORMALIZED_INDEX
    .map((item) => ({
      name: item.name,
      score: scoreItem(q, item.norm, item.compact),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((x) => x.name);
}

export function resolveMissionItemName(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return trimmed;
  return findMissionItem(trimmed) ?? trimmed;
}

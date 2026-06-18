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
}));

const ITEM_ALIASES: Record<string, string> = {
  "sunset berries": "Sunset Berry",
  diamond: "Diamonds",
};

function scoreItem(query: string, itemNorm: string): number {
  const q = normalize(query);
  if (!q) return 0;

  if (itemNorm === q) return 1000;
  if (itemNorm.startsWith(q)) return 800;
  if (itemNorm.includes(q)) return 500;

  const words = q.split(" ").filter(Boolean);
  const wordScore = words.reduce((acc, w) => (itemNorm.includes(w) ? acc + 120 : acc), 0);
  if (wordScore > 0) return wordScore;

  let i = 0;
  for (const ch of itemNorm) {
    if (ch === q[i]) i += 1;
    if (i === q.length) return 200;
  }

  return 0;
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

export function searchMissionItems(query: string, limit = 6): string[] {
  const q = normalize(query);
  if (!q) return [];

  return NORMALIZED_INDEX
    .map((item) => ({ name: item.name, score: scoreItem(q, item.norm) }))
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

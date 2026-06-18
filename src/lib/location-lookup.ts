import type { MapData, MapPOI, StarSystem } from "@/types/map";
import {
  categorizePoi,
  distance2d,
  formatPoiTreePath,
  getMapData,
  getPoiTreePath,
  STAR_SYSTEMS,
} from "@/lib/map-data";

export function getSystemLabel(system: StarSystem): string {
  return STAR_SYSTEMS.find((s) => s.value === system)?.label ?? system;
}

export interface ResolvedLocation {
  name: string;
  x: number;
  y: number;
  system: StarSystem;
  poi: MapPOI;
}

let locationIndex: ResolvedLocation[] | null = null;

function buildIndex(): ResolvedLocation[] {
  const results: ResolvedLocation[] = [];
  for (const { value: system } of STAR_SYSTEMS) {
    const data = getMapData(system);
    for (const poi of data.pois) {
      results.push({
        name: poi.n,
        x: poi.x,
        y: poi.y,
        system,
        poi,
      });
    }
  }
  return results;
}

export function getAllLocations(): ResolvedLocation[] {
  if (!locationIndex) locationIndex = buildIndex();
  return locationIndex;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function getRefuelStationsInRange(
  from: Pick<ResolvedLocation, "x" | "y" | "system" | "name">,
  maxDistanceM: number,
  systems?: StarSystem[],
  limit = 8
): { name: string; system: StarSystem; distanceM: number }[] {
  const systemList = systems ?? [from.system];
  const results: { name: string; system: StarSystem; distanceM: number }[] = [];

  for (const system of systemList) {
    const data = getMapData(system);
    for (const poi of data.pois) {
      if (!categorizePoi(poi).includes("stations")) continue;
      const distanceM = distance2d(from, { x: poi.x, y: poi.y });
      if (distanceM > maxDistanceM) continue;
      if (distanceM < 1 && poi.n === from.name) continue;
      results.push({ name: poi.n, system, distanceM });
    }
  }

  return results
    .sort((a, b) => a.distanceM - b.distanceM || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function findLocation(query: string): ResolvedLocation | null {
  const q = normalize(query);
  if (!q) return null;
  const all = getAllLocations();

  const byEntityExact = all.find((l) => l.poi.en === query);
  if (byEntityExact) return byEntityExact;

  const byEntity = all.find((l) => l.poi.en && normalize(l.poi.en) === q);
  if (byEntity) return byEntity;

  const exact = all.find((l) => normalize(l.name) === q);
  if (exact) return exact;

  const contains = all.find((l) => normalize(l.name).includes(q) || q.includes(normalize(l.name)));
  if (contains) return contains;

  const words = q.split(" ").filter(Boolean);
  let best: ResolvedLocation | null = null;
  let bestScore = 0;
  for (const loc of all) {
    const name = normalize(loc.name);
    const score = words.reduce((acc, w) => (name.includes(w) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      best = loc;
    }
  }
  return bestScore >= Math.min(2, words.length) ? best : null;
}

export function searchLocations(query: string, limit = 20): ResolvedLocation[] {
  const q = normalize(query);
  if (!q) return [];
  const all = getAllLocations();
  return all
    .map((loc) => ({ loc, score: scorePoiFields(q, loc.name, loc.poi.en, loc.poi.pc) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.loc);
}

export interface MapSearchResult {
  poiIndex: number;
  name: string;
  entity?: string;
  treePath: string[];
  breadcrumb: string;
  score: number;
}

function scorePoiFields(
  query: string,
  name: string,
  entity?: string,
  path?: string[]
): number {
  const q = normalize(query);
  if (!q) return 0;

  const nameNorm = normalize(name);
  const entityNorm = entity ? normalize(entity) : "";
  const pathNorm = path?.map(normalize).join(" ") || "";
  const words = q.split(" ").filter(Boolean);

  let score = 0;

  if (nameNorm === q) score = Math.max(score, 1000);
  if (entityNorm === q) score = Math.max(score, 950);
  if (nameNorm.startsWith(q)) score = Math.max(score, 800);
  if (entityNorm.startsWith(q)) score = Math.max(score, 750);
  if (nameNorm.split(" ").some((w) => w.startsWith(q))) score = Math.max(score, 700);
  if (nameNorm.includes(q)) score = Math.max(score, 500);
  if (entityNorm.includes(q)) score = Math.max(score, 450);
  if (pathNorm.includes(q)) score = Math.max(score, 400);

  const wordHits = words.reduce((acc, w) => {
    if (nameNorm.includes(w)) return acc + 120;
    if (entityNorm.includes(w)) return acc + 80;
    if (pathNorm.includes(w)) return acc + 50;
    return acc;
  }, 0);
  if (wordHits > 0) score = Math.max(score, wordHits);

  const acronym = words.map((w) => w[0]).join("");
  if (acronym.length >= 2 && nameNorm.replace(/\s/g, "").includes(acronym)) {
    score = Math.max(score, 350);
  }

  if (score === 0 && fuzzySubsequence(q, nameNorm)) score = 200;
  if (score === 0 && entityNorm && fuzzySubsequence(q, entityNorm)) score = 150;

  return score;
}

function fuzzySubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i += 1;
    if (i === needle.length) return true;
  }
  return false;
}

export function searchMapLocations(
  data: MapData,
  query: string,
  limit = 12
): MapSearchResult[] {
  const q = normalize(query);
  if (!q) return [];

  return data.pois
    .map((poi, poiIndex) => ({
      poiIndex,
      name: poi.n,
      entity: poi.en,
      treePath: getPoiTreePath(data, poi),
      breadcrumb: formatPoiTreePath(data, poi),
      score: scorePoiFields(q, poi.n, poi.en, poi.pc),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function getLocationCoords(
  name: string,
  preferredSystem?: StarSystem
): { x: number; y: number; system: StarSystem } | null {
  if (preferredSystem) {
    const data = getMapData(preferredSystem);
    const poi = data.pois.find(
      (p) => p.n.toLowerCase() === name.toLowerCase() || p.n.toLowerCase().includes(name.toLowerCase())
    );
    if (poi) return { x: poi.x, y: poi.y, system: preferredSystem };
  }
  const found = findLocation(name);
  if (!found) return null;
  return { x: found.x, y: found.y, system: found.system };
}

export function distanceBetweenLocations(a: string, b: string): number | null {
  const locA = findLocation(a);
  const locB = findLocation(b);
  if (!locA || !locB) return null;
  return distance2d(locA, locB);
}

function tryResolveLineExact(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length < 3) return null;
  return findLocationExact(trimmed);
}

function extractLocationHints(text: string): string[] {
  const hints: string[] = [];
  const add = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length >= 3 && !hints.includes(trimmed)) hints.push(trimmed);
  };

  for (const line of text.split(/\n+/)) {
    add(line.replace(/^[\-•*\d.)\s]+/, ""));
  }

  for (const match of text.matchAll(
    /(?:from|to|at|deliver|pick\s*up|drop\s*off)\s*[:\-]?\s*([^\n,;]+)/gi
  )) {
    add(match[1]);
  }

  return hints;
}

const LOCATION_ALIASES: Record<string, string> = {
  "chawlia s beach": "Chawla's Beach",
  "teasa spaceport": "Lorville",
  "teasa spaceport in lorville": "Lorville",
  "shallow fields station": "CRU-L4 Shallow Fields Station",
  "beautiful glen station": "CRU-L5 Beautiful Glen Station",
  "rayari mcgrath": "Rayari McGrath Research Outpost",
  "rayari mcgrath research outpost": "Rayari McGrath Research Outpost",
};

export function resolveLocationAlias(query: string): string {
  const key = normalize(query);
  if (LOCATION_ALIASES[key]) return LOCATION_ALIASES[key];

  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (key.startsWith(alias) || alias.startsWith(key)) return canonical;
  }

  return query;
}

export function findLocationExactMatches(query: string): ResolvedLocation[] {
  const resolved = resolveLocationAlias(query);
  const q = normalize(resolved);
  if (!q) return [];
  return getAllLocations().filter(
    (l) =>
      normalize(l.name) === q || (l.poi.en !== undefined && normalize(l.poi.en) === q)
  );
}

export function findLocationExactEntity(
  query: string,
  options?: { preferredSystem?: StarSystem }
): string | null {
  const matches = findLocationExactMatches(query);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0].poi.en ?? null;

  if (options?.preferredSystem) {
    const inSystem = matches.filter((m) => m.system === options.preferredSystem);
    if (inSystem.length === 1) return inSystem[0].poi.en ?? null;
  }

  return null;
}

export function getLocationStorageKey(loc: ResolvedLocation): string {
  return loc.poi.en ?? loc.name;
}

export function getLocationDisplayName(stored: string): string {
  if (!stored.trim()) return "";
  const loc = findLocation(stored);
  return loc?.name ?? stored;
}

export function isExactStoredLocation(stored: string): boolean {
  if (!stored.trim()) return true;
  const all = getAllLocations();
  return all.some((l) => l.poi.en === stored);
}

export function migrateLocationToEntity(stored: string): string {
  if (!stored.trim()) return stored;
  if (isExactStoredLocation(stored)) return stored;
  return findLocationExactEntity(stored) ?? stored;
}

export function findLocationExact(query: string): string | null {
  const matches = findLocationExactMatches(query);
  return matches.length === 1 ? getLocationStorageKey(matches[0]) : null;
}

export function findLocationInSystem(query: string, system: StarSystem): ResolvedLocation | null {
  const q = normalize(query);
  if (!q) return null;
  const matches = getAllLocations().filter(
    (l) => l.system === system && normalize(l.name) === q
  );
  return matches[0] ?? null;
}

export function findPoiIndexInMapData(
  data: MapData,
  locationName: string,
  x: number,
  y: number
): number | null {
  const byCoords = data.pois.findIndex((p) => Math.hypot(p.x - x, p.y - y) < 1);
  if (byCoords >= 0) return byCoords;

  const q = normalize(locationName);
  if (!q) return null;
  const byEntity = data.pois.findIndex((p) => p.en === locationName);
  if (byEntity >= 0) return byEntity;
  const byName = data.pois.findIndex((p) => normalize(p.n) === q);
  return byName >= 0 ? byName : null;
}

/** Resolve only exact location name matches from OCR text */
export function resolveExactLocationsFromText(text: string): string[] {
  const found: string[] = [];
  const add = (name: string | null) => {
    if (name && !found.includes(name)) found.push(name);
  };

  add(tryResolveLineExact(text));

  for (const line of text.split(/\n+/)) {
    add(tryResolveLineExact(line));
  }

  for (const match of text.matchAll(
    /(?:from|to|at|deliver|pick\s*up|drop\s*off)\s*[:\-]?\s*([^\n,;]+)/gi
  )) {
    add(tryResolveLineExact(match[1]));
  }

  return found;
}

export function resolveLocationHintsFromText(text: string): string[] {
  return extractLocationHints(text).filter((hint) => !findLocationExact(hint));
}

/** Resolve location names from OCR text using map data */
export function resolveLocationsFromText(text: string): string[] {
  return resolveExactLocationsFromText(text);
}
